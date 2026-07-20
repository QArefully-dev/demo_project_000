import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ProductWithVariants,
  type ProductListPaginatedResponse,
  type ProductFilterOptionsResponse,
  SimilarProductsResponse,
} from '@shop/contracts/products';
import type { ProductWithVariants as ProductWithVariantsType } from '@shop/contracts/products';
import { Value } from '@sinclair/typebox/value';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

void test('product detail returns variants and persisted facts without packaging', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-variants-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  resetDatabase(db);
  seedDatabase(db);

  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await app.inject({ method: 'GET', url: '/api/products/1' });
  assert.equal(response.statusCode, 200);

  const product = response.json<ProductWithVariantsType>();
  assert.equal(Value.Check(ProductWithVariants, product), true);
  assert.equal('packaging' in product, false);
  assert.equal('images' in product, false);
  assert.ok(product.variants.length >= 1);
  assert.ok(product.defaultVariantId > 0);
  assert.ok(typeof product.categoryFacts === 'object');
  assert.ok(['food', 'non-food', 'caution'].includes(product.consumptionClassification));
  assert.ok(product.priceRange.min > 0);
  assert.ok(product.priceRange.max >= product.priceRange.min);
  assert.ok(
    ['in_stock', 'low_stock', 'out_of_stock', 'backorder'].includes(product.baseAvailability),
  );
  assert.match(product.createdAt ?? '', /^2025-\d{2}-\d{2}T00:00:00\.000Z$/);
  assert.equal(product.available, true);
  assert.ok((product.tags?.length ?? 0) > 0);
  assert.ok((product.specificationGroups?.length ?? 0) > 0);
});

void test('customer catalog endpoints exclude inactive products', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-active-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  seedDatabase(db);
  db.prepare('UPDATE products SET active = 0 WHERE id = 1').run();
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  assert.equal((await app.inject({ method: 'GET', url: '/api/products/1' })).statusCode, 404);
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/1/similar' })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/1/related' })).statusCode,
    404,
  );
  const list = await app.inject({ method: 'GET', url: '/api/products?pageSize=48' });
  assert.equal(list.statusCode, 200);
  const body = list.json<ProductListPaginatedResponse>();
  assert.equal(body.total, 99);
  assert.equal(
    body.items.some((product) => product.id === '1'),
    false,
  );
});

void test('similar products endpoint is deterministic and related remains its compatibility alias', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-similar-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  seedDatabase(db);
  const candidate = (
    db.prepare('SELECT id FROM products WHERE id != 1 ORDER BY id ASC LIMIT 1').get() as {
      id: number;
    }
  ).id;
  db.prepare('UPDATE products SET active = 0 WHERE id NOT IN (?, ?)').run(1, candidate);
  db.prepare(
    'UPDATE products SET category = (SELECT category FROM products WHERE id = 1), price_cents = (SELECT price_cents FROM products WHERE id = 1), stock_count = 0, active = 1 WHERE id = ?',
  ).run(candidate);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  const similar = await app.inject({ method: 'GET', url: '/api/products/1/similar' });
  const repeated = await app.inject({ method: 'GET', url: '/api/products/1/similar' });
  const related = await app.inject({ method: 'GET', url: '/api/products/1/related' });
  assert.equal(similar.statusCode, 200);
  assert.equal(repeated.statusCode, 200);
  assert.equal(related.statusCode, 200);
  assert.equal(similar.body, repeated.body);
  assert.equal(similar.body, related.body);
  const products = similar.json<SimilarProductsResponse>();
  assert.equal(Value.Check(SimilarProductsResponse, products), true);
  assert.deepEqual(
    products.map((product) => product.id),
    [String(candidate)],
  );
  assert.equal(products[0].available, false);
  assert.equal(
    products.some((product) => product.id === '1'),
    false,
  );

  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/999/similar' })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/999/related' })).statusCode,
    404,
  );
  db.prepare('UPDATE products SET active = 0 WHERE id = 1').run();
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/1/similar' })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/1/related' })).statusCode,
    404,
  );
});

void test('product API normalizes legacy SQLite creation timestamps for the transport contract', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-legacy-time-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  seedDatabase(db);
  db.prepare("UPDATE products SET created_at = '2024-12-31 23:59:59' WHERE id = 1").run();
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await app.inject({ method: 'GET', url: '/api/products/1' });
  assert.equal(response.statusCode, 200);
  const product = response.json<ProductWithVariantsType>();
  assert.equal(product.createdAt, '2024-12-31T23:59:59.000Z');
  assert.equal(Value.Check(ProductWithVariants, product), true);
});

void test('catalog query validation reports deterministic 400 responses and exposes active filter options', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-query-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  seedDatabase(db);
  db.prepare('UPDATE products SET active = 0 WHERE id = 1').run();
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  const options = await app.inject({ method: 'GET', url: '/api/products/filter-options' });
  assert.equal(options.statusCode, 200);
  const detail = await app.inject({ method: 'GET', url: '/api/products/2' });
  assert.equal(detail.statusCode, 200);
  assert.equal(Value.Check(ProductWithVariants, detail.json()), true);
  const optionBody = options.json<ProductFilterOptionsResponse>();
  assert.ok(optionBody.tags.length > 0);
  assert.ok(optionBody.specificationGroups.length > 0);
  const specification = optionBody.specificationGroups[0]?.specifications[0];
  assert.ok(specification?.values[0]);
  const repeatedFilters = await app.inject({
    method: 'GET',
    url: `/api/products?tag=${optionBody.tags[0].key}&tag=${optionBody.tags[0].key}&spec=${specification.key}:${specification.values[0].key}`,
  });
  assert.equal(repeatedFilters.statusCode, 200);

  for (const url of [
    '/api/products?minPriceCents=2&maxPriceCents=1',
    '/api/products?addedFrom=2025-02-30',
    '/api/products?addedFrom=2025-02-02&addedTo=2025-02-01',
    '/api/products?spec=texture:fine&spec=texture:coarse',
    '/api/products?spec=pack-weight:900g',
  ]) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 400, url);
    assert.equal(typeof response.json<{ error?: unknown }>().error, 'string');
  }
});
