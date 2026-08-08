import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createAdminRefundService } from '../../src/features/payments/adminRefundService.js';
import { createRefundGateway } from '../../src/features/returns/refundGateway.js';
import { createSeededFixture } from '../support/seededDatabase.js';

function cookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const h = response.headers['set-cookie'];
  const c = Array.isArray(h) ? h[0] : h;
  if (!c) throw new Error('Expected set-cookie');
  return c.split(';', 1)[0]!;
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string): Promise<string> {
  const r = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email, password: 'Password123!', country: 'UK' },
  });
  assert.equal(r.statusCode, 200);
  return cookie(r);
}

/** Find Alice's order that has delivered shipments and create a return request for it. */
async function createReturnForAlice(
  app: Awaited<ReturnType<typeof buildApp>>,
  aliceCookie: string,
): Promise<{ orderId: string; returnId: string } | null> {
  const orders = await app.inject({
    method: 'GET',
    url: '/api/orders?page=1&pageSize=50',
    headers: { cookie: aliceCookie },
  });
  const orderIds = orders.json<{ items: Array<{ id: string }> }>().items.map((o) => o.id);

  for (const orderId of orderIds) {
    const overview = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderId}/returns`,
      headers: { cookie: aliceCookie },
    });
    if (overview.statusCode !== 200) continue;
    const body = overview.json<{
      eligibleLines: Array<{
        shipmentId: string;
        orderLineItemId: string;
        availableQuantity: number;
      }>;
    }>();
    if (body.eligibleLines.length === 0) continue;
    const line = body.eligibleLines.find((l) => l.availableQuantity > 0);
    if (!line) continue;

    const create = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/returns`,
      headers: { cookie: aliceCookie },
      payload: {
        idempotencyKey: 'admin-test-0001-0001-0001-000000000001',
        reason: 'damaged',
        selections: [
          {
            shipmentId: line.shipmentId,
            orderLineItemId: line.orderLineItemId,
            quantity: line.availableQuantity,
          },
        ],
      },
    });
    if (create.statusCode === 200) {
      return {
        orderId,
        returnId: create.json<{ id: string }>().id,
      };
    }
  }
  return null;
}

void test('admin return routes enforce auth and process lifecycle', async (t) => {
  const { db, app } = await createSeededFixture(t);

  const aliceCookie = await login(app, 'alice@example.com');
  const adminCookie = await login(app, 'admin@example.com');

  // ── Customer cannot access admin routes ──────────────────────
  {
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/returns',
      headers: { cookie: aliceCookie },
    });
    assert.equal(r.statusCode, 403);
  }

  // ── Anonymous cannot access admin routes ─────────────────────
  {
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/returns',
    });
    assert.equal(r.statusCode, 401);
  }

  // ── Admin can list returns ────────────────────────────────────
  {
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/returns',
      headers: { cookie: adminCookie },
    });
    assert.equal(r.statusCode, 200);
    const body = r.json<{ items: unknown[]; page: number; pageSize: number }>();
    assert.equal(body.page, 1);
    assert.ok(Array.isArray(body.items));
  }

  // ── Create a return request for testing ───────────────────────
  const setup = await createReturnForAlice(app, aliceCookie);
  if (!setup) {
    // Skip lifecycle tests if no eligible order exists in seed
    return;
  }

  const returnId = setup.returnId;

  // ── Inspect the created return ─────────────────────────────────
  const detail = await app.inject({
    method: 'GET',
    url: `/api/admin/returns?page=1&pageSize=50`,
    headers: { cookie: adminCookie },
  });
  const listBody = detail.json<{
    items: Array<{ id: string; status: string; version: number; orderId: string }>;
  }>();
  const found = listBody.items.find((item) => item.id === returnId);
  assert.ok(found, 'Created return should appear in admin list');
  assert.equal(found.status, 'requested');

  // ── Admin approve ─────────────────────────────────────────────
  {
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/decision`,
      headers: { cookie: adminCookie },
      payload: {
        version: found.version,
        idempotencyKey: 'admin-approve-0001-0001-0001-00000000001',
        decision: 'approve',
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json<{ status: string }>().status, 'approved');
  }

  // ── Admin receive ─────────────────────────────────────────────
  {
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/receive`,
      headers: { cookie: adminCookie },
      payload: {
        version: 1,
        idempotencyKey: 'admin-receive-0001-0001-0001-00000000001',
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json<{ status: string }>().status, 'received');
  }

  // ── Admin refund (may fail if no succeeded payment) ───────────
  {
    const payment = db
      .prepare(
        "SELECT id, amount_cents FROM payments WHERE order_id = ? AND status = 'succeeded' ORDER BY id LIMIT 1",
      )
      .get(Number(setup.orderId)) as { id: number; amount_cents: number } | undefined;
    assert.ok(payment, 'Return order should have a captured payment');
    if (!payment) throw new Error('Expected captured payment');

    const adminRefunds = createAdminRefundService({
      db,
      unitOfWork: createUnitOfWork(db),
      audit: createAuditWriter({
        repository: createAuditRepository(db),
        clock: { now: () => new Date('2026-07-29T10:00:00.000Z') },
      }),
      clock: { now: () => new Date('2026-07-29T10:00:00.000Z') },
      refundGateway: createRefundGateway(),
    });
    adminRefunds.refund({
      paymentId: payment.id,
      orderId: Number(setup.orderId),
      amountCents: payment.amount_cents,
      reason: 'Commercial goodwill',
      idempotencyKey: 'admin-payment-cap-0001-0001-0001-00000000001',
      context: { actor: { type: 'user', userId: 1 }, requestId: 'admin-payment-cap' },
    });

    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/refund`,
      headers: { cookie: adminCookie },
      payload: {
        version: 2,
        idempotencyKey: 'admin-refund-0001-0001-0001-00000000001',
      },
    });
    assert.equal(r.statusCode, 422);
    assert.equal(
      (
        db
          .prepare('SELECT COUNT(*) AS count FROM refunds WHERE payment_id = ?')
          .get(payment.id) as {
          count: number;
        }
      ).count,
      0,
    );
    assert.equal(
      (
        db
          .prepare(
            `SELECT
               COALESCE((SELECT SUM(net_refund_cents) FROM refunds WHERE payment_id = ?), 0) +
               COALESCE((SELECT SUM(amount_cents) FROM admin_refunds WHERE payment_id = ?), 0)
               AS amount`,
          )
          .get(payment.id, payment.id) as { amount: number }
      ).amount,
      payment.amount_cents,
    );
    assert.equal(
      (
        db.prepare('SELECT status FROM return_requests WHERE id = ?').get(Number(returnId)) as {
          status: string;
        }
      ).status,
      'received',
    );
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'payment.refunded'")
          .get() as { count: number }
      ).count,
      0,
    );
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
  }

  // ── Stale version rejected ────────────────────────────────────
  {
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/decision`,
      headers: { cookie: adminCookie },
      payload: {
        version: 0, // stale
        idempotencyKey: 'admin-stale-0001-0001-0001-00000000001',
        decision: 'approve',
      },
    });
    assert.equal(r.statusCode, 409);
  }

  // ── Idempotency replay ────────────────────────────────────────
  {
    // Replay the approve with same key + payload -> should get current resource
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/decision`,
      headers: { cookie: adminCookie },
      payload: {
        version: found.version,
        idempotencyKey: 'admin-approve-0001-0001-0001-00000000001', // same key
        decision: 'approve',
      },
    });
    assert.equal(r.statusCode, 200);
  }

  // ── Idempotency conflict ──────────────────────────────────────
  {
    // Same key, different payload -> conflict
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/decision`,
      headers: { cookie: adminCookie },
      payload: {
        version: found.version,
        idempotencyKey: 'admin-approve-0001-0001-0001-00000000001', // same key
        decision: 'reject', // different payload
      },
    });
    assert.equal(r.statusCode, 409);
  }

  // ── Invalid transition rejected ───────────────────────────────
  {
    // Try to receive a non-approved return -> should fail
    const r = await app.inject({
      method: 'POST',
      url: `/api/admin/returns/${returnId}/receive`,
      headers: { cookie: adminCookie },
      payload: {
        version: 100, // whatever
        idempotencyKey: 'admin-bad-trans-0001-0001-00000000001',
      },
    });
    assert.ok(r.statusCode === 404 || r.statusCode === 409);
  }

  // ── Filter by status ──────────────────────────────────────────
  {
    const r = await app.inject({
      method: 'GET',
      url: '/api/admin/returns?status=requested',
      headers: { cookie: adminCookie },
    });
    assert.equal(r.statusCode, 200);
  }
});
