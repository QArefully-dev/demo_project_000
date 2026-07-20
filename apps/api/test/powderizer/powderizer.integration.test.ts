import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PowderMixQuote,
  PowderizerConfigResponse,
  PowderizerValidationErrorResponse,
} from '@shop/contracts/powderizer';
import { Value } from '@sinclair/typebox/value';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import { createCart } from '../../src/features/cart/cartService.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { createPowderizerService } from '../../src/features/powderizer/powderizerService.js';
import { PowderMixDomainError } from '../../src/features/powderizer/powderizerTypes.js';

const validMix = {
  components: [
    { productId: '1', percentage: 50 },
    { productId: '2', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'standard',
  customLabel: ' Morning blend ',
} as const;

function createFixture(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-powderizer-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const carts = createCartRepository(db);
  const mixes = createPowderMixRepository(db);
  const powderizer = createPowderizerService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products: createProductRepository(db),
    mixes,
    utcDateProvider: () => new Date('1970-01-01T12:00:00.000Z'),
  });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  return { db, carts, mixes, powderizer };
}

void test('Powderizer config and anonymous quotes expose all safe server-authoritative options', async (t) => {
  const { db, powderizer } = createFixture(t);
  const app = await buildApp({
    db,
    resetBaseUrl: 'http://web.test',
    clock: { now: () => new Date('1970-01-01T12:00:00.000Z') },
  });
  t.after(() => app.close());

  const before = (
    db.prepare('SELECT COUNT(*) AS count FROM powder_mixes').get() as { count: number }
  ).count;
  const config = await app.inject({ method: 'GET', url: '/api/powderizer/config' });
  assert.equal(config.statusCode, 200);
  const configBody = Value.Parse(PowderizerConfigResponse, config.json());
  assert.equal(configBody.eligibleProducts.length > 0, true);
  assert.deepEqual(
    new Set(configBody.eligibleProducts.map((product) => product.category)).size > 0,
    true,
  );
  assert.deepEqual(configBody.bagSizesGrams, [250, 500, 1000]);
  assert.deepEqual(configBody.finenessValues, ['coarse', 'standard', 'fine']);
  assert.deepEqual(configBody.bagColourSchemes, [
    'ultraviolet-cyan',
    'solar-flare',
    'deep-space',
    'acid-lilac',
    'monochrome-glitch',
  ]);
  assert.equal(configBody.defaultBagColourScheme, 'ultraviolet-cyan');
  assert.equal(configBody.dailyRecipe.effectiveDate, '2026-01-01');
  assert.equal(configBody.dailyRecipe.name, 'Pantry Starter');
  assert.equal(configBody.labelMaxGraphemes, 40);
  assert.equal(configBody.priceVersion, 'powderizer-v1');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM powder_mixes').get() as { count: number }).count,
    before,
  );

  const quote = powderizer.quote(validMix);
  assert.deepEqual(quote.config.components, validMix.components);
  assert.equal(quote.config.bagColourScheme, 'ultraviolet-cyan');
  assert.equal(quote.usageLabel, 'Consumable powder');
  assert.deepEqual(quote.allocations, [
    { productId: '1', percentage: 50, allocatedGrams: 250 },
    { productId: '2', percentage: 50, allocatedGrams: 250 },
  ]);

  const httpQuote = await app.inject({
    method: 'POST',
    url: '/api/powderizer/quote',
    payload: validMix,
  });
  assert.equal(httpQuote.statusCode, 200);
  assert.deepEqual(Value.Parse(PowderMixQuote, httpQuote.json()), quote);

  const invalidQuote = await app.inject({
    method: 'POST',
    url: '/api/powderizer/quote',
    payload: { ...validMix, bagColourScheme: 'unknown-scheme' },
  });
  assert.equal(invalidQuote.statusCode, 400);
  assert.equal(
    Value.Parse(PowderizerValidationErrorResponse, invalidQuote.json()).code,
    'MIX_BAG_COLOUR_INVALID',
  );

  const derivedFieldQuote = await app.inject({
    method: 'POST',
    url: '/api/powderizer/quote',
    payload: { ...validMix, usageLabel: 'Not for consumption' },
  });
  assert.equal(derivedFieldQuote.statusCode, 400);
});

void test('Powderizer derives safety labels and prices non-food same-group products', (t) => {
  const { db, powderizer } = createFixture(t);
  const unsafeQuote = powderizer.quote({
    components: [
      { productId: '27', percentage: 50 },
      { productId: '28', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
  });
  assert.equal(unsafeQuote.usageLabel, 'Not for consumption');
  assert.ok(unsafeQuote.unitPriceCents > 0);

  db.prepare('UPDATE products SET mixable = 0 WHERE id = 28').run();
  assert.throws(
    () =>
      powderizer.quote({
        components: [
          { productId: '27', percentage: 50 },
          { productId: '28', percentage: 50 },
        ],
        bagSizeGrams: 500,
        fineness: 'standard',
      }),
    (error: unknown) =>
      error instanceof PowderMixDomainError && error.code === 'MIX_COMPONENT_INELIGIBLE',
  );
  assert.equal(
    powderizer.config().eligibleProducts.some((product) => product.id === '28'),
    false,
  );
});

void test('Powderizer persists anonymous mix mutations atomically and requotes from current prices', (t) => {
  const { db, carts, mixes, powderizer } = createFixture(t);
  const { cartId } = createCart(carts);

  const mixId = powderizer.create(cartId, validMix);
  assert.equal(typeof mixId, 'string');
  if (typeof mixId !== 'string') throw new Error('Expected mix ID');
  assert.equal(mixes.find(cartId, mixId)?.custom_label, 'Morning blend');
  assert.equal(mixes.find(cartId, mixId)?.bag_colour_scheme, 'ultraviolet-cyan');
  assert.deepEqual(mixes.listComponents(mixId), [
    { mix_id: mixId, product_id: 1, percentage: 50, allocated_grams: 250 },
    { mix_id: mixId, product_id: 2, percentage: 50, allocated_grams: 250 },
  ]);

  assert.equal(powderizer.updateQuantity(cartId, mixId, 3), undefined);
  assert.equal(mixes.find(cartId, mixId)?.quantity, 3);
  db.prepare('UPDATE products SET price_cents = price_cents + 100 WHERE id = 1').run();
  const oldPrice = mixes.find(cartId, mixId)?.quoted_unit_price_cents;
  assert.equal(powderizer.requote(cartId, mixId), undefined);
  assert.notEqual(mixes.find(cartId, mixId)?.quoted_unit_price_cents, oldPrice);

  const beforeFailedEdit = mixes.listComponents(mixId);
  assert.throws(
    () =>
      powderizer.update(cartId, mixId, {
        ...validMix,
        components: [{ productId: '1', percentage: 100 }],
      }),
    (error: unknown) =>
      error instanceof PowderMixDomainError && error.code === 'MIX_COMPONENT_COUNT',
  );
  assert.deepEqual(mixes.listComponents(mixId), beforeFailedEdit);

  assert.equal(powderizer.updateQuantity(cartId, mixId, 0), undefined);
  assert.equal(mixes.find(cartId, mixId), undefined);
});

void test('Powderizer rejects unavailable inputs and cart mutation conflicts', (t) => {
  const { db, carts, powderizer } = createFixture(t);
  assert.equal(powderizer.create(crypto.randomUUID(), validMix), 'CART_NOT_FOUND');
  const { cartId } = createCart(carts);
  const paymentKey = crypto.randomUUID();
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES (?, 'powderizer-test', 'pending', 1, '4242', 'Visa')`,
  ).run(paymentKey);
  carts.reserve(cartId, paymentKey, new Date().toISOString());
  assert.equal(powderizer.create(cartId, validMix), 'CART_RESERVED');

  const unrestrictedCart = createCart(carts).cartId;
  for (const invalid of [
    {
      ...validMix,
      components: [
        { productId: '1', percentage: 50 },
        { productId: '1', percentage: 50 },
      ],
    },
    {
      ...validMix,
      components: [
        { productId: '1', percentage: 50 },
        { productId: '999999', percentage: 50 },
      ],
    },
    {
      ...validMix,
      bagColourScheme: 'not-a-real-scheme',
    },
  ]) {
    assert.throws(
      () => powderizer.create(unrestrictedCart, invalid),
      (error: unknown) => error instanceof PowderMixDomainError,
    );
  }
  assert.equal(powderizer.remove(unrestrictedCart, crypto.randomUUID()), 'MIX_NOT_FOUND');
});

void test('Powderizer excludes inactive components from new selection and requotes', (t) => {
  const { db, carts, powderizer } = createFixture(t);
  const cartId = createCart(carts).cartId;
  const mixId = powderizer.create(cartId, validMix);
  assert.equal(typeof mixId, 'string');
  if (typeof mixId !== 'string') throw new Error('Expected mix ID');

  db.prepare('UPDATE products SET active = 0 WHERE id = 1').run();
  assert.equal(
    powderizer.config().eligibleProducts.some((product) => product.id === '1'),
    false,
  );
  assert.throws(
    () => powderizer.quote(validMix),
    (error: unknown) =>
      error instanceof PowderMixDomainError && error.code === 'MIX_COMPONENT_INELIGIBLE',
  );
  assert.throws(
    () => powderizer.requote(cartId, mixId),
    (error: unknown) =>
      error instanceof PowderMixDomainError && error.code === 'MIX_COMPONENT_INELIGIBLE',
  );
});

void test('Powderizer rejects cross-group mixes', (t) => {
  const { powderizer } = createFixture(t);
  assert.throws(
    () =>
      powderizer.quote({
        components: [
          { productId: '1', percentage: 50 },
          { productId: '27', percentage: 50 },
        ],
        bagSizeGrams: 500,
        fineness: 'standard',
      }),
    (error: unknown) =>
      error instanceof PowderMixDomainError && error.code === 'MIXING_GROUP_MISMATCH',
  );
});
