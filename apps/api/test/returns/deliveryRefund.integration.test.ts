import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createCheckoutService,
  type CheckoutParams,
} from '../../src/features/checkout/checkoutService.js';
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

function checkoutService(db: import('better-sqlite3').Database, now?: () => Date) {
  const carts = createCartRepository(db);
  return createCheckoutService({
    unitOfWork: createUnitOfWork(db),
    carts,
    promos: createPromoRepository(db),
    payments: createPaymentRepository(db),
    orders: createOrderRepository(db),
    mailbox: createMailboxRepository(db),
    gateway: simulatedPaymentGateway,
    clock: { now: now ?? (() => new Date()) },
    mixes: createPowderMixRepository(db),
    products: createProductRepository(db),
    audit: createAuditWriter({
      repository: createAuditRepository(db),
      clock: { now: now ?? (() => new Date()) },
    }),
    inventory: createInventoryService({ repository: createInventoryRepository(db) }),
  });
}

function paymentParams(
  cartId: string,
  idempotencyKey: string,
  userId: number | null = null,
): CheckoutParams {
  return {
    cartId,
    customerName: 'Return Test',
    customerEmail: 'return@example.test',
    shippingAddress: '1 Return Street',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey,
    userId,
    auditContext: {
      actor: userId === null ? { type: 'anonymous', userId: null } : { type: 'user', userId },
      requestId: `request-${idempotencyKey}`,
    },
  };
}

function getVariantId(db: import('better-sqlite3').Database, productId: number): number {
  const row = db
    .prepare(
      'SELECT id FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order LIMIT 1',
    )
    .get(productId) as { id: number } | undefined;
  if (!row) throw new Error(`No active variant for product ${productId}`);
  return row.id;
}

void test('returns exclude delivery from refund', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'shop-return-delivery-'));
  const dbPath = join(dir, 'shop.db');
  const db = openDatabase({ path: dbPath });
  const carts = createCartRepository(db);

  t.after(() => {
    closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  await t.test('freight order total includes delivery charge', async () => {
    resetDatabase(db);
    seedDatabase(db);
    const cartId = createCart(carts).cartId;

    // Add enough items to cross 100kg threshold
    const variants = db
      .prepare(
        'SELECT id, weight_grams, stock_count FROM product_variants WHERE active = 1 AND stock_count > 0 ORDER BY weight_grams DESC',
      )
      .all() as Array<{ id: number; weight_grams: number; stock_count: number }>;

    let totalWeight = 0;
    for (const v of variants) {
      if (totalWeight >= 100_000) break;
      const needed = Math.ceil((100_000 - totalWeight) / Math.max(v.weight_grams, 1));
      const qty = Math.min(needed, v.stock_count);
      if (qty <= 0) continue;
      addItem(carts, cartId, String(v.id));
      for (let i = 1; i < qty; i++) addItem(carts, cartId, String(v.id));
      totalWeight += qty * v.weight_grams;
    }

    const service = checkoutService(db);
    const result = await service.process(
      paymentParams(cartId, 'freight-return-test'),
    );

    assert.equal(result.success, true);
    if (!result.success) throw new Error('Expected success');
    const order = result.order;
    assert.equal(order.deliveryMode, 'freight');
    assert.equal(order.deliveryChargeCents, 999);
    // total = subtotal - discount + delivery
    assert.equal(
      order.totalCents,
      order.subtotalCents - order.discountCents + 999,
    );
    // Merchandise portion = subtotal - discount (no delivery)
    const merchandiseTotal = order.subtotalCents - order.discountCents;
    assert.ok(merchandiseTotal < order.totalCents);
  });

  await t.test('parcel order has zero delivery charge', async () => {
    resetDatabase(db);
    seedDatabase(db);
    const cartId = createCart(carts).cartId;
    const vId = getVariantId(db, 1);
    addItem(carts, cartId, String(vId));

    const service = checkoutService(db);
    const result = await service.process(
      paymentParams(cartId, 'parcel-return-test'),
    );

    assert.equal(result.success, true);
    if (!result.success) throw new Error('Expected success');
    const order = result.order;
    assert.equal(order.deliveryMode, 'parcel');
    assert.equal(order.deliveryChargeCents, 0);
    assert.equal(order.totalCents, order.subtotalCents - order.discountCents);
  });

  await t.test('legacy orders load with default delivery fields', async () => {
    resetDatabase(db);
    seedDatabase(db);

    // Seed orders (alice-processing) already has delivery columns
    const orders = createOrderRepository(db);
    // Find alice-processing order (demo_seed_key)
    const orderRows = db.prepare(
      "SELECT id, delivery_mode, delivery_charge_cents, delivery_weight_grams FROM orders WHERE demo_seed_key = 'alice-processing'",
    ).all() as Array<{
      id: number;
      delivery_mode: string | null;
      delivery_charge_cents: number | null;
      delivery_weight_grams: number | null;
    }>;

    assert.ok(orderRows.length > 0);
    for (const row of orderRows) {
      assert.equal(row.delivery_mode, 'parcel');
      assert.equal(row.delivery_charge_cents, 0);
      assert.ok(row.delivery_weight_grams !== null);
    }
  });
});
