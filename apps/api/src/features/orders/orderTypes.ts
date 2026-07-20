import type {
  OrderLifecycleEventType,
  OrderShipmentLine,
  OrderStatus,
  ShipmentStatus,
  TrackingEventCode,
} from '@shop/contracts/orders';
import type { PowderMixOrderItem } from '@shop/contracts/powderizer';

export interface CreateOrderLineVariantSnapshot {
  variantId: number;
  sku: string;
  label: string;
  weightGrams: number;
  consumptionClassification: 'food' | 'non-food' | 'caution';
  deliveryClass: 'parcel' | 'freight';
}

export interface CreateOrderParams {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  promoApplied: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  userId: number | null;
  items: Array<{
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
    variantSnapshot?: CreateOrderLineVariantSnapshot;
  }>;
  mixItems: PowderMixOrderItem[];
  deliveryMode?: 'parcel' | 'freight';
  deliveryChargeCents?: number;
  deliveryWeightGrams?: number;
  createdAt: string;
}

export interface ShipmentAllocation {
  trackingReference?: string;
  lines: OrderShipmentLine[];
}

export interface LifecycleEventInput {
  orderId: number;
  shipmentId?: number;
  type: OrderLifecycleEventType;
  title: string;
  detail?: string;
  location?: string;
  code?: TrackingEventCode;
  idempotencyKey?: string;
  requestFingerprint?: string;
  occurredAt: string;
}

export interface PersistedShipment {
  id: number;
  orderId: number;
  shipmentNumber: number;
  status: ShipmentStatus;
  trackingReference: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderState {
  id: number;
  status: OrderStatus;
  version: number;
  cancelledAt: string | null;
}
