import { useState, useEffect, useCallback } from 'react';
import { getCategories } from '../api/products';

/**
 * Fetches distinct, sorted category names from the API.
 * Does not include "All" — that label lives in the UI layer.
 */
export function useCategories(): {
  categories: string[];
  isLoading: boolean;
  error: string | null;
} {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  return { categories, isLoading, error };
}
