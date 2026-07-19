import { BagArtwork } from '@/components/BagArtwork';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { powderMixBagSchemePresentation } from '@/components/powderMixBagScheme';
import { formatMoney } from '@/lib/formatMoney';
import type { OrderDetailResponse } from '@shop/contracts/orders';
import type { LegacyRef } from 'react';
import { formatOrderDate, orderStatusLabel } from './orderPresentation';

type Props = {
  order: OrderDetailResponse;
  allowCancellation?: boolean;
  isCancelling?: boolean;
  onRequestCancellation?: () => void;
  cancelTriggerRef?: LegacyRef<HTMLElement>;
};

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'delivery_failed' || status === 'cancelled') return 'destructive';
  if (status === 'delivered') return 'default';
  return 'secondary';
}

export function OrderDetailView({
  order,
  allowCancellation = false,
  isCancelling = false,
  onRequestCancellation,
  cancelTriggerRef,
}: Props) {
  const namesByLineId = new Map<string, string>([
    ...order.items.map((line): [string, string] => [`product:${line.lineId}`, line.productName]),
    ...order.mixItems.map((line): [string, string] => [
      `powder_mix:${line.lineId}`,
      line.customLabel ?? 'Custom powder mix',
    ]),
  ]);

  return (
    <section className="space-y-6" aria-label={`Order ${order.id}`}>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Order #{order.id}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed {formatOrderDate(order.createdAt)}
            </p>
          </div>
          <Badge
            variant={statusVariant(order.status)}
            aria-label={`Order status: ${orderStatusLabel(order.status)}`}
          >
            {orderStatusLabel(order.status)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3" aria-label="Purchased items">
            {order.items.map((item) => (
              <div key={item.lineId} className="flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0">
                  {item.productName}{' '}
                  <span className="text-muted-foreground">× {item.quantity}</span>
                  {item.inventoryStatus === 'partially_backordered' && (
                    <span className="block text-xs font-medium text-amber-700">
                      {item.allocatedQuantity} allocated; {item.backorderedQuantity} awaiting stock
                    </span>
                  )}
                  {item.inventoryStatus === 'backordered' && (
                    <span className="block text-xs font-medium text-amber-700">Awaiting stock</span>
                  )}
                  {item.inventoryStatus === 'allocated' && (
                    <span className="block text-xs text-muted-foreground">
                      Allocated for fulfilment
                    </span>
                  )}
                  {item.inventoryStatus === 'cancelled' && (
                    <span className="block text-xs text-muted-foreground">
                      Allocation cancelled
                    </span>
                  )}
                </span>
                <span>{formatMoney(item.lineTotalCents)}</span>
              </div>
            ))}
            {order.mixItems.map((item) => {
              const scheme = powderMixBagSchemePresentation(item.bagColourScheme);
              return (
                <div key={item.lineId} className="flex items-center justify-between gap-3 text-sm">
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
                          .join(' · ')}{' '}
                        · {item.bagSizeGrams}g · {item.fineness}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.shipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Shipment planning has not started.</p>
          ) : (
            order.shipments.map((shipment) => (
              <article
                key={shipment.id}
                className="rounded-lg border p-4"
                aria-label={`Shipment ${shipment.shipmentNumber}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">Shipment {shipment.shipmentNumber}</h3>
                  <Badge variant={statusVariant(shipment.status)}>
                    {orderStatusLabel(shipment.status)}
                  </Badge>
                </div>
                {shipment.trackingReference && (
                  <p className="mt-2 text-sm">
                    Tracking reference:{' '}
                    <span className="font-medium">{shipment.trackingReference}</span>
                  </p>
                )}
                <ul
                  className="mt-3 list-inside list-disc text-sm text-muted-foreground"
                  aria-label={`Shipment ${shipment.shipmentNumber} items`}
                >
                  {shipment.lines.map((line) => (
                    <li key={`${line.lineKind}-${line.lineId}`}>
                      {namesByLineId.get(`${line.lineKind}:${line.lineId}`) ?? 'Purchased item'} ×{' '}
                      {line.quantity}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 border-l pl-5" aria-label="Order timeline">
            {order.events.map((event) => (
              <li key={event.id} className="relative text-sm">
                <span
                  className="absolute -left-[1.55rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <p className="font-medium">{event.title}</p>
                {event.detail && <p className="text-muted-foreground">{event.detail}</p>}
                {event.location && <p className="text-muted-foreground">{event.location}</p>}
                <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>
                  {formatOrderDate(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {allowCancellation && order.canCancel && onRequestCancellation && (
        <div className="rounded-lg border border-destructive/40 p-4">
          <h2 className="font-medium">Cancel this order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This stops simulated fulfilment. Unshipped allocated stock is released; no refund is
            issued.
          </p>
          <Button
            ref={cancelTriggerRef}
            className="mt-3"
            variant="destructive"
            disabled={isCancelling}
            onClick={onRequestCancellation}
          >
            {isCancelling ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </div>
      )}
    </section>
  );
}
