import { getDb } from '../db/index.js';
import { getCart } from './cart.js';

export interface PromoRow {
  id: number;
  code: string;
  discount_percent: number;
  min_item_count: number;
  active: number;
  kind: 'percent' | 'fixed';
  amount_cents: number | null;
  min_subtotal_cents: number | null;
  start_at: string | null;
  end_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  per_user_limit: number | null;
}

export type PromoValidationError =
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'MIN_ITEMS'
  | 'MIN_SUBTOTAL'
  | 'USAGE_LIMIT'
  | 'AUTH_REQUIRED'
  | 'INVALID';

export interface ValidatePromoCodeParams {
  code: string;
  cartId: string;
  userId: number | null;
}

export interface ValidatePromoResult {
  valid: boolean;
  promoCode?: {
    code: string;
    discountPercent: number;
    minItemCount: number;
    kind: 'percent' | 'fixed';
    amountCents?: number;
    minSubtotalCents?: number;
  };
  error?: string;
  errorCode?: PromoValidationError;
}

/**
 * Validate a promo code against a cart and optional authenticated user.
 * Single code only — no stacking: only one promo code can apply per order.
 *
 * Checks in order: existence → active → time window → per-user auth →
 * per-user limit → global limit → item minimum → subtotal minimum.
 */
export function validatePromoCode(params: ValidatePromoCodeParams): ValidatePromoResult {
  const { code, cartId, userId } = params;
  const db = getDb();

  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code) as
    PromoRow | undefined;

  if (!promo || promo.active === 0) {
    return { valid: false, error: 'Promo code not found or inactive', errorCode: 'INVALID' };
  }

  // Check UTC time window
  const now = new Date();
  if (promo.start_at && now < new Date(promo.start_at)) {
    return { valid: false, error: 'This promo code is not yet active', errorCode: 'NOT_STARTED' };
  }
  if (promo.end_at && now >= new Date(promo.end_at)) {
    return { valid: false, error: 'This promo code has expired', errorCode: 'EXPIRED' };
  }

  // Per-user promos require authentication
  if (promo.per_user_limit !== null && userId === null) {
    return {
      valid: false,
      error: 'You must be logged in to use this promo code',
      errorCode: 'AUTH_REQUIRED',
    };
  }

  // Per-user limit check
  if (promo.per_user_limit !== null && userId !== null) {
    const userRedeemed = db
      .prepare('SELECT COUNT(*) as c FROM promo_redemptions WHERE code = ? AND user_id = ?')
      .get(code, userId) as { c: number };
    if (userRedeemed.c >= promo.per_user_limit) {
      return {
        valid: false,
        error: 'You have already used this promo code',
        errorCode: 'USAGE_LIMIT',
      };
    }
  }

  // Global usage limit check
  if (promo.max_redemptions !== null && promo.redemption_count >= promo.max_redemptions) {
    return {
      valid: false,
      error: 'This promo code has reached its usage limit',
      errorCode: 'USAGE_LIMIT',
    };
  }

  // Get cart for item/subtotal checks
  const cart = getCart(cartId);
  if (!cart) {
    return { valid: false, error: 'Cart not found', errorCode: 'INVALID' };
  }

  // Minimum item count
  if (cart.totalItems < promo.min_item_count) {
    return {
      valid: false,
      error: `Minimum ${promo.min_item_count} items required (have ${cart.totalItems})`,
      errorCode: 'MIN_ITEMS',
    };
  }

  // Minimum subtotal
  if (promo.min_subtotal_cents !== null && cart.subtotalCents < promo.min_subtotal_cents) {
    return {
      valid: false,
      error: `Minimum subtotal of $${(promo.min_subtotal_cents / 100).toFixed(2)} required`,
      errorCode: 'MIN_SUBTOTAL',
    };
  }

  return {
    valid: true,
    promoCode: {
      code: promo.code,
      discountPercent: promo.discount_percent,
      minItemCount: promo.min_item_count,
      kind: promo.kind,
      amountCents: promo.amount_cents ?? undefined,
      minSubtotalCents: promo.min_subtotal_cents ?? undefined,
    },
  };
}

export interface CalculateDiscountParams {
  promo: {
    kind: 'percent' | 'fixed';
    discountPercent: number;
    amountCents?: number;
  };
  subtotalCents: number;
}

/**
 * Calculate discount amount in cents.
 * - Percent: rounds down (floor) from subtotal.
 * - Fixed: capped at subtotal (never exceeds it).
 */
export function calculateDiscount(params: CalculateDiscountParams): number {
  const { promo, subtotalCents } = params;
  if (promo.kind === 'fixed') {
    return Math.min(promo.amountCents ?? 0, subtotalCents);
  }
  // percent
  return Math.floor((subtotalCents * promo.discountPercent) / 100);
}

export interface RecordRedemptionParams {
  db: ReturnType<typeof getDb>;
  promo: { code: string };
  userId: number | null;
  orderId: number | null;
}

/**
 * Record a promo code redemption and increment the usage counter.
 * Call inside a transaction for atomicity with the order.
 */
export function recordRedemption(params: RecordRedemptionParams): void {
  const { db, promo, userId, orderId } = params;

  db.prepare('INSERT INTO promo_redemptions (code, user_id, order_id) VALUES (?, ?, ?)').run(
    promo.code,
    userId,
    orderId,
  );

  db.prepare('UPDATE promo_codes SET redemption_count = redemption_count + 1 WHERE code = ?').run(
    promo.code,
  );
}
