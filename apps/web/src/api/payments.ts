import { apiFetch } from './client';
import type { PaymentBody, PlaceOrderResponse } from '@shop/contracts';

/**
 * Payment API module.
 * Submits a payment through the gateway endpoint.
 * On success returns the created order. On failure throws with status-based errors:
 * - 400: bad request / promo invalid
 * - 402: card declined or gateway timeout
 * - 409: idempotency conflict (reused key with changed payload)
 */

export function pay(body: PaymentBody): Promise<PlaceOrderResponse> {
  return apiFetch<PlaceOrderResponse>('/api/payments/pay', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
