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
  removeItem,
  updateItem,
} from '../../src/features/cart/cartService.js';
import {
  createPaymentRepository,
  parsePersistedCheckoutQuote,
  type PersistedCheckoutQuote,
} from '../../src/features/payments/paymentRepository.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';
import { validatePromo } from '../../src/features/promos/promoService.js';
import { testPostalAddress } from './checkoutDepthFixtures.js';

const createdAt = '2026-07-14T10:00:00.000Z';

function quote(cartId: string, totalCents = 1200): PersistedCheckoutQuote {
  return {
    version: 7,
    cartId,
    customer: {
      name: 'Checkout test',
      email: 'checkout@example.test',
      deliveryAddress: testPostalAddress,
      shippingAddress: '1 Test Street, Testville, TS1 1TS, GB',
    },
    userId: null,
    promoCode: null,
    subtotalCents: totalCents,
    discountCents: 0,
    totalCents,
    lines: [],
    variantLines: [
      {
        productId: '1',
        variantId: 1,
        productName: 'Test product',
        variantLabel: '25 kg sack',
        unitPriceCents: totalCents,
        weightGrams: 25_000,
        deliveryClass: 'freight',
        quantity: 1,
        lineTotalCents: totalCents,
        consumptionClassification: 'non-food',
      },
    ],
    deliverySummary: {
      mode: 'freight',
      chargeCents: 0,
      weightGrams: 25_000,
      reason: 'A freight-class item requires freight delivery',
    },
    inventoryAllocations: [{ productId: '1', reservedQuantity: 1, backorderedQuantity: 0 }],
    billingEntity: {
      legalName: 'Test Buyer Ltd',
      registrationNumber: null,
      vatNumber: null,
      address: testPostalAddress,
    },
    deliverySlot: { date: '2026-07-20', window: 'am' },
    purchaseOrderReference: null,
    createdAt,
  };
}

void test('payment intent persistence, cart reservations, and promo reservations', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-payment-intent-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const carts = createCartRepository(db);
  const payments = createPaymentRepository(db);
  const promos = createPromoRepository(db);
  const firstCart = createCart(carts).cartId;
  const secondCart = createCart(carts).cartId;
  const thirdCart = createCart(carts).cartId;
  addItem(carts, firstCart, '1');
  addItem(carts, secondCart, '1');
  addItem(carts, thirdCart, '1');

  const reserve = (idempotencyKey: string, cartId: string) => {
    const payment = payments.reservePreGateway({
      idempotencyKey,
      fingerprint: `fingerprint-${idempotencyKey}`,
      card: { last4: '4242', brand: 'Visa' },
      createdAt,
    });
    if (payment.reserved) {
      assert.equal(
        payments.persistQuote({
          idempotencyKey,
          cartId,
          quote: quote(cartId),
          updatedAt: createdAt,
          reservationExpiresAt: '2026-07-14T10:15:00.000Z',
        }),
        true,
      );
    }
    return payment;
  };

  const first = reserve('intent-1', firstCart);
  assert.deepEqual(first, { reserved: true });
  assert.deepEqual(
    payments.reservePreGateway({
      idempotencyKey: 'unsafe-intent',
      fingerprint: 'safe-fingerprint',
      card: { last4: '4242', brand: 'Visa' },
      createdAt,
    }),
    { reserved: true },
  );
  assert.throws(
    () =>
      payments.persistQuote({
        idempotencyKey: 'unsafe-intent',
        cartId: firstCart,
        quote: {
          ...quote(firstCart),
          cardNumber: '4242424242424242',
          cardCvc: '123',
        } as unknown as PersistedCheckoutQuote,
        updatedAt: createdAt,
        reservationExpiresAt: '2026-07-14T10:15:00.000Z',
      }),
    /Invalid persisted checkout quote/,
  );
  assert.equal(payments.load('unsafe-intent')?.quoteJson, null);
  const stored = payments.load('intent-1');
  assert.equal(typeof stored?.id, 'number');
  assert.equal(Number.isSafeInteger(stored?.id), true);
  assert.equal(stored?.status, 'prepared');
  assert.equal(stored?.cartId, firstCart);
  assert.equal(stored?.quoteJson?.includes('4242424242424242'), false);
  assert.equal(stored?.quoteJson?.includes('123'), false);
  assert.equal(
    payments.transition({
      idempotencyKey: 'intent-1',
      expectedStatus: 'prepared',
      nextStatus: 'authorized_pending_finalize',
      gatewayReference: 'sim_intent-1',
      updatedAt: createdAt,
    }),
    true,
  );
  assert.equal(
    payments.transition({
      idempotencyKey: 'intent-1',
      expectedStatus: 'prepared',
      nextStatus: 'succeeded',
      updatedAt: createdAt,
    }),
    false,
  );

  assert.equal(carts.reserve(firstCart, 'intent-1', createdAt), true);
  assert.equal(carts.reserve(firstCart, 'intent-2', createdAt), false);
  assert.equal(addItem(carts, firstCart, '2'), 'CART_RESERVED');
  assert.equal(updateItem(carts, firstCart, '1', 2), 'CART_RESERVED');
  assert.equal(removeItem(carts, firstCart, '1'), 'CART_RESERVED');
  assert.equal(carts.releaseReservation('intent-1'), true);
  assert.notEqual(addItem(carts, firstCart, '2'), 'CART_RESERVED');

  reserve('intent-2', secondCart);
  db.prepare("UPDATE promo_codes SET max_redemptions = 1 WHERE code = 'SAVE10'").run();
  assert.equal(
    promos.reserve({
      code: 'SAVE10',
      userId: null,
      paymentIdempotencyKey: 'intent-2',
      createdAt,
    }),
    true,
  );
  assert.equal(promos.activeReservationCount('SAVE10'), 1);
  assert.equal(
    validatePromo(
      { code: 'SAVE10', cartId: secondCart, userId: null, now: new Date(createdAt) },
      { carts, promos },
    ).errorCode,
    'USAGE_LIMIT',
  );
  assert.equal(promos.releaseReservation('intent-2'), true);
  assert.notEqual(
    validatePromo(
      { code: 'SAVE10', cartId: secondCart, userId: null, now: new Date(createdAt) },
      { carts, promos },
    ).errorCode,
    'USAGE_LIMIT',
  );

  reserve('intent-3', thirdCart);
  assert.equal(
    promos.reserve({
      code: 'WELCOME5',
      userId: 1,
      paymentIdempotencyKey: 'intent-3',
      createdAt,
    }),
    true,
  );
  assert.equal(promos.activeReservationCountForUser('WELCOME5', 1), 1);
  assert.equal(
    validatePromo(
      { code: 'WELCOME5', cartId: thirdCart, userId: 1, now: new Date(createdAt) },
      { carts, promos },
    ).errorCode,
    'USAGE_LIMIT',
  );
  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders
          (customer_name, customer_email, shipping_address, subtotal_cents, discount_cents, total_cents)
         VALUES ('Promo test', 'promo@example.test', '1 Test Street', 1200, 500, 700)`,
      )
      .run().lastInsertRowid,
  );
  assert.equal(promos.commitReservation({ paymentIdempotencyKey: 'intent-3', orderId }), true);
  assert.equal(promos.activeReservationCountForUser('WELCOME5', 1), 0);
});

void test('persisted checkout quotes reject malformed and unknown-version data', () => {
  assert.throws(() => parsePersistedCheckoutQuote('{'), /Invalid persisted checkout quote/);
  assert.throws(
    () => parsePersistedCheckoutQuote(JSON.stringify({ ...quote('cart'), version: 2 })),
    /Invalid persisted checkout quote/,
  );
});
