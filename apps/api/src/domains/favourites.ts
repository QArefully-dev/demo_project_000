import { getDb } from '../db/index.js';

export interface FavouriteRow {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
}

interface ProductRow {
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

/** List all favourite products for a user, joined with the products table. */
export function listFavourites(userId: number): ProductRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.* FROM favourites f
       JOIN products p ON f.product_id = p.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(userId) as ProductRow[];
}

/** Add a product to a user's favourites. Idempotent — returns true if added or already present. */
export function addFavourite(userId: number, productId: number): true | 'NOT_FOUND' {
  const db = getDb();

  // Validate product exists
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return 'NOT_FOUND';

  db.prepare('INSERT OR IGNORE INTO favourites (user_id, product_id) VALUES (?, ?)').run(
    userId,
    productId,
  );
  return true;
}

/** Remove a product from a user's favourites. Returns true if removed, NOT_FOUND if not present. */
export function removeFavourite(userId: number, productId: number): true | 'NOT_FOUND' {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM favourites WHERE user_id = ? AND product_id = ?')
    .run(userId, productId);
  return result.changes > 0 ? true : 'NOT_FOUND';
}
