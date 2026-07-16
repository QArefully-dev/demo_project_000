import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocatePowderMixGrams,
  calculatePowderMixStockRequirements,
  createPowderMixQuoteKey,
  derivePowderMixUsageLabel,
  normalizePowderMixBagColourScheme,
  normalizePowderMixConfig,
  normalizePowderMixLabel,
  parsePowderMixPriceVersion,
  quotePowderMix,
} from './powderMixRules.js';
import { PowderMixDomainError, type PowderMixProduct } from './powderizerTypes.js';

const products: readonly PowderMixProduct[] = [
  { id: 2, name: 'Cocoa', priceCents: 699, mixable: true, mixUnitGrams: 250 },
  { id: 3, name: 'Protein', priceCents: 1_299, mixable: true, mixUnitGrams: 500 },
  { id: 5, name: 'Matcha', priceCents: 899, mixable: true, mixUnitGrams: 100 },
  { id: 7, name: 'Oat', priceCents: 499, mixable: true, mixUnitGrams: 1000 },
  { id: 11, name: 'Spice', priceCents: 399, mixable: true, mixUnitGrams: 200 },
  { id: 99, name: 'Bleach', priceCents: 599, mixable: false, mixUnitGrams: null },
];

const validInput = {
  components: [
    { productId: '3', percentage: 50 },
    { productId: '2', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'fine',
  customLabel: '  Breakfast blend  ',
};

function expectCode(code: PowderMixDomainError['code'], action: () => unknown): void {
  assert.throws(
    action,
    (error: unknown) => error instanceof PowderMixDomainError && error.code === code,
  );
}

void test('normalizes valid two, three, and five component mixes into product ID order', () => {
  const two = normalizePowderMixConfig(validInput, products);
  assert.deepEqual(two.components, [
    { productId: 2, percentage: 50 },
    { productId: 3, percentage: 50 },
  ]);
  assert.equal(two.customLabel, 'Breakfast blend');
  assert.equal(two.bagColourScheme, 'ultraviolet-cyan');

  const three = normalizePowderMixConfig(
    {
      ...validInput,
      components: [
        { productId: '5', percentage: 34 },
        { productId: '3', percentage: 33 },
        { productId: '2', percentage: 33 },
      ],
    },
    products,
  );
  assert.equal(three.components.length, 3);

  const five = normalizePowderMixConfig(
    {
      ...validInput,
      components: [
        { productId: '11', percentage: 20 },
        { productId: '7', percentage: 20 },
        { productId: '5', percentage: 20 },
        { productId: '3', percentage: 20 },
        { productId: '2', percentage: 20 },
      ],
    },
    products,
  );
  assert.deepEqual(
    five.components.map((component) => component.productId),
    [2, 3, 5, 7, 11],
  );
});

void test('normalizes all bag colour schemes and includes them in quote identity only', () => {
  for (const bagColourScheme of [
    'ultraviolet-cyan',
    'solar-flare',
    'deep-space',
    'acid-lilac',
    'monochrome-glitch',
  ]) {
    assert.equal(normalizePowderMixBagColourScheme(bagColourScheme), bagColourScheme);
  }
  expectCode('MIX_BAG_COLOUR_INVALID', () => normalizePowderMixBagColourScheme('brown-paper'));

  const defaultQuote = quotePowderMix(validInput, products);
  const alternateQuote = quotePowderMix({ ...validInput, bagColourScheme: 'deep-space' }, products);
  assert.notEqual(
    createPowderMixQuoteKey(defaultQuote.config),
    createPowderMixQuoteKey(alternateQuote.config),
  );
  assert.equal(defaultQuote.unitPriceCents, alternateQuote.unitPriceCents);
  assert.deepEqual(defaultQuote.allocations, alternateQuote.allocations);
});

void test('derives usage labels from canonical warnings without affecting price or allocation', () => {
  assert.equal(derivePowderMixUsageLabel(products), 'Consumable powder');
  const unsafeProducts = products.map((product) =>
    product.id === 2 ? { ...product, consumptionWarning: 'Not for consumption' as const } : product,
  );
  const safeQuote = quotePowderMix(validInput, products);
  const unsafeQuote = quotePowderMix(validInput, unsafeProducts);
  assert.equal(safeQuote.usageLabel, 'Consumable powder');
  assert.equal(unsafeQuote.usageLabel, 'Not for consumption');
  assert.equal(unsafeQuote.unitPriceCents, safeQuote.unitPriceCents);
  assert.deepEqual(unsafeQuote.allocations, safeQuote.allocations);
});

void test('rejects every config validation category', () => {
  expectCode('MIX_COMPONENT_COUNT', () =>
    normalizePowderMixConfig({ ...validInput, components: [] }, products),
  );
  expectCode('MIX_COMPONENT_COUNT', () =>
    normalizePowderMixConfig(
      {
        ...validInput,
        components: [
          ...validInput.components,
          { productId: '5', percentage: 1 },
          { productId: '7', percentage: 1 },
          { productId: '11', percentage: 1 },
          { productId: '2', percentage: 1 },
        ],
      },
      products,
    ),
  );
  expectCode('MIX_DUPLICATE_COMPONENT', () =>
    normalizePowderMixConfig(
      {
        ...validInput,
        components: [
          { productId: '2', percentage: 50 },
          { productId: '2', percentage: 50 },
        ],
      },
      products,
    ),
  );
  for (const [percentage, other, code] of [
    [49, 50, 'MIX_PERCENTAGE_TOTAL'],
    [50, 51, 'MIX_PERCENTAGE_TOTAL'],
    [0, 50, 'MIX_PERCENTAGE_INVALID'],
    [-1, 50, 'MIX_PERCENTAGE_INVALID'],
    [50.5, 50, 'MIX_PERCENTAGE_INVALID'],
  ] as const) {
    expectCode(code, () =>
      normalizePowderMixConfig(
        {
          ...validInput,
          components: [
            { productId: '2', percentage },
            { productId: '3', percentage: other },
          ],
        },
        products,
      ),
    );
  }
  expectCode('MIX_COMPONENT_INELIGIBLE', () =>
    normalizePowderMixConfig(
      {
        ...validInput,
        components: [
          { productId: '99', percentage: 50 },
          { productId: '3', percentage: 50 },
        ],
      },
      products,
    ),
  );
  expectCode('MIX_BAG_SIZE_INVALID', () =>
    normalizePowderMixConfig({ ...validInput, bagSizeGrams: 750 }, products),
  );
  expectCode('MIX_FINENESS_INVALID', () =>
    normalizePowderMixConfig({ ...validInput, fineness: 'dust' }, products),
  );
});

void test('allocation gives 250g fractional remainder to largest fraction, then lowest product ID', () => {
  const config = normalizePowderMixConfig(
    {
      ...validInput,
      bagSizeGrams: 250,
      components: [
        { productId: '5', percentage: 33 },
        { productId: '3', percentage: 33 },
        { productId: '2', percentage: 34 },
      ],
    },
    products,
  );
  assert.deepEqual(allocatePowderMixGrams(config), [
    { productId: 2, percentage: 34, allocatedGrams: 85 },
    { productId: 3, percentage: 33, allocatedGrams: 83 },
    { productId: 5, percentage: 33, allocatedGrams: 82 },
  ]);
  assert.deepEqual(allocatePowderMixGrams({ ...config, bagSizeGrams: 500 }), [
    { productId: 2, percentage: 34, allocatedGrams: 170 },
    { productId: 3, percentage: 33, allocatedGrams: 165 },
    { productId: 5, percentage: 33, allocatedGrams: 165 },
  ]);
  assert.deepEqual(allocatePowderMixGrams({ ...config, bagSizeGrams: 1000 }), [
    { productId: 2, percentage: 34, allocatedGrams: 340 },
    { productId: 3, percentage: 33, allocatedGrams: 330 },
    { productId: 5, percentage: 33, allocatedGrams: 330 },
  ]);
});

void test('quotes exact v1 pricing with integer ceiling charges', () => {
  const quote = quotePowderMix(validInput, products);
  assert.equal(quote.priceVersion, 'powderizer-v1');
  assert.equal(quote.packagingFeeCents, 400);
  assert.equal(quote.finenessSurchargeCents, 0);
  // Cocoa: ceil(699 * 250 / 250) = 699; Protein: ceil(1299 * 250 / 500) = 650.
  assert.equal(quote.unitPriceCents, 1_749);
  assert.equal(quotePowderMix({ ...validInput, bagSizeGrams: 250 }, products).unitPriceCents, 925);
  assert.equal(
    quotePowderMix({ ...validInput, bagSizeGrams: 1000 }, products).unitPriceCents,
    3_297,
  );
  expectCode('MIX_REQUOTE_REQUIRED', () => parsePowderMixPriceVersion('powderizer-v2'));
});

void test('normalizes labels by graphemes and rejects unsafe text', () => {
  assert.equal(normalizePowderMixLabel(''), null);
  assert.equal(normalizePowderMixLabel('  e\u0301  '), 'é');
  assert.equal(normalizePowderMixLabel('👍🏽'.repeat(40)), '👍🏽'.repeat(40));
  expectCode('MIX_LABEL_INVALID', () => normalizePowderMixLabel('👍🏽'.repeat(41)));
  expectCode('MIX_LABEL_INVALID', () => normalizePowderMixLabel('<b>unsafe</b>'));
  expectCode('MIX_LABEL_INVALID', () => normalizePowderMixLabel('unsafe\u0000'));
  expectCode('MIX_LABEL_INVALID', () => normalizePowderMixLabel('unsafe\u200B'));
});

void test('aggregates quantity-aware bag equivalent stock across mix lines', () => {
  const first = quotePowderMix(validInput, products);
  const second = quotePowderMix(
    {
      ...validInput,
      components: [
        { productId: '2', percentage: 25 },
        { productId: '3', percentage: 75 },
      ],
      bagSizeGrams: 250,
    },
    products,
  );
  assert.deepEqual(
    calculatePowderMixStockRequirements(
      [
        { allocations: first.allocations, quantity: 2 },
        { allocations: second.allocations, quantity: 3 },
      ],
      products,
    ),
    [
      { productId: 2, bagEquivalents: 3 },
      { productId: 3, bagEquivalents: 3 },
    ],
  );
});
