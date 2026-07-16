import { Type, type Static } from '@sinclair/typebox';
import {
  CustomerName,
  EmailAddress,
  MoneyCents,
  PromoCodeValue,
  ShippingAddress,
  Uuid,
  PositiveIntegerString,
} from './common.js';
import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  PowderMixOrderItemSnapshotV1,
  PowderMixOrderItemSnapshotV2,
} from './powderizer.js';

export const OrderLineItem = Type.Object({
  productId: Type.String({ minLength: 1 }),
  productName: Type.String(),
  unitPriceCents: MoneyCents,
  quantity: Type.Integer({ minimum: 1 }),
  lineTotalCents: MoneyCents,
});
export type OrderLineItem = Static<typeof OrderLineItem>;

const NormalizedOrderPowderMixItemSnapshotV1 = Type.Object(
  {
    ...Type.Omit(PowderMixOrderItemSnapshotV1, ['snapshotVersion']).properties,
    bagColourScheme: Type.Literal(DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME),
    usageLabel: Type.Literal('Check ingredient labels'),
    snapshotVersion: Type.Literal(1),
  },
  { additionalProperties: false },
);
export const NormalizedOrderPowderMixItem = Type.Union([
  NormalizedOrderPowderMixItemSnapshotV1,
  PowderMixOrderItemSnapshotV2,
]);
export type NormalizedOrderPowderMixItem = Static<typeof NormalizedOrderPowderMixItem>;

export const Order = Type.Object({
  id: PositiveIntegerString,
  items: Type.Array(OrderLineItem),
  mixItems: Type.Array(NormalizedOrderPowderMixItem),
  subtotalCents: MoneyCents,
  discountCents: MoneyCents,
  totalCents: MoneyCents,
  promoApplied: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});
export type Order = Static<typeof Order>;

export const PlaceOrderBody = Type.Object({
  cartId: Uuid,
  promoCode: Type.Optional(PromoCodeValue),
  customerName: CustomerName,
  customerEmail: EmailAddress,
  shippingAddress: ShippingAddress,
});
export type PlaceOrderBody = Static<typeof PlaceOrderBody>;
export const PlaceOrderResponse = Order;
export type PlaceOrderResponse = Static<typeof PlaceOrderResponse>;
export const OrderDetailResponse = Order;
export type OrderDetailResponse = Static<typeof OrderDetailResponse>;
export const OrderIdParam = Type.Object({ orderId: PositiveIntegerString });
