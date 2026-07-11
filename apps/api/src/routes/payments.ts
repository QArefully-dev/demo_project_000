import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sendNotImplemented } from '../utils/errors.js';
import {
  PaymentBody,
  PaymentErrorResponse,
  PlaceOrderResponse,
  ErrorResponse,
} from '@shop/contracts';

/**
 * Payment routes — stub (Wave 0).
 * Returns 501 "Not implemented".
 * Real implementation deferred to W1.D.
 */
export default function paymentRoutes(app: FastifyInstance): void {
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
        },
      },
    },
    async (_request, reply) => {
      sendNotImplemented(reply);
    },
  );
}
