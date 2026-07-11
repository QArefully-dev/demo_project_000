import { useState, useEffect, useCallback, useRef } from 'react';
import { getProducts } from '../api/products';
import type { Product, ProductQuery } from '@shop/contracts';
import type { GetProductsParams } from '../api/products';

export interface UseProductsParams {
  q?: string;
  category?: string;
  onSale?: boolean;
  sort?: ProductQuery['sort'];
  page?: number;
  pageSize?: number;
}

export function useProducts(params?: UseProductsParams) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(params?.page ?? 1);
  const [currentPageSize, setCurrentPageSize] = useState(params?.pageSize ?? 12);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const fetchProducts = useCallback(
    async (fetchParams?: GetProductsParams) => {
      if (!mountedRef.current) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getProducts(fetchParams ?? params);
        if (!mountedRef.current) return;
        setProducts(data.items);
        setTotal(data.total);
        setCurrentPage(data.page);
        setCurrentPageSize(data.pageSize);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [params],
  );

  // Debounced fetch for search queries
  const debouncedFetch = useCallback(
    (fetchParams: GetProductsParams) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void fetchProducts(fetchParams);
      }, 300);
    },
    [fetchProducts],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchProducts(params);
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    fetchProducts,
    params?.q,
    params?.category,
    params?.onSale,
    params?.sort,
    params?.page,
    params?.pageSize,
  ]);

  return {
    products,
    isLoading,
    error,
    total,
    currentPage,
    currentPageSize,
    refetch: () => fetchProducts(params),
    debouncedFetch,
  };
}
