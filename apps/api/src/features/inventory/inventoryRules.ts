import {
  InventoryError,
  type InventoryDemand,
  type InventoryProduct,
  type InventoryReservationAllocation,
} from './inventoryTypes.js';

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InventoryError('INVENTORY_CORRUPTION', `${label} must be a positive integer.`);
  }
}

/** Aggregates duplicate input into stable product/kind order. */
export function aggregateInventoryDemand(
  demands: readonly InventoryDemand[],
): readonly InventoryDemand[] {
  const totals = new Map<string, InventoryDemand>();
  for (const demand of demands) {
    positiveInteger(demand.productId, 'Product ID');
    positiveInteger(demand.quantity, 'Inventory quantity');
    const key = `${demand.productId}:${demand.demandKind}`;
    const existing = totals.get(key);
    totals.set(
      key,
      existing
        ? { ...existing, quantity: existing.quantity + demand.quantity }
        : { ...demand },
    );
  }
  return [...totals.values()].sort(
    (left, right) => left.productId - right.productId || left.demandKind.localeCompare(right.demandKind),
  );
}

/** `expires_at === now` is expired. ISO UTC strings preserve chronological ordering. */
export function isPreparedReservationExpired(expiresAt: string, now: string): boolean {
  return expiresAt <= now;
}

/**
 * Applies hard Powderizer and non-backorderable demand first. Product demand may only
 * backorder after every hard demand for its product has been protected.
 */
export function splitInventoryReservation(
  demands: readonly InventoryDemand[],
  products: readonly InventoryProduct[],
): readonly InventoryReservationAllocation[] {
  const normalized = aggregateInventoryDemand(demands);
  const productById = new Map(products.map((product) => [product.productId, product]));
  const byProduct = new Map<number, InventoryDemand[]>();
  for (const demand of normalized) {
    const list = byProduct.get(demand.productId) ?? [];
    list.push(demand);
    byProduct.set(demand.productId, list);
  }

  const output: InventoryReservationAllocation[] = [];
  for (const productId of [...byProduct.keys()].sort((left, right) => left - right)) {
    const product = productById.get(productId);
    if (!product) {
      throw new InventoryError('INSUFFICIENT_STOCK', `Product ${productId} is unavailable.`, [productId]);
    }
    if (!Number.isSafeInteger(product.availableToSell) || product.availableToSell < 0) {
      throw new InventoryError('INVENTORY_CORRUPTION', `Product ${productId} has invalid availability.`);
    }
    const rows = byProduct.get(productId)!;
    const hard = rows.filter((row) => row.demandKind === 'powder_mix' || !product.backorderable);
    const hardQuantity = hard.reduce((total, row) => total + row.quantity, 0);
    if (hardQuantity > product.availableToSell) {
      throw new InventoryError('INSUFFICIENT_STOCK', `Product ${productId} has insufficient stock.`, [productId]);
    }
    let available = product.availableToSell - hardQuantity;
    for (const row of rows) {
      if (row.demandKind === 'powder_mix' || !product.backorderable) {
        output.push({ ...row, reservedQuantity: row.quantity, backorderedQuantity: 0 });
        continue;
      }
      const reservedQuantity = Math.min(available, row.quantity);
      available -= reservedQuantity;
      output.push({
        ...row,
        reservedQuantity,
        backorderedQuantity: row.quantity - reservedQuantity,
      });
    }
  }
  return output.sort(
    (left, right) => left.productId - right.productId || left.demandKind.localeCompare(right.demandKind),
  );
}

export function receiptFingerprint(productId: number, quantity: number): string {
  positiveInteger(productId, 'Product ID');
  positiveInteger(quantity, 'Receipt quantity');
  return JSON.stringify({ productId, quantity });
}
