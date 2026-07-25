import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { CartLineItem } from './CartLineItem';
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
          <SheetTitle>Order ({itemCount} units)</SheetTitle>
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
            <p className="py-8 text-center text-muted-foreground">Your order is empty</p>
          )}
          {!isInitializing &&
            !isLoading &&
            cart &&
            cart.items.map((item) => (
              <div key={cartItemKey(item)}>
                <CartLineItem
                  item={item}
                  isUpdating={isActionPending(
                    item.productId,
                    'update',
                    item.variantSnap?.variantId,
                  )}
                  isRemoving={isActionPending(
                    item.productId,
                    'remove',
                    item.variantSnap?.variantId,
                  )}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
                {item.variantSnap && (
                  <p className="-mt-1 pb-3 text-xs text-muted-foreground">
                    {formatMoney(item.perTonneCents)} / tonne · {item.variantSnap.weightGrams}g pack
                  </p>
                )}
              </div>
            ))}
        </div>
        {!isInitializing && cart && cart.totalItems > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Resolved order subtotal</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            {cart.deliveryPreview && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {deliveryLabel(cart.deliveryPreview.mode) === 'Freight'
                      ? 'Pallet freight'
                      : 'Parcel delivery'}
                  </span>
                  <span>
                    {cart.deliveryPreview.chargeCents === 0
                      ? 'Free'
                      : formatMoney(cart.deliveryPreview.chargeCents)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total order weight: {cart.deliveryPreview.weightGrams.toLocaleString()}g
                </p>
              </>
            )}
            <Separator />
            <Button
              className="w-full"
              variant="outline"
              nativeButton={false}
              render={<Link to="/cart" onClick={() => setOpen(false)} />}
            >
              Review order
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
