import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkout, type CheckoutParams } from '../../src/features/checkout/checkoutService.js';
import type { GatewayResult, PaymentGateway } from '../../src/features/payments/paymentGateway.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import { addItem, createCart, getCart } from '../../src/features/cart/cartService.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

function deferredGateway(): { gateway: PaymentGateway; resolve: (result: GatewayResult) => void } {
  let resolve!: (result: GatewayResult) => void;
  return {
    gateway: {
      process: async () =>
        new Promise<GatewayResult>((done) => {
          resolve = done;
        }),
    },
    resolve: (result) => resolve(result),
  };
}

void test('atomic checkout orchestration', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'shop-checkout-'));
  const dbPath = join(dir, 'shop.db');
  const db = openDatabase({ path: dbPath });
  const carts = createCartRepository(db);
  const payment = (cartId: string, idempotencyKey: string): CheckoutParams => ({
    cartId,
    customerName: 'Checkout Test',
    customerEmail: 'checkout@example.test',
    shippingAddress: '1 Test Street',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey,
    userId: null,
  });
  const freshCart = () => {
    resetDatabase(db);
    seedDatabase(db);
    const { cartId } = createCart(carts);
    addItem(carts, cartId, '1');
    return cartId;
  };

  t.after(() => {
    closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  await t.test('reserves same-key work once and replays its completed order', async () => {
    const cartId = freshCart();
    const deferred = deferredGateway();
    const params = payment(cartId, 'same-key');
    const first = checkout(params, { db, gateway: deferred.gateway });
    const concurrent = await checkout(params, { db, gateway: deferred.gateway });
    assert.deepEqual(concurrent, { success: false, error: 'IDEMPOTENT_IN_PROGRESS' });
    deferred.resolve({ status: 'success' });
    const completed = await first;
    assert.equal(completed.success, true);
    const replay = await checkout(params, { db, gateway: deferred.gateway });
    assert.deepEqual(replay, completed);
    assert.ok(
      (
        db
          .prepare('SELECT response_json FROM payments WHERE idempotency_key = ?')
          .get('same-key') as {
          response_json: string | null;
        }
      ).response_json,
    );
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count,
      1,
    );
  });

  await t.test(
    'rejects concurrent same-key changed payload without a duplicate order',
    async () => {
      const cartId = freshCart();
      const deferred = deferredGateway();
      const params = payment(cartId, 'conflict-key');
      const first = checkout(params, { db, gateway: deferred.gateway });
      const conflict = await checkout(
        { ...params, customerName: 'Changed customer' },
        { db, gateway: deferred.gateway },
      );
      assert.deepEqual(conflict, { success: false, error: 'IDEMPOTENT_CONFLICT' });
      deferred.resolve({ status: 'success' });
      assert.equal((await first).success, true);
      assert.equal(
        (db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count,
        1,
      );
    },
  );

  await t.test('replays decline and timeout deterministically', async () => {
    for (const result of [{ status: 'declined' }, { status: 'timeout' }] as const) {
      const cartId = freshCart();
      const params = payment(cartId, `failure-${result.status}`);
      const gateway: PaymentGateway = { process: () => Promise.resolve(result) };
      const first = await checkout(params, { db, gateway });
      const replay = await checkout(params, { db, gateway });
      assert.deepEqual(replay, first);
      assert.equal(getCart(carts, cartId)?.totalItems, 1);
    }
  });

  await t.test('re-reads cart and promo eligibility after the gateway wait', async () => {
    const cartId = freshCart();
    const deferred = deferredGateway();
    const first = checkout(payment(cartId, 'cart-change'), { db, gateway: deferred.gateway });
    addItem(carts, cartId, '2');
    deferred.resolve({ status: 'success' });
    const result = await first;
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.order.items.length, 2);

    const promoCartId = freshCart();
    for (const productId of ['2', '3', '4', '5']) addItem(carts, promoCartId, productId);
    const promoDeferred = deferredGateway();
    const promoPayment = { ...payment(promoCartId, 'promo-change'), promoCode: 'SAVE10' };
    const pending = checkout(promoPayment, { db, gateway: promoDeferred.gateway });
    db.prepare("UPDATE promo_codes SET active = 0 WHERE code = 'SAVE10'").run();
    promoDeferred.resolve({ status: 'success' });
    const expectedPromoFailure = {
      success: false,
      error: 'PROMO_INVALID',
      promoError: 'Promo code not found or inactive',
      promoErrorCode: 'INVALID',
    } as const;
    assert.deepEqual(await pending, expectedPromoFailure);
    assert.deepEqual(
      await checkout(promoPayment, { db, gateway: promoDeferred.gateway }),
      expectedPromoFailure,
    );
    assert.equal(getCart(carts, promoCartId)?.totalItems, 5);
  });

  await t.test('rolls back order and redemption writes together', async () => {
    const cartId = freshCart();
    for (const productId of ['2', '3', '4', '5']) addItem(carts, cartId, productId);
    db.exec(
      `CREATE TRIGGER abort_checkout_mailbox BEFORE INSERT ON dev_mailbox BEGIN SELECT RAISE(ABORT, 'mailbox failure'); END`,
    );
    const result = await checkout({ ...payment(cartId, 'rollback'), promoCode: 'SAVE10' }, { db });
    assert.deepEqual(result, { success: false, error: 'CHECKOUT_FAILED' });
    assert.equal(getCart(carts, cartId)?.totalItems, 5);
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count,
      0,
    );
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS count FROM promo_redemptions').get() as { count: number })
        .count,
      0,
    );
  });

  await t.test('persists only safe card metadata and fingerprint inputs', async () => {
    const cartId = freshCart();
    const params = payment(cartId, 'safe-data');
    await checkout(params, { db });
    const stored = db
      .prepare(
        'SELECT request_fingerprint, card_last4, card_brand FROM payments WHERE idempotency_key = ?',
      )
      .get(params.idempotencyKey) as {
      request_fingerprint: string;
      card_last4: string;
      card_brand: string;
    };
    const oldUnsafeFingerprint = createHash('sha256')
      .update(
        JSON.stringify(
          {
            cartId,
            promoCode: null,
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            shippingAddress: params.shippingAddress,
            cardNumber: '4242424242424242',
            cardExpiry: params.cardExpiry,
            cardCvc: params.cardCvc,
          },
          [
            'cartId',
            'promoCode',
            'customerName',
            'customerEmail',
            'shippingAddress',
            'cardNumber',
            'cardExpiry',
            'cardCvc',
          ].sort(),
        ),
      )
      .digest('hex');
    assert.notEqual(stored.request_fingerprint, oldUnsafeFingerprint);
    assert.deepEqual(
      { card_last4: stored.card_last4, card_brand: stored.card_brand },
      { card_last4: '4242', card_brand: 'Visa' },
    );
    assert.equal(JSON.stringify(stored).includes(params.cardNumber.replaceAll(' ', '')), false);
    assert.equal(JSON.stringify(stored).includes(params.cardCvc), false);
  });
});
