import { useMemo } from 'react';
import type { Product } from '@shop/contracts';

/**
 * Derives distinct, sorted category names from a product list.
 * Does not include "All" — that label lives in the UI layer.
 */
export function useCategories(products: Product[]): string[] {
  return useMemo(() => {
    const categories = new Set(products.map((p) => p.category));
    return Array.from(categories).sort();
  }, [products]);
}
