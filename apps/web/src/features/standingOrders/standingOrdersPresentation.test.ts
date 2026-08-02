import { describe, expect, it } from 'vitest';
import type { StandingOrderLineOutcome } from '@shop/contracts/standing-orders';
import {
  STANDING_ORDER_CADENCES,
  standingOrderCadenceLabel,
  standingOrderSkipReasonLabel,
} from './standingOrdersPresentation';

const outcome = (reason: StandingOrderLineOutcome['reason']): StandingOrderLineOutcome => ({
  orderLineItemId: '1',
  productId: 'cement',
  productName: 'Cement',
  variantId: 1,
  sku: 'CEM',
  configKey: '',
  quantity: 4,
  status: 'skipped',
  reason,
  orderedUnitPriceCents: 100,
  currentUnitPriceCents: 100,
  priceChanged: false,
});

describe('standing-order presentation', () => {
  it('labels every supported cadence', () => {
    expect(STANDING_ORDER_CADENCES.map(standingOrderCadenceLabel)).toEqual([
      'Weekly',
      'Every two weeks',
      'Monthly',
    ]);
  });
  it.each([
    'VARIANT_RETIRED',
    'VARIANT_UNRESOLVED',
    'INSUFFICIENT_STOCK',
    'BELOW_MOQ',
    'INVALID_QUANTITY',
    'BLEND_UNAVAILABLE',
  ] as const)('maps skip %s to buyer copy', (reason) => {
    expect(standingOrderSkipReasonLabel(outcome(reason))).toMatch(/\.$/);
  });
});
