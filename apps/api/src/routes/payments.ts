import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendBadRequest, sendNotFound, sendPaymentError, sendConflict } from '../utils/errors.js';
import { PaymentBody, PaymentErrorResponse } from '@shop/contracts/payments';
import { PlaceOrderResponse } from '@shop/contracts/orders';
import { ErrorResponse } from '@shop/contracts/common';
import type { AppContext } from '../app.js';

export default function paymentRoutes(app: FastifyInstance, { services }: AppContext): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/api/payments/pay',
    {
      schema: {
        body: PaymentBody,
        response: {
          201: PlaceOrderResponse,
          400: ErrorResponse,
          402: PaymentErrorResponse,
          409: ErrorResponse,
          500: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const userId = request.authenticatedUser?.id ?? null;

      const result = await services.checkout.process({
        cartId: request.body.cartId,
        promoCode: request.body.promoCode,
        customerName: request.body.customerName,
        customerEmail: request.body.customerEmail,
        shippingAddress: request.body.shippingAddress,
        cardNumber: request.body.cardNumber,
        cardExpiry: request.body.cardExpiry,
        cardCvc: request.body.cardCvc,
        idempotencyKey: request.body.idempotencyKey,
        userId,
      });

      if (result.success) {
        reply.code(201);
        return result.order;
      }

      switch (result.error) {
        case 'CART_NOT_FOUND':
          sendNotFound(reply, 'Cart');
          return;
        case 'CART_EMPTY':
          sendBadRequest(reply, 'Cart is empty');
          return;
        case 'CARD_INVALID':
          sendBadRequest(reply, 'Invalid card details');
          return;
        case 'PROMO_INVALID':
          sendBadRequest(reply, result.promoError ?? 'Invalid or ineligible promo code');
          return;
        case 'DECLINED':
          sendPaymentError(reply, 'Payment failed', 'CARD_DECLINED');
          return;
        case 'TIMEOUT':
          sendPaymentError(reply, 'Payment failed', 'GATEWAY_TIMEOUT');
          return;
        case 'IDEMPOTENT_CONFLICT':
          sendConflict(reply, 'Payment already submitted with different data');
          return;
        case 'IDEMPOTENT_IN_PROGRESS':
          sendConflict(reply, 'Payment is already being processed');
          return;
        case 'CHECKOUT_FAILED':
          reply.code(500).send({ error: 'Checkout could not be completed' });
          return;
      }
    },
  );
}
