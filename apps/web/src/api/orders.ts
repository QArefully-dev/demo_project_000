import { apiFetch } from './client';
import type { OrderDetailResponse } from '@shop/contracts/orders';

export function getOrder(orderId: string): Promise<OrderDetailResponse> {
  return apiFetch<OrderDetailResponse>(`/api/orders/${orderId}`);
}
