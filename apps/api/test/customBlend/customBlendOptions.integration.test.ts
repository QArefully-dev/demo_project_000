import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import {
  CustomBlendErrorResponse,
  CustomBlendOptionsResponse,
  ErrorResponse,
  type CustomBlendOptionsResponse as CustomBlendOptionsResponseType,
} from '@shop/contracts';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

type EligibleLot = { variantId: number; productId: number; category: string };

function eligibleLot(
  db: ReturnType<typeof openDatabase>,
  category?: string,
): EligibleLot {
  const categoryClause = category ? 'AND p.category = ?' : '';
  const row = db
    .prepare(
      `SELECT pv.id AS variantId, p.id AS productId, p.category
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1
         AND pv.active = 1
         AND pv.sort_order = 1
         AND pv.weight_grams = 25000
         AND p.mixing_group = 'food-grade'
         ${categoryClause}
       ORDER BY pv.id ASC
       LIMIT 1`,
    )
    .get(...(category ? [category] : [])) as EligibleLot | undefined;
  if (!row) throw new Error('Expected eligible food-grade lot');
  return row;
}

void test('Custom Blend options expose all compatible active 25 kg lots across categories, including sold out lots', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-custom-blend-options-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  resetDatabase(db);
  seedDatabase(db);
  const base = eligibleLot(db, 'Sports Nutrition');
  const crossCategory = db
    .prepare(
      `SELECT pv.id AS variantId, p.id AS productId, p.category
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = 'food-grade' AND p.category != ?
       ORDER BY p.category ASC, pv.id ASC LIMIT 1`,
    )
    .get(base.category) as EligibleLot | undefined;
  if (!crossCategory) throw new Error('Expected cross-category food-grade lot');
  db.prepare('UPDATE product_variants SET stock_count = 0 WHERE id = ?').run(crossCategory.variantId);

  const excluded = db
    .prepare(
      `SELECT pv.id AS variantId, p.id AS productId, p.category
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       WHERE p.active = 1 AND pv.active = 1 AND pv.sort_order = 1 AND pv.weight_grams = 25000
         AND p.mixing_group = 'food-grade' AND pv.id NOT IN (?, ?)
       ORDER BY pv.id ASC LIMIT 1`,
    )
    .get(base.variantId, crossCategory.variantId) as EligibleLot | undefined;
  if (!excluded) throw new Error('Expected additional eligible food-grade lot');
  db.prepare('UPDATE products SET mixing_group = NULL WHERE id = ?').run(excluded.productId);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await app.inject({
    method: 'GET',
    url: `/api/custom-blends/options?baseVariantId=${base.variantId}`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json<CustomBlendOptionsResponseType>();
  assert.equal(Value.Check(CustomBlendOptionsResponse, body), true);
  assert.equal(body.base.variant.variantId, base.variantId);
  assert.equal(body.base.mixingGroup, 'food-grade');
  assert.ok(body.ingredients.some((option) => option.variant.variantId === crossCategory.variantId));
  assert.equal(
    body.ingredients.find((option) => option.variant.variantId === crossCategory.variantId)?.variant.stockCount,
    0,
  );
  assert.equal(body.ingredients.some((option) => option.variant.variantId === base.variantId), false);
  assert.equal(body.ingredients.some((option) => option.productId === String(excluded.productId)), false);
  assert.deepEqual(
    body.ingredients.map((option) => option.variant.variantId),
    [...body.ingredients]
      .sort(
        (left, right) =>
          left.mixingGroup.localeCompare(right.mixingGroup) ||
          left.productName.localeCompare(right.productName) ||
          left.variant.variantId - right.variant.variantId,
      )
      .map((option) => option.variant.variantId),
  );
});

void test('Custom Blend options reject nonexistent, inactive, null-group, and wrong-shape bases', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-custom-blend-invalid-base-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  resetDatabase(db);
  seedDatabase(db);
  const base = eligibleLot(db, 'Sports Nutrition');
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  for (const invalidCase of [
    { variantId: 999_999, mutate: () => undefined },
    {
      variantId: base.variantId,
      mutate: () => db.prepare('UPDATE product_variants SET active = 0 WHERE id = ?').run(base.variantId),
    },
    {
      variantId: base.variantId,
      mutate: () => db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(base.productId),
    },
    {
      variantId: base.variantId,
      mutate: () => db.prepare('UPDATE products SET mixing_group = NULL WHERE id = ?').run(base.productId),
    },
    {
      variantId: base.variantId,
      mutate: () => db.prepare('UPDATE product_variants SET weight_grams = 1000 WHERE id = ?').run(base.variantId),
    },
    {
      variantId: base.variantId,
      mutate: () => db.prepare('UPDATE product_variants SET sort_order = 2 WHERE id = ?').run(base.variantId),
    },
  ]) {
    resetDatabase(db);
    seedDatabase(db);
    invalidCase.mutate();
    const response = await app.inject({
      method: 'GET',
      url: `/api/custom-blends/options?baseVariantId=${invalidCase.variantId}`,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(Value.Check(CustomBlendErrorResponse, response.json()), true);
  }
});

void test('Custom Blend options serialize malformed query validation as 400 responses', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shop-custom-blend-options-query-validation-'));
  const db = openDatabase({ path: join(tempDir, 'shop.db') });
  resetDatabase(db);
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  for (const query of ['', '?baseVariantId=not-a-number', '?baseVariantId=1&unexpected=true']) {
    const response = await app.inject({ method: 'GET', url: `/api/custom-blends/options${query}` });
    assert.equal(response.statusCode, 400);
    assert.equal(Value.Check(ErrorResponse, response.json()), true);
  }
});
