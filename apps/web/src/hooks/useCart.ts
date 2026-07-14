import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Cart } from '@shop/contracts/cart';
import * as api from '../api/cart';
import { ApiError, isMissingCartError } from '../api/client';
import { clearCartId, getCartId } from '../lib/cartStorage';
import { createCartClient } from './cartClient';

export type CartAction = 'add' | 'update' | 'remove';

type CartStatus = 'initializing' | 'ready' | 'refreshing' | 'error';

type CartState = {
  cart: Cart | null;
  cartId: string | null;
  error: string | null;
  pendingActions: Readonly<Record<string, CartAction>>;
  status: CartStatus;
};

type CartEvent =
  | { type: 'start'; status: 'initializing' | 'refreshing' }
  | { type: 'cart-loaded'; cart: Cart }
  | { type: 'failed'; error: string }
  | { type: 'action-started'; productId: string; action: CartAction }
  | { type: 'action-finished'; productId: string }
  | { type: 'cleared' };

function cartReducer(state: CartState, event: CartEvent): CartState {
  switch (event.type) {
    case 'start':
      return { ...state, error: null, status: event.status };
    case 'cart-loaded':
      return { ...state, cart: event.cart, cartId: event.cart.id, error: null, status: 'ready' };
    case 'failed':
      return { ...state, error: event.error, status: 'error' };
    case 'action-started':
      return {
        ...state,
        error: null,
        pendingActions: { ...state.pendingActions, [event.productId]: event.action },
      };
    case 'action-finished': {
      const pendingActions = { ...state.pendingActions };
      delete pendingActions[event.productId];
      return { ...state, pendingActions };
    }
    case 'cleared':
      return { cart: null, cartId: null, error: null, pendingActions: {}, status: 'initializing' };
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.isNetworkError) {
    return 'Unable to reach the shop server. Check that it is running and try again.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, {
    cart: null,
    cartId: getCartId(),
    error: null,
    pendingActions: {},
    status: 'initializing',
  });
  const cartClientRef = useRef<ReturnType<typeof createCartClient>>();
  const initializationRef = useRef<Promise<Cart> | null>(null);
  const recoveryRef = useRef<Promise<Cart> | null>(null);
  const mutationSequenceRef = useRef(0);
  const committedMutationSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const cartIdRef = useRef<string | null>(getCartId());

  if (!cartClientRef.current) cartClientRef.current = createCartClient();

  const applyCart = useCallback((cart: Cart) => {
    cartIdRef.current = cart.id;
    if (mountedRef.current) dispatch({ type: 'cart-loaded', cart });
  }, []);

  const loadCart = useCallback((): Promise<Cart> => {
    if (!initializationRef.current) {
      initializationRef.current = cartClientRef.current!.loadOrCreate().finally(() => {
        initializationRef.current = null;
      });
    }
    return initializationRef.current;
  }, []);

  const recoverCart = useCallback((missingCartId: string): Promise<Cart> => {
    if (!recoveryRef.current) {
      recoveryRef.current = cartClientRef.current!.recoverMissingCart(missingCartId).finally(() => {
        recoveryRef.current = null;
      });
    }
    return recoveryRef.current;
  }, []);

  const applyMutationCart = useCallback(
    (cart: Cart, mutationSequence: number) => {
      if (mutationSequence < committedMutationSequenceRef.current) return;
      committedMutationSequenceRef.current = mutationSequence;
      applyCart(cart);
    },
    [applyCart],
  );

  const initializeCart = useCallback(
    async (status: 'initializing' | 'refreshing', fallback: string): Promise<boolean> => {
      if (mountedRef.current) dispatch({ type: 'start', status });
      try {
        applyCart(await loadCart());
        return true;
      } catch (error) {
        if (mountedRef.current)
          dispatch({ type: 'failed', error: getErrorMessage(error, fallback) });
        return false;
      }
    },
    [applyCart, loadCart],
  );

  useEffect(() => {
    mountedRef.current = true;
    void initializeCart('initializing', 'Failed to initialize cart');
    return () => {
      mountedRef.current = false;
    };
  }, [initializeCart]);

  const retryCart = useCallback(
    () => initializeCart(cartIdRef.current ? 'refreshing' : 'initializing', 'Failed to load cart'),
    [initializeCart],
  );

  const refreshCart = useCallback(
    () => initializeCart('refreshing', 'Failed to refresh cart'),
    [initializeCart],
  );

  const runCartAction = useCallback(
    async (
      action: CartAction,
      productId: string,
      operation: (activeCartId: string) => Promise<Cart>,
      retryAfterRecovery: boolean,
    ): Promise<boolean> => {
      const mutationSequence = ++mutationSequenceRef.current;
      if (mountedRef.current) dispatch({ type: 'action-started', productId, action });

      try {
        let activeCartId = cartIdRef.current;
        if (!activeCartId) {
          const cart = await loadCart();
          activeCartId = cart.id;
          applyCart(cart);
        }

        try {
          const cart = await operation(activeCartId);
          if (getCartId() === cart.id) applyMutationCart(cart, mutationSequence);
          return true;
        } catch (error) {
          if (!isMissingCartError(error)) throw error;

          const replacementCart = await recoverCart(activeCartId);
          applyCart(replacementCart);
          if (!retryAfterRecovery) {
            throw new Error('Your previous cart was no longer available. A new cart is ready.');
          }

          const cart = await operation(replacementCart.id);
          if (getCartId() === cart.id) applyMutationCart(cart, mutationSequence);
          return true;
        }
      } catch (error) {
        if (mountedRef.current) {
          dispatch({
            type: 'failed',
            error: getErrorMessage(error, `Failed to ${action} cart item`),
          });
        }
        return false;
      } finally {
        if (mountedRef.current) dispatch({ type: 'action-finished', productId });
      }
    },
    [applyCart, applyMutationCart, loadCart, recoverCart],
  );

  const addItem = useCallback(
    (productId: string) =>
      runCartAction('add', productId, (cartId) => api.addToCart(cartId, productId), true),
    [runCartAction],
  );
  const updateQuantity = useCallback(
    (productId: string, quantity: number) =>
      runCartAction(
        'update',
        productId,
        (cartId) => api.updateCartItem(cartId, productId, quantity),
        false,
      ),
    [runCartAction],
  );
  const removeItem = useCallback(
    (productId: string) =>
      runCartAction('remove', productId, (cartId) => api.removeFromCart(cartId, productId), false),
    [runCartAction],
  );

  const clearCart = useCallback(() => {
    clearCartId();
    cartIdRef.current = null;
    if (!mountedRef.current) return;
    dispatch({ type: 'cleared' });
    void initializeCart('initializing', 'Failed to initialize cart');
  }, [initializeCart]);

  const isActionPending = useCallback(
    (productId: string, action?: CartAction) => {
      const pendingAction = state.pendingActions[productId];
      return action ? pendingAction === action : pendingAction !== undefined;
    },
    [state.pendingActions],
  );

  return {
    cart: state.cart,
    cartId: state.cartId,
    isCartAvailable:
      state.cart !== null && state.cartId !== null && state.status !== 'initializing',
    isLoading: state.status === 'refreshing',
    isInitializing: state.status === 'initializing',
    error: state.error,
    pendingActions: state.pendingActions,
    isActionPending,
    addItem,
    updateQuantity,
    removeItem,
    refreshCart,
    retryCart,
    clearCart,
  };
}
