import { useFavourites } from '@/hooks/useFavourites';
import { useCartContext } from '@/hooks/CartContext';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductCard } from '@/components/ProductCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Wishlist page — displays the current user's favourite products. */
export function WishlistPage() {
  const { favourites, loading, removeProduct } = useFavourites();
  const {
    error: cartError,
    addItem,
    retryCart,
    isCartAvailable,
    isActionPending,
  } = useCartContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Wishlist</h1>
        {favourites.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {favourites.length} {favourites.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {favourites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Heart className="mb-4 size-12 text-muted-foreground/50" />
          <p className="text-lg text-muted-foreground">Your wishlist is empty.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the{' '}
            <Link to="/catalog" className="text-primary underline hover:no-underline">
              catalog
            </Link>{' '}
            and heart items to save them here.
          </p>
        </div>
      ) : (
        <ProductGrid>
          {favourites.map((product) => (
            <div key={product.id} className="group relative">
              <ProductCard
                product={product}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(product.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
              {/* Remove from wishlist overlay */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove from wishlist"
                onClick={() => removeProduct(product.id)}
              >
                <Heart className="size-4 fill-red-500 text-red-500" />
              </Button>
            </div>
          ))}
        </ProductGrid>
      )}

      {cartError && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3"
        >
          <p className="text-sm text-destructive">{cartError}</p>
          <Button variant="outline" size="sm" onClick={() => void retryCart()}>
            Retry Cart
          </Button>
        </div>
      )}
    </div>
  );
}
