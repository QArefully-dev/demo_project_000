import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import {
  addItem,
  createCart,
  getCart,
  removeItem,
  updateItem,
} from '../../src/features/cart/cartService.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';
import { validatePromo } from '../../src/features/promos/promoService.js';

void test('cart service coordinates cart repository and promo eligibility', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const { cartId } = createCart(carts);
  assert.equal(addItem(carts, cartId, '1').id, cartId);
  assert.equal(updateItem(carts, cartId, '1', 2).totalItems, 2);
  assert.equal(
    validatePromo(
      { code: 'SAVE10', cartId, userId: null, now: new Date('2026-07-14T10:00:00.000Z') },
      { carts, promos: createPromoRepository(db) },
    ).errorCode,
    'MIN_ITEMS',
  );
  assert.equal(removeItem(carts, cartId, '1').totalItems, 0);
  assert.deepEqual(getCart(carts, cartId)?.items, []);
});
