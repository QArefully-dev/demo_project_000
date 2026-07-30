import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  AdminOrderDetailResponse,
  AdminOrdersListResponse,
} from '@shop/contracts/admin-orders-list';
import { ErrorResponse } from '@shop/contracts/common';
import {
  AdminOrderListQuery as AdminOrderListQuerySchema,
  OrderIdParam,
} from '@shop/contracts/orders';
import type { FastifyInstance } from 'fastify';
import type { SessionService } from '../features/auth/sessionService.js';
import { OrderAdminError, type OrderAdminService } from '../features/orders/orderAdminService.js';
import { requireAdmin } from '../plugins/auth.js';
import { sendBadRequest, sendNotFound } from '../utils/errors.js';
export interface AdminOrdersListRouteServices {
  sessions: SessionService;
  orderAdmin: OrderAdminService;
}
function sendError(reply: Parameters<typeof sendBadRequest>[0], e: OrderAdminError) {
  if (e.code === 'ORDER_NOT_FOUND') return sendNotFound(reply, 'Order');
  sendBadRequest(reply, e.message);
}
export default function adminOrdersListRoutes(
  app: FastifyInstance,
  { services }: { services: AdminOrdersListRouteServices },
): void {
  app.addHook('onRequest', requireAdmin(services.sessions));
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  typed.get(
    '/api/admin/orders',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        querystring: AdminOrderListQuerySchema,
        response: {
          200: AdminOrdersListResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
        },
      },
    },
    (r, reply) => {
      try {
        return services.orderAdmin.listAdmin(r.query);
      } catch (e) {
        if (e instanceof OrderAdminError) return sendError(reply, e);
        throw e;
      }
    },
  );
  typed.get(
    '/api/admin/orders/:orderId',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: OrderIdParam,
        response: {
          200: AdminOrderDetailResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    (r, reply) => {
      try {
        return services.orderAdmin.getAdminDetail(Number(r.params.orderId));
      } catch (e) {
        if (e instanceof OrderAdminError) return sendError(reply, e);
        throw e;
      }
    },
  );
}
