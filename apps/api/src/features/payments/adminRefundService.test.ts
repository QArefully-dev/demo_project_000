import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase } from '../../db/index.js';
import { createUnitOfWork } from '../../db/unitOfWork.js';
import { createAuditRepository } from '../audit/auditRepository.js';
import { createAuditWriter } from '../audit/auditService.js';
import { createRefundGateway } from '../returns/refundGateway.js';
import { AdminRefundError, createAdminRefundService } from './adminRefundService.js';

function fixture(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-admin-refund-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const userId = Number(
    db
      .prepare(
        `INSERT INTO users (email, display_name, password_hash, password_salt, role)
         VALUES ('admin@example.test', 'Admin', 'hash', 'salt', 'admin')`,
      )
      .run().lastInsertRowid,
  );
  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders
          (customer_name, customer_email, shipping_address, subtotal_cents, discount_cents,
           total_cents, user_id, created_at, lifecycle_status, version)
         VALUES ('Buyer', 'buyer@example.test', 'address', 1000, 0, 1000, ?, ?, 'processing', 0)`,
      )
      .run(userId, '2026-07-29T10:00:00.000Z').lastInsertRowid,
  );
  const paymentId = Number(
    db
      .prepare(
        `INSERT INTO payments
          (order_id, idempotency_key, request_fingerprint, status, amount_cents, card_last4,
           card_brand, created_at)
         VALUES (?, 'captured-payment', 'fingerprint', 'succeeded', 1000, '4242', 'visa', ?)`,
      )
      .run(orderId, '2026-07-29T10:00:00.000Z').lastInsertRowid,
  );
  // Existing returns-flow refund consumes 300p of the same captured payment.
  const returnId = Number(
    db
      .prepare(
        `INSERT INTO return_requests
          (order_id, user_id, status, reason, version, requested_at, approved_at, received_at, refunded_at)
         VALUES (?, ?, 'refunded', 'other', 3, ?, ?, ?, ?)`,
      )
      .run(
        orderId,
        userId,
        '2026-07-01T00:00:00.000Z',
        '2026-07-02T00:00:00.000Z',
        '2026-07-03T00:00:00.000Z',
        '2026-07-04T00:00:00.000Z',
      ).lastInsertRowid,
  );
  db.prepare(
    `INSERT INTO refunds
      (return_request_id, payment_id, idempotency_key, gross_subtotal_cents, discount_share_cents,
       net_refund_cents, processor, simulated_reference, created_at)
     VALUES (?, ?, 'return-refund', 300, 0, 300, 'simulated', 'return-ref', ?)`,
  ).run(returnId, paymentId, '2026-07-04T00:00:00.000Z');
  const service = createAdminRefundService({
    db,
    unitOfWork: createUnitOfWork(db),
    audit: createAuditWriter({
      repository: createAuditRepository(db),
      clock: { now: () => new Date('2026-07-29T10:00:00.000Z') },
    }),
    clock: { now: () => new Date('2026-07-29T10:00:00.000Z') },
    refundGateway: createRefundGateway(),
  });
  return {
    db,
    service,
    paymentId,
    orderId,
    context: { actor: { type: 'user' as const, userId }, requestId: 'admin-refund-test' },
  };
}

void test('admin refund shares return cap, replays idempotently, and audits once', (t) => {
  const { db, service, paymentId, orderId, context } = fixture(t);
  const request = {
    paymentId,
    orderId,
    amountCents: 700,
    reason: 'Commercial goodwill',
    idempotencyKey: 'admin-refund-replay-key',
    context,
  };
  const refunded = service.refund(request);
  assert.equal(refunded.amountCents, 700);
  assert.equal(service.refund(request).id, refunded.id);
  assert.equal(
    (
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'payment.admin_refunded'",
        )
        .get() as { count: number }
    ).count,
    1,
  );
  assert.throws(
    () => service.refund({ ...request, amountCents: 1, idempotencyKey: 'refund-over-cap' }),
    AdminRefundError,
  );
});
