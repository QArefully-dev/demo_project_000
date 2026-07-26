import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/formatMoney';
import type { CartLine } from '@shop/contracts/cart';
import { ProductMedia } from '@/components/ProductMedia';
import {
  CUSTOM_BLEND_MADE_TO_ORDER_NOTE,
  CustomBlendPackaging,
  customBlendCompositionLabel,
} from '@/features/customBlend/CustomBlendPackaging';

interface CartLineItemProps {
  item: CartLine;
  onUpdateQuantity: (
    productId: string,
    quantity: number,
    variantId?: number,
    configKey?: string,
  ) => Promise<boolean>;
  onRemove: (productId: string, variantId?: number, configKey?: string) => Promise<boolean>;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

/**
 * Several configured lines can share one base variant, so line identity carries the config key.
 * Plain lines keep the historic empty key and therefore the historic identity.
 */
function cartLineKey(item: CartLine): string {
  return `${item.productId}:${item.variantSnap?.variantId ?? 'no-variant'}:${item.configKey}`;
}

/** `undefined` for plain lines keeps the pre-blend call shape of the cart mutations. */
function mutationConfigKey(item: CartLine): string | undefined {
  return item.configKey === '' ? undefined : item.configKey;
}

function editBlendHref(item: CartLine, baseVariantId: number): string {
  return `/custom-blend?baseVariantId=${baseVariantId}&editConfigKey=${item.configKey}`;
}

export function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
  isUpdating = false,
  isRemoving = false,
}: CartLineItemProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const isPending = isUpdating || isRemoving;
  const lineKey = cartLineKey(item);

  useEffect(() => {
    setActionError(null);
  }, [lineKey]);

  const configKey = mutationConfigKey(item);
  const blend = item.customBlend;
  const baseVariantId = item.variantSnap?.variantId;

  const updateQuantity = async (quantity: number) => {
    setActionError(null);
    if (!(await onUpdateQuantity(item.productId, quantity, baseVariantId, configKey))) {
      setActionError('Quantity update failed. Try again.');
    }
  };

  const remove = async () => {
    setActionError(null);
    if (!(await onRemove(item.productId, baseVariantId, configKey))) {
      setActionError('Remove failed. Try again.');
    }
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-16 w-16 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
        {blend ? (
          <CustomBlendPackaging
            product={item.product}
            variant={item.variantSnap}
            blend={blend}
            className="h-full w-full object-cover"
          />
        ) : (
          <ProductMedia product={item.product} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium leading-tight">
          {item.product.name}
          {item.variantSnap && (
            <span className="text-muted-foreground"> &mdash; {item.variantSnap.label}</span>
          )}
        </p>
        {item.variantSnap && (
          <p className="text-xs text-muted-foreground">
            SKU: {item.variantSnap.sku}
            <span className="mx-1.5">·</span>
            {item.variantSnap.weightGrams}g
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Resolved pack price: {formatMoney(item.resolvedUnitPriceCents)}
        </p>
        {blend && (
          <div className="grid gap-0.5" data-testid="cart-line-custom-blend">
            <Badge variant="outline" className="w-fit text-[10px]">
              Custom blend
            </Badge>
            <p className="break-words text-xs text-muted-foreground">
              {customBlendCompositionLabel(item.product.name, blend)}
            </p>
            <p className="text-xs text-muted-foreground">
              Base material: {formatMoney(item.materialSubtotalCents)}
            </p>
            <p className="text-xs text-muted-foreground">
              Blending fee: {formatMoney(item.blendingFeeCents)}
            </p>
            {/*
             * Non-returnable status has to be visible where the line is first held, not first at
             * checkout. Rendering it here covers CartPage and CartSheet from the one line component.
             */}
            <p
              data-testid="cart-line-made-to-order"
              className="w-fit rounded-md border border-amber-500/40 bg-amber-50 px-2 py-1 text-xs text-amber-900"
            >
              {CUSTOM_BLEND_MADE_TO_ORDER_NOTE}
            </p>
            {baseVariantId !== undefined && (
              <Link
                to={editBlendHref(item, baseVariantId)}
                className="w-fit text-xs font-medium underline underline-offset-2"
              >
                Edit blend
              </Link>
            )}
          </div>
        )}
        {item.variantSnap && (
          <Badge variant="outline" className="w-fit text-[10px]">
            {item.variantSnap.deliveryClass}
          </Badge>
        )}
        {item.product.availability === 'backorder' && (
          <p className="text-xs font-medium text-amber-700">
            Available to backorder. Checkout confirms availability.
          </p>
        )}
        {item.product.availability === 'out_of_stock' && (
          <p className="text-xs font-medium text-destructive">
            Currently out of stock. Checkout confirms availability.
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Decrease quantity"
            disabled={item.quantity <= 1 || isPending}
            onClick={() => void updateQuantity(item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm" aria-live="polite">
            {item.quantity}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Increase quantity"
            disabled={isPending}
            onClick={() => void updateQuantity(item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold">{formatMoney(item.lineTotalCents)}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => void remove()}
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </Button>
        {actionError && (
          <p role="alert" className="max-w-36 text-right text-xs text-destructive">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}
