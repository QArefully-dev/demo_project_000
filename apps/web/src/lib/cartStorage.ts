const CART_ID_KEY = 'shop-qarefully-cart-id';

export function getCartId(): string | null {
  return localStorage.getItem(CART_ID_KEY);
}

export function setCartId(id: string): void {
  localStorage.setItem(CART_ID_KEY, id);
}

export function clearCartId(): void {
  localStorage.removeItem(CART_ID_KEY);
}
