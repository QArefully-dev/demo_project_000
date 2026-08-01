import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';

void test('SKU lookup returns product names, includes retired variants, and preserves SKU matching', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-catalog-skus-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const repository = createProductRepository(db);
  const seededRetiredCount = (
    db.prepare('SELECT COUNT(*) AS count FROM product_variants WHERE active = 0').get() as {
      count: number;
    }
  ).count;
  assert.equal(seededRetiredCount, 0);
  const variants = db
    .prepare(
      `SELECT v.id, v.sku, v.active, p.name AS product_name
       FROM product_variants v
       INNER JOIN products p ON p.id = v.product_id
       WHERE v.active = 1
       ORDER BY v.id ASC
       LIMIT 2`,
    )
    .all() as Array<{ id: number; sku: string; active: number; product_name: string }>;
  assert.equal(variants.length, 2);

  const active = repository.findVariantsBySkus([variants[1].sku, variants[0].sku]);
  assert.deepEqual(
    active.map((variant) => [variant.id, variant.sku, variant.product_name, variant.active]),
    variants.map((variant) => [variant.id, variant.sku, variant.product_name, variant.active]),
  );
  assert.deepEqual(repository.findVariantsBySkus(['UNKNOWN-SKU']), []);
  assert.deepEqual(repository.findVariantsBySkus([]), []);
  assert.deepEqual(repository.findVariantsBySkus([variants[0].sku.toLowerCase()]), []);

  db.prepare('UPDATE product_variants SET active = 0 WHERE id = ?').run(variants[0].id);
  assert.deepEqual(
    repository
      .findVariantsBySkus([variants[0].sku])
      .map((variant) => [variant.id, variant.product_name, variant.active]),
    [[variants[0].id, variants[0].product_name, 0]],
  );
});
