import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';
import { closeDatabase, openDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createDataExportService } from '../../src/features/accountExport/dataExportService.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createSessionRepository } from '../../src/features/auth/sessionRepository.js';
import { createSessionService } from '../../src/features/auth/sessionService.js';
import { createFavouritesRepository } from '../../src/features/favourites/favouritesRepository.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createOrderRepository } from '../../src/features/orders/orderRepository.js';
import { createPreferencesRepository } from '../../src/features/preferences/preferencesRepository.js';
import { createPreferencesService } from '../../src/features/preferences/preferencesService.js';
import { createBillingEntityRepository } from '../../src/features/tradeAccount/billingEntityRepository.js';
import { createDeliverySiteRepository } from '../../src/features/tradeAccount/deliverySiteRepository.js';
import { authPlugin } from '../../src/plugins/auth.js';
import accountExportRoutes from '../../src/routes/accountExport.js';

function assertNoSecrets(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSecrets);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    assert.doesNotMatch(key, /(password|salt|token|fingerprint)/i, `secret key ${key} leaked`);
    assertNoSecrets(nested);
  }
}

void test('data export is caller-scoped, allowlisted, mailed, and audited', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-data-export-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  const clock = { now: () => new Date('2026-07-29T12:00:00.000Z') };
  const unitOfWork = createUnitOfWork(db);
  const audit = createAuditWriter({ repository: createAuditRepository(db), clock });
  const sessions = createSessionService({
    sessions: createSessionRepository(db),
    clock,
    unitOfWork,
    audit,
  });
  const preferences = createPreferencesService({
    repository: createPreferencesRepository(db),
    unitOfWork,
    audit,
    clock,
  });
  const orders = createOrderRepository(db);
  const mailbox = createMailboxRepository(db);
  const dataExport = createDataExportService({
    unitOfWork,
    audit,
    clock,
    sessions,
    orders,
    favourites: createFavouritesRepository(db),
    deliverySites: createDeliverySiteRepository(db),
    billingEntities: createBillingEntityRepository(db),
    preferences,
    mailbox,
  });
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  await app.register(fastifyCookie);
  authPlugin(sessions)(app, {}, () => undefined);
  await app.register(accountExportRoutes, { services: { sessions, dataExport } });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const callerId = Number(
    (
      db
        .prepare(
          `INSERT INTO users (email, display_name, password_hash, password_salt, role)
           VALUES ('buyer@example.test', 'Buyer Name', 'super-secret-hash', 'secret-salt', 'customer')
           RETURNING id`,
        )
        .get() as { id: number }
    ).id,
  );
  const foreignId = Number(
    (
      db
        .prepare(
          `INSERT INTO users (email, display_name, password_hash, password_salt, role)
           VALUES ('other@example.test', 'Other Buyer', 'other-hash', 'other-salt', 'customer')
           RETURNING id`,
        )
        .get() as { id: number }
    ).id,
  );
  const siteRepository = createDeliverySiteRepository(db);
  siteRepository.insert({
    user_id: callerId,
    label: 'Main Yard',
    contact_name: 'Buyer Name',
    contact_phone: null,
    address_line1: '1 Export Road',
    address_line2: null,
    address_city: 'Leeds',
    address_region: null,
    address_postcode: 'LS1 1AA',
    address_country_code: 'GB',
    is_default: true,
    now: '2026-07-29T10:00:00.000Z',
  });
  siteRepository.insert({
    user_id: foreignId,
    label: 'Foreign Yard',
    contact_name: 'Other Buyer',
    contact_phone: null,
    address_line1: '2 Foreign Road',
    address_line2: null,
    address_city: 'York',
    address_region: null,
    address_postcode: 'YO1 1AA',
    address_country_code: 'GB',
    is_default: true,
    now: '2026-07-29T10:00:00.000Z',
  });
  const billingRepository = createBillingEntityRepository(db);
  billingRepository.insert({
    user_id: callerId,
    legal_name: 'Buyer Materials Ltd',
    registration_number: '12345678',
    vat_number: null,
    address_line1: '1 Export Road',
    address_line2: null,
    address_city: 'Leeds',
    address_region: null,
    address_postcode: 'LS1 1AA',
    address_country_code: 'GB',
    is_default: true,
    now: '2026-07-29T10:00:00.000Z',
  });
  orders.create({
    customerName: 'Buyer Name',
    customerEmail: 'buyer@example.test',
    shippingAddress: '1 Export Road, Leeds, LS1 1AA',
    promoApplied: null,
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    userId: callerId,
    createdAt: '2026-07-29T11:00:00.000Z',
    items: [
      {
        productId: '1',
        productName: 'Export Material',
        unitPriceCents: 1000,
        quantity: 1,
        discountableTotalCents: 1000,
        blendingFeeCents: 0,
        lineTotalCents: 1000,
        variantSnapshot: {
          variantId: 1,
          sku: 'EXPORT-001',
          label: '25 kg sack',
          weightGrams: 25_000,
          consumptionClassification: 'non-food',
          deliveryClass: 'freight',
        },
        customBlend: {
          configKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          basePercentage: 80,
          mixingGroup: 'trade-mortar',
          ingredients: [
            {
              variantId: 2,
              productId: '2',
              productName: 'Blend Ingredient',
              productDescription: 'A frozen export ingredient.',
              mixingGroup: 'trade-mortar',
              percentage: 20,
            },
          ],
          blendingFeeCents: 0,
          madeToOrder: true,
          returnable: false,
        },
      },
    ],
  });
  orders.create({
    customerName: 'Other Buyer',
    customerEmail: 'other@example.test',
    shippingAddress: '2 Foreign Road, York, YO1 1AA',
    promoApplied: null,
    subtotalCents: 500,
    discountCents: 0,
    totalCents: 500,
    userId: foreignId,
    createdAt: '2026-07-29T11:01:00.000Z',
    items: [
      {
        productId: '2',
        productName: 'Foreign Material',
        unitPriceCents: 500,
        quantity: 1,
        discountableTotalCents: 500,
        blendingFeeCents: 0,
        lineTotalCents: 500,
      },
    ],
  });
  preferences.update(
    callerId,
    { marketingEmail: true },
    {
      actor: { type: 'user', userId: callerId },
      requestId: 'preferences-before-export',
    },
  );
  const callerSession = sessions.create(callerId);
  sessions.create(foreignId);

  const unauthenticated = await app.inject({ method: 'GET', url: '/api/account/export' });
  assert.equal(unauthenticated.statusCode, 401);

  const response = await app.inject({
    method: 'GET',
    url: '/api/account/export',
    headers: { cookie: `sid=${callerSession.token}` },
  });
  assert.equal(response.statusCode, 200);
  const snapshot = JSON.parse(response.body) as Record<string, unknown>;
  assertNoSecrets(snapshot);
  assert.deepEqual(snapshot.profile, {
    id: String(callerId),
    email: 'buyer@example.test',
    displayName: 'Buyer Name',
    role: 'customer',
  });
  assert.equal((snapshot.deliverySites as Array<{ label: string }>).length, 1);
  assert.equal((snapshot.deliverySites as Array<{ label: string }>)[0]!.label, 'Main Yard');
  assert.equal((snapshot.orders as Array<{ id: string }>).length, 1);
  assert.equal((snapshot.customBlends as unknown[]).length, 1);
  assert.equal((snapshot.preferences as { marketingEmail: boolean }).marketingEmail, true);
  assert.equal((snapshot.sessions as Array<{ sessionId: string }>).length, 1);
  assert.deepEqual(snapshot.companyMemberships, []);

  assert.deepEqual(
    db.prepare(`SELECT recipient, subject, kind FROM dev_mailbox WHERE kind = 'data_export'`).all(),
    [
      {
        recipient: 'buyer@example.test',
        subject: 'QArefully Materials Exchange — data export',
        kind: 'data_export',
      },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        `SELECT action, actor_user_id, entity_type, entity_id FROM audit_events WHERE action = 'auth.data_exported'`,
      )
      .all(),
    [
      {
        action: 'auth.data_exported',
        actor_user_id: callerId,
        entity_type: 'user',
        entity_id: String(callerId),
      },
    ],
  );
});

void test('owned export line loading exceeds SQLite variable-list limits without leaking foreign lines', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-data-export-owned-orders-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const callerId = Number(
    db
      .prepare(
        `INSERT INTO users (email, display_name, password_hash, password_salt, role)
         VALUES ('export-scale@example.test', 'Export Scale', 'hash', 'salt', 'customer')`,
      )
      .run().lastInsertRowid,
  );
  const foreignId = Number(
    db
      .prepare(
        `INSERT INTO users (email, display_name, password_hash, password_salt, role)
         VALUES ('export-foreign@example.test', 'Export Foreign', 'hash', 'salt', 'customer')`,
      )
      .run().lastInsertRowid,
  );
  const ownedOrderCount = 32_768;

  db.prepare(
    `WITH RECURSIVE sequence(value) AS (
       VALUES(1)
       UNION ALL
       SELECT value + 1 FROM sequence WHERE value < ?
     )
     INSERT INTO orders
       (customer_name, customer_email, shipping_address, subtotal_cents, total_cents, user_id, created_at)
     SELECT 'Export Scale', 'export-scale@example.test', '1 Export Road', 100, 100, ?,
            '2026-07-29T12:00:00.000Z'
     FROM sequence`,
  ).run(ownedOrderCount, callerId);
  const foreignOrderId = Number(
    db
      .prepare(
        `INSERT INTO orders
       (customer_name, customer_email, shipping_address, subtotal_cents, total_cents, user_id, created_at)
     VALUES ('Export Foreign', 'export-foreign@example.test', '2 Foreign Road', 100, 100, ?,
             '2026-07-29T12:00:00.000Z')`,
      )
      .run(foreignId).lastInsertRowid,
  );
  db.prepare(
    `INSERT INTO order_line_items
       (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents,
        discountable_total_cents, blending_fee_cents)
     SELECT id, 1, 'Export Material', 100, 1, 100, 100, 0
     FROM orders WHERE user_id = ?`,
  ).run(callerId);
  db.prepare(
    `INSERT INTO order_line_items
       (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents,
        discountable_total_cents, blending_fee_cents)
     SELECT id, 2, 'Foreign Material', 100, 1, 100, 100, 0
     FROM orders WHERE user_id = ?`,
  ).run(foreignId);

  const exported = createOrderRepository(db).listExportOwned(callerId);

  assert.equal(exported.length, ownedOrderCount);
  assert.equal(exported[0]?.id, '1');
  assert.equal(exported.at(-1)?.id, String(ownedOrderCount));
  assert.ok(exported.every((order) => order.id !== String(foreignOrderId)));
  assert.equal(exported[0]?.items[0]?.productName, 'Export Material');
  assert.equal(exported.at(-1)?.items[0]?.productName, 'Export Material');
  assert.ok(exported.every((order) => order.items.length === 1));
});
