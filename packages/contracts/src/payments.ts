import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  CustomerName,
  EmailAddress,
  MoneyCents,
  PositiveIntegerString,
  PromoCodeValue,
  ShippingAddress,
  Uuid,
} from './common.js';
import { PlaceOrderResponse } from './orders.js';
import {
  PowderMixConflictResponse,
  PowderMixOrderItemSnapshotV1,
  PowderMixOrderItemSnapshotV2,
} from './powderizer.js';

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

export const PaymentConflictResponse = Type.Union([
  PowderMixConflictResponse,
  Type.Object({ error: Type.String({ minLength: 1, maxLength: 500 }) }),
]);
export type PaymentConflictResponse = Static<typeof PaymentConflictResponse>;

const PersistedCheckoutCustomer = Type.Object(
  {
    name: Type.String(),
    email: Type.String(),
    shippingAddress: Type.String(),
  },
  { additionalProperties: false },
);

const PersistedCheckoutLine = Type.Object(
  {
    productId: PositiveIntegerString,
    productName: Type.String(),
    unitPriceCents: MoneyCents,
    quantity: Type.Integer({ minimum: 1 }),
    lineTotalCents: MoneyCents,
  },
  { additionalProperties: false },
);

const PersistedCheckoutQuoteFields = {
  cartId: Uuid,
  customer: PersistedCheckoutCustomer,
  userId: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  promoCode: Type.Union([Type.String(), Type.Null()]),
  subtotalCents: MoneyCents,
  discountCents: MoneyCents,
  totalCents: MoneyCents,
  lines: Type.Array(PersistedCheckoutLine),
  createdAt: Type.String(),
};

/** Legacy product-only checkout quote. Strict parser must preserve this shape. */
export const PersistedCheckoutQuoteV1 = Type.Object(
  {
    version: Type.Literal(1),
    ...PersistedCheckoutQuoteFields,
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV1 = Static<typeof PersistedCheckoutQuoteV1>;

/** Legacy mix checkout quote. Mix snapshots retain their strict v1 shape. */
export const PersistedCheckoutQuoteV2 = Type.Object(
  {
    version: Type.Literal(2),
    ...PersistedCheckoutQuoteFields,
    mixLines: Type.Array(PowderMixOrderItemSnapshotV1),
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV2 = Static<typeof PersistedCheckoutQuoteV2>;

/** Current checkout quote. New writes use v3 so v2 remains strict and readable. */
export const PersistedCheckoutQuoteV3 = Type.Object(
  {
    version: Type.Literal(3),
    ...PersistedCheckoutQuoteFields,
    mixLines: Type.Array(PowderMixOrderItemSnapshotV2),
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV3 = Static<typeof PersistedCheckoutQuoteV3>;

export const PersistedCheckoutQuote = Type.Union([
  PersistedCheckoutQuoteV1,
  PersistedCheckoutQuoteV2,
  PersistedCheckoutQuoteV3,
]);
export type PersistedCheckoutQuote = Static<typeof PersistedCheckoutQuote>;
export const CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 3;

/** Strict storage-boundary parser. Readers accept v1, v2, and v3; writers use v3. */
export function parsePersistedCheckoutQuote(value: unknown): PersistedCheckoutQuote {
  if (Value.Check(PersistedCheckoutQuoteV3, value)) return value;
  if (Value.Check(PersistedCheckoutQuoteV2, value)) return value;
  if (Value.Check(PersistedCheckoutQuoteV1, value)) return value;
  throw new Error('Invalid persisted checkout quote');
}

/** Successful checkout response returned by the payment endpoint. */
export const PaymentSuccessResponse = PlaceOrderResponse;
export type PaymentSuccessResponse = Static<typeof PaymentSuccessResponse>;
