import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_PRODUCTS, validateCatalog } from '@shop/catalog';

void test('canonical powder catalog satisfies Phase 1 constraints', () => {
  assert.doesNotThrow(() => validateCatalog());
  assert.equal(CATALOG_PRODUCTS.length, 45);
  assert.equal(
    CATALOG_PRODUCTS.filter((product) => product.compare_at_price_cents !== null).length,
    14,
  );
  assert.equal(
    CATALOG_PRODUCTS.find((product) => product.slug === 'powdered-water')?.sales_count,
    1200,
  );
  assert.equal(
    new Set(CATALOG_PRODUCTS.map((product) => product.image_set_id)).size,
    CATALOG_PRODUCTS.length,
  );
});
