import { Link } from 'react-router-dom';
import type { SavedListAddToCartResponse } from '@shop/contracts/saved-lists';
import {
  savedListAdjustedOutcomes,
  savedListAdjustmentMessage,
  savedListOutcomeLabel,
  savedListSkippedOutcomes,
  savedListSkipReasonLabel,
  savedListSummaryMessage,
  type SavedListAddState,
} from './savedListsPresentation';

function ResultBody({ response }: { response: SavedListAddToCartResponse }) {
  const adjusted = savedListAdjustedOutcomes(response);
  const skipped = savedListSkippedOutcomes(response);
  return (
    <div className="space-y-2">
      <p className="font-medium">{savedListSummaryMessage(response)}</p>
      {adjusted.length > 0 && (
        <ul className="space-y-1" aria-label="Amounts adjusted for saved list">
          {adjusted.map((outcome) => (
            <li key={outcome.itemId}>
              <span className="font-medium">{savedListOutcomeLabel(outcome)}</span>{' '}
              <span className="text-muted-foreground">{savedListAdjustmentMessage(outcome)}</span>
            </li>
          ))}
        </ul>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-1" aria-label="Items not added from saved list">
          {skipped.map((outcome) => (
            <li key={outcome.itemId}>
              <span className="font-medium">{savedListOutcomeLabel(outcome)}</span>{' '}
              <span className="text-muted-foreground">
                {outcome.reason === null ? '' : savedListSkipReasonLabel(outcome.reason)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {response.addedLineCount > 0 && (
        <Link className="inline-block font-medium underline underline-offset-4" to="/cart">
          View cart
        </Link>
      )}
    </div>
  );
}

/** Per-attempt status kept local to one saved-list detail page. */
export function SavedListOutcomeList({ state }: { state: SavedListAddState }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Saved list cart result"
      className="text-sm empty:hidden"
    >
      {state.kind === 'pending' && (
        <p className="text-muted-foreground">Adding this list to your cart…</p>
      )}
      {state.kind === 'error' && (
        <p className="rounded-md border border-destructive/40 p-3 text-destructive">
          {state.message}
        </p>
      )}
      {state.kind === 'result' && <ResultBody response={state.response} />}
    </div>
  );
}
