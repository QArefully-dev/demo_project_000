import { Type, type Static } from '@sinclair/typebox';
import { EmailAddress, Password, SuccessResponse } from './common.js';

export const PublicUser = Type.Object({
  id: Type.String({ minLength: 1 }),
  email: EmailAddress,
  displayName: Type.String({ minLength: 1, maxLength: 120 }),
  role: Type.Union([Type.Literal('customer'), Type.Literal('admin')]),
});
export type PublicUser = Static<typeof PublicUser>;

export const SignupBody = Type.Object({
  email: EmailAddress,
  password: Password,
  displayName: Type.String({ minLength: 1, maxLength: 120 }),
});
export type SignupBody = Static<typeof SignupBody>;
export const LoginBody = Type.Object({ email: EmailAddress, password: Password });
export type LoginBody = Static<typeof LoginBody>;
export const ForgotPasswordBody = Type.Object({ email: EmailAddress });
export type ForgotPasswordBody = Static<typeof ForgotPasswordBody>;
export const ResetPasswordBody = Type.Object({
  token: Type.String({ minLength: 1, maxLength: 512 }),
  newPassword: Password,
});
export type ResetPasswordBody = Static<typeof ResetPasswordBody>;
export const ChangePasswordBody = Type.Object({ currentPassword: Password, newPassword: Password });
export type ChangePasswordBody = Static<typeof ChangePasswordBody>;

export { SuccessResponse };
