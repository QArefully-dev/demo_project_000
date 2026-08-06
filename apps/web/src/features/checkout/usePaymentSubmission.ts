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
  if (!(error instanceof ApiError) || !error.response) return null;
  const response = error.response as Record<string, unknown>;
  if (error.status === 400 && response.error === 'Selected delivery country is not available') {
    return { code: 'DELIVERY_COUNTRY_NOT_ALLOWED' };
  }
  if (error.status !== 409) return null;
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
  if (response.error === 'PENDING_APPROVAL' && typeof response.approvalRequestId === 'string') {
    return { code: 'PENDING_APPROVAL', approvalRequestId: response.approvalRequestId };
  }
  if (response.error === 'APPROVAL_REJECTED') return { code: 'APPROVAL_REJECTED' };
  if (response.error === 'APPROVAL_EXPIRED') return { code: 'APPROVAL_EXPIRED' };
  if (response.error === 'APPROVAL_TOTAL_DRIFT') return { code: 'APPROVAL_TOTAL_DRIFT' };
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
        // Only a pending or rejected request can be retried against the original approval record.
        // Expired and drifted approvals must create a new request with a new payload fingerprint.
        dispatch({
          type: 'conflict',
          conflict,
          idempotencyKey:
            conflict.code === 'PENDING_APPROVAL' || conflict.code === 'APPROVAL_REJECTED'
              ? state.idempotencyKey
              : createIdempotencyKey(),
        });
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
