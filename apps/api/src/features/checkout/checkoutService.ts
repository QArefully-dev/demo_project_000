import type Database from 'better-sqlite3';
import type { Order } from '@shop/contracts/orders';
import { createCartRepository } from '../cart/cartRepository.js';
import { getCart } from '../cart/cartService.js';
import { createOrderRepository } from './orderRepository.js';
import { calculateDiscount, validatePromo } from '../promos/promoService.js';
import { createPromoRepository } from '../promos/promoRepository.js';
import { validateCard } from '../payments/cardValidation.js';
import { simulatedPaymentGateway, type PaymentGateway } from '../payments/paymentGateway.js';
import {
  createSafeFingerprint,
  finalizePayment,
  reservePayment,
  type PaymentRecord,
} from '../payments/paymentRepository.js';
import { createMailboxRepository, type MailboxRepository } from '../mailbox/mailboxRepository.js';

export type CheckoutErrorCode =
  | 'CART_NOT_FOUND'
  | 'CART_EMPTY'
  | 'PROMO_INVALID'
  | 'CARD_INVALID'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'IDEMPOTENT_CONFLICT'
  | 'IDEMPOTENT_IN_PROGRESS'
  | 'CHECKOUT_FAILED';

export type CheckoutResult =
  | { success: true; order: Order }
  | { success: false; error: CheckoutErrorCode; promoError?: string; promoErrorCode?: string };

export interface CheckoutParams {
  cartId: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  idempotencyKey: string;
  userId: number | null;
}

export interface CheckoutDependencies {
  db: Database.Database;
  gateway?: PaymentGateway;
  now?: () => Date;
  mailbox?: MailboxRepository;
}

export interface CheckoutService {
  process(params: CheckoutParams): Promise<CheckoutResult>;
}

export function createCheckoutService(dependencies: CheckoutDependencies): CheckoutService {
  return { process: (params) => checkout(params, dependencies) };
}

function replay(
  payment: PaymentRecord,
  fingerprint: string,
  findOrder: (orderId: number) => Order | undefined,
): CheckoutResult {
  if (payment.fingerprint !== fingerprint) return { success: false, error: 'IDEMPOTENT_CONFLICT' };
  if (payment.status === 'processing') return { success: false, error: 'IDEMPOTENT_IN_PROGRESS' };
  if (payment.responseJson) {
    const stored = JSON.parse(payment.responseJson) as CheckoutResult | Order;
    if ('success' in stored) return stored;
    return { success: true, order: stored };
  }
  if (payment.status === 'success' && payment.orderId !== null) {
    const order = findOrder(payment.orderId);
    return order ? { success: true, order } : { success: false, error: 'CHECKOUT_FAILED' };
  }
  if (payment.status === 'declined') return { success: false, error: 'DECLINED' };
  if (payment.status === 'timeout') return { success: false, error: 'TIMEOUT' };
  if (payment.failureReason === 'CART_NOT_FOUND')
    return { success: false, error: 'CART_NOT_FOUND' };
  if (payment.failureReason === 'CART_EMPTY') return { success: false, error: 'CART_EMPTY' };
  if (payment.failureReason === 'PROMO_INVALID') return { success: false, error: 'PROMO_INVALID' };
  return { success: false, error: 'CHECKOUT_FAILED' };
}

export async function checkout(
  params: CheckoutParams,
  dependencies: CheckoutDependencies,
): Promise<CheckoutResult> {
  const { db, gateway = simulatedPaymentGateway, now = () => new Date() } = dependencies;
  const carts = createCartRepository(db);
  const orders = createOrderRepository(db);
  const promos = createPromoRepository(db);
  const mailbox = dependencies.mailbox ?? createMailboxRepository(db);
  const card = validateCard(params);
  if (!card) return { success: false, error: 'CARD_INVALID' };

  const createdAt = now().toISOString();
  const fingerprint = createSafeFingerprint(params, card);
  const reservation = reservePayment(db, {
    idempotencyKey: params.idempotencyKey,
    fingerprint,
    card,
    createdAt,
  });
  if (!reservation.reserved) {
    return replay(reservation.payment, fingerprint, (orderId) => orders.findById(orderId));
  }

  const gatewayResult = await gateway.process(card.digits);
  if (gatewayResult.status !== 'success') {
    const error = gatewayResult.status === 'declined' ? 'DECLINED' : 'TIMEOUT';
    const result: CheckoutResult = { success: false, error };
    finalizePayment(db, {
      idempotencyKey: params.idempotencyKey,
      status: gatewayResult.status,
      amountCents: 0,
      failureReason: error === 'DECLINED' ? 'CARD_DECLINED' : 'GATEWAY_TIMEOUT',
      responseJson: JSON.stringify(result),
    });
    return result;
  }

  try {
    return db.transaction((): CheckoutResult => {
      // Re-read after the gateway await. Totals, promo eligibility, and writes share this transaction.
      const cart = getCart(carts, params.cartId);
      if (!cart) {
        const result: CheckoutResult = { success: false, error: 'CART_NOT_FOUND' };
        finalizePayment(db, {
          idempotencyKey: params.idempotencyKey,
          status: 'failed',
          amountCents: 0,
          failureReason: 'CART_NOT_FOUND',
          responseJson: JSON.stringify(result),
        });
        return result;
      }
      if (cart.items.length === 0) {
        const result: CheckoutResult = { success: false, error: 'CART_EMPTY' };
        finalizePayment(db, {
          idempotencyKey: params.idempotencyKey,
          status: 'failed',
          amountCents: 0,
          failureReason: 'CART_EMPTY',
          responseJson: JSON.stringify(result),
        });
        return result;
      }

      let promoApplied: string | null = null;
      let discountCents = 0;
      if (params.promoCode) {
        const promo = validatePromo(
          {
            code: params.promoCode,
            cartId: params.cartId,
            userId: params.userId,
          },
          { promos, carts },
        );
        if (!promo.valid) {
          const result: CheckoutResult = {
            success: false,
            error: 'PROMO_INVALID',
            promoError: promo.error,
            promoErrorCode: promo.errorCode,
          };
          finalizePayment(db, {
            idempotencyKey: params.idempotencyKey,
            status: 'failed',
            amountCents: 0,
            failureReason: 'PROMO_INVALID',
            responseJson: JSON.stringify(result),
          });
          return result;
        }
        promoApplied = promo.promoCode.code;
        discountCents = calculateDiscount({
          promo: promo.promoCode,
          subtotalCents: cart.subtotalCents,
        });
      }

      const totalCents = cart.subtotalCents - discountCents;
      const orderId = orders.create({
        customerName: params.customerName.trim(),
        customerEmail: params.customerEmail.trim().toLowerCase(),
        shippingAddress: params.shippingAddress.trim(),
        promoApplied,
        subtotalCents: cart.subtotalCents,
        discountCents,
        totalCents,
        userId: params.userId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          unitPriceCents: item.product.priceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
        })),
        createdAt,
      });
      const order: Order = {
        id: String(orderId),
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          unitPriceCents: item.product.priceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
        })),
        subtotalCents: cart.subtotalCents,
        discountCents,
        totalCents,
        promoApplied,
        createdAt,
      };
      const result: CheckoutResult = { success: true, order };
      finalizePayment(db, {
        idempotencyKey: params.idempotencyKey,
        status: 'success',
        orderId,
        amountCents: totalCents,
        responseJson: JSON.stringify(result),
      });
      if (promoApplied)
        promos.recordRedemption({ code: promoApplied, userId: params.userId, orderId });
      mailbox.add({
        recipient: params.customerEmail.trim().toLowerCase(),
        subject: `QArefully Powder Co. — order #${orderId} confirmed`,
        body: `Your QArefully Powder Co. order #${orderId} has been recorded. Total: $${totalCents / 100}. This was a simulated payment; no card was charged.`,
        kind: 'order_confirmation',
        createdAt,
      });
      carts.remove(params.cartId);
      return result;
    })();
  } catch {
    const result: CheckoutResult = { success: false, error: 'CHECKOUT_FAILED' };
    finalizePayment(db, {
      idempotencyKey: params.idempotencyKey,
      status: 'failed',
      amountCents: 0,
      failureReason: 'CHECKOUT_FAILED',
      responseJson: JSON.stringify(result),
    });
    return result;
  }
}
