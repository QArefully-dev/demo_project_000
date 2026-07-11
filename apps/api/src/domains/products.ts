import { getDb } from '../db/index.js';
import type { ProductQuery } from '@shop/contracts';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_url: string;
  slug: string;
  compare_at_price_cents: number | null;
  sales_count: number;
}

/** Escape SQLite LIKE special characters: backslash, percent, underscore. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

interface ListProductsResult {
  items: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Retrieve products with pagination, search, category filter, sale filter, and sorting. */
export function listProducts(query: ProductQuery): ListProductsResult {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.q) {
    const escaped = escapeLike(query.q);
    conditions.push("name LIKE ? ESCAPE '\\'");
    params.push(`%${escaped}%`);
  }

  if (query.category) {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(query.category);
  }

  if (query.onSale === true) {
    conditions.push('compare_at_price_cents IS NOT NULL');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (query.sort) {
    case 'price_asc':
      orderBy = 'ORDER BY price_cents ASC, id ASC';
      break;
    case 'price_desc':
      orderBy = 'ORDER BY price_cents DESC, id ASC';
      break;
    case 'bestselling':
      orderBy = 'ORDER BY sales_count DESC, id ASC';
      break;
    case 'newest':
    default:
      orderBy = 'ORDER BY id DESC';
      break;
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;

  // Count total matching rows
  const countRow = db.prepare(`SELECT COUNT(*) as c FROM products ${where}`).get(...params) as {
    c: number;
  };
  const total = countRow.c;

  const offset = (page - 1) * pageSize;
  const items = db
    .prepare(`SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as ProductRow[];

  return { items, total, page, pageSize };
}

/** Retrieve a single product by its numeric ID. Returns undefined if not found. */
export function getProductById(id: number): ProductRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
}

/** Retrieve distinct, sorted category names. */
export function getCategories(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all() as {
    category: string;
  }[];
  return rows.map((r) => r.category);
}

/** Retrieve up to `limit` best-selling products (sales_count >= 250). */
export function getBestsellers(limit = 8): ProductRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM products WHERE sales_count >= 250 ORDER BY sales_count DESC, id ASC LIMIT ?',
    )
    .all(limit) as ProductRow[];
}

/** Retrieve up to `limit` related products in the same category, excluding the given product. */
export function getRelatedProducts(productId: number, limit = 4): ProductRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM products
       WHERE category = (SELECT category FROM products WHERE id = ?)
         AND id != ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(productId, productId, limit) as ProductRow[];
}
