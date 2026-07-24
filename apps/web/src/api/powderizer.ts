import { UpdatePowderMixQuantityBody } from '@shop/contracts/powderizer';
import { Cart } from '@shop/contracts/cart';
import { apiFetch } from './client';

/** Typed browser boundary for the powder-mix cart mutations the surviving cart hooks call. */
export function requotePowderMix(cartId: string, mixId: string): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/mixes/${mixId}/requote`, { method: 'POST' });
}

export function updatePowderMixQuantity(
  cartId: string,
  mixId: string,
  quantity: number,
): Promise<Cart> {
  const body: UpdatePowderMixQuantityBody = { quantity };
  return apiFetch(Cart, `/api/cart/${cartId}/mixes/${mixId}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function removePowderMix(cartId: string, mixId: string): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/mixes/${mixId}`, { method: 'DELETE' });
}
