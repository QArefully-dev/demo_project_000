import {
  CATALOG_CATEGORIES,
  MIXABLE_CATALOG_CATEGORIES,
  NOT_FOR_CONSUMPTION,
  type CatalogCategory,
  type CatalogProduct,
} from './model.js';
import { CATALOG_PRODUCTS } from './catalog.js';
const nonConsumableCategories = new Set<CatalogCategory>([
  'Household',
  'Outdoors',
  'Questionable',
  'Impossible',
]);
const mixableCategories = new Set<CatalogCategory>(MIXABLE_CATALOG_CATEGORIES);
const assertUnique = (label: string, values: readonly (string | number)[]) => {
  if (new Set(values).size !== values.length) throw new Error(`Catalog has duplicate ${label}`);
};
export function validateCatalog(products: readonly CatalogProduct[] = CATALOG_PRODUCTS): void {
  if (products.length !== 45)
    throw new Error(`Catalog expected 45 products, got ${products.length}`);
  if (new Set(products.map((product) => product.category)).size !== CATALOG_CATEGORIES.length)
    throw new Error('Catalog category coverage is incomplete');
  for (const category of CATALOG_CATEGORIES)
    if (products.filter((product) => product.category === category).length < 5)
      throw new Error(`Catalog category ${category} has fewer than 5 products`);
  assertUnique(
    'IDs',
    products.map((product) => product.id),
  );
  assertUnique(
    'names',
    products.map((product) => product.name),
  );
  assertUnique(
    'slugs',
    products.map((product) => product.slug),
  );
  assertUnique(
    'artwork IDs',
    products.map((product) => product.image_set_id),
  );
  assertUnique(
    'newest ranks',
    products.map((product) => product.newest_rank),
  );
  if (products.filter((product) => product.compare_at_price_cents !== null).length !== 14)
    throw new Error('Catalog expected 14 sale products');
  if (products.filter((product) => product.mixable).length !== 19)
    throw new Error('Catalog expected 19 mixable products');
  for (const product of products) {
    if (!CATALOG_CATEGORIES.includes(product.category))
      throw new Error(`Catalog has unsupported category ${product.category}`);
    if (!Number.isInteger(product.id) || product.id < 1)
      throw new Error(`Invalid ID for ${product.slug}`);
    if (!Number.isInteger(product.price_cents) || product.price_cents < 1)
      throw new Error(`Invalid price for ${product.slug}`);
    if (!Number.isInteger(product.stock_count) || product.stock_count < 0)
      throw new Error(`Invalid stock for ${product.slug}`);
    if (!Number.isInteger(product.sales_count) || product.sales_count < 0)
      throw new Error(`Invalid sales count for ${product.slug}`);
    if (
      product.compare_at_price_cents !== null &&
      (!Number.isInteger(product.compare_at_price_cents) ||
        product.compare_at_price_cents <= product.price_cents)
    )
      throw new Error(`Invalid sale price for ${product.slug}`);
    if (!product.packaging.quantity || !product.packaging.mark || !product.packaging.batchCode)
      throw new Error(`Invalid packaging for ${product.slug}`);
    if (product.mixable) {
      const mixUnitGrams = product.mixUnitGrams;
      if (!mixableCategories.has(product.category))
        throw new Error(`Non-consumable category cannot be mixable for ${product.slug}`);
      if (typeof mixUnitGrams !== 'number' || !Number.isInteger(mixUnitGrams) || mixUnitGrams <= 0)
        throw new Error(`Invalid mix source grams for ${product.slug}`);
      if ((product.packaging.consumptionLabel ?? product.consumption_warning) !== null)
        throw new Error(`Mixable product must not have consumption warning for ${product.slug}`);
    } else if (product.mixUnitGrams !== null) {
      throw new Error(`Non-mixable product must not have mix source grams for ${product.slug}`);
    }
    if (
      nonConsumableCategories.has(product.category) &&
      (product.mixable ||
        (product.packaging.consumptionLabel ?? product.consumption_warning) !== NOT_FOR_CONSUMPTION)
    )
      throw new Error(`Missing consumption warning for ${product.slug}`);
  }
  const powderedWater = products.find((product) => product.slug === 'powdered-water');
  if (
    !powderedWater ||
    powderedWater.sales_count !== Math.max(...products.map((product) => product.sales_count))
  )
    throw new Error('Powdered Water must remain catalog bestseller');
}
