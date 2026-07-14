import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
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
  } = response.json();
  assert.equal(product.images, undefined);
  assert.equal(product.packaging?.quantity, '900g');
  assert.equal(product.packaging?.consumptionLabel, null);
});
