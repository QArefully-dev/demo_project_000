import type Database from 'better-sqlite3';
import type { ProductRow } from '../catalog/productRepository.js';

export interface FavouritesRepository {
  list(userId: number): ProductRow[];
  productExists(productId: number): boolean;
  add(userId: number, productId: number): void;
  remove(userId: number, productId: number): boolean;
}

export function createFavouritesRepository(db: Database.Database): FavouritesRepository {
  return {
    list(userId) {
      return db
        .prepare(
          `SELECT p.* FROM favourites f JOIN products p ON f.product_id = p.id
           WHERE f.user_id = ? AND p.active = 1 ORDER BY f.created_at DESC`,
        )
        .all(userId) as ProductRow[];
    },
    productExists(productId) {
      return (
        db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId) !==
        undefined
      );
    },
    add(userId, productId) {
      db.prepare('INSERT OR IGNORE INTO favourites (user_id, product_id) VALUES (?, ?)').run(
        userId,
        productId,
      );
    },
    remove(userId, productId) {
      return (
        db
          .prepare('DELETE FROM favourites WHERE user_id = ? AND product_id = ?')
          .run(userId, productId).changes > 0
      );
    },
  };
}
