import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WishlistButton } from '@/components/WishlistButton';
import { formatMoney } from '@/lib/formatMoney';
import type { Product } from '@shop/contracts/products';
import { ProductMedia } from '@/components/ProductMedia';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => Promise<boolean>;
  isCartAvailable: boolean;
  isAdding?: boolean;
  comparisonControl?: ReactNode;
}

export function ProductCard({
  product,
  onAddToCart,
  isCartAvailable,
  isAdding = false,
  comparisonControl,
}: ProductCardProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const inStock = product.availability === 'in_stock';
  const backorder = product.availability === 'backorder';
  const purchasable = inStock || backorder;
  const isOnSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents;
  const isBestseller = product.salesCount >= 250;
  const packSize = product.packaging?.quantity;

  useEffect(() => {
    setActionError(null);
  }, [product.id]);

  const handleAddToCart = async () => {
    setActionError(null);
    const added = await onAddToCart(product.id);
    if (!added) setActionError('Could not add this item. Try again.');
  };

  return (
    <Card className="group flex h-full flex-col gap-0 overflow-hidden border-border/80 bg-surface-raised py-0 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-4/5 overflow-hidden bg-surface-soft">
        <Link
          to={`/products/${product.id}`}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ProductMedia
            product={product}
            className="h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.035] sm:p-5"
          />
        </Link>
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
          {isOnSale && <Badge className="bg-sale px-2.5 text-sale-foreground">Sale</Badge>}
          {isBestseller && (
            <Badge
              variant="secondary"
              className="border-primary/10 bg-background/95 px-2.5 text-primary shadow-sm"
            >
              Bestseller
            </Badge>
          )}
        </div>
        <div className="absolute top-2 right-2 rounded-full bg-background/90 shadow-sm backdrop-blur-sm">
          <WishlistButton productId={product.id} product={product} />
        </div>
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-4 sm:p-5 sm:pt-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Powder type: {product.category}
        </p>
        <h3 className="line-clamp-2 min-h-11 text-base font-semibold leading-[1.35] tracking-tight">
          <Link
            to={`/products/${product.id}`}
            className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {product.name}
          </Link>
        </h3>
        {packSize && <p className="text-xs text-muted-foreground">Pack: {packSize}</p>}
        <div className="mt-auto pt-2">
          <div className="flex flex-wrap items-baseline gap-2">
            {isOnSale ? (
              <>
                <span className="price-current text-sale">{formatMoney(product.priceCents)}</span>
                <span className="price-compare">{formatMoney(product.compareAtPriceCents!)}</span>
              </>
            ) : (
              <span className="price-current">{formatMoney(product.priceCents)}</span>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent p-4 pt-0 sm:px-5 sm:pb-5">
        <div className="w-full space-y-2">
          {backorder && (
            <p className="text-xs font-medium text-amber-700">Available to backorder</p>
          )}
          {!purchasable && <p className="text-xs font-medium text-destructive">Out of stock</p>}
          {inStock && product.stock <= 5 && (
            <p className="text-xs font-medium text-sale">Only {product.stock} left</p>
          )}
          <Button
            className="w-full"
            disabled={!isCartAvailable || !purchasable || isAdding}
            onClick={() => {
              void handleAddToCart();
            }}
          >
            {!isCartAvailable
              ? 'Cart unavailable'
              : isAdding
                ? 'Adding...'
                : purchasable
                  ? 'Add powder'
                  : 'Unavailable'}
          </Button>
          {comparisonControl}
          {actionError && (
            <p role="alert" className="text-center text-xs text-destructive">
              {actionError}
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
