import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import {
  Product,
  ProductFilterOptionsResponse,
  ProductQuery,
  ProductSpecificationGroup,
  ProductTag,
} from '../src/products.js';

const productMetadata = {
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  tags: [{ key: 'high-protein', label: 'High protein' }],
  specificationGroups: [
    {
      key: 'appearance',
      label: 'Appearance',
      order: 1,
      specifications: [{ key: 'texture', label: 'Texture', valueKey: 'fine', value: 'Fine' }],
    },
  ],
};
const product = {
  id: '1',
  name: 'Protein Powder',
  description: 'A test product',
  priceCents: 2500,
  imageSetId: 'protein-powder',
  category: 'Performance',
  stock: 5,
  slug: 'protein-powder',
  salesCount: 10,
  mixable: true,
  ...productMetadata,
};

void test('product metadata requires normalized keys, UTC timestamps, and grouped facts', () => {
  assert.equal(Value.Check(Product, product), true);
  assert.equal(Value.Check(Product, { ...product, createdAt: '2026-07-14 00:00:00' }), false);
  assert.equal(
    Value.Check(Product, { ...product, tags: [{ key: 'High Protein', label: 'High protein' }] }),
    false,
  );
  assert.equal(
    Value.Check(ProductSpecificationGroup, {
      ...productMetadata.specificationGroups[0],
      specifications: [
        { key: 'texture', label: 'Texture', valueKey: 'fine-grained', value: 'Fine grained' },
      ],
    }),
    true,
  );
  assert.equal(
    Value.Check(ProductSpecificationGroup, {
      ...productMetadata.specificationGroups[0],
      specifications: [{ key: 'texture', label: 'Texture', value: 'Fine' }],
    }),
    false,
  );
});

void test('product metadata schemas reject raw active state and extra properties', () => {
  assert.equal(Value.Check(Product, { ...product, active: true }), false);
  assert.equal(
    Value.Check(ProductTag, { key: 'high-protein', label: 'High protein', active: true }),
    false,
  );
  assert.equal(
    Value.Check(Product, {
      ...product,
      specificationGroups: [
        {
          ...productMetadata.specificationGroups[0],
          specifications: [
            { ...productMetadata.specificationGroups[0].specifications[0], numericValue: 500 },
          ],
        },
      ],
    }),
    false,
  );
});

void test('filter options expose strict tag and grouped filterable specification values', () => {
  const options = {
    tags: [
      { key: 'high-protein', label: 'High protein' },
      { key: 'vegetarian', label: 'Vegetarian' },
    ],
    specificationGroups: [
      {
        key: 'appearance',
        label: 'Appearance',
        order: 1,
        specifications: [
          { key: 'texture', label: 'Texture', values: [{ key: 'fine', label: 'Fine' }] },
        ],
      },
    ],
  };
  assert.equal(Value.Check(ProductFilterOptionsResponse, options), true);
  assert.equal(
    Value.Check(ProductFilterOptionsResponse, {
      ...options,
      specificationGroups: [{ ...options.specificationGroups[0], active: true }],
    }),
    false,
  );
  assert.equal(
    Value.Check(ProductFilterOptionsResponse, {
      ...options,
      specificationGroups: [
        {
          ...options.specificationGroups[0],
          specifications: [{ ...options.specificationGroups[0].specifications[0], values: [] }],
        },
      ],
    }),
    false,
  );
});

void test('catalog query transport accepts bounded repeated discovery filters', () => {
  assert.equal(
    Value.Check(ProductQuery, {
      minPriceCents: 0,
      maxPriceCents: 9999,
      addedFrom: '2025-01-01',
      addedTo: '2025-12-31',
      tag: ['high-protein', 'vegetarian'],
      spec: ['texture:fine', 'source:plant'],
      availability: 'available',
      sort: 'oldest',
    }),
    true,
  );
  assert.equal(Value.Check(ProductQuery, { addedFrom: '2025-1-1' }), false);
  assert.equal(Value.Check(ProductQuery, { tag: ['Bad tag'] }), false);
  assert.equal(Value.Check(ProductQuery, { spec: ['texture=fine'] }), false);
  assert.equal(Value.Check(ProductQuery, { sort: 'popular' }), false);
  assert.equal(Value.Check(ProductQuery, { minPriceCents: -1 }), false);
  assert.equal(Value.Check(ProductQuery, { tag: Array.from({ length: 9 }, () => 'plant') }), false);
  assert.equal(
    Value.Check(ProductQuery, { spec: Array.from({ length: 9 }, () => 'texture:fine') }),
    false,
  );
});
