import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import * as AuthContracts from '../src/auth.js';
import { SignupBody } from '../src/auth.js';
import { Cart, CartIdParam } from '../src/cart.js';
import { Order } from '../src/orders.js';
import {
  PaymentBody,
  PersistedCheckoutQuote,
  PersistedCheckoutQuoteV2,
  PersistedCheckoutQuoteV3,
  PersistedCheckoutQuoteV4,
  parsePersistedCheckoutQuote,
} from '../src/payments.js';
import {
  PowderMixConfigInput,
  PowderMixOrderItem,
  normalizePowderMixOrderItemSnapshot,
  parsePowderMixOrderItemSnapshot,
  parsePowderMixOrderItemSnapshotV1,
  parsePowderMixOrderItemSnapshotV2,
} from '../src/powderizer.js';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const powderMixConfig = {
  components: [
    { productId: '1', percentage: 50 },
    { productId: '3', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'fine',
  customLabel: 'Breakfast blend',
  bagColourScheme: 'solar-flare',
};

const powderMixItem = {
  mixId: uuid,
  components: [
    { productId: '1', productName: 'Protein Powder', percentage: 50, allocatedGrams: 250 },
    { productId: '3', productName: 'Cocoa Powder', percentage: 50, allocatedGrams: 250 },
  ],
  bagSizeGrams: 500,
  fineness: 'fine',
  customLabel: 'Breakfast blend',
  priceVersion: 'powderizer-v1',
  unitPriceCents: 2500,
  quantity: 1,
  lineTotalCents: 2500,
  bagColourScheme: 'solar-flare',
  usageLabel: 'Consumable powder',
};

void test('auth transport rejects unconstrained email and password values', () => {
  assert.equal(
    Value.Check(SignupBody, { email: 'not-an-email', password: '12345678', displayName: 'A' }),
    false,
  );
  assert.equal(
    Value.Check(SignupBody, { email: 'shopper@example.test', password: 'short', displayName: 'A' }),
    false,
  );
  assert.equal(
    Value.Check(SignupBody, {
      email: 'shopper@example.test',
      password: 'password8',
      displayName: 'A',
    }),
    true,
  );
});

void test('cart and payment transports require UUID identifiers and bounded card fields', () => {
  assert.equal(Value.Check(CartIdParam, { cartId: 'cart-123' }), false);
  assert.equal(Value.Check(CartIdParam, { cartId: uuid }), true);

  const payment = {
    cartId: uuid,
    customerName: 'Ada Shopper',
    customerEmail: 'ada@example.test',
    shippingAddress: '1 Example Street, London',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey: uuid,
  };
  assert.equal(Value.Check(PaymentBody, payment), true);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardNumber: '4242-4242-4242-4242' }), true);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardCvc: '1x3' }), false);
  assert.equal(Value.Check(PaymentBody, { ...payment, cardExpiry: '13/99' }), false);
});

void test('Powderizer transport accepts a valid two-component request', () => {
  assert.equal(Value.Check(PowderMixConfigInput, powderMixConfig), true);
  const withoutScheme: Partial<typeof powderMixConfig> = { ...powderMixConfig };
  delete withoutScheme.bagColourScheme;
  assert.equal(Value.Check(PowderMixConfigInput, withoutScheme), true);
  assert.equal(Value.Check(PowderMixConfigInput, { ...powderMixConfig, customLabel: '' }), true);
});

void test('Powderizer input rejects client-provided derived values', () => {
  assert.equal(
    Value.Check(PowderMixConfigInput, { ...powderMixConfig, usageLabel: 'Consumable powder' }),
    false,
  );
  assert.equal(Value.Check(PowderMixConfigInput, { ...powderMixConfig, unitPriceCents: 1 }), false);
  assert.equal(Value.Check(PowderMixConfigInput, { ...powderMixConfig, allocations: [] }), false);
});

void test('Powderizer transport rejects invalid component counts and scalar values', () => {
  assert.equal(
    Value.Check(PowderMixConfigInput, {
      ...powderMixConfig,
      components: powderMixConfig.components.slice(0, 1),
    }),
    false,
  );
  assert.equal(
    Value.Check(PowderMixConfigInput, {
      ...powderMixConfig,
      components: [
        { productId: '1', percentage: 50.5 },
        { productId: '3', percentage: 49.5 },
      ],
    }),
    false,
  );
  assert.equal(Value.Check(PowderMixConfigInput, { ...powderMixConfig, fineness: 'silky' }), false);
  assert.equal(Value.Check(PowderMixConfigInput, { ...powderMixConfig, bagSizeGrams: 750 }), false);
  assert.equal(
    Value.Check(PowderMixConfigInput, { ...powderMixConfig, bagColourScheme: 'brown-paper' }),
    false,
  );
  assert.equal(
    Value.Check(PowderMixConfigInput, { ...powderMixConfig, customLabel: 'x'.repeat(161) }),
    false,
  );
});

void test('cart and order transports accept empty and populated mix item arrays', () => {
  const emptyCart = { id: uuid, items: [], mixItems: [], subtotalCents: 0, totalItems: 0 };
  assert.equal(Value.Check(Cart, emptyCart), true);
  assert.equal(
    Value.Check(Cart, {
      ...emptyCart,
      mixItems: [powderMixItem],
      subtotalCents: 2500,
      totalItems: 1,
    }),
    true,
  );

  const emptyOrder = {
    id: '1',
    status: 'processing',
    version: 0,
    items: [],
    mixItems: [],
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    promoApplied: null,
    createdAt: '2026-07-14T00:00:00.000Z',
  };
  assert.equal(Value.Check(Order, emptyOrder), true);
  assert.equal(
    Value.Check(Order, {
      ...emptyOrder,
      mixItems: [{ ...powderMixItem, lineId: '2', snapshotVersion: 2 }],
      subtotalCents: 2500,
      totalCents: 2500,
    }),
    true,
  );
  const rawV1 = { ...powderMixItem, snapshotVersion: 1 };
  delete (rawV1 as Partial<typeof rawV1>).bagColourScheme;
  delete (rawV1 as Partial<typeof rawV1>).usageLabel;
  assert.equal(Value.Check(Order, { ...emptyOrder, mixItems: [rawV1] }), false);
  assert.equal(
    Value.Check(Order, {
      ...emptyOrder,
      mixItems: [
        {
          ...rawV1,
          lineId: '2',
          bagColourScheme: 'ultraviolet-cyan',
          usageLabel: 'Check ingredient labels',
        },
      ],
    }),
    true,
  );
});

void test('order mix snapshots parse strict v1 and v2 compatibility forms', () => {
  const v1 = { ...powderMixItem, snapshotVersion: 1 };
  delete (v1 as Partial<typeof v1>).bagColourScheme;
  delete (v1 as Partial<typeof v1>).usageLabel;
  assert.equal(Value.Check(PowderMixOrderItem, v1), true);
  const normalizedV1 = {
    ...v1,
    bagColourScheme: 'ultraviolet-cyan',
    usageLabel: 'Check ingredient labels',
  };
  assert.deepEqual(parsePowderMixOrderItemSnapshotV1(v1), v1);
  assert.deepEqual(
    normalizePowderMixOrderItemSnapshot(parsePowderMixOrderItemSnapshotV1(v1)),
    normalizedV1,
  );
  assert.deepEqual(parsePowderMixOrderItemSnapshot(v1), normalizedV1);
  assert.throws(() => parsePowderMixOrderItemSnapshotV1(normalizedV1));

  const v2 = { ...powderMixItem, snapshotVersion: 2 };
  assert.equal(Value.Check(PowderMixOrderItem, v2), true);
  assert.deepEqual(parsePowderMixOrderItemSnapshotV2(v2), v2);
  assert.deepEqual(parsePowderMixOrderItemSnapshot(v2), v2);
  assert.throws(() => parsePowderMixOrderItemSnapshotV2(v1));
  assert.equal(Value.Check(PowderMixOrderItem, { ...v2, unexpectedPersistedField: true }), false);
});

void test('persisted checkout quotes preserve strict v1-v3 and write inventory split in v4', () => {
  const baseQuote = {
    cartId: uuid,
    customer: {
      name: 'Ada Shopper',
      email: 'ada@example.test',
      shippingAddress: '1 Example Street, London',
    },
    userId: null,
    promoCode: null,
    subtotalCents: 2500,
    discountCents: 0,
    totalCents: 2500,
    lines: [],
    createdAt: '2026-07-14T00:00:00.000Z',
  };
  const legacyV1Mix = { ...powderMixItem, snapshotVersion: 1 };
  delete (legacyV1Mix as Partial<typeof legacyV1Mix>).bagColourScheme;
  delete (legacyV1Mix as Partial<typeof legacyV1Mix>).usageLabel;
  const v2 = { ...baseQuote, version: 2, mixLines: [legacyV1Mix] };
  const v3 = { ...baseQuote, version: 3, mixLines: [{ ...powderMixItem, snapshotVersion: 2 }] };
  const v4 = {
    ...baseQuote,
    version: 4,
    mixLines: [{ ...powderMixItem, snapshotVersion: 2 }],
    inventoryAllocations: [{ productId: '1', reservedQuantity: 1, backorderedQuantity: 0 }],
  };

  assert.equal(Value.Check(PersistedCheckoutQuote, { ...baseQuote, version: 1 }), true);
  assert.equal(Value.Check(PersistedCheckoutQuoteV2, v2), true);
  assert.equal(Value.Check(PersistedCheckoutQuoteV3, v3), true);
  assert.equal(Value.Check(PersistedCheckoutQuoteV4, v4), true);
  assert.deepEqual(parsePersistedCheckoutQuote({ ...baseQuote, version: 1 }), {
    ...baseQuote,
    version: 1,
  });
  assert.deepEqual(parsePersistedCheckoutQuote(v2), v2);
  assert.deepEqual(parsePersistedCheckoutQuote(v3), v3);
  assert.deepEqual(parsePersistedCheckoutQuote(v4), v4);
  assert.equal(Value.Check(PersistedCheckoutQuoteV2, { ...v2, mixLines: v3.mixLines }), false);
  assert.equal(
    Value.Check(PersistedCheckoutQuoteV3, { ...v3, unexpectedPersistedField: true }),
    false,
  );
  assert.throws(() => parsePersistedCheckoutQuote({ ...v3, unexpectedPersistedField: true }));
});

void test('current-user transport contract accepts public user or null', () => {
  assert.ok('CurrentUserResponse' in AuthContracts, 'Missing CurrentUserResponse contract');
  const schema = (AuthContracts as Record<string, unknown>).CurrentUserResponse;
  assert.ok(schema && typeof schema === 'object');
  assert.equal(Value.Check(schema as Parameters<typeof Value.Check>[0], null), true);
  assert.equal(
    Value.Check(schema as Parameters<typeof Value.Check>[0], {
      id: '1',
      email: 'shopper@example.test',
      displayName: 'Shopper',
      role: 'customer',
    }),
    true,
  );
});
