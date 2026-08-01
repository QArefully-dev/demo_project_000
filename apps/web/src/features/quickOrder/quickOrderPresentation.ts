import type {
  QuickOrderLineOutcome,
  QuickOrderResponse,
  QuickOrderSkipReason,
} from '@shop/contracts/quick-order';

/** The Quick Order surface's current request state. */
export type QuickOrderState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; response: QuickOrderResponse };

/**
 * Plain-language explanations for every server-reported reason a pasted line was left out.
 *
 * This record is deliberately keyed by the contract union. A new reason therefore cannot reach a
 * buyer without an explicit explanation, and the copy never exposes parsing or catalogue details.
 */
const SKIP_REASON_MESSAGE: Readonly<Record<QuickOrderSkipReason, string>> = {
  MALFORMED_LINE: 'We could not read this line. Check its format and try again.',
  SKU_NOT_FOUND: 'We could not find an item matching this line.',
  INVALID_QUANTITY: 'The amount on this line is not valid.',
  VARIANT_RETIRED: 'We no longer sell this item.',
  INSUFFICIENT_STOCK: 'There is not enough in stock for this amount.',
  BELOW_MOQ: 'This amount is below the smallest order we can accept for this item.',
  BLEND_UNAVAILABLE: 'This item is unavailable right now.',
};

/** Plain-language reason displayed beside one skipped source line. */
export function skipReasonMessage(reason: QuickOrderSkipReason): string {
  return SKIP_REASON_MESSAGE[reason];
}

/** Contract reason list derived from the exhaustive buyer-copy record. */
export const SKIP_REASONS = Object.keys(SKIP_REASON_MESSAGE) as QuickOrderSkipReason[];

/** Shown when the Quick Order request itself could not be completed. */
export const QUICK_ORDER_FAILURE_MESSAGE =
  'We could not add these items to your cart. Please try again.';

/**
 * Names a result by its original pasted-line position without exposing the raw input or item code.
 */
export function outcomeLineLabel(outcome: QuickOrderLineOutcome): string {
  const itemName = outcome.productName ?? 'Item';
  const amount = outcome.submittedQuantity ?? outcome.requestedQuantity;
  return amount === null
    ? `Line ${outcome.lineNumber}: ${itemName}`
    : `Line ${outcome.lineNumber}: ${itemName} × ${amount}`;
}

/**
 * Describes a server-reported minimum-order adjustment. It does not calculate a minimum or alter
 * the submitted quantity; both figures are already final in the response.
 */
export function moqAdjustmentMessage(outcome: QuickOrderLineOutcome): string | null {
  if (
    !outcome.moqAdjusted ||
    outcome.requestedQuantity === null ||
    outcome.submittedQuantity === null
  ) {
    return null;
  }

  return `Amount increased from ${outcome.requestedQuantity} to ${outcome.submittedQuantity} to meet the smallest order.`;
}

function lineCount(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}

/** One sentence summarising server-reported additions and skipped lines. */
export function quickOrderSummaryMessage(response: QuickOrderResponse): string {
  const { addedLineCount, skippedLineCount } = response;
  if (addedLineCount === 0 && skippedLineCount === 0) {
    return 'No lines were ready to add to your cart.';
  }
  if (skippedLineCount === 0) {
    return `${lineCount(addedLineCount)} ${addedLineCount === 1 ? 'was' : 'were'} added to your cart.`;
  }
  if (addedLineCount === 0) {
    return `Nothing was added to your cart. ${lineCount(skippedLineCount)} could not be added.`;
  }
  return `${lineCount(addedLineCount)} added to your cart. ${lineCount(
    skippedLineCount,
  )} could not be added.`;
}

/** Skipped source lines in the server's original reporting order. */
export function skippedOutcomes(response: QuickOrderResponse): QuickOrderLineOutcome[] {
  return response.outcomes.filter((outcome) => outcome.status === 'skipped');
}

/** Added source lines whose submitted amount was adjusted by the server. */
export function adjustedOutcomes(response: QuickOrderResponse): QuickOrderLineOutcome[] {
  return response.outcomes.filter((outcome) => outcome.status === 'added' && outcome.moqAdjusted);
}
