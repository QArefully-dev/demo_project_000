import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOG_PRODUCTS, CURATED_BUNDLES, catalogProductSpecifications } from '@shop/catalog';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';
import { DEMO_ORDER_SCENARIO_KEYS } from '../../src/db/orderSeedScenarios.js';

void test('seed installs deterministic lifecycle scenarios once and reset restores them', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-order-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  const scenarioRows = db
    .prepare(
      `SELECT orders.demo_seed_key, users.email, orders.lifecycle_status, orders.created_at
       FROM orders JOIN users ON users.id = orders.user_id
       WHERE orders.demo_seed_key IS NOT NULL
       ORDER BY orders.created_at DESC, orders.id DESC`,
    )
    .all();
  assert.deepEqual(scenarioRows, [
    {
      demo_seed_key: 'alice-processing',
      email: 'alice@example.com',
      lifecycle_status: 'processing',
      created_at: '2026-07-15T09:00:00.000Z',
    },
    {
      demo_seed_key: 'alice-packed',
      email: 'alice@example.com',
      lifecycle_status: 'packed',
      created_at: '2026-07-14T15:00:00.000Z',
    },
    {
      demo_seed_key: 'alice-split-shipped',
      email: 'alice@example.com',
      lifecycle_status: 'shipped',
      created_at: '2026-07-14T09:00:00.000Z',
    },
    {
      demo_seed_key: 'alice-delivery-failed',
      email: 'alice@example.com',
      lifecycle_status: 'delivery_failed',
      created_at: '2026-07-13T09:00:00.000Z',
    },
    {
      demo_seed_key: 'bob-delivered',
      email: 'bob@example.com',
      lifecycle_status: 'delivered',
      created_at: '2026-07-12T09:00:00.000Z',
    },
  ]);
  assert.deepEqual(
    db
      .prepare(
        'SELECT demo_seed_key FROM orders WHERE demo_seed_key IS NOT NULL ORDER BY demo_seed_key',
      )
      .pluck()
      .all(),
    [...DEMO_ORDER_SCENARIO_KEYS].sort(),
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT shipment_number, status, tracking_reference
         FROM order_shipments
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')
         ORDER BY shipment_number`,
      )
      .all(),
    [
      { shipment_number: 1, status: 'delivered', tracking_reference: 'QA-ALICE-SPLIT-01' },
      { shipment_number: 2, status: 'shipped', tracking_reference: 'QA-ALICE-SPLIT-02' },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT shipment_number, product_quantity, mix_quantity
         FROM (
           SELECT shipments.shipment_number,
             SUM(CASE WHEN shipment_items.order_line_item_id IS NOT NULL THEN shipment_items.quantity ELSE 0 END) AS product_quantity,
             SUM(CASE WHEN shipment_items.order_powder_mix_item_id IS NOT NULL THEN shipment_items.quantity ELSE 0 END) AS mix_quantity
           FROM order_shipments AS shipments
           JOIN order_shipment_items AS shipment_items ON shipment_items.shipment_id = shipments.id
           WHERE shipments.order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')
           GROUP BY shipments.id
         ) ORDER BY shipment_number`,
      )
      .all(),
    [
      { shipment_number: 1, product_quantity: 1, mix_quantity: 0 },
      { shipment_number: 2, product_quantity: 1, mix_quantity: 1 },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT event_type, occurred_at
         FROM order_lifecycle_events
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-delivery-failed')
         ORDER BY occurred_at, id`,
      )
      .all(),
    [
      { event_type: 'order_created', occurred_at: '2026-07-13T09:00:00.000Z' },
      { event_type: 'shipment_packed', occurred_at: '2026-07-13T10:00:00.000Z' },
      { event_type: 'shipment_shipped', occurred_at: '2026-07-14T08:00:00.000Z' },
      { event_type: 'shipment_delivery_failed', occurred_at: '2026-07-14T15:00:00.000Z' },
    ],
  );
  assert.equal(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM payments
           WHERE status = 'succeeded'
             AND order_id IN (SELECT id FROM orders WHERE demo_seed_key IS NOT NULL)`,
        )
        .get() as { count: number }
    ).count,
    DEMO_ORDER_SCENARIO_KEYS.length,
  );

  const seededProductSnapshot = db
    .prepare(
      `SELECT product_name, product_price_cents, quantity, line_total_cents
       FROM order_line_items
       WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-packed')`,
    )
    .get();
  const seededMixSnapshot = db
    .prepare(
      `SELECT snapshot_json FROM order_powder_mix_items
       WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')`,
    )
    .get();
  db.prepare("UPDATE products SET name = 'Changed Campfire', price_cents = 1 WHERE id = 27").run();
  seedDatabase(db);
  assert.deepEqual(db.prepare('SELECT name, price_cents FROM products WHERE id = 27').get(), {
    name: 'Campfire',
    price_cents: 1695,
  });
  assert.deepEqual(
    db
      .prepare(
        `SELECT product_name, product_price_cents, quantity, line_total_cents
         FROM order_line_items
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-packed')`,
      )
      .get(),
    seededProductSnapshot,
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT snapshot_json FROM order_powder_mix_items
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')`,
      )
      .get(),
    seededMixSnapshot,
  );

  db.prepare(
    `UPDATE orders SET lifecycle_status = 'cancelled', version = 99
     WHERE demo_seed_key = 'alice-processing'`,
  ).run();
  seedDatabase(db);
  assert.deepEqual(
    db
      .prepare(
        `SELECT lifecycle_status, version FROM orders WHERE demo_seed_key = 'alice-processing'`,
      )
      .get(),
    { lifecycle_status: 'cancelled', version: 99 },
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM orders WHERE demo_seed_key IS NOT NULL').get() as {
        count: number;
      }
    ).count,
    DEMO_ORDER_SCENARIO_KEYS.length,
  );
  assert.equal(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM order_lifecycle_events
           WHERE order_id IN (SELECT id FROM orders WHERE demo_seed_key IS NOT NULL)`,
        )
        .get() as { count: number }
    ).count,
    19,
  );

  resetDatabase(db);
  seedDatabase(db);
  assert.deepEqual(
    db
      .prepare(
        `SELECT lifecycle_status, version FROM orders WHERE demo_seed_key = 'alice-processing'`,
      )
      .get(),
    { lifecycle_status: 'processing', version: 0 },
  );
});

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
  assert.deepEqual(
    db
      .prepare(
        'SELECT id, key, name, description, active, sort_order FROM curated_bundles ORDER BY sort_order',
      )
      .all(),
    CURATED_BUNDLES.map((bundle) => ({
      id: bundle.id,
      key: bundle.key,
      name: bundle.name,
      description: bundle.description,
      active: 1,
      sort_order: bundle.sortOrder,
    })),
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT bundle_id, product_id, quantity, sort_order
         FROM curated_bundle_components ORDER BY bundle_id, sort_order`,
      )
      .all(),
    CURATED_BUNDLES.flatMap((bundle) =>
      bundle.components.map((component) => ({
        bundle_id: bundle.id,
        product_id: component.productId,
        quantity: component.quantity,
        sort_order: component.sortOrder,
      })),
    ),
  );
  assert.equal(
    (db.prepare('PRAGMA table_info(curated_bundle_components)').all() as { name: string }[]).some(
      (column) => column.name === 'price_cents',
    ),
    false,
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

  db.prepare(
    `INSERT INTO audit_events
      (actor_type, actor_user_id, action, entity_type, entity_id, request_id, occurred_at)
     VALUES ('anonymous', NULL, 'cart.created', 'cart', 'seed-reset-cart', 'seed-reset-request', '2026-01-01T00:00:00.000Z')`,
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
  assert.equal(
    (db.prepare('SELECT stock_count FROM products WHERE id = 99').get() as { stock_count: number })
      .stock_count,
    1,
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
  db.prepare(
    `INSERT INTO curated_bundles (id, key, name, description, active, sort_order)
     VALUES (99, 'local-bundle', 'Local bundle', 'Local bundle definition', 1, 99)`,
  ).run();
  db.prepare(
    `INSERT INTO curated_bundle_components (bundle_id, product_id, quantity, sort_order)
     VALUES (99, 1, 2, 1)`,
  ).run();
  db.prepare("UPDATE curated_bundles SET name = 'Broken starter' WHERE id = 1").run();
  db.prepare('DELETE FROM curated_bundle_components WHERE bundle_id = 1').run();
  seedDatabase(db);
  assert.deepEqual(
    db.prepare('SELECT name, mixable, mix_unit_grams FROM products WHERE id = 27').get(),
    { name: 'Campfire', mixable: 1, mix_unit_grams: 200 },
  );
  assert.deepEqual(db.prepare('SELECT key, name FROM curated_bundles WHERE id = 1').get(), {
    key: 'powder-starter-set',
    name: 'Starter Set',
  });
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM curated_bundle_components WHERE bundle_id = 1')
        .get() as { count: number }
    ).count,
    3,
  );
  assert.deepEqual(db.prepare('SELECT key, name FROM curated_bundles WHERE id = 99').get(), {
    key: 'local-bundle',
    name: 'Local bundle',
  });
  assert.deepEqual(
    db
      .prepare(
        'SELECT product_id, quantity, sort_order FROM curated_bundle_components WHERE bundle_id = 99',
      )
      .all(),
    [{ product_id: 1, quantity: 2, sort_order: 1 }],
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
    `INSERT INTO inventory_reservations
      (payment_idempotency_key, product_id, demand_kind, reserved_quantity, backordered_quantity, expires_at, created_at)
     VALUES ('seed-reset-payment', 1, 'powder_mix', 1, 0, NULL, '2026-07-19T12:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO orders
      (customer_name, customer_email, shipping_address, subtotal_cents, total_cents)
     VALUES ('Seed reset', 'seed-reset@example.test', '1 Reset Road', 1000, 1000)`,
  ).run();
  const resetOrderId = Number(
    db
      .prepare("SELECT id FROM orders WHERE customer_email = 'seed-reset@example.test'")
      .pluck()
      .get(),
  );
  db.prepare(
    `INSERT INTO order_powder_mix_items (order_id, snapshot_json)
     VALUES (?, '{"version":1}')`,
  ).run(resetOrderId);
  db.prepare(
    `INSERT INTO order_shipments
      (order_id, shipment_number, status, tracking_reference, created_at, updated_at)
     VALUES (?, 1, 'packed', 'RESET-001', '2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z')`,
  ).run(resetOrderId);
  const resetShipmentId = Number(
    db
      .prepare("SELECT id FROM order_shipments WHERE tracking_reference = 'RESET-001'")
      .pluck()
      .get(),
  );
  db.prepare(
    `INSERT INTO order_lifecycle_events (order_id, shipment_id, event_type, title, occurred_at)
     VALUES (?, ?, 'shipment_packed', 'Shipment packed', '2026-07-19T12:00:00.000Z')`,
  ).run(resetOrderId, resetShipmentId);
  db.prepare(
    `INSERT INTO order_access_grants (order_id, token_digest, expires_at, created_at)
     VALUES (?, 'seed-reset-grant-digest', '2026-07-20T12:00:00.000Z', '2026-07-19T12:00:00.000Z')`,
  ).run(resetOrderId);
  db.prepare(
    `INSERT INTO reviews (product_id, user_id, rating, body)
     VALUES (1, 1, 5, '12345678901234567890')`,
  ).run();

  resetDatabase(db);
  seedDatabase(db);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = 99').get(), undefined);
  assert.equal(db.prepare('SELECT id FROM curated_bundles WHERE id = 99').get(), undefined);
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
  for (const [table, expectedCount] of [
    ['powder_mixes', 0],
    ['powder_mix_components', 0],
    ['inventory_reservations', 0],
    ['order_access_grants', 0],
    ['order_lifecycle_events', 19],
    ['order_shipment_items', 6],
    ['order_shipments', 5],
    ['order_powder_mix_items', 1],
  ] as const) {
    assert.equal(
      (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
      expectedCount,
    );
  }
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count,
    1,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM reviews').get() as { count: number }).count,
    0,
  );
});
