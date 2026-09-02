import assert from 'node:assert/strict';
import test from 'node:test';
import type { Cart } from '@shop/contracts/cart';
import type { CheckoutParams } from './checkoutTypes.js';
import { createCheckoutQuote } from './checkoutQuote.js';

const testPostalAddress = {
  line1: '1 Test Street',
  city: 'Testville',
  postcode: 'TS1 1TS',
  countryCode: 'GB' as const,
};

const cartId = '00000000-0000-4000-8000-000000000041';
const createdAt = '2026-09-01T00:00:00.000Z';
const slot = { date: '2026-09-10', window: 'am' as const };
const cart = {
  id: cartId,
  items: [],
  subtotalCents: 10_000,
  discountableSubtotalCents: 10_000,
  blendingFeeTotalCents: 0,
  totalItems: 0,
} as unknown as Cart;
const checkout = {
  cartId,
  customerName: ' Ada Shopper ',
  customerEmail: ' ADA@EXAMPLE.TEST ',
  deliveryDestination: { kind: 'adhoc' as const, address: testPostalAddress },
  billingSelection: {
    kind: 'adhoc' as const,
    billingEntity: { legalName: 'Ada Materials Ltd', address: testPostalAddress },
  },
  deliverySlot: slot,
  idempotencyKey: '00000000-0000-4000-8000-000000000042',
  userId: 7,
  auditContext: { actor: { type: 'user' as const, userId: 7 }, requestId: 'quote-test' },
} satisfies Omit<CheckoutParams, 'cardNumber' | 'cardExpiry' | 'cardCvc'>;
const resolved = {
  deliverySiteId: null,
  deliveryAddress: testPostalAddress,
  billingEntity: {
    legalName: 'Ada Materials Ltd',
    registrationNumber: null,
    vatNumber: null,
    address: testPostalAddress,
  },
  deliverySlot: slot,
  purchaseOrderReference: null,
};

void test('current quote writer freezes exact trade-credit identity and invoice facts', () => {
  const quote = createCheckoutQuote({
    cart,
    checkout: { ...checkout, paymentMethod: 'trade_credit' },
    resolved,
    promo: undefined,
    createdAt,
    inventoryAllocations: [],
    country: 'DE',
    paymentMethod: 'trade_credit',
    companyId: '9',
  });

  assert.equal(quote.version, 10);
  assert.equal(quote.country, 'DE');
  assert.equal(quote.paymentMethod, 'trade_credit');
  assert.equal(quote.userId, 7);
  assert.equal(quote.companyId, '9');
  assert.equal(quote.netCents, 10_000);
  assert.equal(quote.vatRateBasisPoints, 1_900);
  assert.equal(quote.vatCents, 1_900);
  assert.equal(quote.grossCents, 11_900);
  assert.equal(quote.totalCents, 11_900);
  assert.equal(quote.terms, 'net_30');
  assert.equal('cardNumber' in quote, false);
  assert.equal('cardCvc' in quote, false);
});

void test('card quote stays VAT-free and company-free while using V10 facts', () => {
  const quote = createCheckoutQuote({
    cart,
    checkout: { ...checkout, userId: null, paymentMethod: 'card' },
    resolved,
    promo: undefined,
    createdAt,
    inventoryAllocations: [],
    country: 'US',
    paymentMethod: 'card',
  });

  assert.equal(quote.version, 10);
  assert.equal(quote.country, 'US');
  assert.equal(quote.paymentMethod, 'card');
  assert.equal(quote.userId, null);
  assert.equal(quote.companyId, null);
  assert.equal(quote.netCents, 10_000);
  assert.equal(quote.vatRateBasisPoints, 0);
  assert.equal(quote.vatCents, 0);
  assert.equal(quote.grossCents, 10_000);
  assert.equal(quote.totalCents, 10_000);
  assert.equal('terms' in quote, false);
});

void test('quote writer rejects credit identity or accounting drift', () => {
  assert.throws(
    () =>
      createCheckoutQuote({
        cart,
        checkout,
        resolved,
        promo: undefined,
        createdAt,
        inventoryAllocations: [],
        paymentMethod: 'trade_credit',
        country: 'DE',
      }),
    /Trade-credit quote requires a company/,
  );

  assert.throws(
    () =>
      createCheckoutQuote({
        cart,
        checkout: { ...checkout, paymentMethod: 'trade_credit' },
        resolved,
        promo: undefined,
        createdAt,
        inventoryAllocations: [],
        paymentMethod: 'trade_credit',
        country: 'DE',
        companyId: '9',
        vatCents: 1,
      }),
    /vatCents does not match totals/,
  );
});
