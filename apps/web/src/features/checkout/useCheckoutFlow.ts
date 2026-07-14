import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { validatePromo } from '@/api/promo';
import { pay } from '@/api/payments';
import { ApiError, isMissingCartError } from '@/api/client';
import { useCartContext } from '@/hooks/CartContext';
import { isEligibleForPromo } from './cartValidation';

type ContactField = 'customerName' | 'customerEmail' | 'shippingAddress';
type CardField = 'cardNumber' | 'cardExpiry' | 'cardCvc';
type Field = ContactField | CardField;
type FieldErrors = Partial<Record<Field, string>>;

type CheckoutState = {
  contact: Record<ContactField, string>;
  card: Record<CardField, string>;
  touched: Partial<Record<Field, boolean>>;
  promoCode: string;
  appliedPromo: string | null;
  appliedPromoQuoteKey: string | null;
  discountCents: number;
  promoTotalCents: number | null;
  promoError: string | null;
  promoValidating: boolean;
  submitting: boolean;
  paymentError: string | null;
  idempotencyKey: string;
  cartRecoveryMessage: string | null;
};

type CheckoutEvent =
  | { type: 'contact-changed'; field: ContactField; value: string; idempotencyKey: string }
  | { type: 'card-changed'; field: CardField; value: string; idempotencyKey: string }
  | { type: 'field-touched'; field: Field }
  | { type: 'fields-touched'; fields: Field[] }
  | { type: 'promo-changed'; value: string; idempotencyKey: string }
  | { type: 'promo-started' }
  | {
      type: 'promo-applied';
      promoCode: string;
      quoteKey: string;
      discountCents: number;
      totalCents: number;
    }
  | { type: 'promo-failed'; error: string }
  | { type: 'promo-removed'; idempotencyKey: string }
  | { type: 'quote-changed'; idempotencyKey: string }
  | { type: 'cart-recovered'; message: string }
  | { type: 'submission-started' }
  | { type: 'submission-failed'; error: string }
  | { type: 'submission-finished' };

const contactFields: ContactField[] = ['customerName', 'customerEmail', 'shippingAddress'];
const cardFields: CardField[] = ['cardNumber', 'cardExpiry', 'cardCvc'];

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function initialState(): CheckoutState {
  return {
    contact: { customerName: '', customerEmail: '', shippingAddress: '' },
    card: { cardNumber: '', cardExpiry: '', cardCvc: '' },
    touched: {},
    promoCode: '',
    appliedPromo: null,
    appliedPromoQuoteKey: null,
    discountCents: 0,
    promoTotalCents: null,
    promoError: null,
    promoValidating: false,
    submitting: false,
    paymentError: null,
    idempotencyKey: createIdempotencyKey(),
    cartRecoveryMessage: null,
  };
}

function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case 'contact-changed':
      return {
        ...state,
        contact: { ...state.contact, [event.field]: event.value },
        paymentError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'card-changed':
      return {
        ...state,
        card: { ...state.card, [event.field]: event.value },
        paymentError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'field-touched':
      return { ...state, touched: { ...state.touched, [event.field]: true } };
    case 'fields-touched':
      return {
        ...state,
        touched: {
          ...state.touched,
          ...Object.fromEntries(event.fields.map((field) => [field, true])),
        },
      };
    case 'promo-changed':
      return {
        ...state,
        promoCode: event.value,
        promoError: null,
        paymentError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'promo-started':
      return { ...state, promoValidating: true, promoError: null };
    case 'promo-applied':
      return {
        ...state,
        promoValidating: false,
        promoError: null,
        appliedPromo: event.promoCode,
        appliedPromoQuoteKey: event.quoteKey,
        discountCents: event.discountCents,
        promoTotalCents: event.totalCents,
      };
    case 'promo-failed':
      return { ...state, promoValidating: false, promoError: event.error };
    case 'promo-removed':
      return {
        ...state,
        promoCode: '',
        appliedPromo: null,
        appliedPromoQuoteKey: null,
        discountCents: 0,
        promoTotalCents: null,
        promoError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'quote-changed':
      return {
        ...state,
        appliedPromo: null,
        appliedPromoQuoteKey: null,
        discountCents: 0,
        promoTotalCents: null,
        promoError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'cart-recovered':
      return { ...state, cartRecoveryMessage: event.message };
    case 'submission-started':
      return { ...state, submitting: true, paymentError: null };
    case 'submission-failed':
      return { ...state, paymentError: event.error };
    case 'submission-finished':
      return { ...state, submitting: false };
  }
}

function validateContact(contact: CheckoutState['contact']): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.customerName.trim()) errors.customerName = 'Name is required';
  if (!contact.customerEmail.trim()) errors.customerEmail = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+$/.test(contact.customerEmail.trim())) {
    errors.customerEmail = 'Enter a valid email';
  }
  if (!contact.shippingAddress.trim()) errors.shippingAddress = 'Address is required';
  return errors;
}

function validateCard(card: CheckoutState['card']): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[0-9 -]{12,25}$/.test(card.cardNumber)) errors.cardNumber = 'Enter a valid card number';
  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(card.cardExpiry)) {
    errors.cardExpiry = 'Enter expiry as MM/YY';
  }
  if (!/^[0-9]{3,4}$/.test(card.cardCvc)) errors.cardCvc = 'Enter a valid CVC';
  return errors;
}

export function useCheckoutFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartId, clearCart, retryCart } = useCartContext();
  const [state, dispatch] = useReducer(checkoutReducer, undefined, initialState);
  const promoRequestInFlight = useRef(false);
  const cartQuoteKey = cart
    ? `${cart.id}:${cart.subtotalCents}:${cart.items
        .map((item) => `${item.productId}:${item.quantity}:${item.lineTotalCents}`)
        .join('|')}`
    : null;
  const latestCartQuoteKey = useRef(cartQuoteKey);
  const paymentRequested = new URLSearchParams(location.search).get('step') === 'payment';
  const contactErrors = useMemo(() => validateContact(state.contact), [state.contact]);
  const cardErrors = useMemo(() => validateCard(state.card), [state.card]);
  const contactIsValid = Object.keys(contactErrors).length === 0;

  latestCartQuoteKey.current = cartQuoteKey;

  useEffect(() => {
    dispatch({ type: 'quote-changed', idempotencyKey: createIdempotencyKey() });
  }, [cartQuoteKey]);

  useEffect(() => {
    if (paymentRequested && !contactIsValid) navigate('/checkout', { replace: true });
  }, [contactIsValid, navigate, paymentRequested]);

  const currentAppliedPromo =
    state.appliedPromoQuoteKey === cartQuoteKey ? state.appliedPromo : null;
  const currentDiscountCents =
    state.appliedPromoQuoteKey === cartQuoteKey ? state.discountCents : 0;
  const totalCents =
    currentAppliedPromo && state.promoTotalCents !== null
      ? state.promoTotalCents
      : (cart?.subtotalCents ?? 0);

  const updateContact = useCallback((field: ContactField, value: string) => {
    dispatch({ type: 'contact-changed', field, value, idempotencyKey: createIdempotencyKey() });
  }, []);
  const updateCard = useCallback((field: CardField, value: string) => {
    dispatch({ type: 'card-changed', field, value, idempotencyKey: createIdempotencyKey() });
  }, []);
  const touchField = useCallback((field: Field) => dispatch({ type: 'field-touched', field }), []);

  const goToPayment = useCallback(() => {
    dispatch({ type: 'fields-touched', fields: contactFields });
    if (!contactIsValid) return;
    navigate('/checkout?step=payment');
  }, [contactIsValid, navigate]);
  const goToContact = useCallback(() => navigate('/checkout'), [navigate]);

  const updatePromoCode = useCallback((value: string) => {
    dispatch({ type: 'promo-changed', value, idempotencyKey: createIdempotencyKey() });
  }, []);
  const applyPromo = useCallback(async () => {
    if (
      !cartId ||
      !cart ||
      !cartQuoteKey ||
      !state.promoCode.trim() ||
      promoRequestInFlight.current
    )
      return;
    const requestedQuoteKey = cartQuoteKey;
    promoRequestInFlight.current = true;
    dispatch({ type: 'promo-started' });
    try {
      const result = await validatePromo(cartId, state.promoCode.trim());
      if (latestCartQuoteKey.current !== requestedQuoteKey) return;
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
          totalCents: result.totalCents,
        });
      } else {
        dispatch({ type: 'promo-failed', error: result.error ?? 'Invalid promo code' });
      }
    } catch (error) {
      if (isMissingCartError(error)) {
        const recovered = await retryCart();
        dispatch({
          type: 'cart-recovered',
          message: recovered
            ? 'Your previous cart was no longer available. A new cart is ready; review it before applying a promo.'
            : 'Your previous cart was no longer available, and a replacement cart could not be prepared. Retry the cart to continue.',
        });
      } else if (latestCartQuoteKey.current === requestedQuoteKey) {
        dispatch({
          type: 'promo-failed',
          error: error instanceof Error ? error.message : 'Failed to validate promo',
        });
      }
    } finally {
      promoRequestInFlight.current = false;
    }
  }, [cart, cartId, cartQuoteKey, retryCart, state.promoCode]);

  const removePromo = useCallback(
    () => dispatch({ type: 'promo-removed', idempotencyKey: createIdempotencyKey() }),
    [],
  );

  const submitPayment = useCallback(async () => {
    if (!cartId || !cart || state.submitting) return;
    dispatch({ type: 'fields-touched', fields: cardFields });
    if (!contactIsValid || Object.keys(cardErrors).length > 0) return;
    dispatch({ type: 'submission-started' });
    try {
      const order = await pay({
        cartId,
        promoCode: currentAppliedPromo ?? undefined,
        customerName: state.contact.customerName.trim(),
        customerEmail: state.contact.customerEmail.trim(),
        shippingAddress: state.contact.shippingAddress.trim(),
        cardNumber: state.card.cardNumber,
        cardExpiry: state.card.cardExpiry,
        cardCvc: state.card.cardCvc,
        idempotencyKey: state.idempotencyKey,
      });
      clearCart();
      navigate(`/order-confirmation/${order.id}`, { replace: true });
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
  }, [cardErrors, cart, cartId, clearCart, contactIsValid, currentAppliedPromo, navigate, state]);

  const fieldError = useCallback(
    (field: Field) => {
      if (!state.touched[field]) return undefined;
      return contactErrors[field] ?? cardErrors[field];
    },
    [cardErrors, contactErrors, state.touched],
  );

  return {
    cart,
    cartId,
    step: paymentRequested ? 'payment' : 'contact',
    contact: state.contact,
    card: state.card,
    promoCode: state.promoCode,
    appliedPromo: currentAppliedPromo,
    discountCents: currentDiscountCents,
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
    goToContact,
    updatePromoCode,
    applyPromo,
    removePromo,
    submitPayment,
  };
}
