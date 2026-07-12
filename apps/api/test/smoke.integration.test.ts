import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getDb, resetDatabase, seedDatabase } from '../src/db/index.js';
import {
  addItemToCart,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../src/domains/cart.js';
import { processPayment } from '../src/domains/payments.js';

const tempDir = mkdtempSync(join(tmpdir(), 'shop-api-smoke-'));
const dbPath = join(tempDir, 'shop.db');
const db = getDb(dbPath);

function resetAndSeed(): void {
  resetDatabase(db);
  seedDatabase(db);
}

function countRows(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function seededProduct(): { id: number; price_cents: number } {
  return db.prepare('SELECT id, price_cents FROM products ORDER BY id LIMIT 1').get() as {
    id: number;
    price_cents: number;
  };
}

void test('SQLite smoke integration', async (t) => {
  try {
    await t.test('creates schema and seeds canonical data idempotently', () => {
      resetAndSeed();
      seedDatabase(db);

      assert.equal(countRows('products'), 45);
      assert.equal(countRows('users'), 3);
      assert.equal(countRows('promo_codes'), 7);
      assert.equal(countRows('favourites'), 3);
      assert.deepEqual(
        db
          .prepare(
            "SELECT active, discount_percent, min_item_count FROM promo_codes WHERE code = 'SAVE10'",
          )
          .get(),
        { active: 1, discount_percent: 10, min_item_count: 5 },
      );
    });

    await t.test('persists cart create, update, read, and remove operations', () => {
      resetAndSeed();
      const product = seededProduct();
      const { cartId } = createCart();

      assert.notEqual(addItemToCart(cartId, String(product.id)), 'CART_NOT_FOUND');
      assert.notEqual(updateCartItem(cartId, String(product.id), 2), 'PRODUCT_NOT_IN_CART');

      const cart = getCart(cartId);
      assert.ok(cart);
      assert.equal(cart.items[0]?.quantity, 2);
      assert.equal(cart.items[0]?.lineTotalCents, product.price_cents * 2);
      assert.equal(cart.subtotalCents, product.price_cents * 2);
      assert.equal(cart.totalItems, 2);

      assert.notEqual(removeCartItem(cartId, String(product.id)), 'PRODUCT_NOT_IN_CART');
      assert.deepEqual(getCart(cartId)?.items, []);
    });

    await t.test('commits successful payment state and removes its cart', async () => {
      resetAndSeed();
      const product = seededProduct();
      const { cartId } = createCart();
      addItemToCart(cartId, String(product.id));

      const result = await processPayment({
        cartId,
        customerName: 'Smoke Success',
        customerEmail: 'smoke-success@example.test',
        shippingAddress: '1 Test Street',
        cardNumber: '4242 4242 4242 4242',
        cardExpiry: '12/99',
        cardCvc: '123',
        idempotencyKey: 'smoke-success-payment',
        userId: null,
      });

      assert.equal(result.success, true);
      if (!result.success) throw new Error('Expected successful payment');
      assert.equal(countRows('orders'), 1);
      assert.equal(countRows('order_line_items'), 1);
      assert.deepEqual(
        db
          .prepare('SELECT status, order_id FROM payments WHERE idempotency_key = ?')
          .get('smoke-success-payment'),
        { status: 'success', order_id: Number(result.orderId) },
      );
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) AS count FROM dev_mailbox WHERE kind = 'order_confirmation'")
            .get() as { count: number }
        ).count,
        1,
      );
      assert.equal(getCart(cartId), undefined);
    });

    await t.test(
      'records declined payment without creating an order or deleting its cart',
      async () => {
        resetAndSeed();
        const product = seededProduct();
        const { cartId } = createCart();
        addItemToCart(cartId, String(product.id));

        const result = await processPayment({
          cartId,
          customerName: 'Smoke Decline',
          customerEmail: 'smoke-decline@example.test',
          shippingAddress: '2 Test Street',
          cardNumber: '4000 0000 0000 0002',
          cardExpiry: '12/99',
          cardCvc: '123',
          idempotencyKey: 'smoke-decline-payment',
          userId: null,
        });

        assert.deepEqual(result, { success: false, error: 'DECLINED' });
        assert.equal(countRows('orders'), 0);
        assert.deepEqual(
          db
            .prepare('SELECT status, order_id FROM payments WHERE idempotency_key = ?')
            .get('smoke-decline-payment'),
          { status: 'declined', order_id: null },
        );
        assert.equal(getCart(cartId)?.totalItems, 1);
      },
    );
  } finally {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
  }
});
