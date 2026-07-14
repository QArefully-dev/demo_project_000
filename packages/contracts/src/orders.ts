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

export const OrderLineItem = Type.Object({
  productId: Type.String({ minLength: 1 }),
  productName: Type.String(),
  unitPriceCents: MoneyCents,
  quantity: Type.Integer({ minimum: 1 }),
  lineTotalCents: MoneyCents,
});
export type OrderLineItem = Static<typeof OrderLineItem>;
export const Order = Type.Object({
  id: PositiveIntegerString,
  items: Type.Array(OrderLineItem),
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
