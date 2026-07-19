import { CATALOG_PRODUCTS } from '@shop/catalog';
import type { Product } from '@shop/contracts/products';
import type { CustomerProductRow, ProductRow } from '../features/catalog/productRepository.js';

const packagingByArtworkId = new Map<string, (typeof CATALOG_PRODUCTS)[number]['packaging']>(
  CATALOG_PRODUCTS.map((product) => [product.image_set_id, product.packaging]),
);

/** SQLite's `datetime('now')` values omit milliseconds and timezone; it is UTC by definition. */
function toUtcIsoInstant(value: string): string {
  const sqliteDateTime = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value);
  if (sqliteDateTime) return `${sqliteDateTime[1]}T${sqliteDateTime[2]}.000Z`;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : value;
}

/** Maps a persisted product row to transport, using hydrated SQLite metadata when available. */
export function toProductContract(row: ProductRow | CustomerProductRow): Product {
  const imageSetId = row.image_set_id ?? 'unknown';
  const packaging = packagingByArtworkId.get(imageSetId);
  const tags = 'tags' in row ? row.tags : [];
  const specificationGroups = 'specificationGroups' in row ? row.specificationGroups : [];
  const stock = row.available_to_sell ?? row.stock_count;
  const backorderable = row.backorderable === 1;
  const availability =
    stock > 0 ? 'in_stock' : backorderable && row.active === 1 ? 'backorder' : 'out_of_stock';

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageSetId,
    ...(packaging ? { packaging } : {}),
    category: row.category,
    stock,
    availability,
    backorderable,
    backorderLeadDays: backorderable ? (row.backorder_lead_days ?? null) : null,
    slug: row.slug ?? '',
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    salesCount: row.sales_count ?? 0,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? undefined,
    createdAt: toUtcIsoInstant(row.created_at),
    available: row.active === 1 && (stock > 0 || backorderable),
    tags,
    specificationGroups,
  };
}
