import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  AdminDecisionBody,
  AdminReceiveBody,
  AdminRefundBody,
  AdminReturnListQuery,
  AdminReturnListResponse,
  ReturnErrorResponse,
  ReturnIdParam,
  ReturnRequest,
} from '@shop/contracts/returns';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.js';
import { ReturnDomainError } from '../features/returns/returnErrors.js';
import { requireAdmin } from '../plugins/auth.js';
import { sendConflict, sendNotFound } from '../utils/errors.js';

function auditContext(userId: number, requestId: string) {
  return { actor: { type: 'user' as const, userId }, requestId };
}

function sendReturnError(
  reply: Parameters<typeof sendConflict>[0],
  error: ReturnDomainError,
): void {
  switch (error.code) {
    case 'RETURN_NOT_FOUND':
      sendNotFound(reply, 'Return');
      return;
    case 'RETURN_NOT_ELIGIBLE':
    case 'RETURN_WINDOW_EXPIRED':
    case 'QUANTITY_UNAVAILABLE':
      reply.code(422).send({ error: error.message, code: error.code });
      return;
    case 'INVALID_TRANSITION':
    case 'STALE_VERSION':
    case 'IDEMPOTENCY_CONFLICT':
    case 'PAYMENT_NOT_REFUNDABLE':
    case 'RETURN_DATA_CORRUPT':
      sendConflict(reply, error.message);
      return;
  }
}

export default function adminReturnsRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/admin/returns',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        querystring: AdminReturnListQuery,
        response: {
          200: AdminReturnListResponse,
          401: ReturnErrorResponse,
          403: ReturnErrorResponse,
        },
      },
    },
    (request) => {
      return services.returns.listReturns({
        status: request.query.status,
        page: request.query.page ?? 1,
        pageSize: request.query.pageSize ?? 20,
      });
    },
  );

  typed.post(
    '/api/admin/returns/:returnId/decision',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: ReturnIdParam,
        body: AdminDecisionBody,
        response: {
          200: ReturnRequest,
          401: ReturnErrorResponse,
          403: ReturnErrorResponse,
          404: ReturnErrorResponse,
          409: ReturnErrorResponse,
          422: ReturnErrorResponse,
        },
      },
    },
    (request, reply) => {
      const returnId = Number(request.params.returnId);
      const userId = request.authenticatedUser!.id;
      try {
        return services.returns.decideReturn({
          returnId,
          version: request.body.version,
          decision: request.body.decision,
          idempotencyKey: request.body.idempotencyKey,
          context: auditContext(userId, request.id),
        });
      } catch (error) {
        if (error instanceof ReturnDomainError) {
          sendReturnError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.post(
    '/api/admin/returns/:returnId/receive',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: ReturnIdParam,
        body: AdminReceiveBody,
        response: {
          200: ReturnRequest,
          401: ReturnErrorResponse,
          403: ReturnErrorResponse,
          404: ReturnErrorResponse,
          409: ReturnErrorResponse,
        },
      },
    },
    (request, reply) => {
      const returnId = Number(request.params.returnId);
      const userId = request.authenticatedUser!.id;
      try {
        return services.returns.receiveReturn({
          returnId,
          version: request.body.version,
          idempotencyKey: request.body.idempotencyKey,
          context: auditContext(userId, request.id),
        });
      } catch (error) {
        if (error instanceof ReturnDomainError) {
          sendReturnError(reply, error);
          return;
        }
        throw error;
      }
    },
  );

  typed.post(
    '/api/admin/returns/:returnId/refund',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: ReturnIdParam,
        body: AdminRefundBody,
        response: {
          200: ReturnRequest,
          401: ReturnErrorResponse,
          403: ReturnErrorResponse,
          404: ReturnErrorResponse,
          409: ReturnErrorResponse,
          422: ReturnErrorResponse,
        },
      },
    },
    (request, reply) => {
      const returnId = Number(request.params.returnId);
      const userId = request.authenticatedUser!.id;
      try {
        return services.returns.refundReturn({
          returnId,
          version: request.body.version,
          idempotencyKey: request.body.idempotencyKey,
          context: auditContext(userId, request.id),
        });
      } catch (error) {
        if (error instanceof ReturnDomainError) {
          sendReturnError(reply, error);
          return;
        }
        throw error;
      }
    },
  );
}
