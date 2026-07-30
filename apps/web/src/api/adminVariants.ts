import {
  AdminVariant,
  AdminVariantListResponse,
  type CreateAdminVariantBody,
  type SetAdminVariantClearanceBody,
  type UpdateAdminVariantBody,
} from '@shop/contracts/admin-variants';
import { apiFetch } from './client';

export const getAdminProductVariants = (productId: string) =>
  apiFetch(AdminVariantListResponse, `/api/admin/products/${productId}/variants`);
export const createAdminVariant = (body: CreateAdminVariantBody) =>
  apiFetch(AdminVariant, '/api/admin/variants', {
    method: 'POST',
    body: JSON.stringify(body satisfies CreateAdminVariantBody),
  });
export const updateAdminVariant = (variantId: string, body: UpdateAdminVariantBody) =>
  apiFetch(AdminVariant, `/api/admin/variants/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify(body satisfies UpdateAdminVariantBody),
  });
export const retireAdminVariant = (variantId: string) =>
  apiFetch(AdminVariant, `/api/admin/variants/${variantId}`, { method: 'DELETE' });
export const setAdminVariantClearance = (variantId: string, body: SetAdminVariantClearanceBody) =>
  apiFetch(AdminVariant, `/api/admin/variants/${variantId}/clearance`, {
    method: 'PUT',
    body: JSON.stringify(body satisfies SetAdminVariantClearanceBody),
  });
