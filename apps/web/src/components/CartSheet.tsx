import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { CartLineItem } from './CartLineItem';
import { PowderMixCartLineItem } from '@/features/cart/PowderMixCartLineItem';
import { formatMoney } from '@/lib/formatMoney';
import { useCartContext } from '@/hooks/CartContext';
import { Link } from 'react-router-dom';

function cartItemKey(item: { productId: string; variantSnap?: { variantId: number } }): string {
  return `${item.productId}:${item.variantSnap?.variantId ?? 'no-variant'}`;
}

function deliveryLabel(mode: string): string {
  return mode === 'freight' ? 'Freight' : 'Parcel';
}

export function CartSheet() {
  const [open, setOpen] = useState(false);
  const {
    cart,
    isLoading,
    isInitializing,
    error,
    updateQuantity,
    removeItem,
    updateMixQuantity,
    removeMix,
    retryCart,
    isActionPending,
  } = useCartContext();
  const itemCount = cart?.totalItems ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" className="relative" />}
        aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
      >
        Cart
        {isInitializing && (
          <span className="ml-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        {!isInitializing && itemCount > 0 && (
          <span
            aria-label={`${itemCount} items in cart`}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
          >
            {itemCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:w-auto">
        <SheetHeader>
          <SheetTitle>Powder cart ({itemCount} bags)</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {isInitializing && <LoadingSpinner />}
          {!isInitializing && isLoading && <LoadingSpinner />}
          {!isInitializing && !isLoading && error && !cart && (
            <ErrorMessage message={error} onRetry={() => void retryCart()} />
          )}
          {!isInitializing && !isLoading && error && cart && (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
            >
              <p className="text-xs text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void retryCart()}>
                Retry
              </Button>
            </div>
          )}
          {!isInitializing && !isLoading && cart && cart.totalItems === 0 && (
            <p className="py-8 text-center text-muted-foreground">Your powder cart is empty</p>
          )}
          {!isInitializing &&
            !isLoading &&
            cart &&
            cart.items.map((item) => (
              <CartLineItem
                key={cartItemKey(item)}
                item={item}
                isUpdating={isActionPending(item.productId, 'update')}
                isRemoving={isActionPending(item.productId, 'remove')}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          {!isInitializing &&
            !isLoading &&
            cart &&
            cart.mixItems.map((item) => (
              <PowderMixCartLineItem
                key={item.mixId}
                item={item}
                isUpdating={isActionPending(`mix:${item.mixId}`, 'mix-update')}
                isRemoving={isActionPending(`mix:${item.mixId}`, 'mix-remove')}
                onUpdateQuantity={updateMixQuantity}
                onRemove={removeMix}
              />
            ))}
        </div>
        {!isInitializing && cart && cart.totalItems > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            {cart.deliveryPreview && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{deliveryLabel(cart.deliveryPreview.mode)} delivery</span>
                <span>
                  {cart.deliveryPreview.chargeCents === 0
                    ? 'Free'
                    : formatMoney(cart.deliveryPreview.chargeCents)}
                </span>
              </div>
            )}
            <Separator />
            <Button
              className="w-full"
              variant="outline"
              render={<Link to="/cart" onClick={() => setOpen(false)} />}
            >
              View Full Cart
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
