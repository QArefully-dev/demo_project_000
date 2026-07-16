import { describe, expect, it } from 'vitest';
import { checkoutReducer, createCartQuoteKey, initialCheckoutState } from './checkoutState';

describe('checkoutState', () => {
  it('transitions contact, card, promo, quote, and submission state', () => {
    let state = initialCheckoutState();
    state = checkoutReducer(state, {
      type: 'contact-changed',
      field: 'customerName',
      value: 'Ava',
      idempotencyKey: 'contact',
    });
    state = checkoutReducer(state, {
      type: 'card-changed',
      field: 'cardCvc',
      value: '123',
      idempotencyKey: 'card',
    });
    state = checkoutReducer(state, {
      type: 'promo-changed',
      value: 'SAVE10',
      idempotencyKey: 'promo',
    });
    state = checkoutReducer(state, { type: 'promo-started' });
    state = checkoutReducer(state, {
      type: 'promo-applied',
      promoCode: 'SAVE10',
      quoteKey: 'quote-a',
      discountCents: 100,
      totalCents: 900,
    });
    state = checkoutReducer(state, { type: 'submission-started' });

    expect(state).toMatchObject({
      contact: { customerName: 'Ava' },
      card: { cardCvc: '123' },
      promoCode: 'SAVE10',
      appliedPromo: 'SAVE10',
      discountCents: 100,
      submitting: true,
      idempotencyKey: 'promo',
    });

    state = checkoutReducer(state, { type: 'quote-changed', idempotencyKey: 'cart-change' });
    state = checkoutReducer(state, { type: 'submission-failed', error: 'declined' });
    state = checkoutReducer(state, { type: 'submission-finished' });
    expect(state).toMatchObject({
      appliedPromo: null,
      discountCents: 0,
      promoValidating: false,
      submitting: false,
      paymentError: 'declined',
      idempotencyKey: 'cart-change',
    });
  });

  it('creates an order-stable quote key', () => {
    const first = {
      id: 'cart',
      subtotalCents: 300,
      items: [
        { productId: 'b', quantity: 1, lineTotalCents: 200 },
        { productId: 'a', quantity: 1, lineTotalCents: 100 },
      ],
      mixItems: [],
    };
    const reordered = { ...first, items: [...first.items].reverse() };

    expect(createCartQuoteKey(first)).toBe(createCartQuoteKey(reordered));
  });
});
