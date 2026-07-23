import assert from 'node:assert/strict';
import test from 'node:test';
import { PALLET_WEIGHT_GRAMS, SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import {
  perTonneCents,
  resolveTierDiscountPct,
  resolveUnitPriceCents,
  validateMoq,
} from './pricingRules.js';

void test('resolves discount tiers at exact tonne boundaries', () => {
  const tenKilogramPackGrams = 10_000;
  const packQuantityFor = (tonnes: number) => (tonnes * PALLET_WEIGHT_GRAMS) / tenKilogramPackGrams;

  assert.equal(resolveTierDiscountPct(packQuantityFor(4.99), tenKilogramPackGrams), 0);
  assert.equal(resolveTierDiscountPct(packQuantityFor(5), tenKilogramPackGrams), 5);
  assert.equal(resolveTierDiscountPct(packQuantityFor(9.99), tenKilogramPackGrams), 5);
  assert.equal(resolveTierDiscountPct(packQuantityFor(10), tenKilogramPackGrams), 10);
});

void test('uses the highest qualifying tier for pallet and zero/one quantities', () => {
  assert.equal(resolveTierDiscountPct(0, SACK_WEIGHT_GRAMS), 0);
  assert.equal(resolveTierDiscountPct(1, SACK_WEIGHT_GRAMS), 0);
  assert.equal(resolveTierDiscountPct(1, PALLET_WEIGHT_GRAMS), 0);
  assert.equal(resolveTierDiscountPct(10, PALLET_WEIGHT_GRAMS), 10);
});

void test('chooses the highest qualifying minimum rather than the largest discount value', () => {
  assert.equal(
    resolveTierDiscountPct(10, PALLET_WEIGHT_GRAMS, [
      { minTonnes: 1, discountPct: 20 },
      { minTonnes: 10, discountPct: 10 },
    ]),
    10,
  );
});

void test('resolves unit prices from base price with integer half-up rounding', () => {
  assert.equal(resolveUnitPriceCents(101, 200, SACK_WEIGHT_GRAMS), 96);
  assert.equal(resolveUnitPriceCents(101, 400, SACK_WEIGHT_GRAMS), 91);
  assert.equal(resolveUnitPriceCents(101, 0, SACK_WEIGHT_GRAMS), 101);
});

void test('derives pre-tier per-tonne prices with integer half-up rounding', () => {
  assert.equal(perTonneCents(1, 32_000), 31);
  assert.equal(perTonneCents(101, SACK_WEIGHT_GRAMS), 4_040);
});

void test('validates MOQ as a total weight floor', () => {
  assert.equal(validateMoq(3, SACK_WEIGHT_GRAMS), false);
  assert.equal(validateMoq(4, SACK_WEIGHT_GRAMS), true);
  assert.equal(validateMoq(0, SACK_WEIGHT_GRAMS), false);
  assert.equal(validateMoq(1, SACK_WEIGHT_GRAMS), false);
  assert.equal(validateMoq(1, PALLET_WEIGHT_GRAMS), true);
  assert.equal(validateMoq(3, SACK_WEIGHT_GRAMS, 3), true);
});

void test('rejects invalid numeric inputs', () => {
  assert.throws(() => resolveTierDiscountPct(-1, SACK_WEIGHT_GRAMS), RangeError);
  assert.throws(() => resolveUnitPriceCents(-1, 1, SACK_WEIGHT_GRAMS), RangeError);
  assert.throws(() => perTonneCents(1, 0), RangeError);
  assert.throws(() => validateMoq(1, SACK_WEIGHT_GRAMS, 0), RangeError);
});
