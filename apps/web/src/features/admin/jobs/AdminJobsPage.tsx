import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AdminJobListQuery, JobKind, JobStatus } from '@shop/contracts/jobs';
import { drainAdminJobs, getAdminJobs } from '@/api/adminJobs';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PAGE_SIZE = 10;
const statuses: JobStatus[] = ['pending', 'running', 'succeeded', 'failed', 'dead'];
const kinds: JobKind[] = ['notification.deliver', 'webhook.process', 'standing_order.run'];
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
const readPage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};
const readStatus = (value: string | null): JobStatus | undefined =>
  statuses.includes(value as JobStatus) ? (value as JobStatus) : undefined;
const readKind = (value: string | null): JobKind | undefined =>
  kinds.includes(value as JobKind) ? (value as JobKind) : undefined;
type QueryUpdate = Omit<Partial<AdminJobListQuery>, 'status' | 'kind'> & {
  status?: JobStatus | null;
  kind?: JobKind | null;
};

export function AdminJobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = readStatus(searchParams.get('status'));
  const kind = readKind(searchParams.get('kind'));
  const page = readPage(searchParams.get('page'));
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminJobs>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [draining, setDraining] = useState(false);
  const [drainMessage, setDrainMessage] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstItemRef = useRef<HTMLElement>(null);
  const focusAfterReloadRef = useRef(false);

  const updateParams = useCallback(
    (next: QueryUpdate) => {
      const params = new URLSearchParams();
      const nextStatus = next.status === undefined ? status : (next.status ?? undefined);
      const nextKind = next.kind === undefined ? kind : (next.kind ?? undefined);
      const nextPage = next.page ?? page;
      if (nextStatus) params.set('status', nextStatus);
      if (nextKind) params.set('kind', nextKind);
      if (nextPage > 1) params.set('page', String(nextPage));
      setSearchParams(params, { replace: true });
    },
    [kind, page, setSearchParams, status],
  );
  const refresh = useCallback(() => setReloadVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError(null);
    getAdminJobs({ status, kind, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (!current) return;
        setResult(response);
        const maximumPage = Math.max(1, Math.ceil(response.total / response.pageSize));
        if (page > maximumPage) updateParams({ page: maximumPage });
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted)
          setError(errorMessage(requestError, 'Unable to load jobs.'));
      })
      .finally(() => {
        if (current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [kind, page, reloadVersion, status, updateParams]);

  useEffect(() => {
    if (!focusAfterReloadRef.current || !result) return;
    focusAfterReloadRef.current = false;
    (firstItemRef.current ?? headingRef.current)?.focus();
  }, [result]);

  const drain = useCallback(async () => {
    if (draining) return;
    setDraining(true);
    setError(null);
    setDrainMessage(null);
    try {
      const response = await drainAdminJobs();
      focusAfterReloadRef.current = true;
      setDrainMessage(
        `Processed ${response.processedCount}; succeeded ${response.succeededCount}; failed ${response.failedCount}.`,
      );
      refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to drain jobs.'));
    } finally {
      setDraining(false);
    }
  }, [draining, refresh]);

  if (loading && !result) return <LoadingSpinner />;
  if (error && !result) return <ErrorMessage message={error} onRetry={refresh} />;
  if (!result) return <ErrorMessage message="Job queue is unavailable" onRetry={refresh} />;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="admin-jobs-heading">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 ref={headingRef} id="admin-jobs-heading" tabIndex={-1} className="section-heading mt-2">
          Job queue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspect and operate local asynchronous work.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {drainMessage}
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-medium">
          Status
          <select
            aria-label="Job status"
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
        <label className="text-sm font-medium">
          Kind
          <select
            aria-label="Job kind"
            className="ml-2 rounded-md border border-input bg-background px-2 py-1"
            value={kind ?? ''}
            onChange={(event) =>
              updateParams({ kind: readKind(event.target.value) ?? null, page: 1 })
            }
          >
            <option value="">All</option>
            {kinds.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={draining} onClick={() => void drain()}>
          {draining ? 'Draining…' : 'Drain due jobs'}
        </Button>
      </div>
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">No jobs match these filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3" aria-busy={loading}>
          {result.items.map((job, index) => (
            <article key={job.id} ref={index === 0 ? firstItemRef : undefined} tabIndex={-1}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <h2 className="font-semibold">{job.kind}</h2>
                    <p className="text-sm text-muted-foreground">
                      #{job.id} · {job.status} · {job.attempts}/{job.maxAttempts} attempts
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/admin/jobs/${job.id}`)}
                  >
                    View detail
                  </Button>
                </CardContent>
              </Card>
            </article>
          ))}
        </div>
      )}
      <nav className="flex items-center justify-between" aria-label="Job queue pages">
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
