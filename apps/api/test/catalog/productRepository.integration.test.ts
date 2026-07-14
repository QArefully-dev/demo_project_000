import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';

void test('product repository owns catalog SQL', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-catalog-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const products = createProductRepository(db);

  assert.deepEqual(products.listCategories(), [
    'Drinks',
    'Household',
    'Impossible',
    'Outdoors',
    'Pantry Staples',
    'Performance',
    'Questionable',
  ]);
  assert.ok(
    products
      .list({ q: 'water', sort: 'newest' })
      .items.some((product) => product.name === 'Powdered Water'),
  );
  assert.equal(products.list({ category: 'Impossible', sort: 'newest', pageSize: 48 }).total, 7);
  assert.ok(
    products
      .list({ onSale: true, sort: 'newest', pageSize: 48 })
      .items.every((product) => product.compare_at_price_cents !== null),
  );
  assert.ok(products.listRelated(45).every((product) => product.category === 'Impossible'));
});
