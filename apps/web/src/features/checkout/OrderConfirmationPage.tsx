import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OrderDetailResponse } from '@shop/contracts/orders';
import { getOrder } from '@/api/orders';
import { ApiError } from '@/api/client';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { OrderDetailView } from '@/features/orders/OrderDetailView';

/** Confirmation remains usable for exact-order guest capability cookies. */
export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError('Order reference is missing.');
      setIsLoading(false);
      return;
    }
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
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
              : 'Failed to load order',
        );
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return <ErrorMessage message={error} onRetry={orderId ? () => void fetchOrder() : undefined} />;
  if (!order) return <ErrorMessage message="Order not found" />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">Your powders are confirmed.</h1>
        <p className="text-muted-foreground">
          QArefully Powder Co. has recorded this simulated order. A receipt is in the Dev Mailbox.
        </p>
      </div>
      <OrderDetailView order={order} />
      <div className="mt-6 text-center">
        <Button render={<Link to="/catalog" />}>Shop more powders</Button>
      </div>
    </div>
  );
}
