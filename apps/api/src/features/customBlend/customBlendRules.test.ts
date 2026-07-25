import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOM_BLEND_FEE_CENTS } from '@shop/contracts';
import {
  calculateCustomBlendLinePricing,
  canonicalCustomBlendJson,
  canonicalizeCustomBlendIngredients,
  normalizeCustomBlendSpec,
} from './customBlendRules.js';

void test('normalizes permutations without mutating caller ingredients', () => {
  const input = [
    { variantId: 9, percentage: 15 },
    { variantId: 2, percentage: 20 },
  ];
  const original = structuredClone(input);
  const first = normalizeCustomBlendSpec(1, input);
  const second = normalizeCustomBlendSpec(1, [...input].reverse());

  assert.deepEqual(input, original);
  assert.deepEqual(first.ingredients, [
    { variantId: 2, percentage: 20 },
    { variantId: 9, percentage: 15 },
  ]);
  assert.equal(first.basePercentage, 65);
  assert.equal(first.canonicalJson, '[{"variantId":2,"percentage":20},{"variantId":9,"percentage":15}]');
  assert.equal(first.canonicalJson, second.canonicalJson);
  assert.equal(first.configKey, second.configKey);
  assert.match(first.configKey, /^[a-f0-9]{64}$/);
});

void test('accepts every legal ratio boundary including exact fifty ingredient total', () => {
  assert.deepEqual(normalizeCustomBlendSpec(10, [{ variantId: 20, percentage: 5 }]), {
    ingredients: [{ variantId: 20, percentage: 5 }],
    basePercentage: 95,
    canonicalJson: '[{"variantId":20,"percentage":5}]',
    configKey: '6f1477ddfc768f7ada201533d2ef6a587b1ce17ca9c30cc79f07992e2000d1c0',
  });
  const exactFifty = normalizeCustomBlendSpec(1, [
    { variantId: 2, percentage: 5 },
    { variantId: 3, percentage: 10 },
    { variantId: 4, percentage: 15 },
    { variantId: 5, percentage: 20 },
  ]);
  assert.equal(exactFifty.basePercentage, 50);
  assert.equal(exactFifty.ingredients.length, 4);
});

void test('rejects invalid entries, ratio bounds, duplicate IDs, fifth ingredient, and base ingredient', () => {
  const cases: Array<() => unknown> = [
    () => normalizeCustomBlendSpec(1, []),
    () => normalizeCustomBlendSpec(1, [{ variantId: 2, percentage: 0 }]),
    () => normalizeCustomBlendSpec(1, [{ variantId: 2, percentage: 4 }]),
    () => normalizeCustomBlendSpec(1, [{ variantId: 2, percentage: 51 }]),
    () => normalizeCustomBlendSpec(1, [{ variantId: 2, percentage: 5.5 }]),
    () => normalizeCustomBlendSpec(1, [{ variantId: 0, percentage: 5 }]),
    () => normalizeCustomBlendSpec(1, [{ variantId: 1, percentage: 5 }]),
    () =>
      normalizeCustomBlendSpec(1, [
        { variantId: 2, percentage: 5 },
        { variantId: 2, percentage: 5 },
      ]),
    () =>
      normalizeCustomBlendSpec(1, [
        { variantId: 2, percentage: 50 },
        { variantId: 3, percentage: 5 },
      ]),
    () =>
      normalizeCustomBlendSpec(1, [
        { variantId: 2, percentage: 5 },
        { variantId: 3, percentage: 5 },
        { variantId: 4, percentage: 5 },
        { variantId: 5, percentage: 5 },
        { variantId: 6, percentage: 5 },
      ]),
  ];
  for (const invalid of cases) assert.throws(invalid, RangeError);
});

void test('canonical JSON sorts input before serializing to prevent identity ambiguity', () => {
  assert.equal(
    canonicalCustomBlendJson([
      { variantId: 3, percentage: 5 },
      { variantId: 2, percentage: 5 },
    ]),
    '[{"variantId":2,"percentage":5},{"variantId":3,"percentage":5}]',
  );
  assert.deepEqual(
    canonicalizeCustomBlendIngredients([
      { variantId: 3, percentage: 5 },
      { variantId: 2, percentage: 5 },
    ]),
    [
      { variantId: 2, percentage: 5 },
      { variantId: 3, percentage: 5 },
    ],
  );
});

void test('splits configured-line pricing with one non-discountable fee', () => {
  assert.deepEqual(calculateCustomBlendLinePricing(2_500, 4), {
    materialSubtotalCents: 10_000,
    blendingFeeCents: CUSTOM_BLEND_FEE_CENTS,
    discountableTotalCents: 10_000,
    lineTotalCents: 12_500,
  });
  assert.deepEqual(calculateCustomBlendLinePricing(0, 1, 0), {
    materialSubtotalCents: 0,
    blendingFeeCents: 0,
    discountableTotalCents: 0,
    lineTotalCents: 0,
  });
});

void test('rejects unsafe custom blend line pricing arithmetic', () => {
  assert.throws(() => calculateCustomBlendLinePricing(-1, 1), RangeError);
  assert.throws(() => calculateCustomBlendLinePricing(1, 0), RangeError);
  assert.throws(() => calculateCustomBlendLinePricing(1, 1, -1), RangeError);
  assert.throws(() => calculateCustomBlendLinePricing(Number.MAX_SAFE_INTEGER, 2, 0), RangeError);
  assert.throws(() => calculateCustomBlendLinePricing(Number.MAX_SAFE_INTEGER, 1, 1), RangeError);
});
