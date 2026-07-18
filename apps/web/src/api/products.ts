import { apiFetch } from './client';
import {
  ProductListPaginatedResponse,
  ProductDetailResponse,
  CategoriesResponse,
  BestsellersResponse,
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

export function getProductFilterOptions(
  signal?: AbortSignal,
): Promise<ProductFilterOptionsResponse> {
  return apiFetch(ProductFilterOptionsResponse, '/api/products/filter-options', { signal });
}
