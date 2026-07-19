import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelOrder, getOrder } from '@/api/orders';
import { ApiError } from '@/api/client';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import type { OrderDetailResponse } from '@shop/contracts/orders';
import { OrderDetailView } from './OrderDetailView';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  const requestId = useRef(0);
  const cancelTrigger = useRef<HTMLElement | null>(null);
  const confirmButton = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const wasConfirming = useRef(false);

  const load = useCallback(
    async (clearError = true) => {
      if (!orderId) {
        setError('Order reference is missing.');
        setLoading(false);
        return;
      }
      const currentRequest = ++requestId.current;
      setLoading(true);
      if (clearError) setError(null);
      try {
        const response = await getOrder(orderId);
        if (currentRequest === requestId.current) setOrder(response);
      } catch (err) {
        if (currentRequest === requestId.current) {
          setError(
            err instanceof ApiError && err.status === 404
              ? 'Order not found.'
              : err instanceof Error
                ? err.message
                : 'Order not found',
          );
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (confirming) {
      wasConfirming.current = true;
      confirmButton.current?.focus();
      return;
    }
    if (wasConfirming.current && cancelTrigger.current?.isConnected) cancelTrigger.current.focus();
    wasConfirming.current = false;
  }, [confirming]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setConfirming(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitCancellation = async () => {
    if (!order || !orderId) return;
    setCancelling(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      setOrder(
        await cancelOrder(orderId, {
          version: order.version,
          idempotencyKey: idempotencyKey.current,
        }),
      );
      setAnnouncement(
        `Order #${orderId} was cancelled. Simulated fulfilment has stopped; unshipped allocated stock was released and no refund was issued.`,
      );
      setConfirming(false);
      idempotencyKey.current = null;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        idempotencyKey.current = null;
        setConfirming(false);
        setError('This order changed before cancellation. Its latest status has been refreshed.');
        await load(false);
      } else setError(err instanceof Error ? err.message : 'Unable to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !order) return <LoadingSpinner />;
  if (error && !order) return <ErrorMessage message={error} onRetry={() => void load()} />;
  if (!order) return <ErrorMessage message="Order not found" />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="link" render={<Link to="/orders" />}>
        ← My Orders
      </Button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {error && (
        <p
          role="status"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <OrderDetailView
        order={order}
        allowCancellation
        isCancelling={cancelling}
        onRequestCancellation={() => setConfirming(true)}
        cancelTriggerRef={cancelTrigger}
      />
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          ref={dialog}
          onKeyDown={handleDialogKeyDown}
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-lg">
            <h2 id="cancel-title" className="text-lg font-semibold">
              Cancel order #{order.id}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This stops simulated fulfilment. Unshipped allocated stock is released; no refund is issued.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep order
              </Button>
              <Button
                ref={confirmButton}
                variant="destructive"
                disabled={cancelling}
                onClick={() => void submitCancellation()}
              >
                {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
