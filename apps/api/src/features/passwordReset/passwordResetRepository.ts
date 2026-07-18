import type Database from 'better-sqlite3';

export interface PasswordResetToken {
  id: number;
  userId: number;
  expiresAt: string;
  usedAt: string | null;
}

interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  expires_at: string;
  used_at: string | null;
}

export interface PasswordResetRepository {
  findUserByEmail(email: string): { id: number; email: string } | null;
  create(input: {
    userId: number;
    tokenDigest: string;
    expiresAt: string;
    createdAt: string;
  }): void;
  findByDigest(tokenDigest: string): PasswordResetToken | null;
  revokeActiveForUser(userId: number): void;
  removeExpired(now: string): void;
  consume(tokenId: number, now: string): boolean;
  updatePassword(userId: number, passwordHash: string): void;
  invalidateSessions(userId: number): void;
}

function toToken(row: PasswordResetTokenRow): PasswordResetToken {
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at, usedAt: row.used_at };
}

export function createPasswordResetRepository(db: Database.Database): PasswordResetRepository {
  return {
    findUserByEmail(email) {
      return (
        (db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as
          { id: number; email: string } | undefined) ?? null
      );
    },
    create({ userId, tokenDigest, expiresAt, createdAt }) {
      db.prepare(
        `INSERT INTO password_reset_tokens (user_id, token_digest, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(userId, tokenDigest, expiresAt, createdAt);
    },
    findByDigest(tokenDigest) {
      const row = db
        .prepare(
          'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_digest = ?',
        )
        .get(tokenDigest) as PasswordResetTokenRow | undefined;
      return row ? toToken(row) : null;
    },
    revokeActiveForUser(userId) {
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL').run(
        userId,
      );
    },
    removeExpired(now) {
      db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ?').run(now);
    },
    consume(tokenId, now) {
      return (
        db
          .prepare(
            `UPDATE password_reset_tokens SET used_at = ?
             WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
          )
          .run(now, tokenId, now).changes === 1
      );
    },
    updatePassword(userId, passwordHash) {
      db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(
        passwordHash,
        '',
        userId,
      );
    },
    invalidateSessions(userId) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    },
  };
}
