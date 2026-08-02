import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAdminJob, retryAdminJob } from '@/api/adminJobs';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const messageFor = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function AdminJobDetailPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Awaited<ReturnType<typeof getAdminJob>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const currentJobId = useRef(jobId);
  const retryGeneration = useRef(0);
  const retryController = useRef<AbortController | null>(null);
  const focusAfterReload = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const refresh = useCallback(() => setReloadVersion((value) => value + 1), []);

  currentJobId.current = jobId;

  useEffect(() => {
    idempotencyKey.current = null;
    retryGeneration.current += 1;
    retryController.current?.abort();
    retryController.current = null;
    setRetrying(false);
    setNotice(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError(null);
    getAdminJob(jobId, controller.signal)
      .then((response) => {
        if (current) setJob(response);
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted)
          setError(messageFor(requestError, 'Unable to load job detail.'));
      })
      .finally(() => {
        if (current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [jobId, reloadVersion]);
  useEffect(() => {
    if (job && focusAfterReload.current) {
      focusAfterReload.current = false;
      headingRef.current?.focus();
    }
  }, [job]);

  const retry = useCallback(async () => {
    if (!jobId || retrying || job?.status !== 'dead') return;
    const key = idempotencyKey.current ?? crypto.randomUUID();
    const generation = ++retryGeneration.current;
    const controller = new AbortController();
    idempotencyKey.current = key;
    retryController.current = controller;
    setRetrying(true);
    setError(null);
    setNotice(null);
    try {
      await retryAdminJob(jobId, { idempotencyKey: key }, controller.signal);
      if (generation !== retryGeneration.current || currentJobId.current !== jobId) return;
      focusAfterReload.current = true;
      setNotice('Job queued for retry.');
      refresh();
    } catch (requestError) {
      if (
        generation === retryGeneration.current &&
        currentJobId.current === jobId &&
        !controller.signal.aborted
      ) {
        setError(messageFor(requestError, 'Unable to retry this job.'));
      }
    } finally {
      if (generation === retryGeneration.current && currentJobId.current === jobId) {
        retryController.current = null;
        setRetrying(false);
      }
    }
  }, [job?.status, jobId, refresh, retrying]);

  if (!jobId) return <ErrorMessage message="Job identifier is required" onRetry={refresh} />;
  if (loading && !job) return <LoadingSpinner />;
  if (error && !job) return <ErrorMessage message={error} onRetry={refresh} />;
  if (!job) return <ErrorMessage message="Job is unavailable" onRetry={refresh} />;
  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="admin-job-heading">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 ref={headingRef} tabIndex={-1} id="admin-job-heading" className="section-heading mt-2">
          Job #{job.id}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {job.kind} · {job.status}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {notice}
      </p>
      <Card>
        <CardContent className="space-y-2 py-5">
          <h2 className="font-semibold">Queue details</h2>
          <p>
            Attempts: {job.attempts} of {job.maxAttempts}
          </p>
          <p>Scheduled: {job.runAt}</p>
          {job.lastError && (
            <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
              Last error: {job.lastError}
            </p>
          )}
          <Button
            type="button"
            disabled={retrying || job.status !== 'dead'}
            onClick={() => void retry()}
          >
            {retrying ? 'Retrying…' : 'Retry dead job'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="font-semibold">Attempt ledger</h2>
          {job.attemptsLedger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts recorded.</p>
          ) : (
            <ol className="space-y-3">
              {job.attemptsLedger.map((attempt) => (
                <li key={attempt.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    Attempt {attempt.attemptNumber}: {attempt.outcome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Started {attempt.startedAt}; finished {attempt.finishedAt ?? 'in progress'}
                  </p>
                  {attempt.error && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-destructive">
                      {attempt.error}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
