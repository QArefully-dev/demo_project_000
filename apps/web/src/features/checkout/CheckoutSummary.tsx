import type { Cart } from '@shop/contracts/cart';
import type { DeliverySlot } from '@shop/contracts/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDeliverySlot } from '@/features/orders/orderPresentation';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/formatMoney';
import { cartItemKey } from '@/lib/cartLineIdentity';
import {
  CUSTOM_BLEND_MADE_TO_ORDER_NOTE,
  CustomBlendPackaging,
  customBlendCompositionLabel,
} from '@/features/customBlend/CustomBlendPackaging';
import { Badge } from '@/components/ui/badge';
import { PromoCodeForm } from './PromoCodeForm';

interface CheckoutSummaryProps {
  cart: Cart;
  promoCode: string;
  appliedPromo: string | null;
  discountCents: number;
  totalCents: number;
  promoError: string | null;
  promoValidating: boolean;
  isPromoEligible: boolean;
  /** Chosen saved site label, or the head of the ad-hoc address. `null` until step 1 completes. */
  destinationSummary: string | null;
  billingSummary: string | null;
  deliverySlot: DeliverySlot | null;
  purchaseOrderReference: string | null;
  onPromoChange: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}

function deliveryModeLabel(mode: string): string {
  return mode === 'freight' ? 'Freight' : 'Parcel';
}

export function CheckoutSummary({
  cart,
  promoCode,
  appliedPromo,
  discountCents,
  totalCents,
  promoError,
  promoValidating,
  isPromoEligible,
  destinationSummary,
  billingSummary,
  deliverySlot,
  purchaseOrderReference,
  onPromoChange,
  onApplyPromo,
  onRemovePromo,
}: CheckoutSummaryProps) {
  const deliveryPreview = cart.deliveryPreview;
  const slotSummary = deliverySlot ? formatDeliverySlot(deliverySlot) : null;
  const tradeRows: Array<{ label: string; value: string }> = [
    ...(destinationSummary ? [{ label: 'Delivery site', value: destinationSummary }] : []),
    ...(slotSummary ? [{ label: 'Delivery slot', value: slotSummary }] : []),
    ...(billingSummary ? [{ label: 'Billed to', value: billingSummary }] : []),
    ...(purchaseOrderReference
      ? [{ label: 'Purchase order reference', value: purchaseOrderReference }]
      : []),
  ];
  const hasCustomBlend = cart.items.some((item) => item.customBlend !== undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div
              key={cartItemKey(item)}
              className="flex items-center justify-between gap-3 text-sm"
            >
              {item.customBlend && (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  <CustomBlendPackaging
                    product={item.product}
                    variant={item.variantSnap}
                    blend={item.customBlend}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <span className="min-w-0 flex-1">
                {item.product.name}{' '}
                {item.variantSnap && (
                  <span className="text-muted-foreground">&mdash; {item.variantSnap.label}</span>
                )}{' '}
                <span className="text-muted-foreground">× {item.quantity}</span>
                {item.variantSnap && (
                  <span className="block text-xs text-muted-foreground">
                    SKU: {item.variantSnap.sku} · {item.variantSnap.weightGrams}g
                  </span>
                )}
                {item.variantSnap && (
                  <span className="block text-xs text-muted-foreground">
                    Resolved pack price: {formatMoney(item.resolvedUnitPriceCents)} ·{' '}
                    {formatMoney(item.perTonneCents)} / tonne · {item.variantSnap.weightGrams}g pack
                  </span>
                )}
                {item.customBlend && (
                  <span
                    className="block text-xs text-muted-foreground"
                    data-testid="checkout-blend"
                  >
                    <Badge variant="outline" className="mb-0.5 w-fit text-[10px]">
                      Custom blend
                    </Badge>
                    <span className="block">
                      {customBlendCompositionLabel(item.product.name, item.customBlend)}
                    </span>
                    <span className="block">
                      Base material: {formatMoney(item.materialSubtotalCents)} · Blending fee:{' '}
                      {formatMoney(item.blendingFeeCents)}
                    </span>
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
        {cart.blendingFeeTotalCents > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Material subtotal</span>
              <span>{formatMoney(cart.discountableSubtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Blending fees</span>
              <span>{formatMoney(cart.blendingFeeTotalCents)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Resolved merchandise subtotal</span>
          <span>{formatMoney(cart.subtotalCents)}</span>
        </div>
        <PromoCodeForm
          promoCode={promoCode}
          appliedPromo={appliedPromo}
          error={promoError}
          validating={promoValidating}
          eligible={isPromoEligible}
          onChange={onPromoChange}
          onApply={onApplyPromo}
          onRemove={onRemovePromo}
        />
        {discountCents > 0 && (
          <div className="flex items-center justify-between text-sm text-green-700">
            <span>Discount{appliedPromo ? ` (${appliedPromo})` : ''}</span>
            <span>−{formatMoney(discountCents)}</span>
          </div>
        )}
        {deliveryPreview && (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {deliveryModeLabel(deliveryPreview.mode) === 'Freight'
                  ? 'Pallet freight scheduled after order confirmation'
                  : 'Parcel delivery · Free'}
              </span>
              <span>
                {deliveryPreview.chargeCents === 0
                  ? '$0.00'
                  : formatMoney(deliveryPreview.chargeCents)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total order weight: {deliveryPreview.weightGrams.toLocaleString()}g
            </p>
          </>
        )}
        {tradeRows.length > 0 && (
          <>
            <Separator />
            <dl className="space-y-1 text-sm">
              {tradeRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(totalCents)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
