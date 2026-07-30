import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import routes from '../src/routes/adminOrdersList.js';
import { OrderAdminError } from '../src/features/orders/orderAdminService.js';
const admin = { id: 1, email: 'admin@example.test', displayName: 'Admin', role: 'admin' as const };
const customer = { ...admin, role: 'customer' as const };
void test('admin order listing invokes service and maps invalid queries', async () => {
  let invoked = false;
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: {
        getUser: (sid: string) => (sid === 'admin' ? admin : sid === 'customer' ? customer : null),
      },
      orderAdmin: {
        listAdmin: () => {
          invoked = true;
          throw new OrderAdminError('INVALID_QUERY');
        },
      },
    } as never,
  });
  const unauthorized = await app.inject({ method: 'GET', url: '/api/admin/orders?page=1' });
  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/admin/orders?page=1',
    headers: { cookie: 'sid=customer' },
  });
  const mapped = await app.inject({
    method: 'GET',
    url: '/api/admin/orders?page=1',
    headers: { cookie: 'sid=admin' },
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(mapped.statusCode, 400);
  assert.equal(invoked, true);
  await app.close();
});

void test('admin order detail invokes projected detail service and maps missing orders', async () => {
  let invoked = false;
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: { getUser: (sid: string) => (sid === 'admin' ? admin : null) },
      orderAdmin: {
        getAdminDetail: () => {
          invoked = true;
          throw new OrderAdminError('ORDER_NOT_FOUND');
        },
      },
    } as never,
  });
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/orders/1',
    headers: { cookie: 'sid=admin' },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(invoked, true);
  await app.close();
});

void test('admin order detail serializes captured-payment refund capacity', async () => {
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: { getUser: (sid: string) => (sid === 'admin' ? admin : null) },
      orderAdmin: {
        getAdminDetail: () => ({
          id: '1',
          status: 'processing',
          version: 0,
          items: [],
          subtotalCents: 1000,
          discountCents: 0,
          totalCents: 1000,
          promoApplied: null,
          createdAt: '2026-07-29T10:00:00.000Z',
          shipments: [],
          events: [],
          canCancel: true,
          refundPayment: { paymentId: '3', remainingRefundableCents: 500 },
        }),
      },
    } as never,
  });
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/orders/1',
    headers: { cookie: 'sid=admin' },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json<{
    refundPayment: { paymentId: string; remainingRefundableCents: number };
  }>();
  assert.deepEqual(body.refundPayment, {
    paymentId: '3',
    remainingRefundableCents: 500,
  });
  await app.close();
});
