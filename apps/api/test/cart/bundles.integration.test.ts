import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter, type AuditWriter } from '../../src/features/audit/auditService.js';
import { createBundleRepository } from '../../src/features/bundles/bundleRepository.js';
import { createBundleService } from '../../src/features/bundles/bundleService.js';
import {
  createCartRepository,
  type CartRepository,
} from '../../src/features/cart/cartRepository.js';
import { createCart, getCart } from '../../src/features/cart/cartService.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { createPowderizerService } from '../../src/features/powderizer/powderizerService.js';

function createFixture(t: test.TestContext, audit?: AuditWriter) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-curated-bundles-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const mixes = createPowderMixRepository(db);
  const service = createBundleService({
    bundles: createBundleRepository(db),
    carts,
    mixes,
    unitOfWork: createUnitOfWork(db),
    audit:
      audit ??
      createAuditWriter({
        repository: createAuditRepository(db),
        clock: { now: () => new Date('2026-07-18T12:00:00.000Z') },
      }),
  });
  return { db, carts, mixes, service };
}

const context = { actor: { type: 'anonymous' as const, userId: null }, requestId: 'bundle-add' };

void test('lists visible bundles with current component prices and deterministic availability', (t) => {
  const { db, service } = createFixture(t);
  const bundles = service.list();
  assert.deepEqual(
    bundles.map((bundle) => bundle.key),
    ['powder-starter-set', 'pantry-set', 'outdoor-kit', 'questionable-assortment'],
  );
  const starter = bundles[0];
  assert.ok(starter);
  db.prepare('UPDATE products SET price_cents = 4321, stock_count = 0 WHERE id = 1').run();
  const refreshed = service.list().find((bundle) => bundle.id === starter.id);
  assert.equal(refreshed?.components[0]?.lineTotalCents, 4321);
  assert.equal(refreshed?.available, false);
  db.prepare('UPDATE products SET active = 0 WHERE id = 2').run();
  assert.equal(
    service.list().some((bundle) => bundle.id === starter.id),
    false,
  );
  assert.deepEqual(
    service.list('29').map((bundle) => bundle.key),
    ['outdoor-kit'],
  );
});

void test('adds a bundle as ordinary cart lines, increments repeats, and writes one audit fact', (t) => {
  const { db, carts, mixes, service } = createFixture(t);
  const { cartId } = createCart(carts);
  const first = service.addToCart(cartId, '1', context);
  assert.equal(typeof first, 'object');
  if (typeof first === 'string' || !('items' in first)) throw new Error('Expected cart');
  assert.deepEqual(
    first.items.map((item) => [item.productId, item.quantity]),
    [
      ['1', 1],
      ['2', 1],
      ['3', 1],
    ],
  );
  assert.deepEqual(first.mixItems, []);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM powder_mixes').get().count, 0);
  assert.notEqual(service.addToCart(cartId, '1', context), 'BUNDLE_NOT_FOUND');
  assert.deepEqual(
    getCart(carts, cartId, mixes)?.items.map((item) => [item.productId, item.quantity]),
    [
      ['1', 2],
      ['2', 2],
      ['3', 2],
    ],
  );
  const events = db
    .prepare('SELECT action, metadata_json FROM audit_events ORDER BY id')
    .all() as Array<{ action: string; metadata_json: string }>;
  assert.deepEqual(events, [
    {
      action: 'cart.bundle_added',
      metadata_json: '{"bundleId":1,"componentCount":3,"quantity":3}',
    },
    {
      action: 'cart.bundle_added',
      metadata_json: '{"bundleId":1,"componentCount":3,"quantity":3}',
    },
  ]);
});

void test('bundle add preserves existing Powderizer mix items', (t) => {
  const { db, carts, mixes, service } = createFixture(t);
  const { cartId } = createCart(carts);
  const powderizer = createPowderizerService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products: createProductRepository(db),
    mixes,
  });
  const mixId = powderizer.create(cartId, {
    components: [
      { productId: '1', percentage: 50 },
      { productId: '2', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
  });
  if (typeof mixId !== 'string') throw new Error('Expected powder mix ID');

  const result = service.addToCart(cartId, '1', context);
  if (typeof result === 'string' || !('mixItems' in result)) throw new Error('Expected cart');
  assert.equal(result.mixItems.length, 1);
  assert.equal(result.mixItems[0]?.mixId, mixId);
  assert.deepEqual(
    result.items.map((item) => item.productId),
    ['1', '2', '3'],
  );
});

void test('rejects every unavailable component without touching ordinary cart lines or audit', (t) => {
  const { db, carts, service } = createFixture(t);
  const { cartId } = createCart(carts);
  carts.addLineQuantity(cartId, '1', 2);
  db.prepare('UPDATE products SET stock_count = 2 WHERE id = 1').run();
  db.prepare('UPDATE products SET active = 0 WHERE id = 3').run();
  const result = service.addToCart(cartId, '1', context);
  assert.deepEqual(result, { error: 'BUNDLE_UNAVAILABLE', productIds: ['1', '3'] });
  assert.equal(carts.lineQuantity(cartId, '1'), 2);
  assert.equal(carts.lineQuantity(cartId, '2'), 0);
  assert.equal(carts.lineQuantity(cartId, '3'), 0);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count,
    0,
  );
});

void test('rolls back all component writes and cart touch when audit append fails', (t) => {
  const failingAudit: AuditWriter = {
    append: () => {
      throw new Error('audit unavailable');
    },
  };
  const { carts, service } = createFixture(t, failingAudit);
  const { cartId } = createCart(carts);
  const before = (carts as unknown as { listLines: (id: string) => unknown[] }).listLines(cartId);
  assert.deepEqual(before, []);
  assert.throws(() => service.addToCart(cartId, '1', context), /audit unavailable/);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
});

void test('rolls back prior component writes when a later component write fails', (t) => {
  const { db, carts, mixes } = createFixture(t);
  const { cartId } = createCart(carts);
  let writes = 0;
  const failingCarts: CartRepository = {
    ...carts,
    addLineQuantity(id, productId, quantity) {
      writes += 1;
      if (writes === 2) throw new Error('component write failed');
      carts.addLineQuantity(id, productId, quantity);
    },
  };
  const service = createBundleService({
    bundles: createBundleRepository(db),
    carts: failingCarts,
    mixes,
    unitOfWork: createUnitOfWork(db),
    audit: createAuditWriter({
      repository: createAuditRepository(db),
      clock: { now: () => new Date('2026-07-18T12:00:00.000Z') },
    }),
  });

  assert.throws(() => service.addToCart(cartId, '1', context), /component write failed/);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count,
    0,
  );
});
