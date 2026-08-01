import type {
  SavedListAddToCartResponse,
  SavedListLineOutcome,
  SavedListSkipReason,
} from '@shop/contracts/saved-lists';

export type SavedListAddState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; response: SavedListAddToCartResponse };

const SKIP_REASON_LABEL: Readonly<Record<SavedListSkipReason, string>> = {
  VARIANT_RETIRED: 'We no longer sell this item.',
  VARIANT_UNRESOLVED: 'We could not find this item in what we sell today.',
  INSUFFICIENT_STOCK: 'There is not enough in stock for this amount.',
  BELOW_MOQ: 'This amount is below the smallest order we can accept for this item.',
  INVALID_QUANTITY: 'The saved amount can no longer be ordered.',
  BLEND_UNAVAILABLE: 'This item is unavailable right now.',
};

/** Every contract reason is deliberately represented by buyer-facing copy. */
export const SAVED_LIST_SKIP_REASONS = Object.keys(SKIP_REASON_LABEL) as SavedListSkipReason[];

export function savedListSkipReasonLabel(reason: SavedListSkipReason): string {
  return SKIP_REASON_LABEL[reason];
}

export function savedListOutcomeLabel(outcome: SavedListLineOutcome): string {
  return `${outcome.productName} × ${outcome.savedQuantity}`;
}

/** Describes an API-reported adjustment without calculating an MOQ in the browser. */
export function savedListAdjustmentMessage(outcome: SavedListLineOutcome): string | null {
  if (!outcome.moqAdjusted || outcome.submittedQuantity === null) return null;
  return `Amount increased from ${outcome.savedQuantity} to ${outcome.submittedQuantity} to meet the smallest order.`;
}

function lineCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function savedListSummaryMessage(response: SavedListAddToCartResponse): string {
  if (response.addedLineCount === 0 && response.skippedLineCount === 0)
    return 'This saved list has no items to add.';
  if (response.skippedLineCount === 0)
    return `${lineCount(response.addedLineCount)} ${response.addedLineCount === 1 ? 'was' : 'were'} added to your cart.`;
  if (response.addedLineCount === 0)
    return `Nothing was added to your cart. ${lineCount(response.skippedLineCount)} could not be added.`;
  return `${lineCount(response.addedLineCount)} added to your cart. ${lineCount(
    response.skippedLineCount,
  )} could not be added.`;
}

export function savedListAdjustedOutcomes(
  response: SavedListAddToCartResponse,
): SavedListLineOutcome[] {
  return response.outcomes.filter((outcome) => outcome.status === 'added' && outcome.moqAdjusted);
}

export function savedListSkippedOutcomes(
  response: SavedListAddToCartResponse,
): SavedListLineOutcome[] {
  return response.outcomes.filter((outcome) => outcome.status === 'skipped');
}

export const SAVED_LIST_ADD_FAILURE_MESSAGE =
  'We could not add this saved list to your cart. Please try again.';
