import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';
import type { Product } from '@shop/contracts';

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
  const [imgError, setImgError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inStock = product.stock > 0;

  const handleAddToCart = async () => {
    setActionError(null);
    const added = await onAddToCart(product.id);
    if (!added) setActionError('Could not add this item. Try again.');
  };

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="aspect-square bg-muted flex items-center justify-center">
        {imgError ? (
          <span className="text-muted-foreground text-sm">No image</span>
        ) : (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{product.name}</h3>
          <Badge variant="secondary" className="shrink-0">
            {product.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-lg font-bold">{formatMoney(product.priceCents)}</span>
          <span className={`text-xs ${inStock ? 'text-green-600' : 'text-destructive'}`}>
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <div className="w-full space-y-2">
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
