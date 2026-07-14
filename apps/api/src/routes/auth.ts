import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendBadRequest, sendUnauthorized, sendConflict } from '../utils/errors.js';
import { createSession, destroySession, requireAuth } from '../plugins/auth.js';
import {
  SignupBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ChangePasswordBody,
  SuccessResponse,
  PublicUser,
  CurrentUserResponse,
} from '@shop/contracts/auth';
import { ErrorResponse } from '@shop/contracts/common';
import { toPublicUser } from '../features/auth/authService.js';
import type { AppContext } from '../app.js';

/** Auth routes. */
export default function authRoutes(app: FastifyInstance, { services }: AppContext): void {
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
    async (request, reply) => {
      const { email, password, displayName } = request.body;

      const result = await services.auth.signup({ email, password, displayName });

      if (!result.ok) {
        if (result.error === 'EMAIL_EXISTS') {
          sendConflict(reply, 'A user with this email already exists');
          return;
        }
        sendBadRequest(reply, result.error);
        return;
      }

      createSession(services.sessions, reply, result.userId);
      reply.code(201).send(result.user);
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
    async (request, reply) => {
      const { email, password } = request.body;

      const result = await services.auth.login({ email, password });

      if (!result.ok) {
        sendUnauthorized(reply, 'Invalid email or password');
        return;
      }

      createSession(services.sessions, reply, result.userId);
      reply.code(200).send(result.user);
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
    async (request, reply) => {
      destroySession(services.sessions, request, reply);
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
    async (request, reply) => {
      const { email } = request.body;
      services.passwordReset.request(email);
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
    async (request, reply) => {
      const { token, newPassword } = request.body;

      const result = await services.passwordReset.reset({ token, newPassword });

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
      if (result === 'WEAK_PASSWORD') {
        sendBadRequest(reply, 'Password must be 8-128 characters');
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
          200: CurrentUserResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.authenticatedUser;
      if (!user) {
        reply.code(200).send(null);
        return;
      }
      reply.code(200).send(toPublicUser(user));
    },
  );

  // PATCH /password
  typed.patch(
    '/password',
    {
      preHandler: requireAuth(services.sessions),
      schema: {
        body: ChangePasswordBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;

      const user = request.authenticatedUser!;
      const sessionToken = request.sessionToken;

      const result = await services.auth.changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
        invalidateOtherSessions: () =>
          services.sessions.invalidateOtherForUser(user.id, sessionToken ?? ''),
      });

      if (result === 'INVALID_CURRENT') {
        sendBadRequest(reply, 'Current password is incorrect');
        return;
      }
      if (result === 'SAME_PASSWORD') {
        sendBadRequest(reply, 'New password must be different from current password');
        return;
      }
      if (result === 'WEAK_PASSWORD') {
        sendBadRequest(reply, 'Password must be 8-128 characters');
        return;
      }

      reply.code(200).send({ success: true as const });
    },
  );
}
