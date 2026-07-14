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
}

export interface ProductList {
  items: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductRepository {
  list(query: ProductQuery): ProductList;
  findById(id: number): ProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): ProductRow[];
  listRelated(productId: number, limit?: number): ProductRow[];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function createProductRepository(db: Database.Database): ProductRepository {
  return {
    list(query) {
      const conditions: string[] = [];
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
              : 'ORDER BY id DESC';
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
    listCategories() {
      return (
        db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all() as {
          category: string;
        }[]
      ).map((row) => row.category);
    },
    listBestsellers(limit = 8) {
      return db
        .prepare(
          'SELECT * FROM products WHERE sales_count >= 250 ORDER BY sales_count DESC, id ASC LIMIT ?',
        )
        .all(limit) as ProductRow[];
    },
    listRelated(productId, limit = 4) {
      return db
        .prepare(
          `SELECT * FROM products WHERE category = (SELECT category FROM products WHERE id = ?)
           AND id != ? ORDER BY id ASC LIMIT ?`,
        )
        .all(productId, productId, limit) as ProductRow[];
    },
  };
}
