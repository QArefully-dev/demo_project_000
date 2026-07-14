import { useState, useEffect, useCallback, useRef } from 'react';
import { getProducts } from '../api/products';
import type { Product, ProductQuery } from '@shop/contracts/products';
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

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable params object from destructured primitives — avoids new reference each render
  const stableParams: GetProductsParams = { q, category, onSale, sort, page, pageSize };

  const fetchProducts = useCallback(
    async (fetchParams?: GetProductsParams) => {
      if (!mountedRef.current) return;
      const requestId = ++requestIdRef.current;
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const isCurrentRequest = () =>
        mountedRef.current && requestId === requestIdRef.current && !abortController.signal.aborted;

      setIsLoading(true);
      setError(null);
      try {
        const data = await getProducts(fetchParams ?? stableParams, abortController.signal);
        if (!isCurrentRequest()) return;
        setProducts(data.items);
        setTotal(data.total);
        setCurrentPage(data.page);
        setCurrentPageSize(data.pageSize);
      } catch (err) {
        if (!isCurrentRequest()) return;
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        if (isCurrentRequest()) setIsLoading(false);
      }
    },
    [q, category, onSale, sort, page, pageSize],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchProducts();
    return () => {
      mountedRef.current = false;
      ++requestIdRef.current;
      abortControllerRef.current?.abort();
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
  };
}
