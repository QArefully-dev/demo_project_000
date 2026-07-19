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
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { toProductContract } from '../../src/mappers/product.js';
import type { ProductRow } from '../../src/features/catalog/productRepository.js';
import { Product } from '@shop/contracts/products';
import { CURATED_BUNDLES } from '@shop/catalog';
import { Value } from '@sinclair/typebox/value';

const expectedVersions = [
  '001',
  '002',
  '003',
  '004',
  '005',
  '006',
  '007',
  '008',
  '009',
  '010',
  '011',
  '012',
  '013',
  '014',
];

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
    INSERT INTO products (id, name, description, price_cents, category, stock_count, created_at)
    VALUES (99, 'Legacy powder', 'Preserve me', 1234, 'Legacy', 3, '2024-12-31 23:59:59');
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
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_events'")
      .get(),
    { name: 'audit_events' },
  );
  assert.deepEqual(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reviews'").get(),
    { name: 'reviews' },
  );
  for (const index of [
    'audit_events_occurred_at_id_idx',
    'audit_events_action_occurred_at_id_idx',
    'audit_events_entity_occurred_at_id_idx',
    'audit_events_actor_user_occurred_at_id_idx',
    'audit_events_request_occurred_at_id_idx',
  ]) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(index),
      { name: index },
    );
  }
  for (const index of [
    'reviews_product_status_created_at_id_idx',
    'orders_user_id_id_idx',
    'order_line_items_product_id_order_id_idx',
    'payments_order_id_status_idx',
  ]) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(index),
      { name: index },
    );
  }
  for (const trigger of ['audit_events_no_update', 'audit_events_no_delete']) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(trigger),
      { name: trigger },
    );
  }
  assert.ok(
    (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).some(
      (column) => column.name === 'active',
    ),
  );
  for (const table of ['catalog_tags', 'product_tags', 'product_specifications']) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
      { name: table },
    );
  }
  for (const table of ['curated_bundles', 'curated_bundle_components']) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
      { name: table },
    );
  }
  for (const table of [
    'order_shipments',
    'order_shipment_items',
    'order_lifecycle_events',
    'order_access_grants',
  ]) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
      { name: table },
    );
  }
  for (const index of [
    'orders_demo_seed_key_idx',
    'orders_user_created_at_id_idx',
    'order_shipments_order_number_idx',
    'order_shipment_items_order_line_item_idx',
    'order_shipment_items_order_mix_item_idx',
    'order_lifecycle_events_order_occurred_id_idx',
    'order_lifecycle_events_shipment_occurred_id_idx',
    'order_access_grants_expires_at_idx',
    'order_access_grants_order_id_idx',
  ]) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(index),
      { name: index },
    );
  }
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?")
      .get('order_lifecycle_events_no_update'),
    { name: 'order_lifecycle_events_no_update' },
  );
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('curated_bundle_components_product_bundle_idx'),
    { name: 'curated_bundle_components_product_bundle_idx' },
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO curated_bundles (id, key, name, description, active, sort_order)
           VALUES (100, 'invalid-bundle', 'Invalid', 'Invalid', 2, 1)`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  db.prepare(
    `INSERT INTO curated_bundles (id, key, name, description, active, sort_order)
     VALUES (100, 'migration-test-bundle', 'Migration test', 'Migration test bundle', 1, 1)`,
  ).run();
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO curated_bundle_components (bundle_id, product_id, quantity, sort_order)
           VALUES (100, 99999, 1, 1)`,
        )
        .run(),
    /FOREIGN KEY constraint failed/,
  );
  for (const index of [
    'products_active_created_at_id_idx',
    'products_active_price_cents_id_idx',
    'product_tags_tag_key_product_id_idx',
    'product_specifications_key_value_product_id_idx',
  ]) {
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(index),
      { name: index },
    );
  }
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'powder_mixes'")
      .get(),
    { name: 'powder_mixes' },
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'powder_mix_stock_reservations'",
      )
      .get(),
    { name: 'powder_mix_stock_reservations' },
  );
  assert.ok(
    (db.prepare('PRAGMA table_info(payments)').all() as { name: string }[]).some(
      (column) => column.name === 'quote_json',
    ),
  );

  migrateDatabase(db);
  assert.deepEqual(migrationVersions(db), expectedVersions);
});

void test('customer review constraints reject invalid scalar and duplicate data', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-reviews-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  db.prepare(
    `INSERT INTO products
      (name, description, price_cents, category, stock_count, image_set_id)
     VALUES ('Review product', 'Review migration fixture', 1000, 'Test', 1, 'review-product')`,
  ).run();
  db.prepare(
    `INSERT INTO users (email, display_name, password_hash, password_salt, role)
     VALUES ('reviewer@example.test', 'Reviewer', 'hash', 'salt', 'customer')`,
  ).run();
  db.prepare(
    `INSERT INTO users (email, display_name, password_hash, password_salt, role)
     VALUES ('reviewer-two@example.test', 'Reviewer two', 'hash', 'salt', 'customer')`,
  ).run();

  const insertReview = db.prepare(
    'INSERT INTO reviews (product_id, user_id, rating, body, status) VALUES (1, ?, ?, ?, ?)',
  );
  insertReview.run(1, 5, '12345678901234567890', 'published');

  assert.throws(
    () => insertReview.run(1, 5, '12345678901234567890', 'published'),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => insertReview.run(2, 0, '12345678901234567890', 'published'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertReview.run(2, 1.5, '12345678901234567890', 'published'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertReview.run(2, 1, '1234567890123456789', 'published'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertReview.run(2, 1, 'x'.repeat(4001), 'published'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertReview.run(2, 1, ' 12345678901234567890', 'published'),
    /CHECK constraint failed/,
  );
  insertReview.run(2, 1, 'x'.repeat(4000), 'hidden');
  assert.throws(
    () => insertReview.run(2, 1, '12345678901234567890', 'removed'),
    /CHECK constraint failed/,
  );
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
    db
      .prepare(
        'SELECT name, image_set_id, slug, mixable, mix_unit_grams, active, created_at FROM products WHERE id = 99',
      )
      .get(),
    {
      name: 'Legacy powder',
      image_set_id: 'legacy-product-99',
      slug: '',
      mixable: 0,
      mix_unit_grams: null,
      active: 1,
      created_at: '2024-12-31 23:59:59',
    },
  );
  const legacyRow = db.prepare('SELECT * FROM products WHERE id = 99').get() as ProductRow;
  const legacyProduct = toProductContract(legacyRow);
  assert.equal(legacyProduct.createdAt, '2024-12-31T23:59:59.000Z');
  assert.equal(Value.Check(Product, legacyProduct), true);
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
    db.prepare('SELECT lifecycle_status, version, cancelled_at, demo_seed_key FROM orders').get(),
    { lifecycle_status: 'processing', version: 0, cancelled_at: null, demo_seed_key: null },
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT event_type, title, shipment_id, occurred_at
         FROM order_lifecycle_events WHERE order_id = 1`,
      )
      .all(),
    [
      {
        event_type: 'order_created',
        title: 'Order created',
        shipment_id: null,
        occurred_at: db.prepare('SELECT created_at FROM orders WHERE id = 1').pluck().get(),
      },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT status, response_json, cart_id, quote_json FROM payments WHERE idempotency_key = ?',
      )
      .get('legacy-payment'),
    { status: 'success', response_json: '{"success":true}', cart_id: null, quote_json: null },
  );
});

void test('lifecycle migration preserves pre-existing order lines and mix snapshots', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-lifecycle-upgrade-'));
  const db = new Database(join(directory, 'shop.db'));
  db.pragma('foreign_keys = ON');
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  migrateDatabase(
    db,
    migrations.filter((migration) => migration.version !== '014'),
  );
  db.prepare(
    `INSERT INTO orders
      (customer_name, customer_email, shipping_address, subtotal_cents, discount_cents, total_cents, created_at)
     VALUES ('Snapshot customer', 'snapshot@example.test', '2 Snapshot Lane', 2500, 250, 2250, '2026-07-18T12:00:00.000Z')`,
  ).run();
  const orderId = Number(
    db
      .prepare("SELECT id FROM orders WHERE customer_email = 'snapshot@example.test'")
      .pluck()
      .get(),
  );
  db.prepare(
    `INSERT INTO order_line_items
      (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
     VALUES (?, 77, 'Snapshot product', 2500, 1, 2500)`,
  ).run(orderId);
  const snapshotJson = '{"snapshotVersion":2,"mixId":"preserved-snapshot"}';
  db.prepare('INSERT INTO order_powder_mix_items (order_id, snapshot_json) VALUES (?, ?)').run(
    orderId,
    snapshotJson,
  );

  migrateDatabase(db);

  assert.deepEqual(
    db
      .prepare(
        `SELECT customer_name, customer_email, subtotal_cents, discount_cents, total_cents,
                lifecycle_status, version, cancelled_at
         FROM orders WHERE id = ?`,
      )
      .get(orderId),
    {
      customer_name: 'Snapshot customer',
      customer_email: 'snapshot@example.test',
      subtotal_cents: 2500,
      discount_cents: 250,
      total_cents: 2250,
      lifecycle_status: 'processing',
      version: 0,
      cancelled_at: null,
    },
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT product_id, product_name, product_price_cents, quantity, line_total_cents FROM order_line_items WHERE order_id = ?',
      )
      .get(orderId),
    {
      product_id: 77,
      product_name: 'Snapshot product',
      product_price_cents: 2500,
      quantity: 1,
      line_total_cents: 2500,
    },
  );
  assert.deepEqual(
    db.prepare('SELECT snapshot_json FROM order_powder_mix_items WHERE order_id = ?').get(orderId),
    { snapshot_json: snapshotJson },
  );
  assert.deepEqual(
    db
      .prepare('SELECT event_type, occurred_at FROM order_lifecycle_events WHERE order_id = ?')
      .get(orderId),
    { event_type: 'order_created', occurred_at: '2026-07-18T12:00:00.000Z' },
  );
});

void test('order lifecycle constraints reject invalid data and lifecycle-event updates', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-lifecycle-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  db.prepare(
    `INSERT INTO orders
      (customer_name, customer_email, shipping_address, subtotal_cents, total_cents, created_at)
     VALUES ('Lifecycle', 'lifecycle@example.test', '1 Test Road', 1000, 1000, '2026-07-19T12:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO order_line_items
      (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
     VALUES (1, 1, 'Product', 1000, 1, 1000)`,
  ).run();
  db.prepare(
    `INSERT INTO order_powder_mix_items (order_id, snapshot_json)
     VALUES (1, '{"snapshotVersion":2}')`,
  ).run();
  db.prepare(
    `INSERT INTO order_shipments
      (order_id, shipment_number, status, tracking_reference, created_at, updated_at)
     VALUES (1, 1, 'packed', 'SIM-001', '2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO order_lifecycle_events (order_id, event_type, title, occurred_at)
     VALUES (1, 'order_created', 'Order created', '2026-07-19T12:00:00.000Z')`,
  ).run();

  assert.throws(
    () => db.prepare("UPDATE orders SET lifecycle_status = 'invalid' WHERE id = 1").run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_shipment_items
            (shipment_id, order_line_item_id, order_powder_mix_item_id, quantity)
           VALUES (1, 1, 1, 1)`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_shipment_items (shipment_id, quantity)
           VALUES (1, 1)`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_shipment_items (shipment_id, order_line_item_id, quantity)
           VALUES (1, 1, 0)`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_shipments
            (order_id, shipment_number, status, created_at, updated_at)
           VALUES (1, 2, 'processing', '2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z')`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_lifecycle_events (order_id, event_type, title, occurred_at)
           VALUES (1, 'invalid_event', 'Invalid event', '2026-07-19T12:00:00.000Z')`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO order_lifecycle_events
            (order_id, event_type, tracking_code, title, occurred_at)
           VALUES (1, 'shipment_tracking_updated', 'unknown_code', 'Unknown code', '2026-07-19T12:00:00.000Z')`,
        )
        .run(),
    /CHECK constraint failed/,
  );
  db.prepare(
    `INSERT INTO order_shipment_items (shipment_id, order_line_item_id, quantity)
     VALUES (1, 1, 1)`,
  ).run();
  db.prepare(
    `INSERT INTO order_shipment_items (shipment_id, order_powder_mix_item_id, quantity)
     VALUES (1, 1, 1)`,
  ).run();
  assert.deepEqual(
    db
      .prepare(
        `SELECT order_line_item_id, order_powder_mix_item_id, quantity
         FROM order_shipment_items WHERE shipment_id = 1 ORDER BY order_line_item_id IS NULL, order_line_item_id`,
      )
      .all(),
    [
      { order_line_item_id: 1, order_powder_mix_item_id: null, quantity: 1 },
      { order_line_item_id: null, order_powder_mix_item_id: 1, quantity: 1 },
    ],
  );
  const createdEventId = Number(
    db
      .prepare(
        "SELECT id FROM order_lifecycle_events WHERE order_id = 1 AND event_type = 'order_created'",
      )
      .pluck()
      .get(),
  );
  assert.throws(
    () =>
      db
        .prepare('UPDATE order_lifecycle_events SET title = ? WHERE id = ?')
        .run('Changed', createdEventId),
    /order_lifecycle_events are immutable/,
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

void test('powderizer expansion upgrades 008 mixes with default scheme and rejects corrupt values', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-migrations-powderizer-expansion-'));
  const db = new Database(join(directory, 'shop.db'));
  db.pragma('foreign_keys = ON');
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  migrateDatabase(db, migrations.slice(0, 8));
  db.prepare("INSERT INTO carts (id) VALUES ('legacy-mix-cart')").run();
  db.prepare(
    `INSERT INTO powder_mixes
      (id, cart_id, quantity, bag_size_grams, fineness, custom_label, price_version,
       quoted_unit_price_cents, created_at, updated_at)
     VALUES ('legacy-mix', 'legacy-mix-cart', 1, 500, 'standard', NULL, 'powderizer-v1', 1000, 'now', 'now')`,
  ).run();

  migrateDatabase(db);
  assert.deepEqual(
    db.prepare('SELECT bag_colour_scheme FROM powder_mixes WHERE id = ?').get('legacy-mix'),
    { bag_colour_scheme: 'ultraviolet-cyan' },
  );
  assert.throws(
    () =>
      db
        .prepare(
          "UPDATE powder_mixes SET bag_colour_scheme = 'brown-paper' WHERE id = 'legacy-mix'",
        )
        .run(),
    /CHECK constraint failed/,
  );

  const mixes = createPowderMixRepository(db);
  mixes.create({
    id: 'new-mix',
    cartId: 'legacy-mix-cart',
    quantity: 1,
    bagSizeGrams: 500,
    fineness: 'standard',
    bagColourScheme: 'solar-flare',
    customLabel: null,
    priceVersion: 'powderizer-v1',
    quotedUnitPriceCents: 1000,
    allocations: [],
  });
  assert.equal(mixes.find('legacy-mix-cart', 'new-mix')?.bag_colour_scheme, 'solar-flare');
  assert.equal(
    mixes.replace('new-mix', {
      bagSizeGrams: 500,
      fineness: 'standard',
      bagColourScheme: 'deep-space',
      customLabel: null,
      priceVersion: 'powderizer-v1',
      quotedUnitPriceCents: 1000,
      allocations: [],
    }),
    true,
  );
  assert.equal(mixes.find('legacy-mix-cart', 'new-mix')?.bag_colour_scheme, 'deep-space');

  db.pragma('ignore_check_constraints = ON');
  db.prepare(
    "UPDATE powder_mixes SET bag_colour_scheme = 'brown-paper' WHERE id = 'legacy-mix'",
  ).run();
  db.pragma('ignore_check_constraints = OFF');
  assert.throws(
    () => mixes.find('legacy-mix-cart', 'legacy-mix'),
    /Invalid persisted powder mix bag colour scheme/,
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
    50,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM curated_bundles').get() as { count: number }).count,
    CURATED_BUNDLES.length,
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM curated_bundle_components').get() as {
        count: number;
      }
    ).count,
    CURATED_BUNDLES.reduce((count, bundle) => count + bundle.components.length, 0),
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM product_tags').get() as { count: number }).count > 0,
    true,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM product_specifications').get() as { count: number })
      .count > 0,
    true,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM carts').get() as { count: number }).count,
    0,
  );
  assert.deepEqual(migrationVersions(db), expectedVersions);
});
