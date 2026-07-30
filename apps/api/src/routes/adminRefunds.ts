import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CreateAdminRefundBody,
  AdminRefund,
  type AdminRefund as AdminRefundResponse,
} from '@shop/contracts/admin-refunds';
import { ErrorResponse } from '@shop/contracts/common';
import type { FastifyInstance } from 'fastify';
import type { SessionService } from '../features/auth/sessionService.js';
import {
  AdminRefundError,
  type AdminRefundService,
  type AdminRefundRecord,
} from '../features/payments/adminRefundService.js';
import { requireAdmin } from '../plugins/auth.js';
import { sendBadRequest, sendConflict } from '../utils/errors.js';
export interface AdminRefundsRouteServices {
  sessions: SessionService;
  adminRefunds: AdminRefundService;
}
const context = (userId: number, requestId: string) => ({
  actor: { type: 'user' as const, userId },
  requestId,
});
function sendError(reply: Parameters<typeof sendBadRequest>[0], e: AdminRefundError) {
  if (e.code === 'PAYMENT_NOT_REFUNDABLE' || e.code === 'PAYMENT_ORDER_MISMATCH')
    return sendConflict(reply, e.message);
  sendBadRequest(reply, e.message);
}
function map(refund: AdminRefundRecord): AdminRefundResponse {
  if (refund.processor !== 'simulated') throw new Error('Unexpected refund processor');
  return { ...refund, processor: 'simulated' };
}
export default function adminRefundsRoutes(
  app: FastifyInstance,
  { services }: { services: AdminRefundsRouteServices },
): void {
  app.addHook('onRequest', requireAdmin(services.sessions));
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  typed.post(
    '/api/admin/refunds',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        body: CreateAdminRefundBody,
        response: {
          200: AdminRefund,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (r, reply) => {
      try {
        return map(
          services.adminRefunds.refund({
            paymentId: Number(r.body.paymentId),
            orderId: Number(r.body.orderId),
            amountCents: r.body.amountCents,
            reason: r.body.reason,
            idempotencyKey: r.body.idempotencyKey,
            context: context(r.authenticatedUser!.id, r.id),
          }),
        );
      } catch (e) {
        if (e instanceof AdminRefundError) return sendError(reply, e);
        throw e;
      }
    },
  );
}
