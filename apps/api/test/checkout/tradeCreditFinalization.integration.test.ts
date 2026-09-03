import assert from 'node:assert/strict';
import test from 'node:test';
import { openSeededDatabase } from '../support/seededDatabase.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createCartRepository } from '../../src/features/cart/cartRepository.js';
import { createCart } from '../../src/features/cart/cartService.js';
import {
  createCheckoutService,
  type CheckoutParams,
} from '../../src/features/checkout/checkoutService.js';
import { createInventoryRepository } from '../../src/features/inventory/inventoryRepository.js';
import { createInventoryService } from '../../src/features/inventory/inventoryService.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createOrderRepository } from '../../src/features/orders/orderRepository.js';
import { createPaymentRepository } from '../../src/features/payments/paymentRepository.js';
import { createProductRepository } from '../../src/features/catalog/productRepository.js';
import { createPromoRepository } from '../../src/features/promos/promoRepository.js';
import { createCompanyMembershipRepository } from '../../src/features/companyAccounts/companyMembershipRepository.js';
import { createCompanyRepository } from '../../src/features/companyAccounts/companyRepository.js';
import { createCompanyInviteRepository } from '../../src/features/companyAccounts/companyInviteRepository.js';
import { createCompanyService } from '../../src/features/companyAccounts/companyService.js';
import { createApprovalRepository } from '../../src/features/orderApprovals/approvalRepository.js';
import { createApprovalService } from '../../src/features/orderApprovals/approvalService.js';
import { createInvoiceRepository } from '../../src/features/invoices/invoiceRepository.js';
import { createInvoiceService } from '../../src/features/invoices/invoiceService.js';
import { createCreditAccountRepository } from '../../src/features/tradeCredit/creditAccountRepository.js';
import { createCreditHoldRepository } from '../../src/features/tradeCredit/creditHoldRepository.js';
import { createCreditAccountService } from '../../src/features/tradeCredit/creditAccountService.js';
import { createDeliverySiteRepository } from '../../src/features/tradeAccount/deliverySiteRepository.js';
import { createDeliverySiteService } from '../../src/features/tradeAccount/deliverySiteService.js';
import { createBillingEntityRepository } from '../../src/features/tradeAccount/billingEntityRepository.js';
import { createBillingEntityService } from '../../src/features/tradeAccount/billingEntityService.js';
import { createDeliverySlotService } from '../../src/features/delivery/deliverySlotService.js';
import { createCartService } from '../../src/features/cart/cartService.js';
import { adhocBilling, adhocDestination, bookableSlot } from './checkoutDepthFixtures.js';

const NOW = new Date('2026-09-03T09:00:00.000Z');

function setup(t: test.TestContext) {
  const { db } = openSeededDatabase(t);
  const clock = { now: () => NOW };
  const unitOfWork = createUnitOfWork(db);
  const mailbox = createMailboxRepository(db);
  const audit = createAuditWriter({ repository: createAuditRepository(db), clock });
  const userId = Number(
    (
      db
        .prepare(
          `INSERT INTO users (email, display_name, password_hash, password_salt, role)
           VALUES (?, 'Finalization Buyer', 'hash', 'salt', 'customer') RETURNING id`,
        )
        .get('finalization-buyer@example.test') as { id: number }
    ).id,
  );
  const companyId = Number(
    (
      db
        .prepare(
          `INSERT INTO company_accounts
             (name, created_by_user_id, active, approval_threshold_cents, credit_limit_cents,
              credit_terms_days, credit_state, credit_version, created_at, updated_at)
           VALUES ('Finalization Materials Ltd', ?, 1, NULL, 100000, 30, 'active', 0, ?, ?)
           RETURNING id`,
        )
        .get(userId, NOW.toISOString(), NOW.toISOString()) as { id: number }
    ).id,
  );
  db.prepare(
    `INSERT INTO company_memberships (company_id, user_id, role, active, created_at)
     VALUES (?, ?, 'buyer', 1, ?)`,
  ).run(companyId, userId, NOW.toISOString());

  const carts = createCartRepository(db);
  const cartId = createCart(carts, 'UK').cartId;
  const variant = db
    .prepare('SELECT id, moq_sacks FROM product_variants WHERE active = 1 ORDER BY id LIMIT 1')
    .get() as { id: number; moq_sacks: number };
  carts.addLineQuantity(cartId, String(variant.id), variant.moq_sacks);

  const inventory = createInventoryService({ repository: createInventoryRepository(db) });
  const memberships = createCompanyMembershipRepository(db);
  const creditAccounts = createCreditAccountService({
    accounts: createCreditAccountRepository(db),
    holds: createCreditHoldRepository(db),
    memberships,
    unitOfWork,
    clock,
  });
  const companies = createCompanyService({
    companies: createCompanyRepository(db),
    memberships,
    invites: createCompanyInviteRepository(db),
    mailbox,
    unitOfWork,
    audit,
    clock,
    baseUrl: 'http://example.test/',
  });
  const approvals = createApprovalService({
    approvals: createApprovalRepository(db),
    companies,
    mailbox,
    unitOfWork,
    audit,
    clock,
  });
  const deps = {
    unitOfWork,
    carts,
    promos: createPromoRepository(db),
    payments: createPaymentRepository(db),
    orders: createOrderRepository(db),
    mailbox,
    invoices: createInvoiceService({
      repository: createInvoiceRepository(db),
      unitOfWork,
      clock,
    }),
    gateway: {
      process: () => Promise.resolve({ status: 'success' as const, reference: 'unused' }),
    },
    clock,
    products: createProductRepository(db),
    audit,
    inventory,
    companies,
    approvals,
    creditAccounts,
    tradeAccount: {
      sites: createDeliverySiteService({
        repository: createDeliverySiteRepository(db),
        unitOfWork,
        clock,
      }),
      billingEntities: createBillingEntityService({
        repository: createBillingEntityRepository(db),
        unitOfWork,
        clock,
      }),
    },
    deliverySlots: createDeliverySlotService({ cart: createCartService(carts), clock }),
  };
  const params: CheckoutParams = {
    cartId,
    customerName: 'Finalization Buyer',
    customerEmail: 'finalization-buyer@example.test',
    deliveryDestination: adhocDestination,
    billingSelection: adhocBilling,
    deliverySlot: bookableSlot(NOW),
    paymentMethod: 'trade_credit',
    idempotencyKey: '00000000-0000-4000-8000-000000000012',
    userId,
    auditContext: { actor: { type: 'user', userId }, requestId: 'credit-finalization-request' },
  };
  return { db, deps, params };
}

void test('trade-credit finalization atomically issues one invoice and hydrates one mailbox descriptor', async (t) => {
  const { db, deps, params } = setup(t);
  const result = await createCheckoutService(deps).process(params);
  assert.equal(result.success, true);

  const order = db
    .prepare(
      `SELECT id, payment_method, company_id, net_cents, vat_rate_basis_points, vat_cents,
              gross_cents, total_cents FROM orders WHERE customer_email = ?`,
    )
    .get(params.customerEmail) as Record<string, number | string>;
  assert.equal(order.payment_method, 'trade_credit');
  assert.equal(order.company_id !== null, true);
  assert.equal(order.gross_cents, order.total_cents);

  const invoice = db
    .prepare(
      `SELECT id, order_id, payment_idempotency_key, net_cents, vat_rate_basis_points,
              vat_cents, gross_cents FROM invoices WHERE payment_idempotency_key = ?`,
    )
    .get(params.idempotencyKey) as Record<string, number | string>;
  assert.equal(invoice.order_id, order.id);
  assert.equal(invoice.gross_cents, order.gross_cents);
  assert.deepEqual(
    db
      .prepare(
        `SELECT status, invoice_id FROM credit_exposure_holds WHERE payment_idempotency_key = ?`,
      )
      .get(params.idempotencyKey),
    { status: 'committed', invoice_id: invoice.id },
  );
  assert.deepEqual(
    db
      .prepare(`SELECT kind, subject, body, invoice_id FROM dev_mailbox WHERE invoice_id = ?`)
      .get(invoice.id),
    { kind: 'invoice_issued', subject: '', body: '', invoice_id: invoice.id },
  );
  assert.deepEqual(
    deps.mailbox.list().find((message) => message.kind === 'invoice_issued'),
    {
      id: String(
        (
          db.prepare('SELECT id FROM dev_mailbox WHERE invoice_id = ?').get(invoice.id) as {
            id: number;
          }
        ).id,
      ),
      recipient: params.customerEmail,
      subject: '',
      body: '',
      created: NOW.toISOString(),
      kind: 'invoice_issued',
      invoiceId: String(invoice.id),
    },
  );
  assert.equal(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM audit_events
           WHERE action = 'payment.succeeded' AND request_id = ?`,
        )
        .get(params.auditContext.requestId) as { count: number }
    ).count,
    0,
  );
});

void test('credit finalization failure after invoice/mailbox writes rolls everything back and exact retry reuses the hold', async (t) => {
  const { db, deps, params } = setup(t);
  const originalRemove = deps.carts.remove.bind(deps.carts);
  let fail = true;
  deps.carts.remove = (id) => {
    if (fail) throw new Error('post-mailbox failure');
    originalRemove(id);
  };
  const service = createCheckoutService(deps);
  const first = await service.process(params);
  assert.deepEqual(first, { success: false, error: 'IDEMPOTENT_IN_PROGRESS' });
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM orders WHERE customer_email = ?')
        .get(params.customerEmail) as { count: number }
    ).count,
    0,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM invoices WHERE payment_idempotency_key = ?')
        .get(params.idempotencyKey) as { count: number }
    ).count,
    0,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM dev_mailbox WHERE recipient = ?')
        .get(params.customerEmail) as { count: number }
    ).count,
    0,
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT status, invoice_id FROM credit_exposure_holds WHERE payment_idempotency_key = ?',
      )
      .get(params.idempotencyKey),
    { status: 'authorized', invoice_id: null },
  );
  assert.equal(deps.payments.load(params.idempotencyKey)?.status, 'authorized_pending_finalize');

  fail = false;
  const retry = await service.process(params);
  assert.equal(retry.success, true);
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM orders WHERE customer_email = ?')
        .get(params.customerEmail) as { count: number }
    ).count,
    1,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS count FROM invoices WHERE payment_idempotency_key = ?')
        .get(params.idempotencyKey) as { count: number }
    ).count,
    1,
  );
  assert.equal(deps.payments.load(params.idempotencyKey)?.status, 'succeeded');
});
