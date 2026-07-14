import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_ARTWORK_IDS,
  CATALOG_PRODUCTS,
  parseMixUnitGrams,
  validateCatalog,
} from './index.js';
void test('canonical catalog validates only when explicitly invoked', () => {
  assert.doesNotThrow(() => validateCatalog());
  assert.equal(CATALOG_PRODUCTS.length, 50);
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
