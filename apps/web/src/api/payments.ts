import { apiFetch } from './client';
import { PaymentSuccessResponse } from '@shop/contracts/payments';
import type { PaymentBody } from '@shop/contracts/payments';

/**
 * Payment API module.
 * Submits a payment through the gateway endpoint.
 *
 * The body carries the destination and billing party as discriminated unions: a `saved` selection
 * sends only an identifier, because the server loads the stored record and ignores any address the
 * client holds. The delivery slot is one the server offered and is re-validated at payment.
 *
 * On success returns the created order. On failure throws with status-based errors:
 * - 400: bad request / promo invalid / delivery site or billing entity not resolvable
 * - 402: card declined or gateway timeout
 * - 409: idempotency conflict (reused key with changed payload), `INSUFFICIENT_STOCK`,
 *   `RESERVATION_EXPIRED`, or `DELIVERY_SLOT_UNAVAILABLE` (slot no longer bookable; the response
 *   carries the current `earliestDate`). No reservation is held and no money moves on a 409.
 */

export function pay(body: PaymentBody) {
  return apiFetch(PaymentSuccessResponse, '/api/payments/pay', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
