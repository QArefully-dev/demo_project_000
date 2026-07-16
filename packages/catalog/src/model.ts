export const CATALOG_CATEGORIES = [
  'Pantry Staples',
  'Performance',
  'Drinks',
  'Household',
  'Outdoors',
  'Questionable',
  'Impossible',
] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const MIXABLE_CATALOG_CATEGORIES = [...CATALOG_CATEGORIES] as const satisfies readonly CatalogCategory[];
export type MixableCatalogCategory = (typeof MIXABLE_CATALOG_CATEGORIES)[number];

export const NOT_FOR_CONSUMPTION = 'Not for consumption' as const;
export const NO_CONSUMPTION_WARNING = 'None' as const;
export const CONCEPTUAL_QUANTITY = 'conceptual quantity' as const;

export const CATALOG_SPECIFICATION_GROUPS = [
  { key: 'appearance', label: 'Appearance', order: 1 },
  { key: 'origin-and-use', label: 'Origin and use', order: 2 },
  { key: 'pack-and-care', label: 'Pack and care', order: 3 },
] as const;
export type CatalogSpecificationGroup = (typeof CATALOG_SPECIFICATION_GROUPS)[number];
export type CatalogSpecificationGroupKey = CatalogSpecificationGroup['key'];

export const CATALOG_SPECIFICATION_DEFINITIONS = [
  { key: 'texture', label: 'Texture', group: 'appearance', order: 1, filterable: true },
  { key: 'colour', label: 'Colour', group: 'appearance', order: 2, filterable: true },
  { key: 'source', label: 'Source', group: 'origin-and-use', order: 1, filterable: true },
  { key: 'intended-use', label: 'Intended use', group: 'origin-and-use', order: 2, filterable: true },
  { key: 'pack-weight', label: 'Pack weight', group: 'pack-and-care', order: 1, filterable: false },
  {
    key: 'storage-guidance',
    label: 'Storage guidance',
    group: 'pack-and-care',
    order: 2,
    filterable: false,
  },
  {
    key: 'warning-class',
    label: 'Warning class',
    group: 'pack-and-care',
    order: 3,
    filterable: false,
  },
] as const;
export type CatalogSpecificationDefinition = (typeof CATALOG_SPECIFICATION_DEFINITIONS)[number];
export type CatalogSpecificationKey = CatalogSpecificationDefinition['key'];

export const catalogSpecificationGroupByKey = new Map(
  CATALOG_SPECIFICATION_GROUPS.map((group) => [group.key, group]),
);
export const catalogSpecificationByKey = new Map(
  CATALOG_SPECIFICATION_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export const NORMALIZED_CATALOG_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isNormalizedCatalogKey = (value: string): boolean =>
  value.length <= 64 && NORMALIZED_CATALOG_KEY.test(value);

export const isCatalogSpecificationKey = (value: string): value is CatalogSpecificationKey =>
  catalogSpecificationByKey.has(value as CatalogSpecificationKey);

export type CatalogTag = Readonly<{
  key: string;
  label: string;
}>;

export type CatalogSpecificationValue = Readonly<{
  key: string;
  label: string;
}>;

/** Authoring-only facts. Pack weight and warning class derive from packaging. */
export type CatalogSpecifications = Readonly<{
  texture: CatalogSpecificationValue | null;
  colour: CatalogSpecificationValue | null;
  source: CatalogSpecificationValue | null;
  intendedUse: CatalogSpecificationValue | null;
  storageGuidance: CatalogSpecificationValue | null;
}>;

export type ProductPackaging = Readonly<{
  labelColor: string;
  powderColor: string;
  mark: string;
  batchCode: string;
  quantity: string;
  consumptionLabel: typeof NOT_FOR_CONSUMPTION | null;
}>;

export type CatalogProduct = Readonly<{
  id: number;
  name: string;
  description: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  category: CatalogCategory;
  stock_count: number;
  sales_count: number;
  active: boolean;
  created_at: string;
  tags: readonly CatalogTag[];
  specifications: CatalogSpecifications;
  image_set_id: string;
  slug: string;
  mixable: boolean;
  mixUnitGrams: number | null;
  packaging: ProductPackaging;
}>;
export type CatalogProductDraft = Omit<CatalogProduct, 'mixable' | 'mixUnitGrams'>;

export type ResolvedCatalogSpecification = Readonly<{
  key: CatalogSpecificationKey;
  label: string;
  group: CatalogSpecificationGroupKey;
  groupLabel: string;
  order: number;
  filterable: boolean;
  valueKey: string;
  displayValue: string;
  numericValue: number | null;
}>;

const quantityToGrams = (quantity: string): number | null => {
  const grams = /^([1-9][0-9]*)g$/.exec(quantity);
  const kilograms = /^([1-9][0-9]*)kg$/.exec(quantity);
  const amount = grams ? Number(grams[1]) : kilograms ? Number(kilograms[1]) * 1000 : NaN;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

/** Converts a labelled source package into grams reserved by Powderizer. */
export const parseMixUnitGrams = (quantity: string): number | null =>
  quantity === CONCEPTUAL_QUANTITY ? 1000 : quantityToGrams(quantity);

/** Returns a filterable physical pack weight; conceptual quantities have no gram value. */
export const parsePackWeightGrams = (quantity: string): number | null => quantityToGrams(quantity);

export const CATALOG_CHRONOLOGY_START = '2025-01-01T00:00:00.000Z' as const;
const chronologyStartMs = Date.parse(CATALOG_CHRONOLOGY_START);
const millisecondsPerDay = 24 * 60 * 60 * 1000;

/** One deterministic UTC day per legacy rank. Higher ranks are newer. Content-conversion only. */
export const createdAtFromNewestRank = (rank: number): string => {
  if (!Number.isSafeInteger(rank) || rank < 1)
    throw new RangeError(`Invalid legacy newest rank: ${rank}`);
  return new Date(chronologyStartMs + (rank - 1) * millisecondsPerDay).toISOString();
};

export const isUtcIsoInstant = (value: string): boolean => {
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
};

const authoringSpecificationKeys = [
  ['texture', 'texture'],
  ['colour', 'colour'],
  ['source', 'source'],
  ['intended-use', 'intendedUse'],
  ['storage-guidance', 'storageGuidance'],
] as const;

/** Resolves authoring facts plus packaging-derived facts for seed and transport mapping. */
export const catalogProductSpecifications = (
  product: Pick<CatalogProduct, 'packaging' | 'specifications'>,
): readonly ResolvedCatalogSpecification[] => {
  const values: Array<readonly [CatalogSpecificationKey, CatalogSpecificationValue | null, number | null]> =
    authoringSpecificationKeys.map(([key, property]) => [
      key,
      product.specifications[property],
      null,
    ]);
  values.push([
    'pack-weight',
    { key: product.packaging.quantity.replaceAll(' ', '-'), label: product.packaging.quantity },
    parsePackWeightGrams(product.packaging.quantity),
  ]);
  values.push([
    'warning-class',
    product.packaging.consumptionLabel
      ? { key: 'not-for-consumption', label: product.packaging.consumptionLabel }
      : { key: 'none', label: NO_CONSUMPTION_WARNING },
    null,
  ]);

  return values.flatMap(([key, value, numericValue]) => {
    if (!value) return [];
    const definition = catalogSpecificationByKey.get(key);
    if (!definition) throw new Error(`Missing catalog specification definition: ${key}`);
    const group = catalogSpecificationGroupByKey.get(definition.group);
    if (!group) throw new Error(`Missing catalog specification group: ${definition.group}`);
    return [
      {
        key,
        label: definition.label,
        group: definition.group,
        groupLabel: group.label,
        order: definition.order,
        filterable: definition.filterable,
        valueKey: value.key,
        displayValue: value.label,
        numericValue,
      },
    ];
  });
};

/** Adds canonical Powderizer eligibility metadata from each source bag's labelled weight. */
export const createCatalogProducts = <T extends CatalogProductDraft>(
  products: readonly T[],
): readonly (T & Pick<CatalogProduct, 'mixable' | 'mixUnitGrams'>)[] =>
  products.map((product) => ({
    ...product,
    mixable: true,
    mixUnitGrams: parseMixUnitGrams(product.packaging.quantity),
  }));

export const createPackaging = (
  labelColor: string,
  powderColor: string,
  mark: string,
  batchCode: string,
  quantity: string,
  consumptionLabel: ProductPackaging['consumptionLabel'] = null,
): ProductPackaging => ({ labelColor, powderColor, mark, batchCode, quantity, consumptionLabel });
