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
  'Pantry Staples',
  'Performance',
  'Drinks',
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

const mixableCategories = new Set<CatalogCategory>(MIXABLE_CATALOG_CATEGORIES);

/** Adds canonical Powderizer eligibility metadata from each source bag's labelled weight. */
export const createCatalogProducts = <T extends CatalogProductDraft>(
  products: readonly T[],
): readonly (T & Pick<CatalogProduct, 'mixable' | 'mixUnitGrams'>)[] =>
  products.map((product) => {
    const mixable = mixableCategories.has(product.category);
    const sourceWeight = /^([1-9][0-9]*)g$/.exec(product.packaging.quantity);
    return {
      ...product,
      mixable,
      mixUnitGrams: mixable && sourceWeight ? Number(sourceWeight[1]) : null,
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
