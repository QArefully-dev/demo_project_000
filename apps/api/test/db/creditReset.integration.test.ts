import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  closeDatabase,
  migrateDatabase,
  openDatabase,
  resetDatabase,
  seedDatabase,
} from '../../src/db/index.js';
import { createInvoiceRepository } from '../../src/features/invoices/invoiceRepository.js';
import { DEMO_TRADE_CREDIT_SCENARIO_KEYS } from '../../src/db/tradeCreditSeed.js';

function openFixture(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  return {
    db,
    close: () => {
      closeDatabase(db);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function tradeCreditSnapshot(db: ReturnType<typeof openDatabase>): unknown[] {
  return db
    .prepare(
      `SELECT orders.demo_seed_key AS key, orders.id AS order_id,
              payments.id AS payment_id, payments.idempotency_key,
              invoices.id AS invoice_id, invoices.invoice_number,
              invoice_states.status, invoice_states.version AS state_version,
              GROUP_CONCAT(invoice_events.event_type, ',') AS events,
              credit_exposure_holds.status AS hold_status,
              dev_mailbox.id AS mailbox_id
       FROM orders
       JOIN payments ON payments.order_id = orders.id
       JOIN invoices ON invoices.order_id = orders.id
       JOIN invoice_states ON invoice_states.invoice_id = invoices.id
       JOIN credit_exposure_holds
         ON credit_exposure_holds.payment_idempotency_key = payments.idempotency_key
       LEFT JOIN invoice_events ON invoice_events.invoice_id = invoices.id
       LEFT JOIN dev_mailbox ON dev_mailbox.invoice_id = invoices.id
       WHERE orders.demo_seed_key IN (?, ?)
       GROUP BY orders.demo_seed_key, orders.id, payments.id, payments.idempotency_key,
                invoices.id, invoices.invoice_number, invoice_states.status,
                invoice_states.version, credit_exposure_holds.status, dev_mailbox.id
       ORDER BY orders.demo_seed_key`,
    )
    .all(...DEMO_TRADE_CREDIT_SCENARIO_KEYS);
}

void test('trade-credit seed is stable, idempotent, and preserves local rows', () => {
  const fixture = openFixture('shop-credit-seed-');
  const { db } = fixture;
  try {
    seedDatabase(db);
    const first = tradeCreditSnapshot(db);
    assert.equal(first.length, 2);
    assert.deepEqual(
      first.map((row) => (row as { key: string }).key),
      [...DEMO_TRADE_CREDIT_SCENARIO_KEYS],
    );
    assert.deepEqual(
      first.map((row) => (row as { status: string }).status),
      ['open', 'paid'],
    );
    assert.deepEqual(
      first.map((row) => (row as { events: string }).events),
      ['issued', 'issued,settled'],
    );
    const openInvoiceId = Number(
      db
        .prepare("SELECT invoice_id FROM invoice_states WHERE status = 'open' LIMIT 1")
        .pluck()
        .get(),
    );
    const openInvoice = createInvoiceRepository(db).findAdminById(
      openInvoiceId,
      'UK',
      '2026-09-03T09:00:00.000Z',
    );
    assert.equal(openInvoice?.status, 'open');
    assert.equal(openInvoice?.events?.[0]?.idempotencyKey, '00000000-0000-4000-8000-000000000701');

    const localUser = Number(
      db
        .prepare("SELECT id FROM users WHERE email = 'alice@example.com' AND country = 'UK'")
        .pluck()
        .get(),
    );
    db.prepare(
      `INSERT INTO orders
         (customer_name, customer_email, shipping_address, subtotal_cents, discount_cents,
          total_cents, created_at, user_id, demo_seed_key)
       VALUES ('Local Buyer', 'alice@example.com', 'Local address', 100, 0, 100,
               '2026-08-02T09:00:00.000Z', ?, 'local-credit-order')`,
    ).run(localUser);
    const localOrderId = Number(db.prepare('SELECT last_insert_rowid() AS id').pluck().get());

    seedDatabase(db);
    assert.deepEqual(tradeCreditSnapshot(db), first);
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS count FROM orders WHERE demo_seed_key = 'local-credit-order'")
        .get().count,
      1,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM company_credit_events').get().count, 1);
    assert.equal(
      db
        .prepare('SELECT credit_limit_cents FROM company_accounts WHERE name = ?')
        .pluck()
        .get('Acme Materials Ltd'),
      500_000,
    );
    assert.ok(localOrderId > 0);
  } finally {
    fixture.close();
  }
});

void test('seed never resurrects a tombstoned Acme membership', () => {
  const fixture = openFixture('shop-credit-tombstone-');
  const { db } = fixture;
  try {
    seedDatabase(db);
    const buyerId = Number(
      db
        .prepare("SELECT id FROM users WHERE email = 'buyer@example.com' AND country = 'UK'")
        .pluck()
        .get(),
    );
    const companyId = Number(
      db.prepare("SELECT id FROM company_accounts WHERE name = 'Acme Materials Ltd'").pluck().get(),
    );
    db.prepare("UPDATE users SET email = 'deleted-buyer@tombstone.local' WHERE id = ?").run(
      buyerId,
    );
    db.prepare(
      'UPDATE company_memberships SET active = 0 WHERE company_id = ? AND user_id = ?',
    ).run(companyId, buyerId);

    seedDatabase(db);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM users WHERE email = 'buyer@example.com'").get()
        .count,
      0,
    );
    assert.equal(
      db
        .prepare('SELECT active FROM company_memberships WHERE company_id = ? AND user_id = ?')
        .pluck()
        .get(companyId, buyerId),
      0,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count, 2);
  } finally {
    fixture.close();
  }
});

void test('reset clears credit, invoice, mailbox, and admin-refund rows then restores triggers', () => {
  const fixture = openFixture('shop-credit-reset-');
  const { db } = fixture;
  try {
    seedDatabase(db);
    const payment = db
      .prepare(
        "SELECT id, order_id FROM payments WHERE payment_method = 'card' ORDER BY id LIMIT 1",
      )
      .get() as { id: number; order_id: number };
    const adminId = Number(
      db
        .prepare("SELECT id FROM users WHERE email = 'admin@example.com' AND country = 'UK'")
        .pluck()
        .get(),
    );
    db.prepare(
      `INSERT INTO admin_refunds
         (payment_id, order_id, actor_user_id, amount_cents, reason, idempotency_key,
          processor, simulated_reference, created_at)
       VALUES (?, ?, ?, 1, 'reset fixture', 'reset-admin-refund', 'simulated',
               'sim-reset-admin-refund', '2026-08-02T09:00:00.000Z')`,
    ).run(payment.id, payment.order_id, adminId);

    resetDatabase(db);
    for (const table of [
      'admin_refunds',
      'company_credit_events',
      'credit_exposure_holds',
      'invoices',
      'invoice_states',
      'invoice_events',
      'invoice_sequences',
      'dev_mailbox',
    ]) {
      assert.equal(
        db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
        0,
        `${table} should be empty after reset`,
      );
    }
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    migrateDatabase(db);
    assert.deepEqual(db.pragma('foreign_key_check'), []);

    const triggerNames = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'trigger'
           AND name IN ('admin_refunds_no_update', 'admin_refunds_no_delete',
                        'company_credit_events_no_update', 'company_credit_events_no_delete',
                        'invoices_no_update', 'invoices_no_delete',
                        'invoice_events_no_update', 'invoice_events_no_delete')
         ORDER BY name`,
      )
      .all()
      .map((row) => (row as { name: string }).name);
    assert.deepEqual(triggerNames, [
      'admin_refunds_no_delete',
      'admin_refunds_no_update',
      'company_credit_events_no_delete',
      'company_credit_events_no_update',
      'invoice_events_no_delete',
      'invoice_events_no_update',
      'invoices_no_delete',
      'invoices_no_update',
    ]);
    seedDatabase(db);
    const seededInvoiceId = Number(
      db.prepare('SELECT id FROM invoices ORDER BY id LIMIT 1').pluck().get(),
    );
    assert.throws(
      () => db.prepare('DELETE FROM invoices WHERE id = ?').run(seededInvoiceId),
      /immutable/,
    );
  } finally {
    fixture.close();
  }
});
