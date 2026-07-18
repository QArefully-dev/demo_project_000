import { randomBytes } from 'node:crypto';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { Clock } from './authService.js';
import type { SessionRepository, SessionUser } from './sessionRepository.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionTokenSource = () => string;
export interface SessionAuditDetails {
  context: AuditContext;
  source: 'signup' | 'login';
}

export interface SessionService {
  create(userId: number, audit?: SessionAuditDetails): { token: string; expiresAt: Date };
  destroy(token: string, context?: AuditContext): boolean;
  getUser(token: string): SessionUser | null;
  invalidateAllForUser(userId: number): void;
  invalidateOtherForUser(userId: number, token: string): void;
}

export function createSessionService(dependencies: {
  sessions: SessionRepository;
  clock: Clock;
  tokenSource?: SessionTokenSource;
  unitOfWork?: UnitOfWork;
  audit?: AuditWriter;
}): SessionService {
  const tokenSource = dependencies.tokenSource ?? (() => randomBytes(32).toString('hex'));
  const runAudited = (work: () => void): void => {
    if (!dependencies.unitOfWork || !dependencies.audit) {
      throw new Error('Audited session mutations require a unit of work and audit writer');
    }
    dependencies.unitOfWork.run(work);
  };
  return {
    create(userId, audit) {
      if (audit && (audit.context.actor.type !== 'user' || audit.context.actor.userId !== userId)) {
        throw new Error('Session creation audit requires the created user as actor');
      }
      const token = tokenSource();
      const expiresAt = new Date(dependencies.clock.now().getTime() + SESSION_DURATION_MS);
      const create = () => {
        dependencies.sessions.create({ token, userId, expiresAt: expiresAt.toISOString() });
        if (audit)
          dependencies.audit!.append({
            action: 'auth.session_created',
            userId,
            source: audit.source,
            context: audit.context,
          });
      };
      if (audit) runAudited(create);
      else create();
      return { token, expiresAt };
    },
    destroy(token, context) {
      let destroyed = false;
      if (context && context.actor.type !== 'user') {
        throw new Error('Session destruction audit requires a user actor');
      }
      const actorUserId = context?.actor.type === 'user' ? context.actor.userId : null;
      const destroy = () => {
        destroyed = dependencies.sessions.delete(token);
        if (destroyed && context) {
          dependencies.audit!.append({
            action: 'auth.session_destroyed',
            userId: actorUserId!,
            context,
          });
        }
      };
      if (context) runAudited(destroy);
      else destroy();
      return destroyed;
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
