import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';
import type { CartLine } from '@shop/contracts';

interface CartLineItemProps {
  item: CartLine;
  onUpdateQuantity: (productId: string, quantity: number) => Promise<boolean>;
  onRemove: (productId: string) => Promise<boolean>;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

export function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
  isUpdating = false,
  isRemoving = false,
}: CartLineItemProps) {
  const [imgError, setImgError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isPending = isUpdating || isRemoving;

  const updateQuantity = async (quantity: number) => {
    setActionError(null);
    if (!(await onUpdateQuantity(item.productId, quantity))) {
      setActionError('Quantity update failed. Try again.');
    }
  };

  const remove = async () => {
    setActionError(null);
    if (!(await onRemove(item.productId))) {
      setActionError('Remove failed. Try again.');
    }
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-16 w-16 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
        {imgError ? (
          <span className="text-muted-foreground text-xs">No image</span>
        ) : (
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium leading-tight">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">{formatMoney(item.product.priceCents)} each</p>
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
