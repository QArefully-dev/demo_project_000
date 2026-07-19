import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendConflict, sendNotFound } from '../utils/errors.js';
import { OrderIdParam } from '@shop/contracts/orders';
import {
  CreateReturnRequestBody,
  ReturnErrorResponse,
  ReturnOverviewResponse,
  ReturnRequest,
} from '@shop/contracts/returns';
import type { AppContext } from '../app.js';
import { ReturnDomainError } from '../features/returns/returnErrors.js';
import { requireCustomer } from '../plugins/auth.js';

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

function auditContext(userId: number, requestId: string) {
  return { actor: { type: 'user' as const, userId }, requestId };
}

export default function returnsRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/orders/:orderId/returns',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: OrderIdParam,
        response: {
          200: ReturnOverviewResponse,
          401: ReturnErrorResponse,
          403: ReturnErrorResponse,
          404: ReturnErrorResponse,
        },
      },
    },
    (request, reply) => {
      const orderId = Number(request.params.orderId);
      const userId = request.authenticatedUser!.id;
      try {
        return services.returns.getOverview(orderId, userId);
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
    '/api/orders/:orderId/returns',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: OrderIdParam,
        body: CreateReturnRequestBody,
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
      const orderId = Number(request.params.orderId);
      const userId = request.authenticatedUser!.id;
      try {
        return services.returns.requestReturn({
          orderId,
          userId,
          idempotencyKey: request.body.idempotencyKey,
          reason: request.body.reason,
          note: request.body.note ?? null,
          selections: request.body.selections,
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
