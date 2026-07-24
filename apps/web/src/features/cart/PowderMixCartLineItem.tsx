import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import type { PowderMixCartItem } from '@shop/contracts/powderizer';
import { BagArtwork } from '@/components/BagArtwork';
import { Button } from '@/components/ui/button';
import { powderMixBagSchemePresentation } from '@/components/powderMixBagScheme';
import { formatMoney } from '@/lib/formatMoney';

type PowderMixCartLineItemProps = {
  item: PowderMixCartItem;
  onUpdateQuantity: (mixId: string, quantity: number) => Promise<boolean>;
  onRemove: (mixId: string) => Promise<boolean>;
  isUpdating?: boolean;
  isRemoving?: boolean;
};

function mixName(item: PowderMixCartItem): string {
  return item.customLabel ?? 'Custom small order';
}

export function PowderMixCartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
  isUpdating = false,
  isRemoving = false,
}: PowderMixCartLineItemProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const isPending = isUpdating || isRemoving;
  const scheme = powderMixBagSchemePresentation(item.bagColourScheme);

  useEffect(() => setActionError(null), [item.mixId]);

  const updateQuantity = async (quantity: number) => {
    setActionError(null);
    if (!(await onUpdateQuantity(item.mixId, quantity)))
      setActionError('Quantity update failed. Try again.');
  };
  const remove = async () => {
    setActionError(null);
    if (!(await onRemove(item.mixId))) setActionError('Remove failed. Try again.');
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        <BagArtwork
          name={mixName(item)}
          category="Custom mix"
          quantity={`${item.bagSizeGrams}g`}
          batchCode={item.priceVersion}
          mark="MIX"
          paint={scheme.paint}
          powderAccent={scheme.paint.colors[1]}
          consumptionLabel={null}
          ariaLabel=""
          className="h-full w-full"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium leading-tight">{mixName(item)}</p>
        <p className="text-xs text-muted-foreground">
          {item.components
            .map(({ productName, percentage }) => `${productName} ${percentage}%`)
            .join(' · ')}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.bagSizeGrams}g · {item.fineness}
        </p>
        <p className="text-xs text-muted-foreground">{scheme.label}</p>
        <p className="text-xs font-medium">{item.usageLabel}</p>
        <div className="mt-1 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label={`Decrease ${mixName(item)} quantity`}
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
            aria-label={`Increase ${mixName(item)} quantity`}
            disabled={isPending}
            onClick={() => void updateQuantity(item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Link
            className="text-xs text-primary underline-offset-4 hover:underline"
            to={`/custom-powder?edit=${item.mixId}`}
          >
            Edit
          </Link>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold">{formatMoney(item.lineTotalCents)}</span>
        <span className="text-xs text-muted-foreground">
          {formatMoney(item.unitPriceCents)} each
        </span>
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
