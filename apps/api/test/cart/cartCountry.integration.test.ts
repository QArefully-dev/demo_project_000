import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CreateCartResponse } from '@shop/contracts/cart';
import { Value } from '@sinclair/typebox/value';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';

void test('cart creation persists country', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-country-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/cart',
    payload: { country: 'US' },
  });
  assert.equal(created.statusCode, 201);
  const { cartId } = Value.Parse(CreateCartResponse, created.json());
  const row = db.prepare('SELECT country FROM carts WHERE id = ?').get(cartId) as {
    country: string;
  };
  assert.equal(row.country, 'US');
});

void test('cart creation applies default country on omission', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-country-default-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/cart',
    payload: {},
  });
  assert.equal(created.statusCode, 201);
  const { cartId } = Value.Parse(CreateCartResponse, created.json());
  const row = db.prepare('SELECT country FROM carts WHERE id = ?').get(cartId) as {
    country: string;
  };
  assert.equal(row.country, 'UK');
});

void test('cart creation accepts a bodyless request', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-country-bodyless-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const created = await app.inject({ method: 'POST', url: '/api/cart' });
  assert.equal(created.statusCode, 201);
  const { cartId } = Value.Parse(CreateCartResponse, created.json());
  const row = db.prepare('SELECT country FROM carts WHERE id = ?').get(cartId) as {
    country: string;
  };
  assert.equal(row.country, 'UK');
});

void test('cart creation rejects invalid country', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-country-invalid-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/cart',
    payload: { country: 'XX' },
  });
  assert.equal(created.statusCode, 400);
});

void test('carts with different countries stay separate', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-country-separate-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const uk = await app.inject({ method: 'POST', url: '/api/cart', payload: { country: 'UK' } });
  assert.equal(uk.statusCode, 201);
  const ukCartId = Value.Parse(CreateCartResponse, uk.json()).cartId;

  const us = await app.inject({ method: 'POST', url: '/api/cart', payload: { country: 'US' } });
  assert.equal(us.statusCode, 201);
  const usCartId = Value.Parse(CreateCartResponse, us.json()).cartId;

  const ukRow = db.prepare('SELECT country FROM carts WHERE id = ?').get(ukCartId) as {
    country: string;
  };
  const usRow = db.prepare('SELECT country FROM carts WHERE id = ?').get(usCartId) as {
    country: string;
  };
  assert.notEqual(ukCartId, usCartId);
  assert.equal(ukRow.country, 'UK');
  assert.equal(usRow.country, 'US');
});
