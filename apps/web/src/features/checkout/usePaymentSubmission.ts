import { useCallback, useRef } from 'react';
import type { Country } from '@shop/contracts/country';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import { useOptionalCountry } from '@/hooks/CountryContext';
import {
  createIdempotencyKey,
  type CardField,
  type CheckoutConflict,
  type CheckoutEvent,
  type CheckoutState,
} from './checkoutState';
import { checkoutCodeToken, checkoutErrorState } from './checkoutCopy';
import { buildBillingSelection, buildDeliveryDestination } from './checkoutValidation';

function checkoutConflict(error: unknown): CheckoutConflict | null {
  if (!(error instanceof ApiError) || !error.response) return null;
  const response = error.response as Record<string, unknown>;
  const code = error.code ?? (typeof response.code === 'string' ? response.code : null);
  const meta = (error.meta ?? response.meta) as Record<string, unknown> | undefined;
  const productIds = meta?.productIds ?? response.productIds;
  if (
    code === 'DELIVERY_COUNTRY_NOT_ALLOWED' ||
    (error.status === 400 && response.error === 'Selected delivery country is not available')
  ) {
    return { code: 'DELIVERY_COUNTRY_NOT_ALLOWED' };
  }
  if (error.status !== 409) return null;
  if (
    code === 'RESERVATION_EXPIRED' &&
    typeof (meta?.reservationExpiresAt ?? response.reservationExpiresAt) === 'string'
  ) {
    return {
      code: 'RESERVATION_EXPIRED',
      reservationExpiresAt: (meta?.reservationExpiresAt ?? response.reservationExpiresAt) as string,
    };
  }
  if (
    code === 'INSUFFICIENT_STOCK' &&
    Array.isArray(productIds) &&
    productIds.every((id) => typeof id === 'string' || typeof id === 'number')
  ) {
    return {
      code: 'INSUFFICIENT_STOCK',
      productIds: productIds.map(String),
    };
  }
  if (
    code === 'DELIVERY_SLOT_UNAVAILABLE' &&
    typeof (meta?.earliestDate ?? response.earliestDate) === 'string'
  ) {
    return {
      code: 'DELIVERY_SLOT_UNAVAILABLE',
      earliestDate: (meta?.earliestDate ?? response.earliestDate) as string,
    };
  }
  if (
    code === 'PENDING_APPROVAL' &&
    typeof (meta?.approvalRequestId ?? response.approvalRequestId) === 'string'
  ) {
    return {
      code: 'PENDING_APPROVAL',
      approvalRequestId: (meta?.approvalRequestId ?? response.approvalRequestId) as string,
    };
  }
  if (code === 'APPROVAL_REJECTED') return { code: 'APPROVAL_REJECTED' };
  if (code === 'APPROVAL_EXPIRED') return { code: 'APPROVAL_EXPIRED' };
  if (code === 'APPROVAL_TOTAL_DRIFT') return { code: 'APPROVAL_TOTAL_DRIFT' };
  // Legacy routes still expose the identity in `error` while migrations converge.
  if (response.error === 'RESERVATION_EXPIRED' && typeof response.reservationExpiresAt === 'string')
    return { code: 'RESERVATION_EXPIRED', reservationExpiresAt: response.reservationExpiresAt };
  if (response.error === 'INSUFFICIENT_STOCK' && Array.isArray(response.productIds))
    return { code: 'INSUFFICIENT_STOCK', productIds: response.productIds.map(String) };
  if (response.error === 'DELIVERY_SLOT_UNAVAILABLE' && typeof response.earliestDate === 'string')
    return { code: 'DELIVERY_SLOT_UNAVAILABLE', earliestDate: response.earliestDate };
  if (response.error === 'PENDING_APPROVAL' && typeof response.approvalRequestId === 'string')
    return { code: 'PENDING_APPROVAL', approvalRequestId: response.approvalRequestId };
  if (response.error === 'APPROVAL_REJECTED') return { code: 'APPROVAL_REJECTED' };
  if (response.error === 'APPROVAL_EXPIRED') return { code: 'APPROVAL_EXPIRED' };
  if (response.error === 'APPROVAL_TOTAL_DRIFT') return { code: 'APPROVAL_TOTAL_DRIFT' };
  return null;
}

type UsePaymentSubmissionArgs = {
  cartId: string | null;
  /** Cart generation/quote identity. Changes invalidate an in-flight submission. */
  cartGeneration?: string | number;
  cartPresent: boolean;
  state: CheckoutState;
  /** Delivery and schedule steps both validate; the payment step is unreachable otherwise. */
  stepsAreValid: boolean;
  cardIsValid: boolean;
  appliedPromo: string | null;
  dispatch: React.Dispatch<CheckoutEvent>;
  clearCart: (target?: {
    country: Country;
    cartId: string;
    generation?: string | number;
  }) => void | boolean;
  replaceWithOrder: (orderId: string) => void;
  cardFields: CardField[];
};

export function usePaymentSubmission({
  cartId,
  cartGeneration,
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
  const { activeCountry } = useOptionalCountry();
  const identityRef = useRef<{
    token: string;
    country: Country;
    cartId: string | null;
    generation: number;
  } | null>(null);
  const identityToken = `${activeCountry}:${cartId ?? ''}:${cartGeneration ?? ''}`;
  if (identityRef.current === null || identityRef.current.token !== identityToken) {
    identityRef.current = {
      token: identityToken,
      country: activeCountry,
      cartId,
      generation: (identityRef.current?.generation ?? 0) + 1,
    };
  }

  return useCallback(async () => {
    if (!cartId || !cartPresent || state.submitting) return;
    dispatch({ type: 'fields-touched', fields: cardFields });
    if (!stepsAreValid || !cardIsValid) return;
    const deliveryDestination = buildDeliveryDestination(state.delivery);
    const billingSelection = buildBillingSelection(state.billing);
    const deliverySlot = state.schedule.slot;
    // Guarded by `stepsAreValid`; the null checks keep the payload contract-shaped without a cast.
    if (!deliveryDestination || !billingSelection || !deliverySlot) return;
    const submittedIdentity = identityRef.current;
    if (!submittedIdentity || submittedIdentity.cartId !== cartId) return;
    const submittedToken = submittedIdentity.token;
    const submittedGeneration = submittedIdentity.generation;
    const submittedCartGeneration = cartGeneration;
    const isCurrent = () => {
      const current = identityRef.current;
      return current?.token === submittedToken && current.generation === submittedGeneration;
    };
    const purchaseOrderReference = state.billing.purchaseOrderReference.trim();
    dispatch({ type: 'submission-started' });
    try {
      const order = await pay({
        cartId: submittedIdentity.cartId,
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
      if (!isCurrent()) return;
      const cleared = clearCart({
        country: submittedIdentity.country,
        cartId: submittedIdentity.cartId,
        ...(submittedCartGeneration === undefined ? {} : { generation: submittedCartGeneration }),
      });
      // A targeted clear can refuse when another cart won the identity. Never navigate in that
      // case; the order response belongs to the superseded checkout.
      if (cleared === false || !isCurrent()) return;
      replaceWithOrder(order.id);
    } catch (error) {
      if (!isCurrent()) return;
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
      const failure = checkoutErrorState(error, 'checkout.error.generic');
      dispatch({
        type: 'submission-failed',
        error: checkoutCodeToken(failure),
        errorState: failure,
      });
    } finally {
      if (isCurrent()) dispatch({ type: 'submission-finished' });
    }
  }, [
    appliedPromo,
    cardFields,
    cardIsValid,
    cartGeneration,
    cartId,
    cartPresent,
    clearCart,
    dispatch,
    replaceWithOrder,
    state,
    stepsAreValid,
  ]);
}
