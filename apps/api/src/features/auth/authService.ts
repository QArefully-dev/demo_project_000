import type { PublicUser } from '@shop/contracts/auth';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';
import {
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  normalizeDisplayName,
  normalizeEmail,
} from './authRules.js';
import type { UserCredentials, UserRecord, UserRepository } from './userRepository.js';

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export const passwordHasher: PasswordHasher = { hash: hashPassword, verify: verifyPassword };

export interface AuthService {
  signup(params: { email: string; password: string; displayName: string }): Promise<SignupResult>;
  login(params: { email: string; password: string }): Promise<LoginResult>;
  changePassword(params: {
    userId: number;
    currentPassword: string;
    newPassword: string;
    invalidateOtherSessions: () => void;
  }): Promise<ChangePasswordResult>;
}

export type SignupResult =
  | { ok: true; userId: number; user: PublicUser }
  | {
      ok: false;
      error: 'EMAIL_EXISTS' | 'WEAK_PASSWORD' | 'INVALID_DISPLAY_NAME' | 'INVALID_EMAIL';
    };
export type LoginResult = { ok: true; userId: number; user: PublicUser } | { ok: false };
export type ChangePasswordResult =
  'SUCCESS' | 'INVALID_CURRENT' | 'SAME_PASSWORD' | 'WEAK_PASSWORD';

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: String(user.id), email: user.email, displayName: user.displayName, role: user.role };
}

function storedPassword(user: UserCredentials): string {
  return user.passwordSalt ? `${user.passwordSalt}.${user.passwordHash}` : user.passwordHash;
}

function isUniqueEmailError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (('code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') ||
      /UNIQUE constraint failed: users\.email/.test(error.message))
  );
}

export function createAuthService(dependencies: {
  users: UserRepository;
  clock: Clock;
  passwords?: PasswordHasher;
}): AuthService {
  const passwords = dependencies.passwords ?? passwordHasher;
  return {
    async signup({ email: providedEmail, password, displayName: providedDisplayName }) {
      const email = normalizeEmail(providedEmail);
      const displayName = normalizeDisplayName(providedDisplayName);
      if (!isValidEmail(email)) return { ok: false, error: 'INVALID_EMAIL' };
      if (!isValidDisplayName(displayName)) return { ok: false, error: 'INVALID_DISPLAY_NAME' };
      if (!isValidPassword(password)) return { ok: false, error: 'WEAK_PASSWORD' };

      const passwordHash = await passwords.hash(password);
      try {
        const user = dependencies.users.create({
          email,
          displayName,
          passwordHash,
          now: dependencies.clock.now().toISOString(),
        });
        return { ok: true, userId: user.id, user: toPublicUser(user) };
      } catch (error) {
        if (isUniqueEmailError(error)) return { ok: false, error: 'EMAIL_EXISTS' };
        throw error;
      }
    },
    async login({ email: providedEmail, password }) {
      const user = dependencies.users.findCredentialsByEmail(normalizeEmail(providedEmail));
      if (!user || !(await passwords.verify(password, storedPassword(user)))) return { ok: false };
      return { ok: true, userId: user.id, user: toPublicUser(user) };
    },
    async changePassword({ userId, currentPassword, newPassword, invalidateOtherSessions }) {
      if (!isValidPassword(newPassword)) return 'WEAK_PASSWORD';
      const user = dependencies.users.findCredentialsById(userId);
      if (!user || !(await passwords.verify(currentPassword, storedPassword(user))))
        return 'INVALID_CURRENT';
      if (currentPassword === newPassword) return 'SAME_PASSWORD';
      dependencies.users.updatePassword(userId, await passwords.hash(newPassword));
      invalidateOtherSessions();
      return 'SUCCESS';
    },
  };
}
