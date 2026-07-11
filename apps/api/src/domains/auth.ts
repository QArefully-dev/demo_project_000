import { randomBytes } from 'node:crypto';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';

// ── Helpers ────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

// ── Public user shape returned by domains ─────────────────

export interface PublicUserData {
  id: number;
  email: string;
  displayName: string;
  role: string;
}

function toPublicUser(row: {
  id: number;
  email: string;
  display_name: string;
  role: string;
}): PublicUserData {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

// ── Signup ─────────────────────────────────────────────────

export type SignupResult =
  | { ok: true; user: PublicUserData }
  | { ok: false; error: 'EMAIL_EXISTS' | 'WEAK_PASSWORD' | 'INVALID_DISPLAY_NAME' };

export async function signup(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<SignupResult> {
  const email = normalizeEmail(params.email);
  const displayName = params.displayName.trim();
  const password = params.password;

  if (displayName.length < 1 || displayName.length > 80) {
    return { ok: false, error: 'INVALID_DISPLAY_NAME' };
  }

  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: 'WEAK_PASSWORD' };
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return { ok: false, error: 'EMAIL_EXISTS' };
  }

  const storedPassword = await hashPassword(password);

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO users (email, display_name, password_hash, password_salt, role, created_at)
       VALUES (?, ?, ?, '', 'customer', ?)`,
    )
    .run(email, displayName, storedPassword, now);

  const userId = Number(result.lastInsertRowid);

  const userRow = db
    .prepare('SELECT id, email, display_name, role FROM users WHERE id = ?')
    .get(userId) as {
    id: number;
    email: string;
    display_name: string;
    role: string;
  };

  return { ok: true, user: toPublicUser(userRow) };
}

// ── Login ──────────────────────────────────────────────────

export type LoginResult =
  { ok: true; user: PublicUserData } | { ok: false; error: 'INVALID_CREDENTIALS' };

export async function login(params: { email: string; password: string }): Promise<LoginResult> {
  const email = normalizeEmail(params.email);
  const db = getDb();

  const row = db
    .prepare(
      'SELECT id, email, display_name, role, password_hash, password_salt FROM users WHERE email = ?',
    )
    .get(email) as
    | {
        id: number;
        email: string;
        display_name: string;
        role: string;
        password_hash: string;
        password_salt: string;
      }
    | undefined;

  if (!row) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  // Support both combined "salt.hash" format (password_salt empty) and legacy split format.
  const stored = row.password_salt
    ? `${row.password_salt}.${row.password_hash}`
    : row.password_hash;
  const valid = await verifyPassword(params.password, stored);

  if (!valid) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  return { ok: true, user: toPublicUser(row) };
}

// ── Forgot Password ────────────────────────────────────────

/**
 * Always returns true for security (no user enumeration).
 * If the email exists, generates a 30-minute reset token and adds a
 * mailbox message with a clickable reset link.
 */
export function forgotPassword(email: string): boolean {
  const normalized = normalizeEmail(email);
  const db = getDb();

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(normalized) as
    { id: number; email: string } | undefined;

  if (!user) {
    return true; // Always return success — no user enumeration.
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    token,
    expiresAt,
  );

  const resetLink = `http://127.0.0.1:5173/reset-password?token=${token}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO dev_mailbox (recipient, subject, body, kind, created_at)
     VALUES (?, ?, ?, 'reset', ?)`,
  ).run(
    user.email,
    'Password Reset Request',
    `Click the link to reset your password: ${resetLink}`,
    now,
  );

  return true;
}

// ── Reset Password ─────────────────────────────────────────

export type ResetPasswordResult = 'SUCCESS' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED';

export async function resetPassword(params: {
  token: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const db = getDb();

  const row = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?')
    .get(params.token) as
    { id: number; user_id: number; expires_at: string; used_at: string | null } | undefined;

  if (!row) {
    return 'INVALID_TOKEN';
  }

  if (row.used_at) {
    return 'ALREADY_USED';
  }

  if (new Date(row.expires_at) <= new Date()) {
    return 'EXPIRED';
  }

  // Hash new password
  const storedPassword = await hashPassword(params.newPassword);

  const now = new Date().toISOString();

  // Update password hash and mark token as used in a transaction
  const update = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(
      storedPassword,
      '',
      row.user_id,
    );

    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, row.id);

    // Invalidate all sessions for this user
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });

  update();

  return 'SUCCESS';
}

// ── Change Password ───────────────────────────────────────

export type ChangePasswordResult = 'SUCCESS' | 'INVALID_CURRENT' | 'SAME_PASSWORD';

/**
 * Change the password for an authenticated user.
 * Verifies the current password, rejects if the new password is the same,
 * updates the stored hash, and invalidates all other sessions while
 * preserving the current session.
 */
export async function changePassword(params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
  currentSessionToken: string;
}): Promise<ChangePasswordResult> {
  const db = getDb();

  const row = db
    .prepare('SELECT password_hash, password_salt FROM users WHERE id = ?')
    .get(params.userId) as { password_hash: string; password_salt: string } | undefined;

  if (!row) {
    return 'INVALID_CURRENT';
  }

  // Verify current password
  const stored = row.password_salt
    ? `${row.password_salt}.${row.password_hash}`
    : row.password_hash;
  const valid = await verifyPassword(params.currentPassword, stored);

  if (!valid) {
    return 'INVALID_CURRENT';
  }

  // Reject same password
  if (params.currentPassword === params.newPassword) {
    return 'SAME_PASSWORD';
  }

  // Hash new password and update
  const newStoredPassword = await hashPassword(params.newPassword);

  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(
      newStoredPassword,
      '',
      params.userId,
    );

    // Invalidate all other sessions; preserve the current session
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(
      params.userId,
      params.currentSessionToken,
    );
  })();

  return 'SUCCESS';
}

// ── Mailbox ────────────────────────────────────────────────

export interface MailboxMessageData {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  kind: string;
  created: string;
}

export function getMailbox(): MailboxMessageData[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, recipient, subject, body, kind, created_at FROM dev_mailbox ORDER BY created_at DESC',
    )
    .all() as {
    id: number;
    recipient: string;
    subject: string;
    body: string;
    kind: string;
    created_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    body: r.body,
    kind: r.kind,
    created: r.created_at,
  }));
}
