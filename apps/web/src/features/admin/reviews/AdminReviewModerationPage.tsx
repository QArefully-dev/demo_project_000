import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  AdminReviewModerationBody,
  AdminReviewQueueItem,
  AdminReviewQueueQuery,
  AdminReviewQueueResponse,
} from '@shop/contracts/reviews';
import { getAdminReviewQueue, moderateAdminReview, restoreAdminReview } from '@/api/adminReviews';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PAGE_SIZE = 10;
type Queue = 'reported' | 'hidden';
type Sort = 'oldest' | 'newest';

function readQueue(value: string | null): Queue {
  return value === 'hidden' ? 'hidden' : 'reported';
}

function readSort(value: string | null): Sort {
  return value === 'newest' ? 'newest' : 'oldest';
}

function readPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function actionLabel(decision: AdminReviewModerationBody['decision']): string {
  return decision === 'hide_review'
    ? 'Review hidden and reports actioned.'
    : 'Open reports dismissed.';
}

export function AdminReviewModerationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = readQueue(searchParams.get('queue'));
  const sort = readSort(searchParams.get('sort'));
  const page = readPage(searchParams.get('page'));
  const [result, setResult] = useState<AdminReviewQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstCardRef = useRef<HTMLElement>(null);
  const focusAfterReloadRef = useRef(false);

  useEffect(() => {
    if (!focusAfterReloadRef.current) return;
    focusAfterReloadRef.current = false;
    (firstCardRef.current ?? queueHeadingRef.current)?.focus();
  }, [result]);

  const updateParams = useCallback(
    (next: Partial<AdminReviewQueueQuery>) => {
      const nextQueue = next.queue ?? queue;
      const nextSort = next.sort ?? sort;
      const nextPage = next.page ?? page;
      const params = new URLSearchParams({ queue: nextQueue, sort: nextSort });
      if (nextPage > 1) params.set('page', String(nextPage));
      setSearchParams(params, { replace: true });
    },
    [page, queue, setSearchParams, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError(null);

    getAdminReviewQueue({ queue, sort, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (!current) return;
        setResult(response);
        const maximumPage = Math.max(1, Math.ceil(response.total / response.pageSize));
        if (page > maximumPage) updateParams({ page: maximumPage });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setError(messageFor(requestError, 'Unable to load moderation queue.'));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [page, queue, reloadVersion, sort, updateParams]);

  const retry = useCallback(() => setReloadVersion((version) => version + 1), []);

  const moderate = useCallback(
    async (review: AdminReviewQueueItem, decision: AdminReviewModerationBody['decision']) => {
      setMutationError(null);
      setStatus(null);
      setPendingReviewId(review.id);
      try {
        await moderateAdminReview(review.id, { decision });
        focusAfterReloadRef.current = true;
        if (result?.items.length === 1 && page > 1) {
          updateParams({ page: page - 1 });
        } else {
          retry();
        }
        setStatus(actionLabel(decision));
      } catch (requestError) {
        setMutationError(messageFor(requestError, 'Unable to moderate this review.'));
      } finally {
        setPendingReviewId(null);
      }
    },
    [page, result?.items.length, retry, updateParams],
  );

  const restore = useCallback(
    async (review: AdminReviewQueueItem) => {
      setMutationError(null);
      setStatus(null);
      setPendingReviewId(review.id);
      try {
        await restoreAdminReview(review.id);
        focusAfterReloadRef.current = true;
        if (result?.items.length === 1 && page > 1) {
          updateParams({ page: page - 1 });
        } else {
          retry();
        }
        setStatus('Review restored.');
      } catch (requestError) {
        setMutationError(messageFor(requestError, 'Unable to restore this review.'));
      } finally {
        setPendingReviewId(null);
      }
    },
    [page, result?.items.length, retry, updateParams],
  );

  if (loading && !result) return <LoadingSpinner />;
  if (error && !result) return <ErrorMessage message={error} onRetry={() => void retry()} />;
  if (!result)
    return <ErrorMessage message="Moderation queue is unavailable" onRetry={() => void retry()} />;

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="admin-reviews-heading">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1
          ref={queueHeadingRef}
          id="admin-reviews-heading"
          tabIndex={-1}
          className="section-heading mt-2"
        >
          Review moderation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review reported content and restore hidden customer reviews.
        </p>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {mutationError && (
        <p role="alert" className="text-sm text-destructive">
          {mutationError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-medium">
          Queue
          <select
            className="ml-2 rounded-md border border-input bg-background px-2 py-1"
            value={queue}
            onChange={(event) => updateParams({ queue: event.target.value as Queue, page: 1 })}
          >
            <option value="reported">Reported</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Sort
          <select
            className="ml-2 rounded-md border border-input bg-background px-2 py-1"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value as Sort, page: 1 })}
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No {queue} reviews</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {queue === 'reported'
                ? 'Open reports will appear here.'
                : 'Hidden reviews will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" aria-busy={loading}>
          {result.items.map((review, index) => {
            const pending = pendingReviewId === review.id;
            return (
              <article
                key={review.id}
                ref={index === 0 ? firstCardRef : undefined}
                tabIndex={-1}
                aria-label={`Review for ${review.productName}`}
              >
                <Card>
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{review.productName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {review.author.displayName} · {review.rating}/5 · {review.status}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {review.helpfulCount} helpful
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{review.body}</p>
                    {queue === 'reported' && (
                      <div className="space-y-3 rounded-md border border-border p-3">
                        <h3 className="font-medium">Open reports ({review.openReportCount})</h3>
                        {review.openReports.map((report) => (
                          <div key={report.id} className="text-sm">
                            <p>
                              <span className="font-medium">{report.reason}</span> reported by{' '}
                              {report.reporterDisplayName}
                            </p>
                            {report.detail && (
                              <p className="mt-1 whitespace-pre-wrap">{report.detail}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {queue === 'reported' ? (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => void moderate(review, 'hide_review')}
                          >
                            {pending ? 'Working…' : 'Hide and action reports'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            onClick={() => void moderate(review, 'dismiss_reports')}
                          >
                            Dismiss reports
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          disabled={pending}
                          onClick={() => void restore(review)}
                        >
                          {pending ? 'Working…' : 'Restore review'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </article>
            );
          })}
        </div>
      )}

      <nav className="flex items-center justify-between" aria-label="Moderation pages">
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => updateParams({ page: page - 1 })}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {result.page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page >= totalPages || loading}
          onClick={() => updateParams({ page: page + 1 })}
        >
          Next
        </Button>
      </nav>
    </section>
  );
}
