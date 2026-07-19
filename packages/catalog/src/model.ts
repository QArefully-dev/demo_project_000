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

export const MIXABLE_CATALOG_CATEGORIES = [
  ...CATALOG_CATEGORIES,
] as const satisfies readonly CatalogCategory[];
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
  {
    key: 'intended-use',
    label: 'Intended use',
    group: 'origin-and-use',
    order: 2,
    filterable: true,
  },
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
  backorderable: boolean;
  backorderLeadDays: number | null;
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
export type CatalogProductDraft = Omit<
  CatalogProduct,
  'mixable' | 'mixUnitGrams' | 'backorderable' | 'backorderLeadDays'
> &
  Partial<Pick<CatalogProduct, 'backorderable' | 'backorderLeadDays'>>;

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

/** Immutable canonical dates. Category records author these same UTC literals. */
export const CATALOG_CREATED_AT_BY_ID: Readonly<Record<number, string>> = {
  1: '2025-01-01T00:00:00.000Z',
  2: '2025-01-02T00:00:00.000Z',
  3: '2025-01-03T00:00:00.000Z',
  4: '2025-01-04T00:00:00.000Z',
  5: '2025-01-05T00:00:00.000Z',
  6: '2025-01-06T00:00:00.000Z',
  7: '2025-01-07T00:00:00.000Z',
  8: '2025-01-08T00:00:00.000Z',
  9: '2025-01-09T00:00:00.000Z',
  10: '2025-01-10T00:00:00.000Z',
  11: '2025-01-11T00:00:00.000Z',
  12: '2025-01-12T00:00:00.000Z',
  13: '2025-01-13T00:00:00.000Z',
  14: '2025-01-14T00:00:00.000Z',
  15: '2025-01-15T00:00:00.000Z',
  16: '2025-01-16T00:00:00.000Z',
  17: '2025-01-17T00:00:00.000Z',
  18: '2025-01-18T00:00:00.000Z',
  19: '2025-01-19T00:00:00.000Z',
  20: '2025-01-20T00:00:00.000Z',
  21: '2025-01-21T00:00:00.000Z',
  22: '2025-01-22T00:00:00.000Z',
  23: '2025-01-23T00:00:00.000Z',
  24: '2025-01-24T00:00:00.000Z',
  25: '2025-01-25T00:00:00.000Z',
  26: '2025-01-26T00:00:00.000Z',
  27: '2025-01-27T00:00:00.000Z',
  28: '2025-01-28T00:00:00.000Z',
  29: '2025-01-29T00:00:00.000Z',
  30: '2025-01-30T00:00:00.000Z',
  31: '2025-01-31T00:00:00.000Z',
  32: '2025-02-01T00:00:00.000Z',
  33: '2025-02-02T00:00:00.000Z',
  34: '2025-02-03T00:00:00.000Z',
  35: '2025-02-04T00:00:00.000Z',
  36: '2025-02-05T00:00:00.000Z',
  37: '2025-02-06T00:00:00.000Z',
  38: '2025-02-07T00:00:00.000Z',
  39: '2025-02-08T00:00:00.000Z',
  40: '2025-02-09T00:00:00.000Z',
  41: '2025-02-10T00:00:00.000Z',
  42: '2025-02-11T00:00:00.000Z',
  43: '2025-02-12T00:00:00.000Z',
  44: '2025-02-13T00:00:00.000Z',
  45: '2025-02-14T00:00:00.000Z',
  46: '2025-02-15T00:00:00.000Z',
  47: '2025-02-16T00:00:00.000Z',
  48: '2025-02-17T00:00:00.000Z',
  49: '2025-02-18T00:00:00.000Z',
  50: '2025-02-19T00:00:00.000Z',
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
  const values: Array<
    readonly [CatalogSpecificationKey, CatalogSpecificationValue | null, number | null]
  > = authoringSpecificationKeys.map(([key, property]) => [
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
): readonly (T & Pick<CatalogProduct, 'mixable' | 'mixUnitGrams' | 'backorderable' | 'backorderLeadDays'>)[] =>
  products.map((product) => ({
    ...product,
    mixable: true,
    mixUnitGrams: parseMixUnitGrams(product.packaging.quantity),
    backorderable: product.backorderable ?? false,
    backorderLeadDays: product.backorderable ? product.backorderLeadDays ?? null : null,
  }));

export const createPackaging = (
  labelColor: string,
  powderColor: string,
  mark: string,
  batchCode: string,
  quantity: string,
  consumptionLabel: ProductPackaging['consumptionLabel'] = null,
): ProductPackaging => ({ labelColor, powderColor, mark, batchCode, quantity, consumptionLabel });
