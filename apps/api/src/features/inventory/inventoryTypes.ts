export type InventoryDemandKind = 'product' | 'powder_mix';

export interface InventoryDemand {
  productId: number;
  quantity: number;
  demandKind: InventoryDemandKind;
}

export interface InventoryProduct {
  productId: number;
  stockCount: number;
  availableToSell: number;
  backorderable: boolean;
  backorderLeadDays: number | null;
}

export interface InventoryReservationAllocation extends InventoryDemand {
  reservedQuantity: number;
  backorderedQuantity: number;
}

export interface InventoryOrderLine {
  orderLineItemId: number;
  productId: number;
  quantity: number;
}

export interface InventoryReceiptAllocation {
  orderId: number;
  orderLineItemId: number;
  quantity: number;
}

export interface InventoryReceiptResult {
  receiptId: number;
  productId: number;
  receivedQuantity: number;
  allocatedQuantity: number;
  remainingStock: number;
  allocations: readonly InventoryReceiptAllocation[];
}

export type InventoryErrorCode =
  | 'INSUFFICIENT_STOCK'
  | 'RESERVATION_EXPIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVENTORY_CORRUPTION';

export class InventoryError extends Error {
  constructor(
    public readonly code: InventoryErrorCode,
    message: string,
    public readonly productIds: readonly number[] = [],
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}
