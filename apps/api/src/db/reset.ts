import type Database from 'better-sqlite3';

/**
 * Clears all data from every table in foreign-key-safe order.
 * Does NOT drop tables — schema is preserved.
 *
 * Reset order: payments -> promo redemptions -> favourites ->
 *   reset tokens -> sessions -> mailbox -> order line items ->
 *   orders -> cart line items -> carts -> promo codes -> products -> users.
 *
 * @param db The SQLite database instance.
 */
export function resetDatabase(db: Database.Database): void {
  const reset = db.transaction(() => {
    db.exec(`
      DELETE FROM payments;
      DELETE FROM promo_redemptions;
      DELETE FROM favourites;
      DELETE FROM password_reset_tokens;
      DELETE FROM sessions;
      DELETE FROM dev_mailbox;
      DELETE FROM order_line_items;
      DELETE FROM orders;
      DELETE FROM cart_line_items;
      DELETE FROM carts;
      DELETE FROM promo_codes;
      DELETE FROM products;
      DELETE FROM users;
    `);
  });

  reset();
}
