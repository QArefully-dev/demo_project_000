import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDiscount } from './promoService.js';

void test('percentage discount uses integer cents and rounds down', () => {
  assert.equal(
    calculateDiscount({
      promo: { kind: 'percent', discountPercent: 15 },
      subtotalCents: 999,
    }),
    149,
  );
});

void test('fixed discount does not exceed subtotal', () => {
  assert.equal(
    calculateDiscount({
      promo: { kind: 'fixed', discountPercent: 0, amountCents: 1_000 },
      subtotalCents: 499,
    }),
    499,
  );
});
