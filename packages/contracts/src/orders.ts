import { Type, type Static } from '@sinclair/typebox';
import {
  CustomerName,
  EmailAddress,
  MoneyCents,
  PositiveIntegerString,
  PromoCodeValue,
  ShippingAddress,
  Uuid,
} from './common.js';
import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  PowderMixOrderItemSnapshotV1,
  PowderMixOrderItemSnapshotV2,
} from './powderizer.js';
import { DeliveryClass, DeliveryMode } from './delivery.js';

const UtcIsoInstant = Type.String({
  minLength: 24,
  maxLength: 24,
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
});
const NonNegativeVersion = Type.Integer({ minimum: 0 });
const TrackingReference = Type.String({ minLength: 1, maxLength: 100 });
/** Plain text transport fields exclude markup delimiters. */
const TrackingText = Type.String({ minLength: 1, maxLength: 500, pattern: '^[^<>]*$' });
const TrackingDetail = Type.String({ minLength: 1, maxLength: 2_000, pattern: '^[^<>]*$' });
const TrackingLocation = Type.String({ minLength: 1, maxLength: 160, pattern: '^[^<>]*$' });

export const OrderStatus = Type.Union([
  Type.Literal('processing'),
  Type.Literal('packed'),
  Type.Literal('shipped'),
  Type.Literal('delivered'),
  Type.Literal('delivery_failed'),
  Type.Literal('cancelled'),
]);
export type OrderStatus = Static<typeof OrderStatus>;

export const ShipmentStatus = Type.Union([
  Type.Literal('packed'),
  Type.Literal('shipped'),
  Type.Literal('delivered'),
  Type.Literal('delivery_failed'),
  Type.Literal('cancelled'),
]);
export type ShipmentStatus = Static<typeof ShipmentStatus>;

export const OrderLifecycleEventType = Type.Union([
  Type.Literal('order_created'),
  Type.Literal('shipment_packed'),
  Type.Literal('shipment_shipped'),
  Type.Literal('shipment_delivered'),
  Type.Literal('shipment_delivery_failed'),
  Type.Literal('shipment_tracking_updated'),
  Type.Literal('order_cancelled'),
]);
export type OrderLifecycleEventType = Static<typeof OrderLifecycleEventType>;

export const TrackingEventCode = Type.Union([
  Type.Literal('in_transit'),
  Type.Literal('out_for_delivery'),
  Type.Literal('delivery_attempted'),
  Type.Literal('delivered'),
]);
export type TrackingEventCode = Static<typeof TrackingEventCode>;

/** Distinguishes independently-numbered product and Powderizer purchase-line tables. */
export const OrderLineKind = Type.Union([Type.Literal('product'), Type.Literal('powder_mix')]);
export type OrderLineKind = Static<typeof OrderLineKind>;

export const OrderInventoryStatus = Type.Union([
  Type.Literal('allocated'),
  Type.Literal('partially_backordered'),
  Type.Literal('backordered'),
  Type.Literal('cancelled'),
]);
export type OrderInventoryStatus = Static<typeof OrderInventoryStatus>;

export const OrderLineVariantSnapshot = Type.Object(
  {
    variantId: Type.Integer({ minimum: 1 }),
    sku: Type.String({ minLength: 1, maxLength: 64 }),
    label: Type.String({ minLength: 1, maxLength: 160 }),
    unitPriceCents: MoneyCents,
    weightGrams: Type.Integer({ minimum: 1 }),
    consumptionClassification: Type.Union([
      Type.Literal('food'),
      Type.Literal('non-food'),
      Type.Literal('caution'),
    ]),
    deliveryClass: DeliveryClass,
  },
  { additionalProperties: false },
);
export type OrderLineVariantSnapshot = Static<typeof OrderLineVariantSnapshot>;

export const OrderLineItem = Type.Object(
  {
    lineId: PositiveIntegerString,
    productId: Type.String({ minLength: 1 }),
    productName: Type.String({ minLength: 1 }),
    unitPriceCents: MoneyCents,
    quantity: Type.Integer({ minimum: 1 }),
    lineTotalCents: MoneyCents,
    inventoryStatus: OrderInventoryStatus,
    allocatedQuantity: Type.Integer({ minimum: 0 }),
    backorderedQuantity: Type.Integer({ minimum: 0 }),
    variantSnapshot: Type.Optional(OrderLineVariantSnapshot),
  },
  { additionalProperties: false },
);
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

const OrderPowderMixLineItemV1 = Type.Object(
  { ...NormalizedOrderPowderMixItemSnapshotV1.properties, lineId: PositiveIntegerString },
  { additionalProperties: false },
);
const OrderPowderMixLineItemV2 = Type.Object(
  { ...PowderMixOrderItemSnapshotV2.properties, lineId: PositiveIntegerString },
  { additionalProperties: false },
);
export const OrderPowderMixLineItem = Type.Union([
  OrderPowderMixLineItemV1,
  OrderPowderMixLineItemV2,
]);
export type OrderPowderMixLineItem = Static<typeof OrderPowderMixLineItem>;

export const Order = Type.Object(
  {
    id: PositiveIntegerString,
    status: OrderStatus,
    version: NonNegativeVersion,
    items: Type.Array(OrderLineItem),
    mixItems: Type.Array(OrderPowderMixLineItem),
    subtotalCents: MoneyCents,
    discountCents: MoneyCents,
    totalCents: MoneyCents,
    promoApplied: Type.Union([Type.String(), Type.Null()]),
    createdAt: UtcIsoInstant,
    deliveryMode: Type.Optional(DeliveryMode),
    deliveryChargeCents: Type.Optional(Type.Integer({ minimum: 0 })),
    deliveryWeightGrams: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type Order = Static<typeof Order>;

export const OrderSummary = Type.Object(
  {
    id: PositiveIntegerString,
    status: OrderStatus,
    version: NonNegativeVersion,
    totalCents: MoneyCents,
    totalItems: Type.Integer({ minimum: 0 }),
    hasBackorder: Type.Boolean(),
    createdAt: UtcIsoInstant,
  },
  { additionalProperties: false },
);
export type OrderSummary = Static<typeof OrderSummary>;

export const OrderListQuery = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);
export type OrderListQuery = Static<typeof OrderListQuery>;

export const OrderListResponse = Type.Object(
  {
    items: Type.Array(OrderSummary),
    page: Type.Integer({ minimum: 1, maximum: 10_000 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
  },
  { additionalProperties: false },
);
export type OrderListResponse = Static<typeof OrderListResponse>;

export const OrderShipmentLine = Type.Object(
  {
    lineKind: OrderLineKind,
    lineId: PositiveIntegerString,
    quantity: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type OrderShipmentLine = Static<typeof OrderShipmentLine>;

export const OrderShipment = Type.Object(
  {
    id: PositiveIntegerString,
    shipmentNumber: Type.Integer({ minimum: 1 }),
    status: ShipmentStatus,
    trackingReference: Type.Union([TrackingReference, Type.Null()]),
    version: NonNegativeVersion,
    lines: Type.Array(OrderShipmentLine),
    createdAt: UtcIsoInstant,
    updatedAt: UtcIsoInstant,
  },
  { additionalProperties: false },
);
export type OrderShipment = Static<typeof OrderShipment>;

export const OrderLifecycleEvent = Type.Object(
  {
    id: PositiveIntegerString,
    shipmentId: Type.Union([PositiveIntegerString, Type.Null()]),
    type: OrderLifecycleEventType,
    code: Type.Union([TrackingEventCode, Type.Null()]),
    title: TrackingText,
    detail: Type.Union([TrackingDetail, Type.Null()]),
    location: Type.Union([TrackingLocation, Type.Null()]),
    occurredAt: UtcIsoInstant,
  },
  { additionalProperties: false },
);
export type OrderLifecycleEvent = Static<typeof OrderLifecycleEvent>;

export const OrderDetailResponse = Type.Object(
  {
    ...Order.properties,
    shipments: Type.Array(OrderShipment),
    events: Type.Array(OrderLifecycleEvent),
    canCancel: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type OrderDetailResponse = Static<typeof OrderDetailResponse>;

export const PlaceOrderBody = Type.Object(
  {
    cartId: Uuid,
    promoCode: Type.Optional(PromoCodeValue),
    customerName: CustomerName,
    customerEmail: EmailAddress,
    shippingAddress: ShippingAddress,
  },
  { additionalProperties: false },
);
export type PlaceOrderBody = Static<typeof PlaceOrderBody>;

export const CancelOrderBody = Type.Object(
  { version: NonNegativeVersion, idempotencyKey: Uuid },
  { additionalProperties: false },
);
export type CancelOrderBody = Static<typeof CancelOrderBody>;

export const PackShipmentBody = Type.Object(
  {
    trackingReference: Type.Optional(TrackingReference),
    lines: Type.Array(OrderShipmentLine, { minItems: 1, maxItems: 100 }),
  },
  { additionalProperties: false },
);
export type PackShipmentBody = Static<typeof PackShipmentBody>;

export const PackOrderBody = Type.Object(
  {
    version: NonNegativeVersion,
    idempotencyKey: Uuid,
    shipments: Type.Array(PackShipmentBody, { minItems: 1, maxItems: 50 }),
  },
  { additionalProperties: false },
);
export type PackOrderBody = Static<typeof PackOrderBody>;

export const ShipmentTransitionStatus = Type.Union([
  Type.Literal('shipped'),
  Type.Literal('delivered'),
  Type.Literal('delivery_failed'),
]);
export type ShipmentTransitionStatus = Static<typeof ShipmentTransitionStatus>;

export const TransitionShipmentBody = Type.Object(
  {
    version: NonNegativeVersion,
    status: ShipmentTransitionStatus,
    idempotencyKey: Uuid,
  },
  { additionalProperties: false },
);
export type TransitionShipmentBody = Static<typeof TransitionShipmentBody>;

export const CreateTrackingEventBody = Type.Object(
  {
    version: NonNegativeVersion,
    code: TrackingEventCode,
    title: TrackingText,
    detail: Type.Optional(TrackingDetail),
    location: Type.Optional(TrackingLocation),
    idempotencyKey: Uuid,
  },
  { additionalProperties: false },
);
export type CreateTrackingEventBody = Static<typeof CreateTrackingEventBody>;

export const PlaceOrderResponse = Order;
export type PlaceOrderResponse = Static<typeof PlaceOrderResponse>;

export const OrderIdParam = Type.Object(
  { orderId: PositiveIntegerString },
  { additionalProperties: false },
);
export type OrderIdParam = Static<typeof OrderIdParam>;

export const ShipmentIdParam = Type.Object(
  { shipmentId: PositiveIntegerString },
  { additionalProperties: false },
);
export type ShipmentIdParam = Static<typeof ShipmentIdParam>;
