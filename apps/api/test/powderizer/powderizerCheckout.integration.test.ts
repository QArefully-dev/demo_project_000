import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import {
  createCheckoutService,
  type CheckoutParams,
} from '../../src/features/checkout/checkoutService.js';
import { createOrderRepository } from '../../src/features/checkout/orderRepository.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createPaymentRepository } from '../../src/features/payments/paymentRepository.js';
import { simulatedPaymentGateway } from '../../src/features/payments/paymentGateway.js';
import { createPowderMixRepository } from '../../src/features/powderizer/powderMixRepository.js';
import { createPowderizerService } from '../../src/features/powderizer/powderizerService.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';

void test('mixed checkout snapshots mixes, reserves stock, and finalizes once', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-checkout-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const products = createProductRepository(db);
  const mixes = createPowderMixRepository(db);
  const powderizer = createPowderizerService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products,
    mixes,
  });
  const cartId = crypto.randomUUID();
  carts.create(cartId);
  const mixId = powderizer.create(cartId, {
    components: [
      { productId: '1', percentage: 50 },
      { productId: '2', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'fine',
    customLabel: 'Immutable blend',
  });
  assert.equal(typeof mixId, 'string');
  if (typeof mixId !== 'string') throw new Error('Expected mix ID');
  const checkout = createCheckoutService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products,
    mixes,
    promos: createPromoRepository(db),
    payments: createPaymentRepository(db),
    orders: createOrderRepository(db),
    mailbox: createMailboxRepository(db),
    gateway: simulatedPaymentGateway,
    clock: { now: () => new Date('2026-07-14T10:00:00.000Z') },
  });
  const params: CheckoutParams = {
    cartId,
    customerName: 'Mix Customer',
    customerEmail: 'mix@example.test',
    shippingAddress: '1 Test Street',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey: crypto.randomUUID(),
    userId: null,
  };
  const beforeStock = products.findById(1)?.stock_count;
  const result = await checkout.process(params);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.order.items.length, 0);
  assert.equal(result.order.mixItems.length, 1);
  assert.equal(result.order.mixItems[0]?.mixId, mixId);
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS count FROM powder_mix_stock_reservations').get() as {
        count: number;
      }
    ).count,
    0,
  );
  assert.equal(products.findById(1)?.stock_count, (beforeStock ?? 0) - 1);
  db.prepare("UPDATE products SET name = 'Changed name', price_cents = 1 WHERE id = 1").run();
  assert.equal(
    createOrderRepository(db).findById(Number(result.order.id))?.mixItems[0]?.components[0]
      ?.productName,
    'Protein Powder',
  );
  db.prepare('UPDATE order_powder_mix_items SET snapshot_json = ? WHERE order_id = ?').run(
    JSON.stringify({ snapshotVersion: 1, mixId: mixId, components: [] }),
    Number(result.order.id),
  );
  assert.throws(
    () => createOrderRepository(db).findById(Number(result.order.id)),
    /Invalid order mix snapshot/,
  );
  const replay = await checkout.process(params);
  assert.equal(replay.success, true);
  assert.equal(products.findById(1)?.stock_count, (beforeStock ?? 0) - 1);
});

void test('mix price and stock conflicts block gateway before reservation', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-mix-conflict-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const carts = createCartRepository(db);
  const products = createProductRepository(db);
  const mixes = createPowderMixRepository(db);
  const powderizer = createPowderizerService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products,
    mixes,
  });
  const makeCart = () => {
    const cartId = crypto.randomUUID();
    carts.create(cartId);
    const mixId = powderizer.create(cartId, {
      components: [
        { productId: '1', percentage: 50 },
        { productId: '2', percentage: 50 },
      ],
      bagSizeGrams: 500,
      fineness: 'standard',
    });
    if (typeof mixId !== 'string') throw new Error('Expected mix');
    return cartId;
  };
  let calls = 0;
  const checkout = createCheckoutService({
    unitOfWork: createUnitOfWork(db),
    carts,
    products,
    mixes,
    promos: createPromoRepository(db),
    payments: createPaymentRepository(db),
    orders: createOrderRepository(db),
    mailbox: createMailboxRepository(db),
    gateway: {
      process: () => {
        calls += 1;
        return Promise.resolve({ status: 'success' as const });
      },
    },
    clock: { now: () => new Date('2026-07-14T10:00:00.000Z') },
  });
  const payment = (cartId: string): CheckoutParams => ({
    cartId,
    customerName: 'Conflict',
    customerEmail: 'conflict@example.test',
    shippingAddress: '1 Test St',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey: crypto.randomUUID(),
    userId: null,
  });
  const priceCart = makeCart();
  const secondMixId = powderizer.create(priceCart, {
    components: [
      { productId: '3', percentage: 50 },
      { productId: '4', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
  });
  if (typeof secondMixId !== 'string') throw new Error('Expected second mix');
  db.prepare('UPDATE products SET price_cents = price_cents + 1000 WHERE id IN (1, 3)').run();
  const requote = await checkout.process(payment(priceCart));
  assert.equal(requote.error, 'MIX_REQUOTE_REQUIRED');
  if (!requote.success && requote.error === 'MIX_REQUOTE_REQUIRED') {
    assert.equal(requote.mixes.length, 2);
  }
  assert.equal(calls, 0);
  const stockCart = makeCart();
  db.prepare('UPDATE products SET stock_count = 0 WHERE id = 1').run();
  assert.equal((await checkout.process(payment(stockCart))).error, 'MIX_STOCK_UNAVAILABLE');
  assert.equal(calls, 0);
});
