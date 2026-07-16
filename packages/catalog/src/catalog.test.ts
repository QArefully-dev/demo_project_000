import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_ARTWORK_IDS,
  CATALOG_CREATED_AT_BY_ID,
  CATALOG_PRODUCTS,
  catalogProductSpecifications,
  parsePackWeightGrams,
  parseMixUnitGrams,
  validateCatalog,
  type CatalogProduct,
} from './index.js';

const firstCatalogProduct = (): CatalogProduct => {
  const product = CATALOG_PRODUCTS.at(0);
  if (!product) throw new Error('Catalog must contain at least one product');
  return product;
};
void test('canonical catalog validates only when explicitly invoked', () => {
  assert.doesNotThrow(() => validateCatalog());
  assert.equal(CATALOG_PRODUCTS.length, 50);
  assert.equal(new Set(CATALOG_ARTWORK_IDS).size, CATALOG_PRODUCTS.length);
});
void test('catalog validation rejects duplicate stable artwork IDs', () => {
  const firstArtworkId = firstCatalogProduct().image_set_id;
  const duplicate = CATALOG_PRODUCTS.map((product, index) =>
    index === 1 ? { ...product, image_set_id: firstArtworkId } : product,
  );
  assert.throws(() => validateCatalog(duplicate), /duplicate artwork IDs/);
});

void test('catalog validation rejects duplicate tags and malformed metadata keys', () => {
  const product = firstCatalogProduct();
  assert.throws(
    () =>
      validateCatalog([
        { ...product, tags: [...product.tags, product.tags[0]!] },
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /duplicate tags/,
  );
  assert.throws(
    () =>
      validateCatalog([
        { ...product, tags: [{ key: 'Bad key', label: 'Bad key' }] },
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /Invalid tag key/,
  );
});

void test('missing authoring facts stay absent from resolved specifications', () => {
  const product = CATALOG_PRODUCTS.find((candidate) => candidate.specifications.source === null);
  if (!product) throw new Error('Catalog must retain at least one missing source fact');
  assert.equal(
    catalogProductSpecifications(product).some((specification) => specification.key === 'source'),
    false,
  );
});

void test('validator rejects authoring attempts to override packaging-derived facts', () => {
  const product = firstCatalogProduct();
  const specifications = {
    ...product.specifications,
    packWeight: { key: '1g', label: '1g' },
  };
  assert.throws(
    () =>
      validateCatalog([
        { ...product, specifications } as typeof product,
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /Invalid authoring specification shape|Unexpected derived specification/,
  );
  const resolved = catalogProductSpecifications(product);
  assert.deepEqual(
    resolved.find((specification) => specification.key === 'pack-weight'),
    {
      key: 'pack-weight',
      label: 'Pack weight',
      group: 'pack-and-care',
      groupLabel: 'Pack and care',
      order: 1,
      filterable: false,
      valueKey: product.packaging.quantity,
      displayValue: product.packaging.quantity,
      numericValue: parsePackWeightGrams(product.packaging.quantity),
    },
  );
  assert.equal(
    resolved.find((specification) => specification.key === 'warning-class')?.displayValue,
    product.packaging.consumptionLabel ?? 'None',
  );
});

void test('validator rejects timestamps that change canonical chronology', () => {
  const product = firstCatalogProduct();
  assert.throws(
    () =>
      validateCatalog([
        { ...product, created_at: '2025-03-01T00:00:00.000Z' },
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /chronology differs from canonical timestamp/,
  );
});

void test('validator rejects packaging values that bypass quantity and warning authorities', () => {
  const product = firstCatalogProduct();
  assert.throws(
    () =>
      validateCatalog([
        { ...product, packaging: { ...product.packaging, quantity: '100 G' } },
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /Invalid packaging quantity/,
  );
  assert.throws(
    () =>
      validateCatalog([
        {
          ...product,
          packaging: { ...product.packaging, consumptionLabel: 'Wrong' as never },
        },
        ...CATALOG_PRODUCTS.slice(1),
      ]),
    /Unsupported consumption warning/,
  );
});

void test('Powderizer eligibility covers every canonical source bag', () => {
  const mixable = CATALOG_PRODUCTS.filter((product) => product.mixable);
  assert.equal(mixable.length, 50);
  assert.ok(
    mixable.every(
      (product) => Number.isInteger(product.mixUnitGrams) && (product.mixUnitGrams ?? 0) > 0,
    ),
  );
  assert.equal(new Set(mixable.map((product) => product.category)).size, 7);
});

void test('source-unit parser handles grams, kilograms, and conceptual quantities exactly', () => {
  assert.equal(parseMixUnitGrams('100g'), 100);
  assert.equal(parseMixUnitGrams('1kg'), 1000);
  assert.equal(parseMixUnitGrams('conceptual quantity'), 1000);
  for (const quantity of ['0g', '1.5kg', '100 G', 'conceptual', '9999999999999999kg'])
    assert.equal(parseMixUnitGrams(quantity), null);
});

void test('expanded catalog preserves stable existing identities and premium product invariants', () => {
  assert.deepEqual(
    CATALOG_PRODUCTS.filter((product) => [27, 33, 34].includes(product.id)).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageSetId: product.image_set_id,
    })),
    [
      { id: 27, name: 'Campfire', slug: 'powdered-campfire', imageSetId: 'powdered-campfire' },
      { id: 33, name: 'House', slug: 'powdered-house', imageSetId: 'powdered-house' },
      { id: 34, name: 'Internet', slug: 'powdered-wifi', imageSetId: 'powdered-wifi' },
    ],
  );
  const moonRock = CATALOG_PRODUCTS.find((product) => product.slug === 'moon-rock');
  assert.equal(moonRock?.price_cents, 2500000);
  assert.equal(
    moonRock?.price_cents,
    Math.max(...CATALOG_PRODUCTS.map((product) => product.price_cents)),
  );
  assert.ok(CATALOG_PRODUCTS.every((product) => Number.isSafeInteger(product.price_cents)));
});

void test('canonical timestamps preserve exact chronology', () => {
  assert.deepEqual(
    CATALOG_PRODUCTS.map((product) => product.created_at),
    CATALOG_PRODUCTS.map((product) => CATALOG_CREATED_AT_BY_ID[product.id]),
  );
  assert.deepEqual(
    [...CATALOG_PRODUCTS]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((product) => product.id),
    Array.from({ length: 50 }, (_, index) => 50 - index),
  );
});
