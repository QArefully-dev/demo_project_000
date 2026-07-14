import { apiFetch } from './client';
import { PaymentSuccessResponse } from '@shop/contracts/payments';
import type { PaymentBody } from '@shop/contracts/payments';

/**
 * Payment API module.
 * Submits a payment through the gateway endpoint.
 * On success returns the created order. On failure throws with status-based errors:
 * - 400: bad request / promo invalid
 * - 402: card declined or gateway timeout
 * - 409: idempotency conflict (reused key with changed payload)
 */

export function pay(body: PaymentBody) {
  return apiFetch(PaymentSuccessResponse, '/api/payments/pay', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
