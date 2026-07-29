import { useCallback, useRef } from 'react';
import { validatePromo } from '@/api/promo';
import { isMissingCartError } from '@/api/client';
import type { CheckoutEvent } from './checkoutState';

type UsePromoQuoteArgs = {
  cartId: string | null;
  cartPresent: boolean;
  quoteKey: string | null;
  promoCode: string;
  dispatch: React.Dispatch<CheckoutEvent>;
  retryCart: () => Promise<boolean>;
};

function createPromoRequestToken(quoteKey: string, promoCode: string): string {
  return JSON.stringify([quoteKey, promoCode.trim()]);
}

type PromoRequest = { candidate: string; generation: number };

export function usePromoQuote({
  cartId,
  cartPresent,
  quoteKey,
  promoCode,
  dispatch,
  retryCart,
}: UsePromoQuoteArgs) {
  const candidateRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const activeRequest = useRef<PromoRequest | null>(null);
  const normalizedPromoCode = promoCode.trim();
  const currentCandidate =
    quoteKey && normalizedPromoCode ? createPromoRequestToken(quoteKey, normalizedPromoCode) : null;
  if (candidateRef.current !== currentCandidate) {
    candidateRef.current = currentCandidate;
    generationRef.current += 1;
  }

  return useCallback(async () => {
    if (!cartId || !cartPresent || !quoteKey || !normalizedPromoCode || !currentCandidate) return;

    const requestedQuoteKey = quoteKey;
    const requested: PromoRequest = {
      candidate: currentCandidate,
      generation: generationRef.current,
    };
    if (
      activeRequest.current?.candidate === requested.candidate &&
      activeRequest.current.generation === requested.generation
    ) {
      return;
    }
    const isCurrent = () =>
      candidateRef.current === requested.candidate &&
      generationRef.current === requested.generation;

    activeRequest.current = requested;
    if (!isCurrent()) return;
    dispatch({ type: 'promo-started' });
    try {
      const result = await validatePromo(cartId, normalizedPromoCode);
      if (!isCurrent()) return;
      if (
        result.valid &&
        result.promoCode &&
        result.discountCents !== undefined &&
        result.totalCents !== undefined
      ) {
        dispatch({
          type: 'promo-applied',
          promoCode: result.promoCode.code,
          quoteKey: requestedQuoteKey,
          discountCents: result.discountCents,
          discountBaseCents: result.discountBaseCents ?? null,
          promoCategoryScope: result.promoCode.categoryScope ?? null,
          totalCents: result.totalCents,
        });
      } else {
        dispatch({
          type: 'promo-failed',
          error: result.error ?? 'Invalid promo code',
          errorCode: result.errorCode ?? null,
        });
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (isMissingCartError(error)) {
        const recovered = await retryCart();
        if (!isCurrent()) return;
        dispatch({
          type: 'cart-recovered',
          message: recovered
            ? 'Your previous cart was no longer available. A new cart is ready; review it before applying a promo.'
            : 'Your previous cart was no longer available, and a replacement cart could not be prepared. Retry the cart to continue.',
        });
      } else {
        dispatch({
          type: 'promo-failed',
          error: error instanceof Error ? error.message : 'Failed to validate promo',
          errorCode: null,
        });
      }
    } finally {
      if (
        activeRequest.current?.candidate === requested.candidate &&
        activeRequest.current.generation === requested.generation &&
        isCurrent()
      ) {
        activeRequest.current = null;
      }
    }
  }, [cartId, cartPresent, currentCandidate, dispatch, normalizedPromoCode, quoteKey, retryCart]);
}
