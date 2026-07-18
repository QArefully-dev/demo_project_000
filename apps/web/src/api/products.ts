import { apiFetch } from './client';
import {
  ProductListPaginatedResponse,
  ProductDetailResponse,
  CategoriesResponse,
  BestsellersResponse,
  ProductComparisonResponse,
  RelatedResponse,
  SimilarProductsResponse,
  ProductFilterOptionsResponse,
} from '@shop/contracts/products';
import type { ProductQuery } from '@shop/contracts/products';
import { serializeCatalogQuery } from '@/catalogQuery';

/**
 * Products API module.
 * W1.B: paginated list with query params, single product, categories, bestsellers, related.
 */

export type GetProductsParams = ProductQuery;

export function getProducts(
  params?: GetProductsParams,
  signal?: AbortSignal,
): Promise<ProductListPaginatedResponse> {
  const qs = serializeCatalogQuery(params).toString();
  return apiFetch(ProductListPaginatedResponse, `/api/products${qs ? `?${qs}` : ''}`, { signal });
}

export function getProduct(id: string): Promise<ProductDetailResponse> {
  return apiFetch(ProductDetailResponse, `/api/products/${id}`);
}

export function getCategories(): Promise<CategoriesResponse> {
  return apiFetch(CategoriesResponse, '/api/products/categories');
}

export function getBestsellers(): Promise<BestsellersResponse> {
  return apiFetch(BestsellersResponse, '/api/products/bestsellers');
}

export function getRelatedProducts(id: string): Promise<RelatedResponse> {
  return apiFetch(RelatedResponse, `/api/products/${id}/related`);
}

/** Fetch deterministic, metadata-based alternatives for a product. */
export function getSimilarProducts(
  id: string,
  signal?: AbortSignal,
): Promise<SimilarProductsResponse> {
  return apiFetch(SimilarProductsResponse, `/api/products/${id}/similar`, { signal });
}

/** Fetches an ordered comparison without changing the caller's selection order. */
export function getProductComparison(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<ProductComparisonResponse> {
  const params = new URLSearchParams({ ids: ids.join(',') });
  return apiFetch(ProductComparisonResponse, `/api/products/compare?${params.toString()}`, {
    signal,
  });
}

export function getProductFilterOptions(
  signal?: AbortSignal,
): Promise<ProductFilterOptionsResponse> {
  return apiFetch(ProductFilterOptionsResponse, '/api/products/filter-options', { signal });
}
