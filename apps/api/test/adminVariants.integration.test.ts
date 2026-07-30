import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import routes from '../src/routes/adminVariants.js';
import { VariantAdminError } from '../src/features/catalog/variantAdminService.js';
const admin = { id: 1, email: 'admin@example.test', displayName: 'Admin', role: 'admin' as const };
const customer = { ...admin, role: 'customer' as const };
void test('admin variant write invokes service and maps missing variants', async () => {
  let invoked = false;
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: {
        getUser: (sid: string) => (sid === 'admin' ? admin : sid === 'customer' ? customer : null),
      },
      variantAdmin: {
        update: () => {
          invoked = true;
          throw new VariantAdminError('VARIANT_NOT_FOUND', 'missing');
        },
      },
    } as never,
  });
  const payload = { label: 'Updated' };
  const unauthorized = await app.inject({ method: 'PATCH', url: '/api/admin/variants/1', payload });
  const forbidden = await app.inject({
    method: 'PATCH',
    url: '/api/admin/variants/1',
    headers: { cookie: 'sid=customer' },
    payload,
  });
  const mapped = await app.inject({
    method: 'PATCH',
    url: '/api/admin/variants/1',
    headers: { cookie: 'sid=admin' },
    payload,
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(mapped.statusCode, 404);
  assert.equal(invoked, true);
  await app.close();
});
