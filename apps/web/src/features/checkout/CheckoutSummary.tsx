import type { Cart } from '@shop/contracts/cart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/formatMoney';
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
  onPromoChange: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}

function cartItemKey(item: { productId: string; variantSnap?: { variantId: number } }): string {
  return `${item.productId}:${item.variantSnap?.variantId ?? 'no-variant'}`;
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
  onPromoChange,
  onApplyPromo,
  onRemovePromo,
}: CheckoutSummaryProps) {
  const deliveryPreview = cart.deliveryPreview;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={cartItemKey(item)} className="flex items-center justify-between text-sm">
              <span className="min-w-0">
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
              </span>
              <span className="shrink-0">{formatMoney(item.lineTotalCents)}</span>
            </div>
          ))}
        </div>
        <Separator />
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
        <Separator />
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(totalCents)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
