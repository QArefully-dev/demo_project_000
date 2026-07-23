import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Cart, CreateCartResponse } from '@shop/contracts/cart';
import { ErrorResponse } from '@shop/contracts/common';
import { Value } from '@sinclair/typebox/value';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import {
  addItem,
  createCart,
  createCartService,
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
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter, type AuditWriter } from '../../src/features/audit/auditService.js';
import { createInventoryRepository } from '../../src/features/inventory/inventoryRepository.js';
import { createInventoryService } from '../../src/features/inventory/inventoryService.js';
import { perTonneCents, resolveUnitPriceCents } from '../../src/features/pricing/pricingRules.js';

function defaultVariantId(db: ReturnType<typeof openDatabase>, productId: number): string {
  const row = db
    .prepare(
      'SELECT id FROM product_variants WHERE product_id = ? AND sort_order = 1 AND active = 1 LIMIT 1',
    )
    .get(productId) as { id: number } | undefined;
  if (!row) throw new Error(`No default variant for product ${productId}`);
  return String(row.id);
}

function responseStatusCode(response: unknown): number {
  if (typeof response !== 'object' || response === null || !('statusCode' in response)) {
    throw new Error('Expected an injected HTTP response');
  }
  const { statusCode } = response;
  if (typeof statusCode !== 'number') throw new Error('Expected a numeric HTTP status code');
  return statusCode;
}

void test('cart service coordinates cart repository and promo eligibility', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const variant1 = defaultVariantId(db, 1);
  const { cartId } = createCart(carts);
  assert.equal(addItem(carts, cartId, variant1).id, cartId);
  assert.equal(updateItem(carts, cartId, variant1, 4).totalItems, 4);
  assert.equal(
    validatePromo(
      { code: 'SAVE10', cartId, userId: null, now: new Date('2026-07-14T10:00:00.000Z') },
      { carts, promos: createPromoRepository(db) },
    ).errorCode,
    'MIN_ITEMS',
  );
  assert.equal(removeItem(carts, cartId, variant1).totalItems, 0);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
  assert.deepEqual(getCart(carts, cartId)?.mixItems, []);
});

void test('cart blocks new inactive selections but retains existing lines', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-inactive-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const variant1 = defaultVariantId(db, 1);
  const { cartId } = createCart(carts);
  assert.notEqual(addItem(carts, cartId, variant1), 'VARIANT_NOT_FOUND');
  db.prepare('UPDATE product_variants SET active = 0 WHERE id = ?').run(variant1);
  assert.equal(addItem(carts, cartId, variant1), 'VARIANT_NOT_FOUND');
  assert.equal(getCart(carts, cartId)?.items[0]?.productId, '1');
});

void test('cart transports server-resolved default and discounted-tier prices', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-tier-pricing-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const variant = db
    .prepare(
      `SELECT id, price_cents, weight_grams
       FROM product_variants WHERE active = 1 ORDER BY id LIMIT 1`,
    )
    .get() as { id: number; price_cents: number; weight_grams: number };
  const defaultCartId = createCart(carts).cartId;
  carts.addLineQuantity(defaultCartId, String(variant.id), 1);
  const defaultLine = getCart(carts, defaultCartId)?.items[0];
  assert.equal(defaultLine?.resolvedUnitPriceCents, variant.price_cents);
  assert.equal(
    defaultLine?.perTonneCents,
    perTonneCents(variant.price_cents, variant.weight_grams),
  );
  assert.equal(defaultLine?.lineTotalCents, variant.price_cents);

  const quantity = Math.ceil(5_000_000 / variant.weight_grams);
  const discountedCartId = createCart(carts).cartId;
  carts.addLineQuantity(discountedCartId, String(variant.id), quantity);
  const cart = getCart(carts, discountedCartId);
  const unitPriceCents = resolveUnitPriceCents(variant.price_cents, quantity, variant.weight_grams);
  assert.ok(unitPriceCents < variant.price_cents);
  assert.equal(cart?.items[0]?.resolvedUnitPriceCents, unitPriceCents);
  assert.equal(
    cart?.items[0]?.perTonneCents,
    perTonneCents(variant.price_cents, variant.weight_grams),
  );
  assert.equal(cart?.items[0]?.lineTotalCents, unitPriceCents * quantity);
  assert.equal(cart?.subtotalCents, unitPriceCents * quantity);
});

void test('cart reads batch available-to-sell and ignores only expired prepared locks', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-availability-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const now = new Date('2026-07-19T12:00:00.000Z');
  const carts = createCartRepository(db);
  const variant1 = defaultVariantId(db, 1);
  const variant2 = defaultVariantId(db, 2);
  const variant3 = defaultVariantId(db, 3);
  const inventory = createInventoryService({ repository: createInventoryRepository(db) });
  const service = createCartService(carts, undefined, undefined, {
    inventory,
    clock: { now: () => now },
  });
  const cartId = createCart(carts).cartId;
  carts.addLine(cartId, variant1);
  db.prepare('UPDATE product_variants SET stock_count = 1 WHERE id = ?').run(variant1);
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES ('cart-availability', 'cart-availability', 'prepared', 1, '4242', 'Visa')`,
  ).run();
  db.prepare(
    `INSERT INTO inventory_reservations
      (payment_idempotency_key, variant_id, demand_kind, reserved_quantity, backordered_quantity, expires_at, created_at)
     VALUES ('cart-availability', ?, 'product', 1, 0, '2026-07-19T12:01:00.000Z', ?)`,
  ).run(variant1, now.toISOString());
  assert.equal(service.get(cartId)?.items[0]?.product.stock, 0);
  assert.equal(service.get(cartId)?.items[0]?.product.availability, 'out_of_stock');

  const expiredKey = 'cart-expired-lock';
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, reservation_expires_at)
     VALUES (?, ?, 'prepared', 1, '4242', 'Visa', '2026-07-19T12:00:00.000Z')`,
  ).run(expiredKey, expiredKey);
  carts.reserve(cartId, expiredKey, now.toISOString());
  assert.notEqual(service.add(cartId, variant2), 'CART_RESERVED');

  carts.releaseReservation(expiredKey);
  const authorizedKey = 'cart-authorized-lock';
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, reservation_expires_at)
     VALUES (?, ?, 'authorized_pending_finalize', 1, '4242', 'Visa', '2026-07-19T11:00:00.000Z')`,
  ).run(authorizedKey, authorizedKey);
  carts.reserve(cartId, authorizedKey, now.toISOString());
  assert.equal(service.add(cartId, variant3), 'CART_RESERVED');
});

void test('cart reads persisted mixes as first-class lines and promos count bag quantity', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-cart-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  db.prepare("UPDATE products SET mixing_group = 'food-grade' WHERE id IN (1, 2, 3, 4, 5)").run();
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const variant3 = defaultVariantId(db, 3);
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
    bagColourScheme: 'ultraviolet-cyan',
    customLabel: 'Breakfast blend',
  });
  assert.equal(typeof mixId, 'string');
  if (typeof mixId !== 'string') throw new Error('Expected mix ID');
  assert.equal(powderizer.updateQuantity(cartId, mixId, 5), undefined);
  assert.equal(addItem(carts, cartId, variant3).id, cartId);

  const cart = getCart(carts, cartId, mixes);
  assert.ok(cart);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.mixItems.length, 1);
  assert.deepEqual(cart.mixItems[0], {
    mixId,
    components: [
      { productId: '1', productName: 'All-Purpose Flour', percentage: 50, allocatedGrams: 250 },
      { productId: '2', productName: 'dry Sugar', percentage: 50, allocatedGrams: 250 },
    ],
    bagSizeGrams: 500,
    fineness: 'fine',
    bagColourScheme: 'ultraviolet-cyan',
    customLabel: 'Breakfast blend',
    priceVersion: 'powderizer-v1',
    unitPriceCents: 472,
    quantity: 5,
    lineTotalCents: 2360,
    usageLabel: 'Consumable powder',
  });
  assert.equal(cart.totalItems, 9);
  assert.equal(cart.subtotalCents, 2360 + cart.items[0].lineTotalCents);
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
  const cartId = Value.Parse(CreateCartResponse, created.json()).cartId;
  db.prepare(
    "UPDATE product_variants SET delivery_class = 'parcel', weight_grams = 99500, moq_sacks = 1 WHERE id = 6",
  ).run();
  const product = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: '3', variantId: 6 },
  });
  assert.equal(product.statusCode, 200);
  assert.deepEqual(Value.Parse(Cart, product.json()).mixItems, []);

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
  const cart = Value.Parse(Cart, createdMix.json());
  assert.equal(cart.items.length, 1);
  assert.equal(cart.mixItems.length, 1);
  assert.equal(cart.mixItems[0].lineTotalCents, 472);
  assert.equal(cart.totalItems, 2);
  assert.equal(cart.subtotalCents, cart.items[0].lineTotalCents + 472);
  assert.deepEqual(cart.deliveryPreview, {
    mode: 'freight',
    chargeCents: 999,
    weightGrams: 100_000,
    reason: 'Total weight 100000g meets or exceeds 100000g freight threshold',
  });
});

void test('cart HTTP enforces MOQ and defaults omitted add quantity to its floor', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-moq-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const variant = db
    .prepare(
      `SELECT v.id, v.product_id, v.weight_grams, v.moq_sacks
       FROM product_variants v WHERE v.active = 1 ORDER BY v.id LIMIT 1`,
    )
    .get() as { id: number; product_id: number; weight_grams: number; moq_sacks: number };
  const minimumQuantity = Math.ceil((variant.moq_sacks * 25_000) / variant.weight_grams);
  const create = await app.inject({ method: 'POST', url: '/api/cart' });
  const cartId = Value.Parse(CreateCartResponse, create.json()).cartId;

  const added = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: String(variant.product_id), variantId: variant.id },
  });
  assert.equal(added.statusCode, 200);
  const cart = Value.Parse(Cart, added.json());
  assert.equal(cart.items[0]?.quantity, minimumQuantity);

  const below = await app.inject({
    method: 'PATCH',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: String(variant.product_id), quantity: minimumQuantity - 1 },
  });
  assert.equal(below.statusCode, 400);
  assert.deepEqual(below.json(), {
    code: 'BELOW_MOQ',
    error: 'Quantity does not meet this variant minimum order quantity.',
  });
});

void test('cart HTTP validates quantities and targets exact variant cart lines', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-variant-mutation-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const variants = db
    .prepare<[], { id: number; product_id: number; weight_grams: number; moq_sacks: number }>(
      `SELECT v.id, v.product_id, v.weight_grams, v.moq_sacks
       FROM product_variants v
       WHERE v.active = 1
         AND v.product_id = (
           SELECT product_id FROM product_variants WHERE active = 1
           GROUP BY product_id HAVING COUNT(*) > 1 ORDER BY product_id LIMIT 1
         )
       ORDER BY v.sort_order LIMIT 2`,
    )
    .all();
  assert.equal(variants.length, 2);
  const [first, second] = variants;
  if (!first || !second) throw new Error('Expected two active variants');
  const firstMinimum = Math.ceil((first.moq_sacks * 25_000) / first.weight_grams);
  const secondMinimum = Math.ceil((second.moq_sacks * 25_000) / second.weight_grams);
  const create = await app.inject({ method: 'POST', url: '/api/cart' });
  const cartId = Value.Parse(CreateCartResponse, create.json()).cartId;

  for (const variant of variants) {
    const minimum = variant.id === first.id ? firstMinimum : secondMinimum;
    const added = await app.inject({
      method: 'POST',
      url: `/api/cart/${cartId}/items`,
      payload: {
        productId: String(variant.product_id),
        variantId: variant.id,
        quantity: Number(minimum),
      },
    });
    assert.equal(responseStatusCode(added), 200);
  }

  for (const payload of [
    { productId: String(first.product_id), variantId: first.id, quantity: Number.MAX_SAFE_INTEGER },
    {
      productId: String(first.product_id),
      variantId: first.id,
      quantity: Number.MAX_SAFE_INTEGER + 1,
    },
    { productId: String(first.product_id), variantId: first.id, quantity: 1.5 },
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/cart/${cartId}/items`,
      payload,
    });
    assert.equal(responseStatusCode(response), 400);
  }
  for (const quantity of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/cart/${cartId}/items`,
      payload: { productId: String(first.product_id), variantId: first.id, quantity },
    });
    assert.equal(responseStatusCode(response), 400);
  }

  const ambiguousUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: String(first.product_id), quantity: firstMinimum },
  });
  assert.equal(ambiguousUpdate.statusCode, 400);
  const ambiguousRemove = await app.inject({
    method: 'DELETE',
    url: `/api/cart/${cartId}/items/${first.product_id}`,
  });
  assert.equal(ambiguousRemove.statusCode, 400);

  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/cart/${cartId}/items`,
    payload: {
      productId: String(first.product_id),
      variantId: first.id,
      quantity: firstMinimum + 1,
    },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(
    Value.Parse(Cart, updated.json()).items.find((item) => item.variantSnap?.variantId === first.id)
      ?.quantity,
    firstMinimum + 1,
  );

  const removed = await app.inject({
    method: 'DELETE',
    url: `/api/cart/${cartId}/items/${first.product_id}`,
    payload: { productId: String(first.product_id), variantId: second.id },
  });
  assert.equal(removed.statusCode, 200);
  const remaining = Value.Parse(Cart, removed.json()).items;
  assert.deepEqual(
    remaining.map((item) => item.variantSnap?.variantId),
    [first.id],
  );
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
  const mixId = Value.Parse(Cart, created.json()).mixItems[0]?.mixId;
  if (!mixId) throw new Error('Expected mix ID');

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
    assert.equal(
      Value.Parse(ErrorResponse, response.json()).error,
      'Cart is reserved for checkout',
    );
  }
});

void test('audited cart mutations emit one allowlisted event per committed change', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-audit-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const carts = createCartRepository(db);
  const variant1 = defaultVariantId(db, 1);
  const writer = createAuditWriter({
    repository: createAuditRepository(db),
    clock: { now: () => new Date('2026-07-18T12:00:00.000Z') },
  });
  const service = createCartService(carts, undefined, {
    unitOfWork: createUnitOfWork(db),
    audit: writer,
  });
  const anonymous = { actor: { type: 'anonymous' as const, userId: null }, requestId: 'cart-a' };
  const user = { actor: { type: 'user' as const, userId: 12 }, requestId: 'cart-b' };

  const { cartId } = service.create(anonymous);
  assert.notEqual(service.add(cartId, variant1, user), 'CART_NOT_FOUND');
  assert.notEqual(service.update(cartId, variant1, 4, user), 'CART_NOT_FOUND');
  assert.notEqual(service.update(cartId, variant1, 0, user), 'CART_NOT_FOUND');
  assert.equal(service.update(cartId, variant1, 2, user), 'VARIANT_NOT_IN_CART');

  const events = db
    .prepare(
      `SELECT actor_type, actor_user_id, action, entity_id, request_id, metadata_json
       FROM audit_events ORDER BY id`,
    )
    .all() as Array<{
    actor_type: string;
    actor_user_id: number | null;
    action: string;
    entity_id: string;
    request_id: string;
    metadata_json: string;
  }>;
  assert.deepEqual(
    events.map(({ action, actor_type, actor_user_id, entity_id, request_id, metadata_json }) => ({
      action,
      actor_type,
      actor_user_id,
      entity_id,
      request_id,
      metadata_json,
    })),
    [
      {
        action: 'cart.created',
        actor_type: 'anonymous',
        actor_user_id: null,
        entity_id: cartId,
        request_id: 'cart-a',
        metadata_json: '{}',
      },
      {
        action: 'cart.product_added',
        actor_type: 'user',
        actor_user_id: 12,
        entity_id: cartId,
        request_id: 'cart-b',
        metadata_json: JSON.stringify({ productId: Number(variant1), quantity: 4 }),
      },
      {
        action: 'cart.product_quantity_changed',
        actor_type: 'user',
        actor_user_id: 12,
        entity_id: cartId,
        request_id: 'cart-b',
        metadata_json: JSON.stringify({ productId: Number(variant1), quantity: 4 }),
      },
      {
        action: 'cart.product_removed',
        actor_type: 'user',
        actor_user_id: 12,
        entity_id: cartId,
        request_id: 'cart-b',
        metadata_json: JSON.stringify({ productId: Number(variant1) }),
      },
    ],
  );
});

void test('cart audit failure rolls back mutation and cart touch transaction', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-audit-rollback-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const carts = createCartRepository(db);
  const variant1 = defaultVariantId(db, 1);
  const failingAudit: AuditWriter = {
    append: () => {
      throw new Error('audit unavailable');
    },
  };
  const service = createCartService(carts, undefined, {
    unitOfWork: createUnitOfWork(db),
    audit: failingAudit,
  });
  const context = { actor: { type: 'anonymous' as const, userId: null }, requestId: 'cart-fail' };

  assert.throws(() => service.create(context), /audit unavailable/);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM carts').get() as { count: number }).count,
    0,
  );

  const { cartId } = createCart(carts);
  assert.throws(() => service.add(cartId, variant1, context), /audit unavailable/);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
});
