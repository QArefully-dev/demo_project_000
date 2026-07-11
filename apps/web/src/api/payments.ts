import { apiFetch } from './client';
import type { PaymentBody, PlaceOrderResponse } from '@shop/contracts';

/**
 * Payment API module — stub (Wave 0).
 * Returns 501 at this stage.
 * Real implementation deferred to W1.D.
 */

export function pay(body: PaymentBody): Promise<PlaceOrderResponse> {
  return apiFetch<PlaceOrderResponse>('/api/payments/pay', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
