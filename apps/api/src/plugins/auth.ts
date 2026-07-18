import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionService } from '../features/auth/sessionService.js';
import type { SessionUser } from '../features/auth/sessionRepository.js';
import type { AuditContext } from '../features/audit/auditEvent.js';
import type { SessionAuditDetails } from '../features/auth/sessionService.js';
import { sendForbidden, sendUnauthorized } from '../utils/errors.js';

export type AuthenticatedUser = SessionUser;

/** Persist session state through the service; cookie serialization remains an HTTP concern. */
export function createSession(
  sessions: SessionService,
  reply: FastifyReply,
  userId: number,
  audit?: SessionAuditDetails,
): string {
  const { token, expiresAt } = sessions.create(userId, audit);
  reply.setCookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    secure: false,
  });
  return token;
}

export function destroySession(
  sessions: SessionService,
  request: FastifyRequest,
  reply: FastifyReply,
  context?: AuditContext,
): void {
  const token = request.cookies?.sid;
  if (token) sessions.destroy(token, context);
  reply.clearCookie('sid', { path: '/' });
}

export function getAuthenticatedUser(
  sessions: SessionService,
  request: FastifyRequest,
): AuthenticatedUser | null {
  const token = request.cookies?.sid;
  return token ? sessions.getUser(token) : null;
}

export function requireAuth(sessions: SessionService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getAuthenticatedUser(sessions, request);
    if (!user) {
      sendUnauthorized(reply);
      return;
    }
    request.authenticatedUser = user;
    request.sessionToken = request.cookies?.sid ?? null;
  };
}

/** Require a valid session whose user has the administrator role. */
export function requireAdmin(sessions: SessionService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getAuthenticatedUser(sessions, request);
    if (!user) {
      sendUnauthorized(reply);
      return;
    }
    if (user.role !== 'admin') {
      sendForbidden(reply);
      return;
    }
    request.authenticatedUser = user;
    request.sessionToken = request.cookies?.sid ?? null;
  };
}

/** Attach request-local authentication state. */
export function authPlugin(sessions: SessionService) {
  return (app: FastifyInstance, _opts: unknown, done: () => void): void => {
    app.decorateRequest('authenticatedUser', null);
    app.decorateRequest('sessionToken', null);
    app.addHook('preHandler', (request, _reply, next) => {
      request.authenticatedUser = getAuthenticatedUser(sessions, request);
      next();
    });
    done();
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser: AuthenticatedUser | null;
    sessionToken: string | null;
  }
}
