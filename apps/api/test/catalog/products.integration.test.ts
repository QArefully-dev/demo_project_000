import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Product } from '@shop/contracts/products';
import { Value } from '@sinclair/typebox/value';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

void test('product API exposes canonical packaging without raster image transport', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-product-contract-'));
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

  const product: {
    images?: unknown;
    packaging?: { quantity: string; consumptionLabel: string | null };
    createdAt?: string;
    available?: boolean;
    tags?: { key: string; label: string }[];
    specificationGroups?: unknown[];
  } = response.json();
  assert.equal(product.images, undefined);
  assert.equal(product.packaging?.quantity, '900g');
  assert.equal(product.packaging?.consumptionLabel, null);
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
    (await app.inject({ method: 'GET', url: '/api/products/1/related' })).statusCode,
    404,
  );
  const list = await app.inject({ method: 'GET', url: '/api/products?pageSize=48' });
  assert.equal(list.statusCode, 200);
  const body = list.json() as { total: number; items: { id: string }[] };
  assert.equal(body.total, 49);
  assert.equal(
    body.items.some((product) => product.id === '1'),
    false,
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
  const product = response.json();
  assert.equal(product.createdAt, '2024-12-31T23:59:59.000Z');
  assert.equal(Value.Check(Product, product), true);
});
