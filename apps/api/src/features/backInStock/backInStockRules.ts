/**
 * Ceiling on simultaneously pending subscriptions per buyer. Bounds the fan-out one stock
 * movement can produce and keeps the buyer's own list readable without paging.
 */
export const BACK_IN_STOCK_SUBSCRIPTION_LIMIT = 50;

/**
 * A lot counts as back in stock only once a buyer could actually order it: anything below the
 * variant's minimum order quantity would fail MOQ validation at the cart, so notifying on it
 * would be a promise the shop cannot keep.
 */
export function isNotifiable(availableToSell: number, minimumOrderQuantity: number): boolean {
  if (!Number.isSafeInteger(availableToSell) || availableToSell < 0) return false;
  if (!Number.isSafeInteger(minimumOrderQuantity) || minimumOrderQuantity < 1) return false;
  return availableToSell >= minimumOrderQuantity;
}

/**
 * Collapses repeated stock movements for one variant at one instant onto a single job.
 * Determinism matters: the queue dedupes on this exact string.
 */
export function backInStockJobDedupeKey(variantId: number, occurredAt: string): string {
  return `back-in-stock:${variantId}:${occurredAt}`;
}

/** Buyer-facing inbox copy for a restocked lot. */
export function backInStockNotificationCopy(
  productName: string,
  variantLabel: string,
): { title: string; body: string } {
  return {
    title: `Back in stock: ${productName}`,
    body: `${productName} (${variantLabel}) is available to order again.`,
  };
}
