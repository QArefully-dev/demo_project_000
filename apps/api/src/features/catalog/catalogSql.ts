import type { NormalizedCatalogQuery } from './catalogQuery.js';

export interface CatalogPredicate {
  where: string;
  params: readonly unknown[];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** Builds one active-first predicate shared exactly by catalog count and list queries. */
export function buildCatalogPredicate(query: NormalizedCatalogQuery): CatalogPredicate {
  const conditions: string[] = ['p.active = 1'];
  const params: unknown[] = [];
  if (query.q) {
    const escaped = escapeLike(query.q);
    conditions.push("(p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    params.push(`%${escaped}%`, `%${escaped}%`);
  }
  if (query.category) {
    conditions.push('LOWER(p.category) = LOWER(?)');
    params.push(query.category);
  }
  if (query.onSale) conditions.push('p.compare_at_price_cents IS NOT NULL');
  if (query.minPriceCents !== undefined) {
    conditions.push('p.price_cents >= ?');
    params.push(query.minPriceCents);
  }
  if (query.maxPriceCents !== undefined) {
    conditions.push('p.price_cents <= ?');
    params.push(query.maxPriceCents);
  }
  if (query.addedFrom) {
    conditions.push('p.created_at >= ?');
    params.push(`${query.addedFrom}T00:00:00.000Z`);
  }
  if (query.addedTo) {
    conditions.push('p.created_at <= ?');
    params.push(`${query.addedTo}T23:59:59.999Z`);
  }
  for (const tag of query.tags) {
    conditions.push(
      'EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = p.id AND pt.tag_key = ?)',
    );
    params.push(tag);
  }
  for (const specification of query.specifications) {
    conditions.push(
      'EXISTS (SELECT 1 FROM product_specifications ps WHERE ps.product_id = p.id AND ps.specification_key = ? AND ps.value_key = ?)',
    );
    params.push(specification.key, specification.valueKey);
  }
  if (query.availability === 'available') conditions.push('p.stock_count > 0');
  if (query.availability === 'out_of_stock') conditions.push('p.stock_count = 0');
  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

const ORDER_BY = {
  newest: 'ORDER BY p.created_at DESC, p.id ASC',
  oldest: 'ORDER BY p.created_at ASC, p.id ASC',
  name_asc: 'ORDER BY p.name COLLATE NOCASE ASC, p.id ASC',
  price_asc: 'ORDER BY p.price_cents ASC, p.id ASC',
  price_desc: 'ORDER BY p.price_cents DESC, p.id ASC',
  bestselling: 'ORDER BY p.sales_count DESC, p.id ASC',
} as const;

/** SQL identifier selection remains entirely allowlisted. */
export function catalogOrderBy(sort: NormalizedCatalogQuery['sort']): string {
  return ORDER_BY[sort];
}
