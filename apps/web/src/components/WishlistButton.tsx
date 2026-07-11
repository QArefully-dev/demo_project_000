import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { useFavourites } from '@/hooks/useFavourites';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
import type { Product } from '@shop/contracts';

interface WishlistButtonProps {
  /** When provided, renders as a heart toggle for this product. Otherwise renders as a header link to /wishlist. */
  productId?: string;
  /** Optional full product data for optimistic add. */
  product?: Product;
}

/**
 * Dual-purpose wishlist button:
 * - With productId: heart toggle for that product (optimistic, redirects anonymous to login).
 * - Without productId: header button linking to /wishlist with a favourites count badge.
 */
export function WishlistButton({ productId, product }: WishlistButtonProps) {
  const { user } = useAuth();
  const { favouriteIds, toggleFavourite } = useFavourites();
  const navigate = useNavigate();
  const location = useLocation();

  // Product-specific heart toggle
  if (productId) {
    const isFav = favouriteIds.has(productId);

    const handleClick = () => {
      if (!user) {
        navigate('/login', { state: { from: location.pathname } });
        return;
      }
      toggleFavourite(productId, product);
    };

    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        aria-label={isFav ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart className={cn('size-5 transition-colors', isFav && 'fill-red-500 text-red-500')} />
      </Button>
    );
  }

  // Header wishlist link with count
  const count = favouriteIds.size;

  return (
    <Link
      to="/wishlist"
      aria-label={`Wishlist${count > 0 ? ` (${count})` : ''}`}
      className="relative inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-muted hover:text-foreground size-8"
    >
      <Heart className="size-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
