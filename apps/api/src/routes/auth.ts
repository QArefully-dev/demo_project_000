import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotImplemented } from '../utils/errors.js';
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
 * Auth routes — stubs (Wave 0).
 * All endpoints return 501 "Not implemented".
 * Real implementation deferred to W1.A.
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
    async (_request, reply) => {
      sendNotImplemented(reply);
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
    async (_request, reply) => {
      sendNotImplemented(reply);
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
    async (_request, reply) => {
      sendNotImplemented(reply);
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
    async (_request, reply) => {
      sendNotImplemented(reply);
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
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );

  // GET /me
  typed.get(
    '/me',
    {
      schema: {
        response: {
          200: PublicUser,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );

  // PATCH /password
  typed.patch(
    '/password',
    {
      schema: {
        body: ChangePasswordBody,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );
}
