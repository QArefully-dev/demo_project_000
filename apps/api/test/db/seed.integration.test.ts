import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOG_PRODUCTS } from '@shop/catalog';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

void test('seed preserves local state; reset restores canonical data', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  seedDatabase(db);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
    45,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count,
    3,
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM products WHERE mixable = 1').get() as {
        count: number;
      }
    ).count,
    19,
  );
  db.prepare("UPDATE users SET display_name = 'Local' WHERE email = 'alice@example.com'").run();
  db.prepare(
    "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (99, 'Local', 'Local row', 100, 'Local', 1, 'local', 'local', 0)",
  ).run();
  seedDatabase(db);
  assert.equal(
    (
      db.prepare("SELECT display_name FROM users WHERE email = 'alice@example.com'").get() as {
        display_name: string;
      }
    ).display_name,
    'Local',
  );
  assert.equal(
    (db.prepare('SELECT name FROM products WHERE id = 99').get() as { name: string }).name,
    'Local',
  );

  db.prepare("INSERT INTO carts (id) VALUES ('seed-reset-cart')").run();
  db.prepare(
    `INSERT INTO powder_mixes
      (id, cart_id, quantity, bag_size_grams, fineness, custom_label, price_version, quoted_unit_price_cents, created_at, updated_at)
     VALUES ('seed-reset-mix', 'seed-reset-cart', 1, 500, 'standard', NULL, 'powderizer-v1', 1000, 'now', 'now')`,
  ).run();
  db.prepare(
    `INSERT INTO powder_mix_components (mix_id, product_id, percentage, allocated_grams)
     VALUES ('seed-reset-mix', 1, 100, 500)`,
  ).run();
  db.prepare(
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES ('seed-reset-payment', 'seed-reset-fingerprint', 'pending', 1000, '4242', 'Visa')`,
  ).run();
  db.prepare(
    `INSERT INTO powder_mix_stock_reservations
      (payment_idempotency_key, product_id, bag_equivalents)
     VALUES ('seed-reset-payment', 1, 1)`,
  ).run();
  db.prepare(
    `INSERT INTO orders
      (customer_name, customer_email, shipping_address, subtotal_cents, total_cents)
     VALUES ('Seed reset', 'seed-reset@example.test', '1 Reset Road', 1000, 1000)`,
  ).run();
  db.prepare(
    `INSERT INTO order_powder_mix_items (order_id, snapshot_json)
     VALUES (last_insert_rowid(), '{"version":1}')`,
  ).run();

  resetDatabase(db);
  seedDatabase(db);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = 99').get(), undefined);
  assert.deepEqual(
    db.prepare('SELECT id, slug FROM products WHERE id BETWEEN 1 AND 45 ORDER BY id').all(),
    CATALOG_PRODUCTS.map(({ id, slug }) => ({ id, slug })),
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM products WHERE mixable = 1').get() as {
        count: number;
      }
    ).count,
    19,
  );
  for (const table of [
    'powder_mixes',
    'powder_mix_components',
    'powder_mix_stock_reservations',
    'order_powder_mix_items',
  ]) {
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
      0,
    );
  }
});
