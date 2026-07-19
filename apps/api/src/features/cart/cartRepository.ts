import type Database from 'better-sqlite3';
import type { ProductRow } from '../catalog/productRepository.js';

export interface CartLineRow extends ProductRow {
  product_id: number;
  quantity: number;
}

export interface CartRepository {
  create(id: string): void;
  exists(cartId: string): boolean;
  listLines(cartId: string): CartLineRow[];
  productExists(productId: string): boolean;
  lineQuantity(cartId: string, productId: string): number;
  addLine(cartId: string, productId: string): void;
  addLineQuantity(cartId: string, productId: string, quantity: number): void;
  updateLine(cartId: string, productId: string, quantity: number): boolean;
  removeLine(cartId: string, productId: string): boolean;
  reserve(cartId: string, paymentIdempotencyKey: string, createdAt: string): boolean;
  releaseReservation(paymentIdempotencyKey: string): boolean;
  /** Expired prepared checkout locks do not block cart mutation. */
  isReserved(cartId: string, now?: string): boolean;
  touch(cartId: string): void;
  remove(cartId: string): void;
}

export function createCartRepository(db: Database.Database): CartRepository {
  return {
    create(id) {
      db.prepare('INSERT INTO carts (id) VALUES (?)').run(id);
    },
    exists(cartId) {
      return db.prepare('SELECT 1 FROM carts WHERE id = ?').get(cartId) !== undefined;
    },
    listLines(cartId) {
      return db
        .prepare(
          `SELECT cli.product_id, cli.quantity, p.* FROM cart_line_items cli
           JOIN products p ON p.id = cli.product_id WHERE cli.cart_id = ?`,
        )
        .all(cartId) as CartLineRow[];
    },
    productExists(productId) {
      return (
        db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId) !==
        undefined
      );
    },
    lineQuantity(cartId, productId) {
      return (
        (
          db
            .prepare('SELECT quantity FROM cart_line_items WHERE cart_id = ? AND product_id = ?')
            .get(cartId, productId) as { quantity: number } | undefined
        )?.quantity ?? 0
      );
    },
    addLine(cartId, productId) {
      db.prepare(
        `INSERT INTO cart_line_items (cart_id, product_id, quantity) VALUES (?, ?, 1)
         ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + 1`,
      ).run(cartId, productId);
    },
    addLineQuantity(cartId, productId, quantity) {
      db.prepare(
        `INSERT INTO cart_line_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
         ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
      ).run(cartId, productId, quantity);
    },
    updateLine(cartId, productId, quantity) {
      return (
        db
          .prepare('UPDATE cart_line_items SET quantity = ? WHERE cart_id = ? AND product_id = ?')
          .run(quantity, cartId, productId).changes > 0
      );
    },
    removeLine(cartId, productId) {
      return (
        db
          .prepare('DELETE FROM cart_line_items WHERE cart_id = ? AND product_id = ?')
          .run(cartId, productId).changes > 0
      );
    },
    reserve(cartId, paymentIdempotencyKey, createdAt) {
      const result = db
        .prepare(
          `INSERT INTO cart_reservations (cart_id, payment_idempotency_key, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(cart_id) DO NOTHING`,
        )
        .run(cartId, paymentIdempotencyKey, createdAt);
      if (result.changes === 1) return true;
      return (
        db
          .prepare(
            'SELECT 1 FROM cart_reservations WHERE cart_id = ? AND payment_idempotency_key = ?',
          )
          .get(cartId, paymentIdempotencyKey) !== undefined
      );
    },
    releaseReservation(paymentIdempotencyKey) {
      return (
        db
          .prepare('DELETE FROM cart_reservations WHERE payment_idempotency_key = ?')
          .run(paymentIdempotencyKey).changes > 0
      );
    },
    isReserved(cartId, now) {
      return (
        db
          .prepare(
            `SELECT 1
             FROM cart_reservations cr
             LEFT JOIN payments p ON p.idempotency_key = cr.payment_idempotency_key
             WHERE cr.cart_id = ?
               AND NOT (
                 p.status = 'prepared'
                 AND p.reservation_expires_at IS NOT NULL
                 AND p.reservation_expires_at <= ?
               )`,
          )
          .get(cartId, now ?? new Date().toISOString()) !== undefined
      );
    },
    touch(cartId) {
      db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
    },
    remove(cartId) {
      db.prepare('DELETE FROM carts WHERE id = ?').run(cartId);
    },
  };
}
