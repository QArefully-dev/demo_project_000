import type { Cart } from '@shop/contracts/cart';
import * as api from '../api/cart';
import { isMissingCartError } from '../api/client';
import { clearCartId, getCartId, setCartId } from '../lib/cartStorage';

/**
 * Cart persistence boundary. Each CartProvider creates and owns one client.
 */
export function createCartClient() {
  async function createAndLoad(): Promise<Cart> {
    const { cartId } = await api.createCart();
    setCartId(cartId);
    try {
      return await api.getCart(cartId);
    } catch (error) {
      if (getCartId() === cartId) clearCartId();
      throw error;
    }
  }

  async function loadOrCreate(): Promise<Cart> {
    const storedCartId = getCartId();
    if (storedCartId) {
      try {
        return await api.getCart(storedCartId);
      } catch (error) {
        if (!isMissingCartError(error)) throw error;
        if (getCartId() === storedCartId) clearCartId();
      }
    }

    return createAndLoad();
  }

  async function recoverMissingCart(missingCartId: string): Promise<Cart> {
    if (getCartId() === missingCartId) clearCartId();
    return loadOrCreate();
  }

  return { loadOrCreate, recoverMissingCart };
}
