import { describe, expect, it } from 'vitest';
import type { SavedListAddToCartResponse, SavedListLineOutcome } from '@shop/contracts/saved-lists';
import {
  SAVED_LIST_SKIP_REASONS,
  savedListAdjustmentMessage,
  savedListSkipReasonLabel,
  savedListSummaryMessage,
} from './savedListsPresentation';

const outcome: SavedListLineOutcome = {
  itemId: '1',
  variantId: 1,
  sku: 'CEM-25',
  productId: 'cement',
  productName: 'Cement',
  savedQuantity: 1,
  submittedQuantity: 4,
  moqAdjusted: true,
  resolvedUnitPriceCents: 500,
  status: 'added',
  reason: null,
};
const response = (outcomes: SavedListLineOutcome[]): SavedListAddToCartResponse => ({
  cart: {
    id: '5e6f7a8b-1c2d-4e3f-8a9b-0c1d2e3f4a5b',
    items: [],
    subtotalCents: 0,
    discountableSubtotalCents: 0,
    blendingFeeTotalCents: 0,
    totalItems: 0,
  },
  addedLineCount: outcomes.filter((entry) => entry.status === 'added').length,
  skippedLineCount: outcomes.filter((entry) => entry.status === 'skipped').length,
  outcomes,
});

describe('saved-list presentation', () => {
  it('has buyer copy for every contract skip reason', () => {
    for (const reason of SAVED_LIST_SKIP_REASONS) {
      expect(savedListSkipReasonLabel(reason)).toMatch(/\.$/);
      expect(savedListSkipReasonLabel(reason)).not.toMatch(/SKU|variant|_/i);
    }
  });
  it('only reports adjustments supplied by the server', () => {
    expect(savedListAdjustmentMessage(outcome)).toContain('increased from 1 to 4');
    expect(savedListAdjustmentMessage({ ...outcome, moqAdjusted: false })).toBeNull();
  });
  it('summarises a mixed server report', () => {
    expect(
      savedListSummaryMessage(
        response([
          outcome,
          {
            ...outcome,
            itemId: '2',
            status: 'skipped',
            reason: 'VARIANT_RETIRED',
            submittedQuantity: null,
            moqAdjusted: false,
            resolvedUnitPriceCents: null,
          },
        ]),
      ),
    ).toBe('1 item added to your cart. 1 item could not be added.');
  });
});
