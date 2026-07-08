import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cart } from '@shop/contracts';
import * as api from '../api/client';
import { clearCartId, getCartId, setCartId } from '../lib/cartStorage';

export type CartAction = 'add' | 'update' | 'remove';

let sharedCartInitialization: Promise<Cart> | null = null;

function createAndLoadCart(): Promise<Cart> {
  return api.createCart().then(async ({ cartId }) => {
    setCartId(cartId);
    try {
      return await api.getCart(cartId);
    } catch (error) {
      if (getCartId() === cartId) clearCartId();
      throw error;
    }
  });
}

function loadOrCreateCart(): Promise<Cart> {
  if (sharedCartInitialization) return sharedCartInitialization;

  sharedCartInitialization = (async () => {
    const storedCartId = getCartId();
    if (storedCartId) {
      try {
        return await api.getCart(storedCartId);
      } catch (error) {
        if (!api.isMissingCartError(error)) throw error;
        if (getCartId() === storedCartId) clearCartId();
      }
    }

    return createAndLoadCart();
  })().finally(() => {
    sharedCartInitialization = null;
  });

  return sharedCartInitialization;
}

function recoverMissingCart(missingCartId: string): Promise<Cart> {
  if (getCartId() === missingCartId) clearCartId();
  return loadOrCreateCart();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof api.ApiError && error.isNetworkError) {
    return 'Unable to reach the shop server. Check that it is running and try again.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function useCart() {
  const [cartId, setCartIdState] = useState<string | null>(getCartId());
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Readonly<Record<string, CartAction>>>({});
  const mountedRef = useRef(false);

  const applyCart = useCallback((nextCart: Cart) => {
    if (!mountedRef.current) return;
    setCartIdState(nextCart.id);
    setCart(nextCart);
    setError(null);
  }, []);

  const initializeCart = useCallback(async (): Promise<boolean> => {
    try {
      applyCart(await loadOrCreateCart());
      return true;
    } catch (initializationError) {
      if (mountedRef.current) {
        setError(getErrorMessage(initializationError, 'Failed to initialize cart'));
      }
      return false;
    } finally {
      if (mountedRef.current) setIsInitializing(false);
    }
  }, [applyCart]);

  useEffect(() => {
    mountedRef.current = true;
    void initializeCart();

    return () => {
      mountedRef.current = false;
    };
  }, [initializeCart]);

  const retryCart = useCallback(async (): Promise<boolean> => {
    if (mountedRef.current) {
      setError(null);
      if (cartId) setIsLoading(true);
      else setIsInitializing(true);
    }
    try {
      applyCart(await loadOrCreateCart());
      return true;
    } catch (retryError) {
      if (mountedRef.current) setError(getErrorMessage(retryError, 'Failed to load cart'));
      return false;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsInitializing(false);
      }
    }
  }, [applyCart, cartId]);

  const refreshCart = useCallback(async (): Promise<boolean> => {
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    try {
      applyCart(await loadOrCreateCart());
      return true;
    } catch (refreshError) {
      if (mountedRef.current) setError(getErrorMessage(refreshError, 'Failed to refresh cart'));
      return false;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [applyCart]);

  const runCartAction = useCallback(
    async (
      action: CartAction,
      productId: string,
      operation: (activeCartId: string) => Promise<Cart>,
      retryAfterRecovery: boolean,
    ): Promise<boolean> => {
      if (mountedRef.current) {
        setError(null);
        setPendingActions((current) => ({ ...current, [productId]: action }));
      }

      let activeCartId = cartId;
      try {
        if (!activeCartId) {
          const availableCart = await loadOrCreateCart();
          activeCartId = availableCart.id;
          applyCart(availableCart);
        }

        try {
          const updatedCart = await operation(activeCartId);
          if (getCartId() === updatedCart.id) applyCart(updatedCart);
          return true;
        } catch (actionError) {
          if (!api.isMissingCartError(actionError)) throw actionError;

          const replacementCart = await recoverMissingCart(activeCartId);
          applyCart(replacementCart);
          if (!retryAfterRecovery) {
            throw new Error('Your previous cart was no longer available. A new cart is ready.');
          }

          const updatedCart = await operation(replacementCart.id);
          if (getCartId() === updatedCart.id) applyCart(updatedCart);
          return true;
        }
      } catch (actionError) {
        if (mountedRef.current) {
          setError(getErrorMessage(actionError, `Failed to ${action} cart item`));
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setPendingActions((current) => {
            const next = { ...current };
            delete next[productId];
            return next;
          });
        }
      }
    },
    [applyCart, cartId],
  );

  const addItem = useCallback(
    (productId: string): Promise<boolean> =>
      runCartAction(
        'add',
        productId,
        (activeCartId) => api.addToCart(activeCartId, productId),
        true,
      ),
    [runCartAction],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number): Promise<boolean> =>
      runCartAction(
        'update',
        productId,
        (activeCartId) => api.updateCartItem(activeCartId, productId, quantity),
        false,
      ),
    [runCartAction],
  );

  const removeItem = useCallback(
    (productId: string): Promise<boolean> =>
      runCartAction(
        'remove',
        productId,
        (activeCartId) => api.removeFromCart(activeCartId, productId),
        false,
      ),
    [runCartAction],
  );

  const clearCart = useCallback(() => {
    clearCartId();
    if (!mountedRef.current) return;
    setCartIdState(null);
    setCart(null);
    setError(null);
    setIsLoading(false);
    setIsInitializing(true);
    void initializeCart();
  }, [initializeCart]);

  const isActionPending = useCallback(
    (productId: string, action?: CartAction): boolean => {
      const pendingAction = pendingActions[productId];
      return action ? pendingAction === action : pendingAction !== undefined;
    },
    [pendingActions],
  );

  return {
    cart,
    cartId,
    isCartAvailable: cart !== null && cartId !== null && !isInitializing,
    isLoading,
    isInitializing,
    error,
    pendingActions,
    isActionPending,
    addItem,
    updateQuantity,
    removeItem,
    refreshCart,
    retryCart,
    clearCart,
  };
}
