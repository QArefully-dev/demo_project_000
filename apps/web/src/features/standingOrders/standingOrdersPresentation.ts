import type {
  StandingOrderCadence,
  StandingOrderLineOutcome,
  StandingOrderRun,
} from '@shop/contracts/standing-orders';
import { ApiError } from '@/api/client';
import { outcomeLineLabel, skipReasonMessage } from '@/features/reorder/reorderPresentation';
const cadence: Readonly<Record<StandingOrderCadence, string>> = {
  weekly: 'Weekly',
  fortnightly: 'Every two weeks',
  monthly: 'Monthly',
};
const errors: Readonly<Record<string, string>> = {
  NOT_FOUND: 'This standing order no longer exists. Refresh the page and try again.',
  SOURCE_NOT_FOUND: 'The saved list or order for this schedule is no longer available.',
  CART_RESERVED: 'This run could not start because its cart is in checkout. Try again shortly.',
  CART_NOT_FOUND: 'This run could not start because its cart is no longer available. Try again.',
  UNAUTHENTICATED: 'Sign in again to manage standing orders.',
  FORBIDDEN: 'You do not have permission to manage this standing order.',
};
export const STANDING_ORDER_CADENCES = Object.keys(cadence) as StandingOrderCadence[];
export const STANDING_ORDER_ERROR_CODES = Object.keys(errors);
export const standingOrderCadenceLabel = (value: StandingOrderCadence) => cadence[value];
export function standingOrderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = (error.response as unknown as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && code in errors) return errors[code]!;
    if (error.status === 401) return errors.UNAUTHENTICATED!;
    if (error.status === 403) return errors.FORBIDDEN!;
    if (error.isNetworkError)
      return 'We could not reach the server. Check your connection and try again.';
  }
  return 'We could not complete that standing-order request. Please try again.';
}
export const standingOrderOutcomeLabel = (outcome: StandingOrderLineOutcome) =>
  outcomeLineLabel(outcome);
export const standingOrderSkipReasonLabel = (outcome: StandingOrderLineOutcome) =>
  outcome.status === 'skipped' && outcome.reason ? skipReasonMessage(outcome.reason) : null;
export function standingOrderRunSummary(run: StandingOrderRun): string {
  if (run.status === 'pending') return 'Run is waiting to be processed.';
  if (run.status === 'failed') return `Run failed: ${run.failureReason ?? 'Please try again.'}`;
  if (!run.addedLineCount && !run.skippedLineCount) return 'This run had no items to add.';
  if (!run.skippedLineCount)
    return `${run.addedLineCount} ${run.addedLineCount === 1 ? 'item was' : 'items were'} added.`;
  if (!run.addedLineCount)
    return `No items were added; ${run.skippedLineCount} could not be added.`;
  return `${run.addedLineCount} added; ${run.skippedLineCount} could not be added.`;
}
