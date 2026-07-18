import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditEventValidationError, buildAuditEvent, type AuditEventInput } from './auditEvent.js';
import { AuditQueryError, normalizeAuditEventQuery } from './auditQuery.js';

const userContext = { actor: { type: 'user' as const, userId: 7 }, requestId: 'request-7' };

function expectEventError(action: () => unknown): void {
  assert.throws(action, AuditEventValidationError);
}

void test('builds action-specific metadata without caller-provided sensitive fields', () => {
  const event = buildAuditEvent({
    action: 'payment.succeeded',
    context: userContext,
    paymentId: 12,
    orderId: 45,
    amountCents: 1_999,
    cardNumber: '4111111111111111',
    cvc: '123',
    idempotencyKey: 'replay-key',
  } as AuditEventInput);

  assert.equal(event.entityType, 'payment');
  assert.equal(event.entityId, '12');
  assert.deepEqual(event.metadata, { orderId: 45, amountCents: 1_999 });
  assert.equal(event.metadataJson.includes('411111'), false);
  assert.equal(event.metadataJson.includes('cvc'), false);
  assert.equal(event.metadataJson.includes('replay'), false);
});

void test('enforces actor shape and request context rules', () => {
  expectEventError(() =>
    buildAuditEvent({
      action: 'cart.created',
      context: { actor: { type: 'anonymous', userId: 7 }, requestId: 'request' },
      cartId: 'cart-1',
    } as unknown as AuditEventInput),
  );
  expectEventError(() =>
    buildAuditEvent({
      action: 'cart.created',
      context: { actor: { type: 'user', userId: 0 }, requestId: 'request' },
      cartId: 'cart-1',
    } as unknown as AuditEventInput),
  );
  expectEventError(() =>
    buildAuditEvent({
      action: 'cart.created',
      context: { actor: { type: 'anonymous', userId: null }, requestId: null },
      cartId: 'cart-1',
    } as unknown as AuditEventInput),
  );
});

void test('rejects unknown actions and invalid scalar metadata values', () => {
  expectEventError(() =>
    buildAuditEvent({
      action: 'payment.refunded',
      context: userContext,
    } as unknown as AuditEventInput),
  );
  expectEventError(() =>
    buildAuditEvent({
      action: 'cart.product_added',
      context: userContext,
      cartId: 'cart-1',
      productId: Number.NaN,
      quantity: 1,
    } as unknown as AuditEventInput),
  );
  expectEventError(() =>
    buildAuditEvent({
      action: 'order.created',
      context: userContext,
      orderId: 1,
      totalCents: -1,
      itemCount: 1,
      mixItemCount: 0,
    } as unknown as AuditEventInput),
  );
});

void test('measures serialized metadata in UTF-8 bytes', () => {
  const hugeFailureCode = 'x'.repeat(2_050);
  expectEventError(() =>
    buildAuditEvent({
      action: 'payment.pre_gateway_failed',
      context: userContext,
      paymentId: 1,
      errorCode: hugeFailureCode,
    } as unknown as AuditEventInput),
  );
});

void test('normalizes UTC dates and pagination defaults', () => {
  assert.deepEqual(
    normalizeAuditEventQuery({ occurredFrom: '2026-02-03', occurredTo: '2026-02-04' }),
    {
      occurredFrom: '2026-02-03T00:00:00.000Z',
      occurredTo: '2026-02-04T23:59:59.999Z',
      page: 1,
      pageSize: 50,
    },
  );
});

void test('rejects malformed, inverted, and out-of-bounds audit query values', () => {
  for (const query of [
    { occurredFrom: '2026-02-30' },
    { occurredFrom: '2026-02-05', occurredTo: '2026-02-04' },
    { page: 0 },
    { pageSize: 101 },
    { actorUserId: Number.POSITIVE_INFINITY },
  ]) {
    assert.throws(() => normalizeAuditEventQuery(query), AuditQueryError);
  }
});
