import {
  AdminProduct,
  AdminProductListResponse,
  type AdminProductListQuery,
  type CreateAdminProductBody,
  type UpdateAdminProductBody,
} from '@shop/contracts/admin-products';
import { apiFetch } from './client';

export function getAdminProducts(query: AdminProductListQuery = {}) {
  const params = new URLSearchParams();
  if (query.includeRetired !== undefined)
    params.set('includeRetired', String(query.includeRetired));
  const suffix = params.size ? `?${params}` : '';
  return apiFetch(AdminProductListResponse, `/api/admin/products${suffix}`);
}
export const getAdminProduct = (productId: string) =>
  apiFetch(AdminProduct, `/api/admin/products/${productId}`);
export const createAdminProduct = (body: CreateAdminProductBody) =>
  apiFetch(AdminProduct, '/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(body satisfies CreateAdminProductBody),
  });
export const updateAdminProduct = (productId: string, body: UpdateAdminProductBody) =>
  apiFetch(AdminProduct, `/api/admin/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(body satisfies UpdateAdminProductBody),
  });
export const retireAdminProduct = (productId: string) =>
  apiFetch(AdminProduct, `/api/admin/products/${productId}`, { method: 'DELETE' });
