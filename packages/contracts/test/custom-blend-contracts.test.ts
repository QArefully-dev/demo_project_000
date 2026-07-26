import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import {
  CartLineConfigKey,
  CreateCustomBlendBody,
  CustomBlendOption,
  CustomBlendSnapshot,
  ReplaceCustomBlendBody,
} from '../src/customBlends.js';
import { Cart, CartLine, RemoveFromCartBody, UpdateCartLineBody } from '../src/cart.js';
import { OrderLineItem } from '../src/orders.js';
import { PersistedCheckoutQuoteV6, parsePersistedCheckoutQuote } from '../src/payments.js';
import { CUSTOM_BLEND_FEE_CENTS, TIER_LADDER } from '../src/pricing.js';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const configKey = 'a'.repeat(64);

const customBlend = {
  configKey,
  basePercentage: 80,
  mixingGroup: 'food-grade',
  ingredients: [
    {
      variantId: 2,
      productId: '2',
      productName: 'Cocoa powder',
      productDescription: 'Unsweetened cocoa powder',
      mixingGroup: 'food-grade',
      percentage: 20,
    },
  ],
  blendingFeeCents: CUSTOM_BLEND_FEE_CENTS,
  madeToOrder: true,
  returnable: false,
};

const product = {
  id: '1',
  name: 'Protein powder',
  description: 'Base material',
  priceCents: 2500,
  imageSetId: 'protein-powder',
  category: 'Sports Nutrition',
  stock: 10,
  availability: 'in_stock',
  backorderable: false,
  backorderLeadDays: null,
  slug: 'protein-powder',
  salesCount: 1,
  createdAt: '2026-07-25T00:00:00.000Z',
  available: true,
  tags: [],
  specificationGroups: [],
};

void test('Custom Blend inputs enforce integer percentage bounds and strict config keys', () => {
  const create = { baseVariantId: 1, ingredients: [{ variantId: 2, percentage: 20 }] };
  assert.equal(Value.Check(CreateCustomBlendBody, create), true);
  assert.equal(Value.Check(CreateCustomBlendBody, { ...create, ingredients: [] }), false);
  assert.equal(
    Value.Check(CreateCustomBlendBody, {
      ...create,
      ingredients: [{ variantId: 2, percentage: 4 }],
    }),
    false,
  );
  assert.equal(
    Value.Check(CreateCustomBlendBody, {
      ...create,
      ingredients: [{ variantId: 2, percentage: 20.5 }],
    }),
    false,
  );
  assert.equal(Value.Check(CartLineConfigKey, ''), true);
  assert.equal(Value.Check(CartLineConfigKey, configKey), true);
  assert.equal(Value.Check(CartLineConfigKey, configKey.toUpperCase()), false);
  assert.equal(Value.Check(CartLineConfigKey, 'not-a-config-key'), false);
  assert.equal(
    Value.Check(ReplaceCustomBlendBody, { ...create, configKey, unexpected: true }),
    false,
  );
});

void test('Custom Blend snapshot carries fee and non-returnable made-to-order facts', () => {
  assert.equal(CUSTOM_BLEND_FEE_CENTS, 2500);
  assert.equal(Value.Check(CustomBlendSnapshot, customBlend), true);
  assert.equal(
    Value.Check(CustomBlendSnapshot, {
      ...customBlend,
      blendingFeeCents: Number.MAX_SAFE_INTEGER + 1,
    }),
    false,
  );
  assert.equal(Value.Check(CustomBlendSnapshot, { ...customBlend, madeToOrder: false }), false);
  assert.equal(Value.Check(CustomBlendSnapshot, { ...customBlend, returnable: true }), false);
});

void test('Custom Blend base presentation is optional for legacy snapshots and strict when present', () => {
  const basePresentation = {
    category: 'Trade & Creative Materials',
    consumptionClassification: 'non-food',
    categoryFacts: {
      texture: 'Fine powder',
      colour: 'White',
      source: 'Mineral',
      intendedUse: 'Construction',
      storage: 'Cool dry',
      consumptionClassification: 'non-food',
    },
  };
  assert.equal(Value.Check(CustomBlendSnapshot, customBlend), true);
  assert.equal(Value.Check(CustomBlendSnapshot, { ...customBlend, basePresentation }), true);
  assert.equal(
    Value.Check(CustomBlendSnapshot, {
      ...customBlend,
      basePresentation: { ...basePresentation, unexpected: true },
    }),
    false,
  );
  assert.equal(
    Value.Check(CustomBlendSnapshot, {
      ...customBlend,
      basePresentation: { ...basePresentation, categoryFacts: { texture: 'incomplete' } },
    }),
    false,
  );
});

void test('Custom Blend options require presentation facts and reject unknown properties', () => {
  const option = {
    productId: '1',
    productName: product.name,
    productDescription: product.description,
    category: 'Sports Nutrition',
    consumptionClassification: 'food',
    categoryFacts: {
      texture: 'Fine powder',
      colour: 'White',
      source: 'Plant',
      intendedUse: 'Supplement',
      storage: 'Cool dry',
      consumptionClassification: 'food',
    },
    mixingGroup: 'food-grade',
    variant: {
      variantId: 1,
      productId: 1,
      sku: 'SN-0001-001',
      label: '25kg Sack',
      weightGrams: 25_000,
      priceCents: 2500,
      moqSacks: 1,
      perTonneCents: 100_000,
      priceTiers: TIER_LADDER,
      stockCount: 10,
      backorderable: false,
      backorderLeadDays: null,
      deliveryClass: 'parcel',
      active: true,
      sortOrder: 1,
    },
  };

  assert.equal(Value.Check(CustomBlendOption, option), true);
  assert.equal(Value.Check(CustomBlendOption, { ...option, category: '' }), true);
  assert.equal(Value.Check(CustomBlendOption, { ...option, category: 'x'.repeat(161) }), true);
  assert.equal(Value.Check(CustomBlendOption, { ...option, category: undefined }), false);
  assert.equal(
    Value.Check(CustomBlendOption, { ...option, consumptionClassification: undefined }),
    false,
  );
  assert.equal(Value.Check(CustomBlendOption, { ...option, categoryFacts: undefined }), false);
  assert.equal(Value.Check(CustomBlendOption, { ...option, unexpected: true }), false);
});

void test('configured cart and order lines expose money split and specification', () => {
  const line = {
    productId: '1',
    configKey,
    product,
    variantSnap: {
      variantId: 1,
      sku: 'SN-0001-001',
      label: '25kg Sack',
      weightGrams: 25_000,
      deliveryClass: 'parcel',
    },
    perTonneCents: 100_000,
    resolvedUnitPriceCents: 2500,
    quantity: 4,
    materialSubtotalCents: 10_000,
    blendingFeeCents: 2500,
    discountableTotalCents: 10_000,
    lineTotalCents: 12_500,
    customBlend,
  };
  assert.equal(Value.Check(CartLine, line), true);
  assert.equal(
    Value.Check(CartLine, { ...line, materialSubtotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(
    Value.Check(CartLine, { ...line, blendingFeeCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(
    Value.Check(CartLine, { ...line, discountableTotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(
    Value.Check(CartLine, { ...line, lineTotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(Value.Check(CartLine, { ...line, configKey: '' }), false);
  assert.equal(Value.Check(CartLine, { ...line, customBlend: undefined }), false);
  assert.equal(
    Value.Check(CartLine, { ...line, customBlend: { ...customBlend, configKey: 'b'.repeat(64) } }),
    false,
  );
  const plainLine = { ...line, configKey: '' };
  delete (plainLine as { customBlend?: unknown }).customBlend;
  assert.equal(Value.Check(CartLine, plainLine), true);
  const cart = {
    id: uuid,
    items: [line],
    subtotalCents: 12_500,
    discountableSubtotalCents: 10_000,
    blendingFeeTotalCents: 2500,
    totalItems: 4,
  };
  assert.equal(Value.Check(Cart, cart), true);
  assert.equal(
    Value.Check(Cart, { ...cart, discountableSubtotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(
    Value.Check(Cart, { ...cart, blendingFeeTotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(Value.Check(UpdateCartLineBody, { productId: '1', configKey, quantity: 4 }), true);
  assert.equal(Value.Check(RemoveFromCartBody, { productId: '1', configKey }), true);
  assert.equal(
    Value.Check(UpdateCartLineBody, { productId: '1', quantity: 4, unexpected: true }),
    false,
  );
  assert.equal(Value.Check(RemoveFromCartBody, { productId: '1', unexpected: true }), false);
  const orderLine = {
    lineId: '1',
    productId: '1',
    productName: product.name,
    unitPriceCents: 2500,
    quantity: 4,
    discountableTotalCents: 10_000,
    blendingFeeCents: 2500,
    lineTotalCents: 12_500,
    inventoryStatus: 'allocated',
    allocatedQuantity: 4,
    backorderedQuantity: 0,
    customBlend,
  };
  assert.equal(Value.Check(OrderLineItem, orderLine), true);
  assert.equal(
    Value.Check(OrderLineItem, {
      ...orderLine,
      discountableTotalCents: Number.MAX_SAFE_INTEGER + 1,
    }),
    false,
  );
  assert.equal(
    Value.Check(OrderLineItem, { ...orderLine, blendingFeeCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(
    Value.Check(OrderLineItem, { ...orderLine, lineTotalCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
});

void test('V6 keeps plain quotes readable and round-trips configured variant lines', () => {
  const plain = {
    version: 6,
    cartId: uuid,
    customer: { name: 'Ada', email: 'ada@example.test', shippingAddress: '1 Example Street' },
    userId: null,
    promoCode: null,
    subtotalCents: 2500,
    discountCents: 0,
    totalCents: 2500,
    lines: [],
    createdAt: '2026-07-25T00:00:00.000Z',
    variantLines: [
      {
        productId: '1',
        variantId: 1,
        productName: product.name,
        variantLabel: '25kg Sack',
        unitPriceCents: 2500,
        weightGrams: 25_000,
        deliveryClass: 'parcel',
        quantity: 1,
        lineTotalCents: 2500,
        consumptionClassification: 'food',
      },
    ],
    deliverySummary: { mode: 'parcel', chargeCents: 0, weightGrams: 25_000, reason: 'ok' },
    inventoryAllocations: [{ productId: '1', reservedQuantity: 1, backorderedQuantity: 0 }],
  };
  assert.equal(Value.Check(PersistedCheckoutQuoteV6, plain), true);
  const configured = {
    ...plain,
    subtotalCents: 12_500,
    totalCents: 12_500,
    variantLines: [
      {
        ...plain.variantLines[0],
        quantity: 4,
        materialSubtotalCents: 10_000,
        blendingFeeCents: 2500,
        discountableTotalCents: 10_000,
        lineTotalCents: 12_500,
        customBlend,
      },
    ],
  };
  assert.equal(Value.Check(PersistedCheckoutQuoteV6, configured), true);
  for (const monetaryField of [
    'materialSubtotalCents',
    'blendingFeeCents',
    'discountableTotalCents',
    'lineTotalCents',
  ] as const) {
    assert.equal(
      Value.Check(PersistedCheckoutQuoteV6, {
        ...configured,
        variantLines: [
          { ...configured.variantLines[0], [monetaryField]: Number.MAX_SAFE_INTEGER + 1 },
        ],
      }),
      false,
    );
  }
  assert.deepEqual(parsePersistedCheckoutQuote(configured), configured);
});
