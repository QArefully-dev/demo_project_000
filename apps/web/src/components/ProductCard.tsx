import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WishlistButton } from '@/components/WishlistButton';
import { formatMoney } from '@/lib/formatMoney';
import type { Product } from '@shop/contracts';
import { ProductMedia } from '@/components/ProductMedia';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => Promise<boolean>;
  isCartAvailable: boolean;
  isAdding?: boolean;
}

export function ProductCard({
  product,
  onAddToCart,
  isCartAvailable,
  isAdding = false,
}: ProductCardProps) {
  const [, setImgError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inStock = product.stock > 0;
  const isOnSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents;
  const isBestseller = product.salesCount >= 250;

  useEffect(() => {
    setImgError(false);
    setActionError(null);
  }, [product.id]);

  const handleAddToCart = async () => {
    setActionError(null);
    const added = await onAddToCart(product.id);
    if (!added) setActionError('Could not add this item. Try again.');
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/80 bg-surface-raised py-0 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-surface-soft flex items-center justify-center">
        <Link
          to={`/products/${product.id}`}
          className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ProductMedia
            product={product}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.035]"
            onError={() => setImgError(true)}
          />
        </Link>
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {isOnSale && (
            <Badge className="border-transparent bg-sale text-xs text-sale-foreground">Sale</Badge>
          )}
          {isBestseller && (
            <Badge
              variant="secondary"
              className="border-primary/10 bg-background/90 text-xs text-primary"
            >
              Bestseller
            </Badge>
          )}
        </div>
        {/* Wishlist heart toggle */}
        <div className="absolute top-1 right-1">
          <WishlistButton productId={product.id} product={product} />
        </div>
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4 pb-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {product.category}
        </p>
        <h3 className="line-clamp-2 min-h-10 font-semibold leading-5">
          <Link
            to={`/products/${product.id}`}
            className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto pt-2">
          <div className="flex flex-wrap items-baseline gap-2">
            {isOnSale ? (
              <>
                <span className="price-current text-sale">{formatMoney(product.priceCents)}</span>
                <span className="text-sm text-muted-foreground line-through">
                  {formatMoney(product.compareAtPriceCents!)}
                </span>
              </>
            ) : (
              <span className="price-current">{formatMoney(product.priceCents)}</span>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <div className="w-full space-y-2">
          {!inStock && <p className="text-xs font-medium text-destructive">Out of stock</p>}
          {inStock && product.stock <= 5 && (
            <p className="text-xs font-medium text-sale">Only {product.stock} left</p>
          )}
          <Button
            className="w-full"
            disabled={!isCartAvailable || !inStock || isAdding}
            onClick={() => {
              void handleAddToCart();
            }}
          >
            {!isCartAvailable
              ? 'Cart Unavailable'
              : isAdding
                ? 'Adding...'
                : inStock
                  ? 'Add to Cart'
                  : 'Unavailable'}
          </Button>
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
