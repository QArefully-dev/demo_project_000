import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ReviewMutationResponse } from '@shop/contracts/reviews';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';

const body = 'This is a sufficiently detailed customer review body.';

function cookieHeader(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const value = response.headers['set-cookie'];
  const cookie = Array.isArray(value) ? value[0] : value;
  if (!cookie) throw new Error('Expected session cookie');
  return cookie.split(';', 1)[0]!;
}

function responseJson<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}

void test('review routes enforce public visibility, roles, ownership, moderation, and strict bodies', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-review-routes-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const app = await buildApp({
    db,
    resetBaseUrl: 'http://web.test',
    clock: { now: () => new Date('2026-07-18T12:00:00.000Z') },
  });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const login = async (email: string) =>
    cookieHeader(
      await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: 'Password123!' },
      }),
    );
  const alice = await login('alice@example.com');
  const bob = await login('bob@example.com');
  const admin = await login('admin@example.com');

  const initial = await app.inject('/api/products/1/reviews?sort=highest&page=1&pageSize=10');
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json(), {
    summary: {
      total: 0,
      averageRating: null,
      distribution: [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 0 },
        { rating: 5, count: 0 },
      ],
    },
    items: [],
    page: 1,
    pageSize: 10,
  });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/products/1/reviews',
        payload: { rating: 5, body },
      })
    ).statusCode,
    401,
  );
  assert.equal((await app.inject('/api/products/1/reviews/me')).statusCode, 401);

  const created = await app.inject({
    method: 'POST',
    url: '/api/products/1/reviews',
    headers: { cookie: alice },
    payload: { rating: 5, body: `  ${body}  ` },
  });
  assert.equal(created.statusCode, 201);
  const review = responseJson<ReviewMutationResponse>(created);
  assert.equal(review.body, body);
  assert.equal(review.status, 'published');
  assert.deepEqual(review.author, { displayName: 'Alice' });
  assert.equal('email' in review, false);

  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/products/1/reviews',
        headers: { cookie: alice },
        payload: { rating: 5, body },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/products/2/reviews',
        headers: { cookie: alice },
        payload: { rating: 5, body, verifiedPurchase: true },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/products/2/reviews',
        headers: { cookie: admin },
        payload: { rating: 5, body },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${review.id}`,
        headers: { cookie: bob },
        payload: { rating: 1, body },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/reviews/${review.id}`,
        headers: { cookie: bob },
      })
    ).statusCode,
    403,
  );

  assert.equal(
    (await app.inject({ method: 'POST', url: `/api/admin/reviews/${review.id}/hide` })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${review.id}/hide`,
        headers: { cookie: alice },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/reviews/999999/hide',
        headers: { cookie: admin },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${review.id}/hide`,
        headers: { cookie: admin },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${review.id}/hide`,
        headers: { cookie: admin },
      })
    ).statusCode,
    409,
  );
  const ownerHidden = await app.inject({
    url: '/api/products/1/reviews/me',
    headers: { cookie: alice },
  });
  assert.equal(ownerHidden.statusCode, 200);
  assert.equal(responseJson<ReviewMutationResponse>(ownerHidden).status, 'hidden');
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${review.id}/restore`,
        headers: { cookie: admin },
      })
    ).statusCode,
    200,
  );
});
