import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { formatMoney } from '@/lib/formatMoney';
import { getOrder } from '../../api/orders';
import type { Order } from '@shop/contracts';

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError('Order reference is missing.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setIsLoading(false);
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">Order Confirmed!</h1>
        <p className="text-muted-foreground">Thank you for your purchase.</p>
      </div>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>Order #{order.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between text-sm">
                <span>
                  {item.productName}{' '}
                  <span className="text-muted-foreground">× {item.quantity}</span>
                </span>
                <span>{formatMoney(item.lineTotalCents)}</span>
              </div>
            ))}
          </div>
          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(order.subtotalCents)}</span>
          </div>

          {order.discountCents > 0 && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <span>Discount{order.promoApplied ? ` (${order.promoApplied})` : ''}</span>
              <span>−{formatMoney(order.discountCents)}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(order.totalCents)}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Ordered on{' '}
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Button render={<Link to="/" />}>Continue Shopping</Button>
      </div>
    </div>
  );
}
