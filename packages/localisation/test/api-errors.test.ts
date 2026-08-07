import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLIC_ERROR_CODES } from '@shop/contracts/public-errors';
import { SUPPORTED_COUNTRIES } from '@shop/contracts/country';
import { translate } from '../src/index.js';
import { apiErrors } from '../src/messages/apiErrors.js';

void test('API error catalog has every public code in every country', () => {
  assert.deepEqual(Object.keys(apiErrors).sort(), [...PUBLIC_ERROR_CODES].sort());
  for (const code of PUBLIC_ERROR_CODES) {
    const entries = apiErrors[code];
    assert.deepEqual(Object.keys(entries).sort(), [...SUPPORTED_COUNTRIES].sort(), code);
    for (const country of SUPPORTED_COUNTRIES) {
      const params =
        code === 'RATE_LIMITED'
          ? { retryAfterSeconds: 30 }
          : code === 'BELOW_MOQ'
            ? { minQuantity: 2 }
            : code === 'PROMO_MIN_SUBTOTAL'
              ? { minSubtotalCents: 1_000 }
              : code === 'RESERVATION_EXPIRED'
                ? { reservationExpiresAt: '2026-01-02T23:30:00.000Z' }
                : code === 'DELIVERY_SLOT_UNAVAILABLE'
                  ? { earliestDate: '2026-01-02' }
                  : code === 'PENDING_APPROVAL'
                    ? { approvalRequestId: '14' }
                    : {};
      assert.notEqual(translate(apiErrors, country, code, params), '', `${code}.${country}`);
    }
  }
});

void test('placeholder-bearing public errors retain interpolation parity', () => {
  assert.equal(
    translate(apiErrors, 'UK', 'DELIVERY_SLOT_UNAVAILABLE', { earliestDate: '2026-01-02' }),
    'That delivery slot is unavailable. Earliest date: 2026-01-02.',
  );
  assert.equal(
    translate(apiErrors, 'DE', 'PENDING_APPROVAL', { approvalRequestId: '14' }),
    'Eine Genehmigung ist erforderlich (Anfrage 14).',
  );
  assert.throws(
    () => translate(apiErrors, 'UK', 'RATE_LIMITED'),
    /Missing parameter \{retryAfterSeconds\}/,
  );
});
