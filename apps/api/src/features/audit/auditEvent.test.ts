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

void test('builds a sanitized bundle-added audit event', () => {
  const event = buildAuditEvent({
    action: 'cart.bundle_added',
    context: userContext,
    cartId: 'cart-1',
    bundleId: 4,
    componentCount: 3,
    quantity: 3,
    componentNames: ['Powdered Tuesday'],
    totalCents: 9_999,
  } as AuditEventInput);

  assert.equal(event.entityType, 'cart');
  assert.equal(event.entityId, 'cart-1');
  assert.deepEqual(event.metadata, { bundleId: 4, componentCount: 3, quantity: 3 });
  assert.equal(event.metadataJson.includes('Powdered Tuesday'), false);
  assert.equal(event.metadataJson.includes('9999'), false);
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

void test('builds body-free, scalar-only review audit metadata', () => {
  const created = buildAuditEvent({
    action: 'review.created',
    context: userContext,
    reviewId: 91,
    productId: 12,
    rating: 5,
    body: 'Sensitive review body that must never enter audit metadata.',
    authorEmail: 'customer@example.test',
  } as AuditEventInput);
  const hidden = buildAuditEvent({
    action: 'review.hidden',
    context: { actor: { type: 'user', userId: 1 }, requestId: 'admin-request' },
    reviewId: 91,
    productId: 12,
    bodyExcerpt: 'not retained',
  } as AuditEventInput);

  assert.equal(created.entityType, 'review');
  assert.equal(created.entityId, '91');
  assert.deepEqual(created.metadata, { productId: 12, rating: 5 });
  assert.equal(created.metadataJson.includes('Sensitive review body'), false);
  assert.equal(created.metadataJson.includes('customer@example.test'), false);
  assert.deepEqual(hidden.metadata, { productId: 12 });
  assert.equal(hidden.metadataJson.includes('bodyExcerpt'), false);
});

void test('builds lifecycle audit rows with shipment identity and allowlisted metadata', () => {
  const transitioned = buildAuditEvent({
    action: 'shipment.transitioned',
    context: userContext,
    shipmentId: 11,
    orderId: 7,
    status: 'delivered',
    trackingReference: 'not-retained',
  } as AuditEventInput);
  const packed = buildAuditEvent({
    action: 'order.shipment_packed',
    context: userContext,
    orderId: 7,
    shipmentCount: 2,
    allocation: [{ lineId: '1' }],
  } as AuditEventInput);
  assert.deepEqual(
    {
      entityType: transitioned.entityType,
      entityId: transitioned.entityId,
      metadata: transitioned.metadata,
    },
    { entityType: 'shipment', entityId: '11', metadata: { orderId: 7, status: 'delivered' } },
  );
  assert.deepEqual(packed.metadata, { shipmentCount: 2 });
  assert.equal(transitioned.metadataJson.includes('not-retained'), false);
  assert.equal(packed.metadataJson.includes('allocation'), false);
});

void test('rejects invalid review audit scalars', () => {
  for (const input of [
    { action: 'review.created', reviewId: 0, productId: 12, rating: 5 },
    { action: 'review.updated', reviewId: 91, productId: 0, rating: 5 },
    { action: 'review.created', reviewId: 91, productId: 12, rating: 6 },
    { action: 'review.updated', reviewId: 91, productId: 12, rating: 1.5 },
  ]) {
    expectEventError(() =>
      buildAuditEvent({ context: userContext, ...input } as unknown as AuditEventInput),
    );
  }
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

void test('accepts review audit actions and entity type filters', () => {
  assert.deepEqual(normalizeAuditEventQuery({ action: 'review.restored', entityType: 'review' }), {
    action: 'review.restored',
    entityType: 'review',
    page: 1,
    pageSize: 50,
  });
});

void test('accepts shipment audit entity filters', () => {
  assert.deepEqual(normalizeAuditEventQuery({ entityType: 'shipment' }), {
    entityType: 'shipment',
    page: 1,
    pageSize: 50,
  });
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
