import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAdminWebhook } from '@/api/adminWebhooks';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';

const messageFor = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
export function AdminWebhookDetailPage() {
  const { webhookId } = useParams();
  const [webhook, setWebhook] = useState<Awaited<ReturnType<typeof getAdminWebhook>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    if (!webhookId) return;
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError(null);
    getAdminWebhook(webhookId, controller.signal)
      .then((response) => {
        if (current) setWebhook(response);
      })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted)
          setError(messageFor(requestError, 'Unable to load webhook detail.'));
      })
      .finally(() => {
        if (current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [reloadVersion, webhookId]);
  if (!webhookId)
    return (
      <ErrorMessage
        message="Webhook identifier is required"
        onRetry={() => setReloadVersion((value) => value + 1)}
      />
    );
  if (loading && !webhook) return <LoadingSpinner />;
  if (error && !webhook)
    return <ErrorMessage message={error} onRetry={() => setReloadVersion((value) => value + 1)} />;
  if (!webhook)
    return (
      <ErrorMessage
        message="Webhook is unavailable"
        onRetry={() => setReloadVersion((value) => value + 1)}
      />
    );
  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="admin-webhook-heading">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 id="admin-webhook-heading" className="section-heading mt-2">
          Webhook #{webhook.id}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {webhook.eventType} · {webhook.status}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Card>
        <CardContent className="space-y-2 py-5">
          <h2 className="font-semibold">Delivery details</h2>
          <p>Event ID: {webhook.eventId}</p>
          <p>Received: {webhook.receivedAt}</p>
          {webhook.processedAt && <p>Processed: {webhook.processedAt}</p>}
          {webhook.failureReason && (
            <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
              {webhook.failureReason}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="font-semibold">Captured payload</h2>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-sm">
            {JSON.stringify(webhook.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </section>
  );
}
