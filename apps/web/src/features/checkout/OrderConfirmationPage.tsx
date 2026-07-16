import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BagArtwork } from '@/components/BagArtwork';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { powderMixBagSchemePresentation } from '@/components/powderMixBagScheme';
import { formatMoney } from '@/lib/formatMoney';
import { getOrder } from '../../api/orders';
import type { Order } from '@shop/contracts/orders';

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
      setOrder(await getOrder(orderId));
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
        <h1 className="text-2xl font-bold text-green-700">Your powders are confirmed.</h1>
        <p className="text-muted-foreground">
          QArefully Powder Co. has recorded this simulated order. A receipt is in the Dev Mailbox.
        </p>
      </div>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>Powder order #{order.id}</CardTitle>
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
            {order.mixItems.map((item) => {
              const scheme = powderMixBagSchemePresentation(item.bagColourScheme);
              return (
                <div key={item.mixId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <BagArtwork
                      name={item.customLabel ?? 'Custom powder mix'}
                      category="Custom mix"
                      quantity={`${item.bagSizeGrams}g`}
                      batchCode={item.priceVersion}
                      mark="MIX"
                      paint={scheme.paint}
                      powderAccent={scheme.paint.colors[1]}
                      consumptionLabel={null}
                      ariaLabel=""
                      className="h-12 w-12 shrink-0"
                    />
                    <span>
                      {item.customLabel ?? 'Custom powder mix'}{' '}
                      <span className="text-muted-foreground">× {item.quantity}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.components
                          .map(({ productName, percentage }) => `${productName} ${percentage}%`)
                          .join(' · ')}
                        {' · '}
                        {item.bagSizeGrams}g · {item.fineness}
                      </span>
                      <span className="block text-xs font-medium">
                        {scheme.label} · {item.usageLabel}
                      </span>
                    </span>
                  </div>
                  <span>{formatMoney(item.lineTotalCents)}</span>
                </div>
              );
            })}
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
        <Button render={<Link to="/catalog" />}>Shop more powders</Button>
      </div>
    </div>
  );
}
