import { randomBytes } from 'node:crypto';
import type { Clock } from './authService.js';
import type { SessionRepository, SessionUser } from './sessionRepository.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionTokenSource = () => string;

export interface SessionService {
  create(userId: number): { token: string; expiresAt: Date };
  destroy(token: string): void;
  getUser(token: string): SessionUser | null;
  invalidateAllForUser(userId: number): void;
  invalidateOtherForUser(userId: number, token: string): void;
}

export function createSessionService(dependencies: {
  sessions: SessionRepository;
  clock: Clock;
  tokenSource?: SessionTokenSource;
}): SessionService {
  const tokenSource = dependencies.tokenSource ?? (() => randomBytes(32).toString('hex'));
  return {
    create(userId) {
      const token = tokenSource();
      const expiresAt = new Date(dependencies.clock.now().getTime() + SESSION_DURATION_MS);
      dependencies.sessions.create({ token, userId, expiresAt: expiresAt.toISOString() });
      return { token, expiresAt };
    },
    destroy(token) {
      dependencies.sessions.delete(token);
    },
    getUser(token) {
      const session = dependencies.sessions.findUser(token);
      if (!session) return null;
      if (new Date(session.expiresAt) <= dependencies.clock.now()) {
        dependencies.sessions.delete(token);
        return null;
      }
      return session.user;
    },
    invalidateAllForUser(userId) {
      dependencies.sessions.deleteForUser(userId);
    },
    invalidateOtherForUser(userId, token) {
      dependencies.sessions.deleteOtherForUser(userId, token);
    },
  };
}
