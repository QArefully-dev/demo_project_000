import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProductQuery } from '@shop/contracts/products';
import { PAGE_SIZES, SORT_OPTIONS } from './catalogOptions';

export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const onSale = searchParams.get('onSale') === 'true' || undefined;
  const candidate = searchParams.get('sort') as ProductQuery['sort'] | null;
  const sort = SORT_OPTIONS.some((option) => option.value === candidate)
    ? (candidate ?? undefined)
    : undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSizeValue = Number(searchParams.get('pageSize'));
  const pageSize = PAGE_SIZES.includes(pageSizeValue) ? pageSizeValue : 12;

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value === null) next.delete(key);
        else next.set(key, value);
        if (key !== 'page') next.delete('page');
        return next;
      }),
    [setSearchParams],
  );
  const clearFilters = useCallback(
    () =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        ['q', 'category', 'onSale', 'page'].forEach((key) => next.delete(key));
        return next;
      }),
    [setSearchParams],
  );

  return { q, category, onSale, sort, page, pageSize, setParam, clearFilters };
}
