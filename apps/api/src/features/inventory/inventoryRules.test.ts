import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateInventoryDemand,
  isPreparedReservationExpired,
  splitInventoryReservation,
} from './inventoryRules.js';

void test('hard mix demand wins before backorderable ordinary demand', () => {
  const split = splitInventoryReservation(
    [
      { productId: 2, quantity: 3, demandKind: 'product' },
      { productId: 2, quantity: 2, demandKind: 'powder_mix' },
    ],
    [
      {
        productId: 2,
        stockCount: 4,
        availableToSell: 4,
        backorderable: true,
        backorderLeadDays: 14,
      },
    ],
  );
  assert.deepEqual(split, [
    {
      productId: 2,
      quantity: 2,
      demandKind: 'powder_mix',
      reservedQuantity: 2,
      backorderedQuantity: 0,
    },
    {
      productId: 2,
      quantity: 3,
      demandKind: 'product',
      reservedQuantity: 2,
      backorderedQuantity: 1,
    },
  ]);
});

void test('demand ordering and expiry boundary are deterministic', () => {
  assert.deepEqual(
    aggregateInventoryDemand([
      { productId: 3, quantity: 1, demandKind: 'product' },
      { productId: 2, quantity: 1, demandKind: 'powder_mix' },
      { productId: 3, quantity: 2, demandKind: 'product' },
    ]),
    [
      { productId: 2, quantity: 1, demandKind: 'powder_mix' },
      { productId: 3, quantity: 3, demandKind: 'product' },
    ],
  );
  assert.equal(
    isPreparedReservationExpired('2026-07-19T12:00:00.000Z', '2026-07-19T12:00:00.000Z'),
    true,
  );
});
