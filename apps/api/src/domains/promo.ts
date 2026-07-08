import { getDb } from '../db/index.js';

export interface PromoRow {
  id: number;
  code: string;
  discount_percent: number;
  min_item_count: number;
  active: number;
}

export interface ValidatePromoResult {
  valid: boolean;
  promoCode?: {
    code: string;
    discountPercent: number;
    minItemCount: number;
  };
  error?: string;
}

/** Validate a promo code for a given cart. Checks existence, active status, and minimum item count. Single code only — no stacking: only one promo code can apply per order. */
export function validatePromoCode(
  promoCode: string,
  _cartId: string,
  cartTotalItems: number,
): ValidatePromoResult {
  const db = getDb();

  const promo = db
    .prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1')
    .get(promoCode) as PromoRow | undefined;
  if (!promo) {
    return { valid: false, error: 'Promo code not found or inactive' };
  }

  if (cartTotalItems < promo.min_item_count) {
    return {
      valid: false,
      error: `Minimum ${promo.min_item_count} items required (have ${cartTotalItems})`,
    };
  }

  return {
    valid: true,
    promoCode: {
      code: promo.code,
      discountPercent: promo.discount_percent,
      minItemCount: promo.min_item_count,
    },
  };
}

/** Calculate discount amount in cents. Always rounds down (floor). */
export function calculateDiscount(subtotalCents: number, discountPercent: number): number {
  return Math.floor((subtotalCents * discountPercent) / 100);
}
