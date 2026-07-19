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
  if (
    response.code === 'MIX_REQUOTE_REQUIRED' &&
    Array.isArray(response.mixes) &&
    response.mixes.every(
      (mix) =>
        typeof mix === 'object' &&
        mix !== null &&
        typeof (mix as Record<string, unknown>).mixId === 'string' &&
        typeof (mix as Record<string, unknown>).oldUnitPriceCents === 'number' &&
        typeof (mix as Record<string, unknown>).newUnitPriceCents === 'number',
    )
  ) {
    return {
      code: 'MIX_REQUOTE_REQUIRED',
      mixes: response.mixes as Array<{
        mixId: string;
        oldUnitPriceCents: number;
        newUnitPriceCents: number;
      }>,
    };
  }
  if (
    response.code === 'MIX_STOCK_UNAVAILABLE' &&
    Array.isArray(response.mixIds) &&
    Array.isArray(response.productIds) &&
    response.mixIds.every((id) => typeof id === 'string') &&
    response.productIds.every((id) => typeof id === 'string')
  ) {
    return {
      code: 'MIX_STOCK_UNAVAILABLE',
      mixIds: response.mixIds,
      productIds: response.productIds,
    };
  }
  return null;
}

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
      const conflict = checkoutConflict(error);
      if (conflict) {
        dispatch({ type: 'mix-conflict', conflict, idempotencyKey: createIdempotencyKey() });
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
    contactIsValid,
    dispatch,
    replaceWithOrder,
    state,
  ]);
}
