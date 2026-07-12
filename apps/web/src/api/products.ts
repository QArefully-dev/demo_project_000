import { apiFetch } from './client';
import type {
  ProductListPaginatedResponse,
  ProductDetailResponse,
  CategoriesResponse,
  BestsellersResponse,
  RelatedResponse,
  ProductQuery,
} from '@shop/contracts';

/**
 * Products API module.
 * W1.B: paginated list with query params, single product, categories, bestsellers, related.
 */

export interface GetProductsParams {
  q?: string;
  category?: string;
  onSale?: boolean;
  sort?: ProductQuery['sort'];
  page?: number;
  pageSize?: number;
}

export function getProducts(params?: GetProductsParams): Promise<ProductListPaginatedResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.onSale) searchParams.set('onSale', 'true');
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  return apiFetch<ProductListPaginatedResponse>(`/api/products${qs ? `?${qs}` : ''}`);
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
