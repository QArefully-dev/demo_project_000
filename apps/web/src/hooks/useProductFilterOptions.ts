import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductFilterOptions } from '@/api/products';
import type { ProductFilterOptionsResponse } from '@shop/contracts/products';

export function useProductFilterOptions() {
  const [options, setOptions] = useState<ProductFilterOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProductFilterOptions(controller.signal);
      if (!controller.signal.aborted) setOptions(response);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Failed to load catalog filter options');
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    return () => controllerRef.current?.abort();
  }, [refetch]);

  return { options, isLoading, error, refetch };
}
