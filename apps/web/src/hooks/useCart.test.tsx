import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import type { Cart } from '@shop/contracts/cart';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import * as cartApi from '@/api/cart';
import * as powderizerApi from '@/api/powderizer';
import { clearCartId, getCartId, setCartId } from '@/lib/cartStorage';
import { CartProvider, useCartContext } from './CartContext';

vi.mock('@/api/cart', () => ({
  addToCart: vi.fn(),
  createCart: vi.fn(),
  getCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateCartItem: vi.fn(),
}));
vi.mock('@/api/powderizer', () => ({
  removePowderMix: vi.fn(),
  requotePowderMix: vi.fn(),
  updatePowderMixQuantity: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function cart(id: string, productIds: string[] = []): Cart {
  return {
    id,
    items: productIds.map((productId) => ({
      productId,
      quantity: 1,
      product: {
        id: productId,
        name: productId,
        description: '',
        priceCents: 100,
        imageSetId: productId,
        category: 'Pantry',
        stock: 10,
        mixable: false,
        slug: productId,
        salesCount: 0,
        createdAt: '2026-07-14T00:00:00.000Z',
        available: true,
        tags: [],
        specificationGroups: [],
      },
      lineTotalCents: 100,
    })),
    mixItems: [],
    totalItems: productIds.length,
    subtotalCents: productIds.length * 100,
  };
}

function providerWrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

beforeEach(() => {
  clearCartId();
  vi.resetAllMocks();
});

describe('useCart', () => {
  it('initializes a remounted provider independently of an in-flight prior provider', async () => {
    setCartId('saved-cart');
    const first = deferred<Cart>();
    vi.mocked(cartApi.getCart)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(cart('fresh-cart'));

    const firstProvider = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(cartApi.getCart).toHaveBeenCalledTimes(1));
    firstProvider.unmount();

    const secondProvider = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(cartApi.getCart).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(secondProvider.result.current.cartId).toBe('fresh-cart'));

    await act(async () => {
      first.resolve(cart('stale-cart'));
      await first.promise;
    });
  });

  it('deduplicates Strict Mode initialization within one provider instance', async () => {
    setCartId('strict-cart');
    const response = deferred<Cart>();
    vi.mocked(cartApi.getCart).mockReturnValue(response.promise);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <CartProvider>{children}</CartProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useCartContext(), { wrapper });
    await waitFor(() => expect(cartApi.getCart).toHaveBeenCalledTimes(1));
    await act(async () => {
      response.resolve(cart('strict-cart'));
      await response.promise;
    });
    expect(result.current.isCartAvailable).toBe(true);
  });

  it('replaces a missing stored cart during initialization', async () => {
    setCartId('missing-cart');
    vi.mocked(cartApi.getCart)
      .mockRejectedValueOnce(new ApiError('Cart not found', 404))
      .mockResolvedValueOnce(cart('replacement-cart'));
    vi.mocked(cartApi.createCart).mockResolvedValueOnce({ cartId: 'replacement-cart' });

    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.cartId).toBe('replacement-cart'));
    expect(getCartId()).toBe('replacement-cart');
    expect(result.current.error).toBeNull();
  });

  it('recovers a missing cart before retrying an add action', async () => {
    setCartId('old-cart');
    vi.mocked(cartApi.getCart)
      .mockResolvedValueOnce(cart('old-cart'))
      .mockResolvedValueOnce(cart('new-cart'));
    vi.mocked(cartApi.createCart).mockResolvedValueOnce({ cartId: 'new-cart' });
    vi.mocked(cartApi.addToCart)
      .mockRejectedValueOnce(new ApiError('Cart not found', 404))
      .mockResolvedValueOnce(cart('new-cart', ['powder']));

    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.isCartAvailable).toBe(true));
    await act(async () => expect(await result.current.addItem('powder')).toBe(true));

    expect(cartApi.addToCart).toHaveBeenNthCalledWith(1, 'old-cart', 'powder');
    expect(cartApi.addToCart).toHaveBeenNthCalledWith(2, 'new-cart', 'powder');
    expect(result.current.cartId).toBe('new-cart');
    expect(result.current.error).toBeNull();
  });

  it('tracks concurrent actions by product', async () => {
    setCartId('cart');
    const first = deferred<Cart>();
    const second = deferred<Cart>();
    vi.mocked(cartApi.getCart).mockResolvedValueOnce(cart('cart'));
    vi.mocked(cartApi.addToCart)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.isCartAvailable).toBe(true));

    let firstAction!: Promise<boolean>;
    let secondAction!: Promise<boolean>;
    act(() => {
      firstAction = result.current.addItem('one');
      secondAction = result.current.addItem('two');
    });
    expect(result.current.isActionPending('one', 'add')).toBe(true);
    expect(result.current.isActionPending('two', 'add')).toBe(true);

    await act(async () => {
      second.resolve(cart('cart', ['two']));
      await second.promise;
    });
    expect(await secondAction).toBe(true);
    expect(result.current.isActionPending('one')).toBe(true);
    expect(result.current.isActionPending('two')).toBe(false);

    await act(async () => {
      first.resolve(cart('cart', ['one', 'two']));
      await first.promise;
    });
    expect(await firstAction).toBe(true);
    expect(result.current.pendingActions).toEqual({});
  });

  it('tracks custom mix mutations with a mix-specific pending key', async () => {
    setCartId('cart');
    const response = deferred<Cart>();
    vi.mocked(cartApi.getCart).mockResolvedValueOnce(cart('cart'));
    vi.mocked(powderizerApi.updatePowderMixQuantity).mockReturnValueOnce(response.promise);
    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.isCartAvailable).toBe(true));

    let action!: Promise<boolean>;
    act(() => {
      action = result.current.updateMixQuantity('mix-1', 2);
    });
    expect(result.current.isActionPending('mix:mix-1', 'mix-update')).toBe(true);
    await act(async () => {
      response.resolve(cart('cart'));
      await response.promise;
    });
    expect(await action).toBe(true);
    expect(powderizerApi.updatePowderMixQuantity).toHaveBeenCalledWith('cart', 'mix-1', 2);
  });

  it('does not let an older mutation response overwrite a newer cart response', async () => {
    setCartId('cart');
    const olderResponse = deferred<Cart>();
    const newerResponse = deferred<Cart>();
    vi.mocked(cartApi.getCart).mockResolvedValueOnce(cart('cart'));
    vi.mocked(cartApi.addToCart)
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(newerResponse.promise);
    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.isCartAvailable).toBe(true));

    let olderAction!: Promise<boolean>;
    let newerAction!: Promise<boolean>;
    act(() => {
      olderAction = result.current.addItem('one');
      newerAction = result.current.addItem('two');
    });

    await act(async () => {
      newerResponse.resolve(cart('cart', ['one', 'two']));
      await newerResponse.promise;
    });
    await act(async () => {
      olderResponse.resolve(cart('cart', ['one']));
      await olderResponse.promise;
    });

    expect(await olderAction).toBe(true);
    expect(await newerAction).toBe(true);
    expect(result.current.cart?.items.map((item) => item.productId)).toEqual(['one', 'two']);
  });

  it('shares missing-cart recovery across concurrent provider actions', async () => {
    setCartId('old-cart');
    const replacement = deferred<{ cartId: string }>();
    vi.mocked(cartApi.getCart)
      .mockResolvedValueOnce(cart('old-cart'))
      .mockResolvedValueOnce(cart('new-cart'));
    vi.mocked(cartApi.createCart).mockReturnValueOnce(replacement.promise);
    vi.mocked(cartApi.addToCart)
      .mockRejectedValueOnce(new ApiError('Cart not found', 404))
      .mockRejectedValueOnce(new ApiError('Cart not found', 404))
      .mockResolvedValueOnce(cart('new-cart', ['one']))
      .mockResolvedValueOnce(cart('new-cart', ['one', 'two']));
    const { result } = renderHook(() => useCartContext(), { wrapper: providerWrapper });
    await waitFor(() => expect(result.current.isCartAvailable).toBe(true));

    let firstAction!: Promise<boolean>;
    let secondAction!: Promise<boolean>;
    act(() => {
      firstAction = result.current.addItem('one');
      secondAction = result.current.addItem('two');
    });
    await waitFor(() => expect(cartApi.createCart).toHaveBeenCalledOnce());

    await act(async () => {
      replacement.resolve({ cartId: 'new-cart' });
      await Promise.all([replacement.promise, firstAction, secondAction]);
    });

    expect(cartApi.createCart).toHaveBeenCalledOnce();
    expect(cartApi.addToCart).toHaveBeenNthCalledWith(3, 'new-cart', 'one');
    expect(cartApi.addToCart).toHaveBeenNthCalledWith(4, 'new-cart', 'two');
    expect(result.current.cartId).toBe('new-cart');
  });
});
