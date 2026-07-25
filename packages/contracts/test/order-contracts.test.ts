import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import {
  CancelOrderBody,
  CreateTrackingEventBody,
  OrderDetailResponse,
  OrderLifecycleEventType,
  OrderListQuery,
  PackOrderBody,
  ShipmentStatus,
  TransitionShipmentBody,
} from '../src/orders.js';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const occurredAt = '2026-07-19T12:00:00.000Z';

const order = {
  id: '1',
  status: 'packed',
  version: 1,
  items: [
    {
      lineId: '11',
      productId: '1',
      productName: 'Immutable product',
      unitPriceCents: 1200,
      quantity: 2,
      lineTotalCents: 2400,
      inventoryStatus: 'allocated',
      allocatedQuantity: 2,
      backorderedQuantity: 0,
    },
  ],
  subtotalCents: 2400,
  discountCents: 0,
  totalCents: 2400,
  promoApplied: null,
  createdAt: occurredAt,
  shipments: [
    {
      id: '10',
      shipmentNumber: 1,
      status: 'packed',
      trackingReference: 'SIM-001',
      version: 0,
      lines: [{ lineId: '11', quantity: 2 }],
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
  ],
  events: [
    {
      id: '100',
      shipmentId: '10',
      type: 'shipment_packed',
      code: null,
      title: 'Shipment packed',
      detail: null,
      location: null,
      occurredAt,
    },
  ],
  canCancel: true,
};

void test('order detail accepts lifecycle and split-shipment line allocation data', () => {
  assert.equal(Value.Check(OrderDetailResponse, order), true);
  assert.equal(
    Value.Check(OrderDetailResponse, {
      ...order,
      shipments: [
        ...order.shipments,
        {
          ...order.shipments[0],
          id: '12',
          shipmentNumber: 2,
          trackingReference: null,
          lines: [{ lineId: '11', quantity: 1 }],
        },
      ],
    }),
    true,
  );
});

void test('order lifecycle schemas reject invalid statuses and non-strict payloads', () => {
  assert.equal(Value.Check(ShipmentStatus, 'packed'), true);
  assert.equal(Value.Check(ShipmentStatus, 'processing'), false);
  assert.equal(Value.Check(OrderLifecycleEventType, 'shipment_tracking_updated'), true);
  assert.equal(Value.Check(OrderLifecycleEventType, 'tracking_updated'), false);
  assert.equal(Value.Check(OrderDetailResponse, { ...order, status: 'unknown' }), false);
  assert.equal(Value.Check(OrderDetailResponse, { ...order, unknown: true }), false);
  assert.equal(Value.Check(OrderListQuery, { page: 0 }), false);
  assert.equal(Value.Check(OrderListQuery, { page: 1, pageSize: 51 }), false);
});

void test('lifecycle mutation payloads enforce UUID keys, bounds, and allowed transitions', () => {
  assert.equal(Value.Check(CancelOrderBody, { version: 0, idempotencyKey: uuid }), true);
  assert.equal(Value.Check(CancelOrderBody, { version: -1, idempotencyKey: uuid }), false);
  assert.equal(
    Value.Check(PackOrderBody, {
      version: 0,
      idempotencyKey: uuid,
      shipments: [
        {
          trackingReference: 'SIM-002',
          lines: [{ lineId: '11', quantity: 2 }],
        },
      ],
    }),
    true,
  );
  assert.equal(
    Value.Check(PackOrderBody, {
      version: 0,
      idempotencyKey: uuid,
      shipments: [{ lines: [{ lineId: '11', quantity: 0 }] }],
    }),
    false,
  );
  assert.equal(
    Value.Check(PackOrderBody, {
      version: 0,
      idempotencyKey: uuid,
      shipments: [{ lines: [{ lineId: '11', quantity: 1, lineKind: 'product' }] }],
    }),
    false,
  );
  assert.equal(
    Value.Check(TransitionShipmentBody, {
      version: 0,
      status: 'cancelled',
      idempotencyKey: uuid,
    }),
    false,
  );
  assert.equal(
    Value.Check(CreateTrackingEventBody, {
      version: 0,
      code: 'in_transit',
      title: 'In transit',
      idempotencyKey: uuid,
    }),
    true,
  );
  assert.equal(
    Value.Check(CreateTrackingEventBody, {
      version: 0,
      code: 'unknown',
      title: 'Unknown',
      idempotencyKey: uuid,
    }),
    false,
  );
  assert.equal(
    Value.Check(CreateTrackingEventBody, {
      version: 0,
      code: 'in_transit',
      title: '<strong>In transit</strong>',
      detail: 'At <Depot>',
      location: 'London',
      idempotencyKey: uuid,
    }),
    false,
  );
});
