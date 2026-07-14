import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {
  closeDatabase,
  migrateDatabase,
  openDatabase,
  resetDatabase,
  seedDatabase,
  type Migration,
} from '../../src/db/index.js';
import { migrations } from '../../src/db/migrations/index.js';

const expectedVersions = ['001', '002', '003', '004', '005', '006', '007'];

function migrationVersions(db: Database.Database): string[] {
  return db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map((row) => (row as { version: string }).version);
}

function createLegacyFixture(db: Database.Database): void {
  db.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category TEXT NOT NULL,
      stock_count INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_percent INTEGER NOT NULL,
      min_item_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      promo_code_applied TEXT,
      subtotal_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      idempotency_key TEXT NOT NULL UNIQUE,
      request_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      card_last4 TEXT NOT NULL,
      card_brand TEXT NOT NULL,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      response_json TEXT
    );
    INSERT INTO products (id, name, description, price_cents, category, stock_count)
    VALUES (99, 'Legacy powder', 'Preserve me', 1234, 'Legacy', 3);
    INSERT INTO promo_codes (code, discount_percent) VALUES ('LEGACY10', 10);
    INSERT INTO orders (customer_name, customer_email, shipping_address, subtotal_cents, total_cents)
    VALUES ('Legacy customer', 'legacy@example.test', '99 Legacy Lane', 1234, 1234);
    INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, response_json)
    VALUES ('legacy-payment', 'safe-fingerprint', 'success', 1234, '4242', 'Visa', '{"success":true}');
  `);
}

void test('migrations create a fresh schema, record every version, and remain idempotent', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-fresh-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  assert.deepEqual(migrationVersions(db), expectedVersions);
  assert.deepEqual(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").get(),
    { name: 'products' },
  );
  assert.ok(
    (db.prepare('PRAGMA table_info(payments)').all() as { name: string }[]).some(
      (column) => column.name === 'response_json',
    ),
  );
  assert.ok(
    (db.prepare('PRAGMA table_info(payments)').all() as { name: string }[]).some(
      (column) => column.name === 'quote_json',
    ),
  );

  migrateDatabase(db);
  assert.deepEqual(migrationVersions(db), expectedVersions);
});

void test('migrations upgrade the legacy schema without losing known data', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-legacy-'));
  const db = new Database(join(directory, 'shop.db'));
  db.pragma('foreign_keys = ON');
  createLegacyFixture(db);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  migrateDatabase(db);

  assert.deepEqual(migrationVersions(db), expectedVersions);
  assert.deepEqual(
    db.prepare('SELECT name, image_set_id, slug FROM products WHERE id = 99').get(),
    { name: 'Legacy powder', image_set_id: 'legacy-product-99', slug: '' },
  );
  assert.deepEqual(
    db
      .prepare('SELECT code, kind, redemption_count FROM promo_codes WHERE code = ?')
      .get('LEGACY10'),
    { code: 'LEGACY10', kind: 'percent', redemption_count: 0 },
  );
  assert.deepEqual(db.prepare('SELECT customer_name, user_id FROM orders').get(), {
    customer_name: 'Legacy customer',
    user_id: null,
  });
  assert.deepEqual(
    db
      .prepare(
        'SELECT status, response_json, cart_id, quote_json FROM payments WHERE idempotency_key = ?',
      )
      .get('legacy-payment'),
    { status: 'success', response_json: '{"success":true}', cart_id: null, quote_json: null },
  );
});

void test('migration failure rolls back schema changes and propagates', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-failure-'));
  const db = new Database(join(directory, 'shop.db'));
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const failingMigration: Migration = {
    version: '001',
    name: 'failing migration',
    up(database) {
      database.exec('CREATE TABLE should_rollback (id INTEGER PRIMARY KEY)');
      throw new Error('intentional migration failure');
    },
  };

  assert.throws(() => migrateDatabase(db, [failingMigration]), /intentional migration failure/);
  assert.equal(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'")
      .get(),
    undefined,
  );
  assert.deepEqual(migrationVersions(db), []);
});

void test('password reset migration revokes legacy raw tokens and removes their column', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-reset-token-'));
  const db = new Database(join(directory, 'shop.db'));
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  migrateDatabase(db, migrations.slice(0, 5));
  db.exec(`
    ALTER TABLE password_reset_tokens RENAME TO password_reset_tokens_current;
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    DROP TABLE password_reset_tokens_current;
  `);
  db.prepare(
    `INSERT INTO users (email, display_name, password_hash, password_salt, role)
     VALUES ('legacy-reset@example.test', 'Legacy reset', 'salt.hash', '', 'customer')`,
  ).run();
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES (1, 'legacy-plaintext-token', '2099-01-01T00:00:00.000Z')`,
  ).run();

  migrateDatabase(db);
  const columns = db.prepare('PRAGMA table_info(password_reset_tokens)').all() as {
    name: string;
  }[];
  assert.equal(
    columns.some((column) => column.name === 'token'),
    false,
  );
  assert.equal(
    columns.some((column) => column.name === 'token_digest'),
    true,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM password_reset_tokens').get() as { count: number })
      .count,
    0,
  );
});

void test('seed and reset operate on a migrated database', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  db.prepare("INSERT INTO carts (id) VALUES ('migration-test-cart')").run();
  resetDatabase(db);
  seedDatabase(db);

  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
    45,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM carts').get() as { count: number }).count,
    0,
  );
  assert.deepEqual(migrationVersions(db), expectedVersions);
});
