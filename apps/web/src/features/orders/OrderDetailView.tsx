import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/formatMoney';
import type { OrderDetailResponse } from '@shop/contracts/orders';
import type { Product } from '@shop/contracts/products';
import type { LegacyRef } from 'react';
import {
  CUSTOM_BLEND_MADE_TO_ORDER_NOTE,
  CustomBlendPackaging,
  customBlendCompositionLabel,
} from '@/features/customBlend/CustomBlendPackaging';
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

function deliveryModeLabel(mode: string): string {
  return mode === 'freight' ? 'Freight' : 'Parcel';
}

function orderPackagingProduct(item: OrderDetailResponse['items'][number]): Product {
  const presentation = item.customBlend?.basePresentation;
  return {
    id: item.productId,
    name: item.productName,
    description: '',
    priceCents: item.unitPriceCents,
    imageSetId: `order-${item.productId}`,
    category: presentation?.category ?? '',
    stock: 0,
    availability: 'out_of_stock',
    backorderable: false,
    backorderLeadDays: null,
    slug: `order-${item.productId}`,
    salesCount: 0,
    createdAt: '1970-01-01T00:00:00.000Z',
    available: false,
    tags: [],
    specificationGroups: [],
    consumptionClassification:
      presentation?.consumptionClassification ?? item.variantSnapshot?.consumptionClassification,
    mixingGroup: item.customBlend?.mixingGroup,
    ...(presentation ? { categoryFacts: presentation.categoryFacts } : {}),
  };
}

export function OrderDetailView({
  order,
  allowCancellation = false,
  isCancelling = false,
  onRequestCancellation,
  cancelTriggerRef,
}: Props) {
  const namesByLineId = new Map<string, string>(
    order.items.map((line): [string, string] => [line.lineId, line.productName]),
  );
  const hasCustomBlend = order.items.some((line) => line.customBlend !== undefined);

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
                {item.customBlend && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    <CustomBlendPackaging
                      product={orderPackagingProduct(item)}
                      variant={item.variantSnapshot}
                      blend={item.customBlend}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  {item.productName}{' '}
                  <span className="text-muted-foreground">× {item.quantity}</span>
                  {item.variantSnapshot && (
                    <span className="block text-xs text-muted-foreground">
                      {item.variantSnapshot.label} · SKU: {item.variantSnapshot.sku} ·{' '}
                      {item.variantSnapshot.weightGrams}g
                    </span>
                  )}
                  {item.customBlend && (
                    <span className="block text-xs text-muted-foreground" data-testid="order-blend">
                      <Badge variant="outline" className="mb-0.5 w-fit text-[10px]">
                        Custom blend
                      </Badge>
                      <span className="block">
                        {customBlendCompositionLabel(item.productName, item.customBlend)}
                      </span>
                      <span className="block">
                        Base material: {formatMoney(item.discountableTotalCents)} · Blending fee:{' '}
                        {formatMoney(item.blendingFeeCents)}
                      </span>
                    </span>
                  )}
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
                <span className="shrink-0">{formatMoney(item.lineTotalCents)}</span>
              </div>
            ))}
          </div>
          {hasCustomBlend && (
            <p className="custom-blend-notice rounded-md px-3 py-2 text-xs">
              {CUSTOM_BLEND_MADE_TO_ORDER_NOTE}
            </p>
          )}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Merchandise subtotal</span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex items-center justify-between text-sm text-green-700">
                <span>Discount{order.promoApplied ? ` (${order.promoApplied})` : ''}</span>
                <span>−{formatMoney(order.discountCents)}</span>
              </div>
            )}
            {order.deliveryMode && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{deliveryModeLabel(order.deliveryMode)} delivery</span>
                <span>
                  {order.deliveryChargeCents !== undefined && order.deliveryChargeCents === 0
                    ? 'Free'
                    : order.deliveryChargeCents !== undefined
                      ? formatMoney(order.deliveryChargeCents)
                      : ''}
                </span>
              </div>
            )}
          </div>
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
                {order.deliveryMode && (
                  <p className="text-xs text-muted-foreground">
                    {deliveryModeLabel(order.deliveryMode)} ·{' '}
                    {order.deliveryWeightGrams !== undefined
                      ? `${(order.deliveryWeightGrams / 1000).toFixed(1)}kg`
                      : ''}
                  </p>
                )}
                <ul
                  className="mt-3 list-inside list-disc text-sm text-muted-foreground"
                  aria-label={`Shipment ${shipment.shipmentNumber} items`}
                >
                  {shipment.lines.map((line) => (
                    <li key={line.lineId}>
                      {namesByLineId.get(line.lineId) ?? 'Purchased item'} × {line.quantity}
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
