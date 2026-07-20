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

/** Aggregates duplicate input into stable variant/kind order. */
export function aggregateInventoryDemand(
  demands: readonly InventoryDemand[],
): readonly InventoryDemand[] {
  const totals = new Map<string, InventoryDemand>();
  for (const demand of demands) {
    positiveInteger(demand.variantId, 'Variant ID');
    positiveInteger(demand.quantity, 'Inventory quantity');
    const key = `${demand.variantId}:${demand.demandKind}`;
    const existing = totals.get(key);
    totals.set(
      key,
      existing ? { ...existing, quantity: existing.quantity + demand.quantity } : { ...demand },
    );
  }
  return [...totals.values()].sort(
    (left, right) =>
      left.variantId - right.variantId || left.demandKind.localeCompare(right.demandKind),
  );
}

/** `expires_at === now` is expired. ISO UTC strings preserve chronological ordering. */
export function isPreparedReservationExpired(expiresAt: string, now: string): boolean {
  return expiresAt <= now;
}

/**
 * Applies hard Powderizer and non-backorderable demand first. Variant demand may only
 * backorder after every hard demand for its variant has been protected.
 */
export function splitInventoryReservation(
  demands: readonly InventoryDemand[],
  products: readonly InventoryProduct[],
): readonly InventoryReservationAllocation[] {
  const normalized = aggregateInventoryDemand(demands);
  const productByVariantId = new Map(products.map((product) => [product.variantId, product]));
  const byVariant = new Map<number, InventoryDemand[]>();
  for (const demand of normalized) {
    const list = byVariant.get(demand.variantId) ?? [];
    list.push(demand);
    byVariant.set(demand.variantId, list);
  }

  const output: InventoryReservationAllocation[] = [];
  for (const variantId of [...byVariant.keys()].sort((left, right) => left - right)) {
    const product = productByVariantId.get(variantId);
    if (!product) {
      throw new InventoryError('INSUFFICIENT_STOCK', `Variant ${variantId} is unavailable.`, [
        variantId,
      ]);
    }
    if (!Number.isSafeInteger(product.availableToSell) || product.availableToSell < 0) {
      throw new InventoryError(
        'INVENTORY_CORRUPTION',
        `Variant ${variantId} has invalid availability.`,
      );
    }
    const rows = byVariant.get(variantId)!;
    const hard = rows.filter((row) => row.demandKind === 'powder_mix' || !product.backorderable);
    const hardQuantity = hard.reduce((total, row) => total + row.quantity, 0);
    if (hardQuantity > product.availableToSell) {
      throw new InventoryError(
        'INSUFFICIENT_STOCK',
        `Variant ${variantId} has insufficient stock.`,
        [variantId],
      );
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
    (left, right) =>
      left.variantId - right.variantId || left.demandKind.localeCompare(right.demandKind),
  );
}

export function receiptFingerprint(variantId: number, quantity: number): string {
  positiveInteger(variantId, 'Variant ID');
  positiveInteger(quantity, 'Receipt quantity');
  return JSON.stringify({ variantId, quantity });
}
