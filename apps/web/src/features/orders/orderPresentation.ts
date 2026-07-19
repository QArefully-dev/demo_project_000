import type { OrderStatus, ShipmentStatus } from '@shop/contracts/orders';

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
