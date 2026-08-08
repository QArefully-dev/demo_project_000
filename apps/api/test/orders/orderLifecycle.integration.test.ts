import assert from 'node:assert/strict';
import test from 'node:test';
import { openSeededDatabase } from '../support/seededDatabase.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createInventoryRepository } from '../../src/features/inventory/inventoryRepository.js';
import { createInventoryService } from '../../src/features/inventory/inventoryService.js';
import { createOrderAccessService } from '../../src/features/orders/orderAccessService.js';
import { createOrderRepository } from '../../src/features/orders/orderRepository.js';
import { createOrderService } from '../../src/features/orders/orderService.js';

void test('order lifecycle repository creates initial immutable event', (t) => {
  const { db } = openSeededDatabase(t);
  const repository = createOrderRepository(db);
  const orderId = repository.create({
    customerName: 'Order Test',
    customerEmail: 'order@example.test',
    shippingAddress: '1 Test St',
    promoApplied: null,
    subtotalCents: 500,
    discountCents: 0,
    totalCents: 500,
    userId: null,
    items: [
      {
        productId: '1',
        productName: 'Snapshot product',
        unitPriceCents: 500,
        quantity: 1,
        discountableTotalCents: 500,
        blendingFeeCents: 0,
        lineTotalCents: 500,
      },
    ],
    createdAt: '2026-07-19T00:00:00.000Z',
  });
  const detail = repository.findDetailById(orderId);
  assert.equal(detail?.status, 'processing');
  assert.equal(detail?.version, 0);
  assert.deepEqual(
    detail?.items[0] && {
      inventoryStatus: detail.items[0].inventoryStatus,
      allocatedQuantity: detail.items[0].allocatedQuantity,
      backorderedQuantity: detail.items[0].backorderedQuantity,
    },
    { inventoryStatus: 'allocated', allocatedQuantity: 1, backorderedQuantity: 0 },
  );
  assert.match(detail?.items[0]?.lineId ?? '', /^[1-9]\d*$/);
  assert.deepEqual(
    detail?.events.map((event) => event.type),
    ['order_created'],
  );
  assert.throws(() =>
    db
      .prepare("UPDATE order_lifecycle_events SET title = 'changed' WHERE order_id = ?")
      .run(orderId),
  );
});

void test('lifecycle snapshots use frozen order country while tracking text stays raw', (t) => {
  const { db } = openSeededDatabase(t);
  const clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
  const repository = createOrderRepository(db);
  const service = createOrderService({
    repository,
    unitOfWork: createUnitOfWork(db),
    clock,
    audit: createAuditWriter({ repository: createAuditRepository(db), clock }),
    inventory: createInventoryService({ repository: createInventoryRepository(db) }),
  });
  const create = (country: 'DE' | 'FR') =>
    repository.create({
      country,
      customerName: 'Lifecycle Country Test',
      customerEmail: 'lifecycle-country@example.test',
      shippingAddress: '1 Test St',
      promoApplied: null,
      subtotalCents: 500,
      discountCents: 0,
      totalCents: 500,
      userId: 1,
      items: [
        {
          productId: '1',
          productName: 'Snapshot product',
          unitPriceCents: 500,
          quantity: 1,
          discountableTotalCents: 500,
          blendingFeeCents: 0,
          lineTotalCents: 500,
        },
      ],
      createdAt: '2026-07-19T00:00:00.000Z',
    });
  const context = {
    actor: { type: 'user' as const, userId: 1 },
    requestId: 'localised-order-lifecycle',
  };
  const frenchOrderId = create('FR');
  const frenchLineId = repository.findDetailById(frenchOrderId)?.items[0]?.lineId;
  if (!frenchLineId) throw new Error('Expected French order line');
  const packed = service.pack({
    orderId: frenchOrderId,
    version: 0,
    idempotencyKey: 'localised-pack-key',
    context,
    shipments: [{ lines: [{ lineId: frenchLineId, quantity: 1 }] }],
  });
  const shipmentId = Number(packed.shipments[0]?.id);
  assert.ok(shipmentId > 0);
  const shipped = service.transitionShipment({
    shipmentId,
    version: 0,
    status: 'shipped',
    idempotencyKey: 'localised-ship-key',
    context,
  });
  const tracked = service.addTrackingEvent({
    shipmentId,
    version: 1,
    code: 'in_transit',
    title: 'Carrier checkpoint (operator text)',
    detail: 'Driver supplied detail remains raw',
    location: 'Depot 7',
    idempotencyKey: 'localised-track-key',
    context,
  });
  const frenchEvents = tracked.events.map((event) => ({
    type: event.type,
    title: event.title,
    detail: event.detail,
  }));
  assert.deepEqual(frenchEvents, [
    { type: 'order_created', title: 'Commande cr\u00e9\u00e9e', detail: null },
    { type: 'shipment_packed', title: 'Envoi emball\u00e9', detail: null },
    { type: 'shipment_shipped', title: 'Envoi exp\u00e9di\u00e9', detail: null },
    {
      type: 'shipment_tracking_updated',
      title: 'Carrier checkpoint (operator text)',
      detail: 'Driver supplied detail remains raw',
    },
  ]);
  assert.equal(repository.country(frenchOrderId), 'FR');
  assert.equal(repository.findDetailById(frenchOrderId, 'DE'), undefined);
  assert.equal(shipped.status, 'shipped');

  const germanOrderId = create('DE');
  const cancelled = service.cancel({
    orderId: germanOrderId,
    version: 0,
    idempotencyKey: 'localised-cancel-key',
    context,
  });
  assert.deepEqual(
    cancelled.events.map((event) => ({ type: event.type, title: event.title })),
    [
      { type: 'order_created', title: 'Bestellung erstellt' },
      { type: 'order_cancelled', title: 'Bestellung storniert' },
    ],
  );
  assert.equal(repository.country(germanOrderId), 'DE');
});

void test('lifecycle commands are idempotent, versioned, audited, and transactional', (t) => {
  const { db } = openSeededDatabase(t);
  const clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
  const repository = createOrderRepository(db);
  const service = createOrderService({
    repository,
    unitOfWork: createUnitOfWork(db),
    clock,
    audit: createAuditWriter({ repository: createAuditRepository(db), clock }),
    inventory: createInventoryService({ repository: createInventoryRepository(db) }),
  });
  const create = (userId: number | null = 1) =>
    repository.create({
      customerName: 'Lifecycle Test',
      customerEmail: 'lifecycle@example.test',
      shippingAddress: '1 Test St',
      promoApplied: null,
      subtotalCents: 500,
      discountCents: 0,
      totalCents: 500,
      userId,
      items: [
        {
          productId: '1',
          productName: 'Snapshot product',
          unitPriceCents: 500,
          quantity: 1,
          discountableTotalCents: 500,
          blendingFeeCents: 0,
          lineTotalCents: 500,
        },
      ],
      createdAt: '2026-07-19T00:00:00.000Z',
    });
  const context = {
    actor: { type: 'user' as const, userId: 1 },
    requestId: 'order-command-request',
  };
  const orderId = create();
  const lineId = repository.findDetailById(orderId)?.items[0]?.lineId;
  if (!lineId) throw new Error('Expected persisted product line');
  const packed = service.pack({
    orderId,
    version: 0,
    idempotencyKey: 'pack-key',
    context,
    shipments: [{ lines: [{ lineId, quantity: 1 }] }],
  });
  assert.equal(packed.status, 'packed');
  assert.equal(
    service.pack({
      orderId,
      version: 0,
      idempotencyKey: 'pack-key',
      context,
      shipments: [{ lines: [{ lineId, quantity: 1 }] }],
    }).version,
    1,
  );
  assert.throws(
    () =>
      service.pack({
        orderId,
        version: 0,
        idempotencyKey: 'pack-key',
        context,
        shipments: [{ trackingReference: 'changed', lines: [{ lineId, quantity: 1 }] }],
      }),
    { name: 'OrderDomainError', code: 'IDEMPOTENCY_CONFLICT' },
  );
  const backorderedOrderId = create();
  const backorderedLineId = Number(repository.findDetailById(backorderedOrderId)?.items[0]?.lineId);
  db.prepare(
    `INSERT INTO order_inventory_allocations
      (order_line_item_id, variant_id, allocated_quantity, backordered_quantity, cancelled_quantity,
       stock_debited_quantity, created_at, updated_at)
     VALUES (?, (SELECT id FROM product_variants WHERE product_id = 1 ORDER BY sort_order LIMIT 1), 0, 1, 0, 0, ?, ?)`,
  ).run(backorderedLineId, '2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z');
  assert.throws(
    () =>
      service.pack({
        orderId: backorderedOrderId,
        version: 0,
        idempotencyKey: 'backorder-pack-key',
        context,
        shipments: [{ lines: [{ lineId: String(backorderedLineId), quantity: 1 }] }],
      }),
    { name: 'OrderDomainError', code: 'OUTSTANDING_BACKORDER' },
  );
  db.prepare('DELETE FROM order_inventory_allocations WHERE order_line_item_id = ?').run(
    backorderedLineId,
  );
  const shipmentId = packed.shipments[0]?.id;
  if (!shipmentId) throw new Error('Expected shipment');
  const shipped = service.transitionShipment({
    shipmentId: Number(shipmentId),
    version: 0,
    status: 'shipped',
    idempotencyKey: 'ship-key',
    context,
  });
  assert.equal(shipped.status, 'shipped');
  const tracked = service.addTrackingEvent({
    shipmentId: Number(shipmentId),
    version: 1,
    code: 'in_transit',
    title: 'In transit',
    idempotencyKey: 'track-key',
    context,
  });
  assert.equal(tracked.events.at(-1)?.code, 'in_transit');
  assert.throws(
    () =>
      service.transitionShipment({
        shipmentId: Number(shipmentId),
        version: 1,
        status: 'delivered',
        idempotencyKey: 'stale-key',
        context,
      }),
    { name: 'OrderDomainError', code: 'STALE_VERSION' },
  );
  assert.equal(
    service.transitionShipment({
      shipmentId: Number(shipmentId),
      version: 2,
      status: 'delivered',
      idempotencyKey: 'delivered-key',
      context,
    }).status,
    'delivered',
  );

  const cancellableOrderId = create();
  const cancelled = service.cancel({
    orderId: cancellableOrderId,
    version: 0,
    idempotencyKey: 'cancel-key',
    context,
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(
    cancelled.events.map((event) => event.type),
    ['order_created', 'order_cancelled'],
  );

  const restoredOrderId = create();
  const restoredLineId = Number(repository.findDetailById(restoredOrderId)?.items[0]?.lineId);
  db.prepare(
    `INSERT INTO order_inventory_allocations
      (order_line_item_id, variant_id, allocated_quantity, backordered_quantity, cancelled_quantity,
       stock_debited_quantity, created_at, updated_at)
     VALUES (?, (SELECT id FROM product_variants WHERE product_id = 1 ORDER BY sort_order LIMIT 1), 1, 0, 0, 1, ?, ?)`,
  ).run(restoredLineId, '2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z');
  const variantId = (
    db
      .prepare('SELECT id FROM product_variants WHERE product_id = 1 ORDER BY sort_order LIMIT 1')
      .get() as { id: number }
  ).id;
  const stockBeforeRestore = (
    db.prepare('SELECT stock_count FROM product_variants WHERE id = ?').get(variantId) as {
      stock_count: number;
    }
  ).stock_count;
  assert.equal(
    service.cancel({
      orderId: restoredOrderId,
      version: 0,
      idempotencyKey: 'restore-cancel-key',
      context,
    }).status,
    'cancelled',
  );
  assert.equal(
    (
      db.prepare('SELECT stock_count FROM product_variants WHERE id = ?').get(variantId) as {
        stock_count: number;
      }
    ).stock_count,
    stockBeforeRestore + 1,
  );

  const rollbackOrderId = create();
  const rollbackLineId = repository.findDetailById(rollbackOrderId)?.items[0]?.lineId;
  if (!rollbackLineId) throw new Error('Expected rollback line');
  db.exec(
    "CREATE TRIGGER abort_order_audit BEFORE INSERT ON audit_events WHEN NEW.action = 'order.shipment_packed' BEGIN SELECT RAISE(ABORT, 'audit failure'); END",
  );
  try {
    assert.throws(() =>
      service.pack({
        orderId: rollbackOrderId,
        version: 0,
        idempotencyKey: 'rollback-key',
        context,
        shipments: [{ lines: [{ lineId: rollbackLineId, quantity: 1 }] }],
      }),
    );
    assert.equal(repository.findDetailById(rollbackOrderId)?.status, 'processing');
    assert.equal(repository.findDetailById(rollbackOrderId)?.shipments.length, 0);
  } finally {
    db.exec('DROP TRIGGER abort_order_audit');
  }

  const access = createOrderAccessService({
    repository,
    clock,
    tokenSource: () => 'fixed-access-token',
  });
  const grant = access.issue(orderId);
  assert.equal(grant.expiresAt, '2026-07-20T12:00:00.000Z');
  assert.equal(access.validate(orderId, 'fixed-access-token'), true);
  assert.equal(access.validate(orderId, 'wrong-token'), false);
  assert.equal(
    service.listOwned(1, 1, 50).items.some((order) => order.id === String(orderId)),
    true,
  );
});
