/**
 * Auth domain — stub (Wave 0).
 * Full implementation deferred to W1.A.
 */

/** Stub: register a new user. */
export async function signup(_params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ userId: number } | 'EMAIL_EXISTS'> {
  return 'EMAIL_EXISTS';
}

/** Stub: authenticate a user. */
export async function login(_params: {
  email: string;
  password: string;
}): Promise<{ userId: number } | 'INVALID_CREDENTIALS'> {
  return 'INVALID_CREDENTIALS';
}

/** Stub: generate a password reset token. Always returns success. */
export function forgotPassword(_email: string): boolean {
  return true;
}

/** Stub: reset password with token. */
export async function resetPassword(_params: {
  token: string;
  newPassword: string;
}): Promise<'SUCCESS' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED'> {
  return 'INVALID_TOKEN';
}

/** Stub: change password for authenticated user. */
export async function changePassword(_params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): Promise<'SUCCESS' | 'INVALID_CURRENT' | 'SAME_PASSWORD'> {
  return 'INVALID_CURRENT';
}
