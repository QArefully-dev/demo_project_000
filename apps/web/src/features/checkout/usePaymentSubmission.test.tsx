import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import {
  cardFields,
  checkoutReducer,
  DELIVERY_COUNTRY_NOT_ALLOWED_MESSAGE,
  initialCheckoutState,
} from './checkoutState';
import { usePaymentSubmission } from './usePaymentSubmission';

vi.mock('@/api/payments', () => ({ pay: vi.fn() }));

function CrossBorderSubmissionHarness() {
  const [state, dispatch] = useReducer(checkoutReducer, {
    ...initialCheckoutState(),
    contact: { customerName: 'Buyer', customerEmail: 'buyer@example.test' },
    delivery: {
      ...initialCheckoutState().delivery,
      destinationKind: 'saved',
      deliverySiteId: 'site-1',
    },
    schedule: { slot: { date: '2026-08-10', window: 'am' } },
    billing: {
      ...initialCheckoutState().billing,
      selectionKind: 'saved',
      billingEntityId: 'billing-1',
    },
    card: { cardNumber: '424242424242', cardExpiry: '01/30', cardCvc: '123' },
  });
  const submit = usePaymentSubmission({
    cartId: 'cart-1',
    cartPresent: true,
    state,
    stepsAreValid: true,
    cardIsValid: true,
    appliedPromo: null,
    dispatch,
    clearCart: vi.fn(),
    replaceWithOrder: vi.fn(),
    cardFields,
  });

  return (
    <div>
      <button type="button" onClick={() => void submit()}>
        Submit payment
      </button>
      {state.paymentError && <p role="alert">{state.paymentError}</p>}
      <output data-testid="conflict-code">{state.conflict?.code}</output>
    </div>
  );
}

describe('usePaymentSubmission delivery country conflict', () => {
  beforeEach(() => {
    vi.mocked(pay).mockReset();
  });

  it('maps the exact cross-border 400 and renders the delivery restriction', async () => {
    vi.mocked(pay).mockRejectedValue(
      new ApiError('Selected delivery country is not available', 400, {
        error: 'Selected delivery country is not available',
      }),
    );
    const user = userEvent.setup();
    render(<CrossBorderSubmissionHarness />);

    await user.click(screen.getByRole('button', { name: 'Submit payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      DELIVERY_COUNTRY_NOT_ALLOWED_MESSAGE,
    );
    expect(screen.getByTestId('conflict-code')).toHaveTextContent('DELIVERY_COUNTRY_NOT_ALLOWED');
  });
});
