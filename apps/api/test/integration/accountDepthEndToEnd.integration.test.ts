import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS } from '@shop/contracts/delivery';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { calculateLeadTime } from '../../src/features/delivery/deliverySlotRules.js';

function sessionCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = response.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;
  if (!cookie) throw new Error('Expected a session cookie');
  return cookie.split(';', 1)[0];
}

function responseBody<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}

void test('account depth composes self-service, company approval, and deletion routes', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-account-depth-e2e-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const now = new Date('2026-07-29T12:00:00.000Z');
  const app = await buildApp({
    db,
    resetBaseUrl: 'http://web.example.test/',
    clock: { now: () => now },
  });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const login = async (email: string): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email, password: 'Password123!', country: 'UK' },
    });
    assert.equal(response.statusCode, 200);
    return sessionCookie(response);
  };
  const ownerCookie = await login('acme@example.com');
  const buyerFirstCookie = await login('buyer@example.com');
  const buyerCookie = await login('buyer@example.com');
  const approverCookie = await login('approver@example.com');
  const buyerHeaders = { cookie: buyerCookie };

  for (const request of [
    { method: 'GET', url: '/api/company', headers: { cookie: ownerCookie } },
    { method: 'GET', url: '/api/company/members', headers: { cookie: ownerCookie } },
    { method: 'GET', url: '/api/company/invites', headers: { cookie: ownerCookie } },
    { method: 'GET', url: '/api/approvals', headers: { cookie: approverCookie } },
    { method: 'GET', url: '/api/approvals/mine', headers: buyerHeaders },
    { method: 'GET', url: '/api/account/preferences', headers: buyerHeaders },
    { method: 'GET', url: '/api/account/sessions', headers: buyerHeaders },
    { method: 'GET', url: '/api/account/export', headers: buyerHeaders },
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 200, `${request.method} ${request.url}`);
  }

  const preferences = await app.inject({
    method: 'PATCH',
    url: '/api/account/preferences',
    headers: buyerHeaders,
    payload: { marketingEmail: true },
  });
  assert.equal(preferences.statusCode, 200);
  assert.equal(responseBody<{ marketingEmail: boolean }>(preferences).marketingEmail, true);

  const sessions = await app.inject({
    method: 'GET',
    url: '/api/account/sessions',
    headers: buyerHeaders,
  });
  const staleSession = responseBody<{ sessionId: string; isCurrent: boolean }[]>(sessions).find(
    (session) => !session.isCurrent,
  );
  assert.ok(staleSession);
  const revoke = await app.inject({
    method: 'DELETE',
    url: `/api/account/sessions/${staleSession.sessionId}`,
    headers: buyerHeaders,
  });
  assert.equal(revoke.statusCode, 200);
  assert.notEqual(buyerFirstCookie, buyerCookie);

  const product = db
    .prepare(
      `SELECT id, product_id, price_cents, stock_count, weight_grams, moq_sacks
       FROM product_variants
       WHERE active = 1 AND stock_count > 0
       ORDER BY price_cents DESC, id
       LIMIT 1`,
    )
    .get() as {
    id: number;
    product_id: number;
    price_cents: number;
    stock_count: number;
    weight_grams: number;
    moq_sacks: number;
  };
  const quantity = Math.max(
    Math.ceil((product.moq_sacks * SACK_WEIGHT_GRAMS) / product.weight_grams),
    Math.ceil(60_000 / product.price_cents),
  );
  assert.ok(quantity <= product.stock_count, 'seed product stock must support approval journey');
  const deliverySlot = {
    date: calculateLeadTime({
      deliverySummary: { mode: 'freight', weightGrams: FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS },
      now,
    }).earliestDate,
    window: 'am' as const,
  };
  const paymentPayload = (cartId: string, idempotencyKey: string) => ({
    cartId,
    customerName: 'Acme Buyer',
    customerEmail: 'buyer@example.com',
    deliveryDestination: {
      kind: 'adhoc' as const,
      address: { line1: '1 Buyer Road', city: 'Leeds', postcode: 'LS1 1AA', countryCode: 'GB' },
    },
    billingSelection: {
      kind: 'adhoc' as const,
      billingEntity: {
        legalName: 'Acme Buyer Ltd',
        address: { line1: '1 Buyer Road', city: 'Leeds', postcode: 'LS1 1AA', countryCode: 'GB' },
      },
    },
    deliverySlot,
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
    idempotencyKey,
  });
  const createCheckoutCart = async (): Promise<string> => {
    const created = await app.inject({ method: 'POST', url: '/api/cart', headers: buyerHeaders });
    assert.equal(created.statusCode, 201);
    const cartId = responseBody<{ cartId: string }>(created).cartId;
    const added = await app.inject({
      method: 'POST',
      url: `/api/cart/${cartId}/items`,
      headers: buyerHeaders,
      payload: { productId: String(product.product_id), variantId: product.id, quantity },
    });
    assert.equal(added.statusCode, 200);
    return cartId;
  };

  const approvedCart = await createCheckoutCart();
  const approvedPayload = paymentPayload(approvedCart, '33333333-3333-4333-8333-333333333333');
  const pending = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    headers: buyerHeaders,
    payload: approvedPayload,
  });
  assert.equal(pending.statusCode, 409);
  const pendingBody = responseBody<{ error: string; approvalRequestId?: string }>(pending);
  assert.equal(pendingBody.error, 'PENDING_APPROVAL', pending.body);
  assert.ok(pendingBody.approvalRequestId, pending.body);
  const approvalRequestId = pendingBody.approvalRequestId;
  const approve = await app.inject({
    method: 'POST',
    url: `/api/approvals/${approvalRequestId}/decision`,
    headers: { cookie: approverCookie },
    payload: { action: 'approve' },
  });
  assert.equal(approve.statusCode, 200, approve.body);
  const approvedRetry = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    headers: buyerHeaders,
    payload: approvedPayload,
  });
  assert.equal(approvedRetry.statusCode, 201);

  const rejectedCart = await createCheckoutCart();
  const rejectedPayload = paymentPayload(rejectedCart, '44444444-4444-4444-8444-444444444444');
  const rejectedPending = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    headers: buyerHeaders,
    payload: rejectedPayload,
  });
  assert.equal(rejectedPending.statusCode, 409);
  const rejectedRequestId = responseBody<{ approvalRequestId: string }>(
    rejectedPending,
  ).approvalRequestId;
  const reject = await app.inject({
    method: 'POST',
    url: `/api/approvals/${rejectedRequestId}/decision`,
    headers: { cookie: approverCookie },
    payload: { action: 'reject', reason: 'Budget exceeded' },
  });
  assert.equal(reject.statusCode, 200);
  const rejectedRetry = await app.inject({
    method: 'POST',
    url: '/api/payments/pay',
    headers: buyerHeaders,
    payload: rejectedPayload,
  });
  assert.equal(rejectedRetry.statusCode, 409);
  assert.equal(responseBody<{ error: string }>(rejectedRetry).error, 'APPROVAL_REJECTED');

  const deletionUserId = Number(
    db.prepare("SELECT id FROM users WHERE email = 'buyer@example.com'").pluck().get(),
  );
  const deletion = await app.inject({
    method: 'POST',
    url: '/api/account/delete',
    headers: buyerHeaders,
    payload: { currentPassword: 'Password123!' },
  });
  assert.equal(deletion.statusCode, 200);
  assert.deepEqual(responseBody(deletion), { success: true });
  assert.deepEqual(
    db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(Number(deletionUserId)),
    { email: `deleted-${deletionUserId}@tombstone.local`, display_name: 'Deleted User' },
  );
  assert.doesNotThrow(() => seedDatabase(db));
  assert.equal(
    db.prepare("SELECT id FROM users WHERE email = 'buyer@example.com'").get(),
    undefined,
  );
});
