import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendBadRequest, sendNotFound, sendPaymentError, sendConflict } from '../utils/errors.js';
import {
  PaymentBody,
  PaymentConflictResponse,
  PaymentErrorResponse,
  PaymentSuccessResponse,
} from '@shop/contracts/payments';
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
          201: PaymentSuccessResponse,
          400: ErrorResponse,
          402: PaymentErrorResponse,
          409: PaymentConflictResponse,
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
        auditContext: {
          actor: userId === null ? { type: 'anonymous', userId: null } : { type: 'user', userId },
          requestId: request.id,
        },
      });

      if (result.success) {
        if (userId === null) {
          const { token } = services.orderAccess.issue(Number(result.order.id));
          reply.setCookie(`qpc_order_${result.order.id}`, token, {
            httpOnly: true,
            sameSite: 'lax',
            path: `/api/orders/${result.order.id}`,
            maxAge: 24 * 60 * 60,
            secure: false,
          });
        }
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
        case 'MIX_REQUOTE_REQUIRED':
          reply.code(409).send({
            code: 'MIX_REQUOTE_REQUIRED',
            error: 'Mix price changed. Requote required.',
            mixes: result.mixes,
          });
          return;
        case 'MIX_STOCK_UNAVAILABLE':
          reply.code(409).send({
            code: 'MIX_STOCK_UNAVAILABLE',
            error: 'Mix ingredients are no longer in stock.',
            mixIds: result.mixIds,
            productIds: result.productIds,
          });
          return;
        case 'RESERVATION_EXPIRED':
          reply.code(409).send({
            error: 'RESERVATION_EXPIRED',
            reservationExpiresAt: result.reservationExpiresAt,
          });
          return;
        case 'INSUFFICIENT_STOCK':
          reply.code(409).send({ error: 'INSUFFICIENT_STOCK', productIds: result.productIds });
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
