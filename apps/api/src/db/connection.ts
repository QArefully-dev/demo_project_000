import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: Database.Database | undefined;

/**
 * Ensures all required tables exist in the database.
 * Safe to call multiple times — uses IF NOT EXISTS for every table.
 */
function ensureSchema(db: Database.Database): void {
  const createTables = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL,
        description   TEXT    NOT NULL,
        price_cents   INTEGER NOT NULL,
        category      TEXT    NOT NULL,
        stock_count   INTEGER NOT NULL DEFAULT 0,
        image_url     TEXT    NOT NULL DEFAULT '',
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS promo_codes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        code             TEXT    NOT NULL UNIQUE,
        discount_percent INTEGER NOT NULL,
        min_item_count   INTEGER NOT NULL DEFAULT 0,
        active           INTEGER NOT NULL DEFAULT 1,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS carts (
        id          TEXT PRIMARY KEY,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cart_line_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id    TEXT    NOT NULL,
        product_id INTEGER NOT NULL,
        quantity   INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (cart_id)   REFERENCES carts(id)    ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(cart_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name      TEXT    NOT NULL,
        customer_email     TEXT    NOT NULL,
        shipping_address   TEXT    NOT NULL,
        promo_code_applied TEXT,
        subtotal_cents     INTEGER NOT NULL,
        discount_cents     INTEGER NOT NULL DEFAULT 0,
        total_cents        INTEGER NOT NULL,
        created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS order_line_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id            INTEGER NOT NULL,
        product_id          INTEGER NOT NULL,
        product_name        TEXT    NOT NULL,
        product_price_cents INTEGER NOT NULL,
        quantity            INTEGER NOT NULL,
        line_total_cents    INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);
  });

  createTables();
}

/**
 * Returns a lazy singleton Database instance.
 * On first call creates the data/ directory if needed,
 * opens the SQLite file, enables WAL + foreign keys, and ensures schema.
 *
 * @param dbPath Optional override for the database file path.
 *               Defaults to `data/shop.db` under cwd.
 */
export function getDb(dbPath?: string): Database.Database {
  if (dbInstance) return dbInstance;

  const resolvedPath =
    dbPath ?? process.env.SHOP_DB_PATH ?? path.join(process.cwd(), 'data', 'shop.db');

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  dbInstance = new Database(resolvedPath);

  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  ensureSchema(dbInstance);

  return dbInstance;
}
