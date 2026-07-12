import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from './CartContext';
import { isEligibleForPromo } from '../features/checkout/cartValidation';
import { validatePromo } from '../api/promo';
import { isMissingCartError } from '../api/client';

interface FormState {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
}

interface FormErrors {
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: string;
}

export function useCheckout() {
  const navigate = useNavigate();
  const { cart, cartId, retryCart } = useCartContext();

  const [form, setForm] = useState<FormState>({
    customerName: '',
    customerEmail: '',
    shippingAddress: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [appliedPromoCartKey, setAppliedPromoCartKey] = useState<string | null>(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [promoTotalCents, setPromoTotalCents] = useState<number | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [cartRecoveryMessage, setCartRecoveryMessage] = useState<string | null>(null);

  const isPromoEligible = cart ? isEligibleForPromo(cart.totalItems) : false;
  const cartQuoteKey = cart
    ? `${cart.id}:${cart.subtotalCents}:${cart.items
        .map((item) => `${item.productId}:${item.quantity}:${item.lineTotalCents}`)
        .join('|')}`
    : null;
  const latestCartQuoteKey = useRef(cartQuoteKey);
  const promoRequestInFlight = useRef(false);
  latestCartQuoteKey.current = cartQuoteKey;
  const promoQuoteIsCurrent = appliedPromoCartKey === cartQuoteKey;
  const currentAppliedPromo = promoQuoteIsCurrent ? appliedPromo : null;
  const currentDiscountCents = promoQuoteIsCurrent ? discountCents : 0;
  const totalCents =
    currentAppliedPromo && promoTotalCents !== null ? promoTotalCents : (cart?.subtotalCents ?? 0);

  useEffect(() => {
    setAppliedPromo(null);
    setAppliedPromoCartKey(null);
    setDiscountCents(0);
    setPromoTotalCents(null);
    setPromoError(null);
  }, [cartQuoteKey]);

  const updatePromoCode = useCallback((value: string) => {
    setPromoCode(value);
    setPromoError(null);
  }, []);

  const updateField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const blurField = useCallback((field: keyof FormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  function validateFormFields(f: FormState): FormErrors {
    const errors: FormErrors = {};
    if (!f.customerName.trim()) errors.customerName = 'Name is required';
    if (!f.customerEmail.trim()) {
      errors.customerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+$/.test(f.customerEmail.trim())) {
      errors.customerEmail = 'Enter a valid email';
    }
    if (!f.shippingAddress.trim()) errors.shippingAddress = 'Address is required';
    return errors;
  }

  const formErrors = useMemo((): FormErrors => {
    const errors: FormErrors = {};
    const allErrors = validateFormFields(form);
    if (touched.customerName && allErrors.customerName)
      errors.customerName = allErrors.customerName;
    if (touched.customerEmail && allErrors.customerEmail)
      errors.customerEmail = allErrors.customerEmail;
    if (touched.shippingAddress && allErrors.shippingAddress)
      errors.shippingAddress = allErrors.shippingAddress;
    return errors;
  }, [form, touched]);

  const getFieldError = useCallback(
    (field: keyof FormState): string | undefined => {
      return formErrors[field];
    },
    [formErrors],
  );

  const handleValidatePromo = useCallback(async () => {
    if (!cartId || !cart || !promoCode.trim() || promoRequestInFlight.current) return;
    const requestedCartQuoteKey = cartQuoteKey;
    promoRequestInFlight.current = true;
    setPromoValidating(true);
    setPromoError(null);
    try {
      const result = await validatePromo(cartId, promoCode.trim());
      if (latestCartQuoteKey.current !== requestedCartQuoteKey) return;
      if (
        result.valid &&
        result.promoCode &&
        result.discountCents !== undefined &&
        result.totalCents !== undefined
      ) {
        setAppliedPromo(result.promoCode.code);
        setAppliedPromoCartKey(requestedCartQuoteKey);
        setDiscountCents(result.discountCents);
        setPromoTotalCents(result.totalCents);
        setPromoError(null);
      } else {
        setPromoError(result.error ?? 'Invalid promo code');
      }
    } catch (err) {
      if (isMissingCartError(err)) {
        const recovered = await retryCart();
        setCartRecoveryMessage(
          recovered
            ? 'Your previous cart was no longer available. A new cart is ready; review it before applying a promo.'
            : 'Your previous cart was no longer available, and a replacement cart could not be prepared. Retry the cart to continue.',
        );
        return;
      }
      if (latestCartQuoteKey.current === requestedCartQuoteKey) {
        setPromoError(err instanceof Error ? err.message : 'Failed to validate promo');
      }
    } finally {
      promoRequestInFlight.current = false;
      setPromoValidating(false);
    }
  }, [cartId, promoCode, cart, cartQuoteKey, retryCart]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setAppliedPromoCartKey(null);
    setDiscountCents(0);
    setPromoTotalCents(null);
    setPromoCode('');
    setPromoError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!cartId || !cart) return;

    const errors = validateFormFields(form);
    setTouched({ customerName: true, customerEmail: true, shippingAddress: true });
    if (Object.keys(errors).length > 0) return;

    // Pass shipping/contact info and promo to payment page via router state
    navigate('/payment', {
      state: {
        cartId,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        shippingAddress: form.shippingAddress.trim(),
        promoCode: currentAppliedPromo ?? null,
        discountCents: currentDiscountCents,
        subtotalCents: cart.subtotalCents,
      },
    });
  }, [cartId, cart, form, currentAppliedPromo, currentDiscountCents, navigate]);

  return {
    cart,
    cartId,
    form,
    updateField,
    blurField,
    getFieldError,
    promoCode,
    setPromoCode: updatePromoCode,
    appliedPromo: currentAppliedPromo,
    discountCents: currentDiscountCents,
    promoError,
    promoValidating,
    isPromoEligible,
    totalCents,
    validatePromo: handleValidatePromo,
    removePromo: handleRemovePromo,
    submitOrder: handleSubmit,
    cartRecoveryMessage,
  };
}
