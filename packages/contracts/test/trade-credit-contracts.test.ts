import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from '@sinclair/typebox/value';
import {
  AdminCreditAccountListQuery,
  CreditAccount,
  CreditAccountMemberView,
  InvoiceV1,
  InvoiceSettlement,
  InvoiceIssuedMailboxDescriptor,
  PaymentBody,
  PersistedCheckoutQuote,
  PersistedCheckoutQuoteV10,
  PublicErrorResponse,
  TradeCreditPaymentBody,
  parseInvoiceV1,
} from '../src/index.js';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const address = {
  line1: '1 Example Street',
  city: 'London',
  postcode: 'EC1A 1BB',
  countryCode: 'GB',
};

const checkoutCommon = {
  cartId: uuid,
  customerName: 'Ada Shopper',
  customerEmail: 'ada@example.test',
  deliveryDestination: { kind: 'adhoc', address },
  billingSelection: {
    kind: 'adhoc',
    billingEntity: { legalName: 'Example Trading Ltd', address },
  },
  deliverySlot: { date: '2026-09-10', window: 'am' },
  idempotencyKey: uuid,
};

void test('card payment remains valid when method is omitted or explicit', () => {
  const legacy = {
    ...checkoutCommon,
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '12/99',
    cardCvc: '123',
  };
  assert.equal(Value.Check(PaymentBody, legacy), true);
  assert.equal(Value.Check(PaymentBody, { ...legacy, paymentMethod: 'card' }), true);
  assert.equal(Value.Check(PaymentBody, { ...legacy, paymentMethod: 'trade_credit' }), false);
});

void test('trade-credit checkout is strict and can never carry card fields', () => {
  const credit: TradeCreditPaymentBody = {
    ...checkoutCommon,
    paymentMethod: 'trade_credit',
    companyId: '7',
  };
  assert.equal(Value.Check(TradeCreditPaymentBody, credit), true);
  assert.equal(Value.Check(PaymentBody, credit), true);
  assert.equal(Value.Check(PaymentBody, { ...credit, cardNumber: '424242424242' }), false);
  assert.equal(Value.Check(PaymentBody, { ...credit, companyId: '0' }), false);
  assert.equal(Value.Check(PaymentBody, { ...credit, paymentMethod: 'credit' }), false);
});

void test('credit accounts expose safe money and derived available credit', () => {
  const account = {
    id: '9',
    companyId: '7',
    state: 'active',
    creditLimitCents: 100_000,
    outstandingCents: 25_000,
    heldCents: 0,
    exposureCents: 25_000,
    availableCreditCents: 75_000,
    terms: 'net_30',
    holdReason: null,
    version: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  } as const;
  assert.equal(Value.Check(CreditAccount, account), true);
  assert.equal(Value.Check(CreditAccount, { ...account, availableCreditCents: 74_999 }), false);
  assert.equal(
    Value.Check(CreditAccount, { ...account, creditLimitCents: Number.MAX_SAFE_INTEGER + 1 }),
    false,
  );
  assert.equal(Value.Check(CreditAccountMemberView, { ...account, id: '9' }), false);
  assert.equal(
    Value.Check(AdminCreditAccountListQuery, { state: 'suspended', page: 1, pageSize: 50 }),
    true,
  );
  assert.equal(Value.Check(AdminCreditAccountListQuery, { page: 0 }), false);
  assert.equal(Value.Check(AdminCreditAccountListQuery, { state: 'on-hold' }), false);
});

const invoice = {
  version: 1,
  id: '101',
  invoiceNumber: 'QME-2026-000101',
  orderId: '55',
  companyId: '7',
  userId: '3',
  country: 'UK',
  paymentMethod: 'trade_credit',
  currency: 'GBP',
  terms: 'net_30',
  billingEntity: {
    legalName: 'Example Trading Ltd',
    registrationNumber: null,
    vatNumber: null,
    address,
  },
  purchaseOrderReference: 'PO-101',
  lines: [
    {
      lineId: '1',
      description: 'Material sacks',
      quantity: 2,
      unitPriceCents: 5_000,
      netCents: 10_000,
    },
  ],
  netCents: 10_000,
  vatRateBasisPoints: 2_000,
  vatCents: 2_000,
  grossCents: 12_000,
  issuedAt: '2026-09-01T00:00:00.000Z',
  dueAt: '2026-10-01T00:00:00.000Z',
} as const;

void test('invoice V1 enforces line/net/VAT/gross integrity and immutable fields', () => {
  assert.equal(Value.Check(InvoiceV1, invoice), true);
  assert.deepEqual(parseInvoiceV1(invoice), invoice);
  assert.equal(Value.Check(InvoiceV1, { ...invoice, vatCents: 2_001 }), false);
  assert.equal(Value.Check(InvoiceV1, { ...invoice, grossCents: 12_001 }), false);
  assert.equal(
    Value.Check(InvoiceV1, { ...invoice, lines: [{ ...invoice.lines[0], netCents: 9_999 }] }),
    false,
  );
  assert.equal(Value.Check(InvoiceV1, { ...invoice, convertedGrossCents: 15_000 }), false);
  assert.throws(() => parseInvoiceV1({ ...invoice, version: 2 }));
});

void test('V10 quote carries country, method, identity, accounting, and terms while V8/V9 read', () => {
  const v10 = {
    version: 10,
    cartId: uuid,
    customer: {
      name: 'Ada Shopper',
      email: 'ada@example.test',
      deliveryAddress: address,
      shippingAddress: '1 Example Street, London, EC1A 1BB, GB',
    },
    userId: '3',
    companyId: '7',
    country: 'UK',
    paymentMethod: 'trade_credit',
    terms: 'net_30',
    promoCode: null,
    subtotalCents: 10_000,
    discountBaseCents: 10_000,
    promoCategoryScope: null,
    discountCents: 0,
    totalCents: 10_000,
    netCents: 10_000,
    vatRateBasisPoints: 2_000,
    vatCents: 2_000,
    grossCents: 12_000,
    lines: [],
    variantLines: [],
    deliverySummary: { mode: 'freight', chargeCents: 0, weightGrams: 1_000, reason: 'Freight' },
    inventoryAllocations: [],
    billingEntity: invoice.billingEntity,
    deliverySlot: { date: '2026-09-10', window: 'am' },
    purchaseOrderReference: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  } as const;
  assert.equal(Value.Check(PersistedCheckoutQuoteV10, v10), true);
  assert.equal(Value.Check(PersistedCheckoutQuote, v10), true);
  assert.equal(Value.Check(PersistedCheckoutQuoteV10, { ...v10, grossCents: 12_001 }), false);
  assert.equal(
    Value.Check(PersistedCheckoutQuoteV10, { ...v10, cardNumber: '424242424242' }),
    false,
  );
});

void test('invoice settlement, mailbox descriptor, and public metadata are strict', () => {
  const settlement = {
    id: '201',
    invoiceId: '101',
    amountCents: 12_000,
    currency: 'GBP',
    status: 'settled',
    idempotencyKey: uuid,
    settledAt: '2026-09-20T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
  };
  assert.equal(Value.Check(InvoiceSettlement, settlement), true);
  assert.equal(Value.Check(InvoiceSettlement, { ...settlement, amountCents: 0 }), false);
  const descriptor = {
    id: '301',
    recipient: 'ada@example.test',
    subject: 'Invoice issued',
    body: 'Invoice INV-101 issued',
    created: '2026-09-01T00:00:00.000Z',
    kind: 'invoice_issued',
    invoiceId: '101',
  };
  assert.equal(Value.Check(InvoiceIssuedMailboxDescriptor, descriptor), true);
  assert.equal(
    Value.Check(InvoiceIssuedMailboxDescriptor, { ...descriptor, grossCents: 12_000 }),
    false,
  );
  assert.equal(
    Value.Check(PublicErrorResponse, {
      error: 'Credit limit exceeded',
      code: 'CREDIT_LIMIT_EXCEEDED',
      meta: { requestedCents: 20_000, availableCreditCents: 10_000 },
    }),
    true,
  );
  assert.equal(
    Value.Check(PublicErrorResponse, {
      error: 'Credit limit exceeded',
      code: 'CREDIT_LIMIT_EXCEEDED',
      meta: { requestedCents: 20_000 },
    }),
    false,
  );
});
