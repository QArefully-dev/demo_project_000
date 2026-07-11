/**
 * Auth domain — stub (Wave 0).
 * Full implementation deferred to W1.A.
 */

/** Stub: register a new user. */
export function signup(_params: {
  email: string;
  password: string;
  displayName: string;
}): { userId: number } | 'EMAIL_EXISTS' {
  void _params;
  return 'EMAIL_EXISTS';
}

/** Stub: authenticate a user. */
export function login(_params: {
  email: string;
  password: string;
}): { userId: number } | 'INVALID_CREDENTIALS' {
  void _params;
  return 'INVALID_CREDENTIALS';
}

/** Stub: generate a password reset token. Always returns success. */
export function forgotPassword(_email: string): boolean {
  void _email;
  return true;
}

/** Stub: reset password with token. */
export function resetPassword(_params: {
  token: string;
  newPassword: string;
}): 'SUCCESS' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED' {
  void _params;
  return 'INVALID_TOKEN';
}

/** Stub: change password for authenticated user. */
export function changePassword(_params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): 'SUCCESS' | 'INVALID_CURRENT' | 'SAME_PASSWORD' {
  void _params;
  return 'INVALID_CURRENT';
}
