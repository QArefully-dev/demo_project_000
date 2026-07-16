import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CATALOG_DISCOVERY_PARAM_KEYS,
  type CatalogParamKey,
  type CatalogParamValue,
  parseCatalogQuery,
  serializeCatalogQuery,
} from '@/catalogQuery';

export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseCatalogQuery(searchParams);

  const setParam = useCallback(
    (key: CatalogParamKey, value: CatalogParamValue) =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete(key);
        if (value !== null) {
          const values = Array.isArray(value) ? value : [value];
          for (const item of values) next.append(key, item);
        }
        if (key !== 'page') next.delete('page');
        return serializeCatalogQuery(parseCatalogQuery(next));
      }),
    [setSearchParams],
  );
  const clearFilters = useCallback(
    () =>
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        [...CATALOG_DISCOVERY_PARAM_KEYS, 'page'].forEach((key) => next.delete(key));
        return serializeCatalogQuery(parseCatalogQuery(next));
      }),
    [setSearchParams],
  );

  return { ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 12, setParam, clearFilters };
}
