import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createReviewRepository } from '../../src/features/reviews/reviewRepository.js';
import {
  createReviewService,
  ReviewServiceError,
} from '../../src/features/reviews/reviewService.js';

const clock = { now: () => new Date('2026-07-18T12:00:00.000Z') };
const context = { actor: { type: 'user' as const, userId: 1 }, requestId: 'review-test-request' };
const body = 'This is a sufficiently detailed review body.';

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'shop-reviews-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const repository = createReviewRepository(db);
  const auditRepository = createAuditRepository(db);
  const service = createReviewService({
    repository,
    unitOfWork: createUnitOfWork(db),
    audit: createAuditWriter({ repository: auditRepository, clock }),
    clock,
  });
  return { directory, db, repository, service };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseMetadataJson(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) {
    throw new Error('Expected audit metadata to be a JSON object');
  }
  return parsed;
}

void test('published list and aggregate share visibility while owner can read hidden review', (t) => {
  const { directory, db, service } = setup();
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const first = service.create(1, 1, { rating: 5, body }, context);
  service.create(
    2,
    1,
    { rating: 1, body: `${body} More detail.` },
    {
      actor: { type: 'user', userId: 2 },
      requestId: 'review-test-request-2',
    },
  );
  service.hide(Number(first.id), {
    actor: { type: 'user', userId: 3 },
    requestId: 'admin-request',
  });

  for (const sort of ['newest', 'oldest', 'highest', 'lowest'] as const) {
    const page = service.listProduct(1, { sort, page: 1, pageSize: 10 });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.rating, 1);
    assert.equal(page.summary.total, 1);
    assert.equal(page.summary.averageRating, 1);
    assert.deepEqual(page.summary.distribution, [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 0 },
      { rating: 5, count: 0 },
    ]);
  }
  assert.equal(service.findOwned(1, 1)?.status, 'hidden');
});

void test('verified purchase requires reviewer-owned order, matching line, and succeeded payment', (t) => {
  const { directory, db, service } = setup();
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const reviewOne = service.create(1, 1, { rating: 4, body }, context);
  service.create(
    2,
    2,
    { rating: 3, body: `${body} Another review.` },
    {
      actor: { type: 'user', userId: 2 },
      requestId: 'review-test-request-2',
    },
  );

  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders (customer_name, customer_email, shipping_address, subtotal_cents, discount_cents, total_cents, user_id)
         VALUES ('Alice', 'alice@example.com', 'One Street', 100, 0, 100, 1)`,
      )
      .run().lastInsertRowid,
  );
  db.prepare(
    `INSERT INTO order_line_items (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
     VALUES (?, 1, 'Exact product', 100, 1, 100)`,
  ).run(orderId);
  db.prepare(
    `INSERT INTO payments (order_id, idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand)
     VALUES (?, 'review-payment', 'review-payment', 'succeeded', 100, '4242', 'visa')`,
  ).run(orderId);

  const pageOne = service.listProduct(1, {});
  const pageTwo = service.listProduct(2, {});
  assert.equal(pageOne.items.find((item) => item.id === reviewOne.id)?.verifiedPurchase, true);
  assert.equal(pageTwo.items[0]?.verifiedPurchase, false);
});

void test('mutations enforce owner/unique/transition rules and audit failure rolls back', (t) => {
  const { directory, db, repository, service } = setup();
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const review = service.create(1, 1, { rating: 2, body }, context);
  assert.throws(
    () => service.create(1, 1, { rating: 2, body }, context),
    (error: unknown) => error instanceof ReviewServiceError && error.code === 'DUPLICATE',
  );
  assert.throws(
    () =>
      service.update(
        2,
        Number(review.id),
        { rating: 5, body },
        { actor: { type: 'user', userId: 2 }, requestId: 'two' },
      ),
    (error: unknown) => error instanceof ReviewServiceError && error.code === 'FORBIDDEN',
  );
  assert.equal(
    repository.update(Number(review.id), 2, { rating: 5, body, now: clock.now().toISOString() }),
    undefined,
  );
  assert.equal(repository.delete(Number(review.id), 2), false);
  assert.equal(repository.findById(Number(review.id))?.rating, 2);
  const failing = createReviewService({
    repository,
    unitOfWork: createUnitOfWork(db),
    audit: {
      append: () => {
        throw new Error('audit unavailable');
      },
    },
    clock,
  });
  assert.throws(() =>
    failing.update(1, Number(review.id), { rating: 5, body: `${body} Changed.` }, context),
  );
  assert.equal(repository.findById(Number(review.id))?.rating, 2);
  assert.throws(() => failing.delete(1, Number(review.id), context));
  assert.ok(repository.findById(Number(review.id)));
  assert.throws(() => failing.hide(Number(review.id), context));
  assert.equal(repository.findById(Number(review.id))?.status, 'published');
  assert.equal(
    service.hide(Number(review.id), { actor: { type: 'user', userId: 3 }, requestId: 'admin' })
      .status,
    'hidden',
  );
  assert.throws(
    () =>
      service.hide(Number(review.id), { actor: { type: 'user', userId: 3 }, requestId: 'admin-2' }),
    (error: unknown) => error instanceof ReviewServiceError && error.code === 'INVALID_TRANSITION',
  );
  assert.throws(() => failing.restore(Number(review.id), context));
  assert.equal(repository.findById(Number(review.id))?.status, 'hidden');
});

void test('review lifecycle writes exact body-free audit facts', (t) => {
  const { directory, db, service } = setup();
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const review = service.create(1, 1, { rating: 2, body }, context);
  service.update(1, Number(review.id), { rating: 5, body: `${body} Updated.` }, context);
  service.hide(Number(review.id), context);
  service.restore(Number(review.id), context);
  service.delete(1, Number(review.id), context);

  const rows = db
    .prepare(
      `SELECT action, entity_type, entity_id, actor_type, actor_user_id, request_id, metadata_json
       FROM audit_events ORDER BY id ASC`,
    )
    .all() as Array<{
    action: string;
    entity_type: string;
    entity_id: string;
    actor_type: string;
    actor_user_id: number;
    request_id: string;
    metadata_json: string;
  }>;
  assert.deepEqual(
    rows.map(({ metadata_json, ...row }) => ({
      ...row,
      metadata: parseMetadataJson(metadata_json),
    })),
    [
      {
        action: 'review.created',
        entity_type: 'review',
        entity_id: review.id,
        actor_type: 'user',
        actor_user_id: 1,
        request_id: 'review-test-request',
        metadata: { productId: 1, rating: 2 },
      },
      {
        action: 'review.updated',
        entity_type: 'review',
        entity_id: review.id,
        actor_type: 'user',
        actor_user_id: 1,
        request_id: 'review-test-request',
        metadata: { productId: 1, rating: 5 },
      },
      ...(['review.hidden', 'review.restored', 'review.deleted'] as const).map((action) => ({
        action,
        entity_type: 'review',
        entity_id: review.id,
        actor_type: 'user',
        actor_user_id: 1,
        request_id: 'review-test-request',
        metadata: { productId: 1 },
      })),
    ],
  );
});
