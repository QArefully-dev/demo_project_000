import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import { OrderDetailResponse, OrderIdParam } from '@shop/contracts/orders';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';

export default function ordersRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/api/orders/:orderId',
    {
      schema: {
        params: OrderIdParam,
        response: { 200: OrderDetailResponse, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const orderId = Number(request.params.orderId);
      if (Number.isNaN(orderId)) {
        sendBadRequest(reply, 'Invalid order ID');
        return;
      }
      const order = services.orders.get(orderId);
      if (!order) {
        sendNotFound(reply, 'Order');
        return;
      }
      return order;
    },
  );
}
