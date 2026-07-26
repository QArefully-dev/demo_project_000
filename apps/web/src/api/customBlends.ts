import { apiFetch } from './client';
import { Cart } from '@shop/contracts/cart';
import { CustomBlendOptionsResponse } from '@shop/contracts/custom-blends';
import type { CreateCustomBlendBody, ReplaceCustomBlendBody } from '@shop/contracts/custom-blends';

/**
 * Custom Blend API module.
 *
 * Option reads are cancellable: the configurator re-queries whenever the base lot
 * changes, and a superseded request must never repopulate the ingredient picker.
 */

export function getCustomBlendOptions(
  baseVariantId: number,
  signal?: AbortSignal,
): Promise<CustomBlendOptionsResponse> {
  const query = new URLSearchParams({ baseVariantId: String(baseVariantId) });
  return apiFetch(CustomBlendOptionsResponse, `/api/custom-blends/options?${query.toString()}`, {
    signal,
  });
}

export function createCustomBlend(cartId: string, body: CreateCustomBlendBody): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/custom-blends`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Replaces one configured line's specification atomically; the server keeps its quantity. */
export function replaceCustomBlend(cartId: string, body: ReplaceCustomBlendBody): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/custom-blends`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
