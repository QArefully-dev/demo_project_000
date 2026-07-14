import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import {
  addItem,
  createCart,
  getCart,
  removeItem,
  updateItem,
} from '../../src/features/cart/cartService.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { createPowderizerService } from '../../src/features/powderizer/powderizerService.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';
import { validatePromo } from '../../src/features/promos/promoService.js';

void test('cart service coordinates cart repository and promo eligibility', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const { cartId } = createCart(carts);
  assert.equal(addItem(carts, cartId, '1').id, cartId);
  assert.equal(updateItem(carts, cartId, '1', 2).totalItems, 2);
  assert.equal(
    validatePromo(
      { code: 'SAVE10', cartId, userId: null, now: new Date('2026-07-14T10:00:00.000Z') },
      { carts, promos: createPromoRepository(db) },
    ).errorCode,
    'MIN_ITEMS',
  );
  assert.equal(removeItem(carts, cartId, '1').totalItems, 0);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
  assert.deepEqual(getCart(carts, cartId)?.mixItems, []);
});

void test('cart reads persisted mixes as first-class lines and promos count bag quantity', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-cart-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const mixes = createPowderMixRepository(db);
  const powderizer = createPowderizerService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products: createProductRepository(db),
    mixes,
  });
  const { cartId } = createCart(carts);
  const mixId = powderizer.create(cartId, {
    components: [
      { productId: '1', percentage: 50 },
      { productId: '2', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'fine',
    customLabel: 'Breakfast blend',
  });
  assert.equal(typeof mixId, 'string');
  if (typeof mixId !== 'string') throw new Error('Expected mix ID');
  assert.equal(powderizer.updateQuantity(cartId, mixId, 5), undefined);
  assert.equal(addItem(carts, cartId, '3').id, cartId);

  const cart = getCart(carts, cartId, mixes);
  assert.ok(cart);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.mixItems.length, 1);
  assert.deepEqual(cart.mixItems[0], {
    mixId,
    components: [
      { productId: '1', productName: 'Protein Powder', percentage: 50, allocatedGrams: 250 },
      { productId: '2', productName: 'Powdered Oats', percentage: 50, allocatedGrams: 250 },
    ],
    bagSizeGrams: 500,
    fineness: 'fine',
    customLabel: 'Breakfast blend',
    priceVersion: 'powderizer-v1',
    unitPriceCents: 1715,
    quantity: 5,
    lineTotalCents: 8575,
  });
  assert.equal(cart.totalItems, 6);
  assert.equal(cart.subtotalCents, 8575 + cart.items[0].lineTotalCents);
  assert.equal(
    validatePromo(
      { code: 'SAVE10', cartId, userId: null, now: new Date('2026-07-14T10:00:00.000Z') },
      { carts, mixes, promos: createPromoRepository(db) },
    ).valid,
    true,
  );

  const fiveIngredientCartId = createCart(carts).cartId;
  assert.equal(
    typeof powderizer.create(fiveIngredientCartId, {
      components: [
        { productId: '1', percentage: 20 },
        { productId: '2', percentage: 20 },
        { productId: '3', percentage: 20 },
        { productId: '4', percentage: 20 },
        { productId: '5', percentage: 20 },
      ],
      bagSizeGrams: 500,
      fineness: 'standard',
    }),
    'string',
  );
  assert.equal(
    validatePromo(
      {
        code: 'SAVE10',
        cartId: fiveIngredientCartId,
        userId: null,
        now: new Date('2026-07-14T10:00:00.000Z'),
      },
      { carts, mixes, promos: createPromoRepository(db) },
    ).errorCode,
    'MIN_ITEMS',
  );
});

void test('cart HTTP response preserves product lines and adds mixItems', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-cart-http-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const created = await app.inject({ method: 'POST', url: '/api/cart' });
  const cartId = created.json().cartId as string;
  const product = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: '3' },
  });
  assert.equal(product.statusCode, 200);
  assert.deepEqual(product.json().mixItems, []);

  const createdMix = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/mixes`,
    payload: {
      components: [
        { productId: '1', percentage: 50 },
        { productId: '2', percentage: 50 },
      ],
      bagSizeGrams: 500,
      fineness: 'standard',
    },
  });
  assert.equal(createdMix.statusCode, 200);
  const cart = createdMix.json();
  assert.equal(cart.items.length, 1);
  assert.equal(cart.mixItems.length, 1);
  assert.equal(cart.mixItems[0].lineTotalCents, 1715);
  assert.equal(cart.totalItems, 2);
  assert.equal(cart.subtotalCents, cart.items[0].lineTotalCents + 1715);
});

void test('every mix mutation rejects a reserved cart', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-cart-reserved-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const carts = createCartRepository(db);
  const cartId = createCart(carts).cartId;
  const created = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/mixes`,
    payload: {
      components: [
        { productId: '1', percentage: 50 },
        { productId: '2', percentage: 50 },
      ],
      bagSizeGrams: 500,
      fineness: 'standard',
    },
  });
  assert.equal(created.statusCode, 200);
  const mixId = created.json().mixItems[0].mixId as string;

  const paymentKey = crypto.randomUUID();
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES (?, 'cart-mix-reserved', 'pending', 1, '4242', 'Visa')`,
  ).run(paymentKey);
  carts.reserve(cartId, paymentKey, new Date().toISOString());

  const mutations = [
    app.inject({
      method: 'POST',
      url: `/api/cart/${cartId}/mixes`,
      payload: {
        components: [
          { productId: '1', percentage: 50 },
          { productId: '2', percentage: 50 },
        ],
        bagSizeGrams: 500,
        fineness: 'standard',
      },
    }),
    app.inject({
      method: 'PATCH',
      url: `/api/cart/${cartId}/mixes/${mixId}`,
      payload: {
        components: [
          { productId: '1', percentage: 50 },
          { productId: '2', percentage: 50 },
        ],
        bagSizeGrams: 500,
        fineness: 'fine',
      },
    }),
    app.inject({
      method: 'PATCH',
      url: `/api/cart/${cartId}/mixes/${mixId}/quantity`,
      payload: { quantity: 2 },
    }),
    app.inject({ method: 'POST', url: `/api/cart/${cartId}/mixes/${mixId}/requote` }),
    app.inject({ method: 'DELETE', url: `/api/cart/${cartId}/mixes/${mixId}` }),
  ];

  for (const response of await Promise.all(mutations)) {
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, 'Cart is reserved for checkout');
  }
});
