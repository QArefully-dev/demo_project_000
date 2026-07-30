import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  CustomerName,
  EmailAddress,
  MoneyCents,
  PositiveIntegerString,
  PromoCodeValue,
  PurchaseOrderReference,
  Uuid,
} from './common.js';
import { PlaceOrderResponse } from './orders.js';
import { DeliveryClass, DeliveryDate, DeliverySlot, DeliverySummary } from './delivery.js';
import { CustomBlendSnapshot } from './customBlends.js';
import { PostalAddress } from './address.js';
import { BillingEntityInput, BillingEntitySnapshot } from './tradeAccount.js';
import { PendingApprovalResult } from './orderApprovals.js';

/**
 * Where the consignment goes. Discriminated on `kind`: a `saved` selection carries only an
 * identifier, because the server loads the stored site and ignores any client-supplied address.
 */
export const DeliveryDestination = Type.Union([
  Type.Object(
    { kind: Type.Literal('saved'), deliverySiteId: PositiveIntegerString },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('adhoc'), address: PostalAddress },
    { additionalProperties: false },
  ),
]);
export type DeliveryDestination = Static<typeof DeliveryDestination>;

/** Who is billed. Same discriminated shape and same server-authoritative resolution rule. */
export const BillingSelection = Type.Union([
  Type.Object(
    { kind: Type.Literal('saved'), billingEntityId: PositiveIntegerString },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('adhoc'), billingEntity: BillingEntityInput },
    { additionalProperties: false },
  ),
]);
export type BillingSelection = Static<typeof BillingSelection>;

export const PaymentBody = Type.Object({
  cartId: Uuid,
  promoCode: Type.Optional(PromoCodeValue),
  customerName: CustomerName,
  customerEmail: EmailAddress,
  deliveryDestination: DeliveryDestination,
  billingSelection: BillingSelection,
  deliverySlot: DeliverySlot,
  purchaseOrderReference: Type.Optional(PurchaseOrderReference),
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

const PaymentConflictFallbackError = Type.String({
  minLength: 1,
  maxLength: 500,
  // Detail-bearing conflict codes must select their dedicated schema. Generic legacy messages
  // remain valid, but cannot make a required detail field optional through the catch-all member.
  pattern:
    '^(?!(?:RESERVATION_EXPIRED|INSUFFICIENT_STOCK|DELIVERY_SLOT_UNAVAILABLE|PENDING_APPROVAL|APPROVAL_REJECTED|APPROVAL_EXPIRED|APPROVAL_TOTAL_DRIFT|CUSTOM_BLEND_INVALID)$).+$',
});

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
  Type.Object(
    {
      error: Type.Literal('DELIVERY_SLOT_UNAVAILABLE'),
      earliestDate: DeliveryDate,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      error: Type.Literal('PENDING_APPROVAL'),
      approvalRequestId: PositiveIntegerString,
    },
    { additionalProperties: false },
  ),
  Type.Object({ error: Type.Literal('APPROVAL_REJECTED') }, { additionalProperties: false }),
  Type.Object({ error: Type.Literal('APPROVAL_EXPIRED') }, { additionalProperties: false }),
  Type.Object({ error: Type.Literal('APPROVAL_TOTAL_DRIFT') }, { additionalProperties: false }),
  Type.Object({ error: Type.Literal('CUSTOM_BLEND_INVALID') }, { additionalProperties: false }),
  Type.Object({ error: PaymentConflictFallbackError }),
]);
export type PaymentConflictResponse = Static<typeof PaymentConflictResponse>;

/**
 * Buyer identity plus resolved destination. `shippingAddress` is the `formatPostalAddress`
 * rendering of `deliveryAddress`, retained so the legacy free-text order column has exactly one
 * source and cannot drift from the structured value.
 */
const PersistedCheckoutCustomer = Type.Object(
  {
    name: Type.String(),
    email: Type.String(),
    deliveryAddress: PostalAddress,
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
    materialSubtotalCents: Type.Optional(MoneyCents),
    blendingFeeCents: Type.Optional(MoneyCents),
    discountableTotalCents: Type.Optional(MoneyCents),
    lineTotalCents: MoneyCents,
    consumptionClassification: Type.String(),
    customBlend: Type.Optional(CustomBlendSnapshot),
  },
  { additionalProperties: false },
);

/** Historical V7 schema retained for callers that reference its transport type. */
export const PersistedCheckoutQuoteV7 = Type.Object(
  {
    version: Type.Literal(7),
    ...PersistedCheckoutQuoteFields,
    variantLines: Type.Array(PersistedCheckoutVariantLine),
    deliverySummary: DeliverySummary,
    inventoryAllocations: Type.Array(PersistedInventoryAllocation),
    billingEntity: BillingEntitySnapshot,
    deliverySlot: DeliverySlot,
    purchaseOrderReference: Type.Union([PurchaseOrderReference, Type.Null()]),
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV7 = Static<typeof PersistedCheckoutQuoteV7>;

/**
 * The only persisted checkout quote shape. V8 records the base eligible for a promo discount,
 * the category that scoped it, and the V7 checkout commitments. The version integer advances to
 * `8` rather than restarting at `1`: it is written into stored JSON, and a number no earlier
 * writer emitted means a stale blob can never be read as current. Never reuse or restart it.
 */
export const PersistedCheckoutQuoteV8 = Type.Object(
  {
    version: Type.Literal(8),
    ...PersistedCheckoutQuoteFields,
    discountBaseCents: MoneyCents,
    promoCategoryScope: Type.Union([Type.String({ minLength: 1, maxLength: 100 }), Type.Null()]),
    variantLines: Type.Array(PersistedCheckoutVariantLine),
    deliverySummary: DeliverySummary,
    inventoryAllocations: Type.Array(PersistedInventoryAllocation),
    billingEntity: BillingEntitySnapshot,
    deliverySlot: DeliverySlot,
    purchaseOrderReference: Type.Union([PurchaseOrderReference, Type.Null()]),
  },
  { additionalProperties: false },
);
export type PersistedCheckoutQuoteV8 = Static<typeof PersistedCheckoutQuoteV8>;

/** Union of one. Retained as the stable name readers and writers depend on. */
export const PersistedCheckoutQuote = Type.Union([PersistedCheckoutQuoteV8]);
export type PersistedCheckoutQuote = Static<typeof PersistedCheckoutQuote>;
export const CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 8;

/** Strict storage-boundary parser. V8 is the only readable and writable version. */
export function parsePersistedCheckoutQuote(value: unknown): PersistedCheckoutQuote {
  if (Value.Check(PersistedCheckoutQuoteV8, value)) return value;
  throw new Error('Invalid persisted checkout quote');
}

/** Successful checkout response returned by the payment endpoint. */
export const PaymentSuccessResponse = PlaceOrderResponse;
export type PaymentSuccessResponse = Static<typeof PaymentSuccessResponse>;

/** Shared checkout result shape. API routes still map success to the historic raw order response. */
export const CheckoutErrorCode = Type.Union([
  Type.Literal('CART_NOT_FOUND'),
  Type.Literal('CART_EMPTY'),
  Type.Literal('PROMO_INVALID'),
  Type.Literal('CARD_INVALID'),
  Type.Literal('DECLINED'),
  Type.Literal('TIMEOUT'),
  Type.Literal('IDEMPOTENT_CONFLICT'),
  Type.Literal('IDEMPOTENT_IN_PROGRESS'),
  Type.Literal('RESERVATION_EXPIRED'),
  Type.Literal('INSUFFICIENT_STOCK'),
  Type.Literal('BELOW_MOQ'),
  Type.Literal('CUSTOM_BLEND_INVALID'),
  Type.Literal('DELIVERY_SITE_NOT_FOUND'),
  Type.Literal('BILLING_ENTITY_INVALID'),
  Type.Literal('DELIVERY_SLOT_UNAVAILABLE'),
  Type.Literal('CHECKOUT_FAILED'),
  Type.Literal('PENDING_APPROVAL'),
  Type.Literal('APPROVAL_REJECTED'),
  Type.Literal('APPROVAL_EXPIRED'),
  Type.Literal('APPROVAL_TOTAL_DRIFT'),
]);
export type CheckoutErrorCode = Static<typeof CheckoutErrorCode>;

const CheckoutGenericErrorCode = Type.Union([
  Type.Literal('CART_NOT_FOUND'),
  Type.Literal('CART_EMPTY'),
  Type.Literal('PROMO_INVALID'),
  Type.Literal('CARD_INVALID'),
  Type.Literal('DECLINED'),
  Type.Literal('TIMEOUT'),
  Type.Literal('IDEMPOTENT_CONFLICT'),
  Type.Literal('IDEMPOTENT_IN_PROGRESS'),
  Type.Literal('BELOW_MOQ'),
  Type.Literal('CUSTOM_BLEND_INVALID'),
  Type.Literal('DELIVERY_SITE_NOT_FOUND'),
  Type.Literal('BILLING_ENTITY_INVALID'),
  Type.Literal('CHECKOUT_FAILED'),
]);

export const CheckoutResult = Type.Union([
  Type.Object(
    { success: Type.Literal(true), order: PlaceOrderResponse },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      error: CheckoutGenericErrorCode,
      promoError: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
      promoErrorCode: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      error: Type.Literal('RESERVATION_EXPIRED'),
      reservationExpiresAt: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      error: Type.Literal('INSUFFICIENT_STOCK'),
      productIds: Type.Array(PositiveIntegerString, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      error: Type.Literal('DELIVERY_SLOT_UNAVAILABLE'),
      earliestDate: DeliveryDate,
    },
    { additionalProperties: false },
  ),
  PendingApprovalResult,
  Type.Object(
    { success: Type.Literal(false), error: Type.Literal('APPROVAL_REJECTED') },
    { additionalProperties: false },
  ),
  Type.Object(
    { success: Type.Literal(false), error: Type.Literal('APPROVAL_EXPIRED') },
    { additionalProperties: false },
  ),
  Type.Object(
    { success: Type.Literal(false), error: Type.Literal('APPROVAL_TOTAL_DRIFT') },
    { additionalProperties: false },
  ),
]);
export type CheckoutResult = Static<typeof CheckoutResult>;
