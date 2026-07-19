import { aggregateInventoryDemand, receiptFingerprint, splitInventoryReservation } from './inventoryRules.js';
import type { InventoryRepository } from './inventoryRepository.js';
import {
  InventoryError,
  type InventoryDemand,
  type InventoryOrderLine,
  type InventoryReceiptAllocation,
  type InventoryReceiptResult,
  type InventoryReservationAllocation,
} from './inventoryTypes.js';

export interface InventoryService {
  availableToSell(productIds: readonly number[], now: string): ReturnType<InventoryRepository['availableToSell']>;
  reserveCheckout(input: {
    paymentIdempotencyKey: string;
    demands: readonly InventoryDemand[];
    now: string;
    expiresAt: string;
  }): readonly InventoryReservationAllocation[];
  releaseReservation(paymentIdempotencyKey: string): void;
  expirePrepared(now: string): readonly string[];
  authorizeReservation(paymentIdempotencyKey: string, now: string): void;
  commitReservation(input: {
    paymentIdempotencyKey: string;
    orderId: number;
    ordinaryLines: readonly InventoryOrderLine[];
    occurredAt: string;
  }): void;
  receiveStock(input: {
    idempotencyKey: string;
    productId: number;
    quantity: number;
    receivedByUserId: number;
    occurredAt: string;
  }): InventoryReceiptResult;
  cancelOrderInventory(input: { orderId: number; occurredAt: string }): readonly InventoryReceiptAllocation[];
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InventoryError('INVENTORY_CORRUPTION', `${label} must be a positive integer.`);
  }
}

function allocateFromRows(
  rows: readonly InventoryOrderLine[],
  quantity: number,
): Array<{ line: InventoryOrderLine; quantity: number }> {
  let remaining = quantity;
  const result: Array<{ line: InventoryOrderLine; quantity: number }> = [];
  for (const line of [...rows].sort((left, right) => left.orderLineItemId - right.orderLineItemId)) {
    if (remaining === 0) break;
    const applied = Math.min(line.quantity, remaining);
    result.push({ line, quantity: applied });
    remaining -= applied;
  }
  if (remaining !== 0) throw new InventoryError('INVENTORY_CORRUPTION', 'Reservation does not match order lines.');
  return result;
}

/** Domain coordinator. Does not create, commit, or roll back SQLite transactions. */
export function createInventoryService(dependencies: { repository: InventoryRepository }): InventoryService {
  const { repository } = dependencies;
  const fulfillBackorders = (
    productId: number,
    quantity: number,
    occurredAt: string,
    receiptId?: number,
    excludedOrderId?: number,
  ): InventoryReceiptAllocation[] => {
    let remaining = quantity;
    const fulfilled: InventoryReceiptAllocation[] = [];
    for (const allocation of repository.listOpenBackorders(productId, excludedOrderId)) {
      if (remaining === 0) break;
      const applied = Math.min(remaining, allocation.backordered_quantity);
      if (!repository.decrementStock(productId, applied)) {
        throw new InventoryError('INVENTORY_CORRUPTION', 'Stock disappeared while allocating backorders.');
      }
      repository.fulfillBackorder({ orderLineItemId: allocation.order_line_item_id, quantity: applied, updatedAt: occurredAt });
      repository.insertMovement({
        productId,
        movementType: 'backorder_allocated',
        quantityDelta: -applied,
        orderId: allocation.order_id,
        orderLineItemId: allocation.order_line_item_id,
        receiptId,
        occurredAt,
      });
      fulfilled.push({ orderId: allocation.order_id, orderLineItemId: allocation.order_line_item_id, quantity: applied });
      remaining -= applied;
    }
    return fulfilled;
  };

  return {
    availableToSell(productIds, now) {
      return repository.availableToSell(productIds, now);
    },
    reserveCheckout({ paymentIdempotencyKey, demands, now, expiresAt }) {
      if (expiresAt <= now) throw new InventoryError('INVENTORY_CORRUPTION', 'Reservation expiry must be in the future.');
      const normalized = aggregateInventoryDemand(demands);
      const availability = repository.availableToSell(normalized.map((demand) => demand.productId), now);
      const split = splitInventoryReservation(normalized, availability);
      repository.insertReservations({
        paymentIdempotencyKey,
        reservations: split,
        expiresAt,
        createdAt: now,
      });
      return split;
    },
    releaseReservation(paymentIdempotencyKey) {
      repository.releaseReservation(paymentIdempotencyKey);
    },
    expirePrepared(now) {
      return repository.releaseExpired(now);
    },
    authorizeReservation(paymentIdempotencyKey, now) {
      if (!repository.authorizeReservation(paymentIdempotencyKey, now)) {
        throw new InventoryError('RESERVATION_EXPIRED', 'Checkout inventory reservation has expired.');
      }
    },
    commitReservation({ paymentIdempotencyKey, orderId, ordinaryLines, occurredAt }) {
      const reservations = repository.listReservations(paymentIdempotencyKey);
      if (reservations.length === 0) {
        throw new InventoryError('RESERVATION_EXPIRED', 'Checkout inventory reservation is absent.');
      }
      if (reservations.some((reservation) => reservation.expires_at !== null)) {
        throw new InventoryError('RESERVATION_EXPIRED', 'Checkout inventory reservation is not authorized.');
      }
      const linesByProduct = new Map<number, InventoryOrderLine[]>();
      for (const line of ordinaryLines) {
        requirePositiveInteger(line.orderLineItemId, 'Order line ID');
        requirePositiveInteger(line.productId, 'Product ID');
        requirePositiveInteger(line.quantity, 'Order line quantity');
        const rows = linesByProduct.get(line.productId) ?? [];
        rows.push(line);
        linesByProduct.set(line.productId, rows);
      }
      const reservationProducts = reservations.filter((row) => row.demand_kind === 'product');
      for (const productId of linesByProduct.keys()) {
        if (!reservationProducts.some((row) => row.product_id === productId)) {
          throw new InventoryError('INVENTORY_CORRUPTION', 'Order product has no inventory reservation.');
        }
      }
      for (const reservation of reservations) {
        if (reservation.reserved_quantity > 0 && !repository.decrementStock(reservation.product_id, reservation.reserved_quantity)) {
          throw new InventoryError('INVENTORY_CORRUPTION', `Stock changed for product ${reservation.product_id}.`);
        }
        if (reservation.reserved_quantity > 0) repository.insertMovement({
          productId: reservation.product_id,
          movementType: 'checkout_consumed',
          quantityDelta: -reservation.reserved_quantity,
          paymentIdempotencyKey,
          orderId,
          occurredAt,
        });
        if (reservation.demand_kind === 'powder_mix') continue;
        const lines = linesByProduct.get(reservation.product_id) ?? [];
        const total = lines.reduce((sum, line) => sum + line.quantity, 0);
        if (total !== reservation.reserved_quantity + reservation.backordered_quantity) {
          throw new InventoryError('INVENTORY_CORRUPTION', 'Order line quantities do not match reservation.');
        }
        const reservedByLine = new Map(allocateFromRows(lines, reservation.reserved_quantity).map(({ line, quantity }) => [line.orderLineItemId, quantity]));
        const backorderedByLine = new Map(allocateFromRows(
          lines.map((line) => ({ ...line, quantity: line.quantity - (reservedByLine.get(line.orderLineItemId) ?? 0) })),
          reservation.backordered_quantity,
        ).map(({ line, quantity }) => [line.orderLineItemId, quantity]));
        for (const line of [...lines].sort((left, right) => left.orderLineItemId - right.orderLineItemId)) {
          repository.insertAllocation({
            orderLineItemId: line.orderLineItemId,
            productId: line.productId,
            allocatedQuantity: reservedByLine.get(line.orderLineItemId) ?? 0,
            backorderedQuantity: backorderedByLine.get(line.orderLineItemId) ?? 0,
            stockDebitedQuantity: reservedByLine.get(line.orderLineItemId) ?? 0,
            createdAt: occurredAt,
          });
        }
      }
      repository.releaseReservation(paymentIdempotencyKey);
    },
    receiveStock({ idempotencyKey, productId, quantity, receivedByUserId, occurredAt }) {
      requirePositiveInteger(productId, 'Product ID');
      requirePositiveInteger(quantity, 'Receipt quantity');
      requirePositiveInteger(receivedByUserId, 'Receiving user ID');
      const fingerprint = receiptFingerprint(productId, quantity);
      const existing = repository.findReceipt(idempotencyKey);
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new InventoryError('IDEMPOTENCY_KEY_REUSED', 'Receipt idempotency key has different payload.');
        }
        return JSON.parse(existing.responseJson) as InventoryReceiptResult;
      }
      const receiptId = repository.insertReceipt({
        idempotencyKey,
        requestFingerprint: fingerprint,
        productId,
        receivedQuantity: quantity,
        receivedByUserId,
        createdAt: occurredAt,
      });
      if (!repository.incrementStock(productId, quantity)) {
        throw new InventoryError('INVENTORY_CORRUPTION', `Receipt product ${productId} is missing.`);
      }
      repository.insertMovement({ productId, movementType: 'receipt_received', quantityDelta: quantity, receiptId, occurredAt });
      const allocations = fulfillBackorders(productId, quantity, occurredAt, receiptId);
      const result: InventoryReceiptResult = {
        receiptId,
        productId,
        receivedQuantity: quantity,
        allocatedQuantity: allocations.reduce((total, allocation) => total + allocation.quantity, 0),
        remainingStock: repository.stockCount(productId) ?? (() => { throw new InventoryError('INVENTORY_CORRUPTION', 'Receipt product disappeared.'); })(),
        allocations,
      };
      repository.setReceiptResponse(receiptId, JSON.stringify(result));
      return result;
    },
    cancelOrderInventory({ orderId, occurredAt }) {
      const allocations = repository.listOrderAllocations(orderId);
      const restoredByProduct = new Map<number, number>();
      for (const allocation of allocations) {
        const cancelled = allocation.allocated_quantity + allocation.backordered_quantity;
        if (cancelled === 0) continue;
        repository.cancelAllocation({ orderLineItemId: allocation.order_line_item_id, cancelledQuantity: cancelled, updatedAt: occurredAt });
        if (allocation.stock_debited_quantity > 0) {
          const restored = (restoredByProduct.get(allocation.product_id) ?? 0) + allocation.stock_debited_quantity;
          restoredByProduct.set(allocation.product_id, restored);
          if (!repository.incrementStock(allocation.product_id, allocation.stock_debited_quantity)) {
            throw new InventoryError('INVENTORY_CORRUPTION', 'Cancelled allocation product is missing.');
          }
          repository.insertMovement({
            productId: allocation.product_id,
            movementType: 'cancellation_restored',
            quantityDelta: allocation.stock_debited_quantity,
            orderId,
            orderLineItemId: allocation.order_line_item_id,
            occurredAt,
          });
        }
      }
      return [...restoredByProduct.entries()]
        .sort(([left], [right]) => left - right)
        .flatMap(([productId, quantity]) => fulfillBackorders(productId, quantity, occurredAt, undefined, orderId));
    },
  };
}
