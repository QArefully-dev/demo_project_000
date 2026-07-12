import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';
import { sendUnauthorized } from '../utils/errors.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Public user info extractable from the session (never contains token/hash/salt). */
export interface AuthenticatedUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
}

interface SessionRow {
  token: string;
  user_id: number;
  expires_at: string;
}

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: string;
}

/**
 * Generate a cryptographically random session token as 32-byte hex.
 * Never serialized to the client beyond the cookie.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a session in the database and set the `sid` cookie on the reply.
 */
export function createSession(reply: FastifyReply, userId: number): string {
  const db = getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt,
  );

  reply.setCookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    secure: false, // local HTTP
  });

  return token;
}

/**
 * Clear the session cookie and delete the session from the database.
 */
export function destroySession(request: FastifyRequest, reply: FastifyReply): void {
  const token = request.cookies?.sid;
  if (token) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  reply.clearCookie('sid', { path: '/' });
}

/**
 * Hydrate the current user from the `sid` cookie.
 * Returns AuthenticatedUser or null. Invalid/expired sessions are cleaned up.
 */
export function getAuthenticatedUser(request: FastifyRequest): AuthenticatedUser | null {
  const token = request.cookies?.sid;
  if (!token) return null;

  const db = getDb();
  const session = db
    .prepare(
      `SELECT s.token, s.user_id, s.expires_at, u.id, u.email, u.display_name, u.role
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`,
    )
    .get(token) as (SessionRow & UserRow) | undefined;

  if (!session) return null;

  // Expired session — clean up
  if (new Date(session.expires_at) <= new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: session.user_id,
    email: session.email,
    displayName: session.display_name,
    role: session.role,
  };
}

/**
 * Fastify preHandler that requires an authenticated session.
 * Responds 401 if no valid session is found.
 */
export function requireAuth(request: FastifyRequest, reply: FastifyReply): void {
  const user = getAuthenticatedUser(request);
  if (!user) {
    sendUnauthorized(reply);
    return;
  }
  // Attach user and current session token to request for downstream handlers.
  request.authenticatedUser = user;
  request.sessionToken = request.cookies?.sid ?? null;
}

/**
 * Register the auth plugin on a Fastify instance.
 * Parses cookies, hydrates user, and provides requireAuth.
 * Must be registered before route plugins.
 */
export function authPlugin(app: FastifyInstance, _opts: unknown, done: () => void): void {
  // Decorate request with authenticatedUser and sessionToken (set by requireAuth or preHandler)
  app.decorateRequest('authenticatedUser', null);
  app.decorateRequest('sessionToken', null);

  // Hydrate user on every request (best-effort, non-blocking).
  app.addHook('onRequest', (request) => {
    const user = getAuthenticatedUser(request);
    request.authenticatedUser = user;
  });

  done();
}

// Augment Fastify types for the decorated request properties.
declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser: AuthenticatedUser | null;
    sessionToken: string | null;
  }
}
