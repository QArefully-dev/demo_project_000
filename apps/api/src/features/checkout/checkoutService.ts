import { getCart } from '../cart/cartService.js';
import { validateCard, type ValidCard } from '../payments/cardValidation.js';
import { createSafeFingerprint, type PaymentRecord } from '../payments/paymentRepository.js';
import { validatePromo } from '../promos/promoService.js';
import { createCheckoutQuote } from './checkoutQuote.js';
import { finalizeAuthorizedCheckout } from './checkoutFinalizer.js';
import {
  calculatePowderMixStockRequirements,
  quotePowderMix,
} from '../powderizer/powderMixRules.js';
import type { PowderMixProduct, PowderMixStockRequirement } from '../powderizer/powderizerTypes.js';
import type {
  CheckoutDependencies,
  CheckoutParams,
  CheckoutResult,
  CheckoutService,
} from './checkoutTypes.js';

export type {
  CheckoutDependencies,
  CheckoutParams,
  CheckoutResult,
  CheckoutService,
} from './checkoutTypes.js';

type Preparation = CheckoutResult | { quoteTotalCents: number; card: ValidCard } | { resume: true };

function toMixProduct(
  row: NonNullable<ReturnType<CheckoutDependencies['products']['findById']>>,
): PowderMixProduct {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    mixable: row.mixable === 1,
    mixUnitGrams: row.mix_unit_grams ?? null,
  };
}

function prepareMixes(
  cartId: string,
  dependencies: CheckoutDependencies,
):
  | { requirements: readonly PowderMixStockRequirement[] }
  | Extract<CheckoutResult, { success: false }> {
  const persisted = dependencies.mixes.listForCart(cartId);
  const stockLines: Array<{
    allocations: Array<{ productId: number; allocatedGrams: number }>;
    quantity: number;
  }> = [];
  const requotes: Array<{ mixId: string; oldUnitPriceCents: number; newUnitPriceCents: number }> =
    [];
  for (const mix of persisted) {
    const components = mix.components.map((component) => ({
      productId: component.product_id,
      percentage: component.percentage,
    }));
    const products = components
      .map((component) => dependencies.products.findById(component.productId))
      .filter((product): product is NonNullable<typeof product> => product !== undefined)
      .map(toMixProduct);
    try {
      const quoted = quotePowderMix(
        {
          components: components.map((component) => ({
            ...component,
            productId: String(component.productId),
          })),
          bagSizeGrams: mix.bag_size_grams,
          fineness: mix.fineness,
          customLabel: mix.custom_label ?? undefined,
        },
        products,
      );
      if (
        quoted.priceVersion !== mix.price_version ||
        quoted.unitPriceCents !== mix.quoted_unit_price_cents
      ) {
        requotes.push({
          mixId: mix.id,
          oldUnitPriceCents: mix.quoted_unit_price_cents,
          newUnitPriceCents: quoted.unitPriceCents,
        });
        continue;
      }
      stockLines.push({ allocations: [...quoted.allocations], quantity: mix.quantity });
    } catch {
      requotes.push({
        mixId: mix.id,
        oldUnitPriceCents: mix.quoted_unit_price_cents,
        newUnitPriceCents: mix.quoted_unit_price_cents,
      });
    }
  }
  if (requotes.length) return { success: false, error: 'MIX_REQUOTE_REQUIRED', mixes: requotes };
  const ids = [
    ...new Set(
      stockLines.flatMap((line) => line.allocations.map((allocation) => allocation.productId)),
    ),
  ];
  const products = ids
    .map((id) => dependencies.products.findById(id))
    .filter((product): product is NonNullable<typeof product> => product !== undefined)
    .map(toMixProduct);
  let requirements: readonly PowderMixStockRequirement[];
  try {
    requirements = calculatePowderMixStockRequirements(stockLines, products);
  } catch {
    return {
      success: false,
      error: 'MIX_REQUOTE_REQUIRED',
      mixes: persisted.map((mix) => ({
        mixId: mix.id,
        oldUnitPriceCents: mix.quoted_unit_price_cents,
        newUnitPriceCents: mix.quoted_unit_price_cents,
      })),
    };
  }
  const unavailable = requirements.filter((requirement) => {
    const product = dependencies.products.findById(requirement.productId);
    return (
      !product ||
      product.stock_count - dependencies.mixes.reservedStock(requirement.productId) <
        requirement.bagEquivalents
    );
  });
  if (unavailable.length) {
    const unavailableIds = new Set(unavailable.map((requirement) => requirement.productId));
    return {
      success: false,
      error: 'MIX_STOCK_UNAVAILABLE',
      mixIds: persisted
        .filter((mix) =>
          mix.components.some((component) => unavailableIds.has(component.product_id)),
        )
        .map((mix) => mix.id),
      productIds: unavailable.map((requirement) => String(requirement.productId)),
    };
  }
  return { requirements };
}

function replay(
  payment: PaymentRecord,
  fingerprint: string,
  dependencies: CheckoutDependencies,
): Preparation {
  if (payment.fingerprint !== fingerprint) return { success: false, error: 'IDEMPOTENT_CONFLICT' };
  if (payment.status === 'prepared') return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  if (payment.status === 'authorized_pending_finalize') return { resume: true };
  if (payment.responseJson) {
    try {
      const result = JSON.parse(payment.responseJson) as CheckoutResult;
      if (typeof result === 'object' && result !== null && 'success' in result) return result;
    } catch {
      return { success: false, error: 'CHECKOUT_FAILED' };
    }
  }
  if (payment.status === 'succeeded' && payment.orderId !== null) {
    const order = dependencies.orders.findById(payment.orderId);
    return order ? { success: true, order } : { success: false, error: 'CHECKOUT_FAILED' };
  }
  if (payment.status === 'declined') return { success: false, error: 'DECLINED' };
  if (payment.status === 'timed_out') return { success: false, error: 'TIMEOUT' };
  return { success: false, error: 'CHECKOUT_FAILED' };
}

function prepare(
  params: CheckoutParams,
  card: ValidCard,
  dependencies: CheckoutDependencies,
): Preparation {
  const fingerprint = createSafeFingerprint(params, card);
  const existing = dependencies.payments.load(params.idempotencyKey);
  if (existing) return replay(existing, fingerprint, dependencies);
  return dependencies.unitOfWork.run(() => {
    const reservation = dependencies.payments.reservePreGateway({
      idempotencyKey: params.idempotencyKey,
      fingerprint,
      card,
      createdAt: dependencies.clock.now().toISOString(),
    });
    if (!reservation.reserved) return replay(reservation.payment, fingerprint, dependencies);
    const cart = getCart(dependencies.carts, params.cartId, dependencies.mixes);
    if (!cart)
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CART_NOT_FOUND' },
        dependencies,
      );
    if (cart.totalItems === 0)
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CART_EMPTY' },
        dependencies,
      );
    const promo = params.promoCode
      ? validatePromo(
          {
            code: params.promoCode,
            cartId: params.cartId,
            userId: params.userId,
            now: dependencies.clock.now(),
          },
          dependencies,
        )
      : undefined;
    if (promo && !promo.valid)
      return failPreparation(
        params.idempotencyKey,
        {
          success: false,
          error: 'PROMO_INVALID',
          promoError: promo.error,
          promoErrorCode: promo.errorCode,
        },
        dependencies,
      );
    const mixPreparation = prepareMixes(params.cartId, dependencies);
    if ('error' in mixPreparation)
      return failPreparation(params.idempotencyKey, mixPreparation, dependencies);
    const createdAt = dependencies.clock.now().toISOString();
    const quote = createCheckoutQuote({
      cart,
      checkout: params,
      promo: promo?.promoCode,
      createdAt,
    });
    if (!dependencies.carts.reserve(params.cartId, params.idempotencyKey, createdAt)) {
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CHECKOUT_FAILED' },
        dependencies,
      );
    }
    if (
      quote.promoCode &&
      !dependencies.promos.reserve({
        code: quote.promoCode,
        userId: params.userId,
        paymentIdempotencyKey: params.idempotencyKey,
        createdAt,
      })
    ) {
      dependencies.carts.releaseReservation(params.idempotencyKey);
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'PROMO_INVALID' },
        dependencies,
      );
    }
    dependencies.mixes.reserveStock(params.idempotencyKey, mixPreparation.requirements);
    if (
      !dependencies.payments.persistQuote({
        idempotencyKey: params.idempotencyKey,
        cartId: params.cartId,
        quote,
        updatedAt: createdAt,
      })
    ) {
      throw new Error('Checkout intent quote persistence failed');
    }
    return { quoteTotalCents: quote.totalCents, card };
  });
}

function failPreparation(
  idempotencyKey: string,
  result: CheckoutResult,
  dependencies: CheckoutDependencies,
): CheckoutResult {
  dependencies.payments.transition({
    idempotencyKey,
    expectedStatus: 'prepared',
    nextStatus: 'failed_pre_gateway',
    failureReason: result.success ? null : result.error,
    responseJson: JSON.stringify(result),
    updatedAt: dependencies.clock.now().toISOString(),
  });
  return result;
}

function providerFailure(
  idempotencyKey: string,
  status: 'declined' | 'timeout',
  dependencies: CheckoutDependencies,
): CheckoutResult {
  return dependencies.unitOfWork.run(() => {
    const result: CheckoutResult = {
      success: false,
      error: status === 'declined' ? 'DECLINED' : 'TIMEOUT',
    };
    dependencies.payments.transition({
      idempotencyKey,
      expectedStatus: 'prepared',
      nextStatus: status === 'declined' ? 'declined' : 'timed_out',
      failureReason: result.error,
      responseJson: JSON.stringify(result),
      updatedAt: dependencies.clock.now().toISOString(),
    });
    dependencies.carts.releaseReservation(idempotencyKey);
    dependencies.promos.releaseReservation(idempotencyKey);
    dependencies.mixes.releaseStockReservation(idempotencyKey);
    return result;
  });
}

export function createCheckoutService(dependencies: CheckoutDependencies): CheckoutService {
  return {
    async process(params) {
      const card = validateCard({ ...params, now: dependencies.clock.now() });
      if (!card) return { success: false, error: 'CARD_INVALID' };
      const prepared = prepare(params, card, dependencies);
      if ('success' in prepared) return prepared;
      if ('resume' in prepared) return resumeFinalization(dependencies, params.idempotencyKey);
      const gatewayResult = await dependencies.gateway.process({
        idempotencyKey: params.idempotencyKey,
        amountCents: prepared.quoteTotalCents,
        currency: 'USD',
        cardNumber: prepared.card.digits,
      });
      if (gatewayResult.status !== 'success')
        return providerFailure(params.idempotencyKey, gatewayResult.status, dependencies);
      dependencies.unitOfWork.run(() =>
        dependencies.payments.transition({
          idempotencyKey: params.idempotencyKey,
          expectedStatus: 'prepared',
          nextStatus: 'authorized_pending_finalize',
          gatewayReference: gatewayResult.reference,
          updatedAt: dependencies.clock.now().toISOString(),
        }),
      );
      return resumeFinalization(dependencies, params.idempotencyKey);
    },
  };
}

function resumeFinalization(
  dependencies: CheckoutDependencies,
  idempotencyKey: string,
): CheckoutResult {
  try {
    return finalizeAuthorizedCheckout(dependencies, idempotencyKey);
  } catch {
    // Authorization was committed separately; preserve it for same-key retry.
    return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  }
}
