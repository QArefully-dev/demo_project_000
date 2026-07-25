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
import { DeliveryClass, DeliverySummary } from './delivery.js';

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
  Type.Object(
    {
      error: Type.Literal('RESERVATION_EXPIRED'),
      reservationExpiresAt: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      error: Type.Literal('INSUFFICIENT_STOCK'),
      productIds: Type.Array(PositiveIntegerString, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
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

const PersistedInventoryAllocation = Type.Object(
  {
    productId: PositiveIntegerString,
    reservedQuantity: Type.Integer({ minimum: 0 }),
    backorderedQuantity: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const PersistedCheckoutVariantLine = Type.Object(
  {
    productId: PositiveIntegerString,
    variantId: Type.Integer({ minimum: 1 }),
    productName: Type.String(),
    variantLabel: Type.String({ minLength: 1, maxLength: 160 }),
    unitPriceCents: MoneyCents,
    weightGrams: Type.Integer({ minimum: 1 }),
    deliveryClass: DeliveryClass,
    quantity: Type.Integer({ minimum: 1 }),
    lineTotalCents: MoneyCents,
    consumptionClassification: Type.String(),
  },
  { additionalProperties: false },
);

/**
 * The only persisted checkout quote shape. Variant-scoped lines, delivery summary, and the
 * inventory split fixed before gateway authorization.
 *
 * The version integer stays `6` rather than restarting at `1`: it is written into stored JSON,
 * and a number no earlier writer ever emitted means a stale blob can never be read as current.
 */
export const PersistedCheckoutQuoteV6 = Type.Object(
  {
    version: Type.Literal(6),
    ...PersistedCheckoutQuoteFields,
    variantLines: Type.Array(PersistedCheckoutVariantLine),
    deliverySummary: DeliverySummary,
    inventoryAllocations: Type.Array(PersistedInventoryAllocation),
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV6 = Static<typeof PersistedCheckoutQuoteV6>;

/** Union of one. Retained as the stable name readers and writers depend on. */
export const PersistedCheckoutQuote = Type.Union([PersistedCheckoutQuoteV6]);
export type PersistedCheckoutQuote = Static<typeof PersistedCheckoutQuote>;
export const CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 6;

/** Strict storage-boundary parser. v6 is the only readable and writable version. */
export function parsePersistedCheckoutQuote(value: unknown): PersistedCheckoutQuote {
  if (Value.Check(PersistedCheckoutQuoteV6, value)) return value;
  throw new Error('Invalid persisted checkout quote');
}

/** Successful checkout response returned by the payment endpoint. */
export const PaymentSuccessResponse = PlaceOrderResponse;
export type PaymentSuccessResponse = Static<typeof PaymentSuccessResponse>;
