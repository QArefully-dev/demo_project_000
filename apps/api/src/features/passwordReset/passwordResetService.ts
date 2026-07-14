import { createHash, randomBytes } from 'node:crypto';
import { isValidPassword, normalizeEmail } from '../auth/authRules.js';
import { passwordHasher, type Clock, type PasswordHasher } from '../auth/authService.js';
import type { MailboxRepository } from '../mailbox/mailboxRepository.js';
import type { PasswordResetRepository } from './passwordResetRepository.js';

const RESET_DURATION_MS = 30 * 60 * 1000;

export type PasswordResetResult =
  'SUCCESS' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED' | 'WEAK_PASSWORD';
export type ResetTokenSource = () => string;

export interface PasswordResetService {
  request(email: string): void;
  reset(params: { token: string; newPassword: string }): Promise<PasswordResetResult>;
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createResetLink(baseUrl: string, token: string): string {
  const link = new URL('/reset-password', baseUrl);
  link.searchParams.set('token', token);
  return link.toString();
}

export function createPasswordResetService(dependencies: {
  repository: PasswordResetRepository;
  mailbox: MailboxRepository;
  clock: Clock;
  baseUrl: string;
  tokenSource?: ResetTokenSource;
  passwords?: PasswordHasher;
}): PasswordResetService {
  const tokenSource = dependencies.tokenSource ?? (() => randomBytes(32).toString('hex'));
  const passwords = dependencies.passwords ?? passwordHasher;
  new URL(dependencies.baseUrl);

  return {
    request(email) {
      const now = dependencies.clock.now();
      const user = dependencies.repository.findUserByEmail(normalizeEmail(email));
      if (!user) return;

      const token = tokenSource();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + RESET_DURATION_MS).toISOString();
      dependencies.repository.transaction(() => {
        dependencies.repository.removeExpired(createdAt);
        dependencies.repository.revokeActiveForUser(user.id);
        dependencies.repository.create({
          userId: user.id,
          tokenDigest: digestToken(token),
          expiresAt,
          createdAt,
        });
        dependencies.mailbox.add({
          recipient: user.email,
          subject: 'Password Reset Request',
          body: `Click the link to reset your password: ${createResetLink(dependencies.baseUrl, token)}`,
          kind: 'reset',
          createdAt,
        });
      });
    },
    async reset({ token, newPassword }) {
      if (!isValidPassword(newPassword)) return 'WEAK_PASSWORD';
      const tokenDigest = digestToken(token);
      const initial = dependencies.repository.findByDigest(tokenDigest);
      if (!initial) return 'INVALID_TOKEN';
      if (initial.usedAt) return 'ALREADY_USED';
      if (new Date(initial.expiresAt) <= dependencies.clock.now()) return 'EXPIRED';

      const passwordHash = await passwords.hash(newPassword);
      return dependencies.repository.transaction(() => {
        const current = dependencies.repository.findByDigest(tokenDigest);
        if (!current) return 'INVALID_TOKEN';
        if (current.usedAt) return 'ALREADY_USED';
        const now = dependencies.clock.now().toISOString();
        if (new Date(current.expiresAt) <= new Date(now)) return 'EXPIRED';
        if (!dependencies.repository.consume(current.id, now)) return 'ALREADY_USED';

        dependencies.repository.updatePassword(current.userId, passwordHash);
        dependencies.repository.invalidateSessions(current.userId);
        return 'SUCCESS';
      });
    },
  };
}
