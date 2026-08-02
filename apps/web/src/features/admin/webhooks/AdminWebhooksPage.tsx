import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  AdminCapturedWebhookListQuery,
  CapturedWebhookStatus,
} from '@shop/contracts/webhooks';
import { getAdminWebhooks } from '@/api/adminWebhooks';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PAGE_SIZE = 10;
const statuses: CapturedWebhookStatus[] = ['captured', 'processed', 'ignored_stale', 'rejected'];
const messageFor = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
const readPage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};
const readStatus = (value: string | null): CapturedWebhookStatus | undefined =>
  statuses.includes(value as CapturedWebhookStatus) ? (value as CapturedWebhookStatus) : undefined;
type QueryUpdate = Omit<Partial<AdminCapturedWebhookListQuery>, 'status'> & {
  status?: CapturedWebhookStatus | null;
};

export function AdminWebhooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = readStatus(searchParams.get('status'));
  const page = readPage(searchParams.get('page'));
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminWebhooks>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstItemRef = useRef<HTMLElement>(null);
  const focusAfterReload = useRef(false);
  const updateParams = useCallback(
    (next: QueryUpdate) => {
      const params = new URLSearchParams();
      const nextStatus = next.status === undefined ? status : (next.status ?? undefined);
      const nextPage = next.page ?? page;
      if (nextStatus) params.set('status', nextStatus);
      if (nextPage > 1) params.set('page', String(nextPage));
      setSearchParams(params, { replace: true });
    },
    [page, setSearchParams, status],
  );
  const refresh = useCallback(() => setReloadVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError(null);
    getAdminWebhooks({ status, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (!current) return;
        setResult(response);
        const maximumPage = Math.max(1, Math.ceil(response.total / response.pageSize));
        if (page > maximumPage) updateParams({ page: maximumPage });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted)
          setError(messageFor(requestError, 'Unable to load webhooks.'));
      })
      .finally(() => {
        if (current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [page, reloadVersion, status, updateParams]);
  useEffect(() => {
    if (result && focusAfterReload.current) {
      focusAfterReload.current = false;
      (firstItemRef.current ?? headingRef.current)?.focus();
    }
  }, [result]);
  if (loading && !result) return <LoadingSpinner />;
  if (error && !result) return <ErrorMessage message={error} onRetry={refresh} />;
  if (!result) return <ErrorMessage message="Webhook inspector is unavailable" onRetry={refresh} />;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="admin-webhooks-heading">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1
          ref={headingRef}
          id="admin-webhooks-heading"
          tabIndex={-1}
          className="section-heading mt-2"
        >
          Captured webhooks
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspect simulated payment processor deliveries.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <label className="text-sm font-medium">
        Status{' '}
        <select
          aria-label="Webhook status"
          className="ml-2 rounded-md border border-input bg-background px-2 py-1"
          value={status ?? ''}
          onChange={(event) =>
            updateParams({ status: readStatus(event.target.value) ?? null, page: 1 })
          }
        >
          <option value="">All</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">No webhooks match this filter.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3" aria-busy={loading}>
          {result.items.map((webhook, index) => (
            <article key={webhook.id} ref={index === 0 ? firstItemRef : undefined} tabIndex={-1}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <h2 className="font-semibold">{webhook.eventType}</h2>
                    <p className="text-sm text-muted-foreground">
                      #{webhook.id} · {webhook.status} · {webhook.eventId}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/admin/webhooks/${webhook.id}`)}
                  >
                    View detail
                  </Button>
                </CardContent>
              </Card>
            </article>
          ))}
        </div>
      )}
      <nav className="flex items-center justify-between" aria-label="Webhook pages">
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
