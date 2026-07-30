import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import routes from '../src/routes/adminProducts.js';
import { ProductAdminError } from '../src/features/catalog/productAdminService.js';
const admin = { id: 1, email: 'admin@example.test', displayName: 'Admin', role: 'admin' as const };
const customer = { ...admin, role: 'customer' as const };
void test('admin product write invokes service and maps duplicate slugs', async () => {
  let invoked = false;
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: {
        getUser: (sid: string) => (sid === 'admin' ? admin : sid === 'customer' ? customer : null),
      },
      productAdmin: {
        create: () => {
          invoked = true;
          throw new ProductAdminError('DUPLICATE_SLUG');
        },
      },
    } as never,
  });
  const payload = {
    name: 'Product',
    description: 'Description',
    priceCents: 100,
    category: 'Drinks',
    stockCount: 0,
    slug: 'product',
    consumptionClassification: 'food',
    mixingGroup: 'food-grade',
  };
  const unauthorized = await app.inject({ method: 'POST', url: '/api/admin/products', payload });
  const forbidden = await app.inject({
    method: 'POST',
    url: '/api/admin/products',
    headers: { cookie: 'sid=customer' },
    payload,
  });
  const mapped = await app.inject({
    method: 'POST',
    url: '/api/admin/products',
    headers: { cookie: 'sid=admin' },
    payload,
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(mapped.statusCode, 409);
  assert.equal(invoked, true);
  await app.close();
});
