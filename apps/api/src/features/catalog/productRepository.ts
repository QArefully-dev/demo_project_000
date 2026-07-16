import type Database from 'better-sqlite3';
import type { ProductQuery } from '@shop/contracts/products';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_set_id: string | null;
  slug: string;
  compare_at_price_cents: number | null;
  sales_count: number;
  mixable?: number;
  mix_unit_grams?: number | null;
  active: number;
  created_at: string;
}

export interface ProductList {
  items: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductRepository {
  list(query: ProductQuery): ProductList;
  /** Internal lookup for checkout, order history, and persisted mix components. */
  findById(id: number): ProductRow | undefined;
  /** Customer discovery lookup. Inactive products must remain invisible. */
  findActiveById(id: number): ProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): ProductRow[];
  listRelated(productId: number, limit?: number): ProductRow[];
  listEligibleMixProducts(): ProductRow[];
  /** Active-only component selection for new Powderizer quotes and mixes. */
  listActiveMixProducts(productIds: readonly number[]): ProductRow[];
  /** Internal component lookup for retained mix/cart history. */
  listMixProducts(productIds: readonly number[]): ProductRow[];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function createProductRepository(db: Database.Database): ProductRepository {
  return {
    list(query) {
      const conditions: string[] = ['active = 1'];
      const params: unknown[] = [];
      if (query.q) {
        const escaped = escapeLike(query.q);
        conditions.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
        params.push(`%${escaped}%`, `%${escaped}%`);
      }
      if (query.category) {
        conditions.push('LOWER(category) = LOWER(?)');
        params.push(query.category);
      }
      if (query.onSale === true) conditions.push('compare_at_price_cents IS NOT NULL');
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy =
        query.sort === 'price_asc'
          ? 'ORDER BY price_cents ASC, id ASC'
          : query.sort === 'price_desc'
            ? 'ORDER BY price_cents DESC, id ASC'
            : query.sort === 'bestselling'
              ? 'ORDER BY sales_count DESC, id ASC'
              : 'ORDER BY created_at DESC, id ASC';
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 12;
      const total = (
        db.prepare(`SELECT COUNT(*) AS count FROM products ${where}`).get(...params) as {
          count: number;
        }
      ).count;
      const items = db
        .prepare(`SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (page - 1) * pageSize) as ProductRow[];
      return { items, total, page, pageSize };
    },
    findById(id) {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
    },
    findActiveById(id) {
      return db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id) as
        ProductRow | undefined;
    },
    listCategories() {
      return (
        db
          .prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category ASC')
          .all() as {
          category: string;
        }[]
      ).map((row) => row.category);
    },
    listBestsellers(limit = 8) {
      return db
        .prepare(
          'SELECT * FROM products WHERE active = 1 AND sales_count >= 250 ORDER BY sales_count DESC, id ASC LIMIT ?',
        )
        .all(limit) as ProductRow[];
    },
    listRelated(productId, limit = 4) {
      return db
        .prepare(
          `SELECT * FROM products WHERE active = 1
           AND category = (SELECT category FROM products WHERE id = ? AND active = 1)
           AND id != ? ORDER BY id ASC LIMIT ?`,
        )
        .all(productId, productId, limit) as ProductRow[];
    },
    listEligibleMixProducts() {
      return db
        .prepare(
          `SELECT * FROM products
           WHERE active = 1 AND mixable = 1 AND mix_unit_grams IS NOT NULL AND mix_unit_grams > 0
           ORDER BY id ASC`,
        )
        .all() as ProductRow[];
    },
    listActiveMixProducts(productIds) {
      if (productIds.length === 0) return [];
      const placeholders = productIds.map(() => '?').join(', ');
      return db
        .prepare(
          `SELECT * FROM products WHERE active = 1 AND id IN (${placeholders}) ORDER BY id ASC`,
        )
        .all(...productIds) as ProductRow[];
    },
    listMixProducts(productIds) {
      if (productIds.length === 0) return [];
      const placeholders = productIds.map(() => '?').join(', ');
      return db
        .prepare(`SELECT * FROM products WHERE id IN (${placeholders}) ORDER BY id ASC`)
        .all(...productIds) as ProductRow[];
    },
  };
}
