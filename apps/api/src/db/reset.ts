import type Database from 'better-sqlite3';

/**
 * Clears mutable data in foreign-key-safe order. This is the deliberate
 * clean-slate path: carts, orders, payments, and mailbox snapshots are removed
 * before the canonical powder catalogue is re-seeded. Append-only audit rows
 * remain as historical facts even when referenced mutable rows are removed.
 * Does NOT drop tables — schema is preserved.
 *
 * Reset order: inventory movements -> receipts -> inventory allocations -> reservations ->
 *   checkout reservations -> payments -> promo redemptions -> review reports -> helpful votes ->
 *   reviews -> rating aggregates -> favourites -> reset tokens -> sessions -> mailbox ->
 *   order access grants -> lifecycle events ->
 *   shipment allocations -> shipments -> order line items ->
 *   orders -> cart line items -> carts -> promo codes -> bundle components ->
 *   bundles -> product metadata -> product variants ->
 *   products -> catalog tags -> users. `audit_events` is deliberately omitted.
 *
 * @param db The SQLite database instance.
 */
export function resetDatabase(db: Database.Database): void {
  const reset = db.transaction(() => {
    db.exec(`
      DROP TRIGGER IF EXISTS refund_items_no_update;
      DROP TRIGGER IF EXISTS refund_items_no_delete;
      DROP TRIGGER IF EXISTS refunds_no_update;
      DROP TRIGGER IF EXISTS refunds_no_delete;
      DROP TRIGGER IF EXISTS return_events_no_update;
      DROP TRIGGER IF EXISTS return_events_no_delete;
      DROP TRIGGER IF EXISTS inventory_stock_movements_no_delete;
      DROP TRIGGER IF EXISTS inventory_stock_movements_no_update;
      DELETE FROM refund_items;
      DELETE FROM refunds;
      DELETE FROM return_events;
      DELETE FROM return_request_items;
      DELETE FROM return_requests;
      DELETE FROM inventory_stock_movements;
      DELETE FROM inventory_receipts;
      DELETE FROM order_inventory_allocations;
      DELETE FROM inventory_reservations;
      DELETE FROM cart_reservations;
      DELETE FROM promo_reservations;
      DELETE FROM payments;
      DELETE FROM promo_redemptions;
      DELETE FROM review_reports;
      DELETE FROM review_helpful_votes;
      DELETE FROM reviews;
      DELETE FROM review_rating_aggregates;
      DELETE FROM favourites;
      DELETE FROM password_reset_tokens;
      DELETE FROM sessions;
      DELETE FROM dev_mailbox;
      DELETE FROM order_access_grants;
      DELETE FROM order_lifecycle_events;
      DELETE FROM order_shipment_items;
      DELETE FROM order_shipments;
      DELETE FROM order_line_items;
      DELETE FROM orders;
      DELETE FROM cart_line_items;
      DELETE FROM carts;
      DELETE FROM promo_codes;
      DELETE FROM curated_bundle_components;
      DELETE FROM curated_bundles;
      DELETE FROM product_tags;
      DELETE FROM product_specifications;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM catalog_tags;
      DELETE FROM users;
      CREATE TRIGGER inventory_stock_movements_no_update
      BEFORE UPDATE ON inventory_stock_movements
      BEGIN SELECT RAISE(ABORT, 'inventory_stock_movements are immutable'); END;
      CREATE TRIGGER inventory_stock_movements_no_delete
      BEFORE DELETE ON inventory_stock_movements
      BEGIN SELECT RAISE(ABORT, 'inventory_stock_movements are immutable'); END;
      CREATE TRIGGER return_events_no_update
      BEFORE UPDATE ON return_events
      BEGIN SELECT RAISE(ABORT, 'return_events are immutable'); END;
      CREATE TRIGGER return_events_no_delete
      BEFORE DELETE ON return_events
      BEGIN SELECT RAISE(ABORT, 'return_events are immutable'); END;
      CREATE TRIGGER refunds_no_update
      BEFORE UPDATE ON refunds
      BEGIN SELECT RAISE(ABORT, 'refunds are immutable'); END;
      CREATE TRIGGER refunds_no_delete
      BEFORE DELETE ON refunds
      BEGIN SELECT RAISE(ABORT, 'refunds are immutable'); END;
      CREATE TRIGGER refund_items_no_update
      BEFORE UPDATE ON refund_items
      BEGIN SELECT RAISE(ABORT, 'refund_items are immutable'); END;
      CREATE TRIGGER refund_items_no_delete
      BEFORE DELETE ON refund_items
      BEGIN SELECT RAISE(ABORT, 'refund_items are immutable'); END;
    `);
  });

  reset();
}
