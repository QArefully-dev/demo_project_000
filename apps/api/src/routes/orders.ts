import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { placeOrder, getOrder } from '../domains/orders.js';
import { sendNotFound, sendBadRequest } from '../utils/errors.js';
import {
  PlaceOrderResponse,
  OrderDetailResponse,
  ErrorResponse,
  OrderIdParam,
  PlaceOrderBody,
} from '@shop/contracts';

export default function ordersRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/api/checkout',
    {
      schema: {
        body: PlaceOrderBody,
        response: { 201: PlaceOrderResponse, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const result = placeOrder({
        cartId: request.body.cartId,
        promoCode: request.body.promoCode,
        customerName: request.body.customerName,
        customerEmail: request.body.customerEmail,
        shippingAddress: request.body.shippingAddress,
      });

      if (result === 'CART_NOT_FOUND') {
        sendNotFound(reply, 'Cart');
        return;
      }
      if (result === 'CART_EMPTY') {
        sendBadRequest(reply, 'Cart is empty');
        return;
      }
      if (result === 'PROMO_INVALID') {
        sendBadRequest(reply, 'Invalid or ineligible promo code');
        return;
      }

      reply.code(201);
      return result;
    },
  );

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
      const order = getOrder(orderId);
      if (!order) {
        sendNotFound(reply, 'Order');
        return;
      }
      return order;
    },
  );
}
