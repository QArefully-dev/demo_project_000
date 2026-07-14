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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bag summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between text-sm">
              <span>
                {item.product.name} <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span>{formatMoney(item.lineTotalCents)}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
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
            <span>Discount</span>
            <span>−{formatMoney(discountCents)}</span>
          </div>
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
