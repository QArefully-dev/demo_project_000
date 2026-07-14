import type { CartRepository } from '../cart/cartRepository.js';
import { getCart } from '../cart/cartService.js';
import type { Clock } from '../auth/authService.js';
import type { PromoRecord, PromoRepository } from './promoRepository.js';

export type PromoValidationError =
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'MIN_ITEMS'
  | 'MIN_SUBTOTAL'
  | 'USAGE_LIMIT'
  | 'AUTH_REQUIRED'
  | 'INVALID';

export interface ValidPromo {
  code: string;
  discountPercent: number;
  minItemCount: number;
  kind: 'percent' | 'fixed';
  amountCents?: number;
  minSubtotalCents?: number;
}

export type PromoValidation =
  | { valid: true; promoCode: ValidPromo }
  | { valid: false; error: string; errorCode: PromoValidationError };

export interface PromoService {
  validate(params: { code: string; cartId: string; userId: number | null }): PromoValidation;
}

export function createPromoService(dependencies: {
  promos: PromoRepository;
  carts: CartRepository;
  clock: Clock;
}): PromoService {
  return {
    validate: (params) => validatePromo({ ...params, now: dependencies.clock.now() }, dependencies),
  };
}

function invalid(error: string, errorCode: PromoValidationError): PromoValidation {
  return { valid: false, error, errorCode };
}

function asValidPromo(promo: PromoRecord): ValidPromo {
  return {
    code: promo.code,
    discountPercent: promo.discountPercent,
    minItemCount: promo.minItemCount,
    kind: promo.kind,
    amountCents: promo.amountCents ?? undefined,
    minSubtotalCents: promo.minSubtotalCents ?? undefined,
  };
}

export function validatePromo(
  params: { code: string; cartId: string; userId: number | null; now: Date },
  dependencies: { promos: PromoRepository; carts: CartRepository },
): PromoValidation {
  const promo = dependencies.promos.findByCode(params.code);
  if (!promo || !promo.active) return invalid('Promo code not found or inactive', 'INVALID');
  const { now } = params;
  if (promo.startAt && now < new Date(promo.startAt))
    return invalid('This promo code is not yet active', 'NOT_STARTED');
  if (promo.endAt && now >= new Date(promo.endAt))
    return invalid('This promo code has expired', 'EXPIRED');
  if (promo.perUserLimit !== null && params.userId === null)
    return invalid('You must be logged in to use this promo code', 'AUTH_REQUIRED');
  if (
    promo.perUserLimit !== null &&
    params.userId !== null &&
    dependencies.promos.redemptionCountForUser(promo.code, params.userId) +
      dependencies.promos.activeReservationCountForUser(promo.code, params.userId) >=
      promo.perUserLimit
  ) {
    return invalid('You have already used this promo code', 'USAGE_LIMIT');
  }
  if (
    promo.maxRedemptions !== null &&
    promo.redemptionCount + dependencies.promos.activeReservationCount(promo.code) >=
      promo.maxRedemptions
  )
    return invalid('This promo code has reached its usage limit', 'USAGE_LIMIT');
  const cart = getCart(dependencies.carts, params.cartId);
  if (!cart) return invalid('Cart not found', 'INVALID');
  if (cart.totalItems < promo.minItemCount)
    return invalid(
      `Minimum ${promo.minItemCount} items required (have ${cart.totalItems})`,
      'MIN_ITEMS',
    );
  if (promo.minSubtotalCents !== null && cart.subtotalCents < promo.minSubtotalCents)
    return invalid(
      `Minimum subtotal of $${(promo.minSubtotalCents / 100).toFixed(2)} required`,
      'MIN_SUBTOTAL',
    );
  return { valid: true, promoCode: asValidPromo(promo) };
}

export function calculateDiscount(params: {
  promo: Pick<ValidPromo, 'kind' | 'discountPercent' | 'amountCents'>;
  subtotalCents: number;
}): number {
  return params.promo.kind === 'fixed'
    ? Math.min(params.promo.amountCents ?? 0, params.subtotalCents)
    : Math.floor((params.subtotalCents * params.promo.discountPercent) / 100);
}
