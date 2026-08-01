import { Link } from 'react-router-dom';
import type { QuickOrderResponse } from '@shop/contracts/quick-order';
import {
  adjustedOutcomes,
  moqAdjustmentMessage,
  outcomeLineLabel,
  quickOrderSummaryMessage,
  skipReasonMessage,
  skippedOutcomes,
  type QuickOrderState,
} from './quickOrderPresentation';

type Props = {
  state: QuickOrderState;
};

function ResultBody({ response }: { response: QuickOrderResponse }) {
  const adjusted = adjustedOutcomes(response);
  const skipped = skippedOutcomes(response);

  return (
    <div className="space-y-2">
      <p className="font-medium">{quickOrderSummaryMessage(response)}</p>
      {adjusted.length > 0 && (
        <ul className="space-y-1" aria-label="Amounts adjusted for Quick Order">
          {adjusted.map((outcome) => (
            <li key={outcome.lineNumber}>
              <span className="font-medium">{outcomeLineLabel(outcome)}</span>{' '}
              <span className="text-muted-foreground">{moqAdjustmentMessage(outcome)}</span>
            </li>
          ))}
        </ul>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-1" aria-label="Lines not added from Quick Order">
          {skipped.map((outcome) => (
            <li key={outcome.lineNumber}>
              <span className="font-medium">{outcomeLineLabel(outcome)}</span>{' '}
              <span className="text-muted-foreground">
                {outcome.reason === null ? '' : skipReasonMessage(outcome.reason)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {response.addedLineCount !== 0 && (
        <Link className="inline-block font-medium underline underline-offset-4" to="/cart">
          View cart
        </Link>
      )}
    </div>
  );
}

/** Reports the result of one pasted Quick Order submission beneath its form. */
export function QuickOrderOutcomeList({ state }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Quick Order result"
      className="text-sm empty:hidden"
    >
      {state.kind === 'pending' && (
        <p className="text-muted-foreground">Adding your items to the cart...</p>
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
