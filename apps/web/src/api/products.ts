import { apiFetch } from './client';
import type {
  ProductListPaginatedResponse,
  ProductDetailResponse,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
} from '@shop/contracts';

/**
 * Products API module.
 * Wave 0: uses paginated list endpoint (backward-compat wrapper for existing callers).
 */

export function getProducts(): Promise<ProductListPaginatedResponse> {
  return apiFetch<ProductListPaginatedResponse>('/api/products');
}

export function getProduct(id: string): Promise<ProductDetailResponse> {
  return apiFetch<ProductDetailResponse>(`/api/products/${id}`);
}

export function getCategories(): Promise<CategoriesResponse> {
  return apiFetch<CategoriesResponse>('/api/products/categories');
}

export function getBestsellers(): Promise<BestsellersResponse> {
  return apiFetch<BestsellersResponse>('/api/products/bestsellers');
}

export function getRelatedProducts(id: string): Promise<RelatedResponse> {
  return apiFetch<RelatedResponse>(`/api/products/${id}/related`);
}
