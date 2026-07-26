import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { CartLineItem } from '@/components/CartLineItem';
import { formatMoney } from '@/lib/formatMoney';
import { useCartContext } from '@/hooks/CartContext';
import { cartItemKey, pendingConfigKey } from '@/lib/cartLineIdentity';

function deliveryLabel(mode: string): string {
  return mode === 'freight' ? 'Freight' : 'Parcel';
}

export function CartPage() {
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

  if (isInitializing || isLoading) return <LoadingSpinner />;
  if (error && !cart) return <ErrorMessage message={error} onRetry={() => void retryCart()} />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Your pallet order</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Lines held in your order for this session. Adjust pallet quantities before checkout.
      </p>
      {error && cart && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry Cart
          </Button>
        </div>
      )}
      {!cart || cart.totalItems === 0 ? (
        <div className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">Your order is empty</p>
          <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
            Browse materials
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {cart.items.map((item) => (
            <div key={cartItemKey(item)}>
              <CartLineItem
                item={item}
                isUpdating={isActionPending(
                  item.productId,
                  'update',
                  item.variantSnap?.variantId,
                  pendingConfigKey(item),
                )}
                isRemoving={isActionPending(
                  item.productId,
                  'remove',
                  item.variantSnap?.variantId,
                  pendingConfigKey(item),
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
          <Separator className="my-4" />
          <div className="space-y-2">
            {cart.blendingFeeTotalCents > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Material subtotal</span>
                  <span>{formatMoney(cart.discountableSubtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Blending fees</span>
                  <span>{formatMoney(cart.blendingFeeTotalCents)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Resolved order subtotal ({cart.totalItems} units)
              </span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            {cart.deliveryPreview && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {deliveryLabel(cart.deliveryPreview.mode) === 'Freight'
                      ? 'Pallet freight scheduled after order confirmation'
                      : 'Parcel delivery'}
                    {' · '}
                    {cart.deliveryPreview.reason}
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
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              nativeButton={false}
              render={<Link to="/" />}
            >
              Continue sourcing
            </Button>
            <Button className="flex-1" nativeButton={false} render={<Link to="/checkout" />}>
              Continue to checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
