import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { InventoryReceiptBody, InventoryReceiptResponse } from '@shop/contracts/inventory';
import { ErrorResponse } from '@shop/contracts/common';
import type { FastifyInstance } from 'fastify';
import type { UnitOfWork } from '../db/unitOfWork.js';
import type { Clock } from '../features/auth/authService.js';
import type { SessionService } from '../features/auth/sessionService.js';
import type { InventoryService } from '../features/inventory/inventoryService.js';
import type { InventoryReceiptResult } from '../features/inventory/inventoryTypes.js';
import { InventoryError } from '../features/inventory/inventoryTypes.js';
import { requireAdmin } from '../plugins/auth.js';
import { sendConflict, sendNotFound } from '../utils/errors.js';

/** Composition root supplies transaction and injected clock; inventory service remains transaction-free. */
export interface AdminInventoryRouteServices {
  sessions: SessionService;
  inventory: Pick<InventoryService, 'availableToSell'> & {
    receiveStock(input: Parameters<InventoryService['receiveStock']>[0]): InventoryReceiptResult & {
      replayed: boolean;
    };
  };
  inventoryUnitOfWork: UnitOfWork;
  clock: Clock;
}

function sendInventoryError(
  reply: Parameters<typeof sendConflict>[0],
  error: InventoryError,
): void {
  if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
    sendConflict(reply, error.message);
    return;
  }
  sendConflict(reply, error.message);
}

/** Hidden local replenishment command. First write returns 201; exact replay returns 200. */
export default function adminInventoryRoutes(
  app: FastifyInstance,
  { services }: { services: AdminInventoryRouteServices },
): void {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  typed.post(
    '/api/admin/inventory/receipts',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        body: InventoryReceiptBody,
        response: {
          200: InventoryReceiptResponse,
          201: InventoryReceiptResponse,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      const now = services.clock.now().toISOString();
      const variantId = request.body.variantId;
      if (services.inventory.availableToSell([variantId], now).length === 0) {
        sendNotFound(reply, 'Variant');
        return;
      }
      try {
        const receipt = services.inventoryUnitOfWork.run(() => {
          const result = services.inventory.receiveStock({
            idempotencyKey: request.body.idempotencyKey,
            variantId,
            quantity: request.body.quantity,
            receivedByUserId: request.authenticatedUser!.id,
            occurredAt: now,
          });
          return result;
        });
        reply.code(receipt.replayed ? 200 : 201);
        return {
          receiptId: String(receipt.receiptId),
          variantId: receipt.variantId,
          receivedQuantity: receipt.receivedQuantity,
          allocatedQuantity: receipt.allocatedQuantity,
          remainingStock: receipt.remainingStock,
          allocations: receipt.allocations.map((allocation) => ({
            orderId: String(allocation.orderId),
            orderLineItemId: String(allocation.orderLineItemId),
            quantity: allocation.quantity,
          })),
        };
      } catch (error) {
        if (error instanceof InventoryError) {
          sendInventoryError(reply, error);
          return;
        }
        throw error;
      }
    },
  );
}
