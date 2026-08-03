import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBackInStock } from '@/hooks/useBackInStock';

const requestedLabel = (requestedAt: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(requestedAt));

/** Account view of the buyer's outstanding back-in-stock alerts. */
export function BackInStockSection() {
  const { subscriptions, loading, error, cancel } = useBackInStock();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const pending = subscriptions.filter((item) => item.status === 'pending');

  const onCancel = async (subscriptionId: string) => {
    if (cancelling) return;
    setCancelling(subscriptionId);
    await cancel(subscriptionId);
    setCancelling(null);
  };

  return (
    <section aria-labelledby="back-in-stock-heading" className="mt-6 rounded-lg border p-6">
      <h2 id="back-in-stock-heading" className="text-base font-medium">
        Back-in-stock alerts
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We email you once when an item you are waiting on is available again.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && pending.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your alerts…</p>
      ) : pending.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">You have no back-in-stock alerts.</p>
      ) : (
        <ul aria-label="Back-in-stock alerts" className="mt-4 space-y-3">
          {pending.map((item) => (
            <li
              key={item.subscriptionId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.productName}</p>
                <p className="text-muted-foreground">
                  {item.variantLabel} · requested {requestedLabel(item.requestedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cancelling === item.subscriptionId}
                onClick={() => void onCancel(item.subscriptionId)}
                aria-label={`Cancel back-in-stock alert for ${item.productName} ${item.variantLabel}`}
              >
                Cancel alert
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
