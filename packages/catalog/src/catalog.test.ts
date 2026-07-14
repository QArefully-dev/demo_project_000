import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_ARTWORK_IDS, CATALOG_PRODUCTS, validateCatalog } from './index.js';
void test('canonical catalog validates only when explicitly invoked', () => {
  assert.doesNotThrow(() => validateCatalog());
  assert.equal(CATALOG_PRODUCTS.length, 45);
  assert.equal(new Set(CATALOG_ARTWORK_IDS).size, CATALOG_PRODUCTS.length);
});
void test('catalog validation rejects duplicate stable artwork IDs', () => {
  const firstArtworkId = CATALOG_PRODUCTS.at(0)?.image_set_id;
  assert.ok(firstArtworkId);
  const duplicate = CATALOG_PRODUCTS.map((product, index) =>
    index === 1 ? { ...product, image_set_id: firstArtworkId } : product,
  );
  assert.throws(() => validateCatalog(duplicate), /duplicate artwork IDs/);
});
