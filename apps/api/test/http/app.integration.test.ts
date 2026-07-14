import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';

function cookieHeader(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const value = response.headers['set-cookie'];
  const cookie = Array.isArray(value) ? value[0] : value;
  if (!cookie) throw new Error('Expected session cookie');
  return cookie.split(';', 1)[0]!;
}

void test('app factory injects isolated databases without starting a server', async (t) => {
  const firstDir = mkdtempSync(join(tmpdir(), 'shop-app-first-'));
  const secondDir = mkdtempSync(join(tmpdir(), 'shop-app-second-'));
  const firstDb = openDatabase({ path: join(firstDir, 'shop.db') });
  const secondDb = openDatabase({ path: join(secondDir, 'shop.db') });
  seedDatabase(firstDb);
  seedDatabase(secondDb);

  const app = await buildApp({ db: firstDb, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(firstDb);
    closeDatabase(secondDb);
    rmSync(firstDir, { recursive: true, force: true });
    rmSync(secondDir, { recursive: true, force: true });
  });

  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });

  const product = await app.inject({ method: 'GET', url: '/api/products/1' });
  assert.equal(product.statusCode, 200);
  const productBody: unknown = product.json();
  if (typeof productBody !== 'object' || productBody === null || !('id' in productBody)) {
    assert.fail('Product response must contain an ID');
  }
  assert.equal(productBody.id, '1');
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/categories' })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/products/not-a-number' })).statusCode,
    400,
  );

  const invalidCart = await app.inject({
    method: 'POST',
    url: '/api/cart/not-a-cart/items',
    payload: {},
  });
  assert.equal(invalidCart.statusCode, 400, 'route schema validation uses global error mapping');
  const created = await app.inject({ method: 'POST', url: '/api/cart' });
  assert.equal(created.statusCode, 201);
  const createdBody: { cartId: string } = created.json();
  const added = await app.inject({
    method: 'POST',
    url: `/api/cart/${createdBody.cartId}/items`,
    payload: { productId: '1' },
  });
  assert.equal(added.statusCode, 200);
  const addedBody: { totalItems: number } = added.json();
  assert.equal(addedBody.totalItems, 1);
  assert.equal((await app.inject({ method: 'GET', url: '/api/favourites' })).statusCode, 401);

  const signup = await app.inject({
    method: 'POST',
    url: '/signup',
    payload: { email: 'http@example.test', password: 'password-one', displayName: 'HTTP User' },
  });
  assert.equal(signup.statusCode, 201);
  const cookie = cookieHeader(signup);
  const authenticated = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
  assert.equal(authenticated.statusCode, 200);
  const authenticatedBody: { email: string } = authenticated.json();
  assert.equal(authenticatedBody.email, 'http@example.test');
  const favourite = await app.inject({
    method: 'POST',
    url: '/api/favourites',
    headers: { cookie },
    payload: { productId: '1' },
  });
  assert.equal(favourite.statusCode, 200);
  assert.deepEqual(favourite.json(), { success: true });
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/favourites', headers: { cookie } })).statusCode,
    200,
  );

  const checkoutCart = await app.inject({ method: 'POST', url: '/api/cart' });
  const checkoutCartBody: { cartId: string } = checkoutCart.json();
  const checkoutCartId = checkoutCartBody.cartId;
  for (const productId of ['1', '2', '3', '4', '5']) {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/cart/${checkoutCartId}/items`,
          payload: { productId },
        })
      ).statusCode,
      200,
    );
  }
  const promo = await app.inject({
    method: 'POST',
    url: '/api/promo/validate',
    headers: { cookie },
    payload: { cartId: checkoutCartId, promoCode: 'SAVE10' },
  });
  assert.equal(promo.statusCode, 200);
  const promoBody: { valid: boolean; promoCode?: { code: string } } = promo.json();
  assert.deepEqual(promoBody.promoCode, {
    code: 'SAVE10',
    discountPercent: 10,
    minItemCount: 5,
    kind: 'percent',
  });

  const payment = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    headers: { cookie },
    payload: {
      cartId: checkoutCartId,
      promoCode: 'SAVE10',
      customerName: 'HTTP User',
      customerEmail: 'http@example.test',
      shippingAddress: '1 Test Street',
      cardNumber: '4242 4242 4242 4242',
      cardExpiry: '12/99',
      cardCvc: '123',
      idempotencyKey: '10f4fa81-4d9e-4b6c-b2ee-575c0b07b640',
    },
  });
  assert.equal(payment.statusCode, 201);
  const order: { id: string; promoApplied: string | null; items: unknown[] } = payment.json();
  assert.equal(order.promoApplied, 'SAVE10');
  assert.equal(order.items.length, 5);
  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/orders/${order.id}`, headers: { cookie } }))
      .statusCode,
    200,
  );

  const declineCart = await app.inject({ method: 'POST', url: '/api/cart' });
  const declineCartBody: { cartId: string } = declineCart.json();
  const declineCartId = declineCartBody.cartId;
  await app.inject({
    method: 'POST',
    url: `/api/cart/${declineCartId}/items`,
    payload: { productId: '1' },
  });
  const declined = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    payload: {
      cartId: declineCartId,
      customerName: 'Declined User',
      customerEmail: 'declined@example.test',
      shippingAddress: '2 Test Street',
      cardNumber: '4000 0000 0000 0002',
      cardExpiry: '12/99',
      cardCvc: '123',
      idempotencyKey: '32760c6e-4b82-44d4-8e06-6bdfbf9adcf7',
    },
  });
  assert.equal(declined.statusCode, 402);
  assert.deepEqual(declined.json(), { error: 'Payment failed', failureReason: 'CARD_DECLINED' });
  assert.equal((await app.inject({ method: 'GET', url: '/missing' })).statusCode, 404);
  assert.equal(firstDb.open, true);
  assert.equal(secondDb.open, true);
});
