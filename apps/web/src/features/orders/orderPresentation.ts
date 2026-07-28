import { formatPostalAddress, type PostalAddress } from '@shop/contracts/address';
import type { DeliverySlot, DeliverySlotWindow } from '@shop/contracts/delivery';
import type { OrderStatus, ShipmentStatus } from '@shop/contracts/orders';
import type { BillingEntitySnapshot } from '@shop/contracts/trade-account';

const statusLabels: Record<OrderStatus | ShipmentStatus, string> = {
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  cancelled: 'Cancelled',
};

export function orderStatusLabel(status: OrderStatus | ShipmentStatus): string {
  return statusLabels[status];
}

export function formatOrderDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const slotWindowLabels: Record<DeliverySlotWindow, string> = {
  am: 'Morning',
  pm: 'Afternoon',
};

/** Buyer-facing label for a booked slot window. */
export function deliverySlotWindowLabel(window: DeliverySlotWindow): string {
  return slotWindowLabels[window];
}

/**
 * Single-line delivery address for display. Delegates to the contracts formatter so the rendered
 * order address can never drift from the persisted and mailed one.
 *
 * Returns `undefined` for an order placed before checkout captured a structured address, so the
 * caller omits the row rather than rendering an empty label.
 */
export function formatAddressLine(address: PostalAddress | undefined): string | undefined {
  return address === undefined ? undefined : formatPostalAddress(address);
}

/**
 * Booked delivery slot as `<date> · <window>`. The slot date is a calendar date with no time or
 * zone, so it is rendered in UTC to keep the displayed day identical to the booked day everywhere.
 *
 * Returns `undefined` when no slot was booked.
 */
export function formatDeliverySlot(slot: DeliverySlot | undefined): string | undefined {
  if (slot === undefined) return undefined;
  const parsed = new Date(`${slot.date}T00:00:00.000Z`);
  const day = Number.isNaN(parsed.getTime())
    ? slot.date
    : parsed.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
  return `${day} · ${deliverySlotWindowLabel(slot.window)}`;
}

/**
 * Registration and VAT identifiers of the billing entity, joined for a single caption line.
 * Both are nullable on the snapshot; returns `undefined` when neither was recorded.
 */
export function formatBillingIdentifiers(
  entity: BillingEntitySnapshot | undefined,
): string | undefined {
  if (entity === undefined) return undefined;
  const parts: string[] = [];
  if (entity.registrationNumber !== null) parts.push(`Reg. ${entity.registrationNumber}`);
  if (entity.vatNumber !== null) parts.push(`VAT ${entity.vatNumber}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Buyer-supplied purchase-order reference for display. A value that is blank once trimmed is
 * treated as absent so no order surface renders an empty reference.
 */
export function formatPurchaseOrderReference(reference: string | undefined): string | undefined {
  if (reference === undefined) return undefined;
  const trimmed = reference.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Fields captured by the trade checkout, all optional on orders placed before it existed. */
export type OrderTradeDetails = {
  deliveryAddress?: PostalAddress;
  billingEntity?: BillingEntitySnapshot;
  deliverySlot?: DeliverySlot;
  purchaseOrderReference?: string;
};

/**
 * Whether an order carries any trade checkout detail worth a section. False for legacy orders, so
 * their detail page renders exactly as it did before these fields existed.
 */
export function hasOrderTradeDetails(order: OrderTradeDetails): boolean {
  return (
    formatAddressLine(order.deliveryAddress) !== undefined ||
    order.billingEntity !== undefined ||
    formatDeliverySlot(order.deliverySlot) !== undefined ||
    formatPurchaseOrderReference(order.purchaseOrderReference) !== undefined
  );
}
