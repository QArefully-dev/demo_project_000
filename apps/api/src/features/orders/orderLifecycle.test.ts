import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderDomainError } from './orderErrors.js';
import {
  aggregateOrderStatus,
  assertCanCancel,
  assertCompleteAllocation,
  assertShipmentTransition,
  lifecycleFingerprint,
} from './orderLifecycle.js';

void test('calculates lifecycle aggregate precedence', () => {
  assert.equal(aggregateOrderStatus([]), 'processing');
  assert.equal(aggregateOrderStatus([{ status: 'packed' }]), 'packed');
  assert.equal(aggregateOrderStatus([{ status: 'delivered' }, { status: 'shipped' }]), 'shipped');
  assert.equal(
    aggregateOrderStatus([{ status: 'delivered' }, { status: 'delivery_failed' }]),
    'delivery_failed',
  );
  assert.equal(aggregateOrderStatus([{ status: 'cancelled' }]), 'cancelled');
  assert.equal(
    aggregateOrderStatus([{ status: 'cancelled' }, { status: 'delivery_failed' }]),
    'cancelled',
  );
});

void test('requires complete non-duplicated shipment allocation', () => {
  assert.doesNotThrow(() =>
    assertCompleteAllocation(
      [
        { lineKind: 'product', lineId: '1', quantity: 2 },
        { lineKind: 'powder_mix', lineId: '1', quantity: 1 },
      ],
      [
        {
          lines: [
            { lineKind: 'product', lineId: '1', quantity: 1 },
            { lineKind: 'powder_mix', lineId: '1', quantity: 1 },
          ],
        },
        { lines: [{ lineKind: 'product', lineId: '1', quantity: 1 }] },
      ],
    ),
  );
  assert.throws(
    () =>
      assertCompleteAllocation(
        [{ lineKind: 'product', lineId: '1', quantity: 2 }],
        [{ lines: [{ lineKind: 'product', lineId: '1', quantity: 1 }] }],
      ),
    OrderDomainError,
  );
  assert.throws(
    () =>
      assertCompleteAllocation(
        [{ lineKind: 'product', lineId: '1', quantity: 1 }],
        [
          {
            lines: [
              { lineKind: 'product', lineId: '1', quantity: 1 },
              { lineKind: 'product', lineId: '1', quantity: 1 },
            ],
          },
        ],
      ),
    OrderDomainError,
  );
});

void test('fingerprint is canonical, deep, operation-scoped, and payload-sensitive', () => {
  assert.equal(
    lifecycleFingerprint('pack', {
      shipments: [{ lines: [{ lineId: '1', lineKind: 'product', quantity: 1 }] }],
      version: 0,
    }),
    lifecycleFingerprint('pack', {
      version: 0,
      shipments: [{ lines: [{ quantity: 1, lineKind: 'product', lineId: '1' }] }],
    }),
  );
  assert.notEqual(
    lifecycleFingerprint('pack', { orderId: 1 }),
    lifecycleFingerprint('cancel', { orderId: 1 }),
  );
  assert.notEqual(
    lifecycleFingerprint('pack', { nested: { quantity: 1 } }),
    lifecycleFingerprint('pack', { nested: { quantity: 2 } }),
  );
});

void test('allows only monotonic shipment transitions and pre-shipment cancellation', () => {
  assert.doesNotThrow(() => assertShipmentTransition('packed', 'shipped'));
  assert.throws(() => assertShipmentTransition('packed', 'delivered'), OrderDomainError);
  assert.doesNotThrow(() => assertCanCancel('packed', [{ status: 'packed' }]));
  assert.throws(() => assertCanCancel('shipped', [{ status: 'shipped' }]), OrderDomainError);
});
