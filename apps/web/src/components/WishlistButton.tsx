import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFavourites } from '@/api/favourites';
import { useAuth } from '@/hooks/AuthContext';

/**
 * Wishlist button with real count from the favourites API.
 * Shows the number of favourited items as a badge when authenticated.
 * Falls back to a disabled placeholder for anonymous visitors.
 */
export function WishlistButton() {
  const { user, loading: authLoading } = useAuth();
  const [count, setCount] = useState(0);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!user || authLoading) {
      setCount(0);
      setFetchError(false);
      return;
    }

    let cancelled = false;

    async function loadCount() {
      try {
        const favourites = await getFavourites();
        if (!cancelled) {
          setCount(Array.isArray(favourites) ? favourites.length : 0);
          setFetchError(false);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
          setFetchError(true);
        }
      }
    }

    void loadCount();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        render={<Link to="/login" />}
        aria-label="Wishlist — sign in to view"
      >
        <Heart className="size-4" />
        <span className="ml-1 hidden sm:inline">Wishlist</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      render={<Link to="/wishlist" />}
      aria-label={`Wishlist — ${fetchError ? 'error loading count' : `${count} items`}`}
    >
      <Heart className="size-4" />
      <span className="ml-1 hidden sm:inline">Wishlist</span>
      {!fetchError && count > 0 && (
        <span
          aria-label={`${count} items in wishlist`}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Button>
  );
}
