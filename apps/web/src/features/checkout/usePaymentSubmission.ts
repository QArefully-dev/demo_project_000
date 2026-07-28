import { useCallback } from 'react';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import {
  createIdempotencyKey,
  type CardField,
  type CheckoutConflict,
  type CheckoutEvent,
  type CheckoutState,
} from './checkoutState';
import { buildBillingSelection, buildDeliveryDestination } from './checkoutValidation';

function checkoutConflict(error: unknown): CheckoutConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409 || !error.response) return null;
  const response = error.response as Record<string, unknown>;
  if (
    response.error === 'RESERVATION_EXPIRED' &&
    typeof response.reservationExpiresAt === 'string'
  ) {
    return { code: 'RESERVATION_EXPIRED', reservationExpiresAt: response.reservationExpiresAt };
  }
  if (
    response.error === 'INSUFFICIENT_STOCK' &&
    Array.isArray(response.productIds) &&
    response.productIds.every((id) => typeof id === 'string')
  ) {
    return { code: 'INSUFFICIENT_STOCK', productIds: response.productIds };
  }
  if (response.error === 'DELIVERY_SLOT_UNAVAILABLE' && typeof response.earliestDate === 'string') {
    return { code: 'DELIVERY_SLOT_UNAVAILABLE', earliestDate: response.earliestDate };
  }
  return null;
}

type UsePaymentSubmissionArgs = {
  cartId: string | null;
  cartPresent: boolean;
  state: CheckoutState;
  /** Delivery and schedule steps both validate; the payment step is unreachable otherwise. */
  stepsAreValid: boolean;
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
  stepsAreValid,
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
    if (!stepsAreValid || !cardIsValid) return;
    const deliveryDestination = buildDeliveryDestination(state.delivery);
    const billingSelection = buildBillingSelection(state.billing);
    const deliverySlot = state.schedule.slot;
    // Guarded by `stepsAreValid`; the null checks keep the payload contract-shaped without a cast.
    if (!deliveryDestination || !billingSelection || !deliverySlot) return;
    const purchaseOrderReference = state.billing.purchaseOrderReference.trim();
    dispatch({ type: 'submission-started' });
    try {
      const order = await pay({
        cartId,
        promoCode: appliedPromo ?? undefined,
        customerName: state.contact.customerName.trim(),
        customerEmail: state.contact.customerEmail.trim(),
        deliveryDestination,
        billingSelection,
        deliverySlot,
        ...(purchaseOrderReference ? { purchaseOrderReference } : {}),
        cardNumber: state.card.cardNumber,
        cardExpiry: state.card.cardExpiry,
        cardCvc: state.card.cardCvc,
        idempotencyKey: state.idempotencyKey,
      });
      clearCart();
      replaceWithOrder(order.id);
    } catch (error) {
      const conflict = checkoutConflict(error);
      if (conflict) {
        dispatch({ type: 'conflict', conflict, idempotencyKey: createIdempotencyKey() });
        return;
      }
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
    dispatch,
    replaceWithOrder,
    state,
    stepsAreValid,
  ]);
}
