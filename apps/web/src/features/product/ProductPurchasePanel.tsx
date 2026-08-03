import { useState } from 'react';
import type { ProductWithVariants, CatalogVariant } from '@shop/contracts/products';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import { Check, Package, Scale, AlertTriangle, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToListMenu } from '@/features/savedLists/AddToListMenu';
import { CompareProductButton } from '@/features/comparison/CompareProductButton';
import { NotifyWhenAvailableButton } from '@/components/NotifyWhenAvailableButton';
import { formatMoney } from '@/lib/formatMoney';

interface ProductPurchasePanelProps {
  product: ProductWithVariants;
  isCartAvailable: boolean;
  isAdding: boolean;
  actionError: string | null;
  cartError?: string | null;
  onAddToCart: (variantId: number, quantity: number) => Promise<void>;
  onRetryCart?: () => void;
  belowMoqError?: string | null;
}

function variantIsPurchasable(v: CatalogVariant): boolean {
  return v.active && (v.stockCount > 0 || v.backorderable);
}

/** Sold out with no backorder route — the only state a waiting list makes sense in. */
function variantIsSoldOut(v: CatalogVariant): boolean {
  return v.active && v.stockCount === 0 && !v.backorderable;
}

function formatWeightGrams(weightGrams: number): string {
  if (weightGrams >= 1_000_000) return `${(weightGrams / 1_000_000).toLocaleString()} tonnes`;
  if (weightGrams >= 1_000) return `${(weightGrams / 1_000).toLocaleString()} kg`;
  return `${weightGrams.toLocaleString()} g`;
}

function minimumOrderUnits(variant: CatalogVariant): number {
  return Math.ceil((variant.moqSacks * SACK_WEIGHT_GRAMS) / variant.weightGrams);
}

function clearanceEndLabel(endsAt: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(endsAt));
}

function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
}: {
  variants: readonly CatalogVariant[];
  selectedVariantId: number | null;
  onSelect: (variantId: number) => void;
}) {
  const sorted = [...variants].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <fieldset className="mt-6">
      <legend className="font-semibold text-foreground">Pack &amp; pallet options</legend>
      <div className="mt-3 grid gap-3">
        {sorted.map((v) => {
          const isSelected = selectedVariantId === v.variantId;
          const isOutOfStock = variantIsSoldOut(v);
          // A sold-out option stays selectable so the buyer can join its waiting list; only a
          // retired option is unselectable. Purchasability is still enforced on the add action.
          const disabled = !variantIsPurchasable(v) && !isOutOfStock;
          const isBackorder = v.active && v.stockCount === 0 && v.backorderable;
          const isFreight = v.deliveryClass === 'freight';
          const hasSale = v.compareAtPriceCents != null && v.compareAtPriceCents > v.priceCents;
          const clearance = v.clearance;

          return (
            <label
              key={v.variantId}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                disabled
                  ? 'cursor-not-allowed border-border/40 bg-surface-soft/50 opacity-60'
                  : isSelected
                    ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border/80 bg-surface-raised hover:border-primary/30'
              }`}
            >
              <input
                type="radio"
                name="variant"
                className="mt-0.5 size-4 accent-primary"
                checked={isSelected}
                disabled={disabled}
                onChange={() => onSelect(v.variantId)}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-foreground">{v.label}</span>
                  {isFreight && (
                    <Badge variant="secondary" className="gap-1 px-2">
                      <Truck className="size-3" />
                      Freight
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {clearance ? (
                      <>
                        <span className="text-sale">
                          Clearance price {formatMoney(clearance.priceCents)}
                        </span>{' '}
                        <span className="text-xs font-normal text-muted-foreground line-through">
                          {formatMoney(v.priceCents)}
                        </span>
                      </>
                    ) : hasSale ? (
                      <>
                        <span className="text-sale">Pack price {formatMoney(v.priceCents)}</span>{' '}
                        <span className="text-xs font-normal text-muted-foreground line-through">
                          {formatMoney(v.compareAtPriceCents!)}
                        </span>
                      </>
                    ) : (
                      <>Pack price {formatMoney(v.priceCents)}</>
                    )}
                  </span>
                  <span>{formatMoney(clearance?.perTonneCents ?? v.perTonneCents)} / tonne</span>
                  <span className="inline-flex items-center gap-1">
                    <Package className="size-3.5" />
                    SKU: {v.sku}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Scale className="size-3.5" />
                    {v.weightGrams >= 1000
                      ? `${(v.weightGrams / 1000).toFixed(1)} kg`
                      : `${v.weightGrams} g`}
                  </span>
                </div>
                {clearance && (
                  <p
                    className="text-xs font-medium text-sale"
                    aria-label={`Clearance ends ${clearanceEndLabel(clearance.endsAt)}`}
                  >
                    Clearance ends {clearanceEndLabel(clearance.endsAt)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="size-3.5" />
                      Sold out
                    </span>
                  ) : isBackorder ? (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      Backorder
                      {v.backorderLeadDays != null && ` (${v.backorderLeadDays} days lead)`}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                      <Check className="size-3.5" />
                      {v.stockCount === 1
                        ? '1 pallet available'
                        : v.stockCount <= 5
                          ? `Only ${v.stockCount} pallets available`
                          : `${v.stockCount} pallets available`}
                    </span>
                  )}
                </div>
                {isFreight && (
                  <p className="text-sm text-muted-foreground">
                    Pallet freight is arranged after order confirmation
                    {isBackorder && v.backorderLeadDays != null
                      ? ` · lead time ${v.backorderLeadDays} days`
                      : '.'}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductPurchasePanel({
  product,
  isCartAvailable,
  isAdding,
  actionError,
  cartError,
  onAddToCart,
  onRetryCart,
  belowMoqError,
}: ProductPurchasePanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const baseAvail = product.baseAvailability;
  const hasPriceRange = product.priceRange.min !== product.priceRange.max;
  const isOnSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceRange.min;
  const packSize = product.packaging?.quantity;
  const consumptionLabel = product.packaging?.consumptionLabel;
  const isFood = product.consumptionClassification === 'food';
  const isNonFood = product.consumptionClassification === 'non-food';
  const isCaution = product.consumptionClassification === 'caution';

  const selectedVariant = selectedVariantId
    ? (product.variants.find((v) => v.variantId === selectedVariantId) ?? null)
    : null;
  const minimumUnits = selectedVariant ? minimumOrderUnits(selectedVariant) : null;
  const selectedClearance = selectedVariant?.clearance;

  const parsedQuantity = Number(quantity);
  const hasValidQuantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity >= 1;
  const variantAddDisabled =
    !selectedVariantId || !variantIsPurchasable(selectedVariant!) || !hasValidQuantity;

  const priceLabel = hasPriceRange
    ? `From ${formatMoney(product.priceRange.min)}`
    : formatMoney(product.priceRange.min);

  const handleAddToCart = async () => {
    if (!selectedVariantId) {
      setLocalError('Please select a bag option.');
      return;
    }
    if (!selectedVariant || !variantIsPurchasable(selectedVariant)) {
      setLocalError('The selected option is not available.');
      return;
    }
    setLocalError(null);
    if (!hasValidQuantity) {
      setLocalError('Enter a whole number of sacks.');
      return;
    }
    if (minimumUnits != null && parsedQuantity < minimumUnits) {
      setLocalError(`Minimum order is ${minimumUnits} × ${selectedVariant.label}.`);
      return;
    }
    await onAddToCart(selectedVariantId, parsedQuantity);
  };

  const allUnavailable = product.variants.every((v) => !variantIsPurchasable(v));

  return (
    <aside className="product-purchase-panel self-start rounded-2xl border bg-surface-raised p-6 shadow-sm xl:p-8">
      <p className="section-eyebrow">Material · {product.category}</p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {product.name}
        </h1>
        {isOnSale && <Badge className="bg-sale text-sale-foreground">Sale</Badge>}
        {isFood && <Badge className="bg-emerald-600 text-white">Food</Badge>}
        {isNonFood && <Badge variant="secondary">Not for consumption</Badge>}
        {isCaution && <Badge className="bg-amber-500 text-white">Caution</Badge>}
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={
            selectedClearance
              ? 'text-3xl font-bold tracking-tight text-sale'
              : 'text-3xl font-bold tracking-tight text-foreground'
          }
        >
          {selectedClearance ? formatMoney(selectedClearance.priceCents) : priceLabel}
        </span>
        {selectedClearance ? (
          <span className="text-lg text-muted-foreground line-through">
            {formatMoney(selectedVariant.priceCents)}
          </span>
        ) : (
          isOnSale && (
            <>
              <span className="text-lg text-muted-foreground line-through">
                {formatMoney(product.compareAtPriceCents!)}
              </span>
            </>
          )
        )}
      </div>
      {selectedClearance && (
        <p
          className="mt-1 text-sm font-medium text-sale"
          aria-label={`Clearance ends ${clearanceEndLabel(selectedClearance.endsAt)}`}
        >
          Clearance ends {clearanceEndLabel(selectedClearance.endsAt)}
        </p>
      )}

      <p className="mt-6 leading-7 text-muted-foreground">{product.description}</p>

      <VariantSelector
        variants={product.variants}
        selectedVariantId={selectedVariantId}
        onSelect={(variantId) => {
          setSelectedVariantId(variantId);
          const variant = product.variants.find((item) => item.variantId === variantId);
          setQuantity(variant ? String(minimumOrderUnits(variant)) : '');
          setLocalError(null);
        }}
      />

      {selectedVariant && (
        <div className="mt-4 space-y-4 rounded-xl bg-surface-soft p-4 text-sm">
          <p>
            <span className="font-semibold">Selected:</span> {selectedVariant.label} (SKU:{' '}
            {selectedVariant.sku})
          </p>
          <p>
            <span className="font-semibold">Price:</span>{' '}
            {formatMoney(selectedClearance?.priceCents ?? selectedVariant.priceCents)}
            {selectedClearance ? (
              <>
                {' '}
                <span className="text-muted-foreground line-through">
                  {formatMoney(selectedVariant.priceCents)}
                </span>
              </>
            ) : (
              selectedVariant.compareAtPriceCents != null &&
              selectedVariant.compareAtPriceCents > selectedVariant.priceCents && (
                <>
                  {' '}
                  <span className="text-muted-foreground line-through">
                    {formatMoney(selectedVariant.compareAtPriceCents)}
                  </span>
                </>
              )
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="order-quantity" className="font-semibold">
                Order quantity ({selectedVariant.label})
              </label>
              <input
                id="order-quantity"
                type="number"
                inputMode="numeric"
                min={minimumUnits ?? 1}
                step={1}
                value={quantity}
                aria-describedby="order-quantity-hint"
                aria-invalid={
                  hasValidQuantity && minimumUnits != null && parsedQuantity < minimumUnits
                }
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setLocalError(null);
                }}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-foreground"
              />
              <p id="order-quantity-hint" className="mt-1 text-muted-foreground">
                Minimum order: {minimumUnits} × {selectedVariant.label}.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <p className="font-semibold">Total weight</p>
              <p className="mt-1 text-muted-foreground">
                {hasValidQuantity
                  ? `${formatWeightGrams(selectedVariant.weightGrams * parsedQuantity)}`
                  : 'Enter a quantity'}
              </p>
            </div>
          </div>
          <div>
            <p className="font-semibold">Volume pricing</p>
            <ul
              aria-label="Volume pricing tiers"
              className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground"
            >
              {selectedVariant.priceTiers.map((tier) => (
                <li key={`${tier.minTonnes}-${tier.discountPct}`}>
                  {tier.minTonnes} {tier.minTonnes === 1 ? 'tonne' : 'tonnes'}: {tier.discountPct}%
                  off
                </li>
              ))}
            </ul>
          </div>
          {selectedVariant.deliveryClass === 'freight' && (
            <p className="rounded-lg border border-border/70 bg-background p-3 text-muted-foreground">
              Pallet freight applies. Lead time is confirmed with your order
              {selectedVariant.backorderLeadDays != null
                ? `; current backorder lead time ${selectedVariant.backorderLeadDays} days.`
                : '.'}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-3 rounded-xl border border-border/80 bg-surface-soft p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">Bag format</p>
          <p className="mt-1 text-muted-foreground">{packSize ?? 'Sack'}</p>
        </div>
        <div>
          <p className="font-semibold">Handling</p>
          <p className="mt-1 text-muted-foreground">Palletised, shrink-wrapped, batch-labelled.</p>
        </div>
      </div>
      {consumptionLabel && (
        <p
          role="note"
          className="mt-4 rounded-lg border border-sale/40 bg-sale/10 px-4 py-3 text-sm font-semibold text-foreground"
        >
          {consumptionLabel}
        </p>
      )}

      <ul
        aria-label="Shopping details"
        className="mt-5 grid gap-2 text-sm font-medium text-muted-foreground"
      >
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          Lines held in your order for this session
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          Adjust pallet quantities before checkout
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          Simulated payment, no charge
        </li>
      </ul>

      <div className="mt-6 rounded-xl bg-surface-soft p-4">
        <p
          className={
            baseAvail === 'in_stock' || baseAvail === 'low_stock'
              ? 'font-semibold text-success'
              : baseAvail === 'backorder'
                ? 'font-semibold text-amber-700'
                : 'font-semibold text-destructive'
          }
        >
          {baseAvail === 'in_stock'
            ? 'In stock'
            : baseAvail === 'low_stock'
              ? 'Low stock'
              : baseAvail === 'backorder'
                ? 'Available to backorder'
                : 'Out of stock'}
        </p>
        {selectedVariant && variantIsPurchasable(selectedVariant) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedVariant.stockCount > 0
              ? `${selectedVariant.stockCount} items available`
              : `Backorder (${selectedVariant.backorderLeadDays ?? '?'} days lead)`}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={!isCartAvailable || allUnavailable || variantAddDisabled || isAdding}
          onClick={() => void handleAddToCart()}
        >
          {!isCartAvailable
            ? 'Cart unavailable'
            : isAdding
              ? 'Adding\u2026'
              : allUnavailable
                ? 'Unavailable'
                : !selectedVariantId
                  ? 'Choose a bag option'
                  : variantAddDisabled
                    ? 'Unavailable'
                    : 'Add to order'}
        </Button>
        <AddToListMenu
          variantId={selectedVariantId}
          quantity={hasValidQuantity ? parsedQuantity : 1}
        />
      </div>
      {selectedVariant && variantIsSoldOut(selectedVariant) && (
        <NotifyWhenAvailableButton variantId={selectedVariant.variantId} />
      )}
      <div className="mt-3">
        <CompareProductButton productId={product.id} productName={product.name} />
      </div>

      {(actionError || localError) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {localError ?? actionError}
        </p>
      )}
      {belowMoqError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {belowMoqError}
        </p>
      )}
      {cartError && onRetryCart && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={onRetryCart}>
            Retry cart
          </Button>
        </div>
      )}

      <dl className="mt-8 grid gap-4 border-t pt-6 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <dt className="font-semibold">Payment simulation</dt>
          <dd className="mt-1 text-muted-foreground">No card is charged or stored.</dd>
        </div>
        <div>
          <dt className="font-semibold">Delivery &amp; returns</dt>
          <dd className="mt-1 text-muted-foreground">No real fulfilment or returns in this demo</dd>
        </div>
      </dl>
    </aside>
  );
}
