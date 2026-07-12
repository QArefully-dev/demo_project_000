import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { sendBadRequest, sendUnauthorized, sendConflict } from '../utils/errors.js';
import { createSession, destroySession, requireAuth } from '../plugins/auth.js';
import {
  signup as signupDomain,
  login as loginDomain,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../domains/auth.js';
import {
  SignupBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ChangePasswordBody,
  ErrorResponse,
  SuccessResponse,
  PublicUser,
} from '@shop/contracts';

/**
 * Auth routes.
 * Signup, login, logout, forgot/reset password, /me, change password (W2.B stub).
 */
export default function authRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  // POST /signup
  typed.post(
    '/signup',
    {
      schema: {
        body: SignupBody,
        response: {
          201: PublicUser,
          400: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password, displayName } = request.body as {
        email: string;
        password: string;
        displayName: string;
      };

      const result = await signupDomain({ email, password, displayName });

      if (!result.ok) {
        if (result.error === 'EMAIL_EXISTS') {
          sendConflict(reply, 'A user with this email already exists');
          return;
        }
        sendBadRequest(reply, result.error);
        return;
      }

      createSession(reply, result.user.id);

      reply.code(201).send({
        id: String(result.user.id),
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
      });
    },
  );

  // POST /login
  typed.post(
    '/login',
    {
      schema: {
        body: LoginBody,
        response: {
          200: PublicUser,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as { email: string; password: string };

      const result = await loginDomain({ email, password });

      if (!result.ok) {
        sendUnauthorized(reply, 'Invalid email or password');
        return;
      }

      createSession(reply, result.user.id);

      reply.code(200).send({
        id: String(result.user.id),
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
      });
    },
  );

  // POST /logout
  typed.post(
    '/logout',
    {
      schema: {
        response: {
          200: SuccessResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      destroySession(request, reply);
      reply.code(200).send({ success: true as const });
    },
  );

  // POST /forgot-password
  typed.post(
    '/forgot-password',
    {
      schema: {
        body: ForgotPasswordBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string };
      forgotPassword(email);
      // Always return success — no user enumeration.
      reply.code(200).send({ success: true as const });
    },
  );

  // POST /reset-password
  typed.post(
    '/reset-password',
    {
      schema: {
        body: ResetPasswordBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token, newPassword } = request.body as { token: string; newPassword: string };

      if (newPassword.length < 8 || newPassword.length > 128) {
        sendBadRequest(reply, 'Password must be 8-128 characters');
        return;
      }

      const result = await resetPassword({ token, newPassword });

      if (result === 'INVALID_TOKEN') {
        sendBadRequest(reply, 'Invalid or missing reset token');
        return;
      }
      if (result === 'EXPIRED') {
        sendBadRequest(reply, 'Reset token has expired');
        return;
      }
      if (result === 'ALREADY_USED') {
        sendBadRequest(reply, 'Reset token has already been used');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );

  // GET /me
  typed.get(
    '/me',
    {
      schema: {
        response: {
          200: Type.Union([PublicUser, Type.Null()]),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.authenticatedUser;
      if (!user) {
        reply.code(200).send(null);
        return;
      }
      reply.code(200).send({
        id: String(user.id),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
    },
  );

  // PATCH /password
  typed.patch(
    '/password',
    {
      preHandler: requireAuth,
      schema: {
        body: ChangePasswordBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      const user = request.authenticatedUser!;
      const sessionToken = request.sessionToken;

      if (newPassword.length < 8 || newPassword.length > 128) {
        sendBadRequest(reply, 'Password must be 8-128 characters');
        return;
      }

      const result = await changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
        currentSessionToken: sessionToken ?? '',
      });

      if (result === 'INVALID_CURRENT') {
        sendBadRequest(reply, 'Current password is incorrect');
        return;
      }
      if (result === 'SAME_PASSWORD') {
        sendBadRequest(reply, 'New password must be different from current password');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );
}
