import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createCheckoutService,
  type CheckoutParams,
} from '../../src/features/checkout/checkoutService.js';
import type {
  GatewayResult,
  PaymentGateway,
  PaymentGatewayRequest,
} from '../../src/features/payments/paymentGateway.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import { addItem, createCart, getCart } from '../../src/features/cart/cartService.js';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';
import { createPaymentRepository } from '../../src/features/payments/paymentRepository.js';
import { createOrderRepository } from '../../src/features/orders/orderRepository.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { simulatedPaymentGateway } from '../../src/features/payments/paymentGateway.js';
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createInventoryRepository } from '../../src/features/inventory/inventoryRepository.js';
import { createInventoryService } from '../../src/features/inventory/inventoryService.js';

function checkout(
  params: CheckoutParams,
  dependencies: {
    db: import('better-sqlite3').Database;
    gateway?: PaymentGateway;
    now?: () => Date;
  },
) {
  const carts = createCartRepository(dependencies.db);
  return createCheckoutService({
    unitOfWork: createUnitOfWork(dependencies.db),
    carts,
    promos: createPromoRepository(dependencies.db),
    payments: createPaymentRepository(dependencies.db),
    orders: createOrderRepository(dependencies.db),
    mailbox: createMailboxRepository(dependencies.db),
    gateway: dependencies.gateway ?? simulatedPaymentGateway,
    clock: { now: dependencies.now ?? (() => new Date()) },
    mixes: createPowderMixRepository(dependencies.db),
    products: createProductRepository(dependencies.db),
    audit: createAuditWriter({
      repository: createAuditRepository(dependencies.db),
      clock: { now: dependencies.now ?? (() => new Date()) },
    }),
    inventory: createInventoryService({ repository: createInventoryRepository(dependencies.db) }),
  }).process(params);
}

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

function spyGateway(result: GatewayResult = { status: 'success' }): {
  gateway: PaymentGateway;
  calls: () => number;
  requests: () => PaymentGatewayRequest[];
} {
  let count = 0;
  const requests: PaymentGatewayRequest[] = [];
  return {
    gateway: {
      process: (request) => {
        count += 1;
        requests.push(request);
        return Promise.resolve(result);
      },
    },
    calls: () => count,
    requests: () => requests,
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
    auditContext: {
      actor: { type: 'anonymous', userId: null },
      requestId: `request-${idempotencyKey}`,
    },
  });
  const freshCart = () => {
    resetDatabase(db);
    seedDatabase(db);
    const { cartId } = createCart(carts);
    const vId = (
      db.prepare(
        'SELECT id FROM product_variants WHERE active = 1 ORDER BY sort_order LIMIT 1',
      ).get() as { id: number } | undefined
    )?.id;
    if (!vId) throw new Error('No active variants found');
    addItem(carts, cartId, String(vId));
    return cartId;
  };

  function addVariantById(cartId: string, variantId: number) {
    addItem(carts, cartId, String(variantId));
  }

  function addVariantForProduct(cartId: string, productId: number) {
    const row = db
      .prepare(
        'SELECT id FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order LIMIT 1',
      )
      .get(productId) as { id: number } | undefined;
    if (!row) throw new Error(`No active variant for product ${productId}`);
    return addItem(carts, cartId, String(row.id));
  }

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
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM orders WHERE customer_email = 'checkout@example.test'",
          )
          .get() as { count: number }
      ).count,
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
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM orders WHERE customer_email = 'checkout@example.test'",
            )
            .get() as { count: number }
        ).count,
        1,
      );
    },
  );

  await t.test('rejects same-key changed card expiry without another gateway request', async () => {
    const cartId = freshCart();
    const gateway = spyGateway();
    const params = payment(cartId, 'expiry-conflict');
    assert.equal((await checkout(params, { db, gateway: gateway.gateway })).success, true);

    const conflict = await checkout(
      { ...params, cardExpiry: '11/99' },
      { db, gateway: gateway.gateway },
    );
    assert.deepEqual(conflict, { success: false, error: 'IDEMPOTENT_CONFLICT' });
    assert.equal(gateway.calls(), 1);
  });

  await t.test('replays decline and timeout deterministically', async () => {
    for (const result of [{ status: 'declined' }, { status: 'timeout' }] as const) {
      const cartId = freshCart();
      const params = payment(cartId, `failure-${result.status}`);
      const gateway: PaymentGateway = { process: () => Promise.resolve(result) };
      const first = await checkout(params, { db, gateway });
      const replay = await checkout(params, { db, gateway });
      assert.deepEqual(replay, first);
      assert.equal(getCart(carts, cartId)?.totalItems, 1);
      const events = db
        .prepare('SELECT action, entity_id FROM audit_events WHERE request_id = ?')
        .all(params.auditContext.requestId) as Array<{ action: string; entity_id: string }>;
      assert.deepEqual(
        events.map((event) => event.action),
        [result.status === 'declined' ? 'payment.declined' : 'payment.timed_out'],
      );
      assert.match(events[0]?.entity_id ?? '', /^\d+$/);
    }
  });

  await t.test('does not call gateway when cart is missing', async () => {
    resetDatabase(db);
    seedDatabase(db);
    const gateway = spyGateway();

    const result = await checkout(payment('missing-cart', 'missing-cart'), {
      db,
      gateway: gateway.gateway,
    });

    assert.deepEqual(result, { success: false, error: 'CART_NOT_FOUND' });
    assert.equal(gateway.calls(), 0);
    const event = db
      .prepare('SELECT action, entity_id, metadata_json FROM audit_events WHERE request_id = ?')
      .get('request-missing-cart') as {
      action: string;
      entity_id: string;
      metadata_json: string;
    };
    assert.equal(event.action, 'payment.pre_gateway_failed');
    assert.match(event.entity_id, /^\d+$/);
    assert.equal(event.metadata_json, '{"errorCode":"CART_NOT_FOUND"}');
  });

  await t.test('rolls back pre-gateway failure when its audit write fails', async () => {
    resetDatabase(db);
    seedDatabase(db);
    db.exec(
      `CREATE TRIGGER abort_pre_gateway_audit BEFORE INSERT ON audit_events
       WHEN NEW.action = 'payment.pre_gateway_failed'
       BEGIN SELECT RAISE(ABORT, 'audit failure'); END`,
    );
    try {
      await assert.rejects(() =>
        checkout(payment('missing-audit-cart', 'pre-gateway-audit-rollback'), { db }),
      );
      assert.equal(
        (
          db
            .prepare('SELECT COUNT(*) AS count FROM payments WHERE idempotency_key = ?')
            .get('pre-gateway-audit-rollback') as { count: number }
        ).count,
        0,
      );
    } finally {
      db.exec('DROP TRIGGER IF EXISTS abort_pre_gateway_audit');
    }
  });

  await t.test('does not call gateway when cart is empty', async () => {
    resetDatabase(db);
    seedDatabase(db);
    const { cartId } = createCart(carts);
    const gateway = spyGateway();

    const result = await checkout(payment(cartId, 'empty-cart'), { db, gateway: gateway.gateway });

    assert.deepEqual(result, { success: false, error: 'CART_EMPTY' });
    assert.equal(gateway.calls(), 0);
  });

  await t.test('does not call gateway for invalid or ineligible promos', async () => {
    const invalidCartId = freshCart();
    const invalidGateway = spyGateway();
    const invalid = await checkout(
      { ...payment(invalidCartId, 'invalid-promo'), promoCode: 'NOT-A-PROMO' },
      { db, gateway: invalidGateway.gateway },
    );

    const ineligibleCartId = freshCart();
    const ineligibleGateway = spyGateway();
    const ineligible = await checkout(
      { ...payment(ineligibleCartId, 'ineligible-promo'), promoCode: 'SAVE10' },
      { db, gateway: ineligibleGateway.gateway },
    );
    assert.equal(invalid.error, 'PROMO_INVALID');
    assert.equal(ineligible.error, 'PROMO_INVALID');
    assert.equal(invalidGateway.calls(), 0);
    assert.equal(ineligibleGateway.calls(), 0);
  });

    await t.test('uses checkout clock at promo expiry boundary', async () => {
      const cartId = freshCart();
      for (const productId of [2, 3]) addVariantForProduct(cartId, productId);
    const checkoutClock = new Date('2024-12-31T23:59:59.999Z');

    const result = await checkout(
      { ...payment(cartId, 'clock-boundary'), promoCode: 'EXPIRED10' },
      { db, now: () => checkoutClock },
    );

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.order.promoApplied, 'EXPIRED10');
      assert.equal(result.order.createdAt, checkoutClock.toISOString());
    }
  });

  await t.test('charges the persisted server quote total', async () => {
    const cartId = freshCart();
    const gateway = spyGateway();
    const expectedTotal = getCart(carts, cartId)?.subtotalCents;
    const result = await checkout(payment(cartId, 'quoted-amount'), {
      db,
      gateway: gateway.gateway,
    });

    assert.equal(result.success, true);
    assert.equal(gateway.requests()[0]?.amountCents, expectedTotal);
    if (result.success) assert.equal(result.order.totalCents, expectedTotal);
  });

    await t.test('locks the quote and promo reservation before the gateway wait', async () => {
      const cartId = freshCart();
      const deferred = deferredGateway();
      const first = checkout(payment(cartId, 'cart-change'), { db, gateway: deferred.gateway });
      assert.equal(addVariantForProduct(cartId, 2), 'CART_RESERVED');
      deferred.resolve({ status: 'success' });
      const result = await first;
      assert.equal(result.success, true);
      if (result.success) assert.equal(result.order.items.length, 1);

      const promoCartId = freshCart();
      for (const productId of [2, 3, 4, 5]) addVariantForProduct(promoCartId, productId);
    const promoDeferred = deferredGateway();
    const promoPayment = { ...payment(promoCartId, 'promo-change'), promoCode: 'SAVE10' };
    const pending = checkout(promoPayment, { db, gateway: promoDeferred.gateway });
    db.prepare("UPDATE promo_codes SET active = 0 WHERE code = 'SAVE10'").run();
    promoDeferred.resolve({ status: 'success' });
    assert.equal((await pending).success, true);
    assert.equal(
      (await checkout(promoPayment, { db, gateway: promoDeferred.gateway })).success,
      true,
    );
    assert.equal(getCart(carts, promoCartId), undefined);
  });

  await t.test('expires prepared reservations and rejects late gateway completion', async () => {
    const cartId = freshCart();
    const deferred = deferredGateway();
    const params = payment(cartId, 'expired-reservation');
    let current = new Date('2026-07-14T10:00:00.000Z');
    const first = checkout(params, { db, gateway: deferred.gateway, now: () => current });
    current = new Date('2026-07-14T10:15:00.000Z');
    const expired = await checkout(params, { db, gateway: deferred.gateway, now: () => current });
    assert.deepEqual(expired, {
      success: false,
      error: 'RESERVATION_EXPIRED',
      reservationExpiresAt: '2026-07-14T10:15:00.000Z',
    });
    assert.notEqual(addVariantForProduct(cartId, 2), 'CART_RESERVED');
    assert.equal(
      (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM inventory_reservations WHERE payment_idempotency_key = ?',
          )
          .get(params.idempotencyKey) as { count: number }
      ).count,
      0,
    );
    deferred.resolve({ status: 'success' });
    assert.deepEqual(await first, expired);
  });

  await t.test(
    'terminalizes an expired reservation when gateway success arrives late',
    async () => {
      const cartId = freshCart();
      const deferred = deferredGateway();
      const params = payment(cartId, 'late-gateway-expiry');
      let current = new Date('2026-07-14T10:00:00.000Z');
      const first = checkout(params, { db, gateway: deferred.gateway, now: () => current });
      current = new Date('2026-07-14T10:15:00.000Z');
      deferred.resolve({ status: 'success' });
      const expired = {
        success: false as const,
        error: 'RESERVATION_EXPIRED' as const,
        reservationExpiresAt: '2026-07-14T10:15:00.000Z',
      };
      assert.deepEqual(await first, expired);
      assert.equal(
        (
          db
            .prepare('SELECT status, response_json FROM payments WHERE idempotency_key = ?')
            .get(params.idempotencyKey) as { status: string; response_json: string }
        ).status,
        'failed_pre_gateway',
      );
      assert.equal(
        (
          db
            .prepare(
              'SELECT COUNT(*) AS count FROM inventory_reservations WHERE payment_idempotency_key = ?',
            )
            .get(params.idempotencyKey) as { count: number }
        ).count,
        0,
      );
      assert.notEqual(addVariantForProduct(cartId, 2), 'CART_RESERVED');
      assert.deepEqual(
        await checkout(params, { db, gateway: deferred.gateway, now: () => current }),
        expired,
      );
    },
  );

  await t.test('rolls back order and redemption writes together', async () => {
    const cartId = freshCart();
      for (const productId of [2, 3, 4, 5]) addVariantForProduct(cartId, productId);
    db.exec(
      `CREATE TRIGGER abort_checkout_mailbox BEFORE INSERT ON dev_mailbox BEGIN SELECT RAISE(ABORT, 'mailbox failure'); END`,
    );
    const result = await checkout({ ...payment(cartId, 'rollback'), promoCode: 'SAVE10' }, { db });
    assert.deepEqual(result, { success: false, error: 'IDEMPOTENT_IN_PROGRESS' });
    assert.equal(getCart(carts, cartId)?.totalItems, 5);
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM orders WHERE customer_email = 'checkout@example.test'",
          )
          .get() as { count: number }
      ).count,
      0,
    );
    db.exec('DROP TRIGGER IF EXISTS abort_checkout_mailbox');
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS count FROM promo_redemptions').get() as { count: number })
        .count,
      0,
    );
  });

  await t.test('keeps gateway-success finalization failure resumable', async () => {
    const cartId = freshCart();
    db.exec('DROP TRIGGER IF EXISTS abort_checkout_mailbox');
    db.exec(
      `CREATE TRIGGER abort_checkout_mailbox BEFORE INSERT ON dev_mailbox BEGIN SELECT RAISE(ABORT, 'mailbox failure'); END`,
    );

    const result = await checkout(payment(cartId, 'resume-after-finalize'), { db });
    const stored = db
      .prepare('SELECT status, response_json FROM payments WHERE idempotency_key = ?')
      .get('resume-after-finalize') as { status: string; response_json: string | null };

    assert.notDeepEqual(result, { success: false, error: 'CHECKOUT_FAILED' });
    assert.equal(stored.status, 'authorized_pending_finalize');
    assert.equal(stored.response_json, null);
    db.exec('DROP TRIGGER IF EXISTS abort_checkout_mailbox');
    const resumed = await checkout(payment(cartId, 'resume-after-finalize'), { db });
    assert.equal(resumed.success, true);
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM orders WHERE customer_email = 'checkout@example.test'",
          )
          .get() as { count: number }
      ).count,
      1,
    );
  });

  await t.test('rolls back audited finalization and appends its events once on retry', async () => {
    const cartId = freshCart();
    const params = payment(cartId, 'audit-finalize-rollback');
    db.exec(
      `CREATE TRIGGER abort_order_audit BEFORE INSERT ON audit_events
       WHEN NEW.action = 'order.created'
       BEGIN SELECT RAISE(ABORT, 'audit failure'); END`,
    );
    const failed = await checkout(params, { db });
    assert.deepEqual(failed, { success: false, error: 'IDEMPOTENT_IN_PROGRESS' });
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM orders WHERE customer_email = 'checkout@example.test'",
          )
          .get() as { count: number }
      ).count,
      0,
    );
    assert.equal(getCart(carts, cartId)?.totalItems, 1);
    assert.equal(
      (
        db
          .prepare('SELECT status FROM payments WHERE idempotency_key = ?')
          .get(params.idempotencyKey) as { status: string }
      ).status,
      'authorized_pending_finalize',
    );
    db.exec('DROP TRIGGER IF EXISTS abort_order_audit');
    assert.equal((await checkout(params, { db })).success, true);
    const events = db
      .prepare('SELECT action FROM audit_events WHERE request_id = ? ORDER BY id')
      .all(params.auditContext.requestId) as Array<{ action: string }>;
    assert.deepEqual(
      events.map((event) => event.action),
      ['order.created', 'payment.succeeded', 'checkout.cart_consumed'],
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
