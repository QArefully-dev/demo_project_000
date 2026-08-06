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
        deliveryDestination: request.body.deliveryDestination,
        billingSelection: request.body.billingSelection,
        deliverySlot: request.body.deliverySlot,
        purchaseOrderReference: request.body.purchaseOrderReference,
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
        case 'BELOW_MOQ':
          sendBadRequest(reply, 'Cart quantity does not meet a variant minimum order quantity');
          return;
        case 'PROMO_INVALID':
          sendBadRequest(reply, result.promoError ?? 'Invalid or ineligible promo code');
          return;
        // Both resolution failures answer 400 with one message each. A saved record that is
        // unknown, retired, or another buyer's must be indistinguishable from here.
        case 'DELIVERY_SITE_NOT_FOUND':
          sendBadRequest(reply, 'Selected delivery site is not available');
          return;
        case 'DELIVERY_COUNTRY_NOT_ALLOWED':
          sendBadRequest(reply, 'Selected delivery country is not available');
          return;
        case 'BILLING_ENTITY_INVALID':
          sendBadRequest(reply, 'Selected billing details are not available');
          return;
        case 'DELIVERY_SLOT_UNAVAILABLE':
          // Same conflict class as stock shortfall: well-formed request, the buyer must rebook.
          // The freshly derived earliest date travels with it so the picker can recover in place.
          reply
            .code(409)
            .send({ error: 'DELIVERY_SLOT_UNAVAILABLE', earliestDate: result.earliestDate });
          return;
        case 'PENDING_APPROVAL':
          {
            const response = {
              error: 'PENDING_APPROVAL' as const,
              approvalRequestId: result.approvalRequestId,
            };
            reply.code(409).send(response);
          }
          return;
        case 'APPROVAL_REJECTED':
        case 'APPROVAL_EXPIRED':
        case 'APPROVAL_TOTAL_DRIFT':
          reply.code(409).send({ error: result.error });
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
        case 'RESERVATION_EXPIRED':
          reply.code(409).send({
            error: 'RESERVATION_EXPIRED',
            reservationExpiresAt: result.reservationExpiresAt,
          });
          return;
        case 'CUSTOM_BLEND_INVALID':
          // Catalog state moved under a configured line. Same conflict class as stock shortfall:
          // the request was well formed, the cart must be revisited before paying.
          reply.code(409).send({ error: 'CUSTOM_BLEND_INVALID' });
          return;
        case 'INSUFFICIENT_STOCK':
          reply.code(409).send({ error: 'INSUFFICIENT_STOCK', productIds: result.productIds });
          return;
        case 'BLOCKED_IN_COUNTRY':
          reply.code(409).send({ error: 'BLOCKED_IN_COUNTRY', productIds: result.productIds });
          return;
        case 'IDEMPOTENT_IN_PROGRESS':
          sendConflict(reply, 'Payment is already being processed');
          return;
        case 'CHECKOUT_FAILED':
          reply.code(500).send({ error: 'Checkout could not be completed' });
          return;
      }

      const exhaustiveResult: never = result;
      void exhaustiveResult;
    },
  );
}
