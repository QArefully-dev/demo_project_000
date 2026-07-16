import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOG_PRODUCTS, catalogProductSpecifications } from '@shop/catalog';
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
    50,
  );
  assert.deepEqual(db.prepare('SELECT active, created_at FROM products WHERE id = ?').get(1), {
    active: CATALOG_PRODUCTS.find((product) => product.id === 1)?.active ? 1 : 0,
    created_at: CATALOG_PRODUCTS.find((product) => product.id === 1)?.created_at,
  });
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM product_tags').get() as { count: number }).count,
    CATALOG_PRODUCTS.reduce((count, product) => count + product.tags.length, 0),
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM product_specifications').get() as { count: number })
      .count,
    CATALOG_PRODUCTS.reduce(
      (count, product) => count + catalogProductSpecifications(product).length,
      0,
    ),
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
    50,
  );
  db.prepare("UPDATE users SET display_name = 'Local' WHERE email = 'alice@example.com'").run();
  db.prepare(
    "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (99, 'Local', 'Local row', 100, 'Local', 1, 'local', 'local', 0)",
  ).run();
  db.prepare("INSERT INTO catalog_tags (key, label) VALUES ('local-tag', 'Local tag')").run();
  db.prepare('INSERT INTO product_tags (product_id, tag_key) VALUES (99, ?)').run('local-tag');
  db.prepare(
    `INSERT INTO product_specifications
      (product_id, specification_key, value_key, display_value, numeric_value)
     VALUES (99, 'texture', 'local-texture', 'Local texture', NULL)`,
  ).run();
  db.prepare('DELETE FROM product_tags WHERE product_id = 1').run();
  db.prepare('DELETE FROM product_specifications WHERE product_id = 1').run();
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
  assert.deepEqual(db.prepare('SELECT tag_key FROM product_tags WHERE product_id = 99').all(), [
    { tag_key: 'local-tag' },
  ]);
  assert.deepEqual(
    db
      .prepare(
        'SELECT specification_key, value_key, display_value, numeric_value FROM product_specifications WHERE product_id = 99',
      )
      .all(),
    [
      {
        specification_key: 'texture',
        value_key: 'local-texture',
        display_value: 'Local texture',
        numeric_value: null,
      },
    ],
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM product_tags WHERE product_id = 1').get() as {
        count: number;
      }
    ).count,
    CATALOG_PRODUCTS.find((product) => product.id === 1)?.tags.length,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM product_specifications WHERE product_id = 1')
        .get() as { count: number }
    ).count,
    catalogProductSpecifications(CATALOG_PRODUCTS.find((product) => product.id === 1)!).length,
  );
  db.prepare(
    "UPDATE products SET name = 'Old Campfire', mixable = 0, mix_unit_grams = NULL WHERE id = 27",
  ).run();
  seedDatabase(db);
  assert.deepEqual(
    db.prepare('SELECT name, mixable, mix_unit_grams FROM products WHERE id = 27').get(),
    { name: 'Campfire', mixable: 1, mix_unit_grams: 200 },
  );

  db.prepare("INSERT INTO carts (id) VALUES ('seed-reset-cart')").run();
  db.prepare(
    `INSERT INTO powder_mixes
      (id, cart_id, quantity, bag_size_grams, fineness, bag_colour_scheme, custom_label, price_version, quoted_unit_price_cents, created_at, updated_at)
     VALUES ('seed-reset-mix', 'seed-reset-cart', 1, 500, 'standard', 'solar-flare', NULL, 'powderizer-v1', 1000, 'now', 'now')`,
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
    db.prepare('SELECT id, slug FROM products WHERE id BETWEEN 1 AND 50 ORDER BY id').all(),
    CATALOG_PRODUCTS.map(({ id, slug }) => ({ id, slug })).sort(
      (left, right) => left.id - right.id,
    ),
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM products WHERE mixable = 1').get() as {
        count: number;
      }
    ).count,
    50,
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
