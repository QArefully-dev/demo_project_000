import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import { SavedListDetail } from '@shop/contracts/saved-lists';
import {
  StandingOrder,
  StandingOrderRun,
  StandingOrderRunListResponse,
} from '@shop/contracts/standing-orders';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';

function cookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const value = response.headers['set-cookie'];
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) throw new Error('Expected session cookie');
  return header.split(';', 1)[0]!;
}

async function signup(app: Awaited<ReturnType<typeof buildApp>>, email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/signup',
    payload: { email, password: 'password-one', displayName: 'Buyer', country: 'UK' },
  });
  assert.equal(response.statusCode, 201, response.body);
  return cookie(response);
}

async function createSavedList(
  app: Awaited<ReturnType<typeof buildApp>>,
  authCookie: string,
  name: string,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/saved-lists',
    headers: { cookie: authCookie },
    payload: { name },
  });
  assert.equal(response.statusCode, 201, response.body);
  return Value.Parse(SavedListDetail, response.json()).listId;
}

void test('standing-order routes enforce auth, source ownership, schedule ownership, and run-now queueing', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-standing-order-routes-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({ db, resetBaseUrl: 'http://web.test' });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  for (const request of [
    { method: 'GET' as const, url: '/api/standing-orders' },
    {
      method: 'POST' as const,
      url: '/api/standing-orders',
      payload: { name: 'Schedule', source: { kind: 'saved_list', listId: '1' }, cadence: 'weekly' },
    },
    { method: 'PATCH' as const, url: '/api/standing-orders/1', payload: { name: 'Changed' } },
    { method: 'DELETE' as const, url: '/api/standing-orders/1' },
    { method: 'GET' as const, url: '/api/standing-orders/1/runs' },
    { method: 'POST' as const, url: '/api/standing-orders/1/run-now' },
  ])
    assert.equal((await app.inject(request)).statusCode, 401);

  const owner = await signup(app, 'standing-route-owner@example.test');
  const other = await signup(app, 'standing-route-other@example.test');
  const ownerList = await createSavedList(app, owner, 'Owner source');
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/standing-orders',
        headers: { cookie: other },
        payload: {
          name: 'Foreign source',
          source: { kind: 'saved_list', listId: ownerList },
          cadence: 'weekly',
        },
      })
    ).statusCode,
    404,
  );
  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/standing-orders',
    headers: { cookie: owner },
    payload: {
      name: 'Weekly restock',
      source: { kind: 'saved_list', listId: ownerList },
      cadence: 'weekly',
    },
  });
  assert.equal(createdResponse.statusCode, 201, createdResponse.body);
  const created = Value.Parse(StandingOrder, createdResponse.json());
  assert.equal(
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/standing-orders/${created.id}`,
        headers: { cookie: other },
        payload: { name: 'Foreign edit' },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/standing-orders/${created.id}/run-now`,
        headers: { cookie: other },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: 'GET',
        url: `/api/standing-orders/${created.id}/runs`,
        headers: { cookie: other },
      })
    ).statusCode,
    404,
  );
  const runNow = await app.inject({
    method: 'POST',
    url: `/api/standing-orders/${created.id}/run-now`,
    headers: { cookie: owner },
  });
  assert.equal(runNow.statusCode, 200, runNow.body);
  const pending = Value.Parse(StandingOrderRun, runNow.json());
  assert.equal(pending.status, 'pending');
  assert.equal(
    Number(
      db
        .prepare(
          `SELECT COUNT(*)
           FROM jobs j
           JOIN standing_order_runs r ON r.job_id = j.id
           WHERE r.standing_order_id=? AND j.kind='standing_order.run' AND j.status='pending'`,
        )
        .pluck()
        .get(Number(created.id)),
    ),
    1,
  );
  const runs = await app.inject({
    method: 'GET',
    url: `/api/standing-orders/${created.id}/runs`,
    headers: { cookie: owner },
  });
  assert.equal(runs.statusCode, 200, runs.body);
  assert.equal(Value.Parse(StandingOrderRunListResponse, runs.json())[0]!.id, pending.id);
});
