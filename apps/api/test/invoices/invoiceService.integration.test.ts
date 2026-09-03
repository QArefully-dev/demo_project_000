import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { migrateDatabase } from '../../src/db/index.js';
import { migrations } from '../../src/db/migrations/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createInvoiceRepository } from '../../src/features/invoices/invoiceRepository.js';
import { createInvoiceService } from '../../src/features/invoices/invoiceService.js';
import { InvoiceDomainError } from '../../src/features/invoices/invoiceErrors.js';

const issuedAt = '2026-09-01T09:00:00.000Z';
const dueAt = '2026-10-01T09:00:00.000Z';
const billingEntity = {
  legalName: 'Invoice Materials Ltd',
  registrationNumber: null,
  vatNumber: null,
  address: { line1: '1 Invoice Lane', city: 'London', postcode: 'EC1A 1BB', countryCode: 'GB' },
} as const;
const paymentKey = '123e4567-e89b-42d3-a456-426614174000';

function createFixture() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrateDatabase(db, migrations);
  db.exec(`
    INSERT INTO users (id, email, display_name, password_hash, password_salt, role, country)
    VALUES (9101, 'invoice-buyer@example.test', 'Invoice Buyer', 'hash', 'salt', 'customer', 'UK');
    INSERT INTO company_accounts
      (id, name, created_by_user_id, active, approval_threshold_cents, created_at, updated_at, country)
    VALUES (9101, 'Invoice Materials Ltd', 9101, 1, 0, '${issuedAt}', '${issuedAt}', 'UK');
    INSERT INTO orders
      (id, customer_name, customer_email, shipping_address, subtotal_cents, discount_cents,
       total_cents, created_at, user_id, lifecycle_status, version, country, payment_method,
       company_id, net_cents, vat_rate_basis_points, vat_cents, gross_cents,
       billing_entity_json, purchase_order_reference)
    VALUES (9101, 'Invoice Buyer', 'invoice-buyer@example.test', '1 Invoice Lane', 10000, 0,
            12000, '${issuedAt}', 9101, 'processing', 0, 'UK', 'trade_credit', 9101,
            10000, 2000, 2000, 12000, '${JSON.stringify(billingEntity)}', 'PO-9101');
    INSERT INTO order_line_items
      (id, order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
    VALUES (9101, 9101, 1, 'Material sacks', 10000, 1, 10000);
    INSERT INTO payments
      (id, order_id, idempotency_key, request_fingerprint, status, amount_cents,
       card_last4, card_brand, created_at, payment_method, company_id)
    VALUES (9101, 9101, '${paymentKey}', 'invoice-fingerprint', 'authorized_pending_finalize',
            12000, NULL, NULL, '${issuedAt}', 'trade_credit', 9101);
    INSERT INTO credit_exposure_holds
      (id, company_id, payment_idempotency_key, amount_cents, status,
       authorized_at, created_at, updated_at)
    VALUES (9101, 9101, '${paymentKey}', 12000, 'authorized', '${issuedAt}', '${issuedAt}', '${issuedAt}');
  `);
  let current = new Date('2026-09-02T09:00:00.000Z');
  const repository = createInvoiceRepository(db);
  const service = createInvoiceService({
    repository,
    unitOfWork: createUnitOfWork(db),
    clock: { now: () => current },
  });
  return { db, repository, service, setNow: (value: string) => (current = new Date(value)) };
}

function issueInput() {
  return {
    orderId: 9101,
    paymentIdempotencyKey: paymentKey,
    issuedAt,
    companyId: 9101,
    userId: 9101,
    country: 'UK' as const,
    billingEntity,
    purchaseOrderReference: 'PO-9101',
    lines: [
      {
        lineId: '9101',
        description: 'Material sacks',
        productId: '1',
        quantity: 1,
        unitPriceCents: 10000,
        netCents: 10000,
      },
    ],
    netCents: 10000,
    vatRateBasisPoints: 2000,
    vatCents: 2000,
    grossCents: 12000,
  };
}

void test('issues immutable V1 invoice, commits its hold, and replays settlement', () => {
  const fixture = createFixture();
  try {
    const invoice = fixture.service.issue(issueInput());
    assert.match(invoice.invoiceNumber, /^QME-2026-000001$/);
    assert.equal(invoice.status, 'open');
    assert.equal(invoice.lifecycleVersion, 0);
    assert.deepEqual(
      fixture.db
        .prepare('SELECT status, invoice_id FROM credit_exposure_holds WHERE id = 9101')
        .get(),
      { status: 'committed', invoice_id: Number(invoice.id) },
    );
    const settlementInput = {
      invoiceId: Number(invoice.id),
      expectedVersion: 0,
      idempotencyKey: '223e4567-e89b-42d3-a456-426614174000',
    };
    const settled = fixture.service.settle(settlementInput);
    assert.equal(settled.status, 'paid');
    assert.equal(settled.settlement?.amountCents, 12000);
    assert.equal(
      fixture.service.settle(settlementInput).settlement?.id,
      settled.settlement?.id,
      'same settlement key replays the immutable event',
    );
    assert.deepEqual(
      fixture.db.prepare('SELECT status FROM credit_exposure_holds WHERE id = 9101').get(),
      { status: 'released' },
    );
  } finally {
    fixture.db.close();
  }
});

void test('buyer reads are owner-scoped and overdue is derived without mutating state', () => {
  const fixture = createFixture();
  try {
    const invoice = fixture.service.issue(issueInput());
    assert.equal(fixture.service.getOwned(Number(invoice.id), 9101).status, 'open');
    assert.throws(
      () => fixture.service.getOwned(Number(invoice.id), 9999),
      (error: unknown) => error instanceof InvoiceDomainError && error.code === 'INVOICE_NOT_FOUND',
    );
    fixture.setNow(dueAt);
    assert.equal(fixture.service.getOwned(Number(invoice.id), 9101).status, 'overdue');
    assert.equal(
      fixture.db
        .prepare('SELECT status FROM invoice_states WHERE invoice_id = ?')
        .pluck()
        .get(Number(invoice.id)),
      'open',
    );
  } finally {
    fixture.db.close();
  }
});

void test('paid invoices cannot be voided and amount input is rejected', () => {
  const fixture = createFixture();
  try {
    const invoice = fixture.service.issue(issueInput());
    fixture.service.settle({
      invoiceId: Number(invoice.id),
      expectedVersion: 0,
      idempotencyKey: '323e4567-e89b-42d3-a456-426614174000',
    });
    assert.throws(
      () =>
        fixture.service.void({
          invoiceId: Number(invoice.id),
          expectedVersion: 1,
          idempotencyKey: '423e4567-e89b-42d3-a456-426614174000',
          reason: 'Cancellation',
        }),
      (error: unknown) =>
        error instanceof InvoiceDomainError && error.code === 'INVOICE_ALREADY_PAID',
    );
    assert.throws(
      () =>
        fixture.service.settle({
          invoiceId: Number(invoice.id),
          expectedVersion: 1,
          idempotencyKey: '523e4567-e89b-42d3-a456-426614174000',
          amountCents: 1,
        }),
      (error: unknown) =>
        error instanceof InvoiceDomainError && error.code === 'INVOICE_SETTLEMENT_INVALID',
    );
  } finally {
    fixture.db.close();
  }
});

void test('voids an open invoice, releases its hold once, and replays by key', () => {
  const fixture = createFixture();
  try {
    const invoice = fixture.service.issue(issueInput());
    const voidInput = {
      invoiceId: Number(invoice.id),
      expectedVersion: 0,
      idempotencyKey: '623e4567-e89b-42d3-a456-426614174000',
      reason: 'Order cancelled before dispatch',
    };
    const voided = fixture.service.void(voidInput);
    assert.equal(voided.status, 'voided');
    assert.equal(voided.lifecycleVersion, 1);
    assert.equal(fixture.service.void(voidInput).lifecycle?.version, 1);
    assert.deepEqual(
      fixture.db.prepare('SELECT status FROM credit_exposure_holds WHERE id = 9101').get(),
      { status: 'released' },
    );
    assert.deepEqual(
      fixture.db
        .prepare(
          'SELECT event_type, idempotency_key FROM invoice_events WHERE invoice_id = ? ORDER BY id',
        )
        .all(Number(invoice.id)),
      [
        { event_type: 'issued', idempotency_key: null },
        { event_type: 'voided', idempotency_key: voidInput.idempotencyKey },
      ],
    );
  } finally {
    fixture.db.close();
  }
});

void test('lifecycle CAS gives one settlement winner for stale concurrent callers', () => {
  const fixture = createFixture();
  try {
    const invoice = fixture.service.issue(issueInput());
    fixture.service.settle({
      invoiceId: Number(invoice.id),
      expectedVersion: 0,
      idempotencyKey: '723e4567-e89b-42d3-a456-426614174000',
    });
    assert.throws(
      () =>
        fixture.service.settle({
          invoiceId: Number(invoice.id),
          expectedVersion: 0,
          idempotencyKey: '823e4567-e89b-42d3-a456-426614174000',
        }),
      (error: unknown) =>
        error instanceof InvoiceDomainError && error.code === 'INVOICE_SETTLEMENT_CONFLICT',
    );
    assert.equal(
      fixture.db
        .prepare("SELECT COUNT(*) AS count FROM invoice_events WHERE event_type = 'settled'")
        .pluck()
        .get(),
      1,
    );
  } finally {
    fixture.db.close();
  }
});

void test('rolls back a number allocation when invoice linkage fails', () => {
  const fixture = createFixture();
  try {
    fixture.db
      .prepare('UPDATE credit_exposure_holds SET amount_cents = 11999 WHERE id = 9101')
      .run();
    assert.throws(() => fixture.service.issue(issueInput()), /hold does not match invoice facts/);
    assert.equal(fixture.db.prepare('SELECT COUNT(*) AS count FROM invoices').pluck().get(), 0);
    fixture.db
      .prepare('UPDATE credit_exposure_holds SET amount_cents = 12000 WHERE id = 9101')
      .run();
    const invoice = fixture.service.issue(issueInput());
    assert.equal(invoice.invoiceNumber, 'QME-2026-000001');
  } finally {
    fixture.db.close();
  }
});
