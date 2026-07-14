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
  newest_rank: number;
  image_set_id: string;
  slug: string;
  mixable: boolean;
  mixUnitGrams: number | null;
  consumption_warning?: typeof NOT_FOR_CONSUMPTION | null;
  packaging: ProductPackaging;
}>;
export type CatalogProductDraft = Omit<CatalogProduct, 'mixable' | 'mixUnitGrams'>;

export const CONCEPTUAL_QUANTITY = 'conceptual quantity' as const;

/** Converts a labelled source package into the grams reserved by Powderizer. */
export const parseMixUnitGrams = (quantity: string): number | null => {
  if (quantity === CONCEPTUAL_QUANTITY) return 1000;

  const grams = /^([1-9][0-9]*)g$/.exec(quantity);
  const kilograms = /^([1-9][0-9]*)kg$/.exec(quantity);
  const amount = grams ? Number(grams[1]) : kilograms ? Number(kilograms[1]) * 1000 : NaN;

  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

/** Adds canonical Powderizer eligibility metadata from each source bag's labelled weight. */
export const createCatalogProducts = <T extends CatalogProductDraft>(
  products: readonly T[],
): readonly (T & Pick<CatalogProduct, 'mixable' | 'mixUnitGrams'>)[] =>
  products.map((product) => {
    const mixable = true;
    return {
      ...product,
      mixable,
      mixUnitGrams: parseMixUnitGrams(product.packaging.quantity),
    };
  });
export const createPackaging = (
  labelColor: string,
  powderColor: string,
  mark: string,
  batchCode: string,
  quantity: string,
  consumptionLabel: ProductPackaging['consumptionLabel'] = null,
): ProductPackaging => ({ labelColor, powderColor, mark, batchCode, quantity, consumptionLabel });
