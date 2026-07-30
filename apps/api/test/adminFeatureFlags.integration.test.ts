import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import routes from '../src/routes/adminFeatureFlags.js';
import { FeatureFlagServiceError } from '../src/features/featureFlags/featureFlagService.js';
const admin = { id: 1, email: 'admin@example.test', displayName: 'Admin', role: 'admin' as const };
const customer = { ...admin, role: 'customer' as const };
const payload = { key: 'demo.flag', description: 'Demo feature', enabled: true };
void test('admin flag command invokes service and maps duplicates', async () => {
  let invoked = false;
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(routes, {
    services: {
      sessions: {
        getUser: (sid: string) => (sid === 'admin' ? admin : sid === 'customer' ? customer : null),
      },
      featureFlags: {
        create: () => {
          invoked = true;
          throw new FeatureFlagServiceError('DUPLICATE', 'duplicate');
        },
      },
    } as never,
  });
  const unauthorized = await app.inject({
    method: 'POST',
    url: '/api/admin/feature-flags',
    payload,
  });
  const forbidden = await app.inject({
    method: 'POST',
    url: '/api/admin/feature-flags',
    headers: { cookie: 'sid=customer' },
    payload,
  });
  const mapped = await app.inject({
    method: 'POST',
    url: '/api/admin/feature-flags',
    headers: { cookie: 'sid=admin' },
    payload,
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(mapped.statusCode, 409);
  assert.equal(invoked, true);
  await app.close();
});
