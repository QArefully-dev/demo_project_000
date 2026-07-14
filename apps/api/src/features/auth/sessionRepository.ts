import type Database from 'better-sqlite3';
import type { PublicUser } from '@shop/contracts/auth';

export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  role: PublicUser['role'];
}

export interface SessionRecord {
  token: string;
  userId: number;
  expiresAt: string;
}

interface SessionRow {
  token: string;
  user_id: number;
  expires_at: string;
  email?: string;
  display_name?: string;
  role?: PublicUser['role'];
}

export interface SessionRepository {
  create(session: SessionRecord): void;
  findUser(token: string): (SessionRecord & { user: SessionUser }) | null;
  delete(token: string): void;
  deleteForUser(userId: number): void;
  deleteOtherForUser(userId: number, token: string): void;
}

export function createSessionRepository(db: Database.Database): SessionRepository {
  return {
    create({ token, userId, expiresAt }) {
      db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
        token,
        userId,
        expiresAt,
      );
    },
    findUser(token) {
      const row = db
        .prepare(
          `SELECT s.token, s.user_id, s.expires_at, u.email, u.display_name, u.role
           FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`,
        )
        .get(token) as SessionRow | undefined;
      if (!row || !row.email || !row.display_name || !row.role) return null;
      return {
        token: row.token,
        userId: row.user_id,
        expiresAt: row.expires_at,
        user: { id: row.user_id, email: row.email, displayName: row.display_name, role: row.role },
      };
    },
    delete(token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    },
    deleteForUser(userId) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    },
    deleteOtherForUser(userId, token) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(userId, token);
    },
  };
}
