import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ErrorResponse, SuccessResponse } from '@shop/contracts/common';
import {
  CreateStandingOrderBody,
  StandingOrder,
  StandingOrderRun,
  StandingOrderRunListResponse,
  UpdateStandingOrderBody,
  type StandingOrder as StandingOrderResponse,
  type StandingOrderRun as StandingOrderRunResponse,
} from '@shop/contracts/standing-orders';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.js';
import type { StandingOrderErrorCode } from '../features/standingOrders/standingOrderErrors.js';
import { requireAuth } from '../plugins/auth.js';

const StandingOrderIdParam = Type.Object(
  { standingOrderId: Type.String({ pattern: '^[1-9][0-9]*$' }) },
  { additionalProperties: false },
);
const StandingOrderErrorResponse = Type.Object(
  {
    code: Type.Union([
      Type.Literal('NOT_FOUND'),
      Type.Literal('INACTIVE'),
      Type.Literal('SOURCE_NOT_FOUND'),
      Type.Literal('CART_RESERVED'),
      Type.Literal('CART_NOT_FOUND'),
    ]),
    error: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);
const errorStatus: Readonly<Record<StandingOrderErrorCode, 400 | 404 | 409>> = {
  NOT_FOUND: 404,
  INACTIVE: 409,
  SOURCE_NOT_FOUND: 404,
  CART_RESERVED: 409,
  CART_NOT_FOUND: 404,
};
const errorMessage: Readonly<Record<StandingOrderErrorCode, string>> = {
  NOT_FOUND: 'Standing order not found',
  INACTIVE: 'Standing order is inactive',
  SOURCE_NOT_FOUND: 'Standing order source not found',
  CART_RESERVED: 'Cart is reserved for checkout',
  CART_NOT_FOUND: 'Cart not found',
};
const context = (userId: number, requestId: string) => ({
  actor: { type: 'user' as const, userId },
  requestId,
});
const transport = (standingOrder: StandingOrderResponse): StandingOrderResponse => ({
  ...standingOrder,
  source: { ...standingOrder.source },
});
const transportRun = (run: StandingOrderRunResponse): StandingOrderRunResponse => ({
  ...run,
  outcomes: run.outcomes?.map((outcome) => ({ ...outcome })) ?? null,
});

/** Authenticated buyer schedule endpoints; ownership stays enforced by the domain service. */
export default function standingOrderRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const auth = [requireAuth(services.sessions)];
  const sendError = (
    reply: { code(status: 400 | 404 | 409): { send(body: unknown): void } },
    code: StandingOrderErrorCode,
  ) => {
    reply.code(errorStatus[code]).send({ code, error: errorMessage[code] });
  };

  typed.get(
    '/api/standing-orders',
    {
      preHandler: auth,
      schema: { response: { 200: Type.Array(StandingOrder), 401: ErrorResponse } },
    },
    (request) => services.standingOrders.list(request.authenticatedUser!.id).map(transport),
  );
  typed.post(
    '/api/standing-orders',
    {
      preHandler: auth,
      schema: {
        body: CreateStandingOrderBody,
        response: {
          201: StandingOrder,
          400: Type.Union([StandingOrderErrorResponse, ErrorResponse]),
          401: ErrorResponse,
          404: StandingOrderErrorResponse,
          409: StandingOrderErrorResponse,
        },
      },
    },
    (request, reply) => {
      const userId = request.authenticatedUser!.id;
      const result = services.standingOrders.create(
        userId,
        request.body,
        context(userId, request.id),
      );
      if (!result.ok) {
        sendError(reply, result.code);
        return;
      }
      reply.code(201);
      return transport(result.value);
    },
  );
  typed.patch(
    '/api/standing-orders/:standingOrderId',
    {
      preHandler: auth,
      schema: {
        params: StandingOrderIdParam,
        body: UpdateStandingOrderBody,
        response: {
          200: StandingOrder,
          400: Type.Union([StandingOrderErrorResponse, ErrorResponse]),
          401: ErrorResponse,
          404: StandingOrderErrorResponse,
          409: StandingOrderErrorResponse,
        },
      },
    },
    (request, reply) => {
      const userId = request.authenticatedUser!.id;
      const result = services.standingOrders.update(
        userId,
        Number(request.params.standingOrderId),
        request.body,
        context(userId, request.id),
      );
      if (!result.ok) {
        sendError(reply, result.code);
        return;
      }
      return transport(result.value);
    },
  );
  typed.delete(
    '/api/standing-orders/:standingOrderId',
    {
      preHandler: auth,
      schema: {
        params: StandingOrderIdParam,
        response: {
          200: SuccessResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          404: StandingOrderErrorResponse,
          409: StandingOrderErrorResponse,
        },
      },
    },
    (request, reply) => {
      const userId = request.authenticatedUser!.id;
      const result = services.standingOrders.delete(
        userId,
        Number(request.params.standingOrderId),
        context(userId, request.id),
      );
      if (!result.ok) {
        sendError(reply, result.code);
        return;
      }
      return { success: true as const };
    },
  );
  typed.get(
    '/api/standing-orders/:standingOrderId/runs',
    {
      preHandler: auth,
      schema: {
        params: StandingOrderIdParam,
        response: {
          200: StandingOrderRunListResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          404: StandingOrderErrorResponse,
        },
      },
    },
    (request, reply) => {
      const userId = request.authenticatedUser!.id;
      const standingOrderId = Number(request.params.standingOrderId);
      if (
        !services.standingOrders
          .list(userId)
          .some((standingOrder) => standingOrder.id === String(standingOrderId))
      ) {
        reply.code(404).send({ code: 'NOT_FOUND', error: errorMessage.NOT_FOUND });
        return;
      }
      return services.standingOrders.listRuns(userId, standingOrderId).map(transportRun);
    },
  );
  typed.post(
    '/api/standing-orders/:standingOrderId/run-now',
    {
      preHandler: auth,
      schema: {
        params: StandingOrderIdParam,
        response: {
          200: StandingOrderRun,
          400: Type.Union([StandingOrderErrorResponse, ErrorResponse]),
          401: ErrorResponse,
          404: StandingOrderErrorResponse,
          409: StandingOrderErrorResponse,
        },
      },
    },
    (request, reply) => {
      const userId = request.authenticatedUser!.id;
      const result = services.standingOrders.runNow(
        userId,
        Number(request.params.standingOrderId),
        context(userId, request.id),
      );
      if (!result.ok) {
        sendError(reply, result.code);
        return;
      }
      return transportRun(result.value);
    },
  );
}
