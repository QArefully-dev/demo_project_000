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
  consumption_warning?: typeof NOT_FOR_CONSUMPTION | null;
  packaging: ProductPackaging;
}>;
export const createPackaging = (
  labelColor: string,
  powderColor: string,
  mark: string,
  batchCode: string,
  quantity: string,
  consumptionLabel: ProductPackaging['consumptionLabel'] = null,
): ProductPackaging => ({ labelColor, powderColor, mark, batchCode, quantity, consumptionLabel });
