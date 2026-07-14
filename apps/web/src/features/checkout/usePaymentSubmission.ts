import { useCallback } from 'react';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import type { CardField, CheckoutEvent, CheckoutState } from './checkoutState';

type UsePaymentSubmissionArgs = {
  cartId: string | null;
  cartPresent: boolean;
  state: CheckoutState;
  contactIsValid: boolean;
  cardIsValid: boolean;
  appliedPromo: string | null;
  dispatch: React.Dispatch<CheckoutEvent>;
  clearCart: () => void;
  replaceWithOrder: (orderId: string) => void;
  cardFields: CardField[];
};

export function usePaymentSubmission({
  cartId,
  cartPresent,
  state,
  contactIsValid,
  cardIsValid,
  appliedPromo,
  dispatch,
  clearCart,
  replaceWithOrder,
  cardFields,
}: UsePaymentSubmissionArgs) {
  return useCallback(async () => {
    if (!cartId || !cartPresent || state.submitting) return;
    dispatch({ type: 'fields-touched', fields: cardFields });
    if (!contactIsValid || !cardIsValid) return;
    dispatch({ type: 'submission-started' });
    try {
      const order = await pay({
        cartId,
        promoCode: appliedPromo ?? undefined,
        customerName: state.contact.customerName.trim(),
        customerEmail: state.contact.customerEmail.trim(),
        shippingAddress: state.contact.shippingAddress.trim(),
        cardNumber: state.card.cardNumber,
        cardExpiry: state.card.cardExpiry,
        cardCvc: state.card.cardCvc,
        idempotencyKey: state.idempotencyKey,
      });
      clearCart();
      replaceWithOrder(order.id);
    } catch (error) {
      dispatch({
        type: 'submission-failed',
        error:
          error instanceof ApiError && error.status === 402
            ? 'Payment failed. Retry keeps this payment attempt safe; change payment details to start a new attempt.'
            : error instanceof Error
              ? error.message
              : 'Payment failed',
      });
    } finally {
      dispatch({ type: 'submission-finished' });
    }
  }, [
    appliedPromo,
    cardFields,
    cardIsValid,
    cartId,
    cartPresent,
    clearCart,
    contactIsValid,
    dispatch,
    replaceWithOrder,
    state,
  ]);
}
