import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { CartLineItem } from '@/components/CartLineItem';
import { formatMoney } from '@/lib/formatMoney';
import { useCartContext } from '@/hooks/CartContext';

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
      <h1 className="mb-6 text-2xl font-bold">Shopping Cart</h1>
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
      {!cart || cart.items.length === 0 ? (
        <div className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">Your cart is empty</p>
          <Button variant="outline" render={<Link to="/" />}>
            Continue Shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {cart.items.map((item) => (
            <CartLineItem
              key={item.productId}
              item={item}
              isUpdating={isActionPending(item.productId, 'update')}
              isRemoving={isActionPending(item.productId, 'remove')}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal ({cart.totalItems} items)</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" render={<Link to="/" />}>
              Continue Shopping
            </Button>
            <Button className="flex-1" render={<Link to="/checkout" />}>
              Checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
