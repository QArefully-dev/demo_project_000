import { Type, type Static } from '@sinclair/typebox';
import { EmailAddress, MoneyCents, PositiveIntegerString } from './common.js';
import { OrderDetailResponse, OrderStatus } from './orders.js';

const UtcIsoInstant = Type.String({
  minLength: 24,
  maxLength: 24,
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
});

export const AdminOrderListItem = Type.Object(
  {
    id: PositiveIntegerString,
    status: OrderStatus,
    version: Type.Integer({ minimum: 0 }),
    totalCents: MoneyCents,
    totalItems: Type.Integer({ minimum: 0 }),
    hasBackorder: Type.Boolean(),
    createdAt: UtcIsoInstant,
    promoCode: Type.Union([Type.String({ minLength: 1, maxLength: 64 }), Type.Null()]),
    buyer: Type.Object(
      {
        id: Type.Union([PositiveIntegerString, Type.Null()]),
        email: EmailAddress,
        name: Type.String({ minLength: 1, maxLength: 120 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type AdminOrderListItem = Static<typeof AdminOrderListItem>;

export const AdminOrdersListResponse = Type.Object(
  {
    items: Type.Array(AdminOrderListItem),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1, maximum: 10_000 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 100 }),
  },
  { additionalProperties: false },
);
export type AdminOrdersListResponse = Static<typeof AdminOrdersListResponse>;

/** Payment-level refund capacity for the deterministic captured payment selected for an order. */
export const AdminOrderRefundPayment = Type.Object(
  {
    paymentId: PositiveIntegerString,
    remainingRefundableCents: MoneyCents,
  },
  { additionalProperties: false },
);
export type AdminOrderRefundPayment = Static<typeof AdminOrderRefundPayment>;

/** Administrator detail keeps refund capability out of customer order transport. */
export const AdminOrderDetailResponse = Type.Object(
  {
    ...OrderDetailResponse.properties,
    refundPayment: Type.Union([AdminOrderRefundPayment, Type.Null()]),
  },
  { additionalProperties: false },
);
export type AdminOrderDetailResponse = Static<typeof AdminOrderDetailResponse>;
