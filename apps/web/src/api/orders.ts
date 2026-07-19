import { apiFetch } from './client';
import {
  OrderDetailResponse,
  OrderListResponse,
  type CancelOrderBody as CancelOrderPayload,
} from '@shop/contracts/orders';

export function getOrder(orderId: string): Promise<OrderDetailResponse> {
  return apiFetch(OrderDetailResponse, `/api/orders/${orderId}`);
}

export function getOrders(page = 1, pageSize = 10): Promise<OrderListResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch(OrderListResponse, `/api/orders?${query}`);
}

export function cancelOrder(
  orderId: string,
  body: CancelOrderPayload,
): Promise<OrderDetailResponse> {
  return apiFetch(OrderDetailResponse, `/api/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(body satisfies CancelOrderPayload),
  });
}
