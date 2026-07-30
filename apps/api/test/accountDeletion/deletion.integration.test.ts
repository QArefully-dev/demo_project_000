import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createUnitOfWork } from '../../src/db/unitOfWork.js';
import { createAccountDeletionRepository } from '../../src/features/accountDeletion/deletionRepository.js';
import { createAccountDeletionService } from '../../src/features/accountDeletion/deletionService.js';
import { createAuditRepository } from '../../src/features/audit/auditRepository.js';
import { createAuditWriter } from '../../src/features/audit/auditService.js';
import { createAuthService } from '../../src/features/auth/authService.js';
import { createSessionRepository } from '../../src/features/auth/sessionRepository.js';
import { createSessionService } from '../../src/features/auth/sessionService.js';
import { createUserRepository } from '../../src/features/auth/userRepository.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createPasswordResetRepository } from '../../src/features/passwordReset/passwordResetRepository.js';
import { createPasswordResetService } from '../../src/features/passwordReset/passwordResetService.js';
import { createBillingEntityRepository } from '../../src/features/tradeAccount/billingEntityRepository.js';
import { createDeliverySiteRepository } from '../../src/features/tradeAccount/deliverySiteRepository.js';
import { authPlugin } from '../../src/plugins/auth.js';
import accountDeletionRoutes from '../../src/routes/accountDeletion.js';
import { hashPassword } from '../../src/utils/passwords.js';

const now = '2026-07-29T12:00:00.000Z';
const clock = { now: () => new Date(now) };

async function createFixture(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-account-deletion-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  const unitOfWork = createUnitOfWork(db);
  const audit = createAuditWriter({ repository: createAuditRepository(db), clock });
  const users = createUserRepository(db);
  const mailbox = createMailboxRepository(db);
  const sessions = createSessionService({
    sessions: createSessionRepository(db),
    clock,
    unitOfWork,
    audit,
  });
  const accountDeletion = createAccountDeletionService({
    users,
    repository: createAccountDeletionRepository(db),
    unitOfWork,
    audit,
    clock,
  });
  const auth = createAuthService({ users, clock, unitOfWork, audit });
  const passwordReset = createPasswordResetService({
    repository: createPasswordResetRepository(db),
    mailbox,
    clock,
    baseUrl: 'https://web.example.test',
    tokenSource: () => 'deletion-reset-token',
    unitOfWork,
    audit,
  });
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  await app.register(fastifyCookie);
  authPlugin(sessions)(app, {}, () => undefined);
  await app.register(accountDeletionRoutes, { services: { sessions, accountDeletion } });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  return { app, db, sessions, auth, passwordReset, audit };
}

async function insertUser(db: ReturnType<typeof openDatabase>, email: string, displayName: string) {
  const passwordHash = await hashPassword('current-password-123');
  return Number(
    (
      db
        .prepare(
          `INSERT INTO users (email, display_name, password_hash, password_salt, role, created_at)
           VALUES (?, ?, ?, '', 'customer', ?) RETURNING id`,
        )
        .get(email, displayName, passwordHash, now) as { id: number }
    ).id,
  );
}

void test('account deletion redacts live account data while preserving commerce history and purging sessions', async (t) => {
  const { app, db, sessions, auth, passwordReset, audit } = await createFixture(t);
  const userId = await insertUser(db, 'delete-me@example.test', 'Delete Me');
  const foreignUserId = await insertUser(db, 'foreign-cart@example.test', 'Foreign Cart');
  const productId = Number(
    (db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get() as { id: number }).id,
  );
  const variantId = Number(
    (db.prepare('SELECT id FROM product_variants ORDER BY id LIMIT 1').get() as { id: number }).id,
  );
  const ownedCartId = 'delete-owner-cart';
  const foreignCartId = 'delete-foreign-cart';
  const ownedConfigKey = 'a'.repeat(64);
  const foreignConfigKey = 'b'.repeat(64);
  db.prepare('INSERT INTO carts (id) VALUES (?), (?)').run(ownedCartId, foreignCartId);
  audit.append({
    action: 'cart.created',
    cartId: ownedCartId,
    context: { actor: { type: 'user', userId }, requestId: 'owned-cart-create' },
  });
  audit.append({
    action: 'cart.created',
    cartId: foreignCartId,
    context: { actor: { type: 'user', userId: foreignUserId }, requestId: 'foreign-cart-create' },
  });
  db.prepare(
    `INSERT INTO cart_line_items
       (cart_id, variant_id, config_key, custom_blend_json, quantity, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?), (?, ?, '', NULL, 1, ?, ?), (?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    ownedCartId,
    variantId,
    ownedConfigKey,
    JSON.stringify({ configKey: ownedConfigKey }),
    now,
    now,
    ownedCartId,
    variantId,
    now,
    now,
    foreignCartId,
    variantId,
    foreignConfigKey,
    JSON.stringify({ configKey: foreignConfigKey }),
    now,
    now,
  );
  db.prepare(
    `INSERT INTO user_preferences (user_id, order_updates_email, marketing_email, approval_request_email, updated_at)
     VALUES (?, 0, 1, 0, ?)`,
  ).run(userId, now);
  db.prepare('INSERT INTO favourites (user_id, product_id) VALUES (?, ?)').run(userId, productId);
  createDeliverySiteRepository(db).insert({
    user_id: userId,
    label: 'Deletion Yard',
    contact_name: 'Delete Me',
    contact_phone: null,
    address_line1: '1 Removal Road',
    address_line2: null,
    address_city: 'Leeds',
    address_region: null,
    address_postcode: 'LS1 1AA',
    address_country_code: 'GB',
    is_default: true,
    now,
  });
  createBillingEntityRepository(db).insert({
    user_id: userId,
    legal_name: 'Deletion Materials Ltd',
    registration_number: null,
    vat_number: null,
    address_line1: '1 Removal Road',
    address_line2: null,
    address_city: 'Leeds',
    address_region: null,
    address_postcode: 'LS1 1AA',
    address_country_code: 'GB',
    is_default: true,
    now,
  });
  const orderId = Number(
    (
      db
        .prepare(
          `INSERT INTO orders
            (customer_name, customer_email, shipping_address, subtotal_cents, total_cents, user_id, created_at)
           VALUES ('Delete Me', 'delete-me@example.test', '1 Removal Road', 1000, 1000, ?, ?)
           RETURNING id`,
        )
        .get(userId, now) as { id: number }
    ).id,
  );
  const paymentId = Number(
    (
      db
        .prepare(
          `INSERT INTO payments
            (order_id, idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, created_at)
           VALUES (?, 'deletion-payment', 'deletion-fingerprint', 'succeeded', 1000, '4242', 'visa', ?)
           RETURNING id`,
        )
        .get(orderId, now) as { id: number }
    ).id,
  );
  const returnId = Number(
    (
      db
        .prepare(
          `INSERT INTO return_requests (order_id, user_id, status, reason, requested_at)
           VALUES (?, ?, 'requested', 'other', ?) RETURNING id`,
        )
        .get(orderId, userId, now) as { id: number }
    ).id,
  );
  const companyId = Number(
    (
      db
        .prepare(
          `INSERT INTO company_accounts (name, created_by_user_id, active, created_at, updated_at)
           VALUES ('Sole Delete Co', ?, 1, ?, ?) RETURNING id`,
        )
        .get(userId, now, now) as { id: number }
    ).id,
  );
  db.prepare(
    `INSERT INTO company_memberships (company_id, user_id, role, active, created_at)
     VALUES (?, ?, 'owner', 1, ?)`,
  ).run(companyId, userId, now);
  const current = sessions.create(userId);
  const other = sessions.create(userId);
  passwordReset.request('delete-me@example.test');
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id = ?')
        .get(userId) as {
        total: number;
      }
    ).total,
    1,
  );

  const response = await app.inject({
    method: 'POST',
    url: '/api/account/delete',
    headers: { cookie: `sid=${current.token}` },
    payload: { currentPassword: 'current-password-123' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { success: true });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/account/delete',
        headers: { cookie: `sid=${other.token}` },
        payload: { currentPassword: 'current-password-123' },
      })
    ).statusCode,
    401,
  );
  assert.deepEqual(
    db
      .prepare('SELECT email, display_name, password_hash, password_salt FROM users WHERE id = ?')
      .get(userId),
    {
      email: `deleted-${userId}@tombstone.local`,
      display_name: 'Deleted User',
      password_hash: '',
      password_salt: '',
    },
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?').get(userId) as {
        total: number;
      }
    ).total,
    0,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id = ?')
        .get(userId) as {
        total: number;
      }
    ).total,
    0,
  );
  assert.equal(
    (await auth.login({ email: 'delete-me@example.test', password: 'current-password-123' })).ok,
    false,
  );
  const mailboxBefore = (
    db.prepare('SELECT COUNT(*) AS total FROM dev_mailbox').get() as { total: number }
  ).total;
  passwordReset.request('delete-me@example.test');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS total FROM dev_mailbox').get() as { total: number }).total,
    mailboxBefore,
  );
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_digest, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    userId,
    createHash('sha256').update('stale-deletion-token').digest('hex'),
    '2026-07-29T13:00:00.000Z',
    now,
  );
  assert.equal(
    await passwordReset.reset({
      token: 'stale-deletion-token',
      newPassword: 'replacement-password-123',
    }),
    'INVALID_TOKEN',
  );
  assert.deepEqual(
    db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').get(userId),
    { password_hash: '', password_salt: '' },
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS total FROM user_preferences WHERE user_id = ?')
        .get(userId) as { total: number }
    ).total,
    0,
  );
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS total FROM favourites WHERE user_id = ?').get(userId) as {
        total: number;
      }
    ).total,
    0,
  );
  assert.deepEqual(
    db.prepare('SELECT active, is_default FROM delivery_sites WHERE user_id = ?').all(userId),
    [{ active: 0, is_default: 0 }],
  );
  assert.equal(
    (
      db
        .prepare(
          'SELECT COUNT(*) AS total FROM cart_line_items WHERE cart_id = ? AND custom_blend_json IS NOT NULL',
        )
        .get(ownedCartId) as { total: number }
    ).total,
    0,
  );
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS total FROM cart_line_items WHERE cart_id = ?')
        .get(ownedCartId) as {
        total: number;
      }
    ).total,
    1,
  );
  assert.equal(
    (
      db
        .prepare(
          'SELECT COUNT(*) AS total FROM cart_line_items WHERE cart_id = ? AND custom_blend_json IS NOT NULL',
        )
        .get(foreignCartId) as { total: number }
    ).total,
    1,
  );
  assert.deepEqual(
    db.prepare('SELECT active, is_default FROM billing_entities WHERE user_id = ?').all(userId),
    [{ active: 0, is_default: 0 }],
  );
  assert.deepEqual(db.prepare('SELECT active FROM company_accounts WHERE id = ?').get(companyId), {
    active: 0,
  });
  assert.deepEqual(
    db.prepare('SELECT active FROM company_memberships WHERE user_id = ?').get(userId),
    { active: 0 },
  );
  assert.deepEqual(db.prepare('SELECT id, user_id FROM orders WHERE id = ?').get(orderId), {
    id: orderId,
    user_id: userId,
  });
  assert.deepEqual(db.prepare('SELECT id, order_id FROM payments WHERE id = ?').get(paymentId), {
    id: paymentId,
    order_id: orderId,
  });
  assert.deepEqual(
    db.prepare('SELECT id, user_id, order_id FROM return_requests WHERE id = ?').get(returnId),
    { id: returnId, user_id: userId, order_id: orderId },
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT action, actor_user_id, entity_type, entity_id FROM audit_events WHERE action = ?',
      )
      .all('auth.account_deleted'),
    [
      {
        action: 'auth.account_deleted',
        actor_user_id: userId,
        entity_type: 'user',
        entity_id: String(userId),
      },
    ],
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT user_id, requested_at, completed_at, tombstone_email, tombstone_display_name FROM account_deletion_events',
      )
      .all(),
    [
      {
        user_id: userId,
        requested_at: now,
        completed_at: now,
        tombstone_email: `deleted-${userId}@tombstone.local`,
        tombstone_display_name: 'Deleted User',
      },
    ],
  );
});

void test('account deletion rejects a wrong password without mutation', async (t) => {
  const { app, db, sessions } = await createFixture(t);
  const userId = await insertUser(db, 'wrong-password@example.test', 'Wrong Password');
  const session = sessions.create(userId);
  const response = await app.inject({
    method: 'POST',
    url: '/api/account/delete',
    headers: { cookie: `sid=${session.token}` },
    payload: { currentPassword: 'not-the-current-password' },
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId), {
    email: 'wrong-password@example.test',
    display_name: 'Wrong Password',
  });
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?').get(userId) as {
        total: number;
      }
    ).total,
    1,
  );
});

void test('account deletion blocks an owner while another active company member remains', async (t) => {
  const { app, db, sessions } = await createFixture(t);
  const ownerId = await insertUser(db, 'owner-delete@example.test', 'Owner Delete');
  const memberId = await insertUser(db, 'member-delete@example.test', 'Member Delete');
  const companyId = Number(
    (
      db
        .prepare(
          `INSERT INTO company_accounts (name, created_by_user_id, active, created_at, updated_at)
           VALUES ('Blocked Owner Co', ?, 1, ?, ?) RETURNING id`,
        )
        .get(ownerId, now, now) as { id: number }
    ).id,
  );
  db.prepare(
    `INSERT INTO company_memberships (company_id, user_id, role, active, created_at)
     VALUES (?, ?, 'owner', 1, ?), (?, ?, 'buyer', 1, ?)`,
  ).run(companyId, ownerId, now, companyId, memberId, now);
  const ownerSession = sessions.create(ownerId);
  const response = await app.inject({
    method: 'POST',
    url: '/api/account/delete',
    headers: { cookie: `sid=${ownerSession.token}` },
    payload: { currentPassword: 'current-password-123' },
  });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(ownerId), {
    email: 'owner-delete@example.test',
    display_name: 'Owner Delete',
  });
  assert.deepEqual(db.prepare('SELECT active FROM company_accounts WHERE id = ?').get(companyId), {
    active: 1,
  });
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?').get(ownerId) as {
        total: number;
      }
    ).total,
    1,
  );
});
