export type ContactField = 'customerName' | 'customerEmail' | 'shippingAddress';
export type CardField = 'cardNumber' | 'cardExpiry' | 'cardCvc';
export type Field = ContactField | CardField;
export type FieldErrors = Partial<Record<Field, string>>;

export type MixCheckoutConflict =
  | {
      code: 'MIX_REQUOTE_REQUIRED';
      mixes: Array<{ mixId: string; oldUnitPriceCents: number; newUnitPriceCents: number }>;
    }
  | { code: 'MIX_STOCK_UNAVAILABLE'; mixIds: string[]; productIds: string[] };

export type CheckoutConflict =
  | MixCheckoutConflict
  | { code: 'RESERVATION_EXPIRED'; reservationExpiresAt: string }
  | { code: 'INSUFFICIENT_STOCK'; productIds: string[] };

export type CheckoutState = {
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
  mixConflict: CheckoutConflict | null;
};

export type CheckoutEvent =
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
  | { type: 'mix-conflict'; conflict: CheckoutConflict; idempotencyKey: string }
  | { type: 'submission-started' }
  | { type: 'submission-failed'; error: string }
  | { type: 'submission-finished' };

export const contactFields: ContactField[] = ['customerName', 'customerEmail', 'shippingAddress'];
export const cardFields: CardField[] = ['cardNumber', 'cardExpiry', 'cardCvc'];

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function initialCheckoutState(): CheckoutState {
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
    mixConflict: null,
  };
}

export function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
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
        promoValidating: false,
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
        promoValidating: false,
        mixConflict: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'cart-recovered':
      return { ...state, cartRecoveryMessage: event.message };
    case 'mix-conflict':
      return {
        ...state,
        mixConflict: event.conflict,
        paymentError: null,
        idempotencyKey: event.idempotencyKey,
      };
    case 'submission-started':
      return { ...state, submitting: true, paymentError: null };
    case 'submission-failed':
      return { ...state, paymentError: event.error };
    case 'submission-finished':
      return { ...state, submitting: false };
  }
}

type QuoteItem = { productId: string; quantity: number; lineTotalCents: number };
type QuoteMixItem = {
  mixId: string;
  priceVersion: string;
  quantity: number;
  lineTotalCents: number;
};
type QuoteCart = {
  id: string;
  subtotalCents: number;
  items: QuoteItem[];
  mixItems: QuoteMixItem[];
};

/** Stable against rendering and cart-item ordering. */
export function createCartQuoteKey(cart: QuoteCart | null): string | null {
  if (!cart) return null;
  const lines = [...cart.items]
    .sort((left, right) => left.productId.localeCompare(right.productId))
    .map(({ productId, quantity, lineTotalCents }) => `${productId}:${quantity}:${lineTotalCents}`);
  const mixLines = [...cart.mixItems]
    .sort((left, right) => left.mixId.localeCompare(right.mixId))
    .map(
      ({ mixId, priceVersion, quantity, lineTotalCents }) =>
        `${mixId}:${priceVersion}:${quantity}:${lineTotalCents}`,
    );
  return `${cart.id}:${cart.subtotalCents}:${lines.join('|')}:${mixLines.join('|')}`;
}

export function selectAppliedPromo(state: CheckoutState, quoteKey: string | null): string | null {
  return state.appliedPromoQuoteKey === quoteKey ? state.appliedPromo : null;
}

export function selectDiscountCents(state: CheckoutState, quoteKey: string | null): number {
  return state.appliedPromoQuoteKey === quoteKey ? state.discountCents : 0;
}
