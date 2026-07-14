import {
  CreatePowderMixBody,
  PowderMixQuote,
  PowderizerConfigResponse,
  UpdatePowderMixBody,
  UpdatePowderMixQuantityBody,
} from '@shop/contracts/powderizer';
import { Cart } from '@shop/contracts/cart';
import { apiFetch } from './client';

/** Typed browser boundary for Powderizer configuration, quotes, and cart mutations. */
export function getPowderizerConfig(signal?: AbortSignal): Promise<PowderizerConfigResponse> {
  return apiFetch(PowderizerConfigResponse, '/api/powderizer/config', { signal });
}

export function quotePowderMix(
  body: CreatePowderMixBody,
  signal?: AbortSignal,
): Promise<PowderMixQuote> {
  return apiFetch(PowderMixQuote, '/api/powderizer/quote', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export function createPowderMix(cartId: string, body: CreatePowderMixBody): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/mixes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePowderMix(
  cartId: string,
  mixId: string,
  body: UpdatePowderMixBody,
): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

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
