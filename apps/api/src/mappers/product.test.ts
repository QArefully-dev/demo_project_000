import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_PRODUCTS } from '@shop/catalog';

import { toProductContract } from './product.js';

const canonicalRow = {
  id: 1,
  name: 'Protein Powder',
  description: 'Test product',
  price_cents: 1299,
  category: 'Pantry Staples',
  stock_count: 4,
  image_set_id: 'protein-powder',
  slug: 'protein-powder',
  compare_at_price_cents: null,
  sales_count: 8,
  active: 1,
  created_at: '2025-01-01T00:00:00.000Z',
};

void test('toProductContract resolves catalog packaging by stable artwork ID', () => {
  const product = toProductContract(canonicalRow);
  const catalogProduct = CATALOG_PRODUCTS.find(
    (candidate) => candidate.image_set_id === canonicalRow.image_set_id,
  );

  assert.deepEqual(product.packaging, catalogProduct?.packaging);
  assert.equal(product.createdAt, canonicalRow.created_at);
  assert.equal(product.available, true);
  assert.deepEqual(product.tags, catalogProduct?.tags);
  assert.ok(product.specificationGroups.length > 0);
  assert.equal('images' in product, false);
});

void test('toProductContract omits packaging for unknown artwork', () => {
  const product = toProductContract({ ...canonicalRow, image_set_id: 'retired-artwork' });

  assert.equal(product.packaging, undefined);
  assert.equal(product.imageSetId, 'retired-artwork');
  assert.deepEqual(product.tags, []);
  assert.deepEqual(product.specificationGroups, []);
});
