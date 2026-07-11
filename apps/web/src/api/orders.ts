import { apiFetch } from './client';
import type {
  PlaceOrderBody,
  PlaceOrderResponse,
  OrderDetailResponse,
} from '@shop/contracts';

/**
 * Orders (legacy checkout) API module.
 */

export function placeOrder(body: PlaceOrderBody): Promise<PlaceOrderResponse> {
  return apiFetch<PlaceOrderResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getOrder(orderId: string): Promise<OrderDetailResponse> {
  return apiFetch<OrderDetailResponse>(`/api/orders/${orderId}`);
}
