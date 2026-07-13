import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POWDER_CATALOG,
  POWDER_CATEGORIES,
  POWDER_IMAGE_SET_IDS,
  validatePowderCatalog,
} from './powderCatalog.js';

void test('canonical powder catalog satisfies Phase 1 constraints', () => {
  assert.doesNotThrow(() => validatePowderCatalog());
  assert.equal(POWDER_CATALOG.length, 45);
  assert.equal(new Set(POWDER_CATALOG.map((product) => product.category)).size, 7);
  assert.deepEqual(
    POWDER_CATEGORIES.map(
      (category) => POWDER_CATALOG.filter((product) => product.category === category).length,
    ),
    [7, 6, 6, 7, 6, 6, 7],
  );
  assert.equal(
    POWDER_CATALOG.filter((product) => product.compare_at_price_cents !== null).length,
    14,
  );
  assert.equal(
    POWDER_CATALOG.find((product) => product.slug === 'powdered-water')?.sales_count,
    1200,
  );
  assert.equal(new Set(POWDER_IMAGE_SET_IDS).size, POWDER_CATALOG.length);
});

void test('catalog validation rejects an image set absent from the generated manifest', () => {
  assert.throws(
    () => validatePowderCatalog(POWDER_CATALOG, POWDER_IMAGE_SET_IDS.slice(1)),
    /Missing generated image-set ID for protein-powder/,
  );
});
