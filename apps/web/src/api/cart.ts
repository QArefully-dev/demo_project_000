import { apiFetch } from './client';
import { Cart, CreateCartResponse } from '@shop/contracts/cart';
import type { AddToCartBody, UpdateCartLineBody } from '@shop/contracts/cart';

/**
 * Cart API module.
 */

export function createCart(): Promise<CreateCartResponse> {
  return apiFetch(CreateCartResponse, '/api/cart', { method: 'POST' });
}

export function getCart(cartId: string): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}`);
}

export function addToCart(cartId: string, productId: string, variantId?: number): Promise<Cart> {
  const body: AddToCartBody = { productId, ...(variantId !== undefined ? { variantId } : {}) };
  return apiFetch(Cart, `/api/cart/${cartId}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCartItem(cartId: string, productId: string, quantity: number): Promise<Cart> {
  const body: UpdateCartLineBody = { productId, quantity };
  return apiFetch(Cart, `/api/cart/${cartId}/items`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function removeFromCart(cartId: string, productId: string): Promise<Cart> {
  return apiFetch(Cart, `/api/cart/${cartId}/items/${productId}`, {
    method: 'DELETE',
  });
}
