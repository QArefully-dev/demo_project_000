import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { Country } from '@shop/contracts/country';
import type { CreditAccountAdminView, Invoice } from '@shop/contracts/trade-credit';
import { CreditAccountError } from '../../src/features/tradeCredit/creditAccountService.js';
import { InvoiceDomainError } from '../../src/features/invoices/invoiceErrors.js';
import type { CreditAccountService } from '../../src/features/tradeCredit/creditAccountService.js';
import type { InvoiceService } from '../../src/features/invoices/invoiceService.js';
import type { SessionService } from '../../src/features/auth/sessionService.js';
import adminCreditRoutes from '../../src/routes/adminCredit.js';

const account = {
  id: '7',
  companyId: '7',
  companyName: 'Example Trading Ltd',
  state: 'active',
  creditLimitCents: 100_000,
  outstandingCents: 0,
  heldCents: 0,
  exposureCents: 0,
  availableCreditCents: 100_000,
  terms: 'net_30',
  holdReason: null,
  version: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} satisfies CreditAccountAdminView;

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
    address: {
      line1: '1 Example Street',
      city: 'London',
      postcode: 'EC1A 1BB',
      countryCode: 'GB',
    },
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
  status: 'open',
  settledAt: null,
  lifecycleVersion: 0,
  lifecycle: {
    invoiceId: '101',
    status: 'open',
    version: 0,
    settledAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  settlement: null,
  events: [{ id: '301', invoiceId: '101', type: 'issued', occurredAt: '2026-09-01T00:00:00.000Z' }],
} satisfies Invoice;

function createApp() {
  const calls: { creditQuery?: unknown; invoiceQuery?: unknown; context?: unknown } = {};
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  app.decorateRequest('authenticatedUser', null);
  app.decorateRequest('sessionToken', null);
  app.decorateRequest('resolvedCountry', null as unknown as Country);
  app.addHook('preValidation', (request, _reply, done) => {
    const role = request.headers['x-test-role'];
    request.authenticatedUser =
      role === 'admin'
        ? { id: 9, email: 'admin@example.test', displayName: 'Admin', role: 'admin', country: 'UK' }
        : role === 'customer'
          ? {
              id: 3,
              email: 'buyer@example.test',
              displayName: 'Buyer',
              role: 'customer',
              country: 'UK',
            }
          : null;
    request.resolvedCountry = request.headers['x-shop-country'] === 'DE' ? 'DE' : 'UK';
    done();
  });

  const sessions = {} as SessionService;
  const creditAccounts = {
    listAdmin(query: unknown) {
      calls.creditQuery = query;
      return { items: [account], total: 1, page: 2, pageSize: 1 };
    },
    getAdminDetail: () => account,
    getAdmin: () => account,
    update(_id: number, _input: unknown, context: unknown) {
      calls.context = context;
      return account;
    },
    updateLimit(_id: number, _input: unknown, context: unknown) {
      calls.context = context;
      return account;
    },
    updateState(_id: number, _input: unknown, context: unknown) {
      calls.context = context;
      throw new CreditAccountError('STALE_VERSION');
    },
  } as unknown as Pick<
    CreditAccountService,
    'listAdmin' | 'getAdminDetail' | 'getAdmin' | 'update' | 'updateLimit' | 'updateState'
  >;
  const invoices = {
    listAdmin(query: unknown) {
      calls.invoiceQuery = query;
      return { items: [], total: 0, page: 1, pageSize: 25 };
    },
    getAdmin: () => {
      throw new InvoiceDomainError('INVOICE_NOT_FOUND');
    },
    settle: () => invoice,
    void: () => invoice,
  } as unknown as Pick<InvoiceService, 'listAdmin' | 'getAdmin' | 'settle' | 'void'>;
  app.register(adminCreditRoutes, { services: { sessions, creditAccounts, invoices } });
  return { app, calls };
}

void test('admin credit and invoice routes are country-scoped, typed, and mutation-safe', async (t) => {
  const { app, calls } = createApp();
  t.after(() => app.close());
  await app.ready();

  assert.equal((await app.inject('/api/admin/credit-accounts')).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        url: '/api/admin/credit-accounts',
        headers: { 'x-test-role': 'customer' },
      })
    ).statusCode,
    403,
  );

  const accounts = await app.inject({
    url: '/api/admin/credit-accounts?companyId=7&state=active&page=2&pageSize=1',
    headers: { 'x-test-role': 'admin', 'x-shop-country': 'DE' },
  });
  assert.equal(accounts.statusCode, 200);
  assert.deepEqual(calls.creditQuery, {
    companyId: 7,
    state: 'active',
    status: undefined,
    page: 2,
    pageSize: 1,
  });
  assert.equal(accounts.json<{ items: unknown[] }>().items.length, 1);

  const detail = await app.inject({
    url: '/api/admin/credit-accounts/7',
    headers: { 'x-test-role': 'admin' },
  });
  assert.equal(detail.statusCode, 200);
  const update = await app.inject({
    method: 'PATCH',
    url: '/api/admin/credit-accounts/7',
    headers: { 'x-test-role': 'admin' },
    payload: {
      creditLimitCents: 120_000,
      expectedVersion: 0,
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    },
  });
  assert.equal(update.statusCode, 200);
  assert.deepEqual((calls.context as { actor: unknown }).actor, { type: 'user', userId: 9 });
  assert.equal((calls.context as { standingCountry: string }).standingCountry, 'UK');
  assert.equal(typeof (calls.context as { requestId: unknown }).requestId, 'string');

  const stale = await app.inject({
    method: 'PATCH',
    url: '/api/admin/credit-accounts/7/state',
    headers: { 'x-test-role': 'admin' },
    payload: {
      state: 'suspended',
      expectedVersion: 0,
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174001',
    },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json<{ code: string }>().code, 'STALE_VERSION');

  const invoices = await app.inject({
    url: '/api/admin/invoices?companyId=7&status=open&page=1&pageSize=25',
    headers: { 'x-test-role': 'admin' },
  });
  assert.equal(invoices.statusCode, 200);
  assert.deepEqual(calls.invoiceQuery, {
    companyId: 7,
    status: 'open',
    page: 1,
    pageSize: 25,
  });
  assert.equal(
    (await app.inject({ url: '/api/admin/invoices/101', headers: { 'x-test-role': 'admin' } }))
      .statusCode,
    404,
  );
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/admin/invoices/101/settle',
    headers: { 'x-test-role': 'admin' },
    payload: { expectedVersion: 0 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(JSON.stringify(invalid.json()).includes('expectedVersion'), false);
});
