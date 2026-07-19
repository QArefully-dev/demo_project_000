import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createBundleRepository } from '../../src/features/bundles/bundleRepository.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import { createCart } from '../../src/features/cart/cartService.js';

void test('bundle repository hydrates ordered persisted products and filters by component', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-bundle-repository-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const bundles = createBundleRepository(db);
  assert.deepEqual(
    bundles
      .list()
      .map((bundle) => [
        bundle.id,
        bundle.key,
        bundle.components.map((component) => component.productId),
      ]),
    [
      [1, 'powder-starter-set', [1, 2, 3]],
      [2, 'pantry-set', [5, 6, 7]],
      [3, 'outdoor-kit', [27, 29, 31]],
      [4, 'questionable-assortment', [35, 36, 38]],
    ],
  );
  assert.deepEqual(
    bundles.list('29').map((bundle) => bundle.key),
    ['outdoor-kit'],
  );
  assert.deepEqual(
    bundles.list('999').map((bundle) => bundle.key),
    [],
  );

  db.prepare('UPDATE products SET active = 0, price_cents = 4321 WHERE id = 1').run();
  const starter = bundles.findById('1');
  assert.equal(starter?.active, 1);
  assert.equal(starter?.components[0]?.product?.active, 0);
  assert.equal(starter?.components[0]?.product?.price_cents, 4321);
});

void test('cart repository reads and increments ordinary line quantities', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-cart-line-quantity-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const carts = createCartRepository(db);
  const { cartId } = createCart(carts);
  assert.equal(carts.lineQuantity(cartId, '1'), 0);
  carts.addLineQuantity(cartId, '1', 3);
  carts.addLineQuantity(cartId, '1', 2);
  assert.equal(carts.lineQuantity(cartId, '1'), 5);
  carts.addLine(cartId, '1');
  assert.equal(carts.lineQuantity(cartId, '1'), 6);
});
