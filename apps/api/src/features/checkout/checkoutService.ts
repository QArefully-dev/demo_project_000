import { getCart } from '../cart/cartService.js';
import type { Cart } from '@shop/contracts/cart';
import type { PowderMixCartItem } from '@shop/contracts/powderizer';
import { validateCard, type ValidCard } from '../payments/cardValidation.js';
import { createSafeFingerprint, type PaymentRecord } from '../payments/paymentRepository.js';
import { validatePromo } from '../promos/promoService.js';
import { createCheckoutQuote } from './checkoutQuote.js';
import { finalizeAuthorizedCheckout } from './checkoutFinalizer.js';
import { prepareMixes } from './checkoutMixPreparation.js';
import { InventoryError } from '../inventory/inventoryTypes.js';
import type { PreGatewayFailureCode } from '../audit/auditEvent.js';
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
const RESERVATION_LEASE_MS = 15 * 60_000;

function preGatewayFailureCode(result: CheckoutResult): PreGatewayFailureCode {
  if (!result.success) {
    switch (result.error) {
      case 'CART_NOT_FOUND':
      case 'CART_EMPTY':
      case 'PROMO_INVALID':
      case 'MIX_REQUOTE_REQUIRED':
      case 'MIX_STOCK_UNAVAILABLE':
      case 'CHECKOUT_FAILED':
        return result.error;
    }
  }
  return 'CHECKOUT_FAILED';
}

function withPreparedMixes(cart: Cart, mixItems: PowderMixCartItem[]): Cart {
  const subtotalCents = [...cart.items, ...mixItems].reduce(
    (total, item) => total + item.lineTotalCents,
    0,
  );
  return {
    ...cart,
    mixItems,
    subtotalCents,
    totalItems: [...cart.items, ...mixItems].reduce((total, item) => total + item.quantity, 0),
  };
}

function replay(
  payment: PaymentRecord,
  fingerprint: string,
  dependencies: CheckoutDependencies,
): Preparation {
  if (payment.fingerprint !== fingerprint) return { success: false, error: 'IDEMPOTENT_CONFLICT' };
  if (payment.status === 'prepared') return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  if (payment.status === 'authorized_pending_finalize') return { resume: true };
  if (payment.status === 'succeeded' && payment.orderId !== null) {
    const order = dependencies.orders.findById(payment.orderId);
    return order ? { success: true, order } : { success: false, error: 'CHECKOUT_FAILED' };
  }
  if (payment.responseJson) {
    try {
      const result = JSON.parse(payment.responseJson) as CheckoutResult;
      if (typeof result === 'object' && result !== null && 'success' in result) return result;
    } catch {
      return { success: false, error: 'CHECKOUT_FAILED' };
    }
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
  expirePreparedReservations(dependencies);
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
        params.auditContext,
        dependencies,
      );
    if (cart.totalItems === 0)
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CART_EMPTY' },
        params.auditContext,
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
        params.auditContext,
        dependencies,
      );
    const validPromo = promo?.valid ? promo.promoCode : undefined;
    const mixPreparation = prepareMixes(params.cartId, dependencies);
    if ('error' in mixPreparation)
      return failPreparation(
        params.idempotencyKey,
        mixPreparation,
        params.auditContext,
        dependencies,
      );
    const preparedCart = withPreparedMixes(cart, mixPreparation.mixItems);
    const createdAt = dependencies.clock.now().toISOString();
    if (!dependencies.carts.reserve(params.cartId, params.idempotencyKey, createdAt)) {
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CHECKOUT_FAILED' },
        params.auditContext,
        dependencies,
      );
    }
    if (
      validPromo &&
      !dependencies.promos.reserve({
        code: validPromo.code,
        userId: params.userId,
        paymentIdempotencyKey: params.idempotencyKey,
        createdAt,
      })
    ) {
      dependencies.carts.releaseReservation(params.idempotencyKey);
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'PROMO_INVALID' },
        params.auditContext,
        dependencies,
      );
    }
    const reservationExpiresAt = new Date(
      Date.parse(createdAt) + RESERVATION_LEASE_MS,
    ).toISOString();
    let inventoryAllocations;
    try {
      inventoryAllocations = dependencies.inventory.reserveCheckout({
        paymentIdempotencyKey: params.idempotencyKey,
        demands: [
          ...preparedCart.items.map((item) => ({
            variantId: item.variantSnap?.variantId ?? 0,
            quantity: item.quantity,
            demandKind: 'product' as const,
          })),
          ...mixPreparation.requirements.map((requirement) => {
            const defaultVariant = dependencies.products.findDefaultVariant(
              requirement.productId,
            );
            return {
              variantId: defaultVariant?.id ?? 0,
              quantity: requirement.bagEquivalents,
              demandKind: 'powder_mix' as const,
            };
          }),
        ],
        now: createdAt,
        expiresAt: reservationExpiresAt,
      });
    } catch (error) {
      dependencies.carts.releaseReservation(params.idempotencyKey);
      dependencies.promos.releaseReservation(params.idempotencyKey);
      if (error instanceof InventoryError && error.code === 'INSUFFICIENT_STOCK') {
        return failPreparation(
          params.idempotencyKey,
          {
            success: false,
            error: 'INSUFFICIENT_STOCK',
            productIds: error.variantIds.map(String),
          },
          params.auditContext,
          dependencies,
        );
      }
      throw error;
    }
    const quote = createCheckoutQuote({
      cart: preparedCart,
      checkout: params,
      promo: validPromo,
      createdAt,
      inventoryAllocations,
    });
    if (
      !dependencies.payments.persistQuote({
        idempotencyKey: params.idempotencyKey,
        cartId: params.cartId,
        quote,
        updatedAt: createdAt,
        reservationExpiresAt,
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
  context: CheckoutParams['auditContext'],
  dependencies: CheckoutDependencies,
): CheckoutResult {
  const transitioned = dependencies.payments.transition({
    idempotencyKey,
    expectedStatus: 'prepared',
    nextStatus: 'failed_pre_gateway',
    failureReason: result.success ? null : result.error,
    responseJson: JSON.stringify(result),
    updatedAt: dependencies.clock.now().toISOString(),
  });
  if (transitioned) {
    const payment = dependencies.payments.load(idempotencyKey);
    if (!payment) throw new Error('Checkout intent disappeared after pre-gateway failure');
    dependencies.audit.append({
      action: 'payment.pre_gateway_failed',
      context,
      paymentId: payment.id,
      errorCode: preGatewayFailureCode(result),
    });
  }
  return result;
}

function providerFailure(
  idempotencyKey: string,
  status: 'declined' | 'timeout',
  context: CheckoutParams['auditContext'],
  dependencies: CheckoutDependencies,
): CheckoutResult {
  return dependencies.unitOfWork.run(() => {
    const result: CheckoutResult = {
      success: false,
      error: status === 'declined' ? 'DECLINED' : 'TIMEOUT',
    };
    const transitioned = dependencies.payments.transition({
      idempotencyKey,
      expectedStatus: 'prepared',
      nextStatus: status === 'declined' ? 'declined' : 'timed_out',
      failureReason: result.error,
      responseJson: JSON.stringify(result),
      updatedAt: dependencies.clock.now().toISOString(),
    });
    dependencies.carts.releaseReservation(idempotencyKey);
    dependencies.promos.releaseReservation(idempotencyKey);
    dependencies.inventory.releaseReservation(idempotencyKey);
    if (transitioned) {
      const payment = dependencies.payments.load(idempotencyKey);
      if (!payment) throw new Error('Checkout intent disappeared after provider failure');
      dependencies.audit.append({
        action: status === 'declined' ? 'payment.declined' : 'payment.timed_out',
        context,
        paymentId: payment.id,
      });
    }
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
      if ('resume' in prepared)
        return resumeFinalization(dependencies, params.idempotencyKey, params.auditContext);
      const gatewayResult = await dependencies.gateway.process({
        idempotencyKey: params.idempotencyKey,
        amountCents: prepared.quoteTotalCents,
        currency: 'USD',
        cardNumber: prepared.card.digits,
      });
      if (gatewayResult.status !== 'success')
        return providerFailure(
          params.idempotencyKey,
          gatewayResult.status,
          params.auditContext,
          dependencies,
        );
      const authorization = dependencies.unitOfWork.run(() => {
        const now = dependencies.clock.now().toISOString();
        const payment = dependencies.payments.load(params.idempotencyKey);
        if (!payment || payment.status !== 'prepared') return { authorized: false } as const;
        if (payment.reservationExpiresAt !== null && payment.reservationExpiresAt <= now) {
          return {
            authorized: false,
            expired: terminalizePreparedExpiry(
              params.idempotencyKey,
              payment.reservationExpiresAt,
              now,
              dependencies,
            ),
          } as const;
        }
        try {
          dependencies.inventory.authorizeReservation(params.idempotencyKey, now);
        } catch (error) {
          if (!(error instanceof InventoryError) || error.code !== 'RESERVATION_EXPIRED')
            throw error;
          return {
            authorized: false,
            expired: terminalizePreparedExpiry(
              params.idempotencyKey,
              payment.reservationExpiresAt ?? now,
              now,
              dependencies,
            ),
          } as const;
        }
        if (
          !dependencies.payments.transition({
            idempotencyKey: params.idempotencyKey,
            expectedStatus: 'prepared',
            nextStatus: 'authorized_pending_finalize',
            gatewayReference: gatewayResult.reference,
            updatedAt: now,
          })
        ) {
          throw new Error('Checkout intent state changed during authorization');
        }
        return { authorized: true } as const;
      });
      if (authorization.expired) return authorization.expired;
      if (!authorization.authorized) {
        return replay(
          dependencies.payments.load(params.idempotencyKey)!,
          createSafeFingerprint(params, card),
          dependencies,
        ) as CheckoutResult;
      }
      return resumeFinalization(dependencies, params.idempotencyKey, params.auditContext);
    },
  };
}

function expirePreparedReservations(dependencies: CheckoutDependencies): void {
  const now = dependencies.clock.now().toISOString();
  dependencies.unitOfWork.run(() => {
    for (const idempotencyKey of dependencies.inventory.expirePrepared(now)) {
      const payment = dependencies.payments.load(idempotencyKey);
      if (!payment || payment.status !== 'prepared') continue;
      terminalizePreparedExpiry(
        idempotencyKey,
        payment.reservationExpiresAt ?? now,
        now,
        dependencies,
      );
    }
  });
}

function terminalizePreparedExpiry(
  idempotencyKey: string,
  reservationExpiresAt: string,
  now: string,
  dependencies: CheckoutDependencies,
): CheckoutResult {
  const result: CheckoutResult = {
    success: false,
    error: 'RESERVATION_EXPIRED',
    reservationExpiresAt,
  };
  if (
    !dependencies.payments.transition({
      idempotencyKey,
      expectedStatus: 'prepared',
      nextStatus: 'failed_pre_gateway',
      failureReason: result.error,
      responseJson: JSON.stringify(result),
      updatedAt: now,
    })
  ) {
    throw new Error('Checkout intent state changed during reservation expiry');
  }
  dependencies.carts.releaseReservation(idempotencyKey);
  dependencies.promos.releaseReservation(idempotencyKey);
  dependencies.inventory.releaseReservation(idempotencyKey);
  return result;
}

function resumeFinalization(
  dependencies: CheckoutDependencies,
  idempotencyKey: string,
  auditContext: CheckoutParams['auditContext'],
): CheckoutResult {
  try {
    return finalizeAuthorizedCheckout(dependencies, idempotencyKey, auditContext);
  } catch {
    // Authorization was committed separately; preserve it for same-key retry.
    return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  }
}
