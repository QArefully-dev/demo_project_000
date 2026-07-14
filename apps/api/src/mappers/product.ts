import { CATALOG_PRODUCTS } from '@shop/catalog';
import type { Product } from '@shop/contracts/products';
import type { ProductRow } from '../features/catalog/productRepository.js';

const packagingByArtworkId = new Map<string, (typeof CATALOG_PRODUCTS)[number]['packaging']>(
  CATALOG_PRODUCTS.map((product) => [product.image_set_id, product.packaging]),
);

/** Maps a persisted product row to the transport contract and resolves canonical packaging. */
export function toProductContract(row: ProductRow): Product {
  const imageSetId = row.image_set_id ?? 'unknown';
  const packaging = packagingByArtworkId.get(imageSetId);

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageSetId,
    ...(packaging ? { packaging } : {}),
    category: row.category,
    stock: row.stock_count,
    slug: row.slug ?? '',
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    salesCount: row.sales_count ?? 0,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? undefined,
  };
}
