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
  const q = params?.q;
  const category = params?.category;
  const onSale = params?.onSale;
  const sort = params?.sort;
  const page = params?.page;
  const pageSize = params?.pageSize;

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(page ?? 1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize ?? 12);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // Stable params object from destructured primitives — avoids new reference each render
  const stableParams: GetProductsParams = { q, category, onSale, sort, page, pageSize };

  const fetchProducts = useCallback(
    async (fetchParams?: GetProductsParams) => {
      if (!mountedRef.current) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getProducts(fetchParams ?? stableParams);
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
    [q, category, onSale, sort, page, pageSize],
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
    void fetchProducts();
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, category, onSale, sort, page, pageSize]);

  return {
    products,
    isLoading,
    error,
    total,
    currentPage,
    currentPageSize,
    refetch: () => fetchProducts(),
    debouncedFetch,
  };
}
