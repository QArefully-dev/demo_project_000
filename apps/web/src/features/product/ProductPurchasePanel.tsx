import type { Product } from '@shop/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WishlistButton } from '@/components/WishlistButton';
import { formatMoney } from '@/lib/formatMoney';

interface ProductPurchasePanelProps {
  product: Product;
  isCartAvailable: boolean;
  isAdding: boolean;
  actionError: string | null;
  cartError: string | null;
  onAddToCart: () => void;
  onRetryCart: () => void;
}

export function ProductPurchasePanel({
  product,
  isCartAvailable,
  isAdding,
  actionError,
  cartError,
  onAddToCart,
  onRetryCart,
}: ProductPurchasePanelProps) {
  const inStock = product.stock > 0;
  const isOnSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents;
  const savings = isOnSale ? product.compareAtPriceCents! - product.priceCents : 0;

  return (
    <aside className="self-start rounded-2xl border bg-surface-raised p-6 shadow-sm lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto xl:p-8">
      <p className="section-eyebrow">{product.category}</p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {product.name}
        </h1>
        {isOnSale && <Badge className="bg-sale text-sale-foreground">Sale</Badge>}
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {formatMoney(product.priceCents)}
        </span>
        {isOnSale && (
          <>
            <span className="text-lg text-muted-foreground line-through">
              {formatMoney(product.compareAtPriceCents!)}
            </span>
            <span className="text-sm font-semibold text-sale">Save {formatMoney(savings)}</span>
          </>
        )}
      </div>

      <p className="mt-6 leading-7 text-muted-foreground">{product.description}</p>

      <div className="mt-6 rounded-xl bg-surface-soft p-4">
        <p className={inStock ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
          {inStock ? 'In stock' : 'Out of stock'}
        </p>
        {inStock && (
          <p className="mt-1 text-sm text-muted-foreground">
            {product.stock === 1 ? '1 item available' : `${product.stock} items available`}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={!isCartAvailable || !inStock || isAdding}
          onClick={onAddToCart}
        >
          {!isCartAvailable
            ? 'Cart unavailable'
            : isAdding
              ? 'Adding…'
              : inStock
                ? 'Add to cart'
                : 'Unavailable'}
        </Button>
        <div className="rounded-lg border bg-background" title="Add to wishlist">
          <WishlistButton productId={product.id} product={product} />
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {cartError && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={onRetryCart}>
            Retry cart
          </Button>
        </div>
      )}

      <dl className="mt-8 grid gap-4 border-t pt-6 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <dt className="font-semibold">Checkout</dt>
          <dd className="mt-1 text-muted-foreground">Secure simulated payment</dd>
        </div>
        <div>
          <dt className="font-semibold">Order status</dt>
          <dd className="mt-1 text-muted-foreground">Tracked in your demo account</dd>
        </div>
      </dl>
    </aside>
  );
}
