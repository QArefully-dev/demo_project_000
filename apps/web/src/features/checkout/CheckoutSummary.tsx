import type { Cart } from '@shop/contracts/cart';
import type { DeliverySlot } from '@shop/contracts/delivery';
import type { PromoValidationErrorCode } from '@shop/contracts/promos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cartItemKey } from '@/lib/cartLineIdentity';
import {
  customBlendMadeToOrderNote,
  CustomBlendPackaging,
  customBlendCompositionLabel,
} from '@/features/customBlend/CustomBlendPackaging';
import { Badge } from '@/components/ui/badge';
import { useLocalisation } from '@/i18n/LocaleContext';
import { checkoutMessages } from '@shop/localisation/messages/checkout';
import { PromoCodeForm } from './PromoCodeForm';

interface CheckoutSummaryProps {
  cart: Cart;
  promoCode: string;
  appliedPromo: string | null;
  discountCents: number;
  discountBaseCents: number | null;
  promoCategoryScope: string | null;
  totalCents: number;
  promoError: string | null;
  promoErrorCode: PromoValidationErrorCode | null;
  promoMinSubtotalCents: number | null;
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

export function CheckoutSummary({
  cart,
  promoCode,
  appliedPromo,
  discountCents,
  discountBaseCents,
  promoCategoryScope,
  totalCents,
  promoError,
  promoErrorCode,
  promoMinSubtotalCents,
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
  const {
    country,
    translate,
    formatDisplayMoney,
    formatDualTotal,
    formatCivilDate,
    formatWeightGrams,
  } = useLocalisation();
  const t = (key: keyof typeof checkoutMessages, params?: Record<string, string | number>) =>
    translate(checkoutMessages, key, params);
  const deliveryPreview = cart.deliveryPreview;
  const slotSummary = deliverySlot
    ? `${formatCivilDate(deliverySlot.date, 'long')} · ${t(
        deliverySlot.window === 'am' ? 'checkout.slotMorning' : 'checkout.slotAfternoon',
      )}`
    : null;
  const tradeRows: Array<{ label: string; value: string }> = [
    ...(destinationSummary
      ? [{ label: t('checkout.deliverySiteSummary'), value: destinationSummary }]
      : []),
    ...(slotSummary ? [{ label: t('checkout.deliverySlotSummary'), value: slotSummary }] : []),
    ...(billingSummary ? [{ label: t('checkout.billedTo'), value: billingSummary }] : []),
    ...(purchaseOrderReference
      ? [{ label: t('checkout.purchaseOrderReference'), value: purchaseOrderReference }]
      : []),
  ];
  const hasCustomBlend = cart.items.some((item) => item.customBlend !== undefined);
  const total = formatDualTotal(totalCents);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('checkout.summary')}</CardTitle>
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
                    {t('checkout.sku')}: {item.variantSnap.sku} ·{' '}
                    {formatWeightGrams(item.variantSnap.weightGrams)}
                  </span>
                )}
                {item.variantSnap && (
                  <span className="block text-xs text-muted-foreground">
                    {t('checkout.packPrice', {
                      money: formatDisplayMoney(item.resolvedUnitPriceCents),
                    })}{' '}
                    · {t('checkout.perTonne', { money: formatDisplayMoney(item.perTonneCents) })} ·{' '}
                    {t('checkout.packWeight', {
                      weight: formatWeightGrams(item.variantSnap.weightGrams),
                    })}
                  </span>
                )}
                {item.customBlend && (
                  <span
                    className="block text-xs text-muted-foreground"
                    data-testid="checkout-blend"
                  >
                    <Badge variant="outline" className="mb-0.5 w-fit text-[10px]">
                      {t('checkout.customBlend')}
                    </Badge>
                    <span className="block">
                      {customBlendCompositionLabel(item.product.name, item.customBlend, country)}
                    </span>
                    <span className="block">
                      {t('checkout.baseMaterial', {
                        money: formatDisplayMoney(item.materialSubtotalCents),
                      })}{' '}
                      ·{' '}
                      {t('checkout.blendingFee', {
                        money: formatDisplayMoney(item.blendingFeeCents),
                      })}
                    </span>
                  </span>
                )}
              </span>
              <span className="shrink-0">{formatDisplayMoney(item.lineTotalCents)}</span>
            </div>
          ))}
        </div>
        {hasCustomBlend && (
          <p className="custom-blend-notice rounded-md px-3 py-2 text-xs">
            {customBlendMadeToOrderNote(country)}
          </p>
        )}
        <Separator />
        {cart.blendingFeeTotalCents > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('checkout.materialSubtotal')}</span>
              <span>{formatDisplayMoney(cart.discountableSubtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('checkout.blendingFees')}</span>
              <span>{formatDisplayMoney(cart.blendingFeeTotalCents)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('checkout.merchandiseSubtotal')}</span>
          <span>{formatDisplayMoney(cart.subtotalCents)}</span>
        </div>
        <PromoCodeForm
          promoCode={promoCode}
          appliedPromo={appliedPromo}
          error={promoError}
          errorCode={promoErrorCode}
          minSubtotalCents={promoMinSubtotalCents}
          validating={promoValidating}
          eligible={isPromoEligible}
          onChange={onPromoChange}
          onApply={onApplyPromo}
          onRemove={onRemovePromo}
        />
        {discountCents > 0 && (
          <>
            {promoCategoryScope && discountBaseCents !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('checkout.eligibleSubtotal', { scope: promoCategoryScope })}
                </span>
                <span>{formatDisplayMoney(discountBaseCents)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm text-green-700">
              <span>
                {appliedPromo
                  ? t('checkout.discount', {
                      promo: `${appliedPromo}${promoCategoryScope ? ` · ${promoCategoryScope}` : ''}`,
                    })
                  : t('checkout.discountPlain')}
              </span>
              <span>−{formatDisplayMoney(discountCents)}</span>
            </div>
          </>
        )}
        {deliveryPreview && (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {deliveryPreview.mode === 'freight'
                  ? t('checkout.freightScheduled')
                  : `${t('checkout.parcelDelivery')} · ${t('checkout.free')}`}
              </span>
              <span>{formatDisplayMoney(deliveryPreview.chargeCents)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('checkout.totalWeight', {
                weight: formatWeightGrams(deliveryPreview.weightGrams),
              })}
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
          <span>{t('checkout.total')}</span>
          <span className="text-right">
            <span className="block">{total.display}</span>
            {total.settlement && (
              <span className="block text-sm font-normal text-muted-foreground">
                {t('checkout.settlementTotal', { money: total.settlement })}
              </span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
