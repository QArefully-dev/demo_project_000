import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createCreditHoldRepository } from '../../src/features/tradeCredit/creditHoldRepository.js';

const COMPANY_ID = 8201;
const USER_ID = 8201;
const NOW = '2026-09-03T09:00:00.000Z';

function setup(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-credit-hold-'));
  const databasePath = join(directory, 'shop.db');
  const db = openDatabase({ path: databasePath });
  const siblingDatabases: Array<ReturnType<typeof openDatabase>> = [];
  db.exec(`
    INSERT INTO users (id, email, display_name, password_hash, password_salt, role, country)
    VALUES (${USER_ID}, 'hold-buyer@example.test', 'Hold Buyer', 'hash', 'salt', 'customer', 'UK');
    INSERT INTO company_accounts
      (id, name, created_by_user_id, active, country, credit_limit_cents, credit_terms_days,
       credit_state, credit_version, created_at, updated_at)
    VALUES (${COMPANY_ID}, 'Hold Materials Ltd', ${USER_ID}, 1, 'UK', 30000, 30, 'active', 0,
            '${NOW}', '${NOW}');
  `);
  const holds = createCreditHoldRepository(db);
  const uow = createUnitOfWork(db);
  t.after(() => {
    for (const sibling of siblingDatabases) closeDatabase(sibling);
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const openSibling = () => {
    const sibling = openDatabase({ path: databasePath });
    siblingDatabases.push(sibling);
    return sibling;
  };
  const addPayment = (key: string, amount: number, orderId: number | null = null) => {
    db.prepare(
      `INSERT INTO payments
        (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand,
         payment_method, company_id, created_at, updated_at)
       VALUES (?, ?, 'authorized_pending_finalize', ?, NULL, NULL, 'trade_credit', ?, ?, ?)`,
    ).run(key, `${key}-fingerprint`, amount, COMPANY_ID, NOW, NOW);
    if (orderId !== null)
      db.prepare('UPDATE payments SET order_id = ? WHERE idempotency_key = ?').run(orderId, key);
  };
  return { db, holds, uow, addPayment, directory, databasePath, openSibling };
}

void test('exposure aggregates only outstanding invoices and live prepared/authorized holds', (t) => {
  const { db, holds, uow, addPayment } = setup(t);
  const invoiceKey = 'credit-invoice-exposure';
  const holdKey = 'credit-held-exposure';
  const document = {
    version: 1,
    id: '8201',
    invoiceNumber: 'QME-2026-000821',
    orderId: '8201',
    companyId: String(COMPANY_ID),
    userId: String(USER_ID),
    country: 'UK',
    paymentMethod: 'trade_credit',
    currency: 'GBP',
    terms: 'net_30',
    billingEntity: {
      legalName: 'Hold Materials Ltd',
      registrationNumber: null,
      vatNumber: null,
      address: { line1: 'Hold Lane', city: 'Leeds', postcode: 'LS1 1AA', countryCode: 'GB' },
    },
    purchaseOrderReference: null,
    paymentIdempotencyKey: invoiceKey,
    lines: [
      { lineId: '1', description: 'Sacks', quantity: 1, unitPriceCents: 10000, netCents: 10000 },
    ],
    netCents: 10000,
    vatRateBasisPoints: 2000,
    vatCents: 2000,
    grossCents: 12000,
    issuedAt: NOW,
    dueAt: '2026-10-03T09:00:00.000Z',
  };
  db.exec(`
    INSERT INTO orders
      (id, customer_name, customer_email, shipping_address, subtotal_cents, discount_cents,
       total_cents, created_at, user_id, lifecycle_status, version, country, payment_method,
       company_id, net_cents, vat_rate_basis_points, vat_cents, gross_cents)
    VALUES (8201, 'Hold Buyer', 'hold-buyer@example.test', 'Hold Lane', 10000, 0, 12000,
            '${NOW}', ${USER_ID}, 'processing', 0, 'UK', 'trade_credit', ${COMPANY_ID},
            10000, 2000, 2000, 12000);
  `);
  addPayment(invoiceKey, 12000, 8201);
  db.prepare(
    `INSERT INTO invoices
      (id, version, invoice_number, order_id, payment_idempotency_key, company_id, user_id,
       country, currency, terms, terms_days, document_json, net_cents, vat_rate_basis_points,
       vat_cents, gross_cents, issued_at, due_at)
     VALUES (8201, 1, ?, 8201, ?, ?, ?, 'UK', 'GBP', 'net_30', 30, ?, 10000, 2000, 2000,
             12000, ?, '2026-10-03T09:00:00.000Z')`,
  ).run(document.invoiceNumber, invoiceKey, COMPANY_ID, USER_ID, JSON.stringify(document), NOW);
  db.prepare(
    `INSERT INTO invoice_states (invoice_id, status, version, settled_at, updated_at)
     VALUES (8201, 'open', 0, NULL, ?)`,
  ).run(NOW);

  addPayment(holdKey, 5000);
  uow.run(() => {
    const hold = holds.acquire({
      companyId: COMPANY_ID,
      paymentIdempotencyKey: holdKey,
      amountCents: 5000,
      expiresAt: '2026-09-03T10:00:00.000Z',
      createdAt: NOW,
    });
    assert.equal(hold?.status, 'prepared');
  });
  const exposure = holds.exposure(COMPANY_ID, NOW);
  assert.equal(exposure.outstandingInvoiceCents, 12000);
  assert.equal(exposure.preparedHoldCents, 5000);
  assert.equal(exposure.authorizedHoldCents, 0);
  assert.equal(exposure.heldCents, 5000);
  assert.equal(exposure.exposureCents, 17000);
  assert.equal(exposure.availableCreditCents, 13000);
  db.prepare(
    "UPDATE invoice_states SET status = 'paid', settled_at = ?, updated_at = ? WHERE invoice_id = 8201",
  ).run(NOW, NOW);
  assert.equal(holds.exposure(COMPANY_ID, NOW).outstandingInvoiceCents, 0);
});

void test('prepared expiry and lifecycle transitions are CAS-safe and idempotent', (t) => {
  const { holds, uow, addPayment, db } = setup(t);
  const preparedKey = 'credit-prepared-expiry';
  const authorisedKey = 'credit-authorised-lifecycle';
  const committedKey = 'credit-committed-lifecycle';
  addPayment(preparedKey, 5000);
  addPayment(authorisedKey, 5000);
  addPayment(committedKey, 5000);
  uow.run(() => {
    assert.ok(
      holds.acquire({
        companyId: COMPANY_ID,
        paymentIdempotencyKey: preparedKey,
        amountCents: 5000,
        expiresAt: '2026-09-03T10:00:00.000Z',
        createdAt: NOW,
      }),
    );
    assert.ok(
      holds.acquire({
        companyId: COMPANY_ID,
        paymentIdempotencyKey: authorisedKey,
        amountCents: 5000,
        expiresAt: '2026-09-04T10:00:00.000Z',
        createdAt: NOW,
      }),
    );
    assert.ok(
      holds.acquire({
        companyId: COMPANY_ID,
        paymentIdempotencyKey: committedKey,
        amountCents: 5000,
        expiresAt: '2026-09-04T10:00:00.000Z',
        createdAt: NOW,
      }),
    );
  });
  assert.deepEqual(holds.expirePrepared('2026-09-03T11:00:00.000Z'), [preparedKey]);
  assert.equal(holds.findByKey(preparedKey)?.status, 'released');
  assert.equal(holds.authorize(preparedKey, NOW), null, 'expired prepared hold cannot authorize');

  const authorized = holds.authorize(authorisedKey, NOW);
  assert.equal(authorized?.status, 'authorized');
  assert.equal(authorized?.expires_at, null);
  assert.equal(holds.authorize(authorisedKey, NOW)?.status, 'authorized');
  assert.equal(holds.release(authorisedKey, NOW)?.status, 'released');
  assert.equal(holds.release(authorisedKey, NOW)?.status, 'released');

  assert.equal(holds.authorize(committedKey, NOW)?.status, 'authorized');
  assert.equal(holds.commit(committedKey, NOW)?.status, 'committed');
  assert.equal(holds.commit(committedKey, NOW)?.status, 'committed');
  assert.equal(holds.release(committedKey, NOW), null, 'committed hold is terminal');
  assert.equal(
    (
      db
        .prepare("SELECT COUNT(*) AS count FROM credit_exposure_holds WHERE status = 'released'")
        .get() as { count: number }
    ).count,
    2,
  );
});

void test('conditional acquisition admits only the remaining capacity and same key never duplicates', (t) => {
  const { holds, uow, addPayment, db } = setup(t);
  db.prepare('UPDATE company_accounts SET credit_limit_cents = 10000 WHERE id = ?').run(COMPANY_ID);
  const first = 'credit-capacity-first';
  const second = 'credit-capacity-second';
  addPayment(first, 6000);
  addPayment(second, 5000);
  const acquired = uow.run(() =>
    holds.acquire({
      companyId: COMPANY_ID,
      paymentIdempotencyKey: first,
      amountCents: 6000,
      expiresAt: '2026-09-03T10:00:00.000Z',
      createdAt: NOW,
    }),
  );
  assert.equal(acquired?.amount_cents, 6000);
  assert.equal(
    uow.run(
      () =>
        holds.acquire({
          companyId: COMPANY_ID,
          paymentIdempotencyKey: first,
          amountCents: 6000,
          expiresAt: '2026-09-03T10:00:00.000Z',
          createdAt: NOW,
        })?.id,
    ),
    acquired?.id,
  );
  assert.equal(
    uow.run(() =>
      holds.acquire({
        companyId: COMPANY_ID,
        paymentIdempotencyKey: second,
        amountCents: 5000,
        expiresAt: '2026-09-03T10:00:00.000Z',
        createdAt: NOW,
      }),
    ),
    null,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM credit_exposure_holds').get() as { count: number })
      .count,
    1,
  );
});

void test('two database connections serialize the final available capacity and replay same key', (t) => {
  const { db, holds, uow, addPayment, openSibling } = setup(t);
  const secondDb = openSibling();
  const secondHolds = createCreditHoldRepository(secondDb);
  const secondUow = createUnitOfWork(secondDb);
  db.prepare('UPDATE company_accounts SET credit_limit_cents = 10000 WHERE id = ?').run(COMPANY_ID);
  const firstKey = 'credit-two-connection-first';
  const secondKey = 'credit-two-connection-second';
  addPayment(firstKey, 6000);
  addPayment(secondKey, 5000);

  const first = uow.run(() =>
    holds.acquire({
      companyId: COMPANY_ID,
      paymentIdempotencyKey: firstKey,
      amountCents: 6000,
      expiresAt: '2026-09-03T10:00:00.000Z',
      createdAt: NOW,
    }),
  );
  assert.ok(first);
  const replay = secondUow.run(() =>
    secondHolds.acquire({
      companyId: COMPANY_ID,
      paymentIdempotencyKey: firstKey,
      amountCents: 6000,
      expiresAt: '2026-09-03T10:00:00.000Z',
      createdAt: NOW,
    }),
  );
  assert.equal(replay?.id, first.id, 'same key is durable across connections');
  const rejected = secondUow.run(() =>
    secondHolds.acquire({
      companyId: COMPANY_ID,
      paymentIdempotencyKey: secondKey,
      amountCents: 5000,
      expiresAt: '2026-09-03T10:00:00.000Z',
      createdAt: NOW,
    }),
  );
  assert.equal(rejected, null, 'second connection sees committed first hold exposure');
});
