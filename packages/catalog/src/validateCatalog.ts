import {
  CATALOG_CATEGORIES,
  CATALOG_SPECIFICATION_DEFINITIONS,
  CATALOG_SPECIFICATION_GROUPS,
  NOT_FOR_CONSUMPTION,
  catalogProductSpecifications,
  catalogSpecificationByKey,
  catalogSpecificationGroupByKey,
  isNormalizedCatalogKey,
  isUtcIsoInstant,
  parsePackWeightGrams,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogSpecificationKey,
} from './model.js';
import { CATALOG_PRODUCTS } from './catalog.js';

const nonConsumableCategories = new Set<CatalogCategory>([
  'Household',
  'Outdoors',
  'Questionable',
  'Impossible',
]);

const assertUnique = (label: string, values: readonly (string | number)[]) => {
  if (new Set(values).size !== values.length) throw new Error(`Catalog has duplicate ${label}`);
};

const assertKeyAndLabel = (
  key: string,
  label: string,
  valueLabels: Map<string, string>,
  context: string,
) => {
  if (!isNormalizedCatalogKey(key)) throw new Error(`Invalid ${context} key ${key}`);
  if (!label.trim()) throw new Error(`Invalid ${context} label for ${key}`);
  const priorLabel = valueLabels.get(key);
  if (priorLabel && priorLabel !== label)
    throw new Error(`Catalog has inconsistent ${context} label for ${key}`);
  valueLabels.set(key, label);
};

const validateRegistries = () => {
  assertUnique(
    'specification groups',
    CATALOG_SPECIFICATION_GROUPS.map((group) => group.key),
  );
  assertUnique(
    'specification keys',
    CATALOG_SPECIFICATION_DEFINITIONS.map((definition) => definition.key),
  );
  for (const group of CATALOG_SPECIFICATION_GROUPS) {
    if (!isNormalizedCatalogKey(group.key) || !group.label.trim() || !Number.isInteger(group.order))
      throw new Error(`Invalid specification group ${group.key}`);
    if (!CATALOG_SPECIFICATION_DEFINITIONS.some((definition) => definition.group === group.key))
      throw new Error(`Catalog specification group ${group.key} has no facts`);
  }
  for (const definition of CATALOG_SPECIFICATION_DEFINITIONS) {
    if (!isNormalizedCatalogKey(definition.key) || !definition.label.trim())
      throw new Error(`Invalid specification definition ${definition.key}`);
    if (!catalogSpecificationGroupByKey.has(definition.group))
      throw new Error(`Unknown specification group ${definition.group}`);
    if (!Number.isInteger(definition.order) || definition.order < 1)
      throw new Error(`Invalid specification order for ${definition.key}`);
  }
};

export function validateCatalog(products: readonly CatalogProduct[] = CATALOG_PRODUCTS): void {
  validateRegistries();
  if (products.length !== 50) throw new Error(`Catalog expected 50 products, got ${products.length}`);
  if (new Set(products.map((product) => product.category)).size !== CATALOG_CATEGORIES.length)
    throw new Error('Catalog category coverage is incomplete');
  for (const category of CATALOG_CATEGORIES)
    if (products.filter((product) => product.category === category).length < 5)
      throw new Error(`Catalog category ${category} has fewer than 5 products`);
  assertUnique('IDs', products.map((product) => product.id));
  assertUnique('names', products.map((product) => product.name));
  assertUnique('slugs', products.map((product) => product.slug));
  assertUnique('artwork IDs', products.map((product) => product.image_set_id));
  assertUnique('creation timestamps', products.map((product) => product.created_at));
  if (products.filter((product) => product.compare_at_price_cents !== null).length !== 14)
    throw new Error('Catalog expected 14 sale products');
  if (products.filter((product) => product.mixable).length !== 50)
    throw new Error('Catalog expected 50 mixable products');

  const tagLabels = new Map<string, string>();
  const specificationValueLabels = new Map<string, string>();
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
    if (typeof product.active !== 'boolean') throw new Error(`Invalid active state for ${product.slug}`);
    if (!isUtcIsoInstant(product.created_at))
      throw new Error(`Invalid creation timestamp for ${product.slug}`);
    if (
      product.compare_at_price_cents !== null &&
      (!Number.isInteger(product.compare_at_price_cents) ||
        product.compare_at_price_cents <= product.price_cents)
    )
      throw new Error(`Invalid sale price for ${product.slug}`);
    if (!product.packaging.quantity || !product.packaging.mark || !product.packaging.batchCode)
      throw new Error(`Invalid packaging for ${product.slug}`);
    if (product.mixable) {
      if (
        typeof product.mixUnitGrams !== 'number' ||
        !Number.isInteger(product.mixUnitGrams) ||
        product.mixUnitGrams <= 0
      )
        throw new Error(`Invalid mix source grams for ${product.slug}`);
    } else if (product.mixUnitGrams !== null) {
      throw new Error(`Non-mixable product must not have mix source grams for ${product.slug}`);
    }
    if (
      nonConsumableCategories.has(product.category) &&
      product.packaging.consumptionLabel !== NOT_FOR_CONSUMPTION
    )
      throw new Error(`Missing consumption warning for ${product.slug}`);

    assertUnique(
      `tags for ${product.slug}`,
      product.tags.map((tag) => tag.key),
    );
    for (const tag of product.tags) assertKeyAndLabel(tag.key, tag.label, tagLabels, 'tag');

    for (const [property, value] of Object.entries(product.specifications)) {
      const key = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      if (!catalogSpecificationByKey.has(key as CatalogSpecificationKey))
        throw new Error(`Unknown specification key ${key} for ${product.slug}`);
      if (value)
        assertKeyAndLabel(
          value.key,
          value.label,
          specificationValueLabels,
          `specification value for ${key}:${value.key}`,
        );
    }

    const resolvedSpecifications = catalogProductSpecifications(product);
    const packWeight = resolvedSpecifications.find((specification) => specification.key === 'pack-weight');
    const warningClass = resolvedSpecifications.find(
      (specification) => specification.key === 'warning-class',
    );
    if (
      !packWeight ||
      packWeight.displayValue !== product.packaging.quantity ||
      packWeight.numericValue !== parsePackWeightGrams(product.packaging.quantity)
    )
      throw new Error(`Pack-weight metadata must derive from packaging for ${product.slug}`);
    if (
      !warningClass ||
      warningClass.displayValue !== (product.packaging.consumptionLabel ?? 'None')
    )
      throw new Error(`Warning metadata must derive from packaging for ${product.slug}`);
  }

  const powderedWater = products.find((product) => product.slug === 'powdered-water');
  if (
    !powderedWater ||
    powderedWater.sales_count !== Math.max(...products.map((product) => product.sales_count))
  )
    throw new Error('Powdered Water must remain catalog bestseller');
}
