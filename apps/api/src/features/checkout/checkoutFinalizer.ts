import type { Order } from '@shop/contracts/orders';
import { DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME } from '@shop/contracts/powderizer';
import type { PowderMixOrderItem } from '@shop/contracts/powderizer';
import { parsePersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { CheckoutDependencies, CheckoutResult } from './checkoutTypes.js';

function normalizeOrderMixItem(mix: PowderMixOrderItem): Order['mixItems'][number] {
  if (mix.snapshotVersion === 1) {
    return {
      ...mix,
      bagColourScheme: DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
      usageLabel: 'Check ingredient labels',
    };
  }
  return mix;
}

function orderFromQuote(
  orderId: number,
  quote: ReturnType<typeof parsePersistedCheckoutQuote>,
  createdAt: string,
): Order {
  return {
    id: String(orderId),
    items: quote.lines,
    mixItems: quote.version === 1 ? [] : quote.mixLines.map(normalizeOrderMixItem),
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    promoApplied: quote.promoCode,
    createdAt,
  };
}

/** Finalizes only an already-authorized intent; rollback leaves it resumable. */
export function finalizeAuthorizedCheckout(
  dependencies: CheckoutDependencies,
  idempotencyKey: string,
  auditContext: AuditContext,
): CheckoutResult {
  return dependencies.unitOfWork.run(() => {
    const payment = dependencies.payments.load(idempotencyKey);
    if (!payment || payment.status !== 'authorized_pending_finalize' || !payment.quoteJson) {
      return { success: false, error: 'CHECKOUT_FAILED' };
    }
    const quote = parsePersistedCheckoutQuote(payment.quoteJson);
    const createdAt = dependencies.clock.now().toISOString();
    const orderId = dependencies.orders.create({
      customerName: quote.customer.name,
      customerEmail: quote.customer.email,
      shippingAddress: quote.customer.shippingAddress,
      promoApplied: quote.promoCode,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      totalCents: quote.totalCents,
      userId: quote.userId,
      items: quote.lines,
      mixItems: quote.version === 1 ? [] : quote.mixLines,
      createdAt,
    });
    dependencies.mixes.consumeReservedStock(idempotencyKey);
    if (quote.promoCode)
      dependencies.promos.commitReservation({ paymentIdempotencyKey: idempotencyKey, orderId });
    dependencies.mailbox.add({
      recipient: quote.customer.email,
      subject: `QArefully Powder Co. — order #${orderId} confirmed`,
      body: `Your QArefully Powder Co. order #${orderId} has been recorded. ${quote.version !== 1 && quote.mixLines.length ? `Custom mixes: ${quote.mixLines.length}. ` : ''}Total: $${quote.totalCents / 100}. This was a simulated payment; no card was charged.`,
      kind: 'order_confirmation',
      createdAt,
    });
    dependencies.carts.remove(quote.cartId);
    const result: CheckoutResult = {
      success: true,
      order: orderFromQuote(orderId, quote, createdAt),
    };
    if (
      !dependencies.payments.transition({
        idempotencyKey,
        expectedStatus: 'authorized_pending_finalize',
        nextStatus: 'succeeded',
        orderId,
        amountCents: quote.totalCents,
        responseJson: JSON.stringify(result),
        updatedAt: createdAt,
      })
    ) {
      throw new Error('Checkout authorization state changed during finalization');
    }
    dependencies.audit.append({
      action: 'order.created',
      context: auditContext,
      orderId,
      totalCents: quote.totalCents,
      itemCount: quote.lines.reduce((total, item) => total + item.quantity, 0),
      mixItemCount:
        quote.version === 1 ? 0 : quote.mixLines.reduce((total, item) => total + item.quantity, 0),
    });
    dependencies.audit.append({
      action: 'payment.succeeded',
      context: auditContext,
      paymentId: payment.id,
      orderId,
      amountCents: quote.totalCents,
    });
    dependencies.audit.append({
      action: 'checkout.cart_consumed',
      context: auditContext,
      cartId: quote.cartId,
    });
    return result;
  });
}
