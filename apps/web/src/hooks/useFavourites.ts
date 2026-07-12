import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getFavourites, addFavourite, removeFavourite } from '@/api/favourites';
import type { Product } from '@shop/contracts';

interface UseFavouritesResult {
  /** Full product objects for the wishlist page. */
  favourites: Product[];
  /** Set of favourite product IDs for quick heart-toggle lookup. */
  favouriteIds: Set<string>;
  /**
   * Toggle a product in/out of favourites.
   * @param productId the product ID to toggle
   * @param product optional full product for optimistic add to the favourites list
   */
  toggleFavourite: (productId: string, product?: Product) => void;
  /** True while initial fetch is loading. */
  loading: boolean;
  /** Remove a product from favourites (used on wishlist page to get full product removal). */
  removeProduct: (productId: string) => void;
}

/**
 * Manages the current user's favourites with optimistic updates.
 * On mount, if authenticated, fetches the full favourites list from the API.
 * If anonymous, returns an empty state.
 */
export function useFavourites(): UseFavouritesResult {
  const { user } = useAuth();
  const [favourites, setFavourites] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const previousProducts = useRef<Product[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setFavourites([]);
        setLoading(false);
        return;
      }
      try {
        const items = await getFavourites();
        if (!cancelled) {
          setFavourites(items);
        }
      } catch {
        if (!cancelled) {
          setFavourites([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const favouriteIds = new Set(favourites.map((p) => p.id));

  const toggleFavourite = useCallback(
    (productId: string, product?: Product) => {
      if (!user) return;

      const isFav = favouriteIds.has(productId);

      previousProducts.current = [...favourites];

      if (isFav) {
        // Optimistic remove
        setFavourites((prev) => prev.filter((p) => p.id !== productId));
        removeFavourite(productId).catch(() => {
          setFavourites(previousProducts.current);
        });
      } else {
        // Optimistic add
        if (product) {
          setFavourites((prev) => [...prev, product]);
        }
        addFavourite(productId).catch(() => {
          setFavourites(previousProducts.current);
        });
      }
    },
    [favourites, favouriteIds, user],
  );

  const removeProduct = useCallback(
    (productId: string) => {
      if (!user) return;
      previousProducts.current = [...favourites];
      setFavourites((prev) => prev.filter((p) => p.id !== productId));
      removeFavourite(productId).catch(() => {
        setFavourites(previousProducts.current);
      });
    },
    [favourites, user],
  );

  return { favourites, favouriteIds, toggleFavourite, loading, removeProduct };
}
