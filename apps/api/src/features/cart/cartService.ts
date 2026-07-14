import type { Cart } from '@shop/contracts/cart';
import { toProductContract } from '../../mappers/product.js';
import type { CartRepository } from './cartRepository.js';

export interface CartService {
  create(): { cartId: string };
  get(cartId: string): Cart | undefined;
  add(cartId: string, productId: string): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_FOUND';
  update(
    cartId: string,
    productId: string,
    quantity: number,
  ): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART';
  remove(cartId: string, productId: string): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART';
}

export function createCartService(repository: CartRepository): CartService {
  return {
    create: () => createCart(repository),
    get: (cartId) => getCart(repository, cartId),
    add: (cartId, productId) => addItem(repository, cartId, productId),
    update: (cartId, productId, quantity) => updateItem(repository, cartId, productId, quantity),
    remove: (cartId, productId) => removeItem(repository, cartId, productId),
  };
}

export function createCart(repository: CartRepository): { cartId: string } {
  const cartId = crypto.randomUUID();
  repository.create(cartId);
  return { cartId };
}

export function getCart(repository: CartRepository, cartId: string): Cart | undefined {
  if (!repository.exists(cartId)) return undefined;
  const items = repository.listLines(cartId).map((row) => ({
    productId: String(row.product_id),
    product: toProductContract(row),
    quantity: row.quantity,
    lineTotalCents: row.price_cents * row.quantity,
  }));
  return {
    id: cartId,
    items,
    subtotalCents: items.reduce((total, item) => total + item.lineTotalCents, 0),
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
  };
}

export function addItem(
  repository: CartRepository,
  cartId: string,
  productId: string,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_FOUND' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!repository.productExists(productId)) return 'PRODUCT_NOT_FOUND';
  repository.addLine(cartId, productId);
  repository.touch(cartId);
  return getCart(repository, cartId) ?? 'CART_NOT_FOUND';
}

export function updateItem(
  repository: CartRepository,
  cartId: string,
  productId: string,
  quantity: number,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  const changed =
    quantity === 0
      ? repository.removeLine(cartId, productId)
      : repository.updateLine(cartId, productId, quantity);
  if (!changed) return 'PRODUCT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId) ?? 'CART_NOT_FOUND';
}

export function removeItem(
  repository: CartRepository,
  cartId: string,
  productId: string,
): Cart | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' {
  if (!repository.exists(cartId)) return 'CART_NOT_FOUND';
  if (!repository.removeLine(cartId, productId)) return 'PRODUCT_NOT_IN_CART';
  repository.touch(cartId);
  return getCart(repository, cartId) ?? 'CART_NOT_FOUND';
}
