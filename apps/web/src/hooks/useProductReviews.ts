import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CreateReviewBody,
  CreateReviewReportBody,
  OwnedReview,
  ReviewEngagementResponse,
  ReviewListResponse,
  ReviewSort,
} from '@shop/contracts/reviews';
import {
  addHelpfulVote,
  createReviewReport,
  createProductReview,
  deleteReview,
  getMyProductReview,
  getProductReviews,
  removeHelpfulVote,
  withdrawReviewReport,
  updateReview,
} from '@/api/reviews';
import { useAuth } from './AuthContext';

const DEFAULT_PAGE_SIZE = 10;

export interface UseProductReviewsResult {
  list: ReviewListResponse | null;
  listError: string | null;
  isListLoading: boolean;
  ownerReview: OwnedReview | null;
  ownerError: string | null;
  isOwnerLoading: boolean;
  sort: ReviewSort;
  page: number;
  isMutating: boolean;
  mutationError: string | null;
  engagementStatus: string | null;
  engagementErrors: Readonly<Record<string, string | undefined>>;
  setSort: (sort: ReviewSort) => void;
  setPage: (page: number) => void;
  retryList: () => void;
  retryOwner: () => void;
  submitReview: (body: CreateReviewBody) => Promise<boolean>;
  removeReview: () => Promise<boolean>;
  toggleHelpful: (reviewId: string, hasHelpfulVote: boolean) => Promise<boolean>;
  submitReport: (reviewId: string, body: CreateReviewReportBody) => Promise<boolean>;
  withdrawReport: (reviewId: string) => Promise<boolean>;
  isEngagementMutating: (reviewId: string) => boolean;
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Keeps public review data and the optional owner record independent: a failed
 * owner request never hides public reviews, and vice versa.
 */
export function useProductReviews(productId: string): UseProductReviewsResult {
  const { user } = useAuth();
  const viewerIdentity = user ? `${user.id}:${user.role}` : 'anonymous';
  const [list, setList] = useState<ReviewListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [ownerReview, setOwnerReview] = useState<OwnedReview | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isOwnerLoading, setIsOwnerLoading] = useState(Boolean(user));
  const [sort, setSortState] = useState<ReviewSort>('newest');
  const [page, setPageState] = useState(1);
  const previousProductId = useRef(productId);
  const [listReloadVersion, setListReloadVersion] = useState(0);
  const [ownerReloadVersion, setOwnerReloadVersion] = useState(0);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [engagementStatus, setEngagementStatus] = useState<string | null>(null);
  const [engagementErrors, setEngagementErrors] = useState<Record<string, string | undefined>>({});
  const [engagementMutationIds, setEngagementMutationIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const engagementControllers = useRef(new Map<string, AbortController>());
  const engagementGeneration = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const productChanged = previousProductId.current !== productId;
    const requestPage = productChanged ? 1 : page;
    if (productChanged) {
      previousProductId.current = productId;
      setList(null);
      setListError(null);
      setOwnerReview(null);
      setOwnerError(null);
      setPageState(1);
    }
    setIsListLoading(true);
    setListError(null);

    getProductReviews(
      productId,
      { sort, page: requestPage, pageSize: DEFAULT_PAGE_SIZE },
      controller.signal,
    )
      .then((response) => {
        if (!current) return;
        const maximumPage = Math.max(1, Math.ceil(response.summary.total / response.pageSize));
        if (requestPage > maximumPage) {
          setList(null);
          setPageState(maximumPage);
          return;
        }
        setList(response);
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setListError(messageFor(error, 'Could not load reviews.'));
        }
      })
      .finally(() => {
        if (current) setIsListLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [listReloadVersion, page, productId, sort, viewerIdentity]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setOwnerReview(null);
    setOwnerError(null);
    if (!user) {
      setIsOwnerLoading(false);
      return () => controller.abort();
    }

    setIsOwnerLoading(true);
    setOwnerError(null);
    getMyProductReview(productId, controller.signal)
      .then((response) => {
        if (current) setOwnerReview(response);
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setOwnerError(messageFor(error, 'Could not load your review.'));
        }
      })
      .finally(() => {
        if (current) setIsOwnerLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [ownerReloadVersion, productId, viewerIdentity]);

  useEffect(() => {
    engagementGeneration.current += 1;
    for (const controller of engagementControllers.current.values()) controller.abort();
    engagementControllers.current.clear();
    setEngagementMutationIds(new Set());
    setEngagementErrors({});
    setEngagementStatus(null);
  }, [productId, viewerIdentity]);

  const retryList = useCallback(() => setListReloadVersion((version) => version + 1), []);
  const retryOwner = useCallback(() => setOwnerReloadVersion((version) => version + 1), []);
  const refresh = useCallback(() => {
    retryList();
    retryOwner();
  }, [retryList, retryOwner]);

  const setSort = useCallback((nextSort: ReviewSort) => {
    setSortState(nextSort);
    setPageState(1);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const submitReview = useCallback(
    async (body: CreateReviewBody): Promise<boolean> => {
      setMutationError(null);
      setIsMutating(true);
      try {
        if (ownerReview) {
          await updateReview(ownerReview.id, body);
        } else {
          await createProductReview(productId, body);
        }
        refresh();
        return true;
      } catch (error) {
        setMutationError(messageFor(error, 'Could not save your review.'));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [ownerReview, productId, refresh],
  );

  const removeReview = useCallback(async (): Promise<boolean> => {
    if (!ownerReview) return false;
    setMutationError(null);
    setIsMutating(true);
    try {
      await deleteReview(ownerReview.id);
      refresh();
      return true;
    } catch (error) {
      setMutationError(messageFor(error, 'Could not delete your review.'));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [ownerReview, refresh]);

  const updateEngagement = useCallback((response: ReviewEngagementResponse) => {
    setList((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((review) =>
          review.id === response.reviewId
            ? {
                ...review,
                helpfulCount: response.helpfulCount,
                viewerHasHelpfulVote: response.viewerHasHelpfulVote,
                viewerHasOpenReport: response.viewerHasOpenReport,
              }
            : review,
        ),
      };
    });
  }, []);

  const performEngagementMutation = useCallback(
    async (
      reviewId: string,
      action: (signal: AbortSignal) => Promise<ReviewEngagementResponse>,
      successMessage: string,
      failureMessage: string,
    ): Promise<boolean> => {
      const priorController = engagementControllers.current.get(reviewId);
      if (priorController) return false;

      const controller = new AbortController();
      const generation = engagementGeneration.current;
      engagementControllers.current.set(reviewId, controller);
      setEngagementMutationIds((current) => new Set(current).add(reviewId));
      setEngagementErrors((current) => ({ ...current, [reviewId]: undefined }));
      setEngagementStatus(null);

      try {
        const response = await action(controller.signal);
        if (generation !== engagementGeneration.current || controller.signal.aborted) return false;
        updateEngagement(response);
        setEngagementStatus(successMessage);
        return true;
      } catch (error) {
        if (generation !== engagementGeneration.current || controller.signal.aborted) return false;
        setEngagementErrors((current) => ({
          ...current,
          [reviewId]: messageFor(error, failureMessage),
        }));
        return false;
      } finally {
        if (generation === engagementGeneration.current) {
          engagementControllers.current.delete(reviewId);
          setEngagementMutationIds((current) => {
            const next = new Set(current);
            next.delete(reviewId);
            return next;
          });
        }
      }
    },
    [updateEngagement],
  );

  const toggleHelpful = useCallback(
    (reviewId: string, hasHelpfulVote: boolean) =>
      performEngagementMutation(
        reviewId,
        (signal) =>
          hasHelpfulVote ? removeHelpfulVote(reviewId, signal) : addHelpfulVote(reviewId, signal),
        hasHelpfulVote ? 'Removed helpful mark.' : 'Marked this review helpful.',
        'Could not update the helpful mark.',
      ),
    [performEngagementMutation],
  );

  const submitReport = useCallback(
    (reviewId: string, body: CreateReviewReportBody) =>
      performEngagementMutation(
        reviewId,
        (signal) => createReviewReport(reviewId, body, signal),
        'Report submitted.',
        'Could not submit the report.',
      ),
    [performEngagementMutation],
  );

  const withdrawReport = useCallback(
    (reviewId: string) =>
      performEngagementMutation(
        reviewId,
        (signal) => withdrawReviewReport(reviewId, signal),
        'Report withdrawn.',
        'Could not withdraw the report.',
      ),
    [performEngagementMutation],
  );

  const isEngagementMutating = useCallback(
    (reviewId: string) => engagementMutationIds.has(reviewId),
    [engagementMutationIds],
  );

  return {
    list,
    listError,
    isListLoading,
    ownerReview,
    ownerError,
    isOwnerLoading,
    sort,
    page,
    isMutating,
    mutationError,
    engagementStatus,
    engagementErrors,
    setSort,
    setPage,
    retryList,
    retryOwner,
    submitReview,
    removeReview,
    toggleHelpful,
    submitReport,
    withdrawReport,
    isEngagementMutating,
  };
}
