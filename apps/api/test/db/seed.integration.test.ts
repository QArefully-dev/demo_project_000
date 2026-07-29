import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOG_PRODUCTS, CURATED_BUNDLES } from '@shop/catalog';
import { catalogProductSpecifications } from '../../src/features/catalog/catalogSpecifications.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';
import { DEMO_ORDER_SCENARIO_KEYS } from '../../src/db/orderSeedScenarios.js';

const CANONICAL_IDS = new Set(
  Array.from({ length: 50 }, (_, i) => i + 1).concat(
    Array.from({ length: 50 }, (_, i) => 1001 + i),
  ),
);

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
        `SELECT shipment_number, product_quantity, line_count
         FROM (
           SELECT shipments.shipment_number,
             SUM(shipment_items.quantity) AS product_quantity,
             COUNT(*) AS line_count
           FROM order_shipments AS shipments
           JOIN order_shipment_items AS shipment_items ON shipment_items.shipment_id = shipments.id
           WHERE shipments.order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')
           GROUP BY shipments.id
         ) ORDER BY shipment_number`,
      )
      .all(),
    [
      { shipment_number: 1, product_quantity: 1, line_count: 1 },
      { shipment_number: 2, product_quantity: 2, line_count: 2 },
    ],
  );
  // Three sacks across two lots; the split-shipment scenario keeps its item count after the
  // retired powder-mix line was replaced by a second product line.
  assert.deepEqual(
    db
      .prepare(
        `SELECT SUM(quantity) AS total_items, COUNT(*) AS line_count
         FROM order_line_items
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')`,
      )
      .get(),
    { total_items: 3, line_count: 2 },
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

  // Idempotent re-seed preserves seeded order snapshots
  const seededProductSnapshot = db
    .prepare(
      `SELECT product_name, product_price_cents, quantity, line_total_cents
       FROM order_line_items
       WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-packed')`,
    )
    .get();
  const seededSplitSnapshot = db
    .prepare(
      `SELECT product_id, product_name, product_price_cents, quantity, line_total_cents
       FROM order_line_items
       WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')
       ORDER BY id`,
    )
    .all();
  // Pick a canonical product that exists in the new catalog (ID 1 = All-Purpose Flour)
  db.prepare("UPDATE products SET name = 'Changed Flour', price_cents = 1 WHERE id = 1").run();
  seedDatabase(db);
  const product1 = CATALOG_PRODUCTS.find((p) => p.id === 1);
  assert.ok(product1);
  const defaultVariant1 =
    product1.variants.find((v) => v.sortOrder === 1 && v.active) ?? product1.variants[0];
  assert.deepEqual(db.prepare('SELECT name, price_cents FROM products WHERE id = 1').get(), {
    name: product1.name,
    price_cents: defaultVariant1.priceCents,
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
        `SELECT product_id, product_name, product_price_cents, quantity, line_total_cents
         FROM order_line_items
         WHERE order_id = (SELECT id FROM orders WHERE demo_seed_key = 'alice-split-shipped')
         ORDER BY id`,
      )
      .all(),
    seededSplitSnapshot,
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

void test('seed installs idempotent review moderation scenarios and preserves local reviews', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-review-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  assert.deepEqual(
    db
      .prepare(
        `SELECT users.email, reviews.product_id, reviews.rating, reviews.status
         FROM reviews INNER JOIN users ON users.id = reviews.user_id
         ORDER BY reviews.created_at, reviews.id`,
      )
      .all(),
    [
      { email: 'alice@example.com', product_id: 1, rating: 5, status: 'published' },
      { email: 'bob@example.com', product_id: 27, rating: 2, status: 'published' },
      { email: 'alice@example.com', product_id: 2, rating: 3, status: 'hidden' },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT reviewers.email AS reviewer, voters.email AS voter
         FROM review_helpful_votes
         INNER JOIN reviews ON reviews.id = review_helpful_votes.review_id
         INNER JOIN users AS reviewers ON reviewers.id = reviews.user_id
         INNER JOIN users AS voters ON voters.id = review_helpful_votes.user_id
         ORDER BY reviewers.email`,
      )
      .all(),
    [
      { reviewer: 'alice@example.com', voter: 'bob@example.com' },
      { reviewer: 'bob@example.com', voter: 'alice@example.com' },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT reviewers.email AS reviewer, reporters.email AS reporter, review_reports.reason,
                review_reports.detail, review_reports.status
         FROM review_reports
         INNER JOIN reviews ON reviews.id = review_reports.review_id
         INNER JOIN users AS reviewers ON reviewers.id = reviews.user_id
         INNER JOIN users AS reporters ON reporters.id = review_reports.user_id`,
      )
      .all(),
    [
      {
        reviewer: 'bob@example.com',
        reporter: 'alice@example.com',
        reason: 'unsafe',
        detail: 'Seeded moderation example for the reported queue.',
        status: 'open',
      },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT product_id, published_count, rating_sum, stars_1, stars_2, stars_3, stars_4, stars_5
         FROM review_rating_aggregates ORDER BY product_id`,
      )
      .all(),
    [
      {
        product_id: 1,
        published_count: 1,
        rating_sum: 5,
        stars_1: 0,
        stars_2: 0,
        stars_3: 0,
        stars_4: 0,
        stars_5: 1,
      },
      {
        product_id: 27,
        published_count: 1,
        rating_sum: 2,
        stars_1: 0,
        stars_2: 1,
        stars_3: 0,
        stars_4: 0,
        stars_5: 0,
      },
    ],
  );

  db.prepare(
    `INSERT INTO reviews (product_id, user_id, rating, body, created_at, updated_at)
     VALUES (3, 1, 4, 'Local review content remains untouched by canonical scenario seeding.', ?, ?)`,
  ).run('2026-07-17T00:00:00.000Z', '2026-07-17T00:00:00.000Z');
  seedDatabase(db);
  assert.deepEqual(
    db.prepare('SELECT rating, body FROM reviews WHERE product_id = 3 AND user_id = 1').get(),
    {
      rating: 4,
      body: 'Local review content remains untouched by canonical scenario seeding.',
    },
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM review_helpful_votes').get() as { count: number })
      .count,
    2,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM review_reports').get() as { count: number }).count,
    1,
  );

  resetDatabase(db);
  seedDatabase(db);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM reviews').get() as { count: number }).count,
    3,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM review_helpful_votes').get() as { count: number })
      .count,
    2,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM review_reports').get() as { count: number }).count,
    1,
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
    CATALOG_PRODUCTS.length,
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
  // Bundle components now reference variant_id + product_id via SKU lookup
  const bundleComponentRows = db
    .prepare(
      `SELECT cbc.bundle_id, cbc.product_id, cbc.quantity, cbc.sort_order
       FROM curated_bundle_components cbc ORDER BY cbc.bundle_id, cbc.sort_order`,
    )
    .all() as Array<{
    bundle_id: number;
    product_id: number;
    quantity: number;
    sort_order: number;
  }>;
  assert.ok(bundleComponentRows.length > 0);
  for (const row of bundleComponentRows) {
    assert.ok(
      CANONICAL_IDS.has(row.product_id),
      `Bundle component product ${row.product_id} not in canonical set`,
    );
  }

  assert.equal(
    (db.prepare('PRAGMA table_info(curated_bundle_components)').all() as { name: string }[]).some(
      (column) => column.name === 'price_cents',
    ),
    false,
  );
  const product1Catalog = CATALOG_PRODUCTS.find((p) => p.id === 1);
  assert.ok(product1Catalog);
  const variant1 =
    product1Catalog.variants.find((v) => v.sortOrder === 1 && v.active) ??
    product1Catalog.variants[0];
  assert.deepEqual(
    db.prepare('SELECT active, created_at, price_cents FROM products WHERE id = ?').get(1),
    {
      active: product1Catalog.visibility === 'public' ? 1 : 0,
      created_at: product1Catalog.createdAt,
      price_cents: variant1.priceCents,
    },
  );
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
    CATALOG_PRODUCTS.find((p) => p.id === 1)?.tags.length,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM product_specifications WHERE product_id = 1')
        .get() as { count: number }
    ).count,
    catalogProductSpecifications(CATALOG_PRODUCTS.find((p) => p.id === 1)!).length,
  );

  // Verify idempotent re-seed restores canonical product facts
  db.prepare("UPDATE products SET name = 'Changed Flour', sales_count = 99 WHERE id = 1").run();
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
  assert.deepEqual(db.prepare('SELECT name, sales_count FROM products WHERE id = 1').get(), {
    name: product1Catalog.name,
    sales_count: 0,
  });
  assert.deepEqual(db.prepare('SELECT key, name FROM curated_bundles WHERE id = 1').get(), {
    key: CURATED_BUNDLES.find((b) => b.id === 1)!.key,
    name: CURATED_BUNDLES.find((b) => b.id === 1)!.name,
  });
  assert.ok(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM curated_bundle_components WHERE bundle_id = 1')
        .get() as { count: number }
    ).count > 0,
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
    `INSERT INTO payments
      (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES ('seed-reset-payment', 'seed-reset-fingerprint', 'pending', 1000, '4242', 'Visa')`,
  ).run();
  db.prepare(
    `INSERT INTO inventory_reservations
      (payment_idempotency_key, variant_id, reserved_quantity, backordered_quantity, expires_at, created_at)
     VALUES ('seed-reset-payment', (SELECT default_variant_id FROM products WHERE id = 1), 1, 0, NULL, '2026-07-19T12:00:00.000Z')`,
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
     VALUES (99, 1, 5, '12345678901234567890')`,
  ).run();

  resetDatabase(db);
  seedDatabase(db);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = 99').get(), undefined);
  assert.equal(db.prepare('SELECT id FROM curated_bundles WHERE id = 99').get(), undefined);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM curated_bundles').get() as { count: number }).count,
    CURATED_BUNDLES.length,
  );
  const canonicalProductIds = db
    .prepare(
      `SELECT id, slug FROM products WHERE id IN (${[...CANONICAL_IDS].join(',')}) ORDER BY id`,
    )
    .all() as Array<{ id: number; slug: string }>;
  assert.ok(canonicalProductIds.length >= CATALOG_PRODUCTS.length);
  for (const [table, expectedCount] of [
    ['inventory_reservations', 0],
    ['order_access_grants', 0],
    ['order_lifecycle_events', 19],
    ['order_shipment_items', 6],
    ['order_shipments', 5],
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
    3,
  );
});

void test('seed installs deterministic trade delivery sites and billing entities', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-trade-account-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);

  // Scoped to the seeded user emails: never assume these tables are otherwise empty.
  const seededSites = () =>
    db
      .prepare(
        `SELECT users.email, sites.label, sites.is_default, sites.active,
                sites.address_city, sites.address_country_code
         FROM delivery_sites AS sites
         JOIN users ON users.id = sites.user_id
         WHERE users.email IN ('alice@example.com', 'bob@example.com', 'admin@example.com')
         ORDER BY sites.id`,
      )
      .all();
  const seededEntities = () =>
    db
      .prepare(
        `SELECT users.email, entities.legal_name, entities.is_default, entities.active,
                entities.vat_number
         FROM billing_entities AS entities
         JOIN users ON users.id = entities.user_id
         WHERE users.email IN ('alice@example.com', 'bob@example.com', 'admin@example.com')
         ORDER BY entities.id`,
      )
      .all();

  const firstSites = seededSites();
  const firstEntities = seededEntities();
  assert.deepEqual(firstSites, [
    {
      email: 'alice@example.com',
      label: 'Bakery yard',
      is_default: 1,
      active: 1,
      address_city: 'Manchester',
      address_country_code: 'GB',
    },
    {
      email: 'alice@example.com',
      label: 'Depot annexe',
      is_default: 0,
      active: 1,
      address_city: 'Salford',
      address_country_code: 'GB',
    },
    {
      email: 'bob@example.com',
      label: 'Store loading bay',
      is_default: 1,
      active: 1,
      address_city: 'Bristol',
      address_country_code: 'GB',
    },
    {
      email: 'bob@example.com',
      label: 'Warehouse north',
      is_default: 0,
      active: 1,
      address_city: 'Gloucester',
      address_country_code: 'GB',
    },
    {
      email: 'admin@example.com',
      label: 'Head office dock',
      is_default: 1,
      active: 1,
      address_city: 'London',
      address_country_code: 'GB',
    },
  ]);
  assert.deepEqual(firstEntities, [
    {
      email: 'alice@example.com',
      legal_name: 'Fournier Bakeries Ltd',
      is_default: 1,
      active: 1,
      vat_number: 'GB194672301',
    },
    {
      email: 'alice@example.com',
      legal_name: 'Fournier Contract Catering Ltd',
      is_default: 0,
      active: 1,
      vat_number: null,
    },
    {
      email: 'bob@example.com',
      legal_name: 'Ashby Convenience Stores Ltd',
      is_default: 1,
      active: 1,
      vat_number: 'GB288104553',
    },
    {
      email: 'admin@example.com',
      legal_name: 'QArefully Materials Exchange Ltd',
      is_default: 1,
      active: 1,
      vat_number: 'GB402118997',
    },
  ]);

  // Exactly one live default of each record type per seeded user.
  const defaultCounts = (table: string) =>
    db
      .prepare(
        `SELECT users.email, COUNT(*) AS count
         FROM ${table} AS records
         JOIN users ON users.id = records.user_id
         WHERE records.is_default = 1 AND records.active = 1
           AND users.email IN ('alice@example.com', 'bob@example.com', 'admin@example.com')
         GROUP BY users.email ORDER BY users.email`,
      )
      .all();
  const expectedDefaults = [
    { email: 'admin@example.com', count: 1 },
    { email: 'alice@example.com', count: 1 },
    { email: 'bob@example.com', count: 1 },
  ];
  assert.deepEqual(defaultCounts('delivery_sites'), expectedDefaults);
  assert.deepEqual(defaultCounts('billing_entities'), expectedDefaults);

  // Repeat seed adds no duplicates and leaves buyer-owned edits alone.
  const bobId = Number(
    db.prepare("SELECT id FROM users WHERE email = 'bob@example.com'").pluck().get(),
  );
  db.prepare(
    `INSERT INTO delivery_sites
      (user_id, label, contact_name, contact_phone, address_line1, address_city,
       address_postcode, address_country_code, is_default, active)
     VALUES (?, 'Buyer added yard', 'Bob Ashby', NULL, '9 Local Way', 'Bristol', 'BS2 9AA', 'GB', 0, 1)`,
  ).run(bobId);
  db.prepare(
    `INSERT INTO billing_entities
      (user_id, legal_name, registration_number, vat_number, address_line1, address_city,
       address_postcode, address_country_code, is_default, active)
     VALUES (?, 'Buyer Added Trading Ltd', NULL, NULL, '9 Local Way', 'Bristol', 'BS2 9AA', 'GB', 0, 1)`,
  ).run(bobId);
  db.prepare("UPDATE delivery_sites SET label = 'Renamed yard' WHERE id = 1").run();

  seedDatabase(db);

  assert.equal(
    (db.prepare('SELECT label FROM delivery_sites WHERE id = 1').get() as { label: string }).label,
    'Renamed yard',
  );
  assert.equal(seededSites().length, firstSites.length + 1);
  assert.equal(seededEntities().length, firstEntities.length + 1);
  assert.deepEqual(defaultCounts('delivery_sites'), expectedDefaults);
  assert.deepEqual(defaultCounts('billing_entities'), expectedDefaults);

  // Reset restores the canonical rows exactly, buyer-added rows gone.
  resetDatabase(db);
  seedDatabase(db);
  assert.deepEqual(seededSites(), firstSites);
  assert.deepEqual(seededEntities(), firstEntities);
});

void test('seed installs variant rows and links default variant IDs', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-variant-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  const totalVariants = CATALOG_PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM product_variants').get() as { count: number }).count,
    totalVariants,
  );

  const canonicalIds = CATALOG_PRODUCTS.map((p) => p.id);
  const idPlaceholders = canonicalIds.map(() => '?').join(',');
  const nullDefaultCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM products WHERE id IN (${idPlaceholders}) AND default_variant_id IS NULL`,
      )
      .get(...canonicalIds) as { count: number }
  ).count;
  assert.equal(nullDefaultCount, 0, `${nullDefaultCount} products missing default_variant_id`);

  const defaultVariantRows = db
    .prepare(
      `SELECT p.id AS product_id, p.default_variant_id, v.sort_order, v.active
       FROM products p
       JOIN product_variants v ON v.id = p.default_variant_id
       WHERE p.id IN (${idPlaceholders})`,
    )
    .all(...canonicalIds) as Array<{
    product_id: number;
    default_variant_id: number;
    sort_order: number;
    active: number;
  }>;
  assert.equal(
    defaultVariantRows.length,
    canonicalIds.length,
    `Expected ${canonicalIds.length} default variant rows, got ${defaultVariantRows.length}`,
  );
  for (const row of defaultVariantRows) {
    assert.equal(
      row.sort_order,
      1,
      `Product ${row.product_id} default variant has sort_order ${row.sort_order}`,
    );
    assert.equal(row.active, 1, `Product ${row.product_id} default variant is inactive`);
  }
});

void test('seed is idempotent for canonical catalog and variants', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-idempotent-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  const firstProducts = db
    .prepare('SELECT id, name, price_cents, details_json FROM products ORDER BY id')
    .all();
  const firstVariants = db
    .prepare(
      'SELECT id, product_id, sku, price_cents, stock_count FROM product_variants ORDER BY id',
    )
    .all();
  const firstTags = db.prepare('SELECT COUNT(*) AS count FROM product_tags').get() as {
    count: number;
  };
  const firstSpecs = db.prepare('SELECT COUNT(*) AS count FROM product_specifications').get() as {
    count: number;
  };

  seedDatabase(db);
  const secondProducts = db
    .prepare('SELECT id, name, price_cents, details_json FROM products ORDER BY id')
    .all();
  const secondVariants = db
    .prepare(
      'SELECT id, product_id, sku, price_cents, stock_count FROM product_variants ORDER BY id',
    )
    .all();
  const secondTags = db.prepare('SELECT COUNT(*) AS count FROM product_tags').get() as {
    count: number;
  };
  const secondSpecs = db.prepare('SELECT COUNT(*) AS count FROM product_specifications').get() as {
    count: number;
  };

  assert.deepEqual(secondProducts, firstProducts);
  assert.deepEqual(secondVariants, firstVariants);
  assert.equal(secondTags.count, firstTags.count);
  assert.equal(secondSpecs.count, firstSpecs.count);
});

void test('repeat seed keeps canonical defaults product-owned and preserves noncanonical products', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-repeat-seed-defaults-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  db.prepare(
    "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (51, 'Local 51', 'User-created product', 500, 'Local', 10, 'local-51', 'local-51', 0)",
  ).run();
  seedDatabase(db);

  const canonicalIds = CATALOG_PRODUCTS.map((product) => product.id);
  const placeholders = canonicalIds.map(() => '?').join(',');
  const foreignDefaults = (
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM products p
         LEFT JOIN product_variants v ON v.id = p.default_variant_id
         WHERE p.id IN (${placeholders})
           AND (v.product_id IS NULL OR v.product_id <> p.id)`,
      )
      .get(...canonicalIds) as { count: number }
  ).count;
  assert.equal(foreignDefaults, 0);
  assert.deepEqual(db.prepare('SELECT id, name FROM products WHERE id = 51').get(), {
    id: 51,
    name: 'Local 51',
  });
});

void test('seed preserves local product ID 51 outside canonical sets', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-local-id-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  db.prepare(
    "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (51, 'Local 51', 'User-created product', 500, 'Local', 10, 'local-51', 'local-51', 0)",
  ).run();
  seedDatabase(db);
  const local = db.prepare('SELECT id, name, price_cents FROM products WHERE id = 51').get() as {
    id: number;
    name: string;
    price_cents: number;
  };
  assert.deepEqual(local, { id: 51, name: 'Local 51', price_cents: 500 });
});

void test('seed installs deterministic clearance windows and category-scoped promos', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-pricing-promotions-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  const clearances = () =>
    db
      .prepare(
        `SELECT sku, price_cents, clearance_price_cents, clearance_starts_at, clearance_ends_at
         FROM product_variants
         WHERE sku IN ('GDN-1043-001', 'HCL-1038-001', 'TCM-1049-001')
         ORDER BY sku`,
      )
      .all();
  const scopedPromos = () =>
    db
      .prepare(
        `SELECT code, kind, discount_percent, amount_cents, category_scope
         FROM promo_codes WHERE code IN ('GARDEN10', 'CLEANFIVE') ORDER BY code`,
      )
      .all();

  const firstClearances = clearances();
  assert.deepEqual(firstClearances, [
    {
      sku: 'GDN-1043-001',
      price_cents: 27540,
      clearance_price_cents: 24000,
      clearance_starts_at: '2026-07-21T12:00:00.000Z',
      clearance_ends_at: '2026-08-04T12:00:00.000Z',
    },
    {
      sku: 'HCL-1038-001',
      price_cents: 8940,
      clearance_price_cents: 7200,
      clearance_starts_at: '2026-07-07T12:00:00.000Z',
      clearance_ends_at: '2026-07-27T12:00:00.000Z',
    },
    {
      sku: 'TCM-1049-001',
      price_cents: 14340,
      clearance_price_cents: 12000,
      clearance_starts_at: '2026-07-29T12:00:00.000Z',
      clearance_ends_at: '2026-08-11T12:00:00.000Z',
    },
  ]);
  assert.ok(
    firstClearances.every(
      (row) =>
        (row as { clearance_price_cents: number; price_cents: number }).clearance_price_cents <
        (row as { clearance_price_cents: number; price_cents: number }).price_cents,
    ),
  );
  assert.deepEqual(scopedPromos(), [
    {
      code: 'CLEANFIVE',
      kind: 'fixed',
      discount_percent: 0,
      amount_cents: 500,
      category_scope: 'Household & Cleaning',
    },
    {
      code: 'GARDEN10',
      kind: 'percent',
      discount_percent: 10,
      amount_cents: null,
      category_scope: 'Garden & Outdoors',
    },
  ]);

  db.prepare(
    `INSERT INTO promo_codes (code, discount_percent, min_item_count, active, category_scope)
     VALUES ('LOCAL-SCOPE', 1, 0, 1, 'Drinks')`,
  ).run();
  seedDatabase(db);
  assert.deepEqual(clearances(), firstClearances);
  assert.equal(
    (
      db.prepare("SELECT category_scope FROM promo_codes WHERE code = 'LOCAL-SCOPE'").get() as {
        category_scope: string;
      }
    ).category_scope,
    'Drinks',
  );
});
