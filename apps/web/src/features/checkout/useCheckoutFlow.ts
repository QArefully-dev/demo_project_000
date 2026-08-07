import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { DeliverySlot } from '@shop/contracts/delivery';
import { useCartContext } from '@/hooks/CartContext';
import { useAuth } from '@/hooks/AuthContext';
import { useLocalisation } from '@/i18n/LocaleContext';
import { checkoutMessages } from '@shop/localisation/messages/checkout';
import { useTradeProfile } from '@/features/account/useTradeProfile';
import { isEligibleForPromo } from './cartValidation';
import {
  cardFields,
  checkoutReducer,
  contactFields,
  createCartQuoteKey,
  createIdempotencyKey,
  deliveryStepFields,
  initialCheckoutState,
  scheduleStepFields,
  selectAppliedPromo,
  selectDiscountCents,
  type CheckoutBilling,
  type CheckoutDelivery,
  type Field,
} from './checkoutState';
import {
  buildBillingSelection,
  buildDeliveryDestination,
  validateBilling,
  validateCard,
  validateContact,
  validateDelivery,
  validateSchedule,
} from './checkoutValidation';
import { useCheckoutNavigation } from './useCheckoutNavigation';
import { useDeliverySlots } from './useDeliverySlots';
import { usePaymentSubmission } from './usePaymentSubmission';
import { usePromoQuote } from './usePromoQuote';
import { localizeCheckoutError } from './checkoutCopy';

/** CheckoutPage compatibility facade. Feature concerns live in focused modules. */
export function useCheckoutFlow() {
  const { cart, cartId, cartGeneration, clearCart, retryCart } = useCartContext();
  const { user } = useAuth();
  const { translate } = useLocalisation();
  const isAuthenticated = user !== null;
  const [state, dispatch] = useReducer(checkoutReducer, undefined, initialCheckoutState);
  const quoteKey = createCartQuoteKey(cart);
  const tradeProfile = useTradeProfile();
  const slots = useDeliverySlots(cartId, quoteKey);
  const offeredSlots = useMemo(() => slots.options?.slots ?? [], [slots.options]);

  const contactErrors = useMemo(() => validateContact(state.contact), [state.contact]);
  const deliveryValidation = useMemo(() => validateDelivery(state.delivery), [state.delivery]);
  const scheduleErrors = useMemo(
    () => validateSchedule(state.schedule, offeredSlots),
    [offeredSlots, state.schedule],
  );
  const billingValidation = useMemo(() => validateBilling(state.billing), [state.billing]);
  const cardErrors = useMemo(() => validateCard(state.card), [state.card]);

  const deliveryIsValid =
    Object.keys(contactErrors).length === 0 &&
    Object.keys(deliveryValidation.errors).length === 0 &&
    Object.keys(deliveryValidation.addressErrors).length === 0;
  const scheduleIsValid =
    Object.keys(scheduleErrors).length === 0 &&
    Object.keys(billingValidation.errors).length === 0 &&
    Object.keys(billingValidation.addressErrors).length === 0;
  const cardIsValid = Object.keys(cardErrors).length === 0;
  const navigation = useCheckoutNavigation(deliveryIsValid, scheduleIsValid);

  useEffect(() => {
    dispatch({ type: 'quote-changed', idempotencyKey: createIdempotencyKey() });
  }, [quoteKey]);

  // One-shot preselection of the buyer's default trade records. The reducer ignores these once the
  // buyer has touched the group, so a later list reload cannot overwrite an explicit choice.
  const savedSites = tradeProfile.deliverySites.items;
  const savedBillingEntities = tradeProfile.billingEntities.items;
  useEffect(() => {
    if (!isAuthenticated || tradeProfile.deliverySites.loading || savedSites.length === 0) return;
    const defaultSite = savedSites.find((site) => site.isDefault) ?? savedSites[0]!;
    dispatch({
      type: 'delivery-sites-loaded',
      defaultSiteId: defaultSite.id,
      idempotencyKey: createIdempotencyKey(),
    });
  }, [isAuthenticated, savedSites, tradeProfile.deliverySites.loading]);
  useEffect(() => {
    if (
      !isAuthenticated ||
      tradeProfile.billingEntities.loading ||
      savedBillingEntities.length === 0
    )
      return;
    const defaultEntity =
      savedBillingEntities.find((entity) => entity.isDefault) ?? savedBillingEntities[0]!;
    dispatch({
      type: 'billing-entities-loaded',
      defaultEntityId: defaultEntity.id,
      idempotencyKey: createIdempotencyKey(),
    });
  }, [isAuthenticated, savedBillingEntities, tradeProfile.billingEntities.loading]);

  const appliedPromo = selectAppliedPromo(state, quoteKey);
  const discountCents = selectDiscountCents(state, quoteKey);
  const discountBaseCents = appliedPromo ? state.discountBaseCents : null;
  const promoCategoryScope = appliedPromo ? state.promoCategoryScope : null;
  const deliveryChargeCents = cart?.deliveryPreview?.chargeCents ?? 0;
  const totalCents =
    appliedPromo && state.promoTotalCents !== null
      ? state.promoTotalCents
      : (cart?.subtotalCents ?? 0) - discountCents + deliveryChargeCents;
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
    cartGeneration,
    cartPresent: Boolean(cart),
    state,
    stepsAreValid: deliveryIsValid && scheduleIsValid,
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
  const updateDelivery = useCallback(
    (patch: Partial<CheckoutDelivery>) =>
      dispatch({ type: 'delivery-changed', patch, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const updateSchedule = useCallback(
    (slot: DeliverySlot | null) =>
      dispatch({ type: 'schedule-changed', slot, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const updateBilling = useCallback(
    (patch: Partial<CheckoutBilling>) =>
      dispatch({ type: 'billing-changed', patch, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const updateCard = useCallback(
    (field: (typeof cardFields)[number], value: string) =>
      dispatch({ type: 'card-changed', field, value, idempotencyKey: createIdempotencyKey() }),
    [],
  );
  const touchField = useCallback((field: Field) => dispatch({ type: 'field-touched', field }), []);
  const goToSchedule = useCallback(() => {
    dispatch({ type: 'fields-touched', fields: deliveryStepFields });
    if (deliveryIsValid) navigation.goToSchedule();
  }, [deliveryIsValid, navigation]);
  const goToPayment = useCallback(() => {
    dispatch({ type: 'fields-touched', fields: scheduleStepFields });
    if (scheduleIsValid) navigation.goToPayment();
  }, [navigation, scheduleIsValid]);
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
      state.touched[field]
        ? (contactErrors[field] ??
          deliveryValidation.errors[field] ??
          scheduleErrors[field] ??
          billingValidation.errors[field] ??
          cardErrors[field])
        : undefined,
    [
      billingValidation.errors,
      cardErrors,
      contactErrors,
      deliveryValidation.errors,
      scheduleErrors,
      state.touched,
    ],
  );

  // Address errors surface only once the owning step has been submitted, matching field-level
  // touch behaviour: an untouched form must not open covered in red.
  const deliveryAddressErrors = state.touched.deliverySiteId
    ? deliveryValidation.addressErrors
    : {};
  const billingAddressErrors = state.touched.billingEntityId ? billingValidation.addressErrors : {};

  const paymentError = localizeCheckoutError(state.paymentErrorState, translate);
  const promoError = localizeCheckoutError(state.promoErrorState, translate);

  const destinationSummary = useMemo(() => {
    if (state.delivery.destinationKind === 'saved') {
      return savedSites.find((site) => site.id === state.delivery.deliverySiteId)?.label ?? null;
    }
    const destination = buildDeliveryDestination(state.delivery);
    return destination?.kind === 'adhoc'
      ? [destination.address.line1, destination.address.city, destination.address.postcode].join(
          ', ',
        )
      : null;
  }, [savedSites, state.delivery]);

  const billingSummary = useMemo(() => {
    if (state.billing.selectionKind === 'saved') {
      return (
        savedBillingEntities.find((entity) => entity.id === state.billing.billingEntityId)
          ?.legalName ?? null
      );
    }
    const selection = buildBillingSelection(state.billing);
    return selection?.kind === 'adhoc' ? selection.billingEntity.legalName : null;
  }, [savedBillingEntities, state.billing]);

  return {
    cart,
    cartId,
    step: navigation.step,
    isAuthenticated,
    contact: state.contact,
    delivery: state.delivery,
    schedule: state.schedule,
    billing: state.billing,
    card: state.card,
    savedSites,
    savedSitesLoading: tradeProfile.deliverySites.loading,
    savedSitesError: tradeProfile.deliverySites.error,
    reloadSavedSites: tradeProfile.reloadDeliverySites,
    savedBillingEntities,
    savedBillingEntitiesLoading: tradeProfile.billingEntities.loading,
    savedBillingEntitiesError: tradeProfile.billingEntities.error,
    reloadSavedBillingEntities: tradeProfile.reloadBillingEntities,
    slotOptions: slots.options,
    slotsLoading: slots.loading,
    slotsError: slots.error,
    reloadSlots: slots.reload,
    deliveryAddressErrors,
    billingAddressErrors,
    destinationSummary,
    billingSummary,
    purchaseOrderReference: state.billing.purchaseOrderReference.trim() || null,
    promoCode: state.promoCode,
    appliedPromo,
    discountCents,
    discountBaseCents,
    promoCategoryScope,
    totalCents,
    promoError:
      promoError ??
      (state.promoError ? translate(checkoutMessages, 'checkout.promoError.invalid') : null),
    promoErrorState: state.promoErrorState,
    promoErrorCode: state.promoErrorCode,
    promoMinSubtotalCents: state.promoMinSubtotalCents,
    promoValidating: state.promoValidating,
    isPromoEligible: cart ? isEligibleForPromo(cart.totalItems) : false,
    submitting: state.submitting,
    paymentError:
      paymentError ??
      (state.paymentError ? translate(checkoutMessages, 'checkout.error.generic') : null),
    paymentErrorState: state.paymentErrorState,
    conflict: state.conflict,
    cartRecoveryMessage: state.cartRecoveryMessage,
    fieldError,
    updateContact,
    updateDelivery,
    updateSchedule,
    updateBilling,
    updateCard,
    touchField,
    goToSchedule,
    goToPayment,
    goToDelivery: navigation.goToDelivery,
    goToScheduleStep: navigation.goToSchedule,
    updatePromoCode,
    applyPromo,
    removePromo,
    submitPayment,
  };
}
