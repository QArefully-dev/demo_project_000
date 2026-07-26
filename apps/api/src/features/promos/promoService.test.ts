import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDiscount } from './promoService.js';

void test('percentage discount uses integer cents and rounds down', () => {
  assert.equal(
    calculateDiscount({
      promo: { kind: 'percent', discountPercent: 15 },
      discountableSubtotalCents: 999,
    }),
    149,
  );
});

void test('fixed discount does not exceed subtotal', () => {
  assert.equal(
    calculateDiscount({
      promo: { kind: 'fixed', discountPercent: 0, amountCents: 1_000 },
      discountableSubtotalCents: 499,
    }),
    499,
  );
});

void test('percentage discount ignores blending fees excluded from the discountable base', () => {
  // Cart subtotal 12_500 = 10_000 material + 2_500 blending fee. Only material is discountable.
  assert.equal(
    calculateDiscount({
      promo: { kind: 'percent', discountPercent: 10 },
      discountableSubtotalCents: 10_000,
    }),
    1_000,
  );
});

void test('fixed discount is capped by the discountable subtotal, not the fee-inclusive subtotal', () => {
  assert.equal(
    calculateDiscount({
      promo: { kind: 'fixed', discountPercent: 0, amountCents: 11_000 },
      discountableSubtotalCents: 10_000,
    }),
    10_000,
  );
});
