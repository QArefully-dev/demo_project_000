import { act, renderHook, waitFor } from '@testing-library/react';
import type { CuratedBundle } from '@shop/contracts/bundles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bundlesApi from '@/api/bundles';
import { useBundles } from './useBundles';

vi.mock('@/api/bundles', () => ({ getBundles: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function bundle(id: string): CuratedBundle {
  return {
    id,
    key: `bundle-${id}`,
    name: `Bundle ${id}`,
    description: 'Fixed selection.',
    components: [],
    totalCents: 100,
    available: true,
  };
}

describe('useBundles', () => {
  it('aborts its in-flight request on unmount', async () => {
    const response = deferred<CuratedBundle[]>();
    vi.mocked(bundlesApi.getBundles).mockReturnValueOnce(response.promise);
    const { unmount } = renderHook(() => useBundles());
    await waitFor(() => expect(bundlesApi.getBundles).toHaveBeenCalledOnce());

    const signal = vi.mocked(bundlesApi.getBundles).mock.calls[0]?.[1];
    unmount();
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      response.resolve([bundle('1')]);
      await response.promise;
    });
  });

  it('aborts and ignores a stale product-filter response', async () => {
    const oldResponse = deferred<CuratedBundle[]>();
    const currentResponse = deferred<CuratedBundle[]>();
    vi.mocked(bundlesApi.getBundles)
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise);
    const { result, rerender } = renderHook(
      ({ productId }: { productId?: string }) => useBundles(productId),
      {
        initialProps: { productId: '1' },
      },
    );
    await waitFor(() => expect(bundlesApi.getBundles).toHaveBeenCalledOnce());

    const oldSignal = vi.mocked(bundlesApi.getBundles).mock.calls[0]?.[1];
    rerender({ productId: '2' });
    await waitFor(() => expect(bundlesApi.getBundles).toHaveBeenCalledTimes(2));
    expect(oldSignal?.aborted).toBe(true);

    await act(async () => {
      currentResponse.resolve([bundle('2')]);
      await currentResponse.promise;
    });
    await act(async () => {
      oldResponse.resolve([bundle('1')]);
      await oldResponse.promise;
    });
    expect(result.current.bundles.map((item) => item.id)).toEqual(['2']);
  });
});
