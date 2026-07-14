import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProductListPaginatedResponse } from '@shop/contracts/products';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProducts } from '@/api/products';
import { useProducts } from './useProducts';

vi.mock('@/api/products', () => ({ getProducts: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(name: string): ProductListPaginatedResponse {
  return {
    items: [
      {
        id: name,
        name,
        description: `${name} description`,
        priceCents: 1000,
        imageSetId: 'powdered-water',
        category: 'Impossible',
        stock: 1,
        slug: name,
        salesCount: 0,
        mixable: false,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 12,
  };
}

describe('useProducts', () => {
  beforeEach(() => {
    vi.mocked(getProducts).mockReset();
  });

  it('does not commit an out-of-order response', async () => {
    const first = deferred<ProductListPaginatedResponse>();
    const second = deferred<ProductListPaginatedResponse>();
    vi.mocked(getProducts).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ q }) => useProducts({ q }), {
      initialProps: { q: 'first' },
    });
    rerender({ q: 'second' });

    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    const firstRequest = vi.mocked(getProducts).mock.calls[0];
    expect(firstRequest?.[1]?.aborted).toBe(true);

    await act(async () => {
      second.resolve(response('second'));
      await second.promise;
    });
    expect(result.current.products[0]?.name).toBe('second');

    await act(async () => {
      first.resolve(response('first'));
      await first.promise;
    });
    expect(result.current.products[0]?.name).toBe('second');
  });

  it('ignores an older rejection while the newer request remains loading', async () => {
    const first = deferred<ProductListPaginatedResponse>();
    const second = deferred<ProductListPaginatedResponse>();
    vi.mocked(getProducts).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ q }) => useProducts({ q }), {
      initialProps: { q: 'first' },
    });
    rerender({ q: 'second' });

    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    await act(async () => {
      first.reject(new Error('first request failed'));
      await first.promise.catch(() => undefined);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      second.resolve(response('second'));
      await second.promise;
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.products[0]?.name).toBe('second');
  });
});
