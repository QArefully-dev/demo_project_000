import type { Cart } from '@shop/contracts/cart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/formatMoney';
import { cartItemKey } from '@/lib/cartLineIdentity';
import {
  CUSTOM_BLEND_MADE_TO_ORDER_NOTE,
  customBlendCompositionLabel,
} from '@/features/customBlend/CustomBlendPackaging';
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
  const hasCustomBlend = cart.items.some((item) => item.customBlend !== undefined);

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
                {item.customBlend && (
                  <span
                    className="block text-xs text-muted-foreground"
                    data-testid="checkout-blend"
                  >
                    Custom blend: {customBlendCompositionLabel(item.product.name, item.customBlend)}
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
          <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
        <Separator />
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(totalCents)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
