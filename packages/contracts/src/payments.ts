import { Type, type Static } from '@sinclair/typebox';
import { CustomerName, EmailAddress, PromoCodeValue, ShippingAddress, Uuid } from './common.js';
import { PlaceOrderResponse } from './orders.js';

export const PaymentBody = Type.Object({
  cartId: Uuid,
  promoCode: Type.Optional(PromoCodeValue),
  customerName: CustomerName,
  customerEmail: EmailAddress,
  shippingAddress: ShippingAddress,
  cardNumber: Type.String({ minLength: 12, maxLength: 25, pattern: '^[0-9 -]+$' }),
  cardExpiry: Type.String({ pattern: '^(0[1-9]|1[0-2])/[0-9]{2}$' }),
  cardCvc: Type.String({ pattern: '^[0-9]{3,4}$' }),
  idempotencyKey: Uuid,
});
export type PaymentBody = Static<typeof PaymentBody>;

export const PaymentFailureReason = Type.Union([
  Type.Literal('CARD_DECLINED'),
  Type.Literal('GATEWAY_TIMEOUT'),
]);
export type PaymentFailureReason = Static<typeof PaymentFailureReason>;
export const PaymentErrorResponse = Type.Object({
  error: Type.String({ minLength: 1, maxLength: 500 }),
  failureReason: Type.Optional(PaymentFailureReason),
});
export type PaymentErrorResponse = Static<typeof PaymentErrorResponse>;

/** Successful checkout response returned by the payment endpoint. */
export const PaymentSuccessResponse = PlaceOrderResponse;
export type PaymentSuccessResponse = Static<typeof PaymentSuccessResponse>;
