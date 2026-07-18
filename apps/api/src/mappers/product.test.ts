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

void test('toProductContract resolves packaging but maps supplied persisted metadata', () => {
  const product = toProductContract({
    ...canonicalRow,
    tags: [{ key: 'local-tag', label: 'Local tag' }],
    specificationGroups: [
      {
        key: 'appearance',
        label: 'Appearance',
        order: 1,
        specifications: [{ key: 'texture', label: 'Texture', valueKey: 'local', value: 'Local' }],
      },
    ],
  });
  const catalogProduct = CATALOG_PRODUCTS.find(
    (candidate) => candidate.image_set_id === canonicalRow.image_set_id,
  );

  assert.deepEqual(product.packaging, catalogProduct?.packaging);
  assert.equal(product.createdAt, canonicalRow.created_at);
  assert.equal(product.available, true);
  assert.deepEqual(product.tags, [{ key: 'local-tag', label: 'Local tag' }]);
  assert.deepEqual(product.specificationGroups[0]?.specifications[0]?.valueKey, 'local');
  assert.equal('images' in product, false);
});

void test('raw internal rows remain valid with empty metadata and UTC normalization', () => {
  const product = toProductContract({ ...canonicalRow, image_set_id: 'retired-artwork' });

  assert.equal(product.packaging, undefined);
  assert.equal(product.imageSetId, 'retired-artwork');
  assert.deepEqual(product.tags, []);
  assert.deepEqual(product.specificationGroups, []);
  assert.equal(product.createdAt, '2025-01-01T00:00:00.000Z');
  assert.equal(toProductContract({ ...canonicalRow, stock_count: 0 }).available, false);
  assert.equal(
    toProductContract({ ...canonicalRow, created_at: '2025-01-01 12:00:00' }).createdAt,
    '2025-01-01T12:00:00.000Z',
  );
});
