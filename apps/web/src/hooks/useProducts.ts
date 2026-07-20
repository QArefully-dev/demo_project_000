import { useState, useEffect, useCallback, useRef } from 'react';
import { getProducts } from '../api/products';
import type { VariantProductList } from '../api/products';
import type { GetProductsParams } from '../api/products';
import { serializeCatalogQuery } from '@/catalogQuery';

export type UseProductsParams = GetProductsParams;

export function useProducts(params?: UseProductsParams) {
  const paramsKey = serializeCatalogQuery(params).toString();
  const [products, setProducts] = useState<VariantProductList['items']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(params?.page ?? 1);
  const [currentPageSize, setCurrentPageSize] = useState(params?.pageSize ?? 12);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        const data = await getProducts(fetchParams ?? params, abortController.signal);
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
    [paramsKey],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchProducts();
    return () => {
      mountedRef.current = false;
      ++requestIdRef.current;
      abortControllerRef.current?.abort();
    };
  }, [fetchProducts]);

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
