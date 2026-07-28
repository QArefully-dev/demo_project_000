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

  it('rotates the idempotency key for every new checkout field group', () => {
    let state = initialCheckoutState();
    state = checkoutReducer(state, {
      type: 'delivery-changed',
      patch: { destinationKind: 'saved', deliverySiteId: '4' },
      idempotencyKey: 'after-destination',
    });
    expect(state.idempotencyKey).toBe('after-destination');
    expect(state.delivery).toMatchObject({ destinationKind: 'saved', deliverySiteId: '4' });

    state = checkoutReducer(state, {
      type: 'schedule-changed',
      slot: { date: '2026-08-03', window: 'am' },
      idempotencyKey: 'after-slot',
    });
    expect(state.idempotencyKey).toBe('after-slot');

    state = checkoutReducer(state, {
      type: 'billing-changed',
      patch: { purchaseOrderReference: 'PO-42' },
      idempotencyKey: 'after-po',
    });
    expect(state.idempotencyKey).toBe('after-po');
    expect(state.billing.purchaseOrderReference).toBe('PO-42');
  });

  it('preselects a default site only until the buyer chooses for themselves', () => {
    let state = initialCheckoutState();
    state = checkoutReducer(state, {
      type: 'delivery-sites-loaded',
      defaultSiteId: '2',
      idempotencyKey: 'preselect',
    });
    expect(state.delivery).toMatchObject({ destinationKind: 'saved', deliverySiteId: '2' });

    state = checkoutReducer(state, {
      type: 'delivery-changed',
      patch: { destinationKind: 'adhoc', deliverySiteId: '' },
      idempotencyKey: 'buyer-choice',
    });
    const afterChoice = checkoutReducer(state, {
      type: 'delivery-sites-loaded',
      defaultSiteId: '2',
      idempotencyKey: 'late-reload',
    });
    expect(afterChoice).toBe(state);
  });

  it('clears only a slot-unavailable conflict when a new slot is chosen', () => {
    let state = initialCheckoutState();
    state = checkoutReducer(state, {
      type: 'conflict',
      conflict: { code: 'DELIVERY_SLOT_UNAVAILABLE', earliestDate: '2026-08-05' },
      idempotencyKey: 'conflict',
    });
    state = checkoutReducer(state, {
      type: 'schedule-changed',
      slot: { date: '2026-08-05', window: 'pm' },
      idempotencyKey: 'reschedule',
    });
    expect(state.conflict).toBeNull();

    state = checkoutReducer(state, {
      type: 'conflict',
      conflict: { code: 'INSUFFICIENT_STOCK', productIds: ['1'] },
      idempotencyKey: 'stock',
    });
    state = checkoutReducer(state, {
      type: 'schedule-changed',
      slot: { date: '2026-08-06', window: 'am' },
      idempotencyKey: 'reschedule-2',
    });
    expect(state.conflict).toEqual({ code: 'INSUFFICIENT_STOCK', productIds: ['1'] });
  });

  it('creates an order-stable quote key', () => {
    const first = {
      id: 'cart',
      subtotalCents: 300,
      items: [
        { productId: 'b', quantity: 1, lineTotalCents: 200 },
        { productId: 'a', quantity: 1, lineTotalCents: 100 },
      ],
    };
    const reordered = { ...first, items: [...first.items].reverse() };

    expect(createCartQuoteKey(first)).toBe(createCartQuoteKey(reordered));
  });
});
