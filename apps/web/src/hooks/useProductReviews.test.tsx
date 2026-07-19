import { act, renderHook, waitFor } from '@testing-library/react';
import type { OwnedReview, ReviewListResponse } from '@shop/contracts/reviews';
import type { PublicUser } from '@shop/contracts/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProductReviews } from './useProductReviews';

const reviewsApi = vi.hoisted(() => ({
  getProductReviews: vi.fn(),
  getMyProductReview: vi.fn(),
  createProductReview: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));

const authState = vi.hoisted(() => ({ user: null as PublicUser | null }));

vi.mock('@/api/reviews', () => reviewsApi);
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(id: string, total = 1, page = 1): ReviewListResponse {
  return {
    summary: {
      total,
      averageRating: 5,
      distribution: [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 0 },
        { rating: 5, count: total > 0 ? 1 : 0 },
      ],
    },
    items: [
      {
        id,
        productId: id,
        author: { displayName: id },
        rating: 5,
        body: 'This review has enough characters.',
        verifiedPurchase: false,
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      },
    ],
    page,
    pageSize: 10,
  };
}

function ownedReview(id: string): OwnedReview {
  return { ...response(id).items[0]!, status: 'published' };
}

describe('useProductReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
  });

  it('aborts and ignores an out-of-date product response', async () => {
    const first = deferred<ReviewListResponse>();
    const second = deferred<ReviewListResponse>();
    reviewsApi.getProductReviews
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ productId }) => useProductReviews(productId), {
      initialProps: { productId: 'one' },
    });

    rerender({ productId: 'two' });
    await waitFor(() => expect(reviewsApi.getProductReviews).toHaveBeenCalledTimes(2));
    const firstSignal = reviewsApi.getProductReviews.mock.calls[0]?.[2] as AbortSignal | undefined;
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      second.resolve(response('two'));
      await second.promise;
    });
    await act(async () => {
      first.resolve(response('one'));
      await first.promise;
    });
    expect(result.current.list?.items[0]?.id).toBe('two');
  });

  it('aborts and ignores stale public and owner responses after a product route change', async () => {
    authState.user = {
      id: 'customer',
      email: 'customer@example.com',
      displayName: 'Customer',
      role: 'customer',
    };
    const listOne = deferred<ReviewListResponse>();
    const listTwo = deferred<ReviewListResponse>();
    const ownerOne = deferred<OwnedReview | null>();
    const ownerTwo = deferred<OwnedReview | null>();
    reviewsApi.getProductReviews
      .mockReturnValueOnce(listOne.promise)
      .mockReturnValueOnce(listTwo.promise);
    reviewsApi.getMyProductReview
      .mockReturnValueOnce(ownerOne.promise)
      .mockReturnValueOnce(ownerTwo.promise);
    const { result, rerender } = renderHook(({ productId }) => useProductReviews(productId), {
      initialProps: { productId: 'one' },
    });

    rerender({ productId: 'two' });
    await waitFor(() => {
      expect(reviewsApi.getProductReviews).toHaveBeenCalledTimes(2);
      expect(reviewsApi.getMyProductReview).toHaveBeenCalledTimes(2);
    });
    expect((reviewsApi.getProductReviews.mock.calls[0]?.[2] as AbortSignal).aborted).toBe(true);
    expect((reviewsApi.getMyProductReview.mock.calls[0]?.[1] as AbortSignal).aborted).toBe(true);

    await act(async () => {
      listTwo.resolve(response('two'));
      ownerTwo.resolve(ownedReview('two'));
      await Promise.all([listTwo.promise, ownerTwo.promise]);
      listOne.resolve(response('one'));
      ownerOne.resolve(ownedReview('one'));
      await Promise.all([listOne.promise, ownerOne.promise]);
    });

    await waitFor(() => expect(result.current.ownerReview?.id).toBe('two'));
    expect(result.current.list?.items[0]?.id).toBe('two');
  });

  it('resets to the first page and reloads when the sort changes', async () => {
    reviewsApi.getProductReviews.mockResolvedValue(response('one'));
    const { result } = renderHook(() => useProductReviews('one'));
    await waitFor(() => expect(result.current.isListLoading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(reviewsApi.getProductReviews).toHaveBeenLastCalledWith(
        'one',
        { sort: 'newest', page: 2, pageSize: 10 },
        expect.any(AbortSignal),
      ),
    );
    act(() => result.current.setSort('highest'));
    await waitFor(() =>
      expect(reviewsApi.getProductReviews).toHaveBeenLastCalledWith(
        'one',
        { sort: 'highest', page: 1, pageSize: 10 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('clears public and owner reviews before loading a different product', async () => {
    authState.user = {
      id: '1',
      email: 'customer@example.com',
      displayName: 'Customer',
      role: 'customer',
    };
    const listOne = deferred<ReviewListResponse>();
    const listTwo = deferred<ReviewListResponse>();
    const ownerOne = deferred<OwnedReview | null>();
    const ownerTwo = deferred<OwnedReview | null>();
    reviewsApi.getProductReviews
      .mockReturnValueOnce(listOne.promise)
      .mockReturnValueOnce(listTwo.promise);
    reviewsApi.getMyProductReview
      .mockReturnValueOnce(ownerOne.promise)
      .mockReturnValueOnce(ownerTwo.promise);
    const { result, rerender } = renderHook(({ productId }) => useProductReviews(productId), {
      initialProps: { productId: 'one' },
    });

    await act(async () => {
      listOne.resolve(response('one'));
      ownerOne.resolve(ownedReview('one'));
      await Promise.all([listOne.promise, ownerOne.promise]);
    });
    await waitFor(() => expect(result.current.ownerReview?.id).toBe('one'));

    rerender({ productId: 'two' });
    await waitFor(() => {
      expect(reviewsApi.getProductReviews).toHaveBeenCalledTimes(2);
      expect(reviewsApi.getMyProductReview).toHaveBeenCalledTimes(2);
    });
    expect(result.current.list).toBeNull();
    expect(result.current.ownerReview).toBeNull();

    await act(async () => {
      listTwo.resolve(response('two'));
      ownerTwo.resolve(ownedReview('two'));
      await Promise.all([listTwo.promise, ownerTwo.promise]);
    });
    await waitFor(() => expect(result.current.ownerReview?.id).toBe('two'));
    expect(result.current.list?.items[0]?.id).toBe('two');
  });

  it('clamps an invalidated page and reloads after the total shrinks', async () => {
    reviewsApi.getProductReviews
      .mockResolvedValueOnce(response('one', 11, 1))
      .mockResolvedValueOnce(response('one', 11, 2))
      .mockResolvedValueOnce(response('one', 1, 2))
      .mockResolvedValueOnce(response('one', 1, 1));
    const { result } = renderHook(() => useProductReviews('one'));
    await waitFor(() => expect(result.current.isListLoading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    act(() => result.current.retryList());

    await waitFor(() =>
      expect(reviewsApi.getProductReviews).toHaveBeenLastCalledWith(
        'one',
        { sort: 'newest', page: 1, pageSize: 10 },
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.page).toBe(1);
  });
});
