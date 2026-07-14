import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useCartContext } from '@/hooks/CartContext';
import { isEligibleForPromo } from './cartValidation';
import {
  cardFields,
  checkoutReducer,
  contactFields,
  createCartQuoteKey,
  createIdempotencyKey,
  initialCheckoutState,
  selectAppliedPromo,
  selectDiscountCents,
  type Field,
} from './checkoutState';
import { validateCard, validateContact } from './checkoutValidation';
import { useCheckoutNavigation } from './useCheckoutNavigation';
import { usePaymentSubmission } from './usePaymentSubmission';
import { usePromoQuote } from './usePromoQuote';

/** CheckoutPage compatibility facade. Feature concerns live in focused modules. */
export function useCheckoutFlow() {
  const { cart, cartId, clearCart, retryCart } = useCartContext();
  const [state, dispatch] = useReducer(checkoutReducer, undefined, initialCheckoutState);
  const quoteKey = createCartQuoteKey(cart);
  const contactErrors = useMemo(() => validateContact(state.contact), [state.contact]);
  const cardErrors = useMemo(() => validateCard(state.card), [state.card]);
  const contactIsValid = Object.keys(contactErrors).length === 0;
  const cardIsValid = Object.keys(cardErrors).length === 0;
  const navigation = useCheckoutNavigation(contactIsValid);

  useEffect(() => {
    dispatch({ type: 'quote-changed', idempotencyKey: createIdempotencyKey() });
  }, [quoteKey]);

  const appliedPromo = selectAppliedPromo(state, quoteKey);
  const discountCents = selectDiscountCents(state, quoteKey);
  const totalCents =
    appliedPromo && state.promoTotalCents !== null
      ? state.promoTotalCents
      : (cart?.subtotalCents ?? 0);
  const applyPromo = usePromoQuote({
    cartId,
    cartPresent: Boolean(cart),
    quoteKey,
    promoCode: state.promoCode,
    dispatch,
    retryCart,
  });
  const submitPayment = usePaymentSubmission({
    cartId,
    cartPresent: Boolean(cart),
    state,
    contactIsValid,
    cardIsValid,
    appliedPromo,
    dispatch,
    clearCart,
    replaceWithOrder: navigation.replaceWithOrder,
    cardFields,
  });

  const updateContact = useCallback(
    (field: (typeof contactFields)[number], value: string) =>
      dispatch({ type: 'contact-changed', field, value, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const updateCard = useCallback(
    (field: (typeof cardFields)[number], value: string) =>
      dispatch({ type: 'card-changed', field, value, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const touchField = useCallback((field: Field) => dispatch({ type: 'field-touched', field }), []);
  const goToPayment = useCallback(() => {
    dispatch({ type: 'fields-touched', fields: contactFields });
    if (contactIsValid) navigation.goToPayment();
  }, [contactIsValid, navigation]);
  const updatePromoCode = useCallback(
    (value: string) =>
      dispatch({ type: 'promo-changed', value, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const removePromo = useCallback(
    () => dispatch({ type: 'promo-removed', idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const fieldError = useCallback(
    (field: Field) =>
      state.touched[field] ? (contactErrors[field] ?? cardErrors[field]) : undefined,
    [cardErrors, contactErrors, state.touched],
  );

  return {
    cart,
    cartId,
    step: navigation.step,
    contact: state.contact,
    card: state.card,
    promoCode: state.promoCode,
    appliedPromo,
    discountCents,
    totalCents,
    promoError: state.promoError,
    promoValidating: state.promoValidating,
    isPromoEligible: cart ? isEligibleForPromo(cart.totalItems) : false,
    submitting: state.submitting,
    paymentError: state.paymentError,
    cartRecoveryMessage: state.cartRecoveryMessage,
    fieldError,
    updateContact,
    updateCard,
    touchField,
    goToPayment,
    goToContact: navigation.goToContact,
    updatePromoCode,
    applyPromo,
    removePromo,
    submitPayment,
  };
}
