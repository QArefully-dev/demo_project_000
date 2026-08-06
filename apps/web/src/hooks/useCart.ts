import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Country } from '@shop/contracts/country';
import type { Cart } from '@shop/contracts/cart';
import * as api from '../api/cart';
import * as bundlesApi from '../api/bundles';
import * as customBlendsApi from '../api/customBlends';
import * as quickOrderApi from '../api/quickOrder';
import * as reorderApi from '../api/reorder';
import * as savedListsApi from '../api/savedLists';
import { ApiError, isMissingCartError } from '../api/client';
import { clearCartId, getCartId } from '../lib/cartStorage';
import { createCartClient } from './cartClient';
import { useOptionalCountry } from './CountryContext';
import type { CreateCustomBlendBody, ReplaceCustomBlendBody } from '@shop/contracts/custom-blends';
import type { ReorderResponse } from '@shop/contracts/reorder';
import type { QuickOrderResponse } from '@shop/contracts/quick-order';
import type { SavedListAddToCartResponse } from '@shop/contracts/saved-lists';

export type CartAction =
  | 'add'
  | 'bundle-add'
  | 'update'
  | 'remove'
  | 'blend-add'
  | 'blend-replace'
  | 'quick-order'
  | 'reorder'
  | 'saved-list-add';

const QUICK_ORDER_PENDING_KEY = 'quick-order';

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
  | { type: 'action-started'; pendingKey: string; action: CartAction }
  | { type: 'action-finished'; pendingKey: string }
  | { type: 'country-changed'; cartId: string | null }
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
        pendingActions: { ...state.pendingActions, [event.pendingKey]: event.action },
      };
    case 'action-finished': {
      const pendingActions = { ...state.pendingActions };
      delete pendingActions[event.pendingKey];
      return { ...state, pendingActions };
    }
    case 'country-changed':
      // The previous country's cart must never stay rendered or targeted; only its stored id
      // for the new country survives, and it is re-validated by the initialization that follows.
      return {
        cart: null,
        cartId: event.cartId,
        error: null,
        pendingActions: {},
        status: 'initializing',
      };
    case 'cleared':
      return { cart: null, cartId: null, error: null, pendingActions: {}, status: 'initializing' };
  }
}

/**
 * Buyer-readable text for domain error codes the API returns. Raw server wording stays the
 * fallback; only codes a buyer can act on are translated here.
 */
const ERROR_MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  BELOW_MOQ: 'Minimum order quantity not met. Adjust pallet quantity and try again.',
  BLOCKED_IN_COUNTRY: 'This item cannot be ordered in your country.',
  NO_INPUT_LINES: 'Enter at least one line before submitting your quick order.',
  ORDER_NOT_FOUND: 'That order is no longer available. Refresh your order history and try again.',
  TOO_MANY_LINES:
    'Your quick order has too many lines. Split it into smaller submissions and try again.',
  CART_RESERVED:
    'Your cart is reserved for checkout and cannot be changed. Finish or cancel that checkout, then try again.',
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.isNetworkError) {
    return 'Unable to reach the shop server. Check that it is running and try again.';
  }
  if (error instanceof ApiError) {
    const code = (error.response as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && code in ERROR_MESSAGE_BY_CODE) {
      return ERROR_MESSAGE_BY_CODE[code]!;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Configured lines share a product and variant with their plain counterpart, so pending
 * identity carries the config key. Plain lines keep their historic key shape.
 */
function cartLinePendingKey(productId: string, variantId?: number, configKey?: string): string {
  if (variantId === undefined) return productId;
  const lineKey = `line:${productId}:${variantId}`;
  return configKey ? `${lineKey}:${configKey}` : lineKey;
}

/** Reorder is scoped to a source order, not to a cart line, so it keys on the order. */
function reorderPendingKey(orderId: string): string {
  return `reorder:${orderId}`;
}

function savedListPendingKey(listId: string): string {
  return `saved-list:${listId}`;
}

/**
 * One in-flight cart request shared by every caller that would otherwise duplicate it. The
 * owning country is part of the entry so a request started before a country switch is never
 * reused after it, and the entry identity lets the settling request clear only its own slot.
 */
type SharedCartRequest = { country: Country; promise: Promise<Cart> };

function customBlendPendingKey(baseVariantId: number, configKey?: string): string {
  const blendKey = `blend:${baseVariantId}`;
  return configKey ? `${blendKey}:${configKey}` : blendKey;
}

export function useCart() {
  const { activeCountry } = useOptionalCountry();
  const countryRef = useRef<Country>(activeCountry);
  countryRef.current = activeCountry;

  const [state, dispatch] = useReducer(cartReducer, {
    cart: null,
    cartId: getCartId(activeCountry),
    error: null,
    pendingActions: {},
    status: 'initializing',
  });

  const cartClient = useMemo(() => createCartClient(activeCountry), [activeCountry]);
  const cartClientRef = useRef(cartClient);
  cartClientRef.current = cartClient;

  const initializationRef = useRef<SharedCartRequest | null>(null);
  const recoveryRef = useRef<SharedCartRequest | null>(null);
  const mutationSequenceRef = useRef(0);
  const committedMutationSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const cartIdRef = useRef<string | null>(getCartId(activeCountry));
  const renderedCountryRef = useRef<Country>(activeCountry);

  if (renderedCountryRef.current !== activeCountry) {
    // Re-seed synchronously: a mutation dispatched between this render and the initialization
    // effect must already target the new country's stored cart, never the previous one.
    renderedCountryRef.current = activeCountry;
    cartIdRef.current = getCartId(activeCountry);
    // The previous country's shared in-flight requests are not cleared here: they own a
    // `finally` that would then clear the new country's slot and defeat the dedupe. They carry
    // their owning country instead, so `loadCart`/`recoverCart` below ignore them.
    dispatch({ type: 'country-changed', cartId: cartIdRef.current });
  }

  const applyCart = useCallback((cart: Cart) => {
    cartIdRef.current = cart.id;
    if (mountedRef.current) dispatch({ type: 'cart-loaded', cart });
  }, []);

  /**
   * Shares one in-flight request per slot, scoped to the country that started it. A settling
   * request clears the slot only while it still owns it, so a request belonging to the previous
   * country can never evict the current country's in-flight one and let a duplicate be created.
   */
  const shareCartRequest = useCallback(
    (slot: { current: SharedCartRequest | null }, start: () => Promise<Cart>): Promise<Cart> => {
      const country = countryRef.current;
      const shared = slot.current;
      if (shared && shared.country === country) return shared.promise;

      // `entry` is only read inside the callback, which cannot run before this binding is
      // initialized, so the self-reference is safe.
      const entry: SharedCartRequest = {
        country,
        promise: start().finally(() => {
          if (slot.current === entry) slot.current = null;
        }),
      };
      slot.current = entry;
      return entry.promise;
    },
    [],
  );

  const loadCart = useCallback(
    (): Promise<Cart> =>
      shareCartRequest(initializationRef, () => cartClientRef.current.loadOrCreate()),
    [shareCartRequest],
  );

  const recoverCart = useCallback(
    (missingCartId: string): Promise<Cart> =>
      shareCartRequest(recoveryRef, () => cartClientRef.current.recoverMissingCart(missingCartId)),
    [shareCartRequest],
  );

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
      const requestCountry = countryRef.current;
      if (mountedRef.current) dispatch({ type: 'start', status });
      try {
        const cart = await loadCart();
        // Stale completion: the buyer switched country while this load was in flight, so the
        // resolved cart belongs to the previous country and must not land in state.
        if (countryRef.current !== requestCountry) return false;
        applyCart(cart);
        return true;
      } catch (error) {
        if (countryRef.current !== requestCountry) return false;
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
    // activeCountry is a dependency, not an unused value: each country owns its own cart, so a
    // switch must re-resolve the cart rather than keep the previous country's one.
  }, [activeCountry, initializeCart]);

  const retryCart = useCallback(
    () => initializeCart(cartIdRef.current ? 'refreshing' : 'initializing', 'Failed to load cart'),
    [initializeCart],
  );

  const refreshCart = useCallback(
    () => initializeCart('refreshing', 'Failed to refresh cart'),
    [initializeCart],
  );

  /**
   * Runs one cart mutation with pending tracking, missing-cart recovery and the stale-response
   * guard. The operation result is opaque: `selectCart` names the cart inside it, so an action
   * such as reorder can carry a report back to its caller while the cart still lands in state.
   */
  const runCartMutation = useCallback(
    async <TResult>(
      action: CartAction,
      pendingKey: string,
      operation: (activeCartId: string) => Promise<TResult>,
      selectCart: (result: TResult) => Cart,
      retryAfterRecovery: boolean,
    ): Promise<TResult | false> => {
      const mutationSequence = ++mutationSequenceRef.current;
      const mutationCountry = countryRef.current;
      if (mountedRef.current) dispatch({ type: 'action-started', pendingKey, action });

      try {
        let activeCartId = cartIdRef.current;
        if (!activeCartId) {
          const cart = await loadCart();
          activeCartId = cart.id;
          applyCart(cart);
        }

        try {
          const result = await operation(activeCartId);
          const cart = selectCart(result);
          // Stale completion: the buyer switched country while this mutation was in flight, so
          // the returned cart belongs to the previous country and must not become the target.
          if (countryRef.current === mutationCountry) applyMutationCart(cart, mutationSequence);
          return result;
        } catch (error) {
          if (!isMissingCartError(error)) throw error;

          const replacementCart = await recoverCart(activeCartId);
          applyCart(replacementCart);
          if (!retryAfterRecovery) {
            throw new Error('Your previous cart was no longer available. A new cart is ready.');
          }

          const result = await operation(replacementCart.id);
          const cart = selectCart(result);
          if (countryRef.current === mutationCountry) applyMutationCart(cart, mutationSequence);
          return result;
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
        if (mountedRef.current) dispatch({ type: 'action-finished', pendingKey });
      }
    },
    [applyCart, applyMutationCart, loadCart, recoverCart],
  );

  const runCartAction = useCallback(
    (
      action: CartAction,
      pendingKey: string,
      operation: (activeCartId: string) => Promise<Cart>,
      retryAfterRecovery: boolean,
    ): Promise<Cart | false> =>
      runCartMutation(action, pendingKey, operation, (cart) => cart, retryAfterRecovery),
    [runCartMutation],
  );

  // Most callers only need success/failure. Custom Blend also needs the server-returned line so
  // its recap cannot reuse the pre-edit key.
  const runCartActionSucceeded = useCallback(
    async (
      action: CartAction,
      pendingKey: string,
      operation: (activeCartId: string) => Promise<Cart>,
      retryAfterRecovery: boolean,
    ) => Boolean(await runCartAction(action, pendingKey, operation, retryAfterRecovery)),
    [runCartAction],
  );

  const addItem = useCallback(
    (productId: string, variantId?: number, quantity?: number) =>
      runCartActionSucceeded(
        'add',
        productId,
        (cartId) =>
          quantity === undefined
            ? api.addToCart(cartId, productId, variantId)
            : api.addToCart(cartId, productId, variantId, quantity),
        true,
      ),
    [runCartActionSucceeded],
  );
  const addBundle = useCallback(
    (bundleId: string) =>
      runCartActionSucceeded(
        'bundle-add',
        `bundle:${bundleId}`,
        (cartId) => bundlesApi.addBundleToCart(cartId, bundleId),
        true,
      ),
    [runCartActionSucceeded],
  );
  const updateQuantity = useCallback(
    (productId: string, quantity: number, variantId?: number, configKey?: string) =>
      runCartActionSucceeded(
        'update',
        cartLinePendingKey(productId, variantId, configKey),
        (cartId) => {
          if (variantId === undefined) return api.updateCartItem(cartId, productId, quantity);
          if (configKey === undefined)
            return api.updateCartItem(cartId, productId, quantity, variantId);
          return api.updateCartItem(cartId, productId, quantity, variantId, configKey);
        },
        false,
      ),
    [runCartActionSucceeded],
  );
  const removeItem = useCallback(
    (productId: string, variantId?: number, configKey?: string) =>
      runCartActionSucceeded(
        'remove',
        cartLinePendingKey(productId, variantId, configKey),
        (cartId) => {
          if (variantId === undefined) return api.removeFromCart(cartId, productId);
          if (configKey === undefined) return api.removeFromCart(cartId, productId, variantId);
          return api.removeFromCart(cartId, productId, variantId, configKey);
        },
        false,
      ),
    [runCartActionSucceeded],
  );
  const addCustomBlend = useCallback(
    (body: CreateCustomBlendBody) =>
      runCartAction(
        'blend-add',
        customBlendPendingKey(body.baseVariantId),
        (cartId) => customBlendsApi.createCustomBlend(cartId, body),
        true,
      ),
    [runCartAction],
  );
  // A replace targets one existing configured line, so a recovered empty cart has
  // nothing to retry against; the caller is told the line is gone instead.
  const replaceCustomBlend = useCallback(
    (body: ReplaceCustomBlendBody) =>
      runCartAction(
        'blend-replace',
        customBlendPendingKey(body.baseVariantId, body.configKey),
        (cartId) => customBlendsApi.replaceCustomBlend(cartId, body),
        false,
      ),
    [runCartAction],
  );

  const quickOrder = useCallback(
    (text: string): Promise<QuickOrderResponse | false> =>
      runCartMutation(
        'quick-order',
        QUICK_ORDER_PENDING_KEY,
        (cartId) => quickOrderApi.submitQuickOrder(cartId, text),
        (response) => response.cart,
        true,
      ),
    [runCartMutation],
  );

  /**
   * Re-adds a past order's lines to the active cart. The per-line outcome report is returned to the
   * caller rather than stored: it describes one reorder attempt, not cart state.
   */
  const reorder = useCallback(
    (orderId: string): Promise<ReorderResponse | false> =>
      runCartMutation(
        'reorder',
        reorderPendingKey(orderId),
        (cartId) => reorderApi.reorderFromOrder(cartId, orderId),
        (response) => response.cart,
        true,
      ),
    [runCartMutation],
  );

  const addSavedListToCart = useCallback(
    (listId: string): Promise<SavedListAddToCartResponse | false> =>
      runCartMutation(
        'saved-list-add',
        savedListPendingKey(listId),
        (cartId) => savedListsApi.addSavedListToCart(listId, { cartId }),
        (response) => response.cart,
        true,
      ),
    [runCartMutation],
  );

  const clearCart = useCallback(() => {
    clearCartId(countryRef.current);
    cartIdRef.current = null;
    if (!mountedRef.current) return;
    dispatch({ type: 'cleared' });
    void initializeCart('initializing', 'Failed to initialize cart');
  }, [initializeCart]);

  const isActionPending = useCallback(
    (productId: string, action?: CartAction, variantId?: number, configKey?: string) => {
      const pendingAction =
        state.pendingActions[cartLinePendingKey(productId, variantId, configKey)];
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
    addBundle,
    addCustomBlend,
    replaceCustomBlend,
    quickOrder,
    updateQuantity,
    removeItem,
    reorder,
    addSavedListToCart,
    refreshCart,
    retryCart,
    clearCart,
  };
}
