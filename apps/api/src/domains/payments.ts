/**
 * Payments domain — stub (Wave 0).
 * Full implementation deferred to W1.D.
 */

export interface PaymentResult {
  orderId: string;
}

/** Stub: process a payment. Always returns 501 behaviour. */
export function processPayment(_params: {
  cartId: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  idempotencyKey: string;
  userId?: number;
}):
  | PaymentResult
  | 'CART_NOT_FOUND'
  | 'CART_EMPTY'
  | 'PROMO_INVALID'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'IDEMPOTENT_CONFLICT' {
  void _params;
  return 'CART_NOT_FOUND';
}
