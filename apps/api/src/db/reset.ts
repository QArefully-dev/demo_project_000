import type Database from 'better-sqlite3';

/**
 * Clears mutable data in foreign-key-safe order. This is the deliberate
 * clean-slate path: carts, orders, payments, and mailbox snapshots are removed
 * before the canonical powder catalogue is re-seeded. Append-only audit rows
 * remain as historical facts even when referenced mutable rows are removed.
 * Does NOT drop tables — schema is preserved.
 *
 * Reset order: mix stock reservations -> checkout reservations -> payments ->
 *   promo redemptions -> favourites -> reset tokens -> sessions -> mailbox ->
 *   mix components -> powder mixes -> order mix snapshots -> order line items ->
 *   orders -> cart line items -> carts -> promo codes -> product metadata ->
 *   products -> catalog tags -> users. `audit_events` is deliberately omitted.
 *
 * @param db The SQLite database instance.
 */
export function resetDatabase(db: Database.Database): void {
  const reset = db.transaction(() => {
    db.exec(`
      DELETE FROM powder_mix_stock_reservations;
      DELETE FROM cart_reservations;
      DELETE FROM promo_reservations;
      DELETE FROM payments;
      DELETE FROM promo_redemptions;
      DELETE FROM favourites;
      DELETE FROM password_reset_tokens;
      DELETE FROM sessions;
      DELETE FROM dev_mailbox;
      DELETE FROM powder_mix_components;
      DELETE FROM powder_mixes;
      DELETE FROM order_powder_mix_items;
      DELETE FROM order_line_items;
      DELETE FROM orders;
      DELETE FROM cart_line_items;
      DELETE FROM carts;
      DELETE FROM promo_codes;
      DELETE FROM product_tags;
      DELETE FROM product_specifications;
      DELETE FROM products;
      DELETE FROM catalog_tags;
      DELETE FROM users;
    `);
  });

  reset();
}
