import assert from 'node:assert/strict';
import test from 'node:test';
import { Cart, CreateCartResponse } from '@shop/contracts/cart';
import { Value } from '@sinclair/typebox/value';
import { createSeededAppFixture } from '../support/seededDatabase.js';

void test('Custom Blend cart lines deduplicate, rehydrate, merge edits, and address config keys exactly', async (t) => {
  const { db, app } = await createSeededAppFixture(t);

  const lots = db
    .prepare(
      `SELECT pv.id, pv.product_id, pv.moq_sacks
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = (
           SELECT p2.mixing_group
           FROM product_variants pv2 INNER JOIN products p2 ON p2.id = pv2.product_id
           WHERE p2.active = 1 AND pv2.active = 1 AND pv2.sort_order = 1 AND pv2.weight_grams = 25000
             AND p2.mixing_group IS NOT NULL
           GROUP BY p2.mixing_group HAVING COUNT(*) >= 3 ORDER BY p2.mixing_group LIMIT 1
         )
       ORDER BY pv.id LIMIT 3`,
    )
    .all() as Array<{ id: number; product_id: number; moq_sacks: number }>;
  assert.equal(lots.length, 3);
  const [base, ingredientA, ingredientB] = lots;
  if (!base || !ingredientA || !ingredientB)
    throw new Error('Expected compatible Custom Blend lots');

  const created = await app.inject({ method: 'POST', url: '/api/cart' });
  const cartId = Value.Parse(CreateCartResponse, created.json()).cartId;
  const quantity = base.moq_sacks;
  const addA = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredientA.id, percentage: 5 }],
      quantity,
    },
  });
  assert.equal(addA.statusCode, 200);
  const first = Value.Parse(Cart, addA.json());
  const lineA = first.items[0];
  assert.ok(lineA?.customBlend);
  assert.equal(lineA?.blendingFeeCents, 2500);
  assert.equal(lineA?.discountableTotalCents, lineA?.materialSubtotalCents);
  assert.equal(lineA?.lineTotalCents, lineA?.materialSubtotalCents + 2500);

  const duplicate = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredientA.id, percentage: 5 }],
      quantity,
    },
  });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(Value.Parse(Cart, duplicate.json()).items[0]?.quantity, quantity * 2);

  const addB = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredientB.id, percentage: 10 }],
      quantity,
    },
  });
  const withTwo = Value.Parse(Cart, addB.json());
  const lineB = withTwo.items.find((item) => item.configKey !== lineA?.configKey);
  assert.ok(lineB?.customBlend);

  const merged = await app.inject({
    method: 'PUT',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      configKey: lineA?.configKey,
      ingredients: [{ variantId: ingredientB.id, percentage: 10 }],
    },
  });
  assert.equal(merged.statusCode, 200);
  const mergedCart = Value.Parse(Cart, merged.json());
  assert.equal(mergedCart.items.length, 1);
  assert.equal(mergedCart.items[0]?.quantity, quantity * 3);
  assert.equal(mergedCart.items[0]?.configKey, lineB?.configKey);

  const plain = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: String(base.product_id), variantId: base.id, quantity },
  });
  assert.equal(plain.statusCode, 200);
  const removed = await app.inject({
    method: 'DELETE',
    url: `/api/cart/${cartId}/items/${base.product_id}`,
    payload: {
      productId: String(base.product_id),
      variantId: base.id,
      configKey: lineB?.configKey,
    },
  });
  assert.equal(removed.statusCode, 200);
  const remaining = Value.Parse(Cart, removed.json());
  assert.equal(remaining.items.length, 1);
  assert.equal(remaining.items[0]?.configKey, '');
  assert.equal(remaining.blendingFeeTotalCents, 0);
});

void test('Custom Blend below MOQ returns localized guidance and safe metadata', async (t) => {
  const { db, app } = await createSeededAppFixture(t);

  const lots = db
    .prepare(
      `SELECT pv.id, pv.moq_sacks, pv.weight_grams, pv.product_id
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1
         AND pv.weight_grams = 25000 AND pv.moq_sacks > 1
         AND p.mixing_group = (
           SELECT p2.mixing_group
           FROM product_variants pv2 INNER JOIN products p2 ON p2.id = pv2.product_id
           WHERE p2.active = 1 AND pv2.active = 1 AND pv2.sort_order = 1
             AND pv2.weight_grams = 25000 AND p2.mixing_group IS NOT NULL
           GROUP BY p2.mixing_group HAVING COUNT(*) >= 2 ORDER BY p2.mixing_group LIMIT 1
         )
       ORDER BY pv.id LIMIT 2`,
    )
    .all() as Array<{ id: number; moq_sacks: number; weight_grams: number; product_id: number }>;
  assert.equal(lots.length, 2);
  const [base, ingredient] = lots;
  if (!base || !ingredient) throw new Error('Expected compatible Custom Blend lots');

  const minimumQuantity = Math.ceil((base.moq_sacks * 25_000) / base.weight_grams);
  const cartId = Value.Parse(
    CreateCartResponse,
    (await app.inject({ method: 'POST', url: '/api/cart' })).json(),
  ).cartId;
  const response = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    headers: { 'x-shop-country': 'DE' },
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredient.id, percentage: 5 }],
      quantity: minimumQuantity - 1,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: `Die Menge muss mindestens ${minimumQuantity} betragen.`,
    code: 'BELOW_MOQ',
    meta: { minQuantity: minimumQuantity },
  });
});

void test('Custom Blend applies active clearance to material only and preserves its flat fee', async (t) => {
  const now = new Date('2026-07-28T12:00:00.000Z');
  const { db, app } = await createSeededAppFixture({
    testContext: t,
    app: { clock: { now: () => now } },
  });

  const lots = db
    .prepare(
      `SELECT pv.id, pv.moq_sacks, pv.price_cents, pv.weight_grams
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = (
           SELECT p2.mixing_group
           FROM product_variants pv2 INNER JOIN products p2 ON p2.id = pv2.product_id
           WHERE p2.active = 1 AND pv2.active = 1 AND pv2.sort_order = 1 AND pv2.weight_grams = 25000
             AND p2.mixing_group IS NOT NULL
           GROUP BY p2.mixing_group HAVING COUNT(*) >= 2 ORDER BY p2.mixing_group LIMIT 1
         )
       ORDER BY pv.id LIMIT 2`,
    )
    .all() as Array<{ id: number; moq_sacks: number; price_cents: number; weight_grams: number }>;
  const [base, ingredient] = lots;
  if (!base || !ingredient) throw new Error('Expected compatible Custom Blend lots');
  const clearancePriceCents = base.price_cents - 1;
  db.prepare(
    `UPDATE product_variants
     SET clearance_price_cents = ?, clearance_starts_at = ?, clearance_ends_at = ?
     WHERE id = ?`,
  ).run(clearancePriceCents, '2026-07-28T00:00:00.000Z', '2026-07-29T00:00:00.000Z', base.id);

  const cartId = Value.Parse(
    CreateCartResponse,
    (await app.inject({ method: 'POST', url: '/api/cart' })).json(),
  ).cartId;
  const response = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredient.id, percentage: 5 }],
      quantity: base.moq_sacks,
    },
  });
  assert.equal(response.statusCode, 200);
  const line = Value.Parse(Cart, response.json()).items[0];
  assert.equal(line?.clearance?.priceCents, clearancePriceCents);
  assert.equal(line?.resolvedUnitPriceCents, clearancePriceCents);
  assert.equal(line?.materialSubtotalCents, clearancePriceCents * base.moq_sacks);
  assert.equal(line?.discountableTotalCents, line?.materialSubtotalCents);
  assert.equal(line?.blendingFeeCents, 2500);
  assert.equal(line?.lineTotalCents, line?.materialSubtotalCents + line?.blendingFeeCents);
});

void test('Custom Blend rejects retired persisted facts and reserved-cart edits', async (t) => {
  const { db, app } = await createSeededAppFixture(t);
  const lots = db
    .prepare(
      `SELECT pv.id FROM product_variants pv INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = (SELECT mixing_group FROM products WHERE mixing_group IS NOT NULL LIMIT 1)
       ORDER BY pv.id LIMIT 2`,
    )
    .all() as Array<{ id: number }>;
  assert.equal(lots.length, 2);
  const [base, ingredient] = lots;
  if (!base || !ingredient) throw new Error('Expected eligible lots');
  const cartId = Value.Parse(
    CreateCartResponse,
    (await app.inject({ method: 'POST', url: '/api/cart' })).json(),
  ).cartId;
  const add = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: { baseVariantId: base.id, ingredients: [{ variantId: ingredient.id, percentage: 5 }] },
  });
  assert.equal(add.statusCode, 200);
  const configKey = Value.Parse(Cart, add.json()).items[0]?.configKey;
  db.prepare(
    `INSERT INTO payments
       (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES ('custom-blend-lock', 'custom-blend-lock', 'prepared', 1, '4242', 'Visa')`,
  ).run();
  db.prepare(
    `INSERT INTO cart_reservations (cart_id, payment_idempotency_key, created_at)
     VALUES (?, 'custom-blend-lock', datetime('now'))`,
  ).run(cartId);
  const blocked = await app.inject({
    method: 'PUT',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      configKey,
      ingredients: [{ variantId: ingredient.id, percentage: 10 }],
    },
  });
  assert.equal(blocked.statusCode, 409);
  db.prepare(
    "DELETE FROM cart_reservations WHERE payment_idempotency_key = 'custom-blend-lock'",
  ).run();
  db.prepare('UPDATE product_variants SET active = 0 WHERE id = ?').run(ingredient.id);
  assert.equal((await app.inject({ method: 'GET', url: `/api/cart/${cartId}` })).statusCode, 404);
});

void test('corrupt Custom Blend JSON blocks plain and configured cart mutations without writes', async (t) => {
  const { db, app } = await createSeededAppFixture(t);

  const lots = db
    .prepare(
      `SELECT pv.id, pv.product_id, pv.moq_sacks
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = (
           SELECT p2.mixing_group
           FROM product_variants pv2 INNER JOIN products p2 ON p2.id = pv2.product_id
           WHERE p2.active = 1 AND pv2.active = 1 AND pv2.sort_order = 1 AND pv2.weight_grams = 25000
             AND p2.mixing_group IS NOT NULL
           GROUP BY p2.mixing_group HAVING COUNT(*) >= 3 ORDER BY p2.mixing_group LIMIT 1
         )
       ORDER BY pv.id LIMIT 3`,
    )
    .all() as Array<{ id: number; product_id: number; moq_sacks: number }>;
  const [base, ingredientA, ingredientB] = lots;
  if (!base || !ingredientA || !ingredientB)
    throw new Error('Expected compatible Custom Blend lots');

  const cartId = Value.Parse(
    CreateCartResponse,
    (await app.inject({ method: 'POST', url: '/api/cart' })).json(),
  ).cartId;
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/cart/${cartId}/custom-blends`,
        payload: {
          baseVariantId: base.id,
          ingredients: [{ variantId: ingredientA.id, percentage: 5 }],
          quantity: base.moq_sacks,
        },
      })
    ).statusCode,
    200,
  );

  db.pragma('ignore_check_constraints = ON');
  db.prepare(
    "UPDATE cart_line_items SET custom_blend_json = '{' WHERE cart_id = ? AND config_key <> ''",
  ).run(cartId);
  db.pragma('ignore_check_constraints = OFF');
  db.prepare("UPDATE carts SET updated_at = '2000-01-01 00:00:00' WHERE id = ?").run(cartId);
  const before = {
    lineCount: (
      db.prepare('SELECT COUNT(*) AS count FROM cart_line_items WHERE cart_id = ?').get(cartId) as {
        count: number;
      }
    ).count,
    updatedAt: (
      db.prepare('SELECT updated_at FROM carts WHERE id = ?').get(cartId) as {
        updated_at: string;
      }
    ).updated_at,
    auditCount: (
      db.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE entity_id = ?').get(cartId) as {
        count: number;
      }
    ).count,
  };

  const plain = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/items`,
    payload: { productId: String(base.product_id), variantId: base.id, quantity: base.moq_sacks },
  });
  assert.equal(plain.statusCode, 404);
  const configured = await app.inject({
    method: 'POST',
    url: `/api/cart/${cartId}/custom-blends`,
    payload: {
      baseVariantId: base.id,
      ingredients: [{ variantId: ingredientB.id, percentage: 10 }],
      quantity: base.moq_sacks,
    },
  });
  assert.equal(configured.statusCode, 404);
  assert.deepEqual(
    {
      lineCount: (
        db
          .prepare('SELECT COUNT(*) AS count FROM cart_line_items WHERE cart_id = ?')
          .get(cartId) as {
          count: number;
        }
      ).count,
      updatedAt: (
        db.prepare('SELECT updated_at FROM carts WHERE id = ?').get(cartId) as {
          updated_at: string;
        }
      ).updated_at,
      auditCount: (
        db
          .prepare('SELECT COUNT(*) AS count FROM audit_events WHERE entity_id = ?')
          .get(cartId) as {
          count: number;
        }
      ).count,
    },
    before,
  );
});
