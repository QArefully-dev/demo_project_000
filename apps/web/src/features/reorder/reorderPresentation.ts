import type {
  ReorderLineOutcome,
  ReorderResponse,
  ReorderSkipReason,
} from '@shop/contracts/reorder';
import { formatMoney } from '@/lib/formatMoney';

/**
 * What one Buy Again attempt is currently showing on the surface that triggered it. State is keyed
 * by order so a second order's attempt can never be read as this order's result.
 */
export type BuyAgainState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; response: ReorderResponse };

/**
 * Buyer-facing cause for every reason the server can give for leaving a line out.
 *
 * The record is keyed by the reason union, so adding a reason to the contract fails typecheck here
 * instead of silently falling through to generic copy. Copy carries no internal code and no trade
 * jargon: the shopper must understand the row without documentation.
 */
const SKIP_REASON_MESSAGE: Readonly<Record<ReorderSkipReason, string>> = {
  VARIANT_RETIRED: 'We no longer sell this item.',
  VARIANT_UNRESOLVED: 'We could not find this item in what we sell today.',
  INSUFFICIENT_STOCK: 'There is not enough in stock to repeat this amount.',
  BELOW_MOQ: 'This amount is below the smallest amount we can deliver for this item.',
  INVALID_QUANTITY: 'The amount on the original order can no longer be ordered.',
  BLEND_UNAVAILABLE: 'This custom blend cannot be made at the moment.',
};

/** Plain-language cause shown next to a line the server left out. */
export function skipReasonMessage(reason: ReorderSkipReason): string {
  return SKIP_REASON_MESSAGE[reason];
}

/**
 * Every reason the contract can send, derived from the copy record rather than hand-listed, so a
 * new reason cannot escape a check that walks this list.
 */
export const SKIP_REASONS = Object.keys(SKIP_REASON_MESSAGE) as ReorderSkipReason[];

/**
 * Shown when the Buy Again request itself did not land. Deliberately general: the specific cart
 * failure text is global state shared with unrelated cart actions, so it cannot be attributed to
 * one order's attempt without risking a message that belongs to something else.
 */
export const BUY_AGAIN_FAILURE_MESSAGE =
  'We could not add this order to your cart. Please try again.';

/** `Cement × 3`. Names the line the way the shopper saw it on the original order. */
export function outcomeLineLabel(outcome: ReorderLineOutcome): string {
  return `${outcome.productName} × ${outcome.quantity}`;
}

/**
 * Old-to-new price sentence for a line whose price moved, or null when it did not. The server owns
 * the comparison; this only renders the two amounts it already reported.
 */
export function priceChangeMessage(outcome: ReorderLineOutcome): string | null {
  if (!outcome.priceChanged || outcome.currentUnitPriceCents === null) return null;
  return `Price changed from ${formatMoney(outcome.orderedUnitPriceCents)} to ${formatMoney(
    outcome.currentUnitPriceCents,
  )} per item.`;
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/**
 * One sentence describing the whole attempt. Reports the server's counts verbatim; nothing here
 * recomputes eligibility, price or quantity.
 */
export function reorderSummaryMessage(response: ReorderResponse): string {
  const { addedLineCount, skippedLineCount } = response;
  if (addedLineCount === 0 && skippedLineCount === 0) {
    return 'This order has nothing left to add to your cart.';
  }
  if (skippedLineCount === 0) {
    return `${itemCount(addedLineCount)} from this order ${
      addedLineCount === 1 ? 'was' : 'were'
    } added to your cart.`;
  }
  if (addedLineCount === 0) {
    return `Nothing was added to your cart. ${itemCount(
      skippedLineCount,
    )} from this order cannot be ordered right now.`;
  }
  return `${itemCount(addedLineCount)} added to your cart. ${itemCount(
    skippedLineCount,
  )} could not be added.`;
}

/** Lines the server left out, in the order it reported them. */
export function skippedOutcomes(response: ReorderResponse): ReorderLineOutcome[] {
  return response.outcomes.filter((outcome) => outcome.status === 'skipped');
}

/** Added lines whose price moved since the original order. */
export function repricedOutcomes(response: ReorderResponse): ReorderLineOutcome[] {
  return response.outcomes.filter(
    (outcome) => outcome.status === 'added' && priceChangeMessage(outcome) !== null,
  );
}
