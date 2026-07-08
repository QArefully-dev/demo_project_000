import type Database from 'better-sqlite3';

/**
 * Clears all data from every table in foreign-key-safe order.
 * Does NOT drop tables — schema is preserved.
 *
 * @param db The SQLite database instance.
 */
export function resetDatabase(db: Database.Database): void {
  const reset = db.transaction(() => {
    db.exec(`
      DELETE FROM cart_line_items;
      DELETE FROM carts;
      DELETE FROM order_line_items;
      DELETE FROM orders;
      DELETE FROM promo_codes;
      DELETE FROM products;
    `);
  });

  reset();
}
