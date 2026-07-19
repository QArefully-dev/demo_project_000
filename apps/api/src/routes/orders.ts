import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendConflict, sendNotFound } from '../utils/errors.js';
import {
  CancelOrderBody,
  OrderDetailResponse,
  OrderIdParam,
  OrderListQuery,
  OrderListResponse,
} from '@shop/contracts/orders';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';
import { OrderDomainError } from '../features/orders/orderErrors.js';
import { requireCustomer } from '../plugins/auth.js';

function sendOrderError(reply: Parameters<typeof sendConflict>[0], error: OrderDomainError): void {
  switch (error.code) {
    case 'ORDER_NOT_FOUND':
    case 'ORDER_FORBIDDEN':
      sendNotFound(reply, 'Order');
      return;
    case 'INVALID_ALLOCATION':
    case 'INVALID_TRANSITION':
    case 'CANCELLATION_NOT_ALLOWED':
    case 'STALE_VERSION':
    case 'IDEMPOTENCY_CONFLICT':
    case 'TRACKING_NOT_ALLOWED':
      sendConflict(reply, error.message);
  }
}

function auditContext(userId: number, requestId: string) {
  return { actor: { type: 'user' as const, userId }, requestId };
}

export default function ordersRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/orders',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        querystring: OrderListQuery,
        response: {
          200: OrderListResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
        },
      },
    },
    (request) =>
      services.orders.listOwned(
        request.authenticatedUser!.id,
        request.query.page,
        request.query.pageSize,
      ),
  );

  typed.get(
    '/api/orders/:orderId',
    {
      schema: {
        params: OrderIdParam,
        response: { 200: OrderDetailResponse, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    (request, reply) => {
      const orderId = Number(request.params.orderId);
      const user = request.authenticatedUser;
      const ownerOrAdminOrder =
        user?.role === 'admin'
          ? services.orders.get(orderId)
          : user?.role === 'customer'
            ? services.orders.getOwned(orderId, user.id)
            : undefined;
      const order =
        ownerOrAdminOrder ??
        (services.orderAccess.validate(orderId, request.cookies?.[`qpc_order_${orderId}`])
          ? services.orders.get(orderId)
          : undefined);
      if (!order) {
        sendNotFound(reply, 'Order');
        return;
      }
      return order;
    },
  );

  typed.post(
    '/api/orders/:orderId/cancel',
    {
      preHandler: [requireCustomer(services.sessions)],
      schema: {
        params: OrderIdParam,
        body: CancelOrderBody,
        response: {
          200: OrderDetailResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      const orderId = Number(request.params.orderId);
      const userId = request.authenticatedUser!.id;
      if (!services.orders.getOwned(orderId, userId)) {
        sendNotFound(reply, 'Order');
        return;
      }
      try {
        return services.orders.cancel({
          orderId,
          version: request.body.version,
          idempotencyKey: request.body.idempotencyKey,
          context: auditContext(userId, request.id),
        });
      } catch (error) {
        if (error instanceof OrderDomainError) {
          sendOrderError(reply, error);
          return;
        }
        throw error;
      }
    },
  );
}
