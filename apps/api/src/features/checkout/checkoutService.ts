import { getCart } from '../cart/cartService.js';
import type { Cart } from '@shop/contracts/cart';
import type { PostalAddress } from '@shop/contracts/address';
import type { Country } from '@shop/contracts/country';
import { countryProfile } from '@shop/contracts/country-profiles';
import type { BillingEntitySnapshot } from '@shop/contracts/trade-account';
import { CUSTOM_BLEND_FEE_CENTS } from '@shop/contracts';
import { isSlotBookable } from '../delivery/deliverySlotRules.js';
import {
  normalizeOptionalText,
  normalizePostalAddress,
  normalizeText,
  isDeliverableCountryCode,
} from '../tradeAccount/addressRules.js';
import { toBillingEntitySnapshot } from '../tradeAccount/billingEntityRepository.js';
import { normalizeCustomBlendSpec } from '../customBlend/customBlendRules.js';
import { validateCard, type ValidCard } from '../payments/cardValidation.js';
import { createSafeFingerprint, type PaymentRecord } from '../payments/paymentRepository.js';
import {
  calculateDiscount,
  resolvePromoScope,
  validatePromo,
  type PromoValidation,
} from '../promos/promoService.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';
import { createCheckoutQuote } from './checkoutQuote.js';
import { finalizeAuthorizedCheckout } from './checkoutFinalizer.js';
import { InventoryError } from '../inventory/inventoryTypes.js';
import { validateMoq } from '../pricing/pricingRules.js';
import type { PreGatewayFailureCode } from '../audit/auditEvent.js';
import type {
  CheckoutDependencies,
  CheckoutParams,
  CheckoutResult,
  CheckoutService,
  ResolvedCheckoutCommitments,
} from './checkoutTypes.js';

export type {
  CheckoutDependencies,
  CheckoutParams,
  CheckoutResult,
  CheckoutService,
  ResolvedCheckoutCommitments,
} from './checkoutTypes.js';

type Preparation = CheckoutResult | { quoteTotalCents: number; card: ValidCard } | { resume: true };
const RESERVATION_LEASE_MS = 15 * 60_000;

function preGatewayFailureCode(result: CheckoutResult): PreGatewayFailureCode {
  if (!result.success) {
    switch (result.error) {
      case 'CART_NOT_FOUND':
      case 'CART_EMPTY':
      case 'PROMO_INVALID':
      case 'PENDING_APPROVAL':
      case 'CHECKOUT_FAILED':
        return result.error;
    }
  }
  return 'CHECKOUT_FAILED';
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

function isPendingApprovalPayment(payment: PaymentRecord): boolean {
  if (payment.status !== 'failed_pre_gateway' || !payment.responseJson) return false;
  try {
    const result = JSON.parse(payment.responseJson) as { success?: unknown; error?: unknown };
    return result.success === false && result.error === 'PENDING_APPROVAL';
  } catch {
    return false;
  }
}

function quoteTotalBeforeReservation(cart: Cart, promo: PromoValidation | undefined): number {
  const validPromo = promo && promo.valid ? promo.promoCode : undefined;
  const promoScope = validPromo ? resolvePromoScope({ promo: validPromo, cart }) : undefined;
  const discountCents = validPromo
    ? calculateDiscount({
        promo: validPromo,
        discountableSubtotalCents: promoScope!.discountBaseCents,
      })
    : 0;
  return cart.subtotalCents - discountCents + quoteCartDelivery(cart).chargeCents;
}

/**
 * Resolves the buyer's delivery and billing commitments server-side and re-validates the submitted
 * slot, inside the preparation transaction and before any reservation is taken.
 *
 * A `saved` selection is loaded from the buyer's own live records: an unknown id, a retired record,
 * another user's record, and an anonymous checkout all collapse to the same failure so the response
 * cannot be used to probe which records exist. A client-supplied address is never consulted for a
 * saved selection.
 *
 * The slot is checked against a lead time re-derived from the live cart through the same service
 * that answered the slot endpoint, so an offered slot and an accepted slot cannot drift.
 */
function resolveCommitments(
  params: CheckoutParams,
  cartCountry: Country,
  dependencies: CheckoutDependencies,
): { resolved: ResolvedCheckoutCommitments } | { failure: CheckoutResult } {
  const destination = params.deliveryDestination;
  let deliverySiteId: number | null = null;
  let deliveryAddress: PostalAddress;
  if (destination.kind === 'saved') {
    if (params.userId === null)
      return { failure: { success: false, error: 'DELIVERY_SITE_NOT_FOUND' } };
    const siteId = Number(destination.deliverySiteId);
    const site = dependencies.tradeAccount.sites.get(params.userId, siteId);
    if (!site.ok) return { failure: { success: false, error: 'DELIVERY_SITE_NOT_FOUND' } };
    deliverySiteId = siteId;
    deliveryAddress = site.value.address;
  } else {
    // Saved addresses are normalized on the way into storage; an ad-hoc one is normalized here so
    // both destinations produce the same rendering and the same fingerprint for the same place.
    deliveryAddress = normalizePostalAddress(destination.address);
  }
  if (!isDeliverableCountryCode(countryProfile(cartCountry), deliveryAddress.countryCode)) {
    return { failure: { success: false, error: 'DELIVERY_COUNTRY_NOT_ALLOWED' } };
  }

  const billing = params.billingSelection;
  let billingEntity: BillingEntitySnapshot;
  if (billing.kind === 'saved') {
    if (params.userId === null)
      return { failure: { success: false, error: 'BILLING_ENTITY_INVALID' } };
    const entity = dependencies.tradeAccount.billingEntities.get(
      params.userId,
      Number(billing.billingEntityId),
    );
    if (!entity.ok) return { failure: { success: false, error: 'BILLING_ENTITY_INVALID' } };
    billingEntity = toBillingEntitySnapshot(entity.value);
  } else {
    billingEntity = {
      legalName: normalizeText(billing.billingEntity.legalName),
      registrationNumber: normalizeOptionalText(billing.billingEntity.registrationNumber),
      vatNumber: normalizeOptionalText(billing.billingEntity.vatNumber),
      address: normalizePostalAddress(billing.billingEntity.address),
    };
  }

  const options = dependencies.deliverySlots.optionsForCart(params.cartId);
  if (options === 'CART_NOT_FOUND') return { failure: { success: false, error: 'CART_NOT_FOUND' } };
  if (
    !isSlotBookable(
      params.deliverySlot,
      options.leadTime,
      dependencies.clock.now(),
      countryProfile(cartCountry),
    )
  ) {
    return {
      failure: {
        success: false,
        error: 'DELIVERY_SLOT_UNAVAILABLE',
        earliestDate: options.leadTime.earliestDate,
      },
    };
  }

  return {
    resolved: {
      deliverySiteId,
      deliveryAddress,
      billingEntity,
      deliverySlot: params.deliverySlot,
      purchaseOrderReference: normalizeOptionalText(params.purchaseOrderReference),
    },
  };
}

function prepare(
  params: CheckoutParams,
  card: ValidCard,
  dependencies: CheckoutDependencies,
): Preparation {
  const fingerprint = createSafeFingerprint(params, card);
  expirePreparedReservations(dependencies);
  const existing = dependencies.payments.load(params.idempotencyKey);
  const approvalRetry = existing !== undefined && isPendingApprovalPayment(existing);
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      return { success: false, error: 'IDEMPOTENT_CONFLICT' };
    if (!approvalRetry) return replay(existing, fingerprint, dependencies);
  }
  return dependencies.unitOfWork.run(() => {
    if (!approvalRetry) {
      const reservation = dependencies.payments.reservePreGateway({
        idempotencyKey: params.idempotencyKey,
        fingerprint,
        card,
        createdAt: dependencies.clock.now().toISOString(),
      });
      if (!reservation.reserved) return replay(reservation.payment, fingerprint, dependencies);
    }
    const cart = getCart(dependencies.carts, params.cartId, {
      inventory: dependencies.inventory,
      clock: dependencies.clock,
    });
    if (!cart)
      return failPreparation(
        params.idempotencyKey,
        // An existing cart that will not resolve was invalidated by its configured lines: the read
        // path refuses to price a blend whose facts are gone. Report that, not a missing cart.
        {
          success: false,
          error: dependencies.carts.exists(params.cartId)
            ? 'CUSTOM_BLEND_INVALID'
            : 'CART_NOT_FOUND',
        },
        params.auditContext,
        dependencies,
      );
    const countryAvailability = cartLinesUnblocked(cart, dependencies);
    if (!countryAvailability.unblocked)
      return failPreparation(
        params.idempotencyKey,
        {
          success: false,
          error: 'BLOCKED_IN_COUNTRY',
          productIds: countryAvailability.productIds,
        },
        params.auditContext,
        dependencies,
      );
    if (!customBlendLinesRemainEligible(cart, dependencies))
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CUSTOM_BLEND_INVALID' },
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
    if (!cartMeetsVariantMoq(cart, dependencies))
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'BELOW_MOQ' },
        params.auditContext,
        dependencies,
      );
    // Destination, billing party, and slot are settled here: every branch below this point may take
    // a cart, promo, or inventory reservation, and none of these failures may leave one held.
    // Read the identity country from the persisted cart row. Request headers and postal country
    // codes are intentionally irrelevant to this lookup.
    const cartCountry = dependencies.carts.country(params.cartId);
    if (!cartCountry)
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'CART_NOT_FOUND' },
        params.auditContext,
        dependencies,
      );
    const commitments = resolveCommitments(params, cartCountry, dependencies);
    if ('failure' in commitments)
      return failPreparation(
        params.idempotencyKey,
        commitments.failure,
        params.auditContext,
        dependencies,
      );
    const promo = params.promoCode
      ? validatePromo(
          {
            code: params.promoCode,
            cartId: params.cartId,
            userId: params.userId,
            country: cartCountry,
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
    const approval = dependencies.approvals?.evaluate({
      userId: params.userId,
      cartId: params.cartId,
      quoteTotalCents: quoteTotalBeforeReservation(cart, promo),
      resolvedCommitments: commitments.resolved,
      idempotencyKey: params.idempotencyKey,
      context: params.auditContext,
    });
    if (approval?.gate === 'defer')
      return failPreparation(
        params.idempotencyKey,
        {
          success: false,
          error: 'PENDING_APPROVAL',
          approvalRequestId: approval.approvalRequestId,
        },
        params.auditContext,
        dependencies,
      );
    if (approval?.gate === 'rejected')
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'APPROVAL_REJECTED' },
        params.auditContext,
        dependencies,
      );
    if (approval?.gate === 'expired')
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'APPROVAL_EXPIRED' },
        params.auditContext,
        dependencies,
      );
    if (approval?.gate === 'total-drift')
      return failPreparation(
        params.idempotencyKey,
        { success: false, error: 'APPROVAL_TOTAL_DRIFT' },
        params.auditContext,
        dependencies,
      );
    if (approval?.gate === 'requester-mismatch')
      return { success: false, error: 'CHECKOUT_FAILED' };
    if (approvalRetry) {
      if (approval?.gate !== 'approved-retry') return { success: false, error: 'CHECKOUT_FAILED' };
      if (
        !dependencies.payments.transition({
          idempotencyKey: params.idempotencyKey,
          expectedStatus: 'failed_pre_gateway',
          nextStatus: 'prepared',
          updatedAt: dependencies.clock.now().toISOString(),
        })
      ) {
        const current = dependencies.payments.load(params.idempotencyKey);
        return current
          ? replay(current, fingerprint, dependencies)
          : { success: false, error: 'CHECKOUT_FAILED' };
      }
    }
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
        demands: cart.items.map((item) => ({
          variantId: item.variantSnap?.variantId ?? 0,
          quantity: item.quantity,
        })),
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
      cart,
      checkout: params,
      resolved: commitments.resolved,
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

/**
 * Re-resolves every configured line against live catalog facts inside the preparation
 * transaction, before any reservation or gateway call. Checkout owns this gate rather than
 * trusting the cart read path: a lot retired between configuration and payment must stop the
 * charge, and it must stop it with no inventory mutation and no money movement.
 */
function customBlendLinesRemainEligible(cart: Cart, dependencies: CheckoutDependencies): boolean {
  return cart.items.every((item) => {
    const blend = item.customBlend;
    if (!blend) return item.configKey === '' && item.blendingFeeCents === 0;
    const baseVariantId = item.variantSnap?.variantId;
    if (baseVariantId === undefined) return false;
    if (
      blend.configKey !== item.configKey ||
      blend.blendingFeeCents !== CUSTOM_BLEND_FEE_CENTS ||
      item.blendingFeeCents !== CUSTOM_BLEND_FEE_CENTS ||
      item.discountableTotalCents !== item.materialSubtotalCents ||
      item.materialSubtotalCents + item.blendingFeeCents !== item.lineTotalCents
    ) {
      return false;
    }
    let normalized;
    try {
      normalized = normalizeCustomBlendSpec(baseVariantId, blend.ingredients);
    } catch {
      return false;
    }
    if (
      normalized.configKey !== item.configKey ||
      normalized.basePercentage !== blend.basePercentage
    ) {
      return false;
    }
    const factVariantIds = [
      baseVariantId,
      ...normalized.ingredients.map((ingredient) => ingredient.variantId),
    ];
    const facts = dependencies.carts.listEligibleCustomBlendFacts(factVariantIds);
    if (facts.length !== factVariantIds.length) return false;
    const base = facts.find((fact) => fact.variant_id === baseVariantId);
    if (!base || base.mixing_group !== blend.mixingGroup) return false;
    return facts.every((fact) => fact.mixing_group === base.mixing_group);
  });
}

function cartMeetsVariantMoq(cart: Cart, dependencies: CheckoutDependencies): boolean {
  return cart.items.every((item) => {
    const variantId = item.variantSnap?.variantId;
    if (!variantId) return false;
    const variant = dependencies.carts.getVariant(variantId);
    return (
      variant !== undefined &&
      variant.active === 1 &&
      validateMoq(item.quantity, variant.weight_grams, variant.moq_sacks)
    );
  });
}

function cartLinesUnblocked(
  cart: Cart,
  dependencies: CheckoutDependencies,
): { unblocked: true } | { unblocked: false; productIds: string[] } {
  const countryProfiles = dependencies.countryProfiles;
  if (!countryProfiles) return { unblocked: true };

  const lineVariantIds = cart.items.map((item) => [
    ...(item.variantSnap ? [item.variantSnap.variantId] : []),
    ...(item.customBlend?.ingredients.map((ingredient) => ingredient.variantId) ?? []),
  ]);
  const facts = dependencies.carts.listCountryVariantFacts(cart.id, lineVariantIds.flat());
  const blockedVariantIds = new Set(
    facts
      .filter(
        (fact) =>
          countryProfiles.isCategoryBlocked(fact.country, fact.product_category) ||
          countryProfiles.isProductBlocked(fact.country, fact.product_slug),
      )
      .map((fact) => fact.variant_id),
  );
  const productIds = [
    ...new Set(
      cart.items
        .filter((_item, index) =>
          lineVariantIds[index]!.some((variantId) => blockedVariantIds.has(variantId)),
        )
        .map((item) => item.productId),
    ),
  ];
  return productIds.length === 0 ? { unblocked: true } : { unblocked: false, productIds };
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
        return resumeFinalization(
          dependencies,
          params.idempotencyKey,
          params.auditContext,
          selectedDeliverySiteId(params),
        );
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
      return resumeFinalization(
        dependencies,
        params.idempotencyKey,
        params.auditContext,
        selectedDeliverySiteId(params),
      );
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

/**
 * The saved site an order should reference, taken from the request rather than the persisted quote:
 * the quote snapshots the resolved address, not the record it came from. Safe on the resume path
 * because the caller reaches it only after the request fingerprint matched the original attempt.
 */
function selectedDeliverySiteId(params: CheckoutParams): number | null {
  return params.deliveryDestination.kind === 'saved'
    ? Number(params.deliveryDestination.deliverySiteId)
    : null;
}

function resumeFinalization(
  dependencies: CheckoutDependencies,
  idempotencyKey: string,
  auditContext: CheckoutParams['auditContext'],
  deliverySiteId: number | null,
): CheckoutResult {
  try {
    return finalizeAuthorizedCheckout(dependencies, idempotencyKey, auditContext, deliverySiteId);
  } catch {
    // Authorization was committed separately; preserve it for same-key retry.
    return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  }
}
