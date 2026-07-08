import { getDb } from '../db/index.js';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_url: string;
}

/** Retrieve all products from the catalog. */
export function listProducts(): ProductRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM products').all() as ProductRow[];
}

/** Retrieve a single product by its numeric ID. Returns undefined if not found. */
export function getProductById(id: number): ProductRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
}
