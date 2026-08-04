import { createHash } from 'node:crypto';
import { LEGACY_DATA_COUNTRY } from '@shop/contracts';
import type Database from 'better-sqlite3';

const SEED_INSTANT = '2026-07-29T09:00:00.000Z';
const INVITE_EXPIRY = '2027-07-29T09:00:00.000Z';

function inviteDigest(label: string): string {
  return createHash('sha256').update(`account-depth-seed:${label}`).digest('hex');
}

function findUserId(db: Database.Database, email: string, country: string): number | undefined {
  const row = db
    .prepare('SELECT id FROM users WHERE email = ? AND country = ?')
    .get(email, country) as { id: number } | undefined;
  return row?.id;
}

/** Installs deterministic company fixtures without changing customer-created company records. */
export function seedCompanyAccounts(db: Database.Database): void {
  const ownerId = findUserId(db, 'acme@example.com', LEGACY_DATA_COUNTRY);
  const buyerId = findUserId(db, 'buyer@example.com', LEGACY_DATA_COUNTRY);
  const approverId = findUserId(db, 'approver@example.com', LEGACY_DATA_COUNTRY);
  // Account deletion tombstones its fixture email. Seed must not recreate or partially restore it;
  // resetDatabase is the explicit path for recreating the complete company fixture.
  if (ownerId === undefined || buyerId === undefined || approverId === undefined) return;

  db.prepare(
    `INSERT INTO company_accounts
      (name, created_by_user_id, active, approval_threshold_cents, created_at, updated_at)
     SELECT 'Acme Materials Ltd', ?, 1, 50000, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM company_accounts WHERE created_by_user_id = ? AND name = 'Acme Materials Ltd'
     )`,
  ).run(ownerId, SEED_INSTANT, SEED_INSTANT, ownerId);

  const company = db
    .prepare(
      `SELECT id FROM company_accounts
       WHERE created_by_user_id = ? AND name = 'Acme Materials Ltd'
       ORDER BY id LIMIT 1`,
    )
    .get(ownerId) as { id: number } | undefined;
  if (!company) throw new Error('Account-depth seed company is missing');

  const insertMembership = db.prepare(
    `INSERT OR IGNORE INTO company_memberships (company_id, user_id, role, active, created_at)
     VALUES (?, ?, ?, 1, ?)`,
  );
  insertMembership.run(company.id, ownerId, 'owner', SEED_INSTANT);
  insertMembership.run(company.id, buyerId, 'buyer', SEED_INSTANT);
  insertMembership.run(company.id, approverId, 'approver', SEED_INSTANT);

  db.prepare(
    `INSERT INTO user_preferences
      (user_id, order_updates_email, marketing_email, approval_request_email, updated_at)
     VALUES (?, 1, 0, 1, ?)
     ON CONFLICT(user_id) DO NOTHING`,
  ).run(ownerId, SEED_INSTANT);
  db.prepare(
    `INSERT INTO user_preferences
      (user_id, order_updates_email, marketing_email, approval_request_email, updated_at)
     VALUES (?, 1, 0, 1, ?)
     ON CONFLICT(user_id) DO NOTHING`,
  ).run(buyerId, SEED_INSTANT);
  db.prepare(
    `INSERT INTO user_preferences
      (user_id, order_updates_email, marketing_email, approval_request_email, updated_at)
     VALUES (?, 1, 0, 1, ?)
     ON CONFLICT(user_id) DO NOTHING`,
  ).run(approverId, SEED_INSTANT);

  const insertInvite = db.prepare(
    `INSERT OR IGNORE INTO company_invites
      (company_id, email, role, token_digest, status, expires_at, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertInvite.run(
    company.id,
    'buyer@example.com',
    'buyer',
    inviteDigest('buyer-accepted'),
    'accepted',
    INVITE_EXPIRY,
    SEED_INSTANT,
    SEED_INSTANT,
  );
  insertInvite.run(
    company.id,
    'pending-invite@example.com',
    'approver',
    inviteDigest('approver-pending'),
    'pending',
    INVITE_EXPIRY,
    SEED_INSTANT,
    null,
  );
}
