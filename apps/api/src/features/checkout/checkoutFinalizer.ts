import { parsePersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { CreateOrderLineVariantSnapshot } from '../orders/orderTypes.js';
import type { CheckoutDependencies, CheckoutResult } from './checkoutTypes.js';

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

    const orderItems = quote.variantLines.map((v) => {
      const variant = dependencies.products.findVariantById(v.variantId);
      const variantSnapshot: CreateOrderLineVariantSnapshot = {
        variantId: v.variantId,
        sku: variant?.sku ?? `SKU-${v.productId}-${v.variantId}`,
        label: v.variantLabel,
        weightGrams: v.weightGrams,
        consumptionClassification: v.consumptionClassification as 'food' | 'non-food' | 'caution',
        deliveryClass: v.deliveryClass,
      };
      return {
        productId: v.productId,
        productName: v.productName,
        unitPriceCents: v.unitPriceCents,
        quantity: v.quantity,
        lineTotalCents: v.lineTotalCents,
        variantSnapshot,
      };
    });

    const orderId = dependencies.orders.create({
      customerName: quote.customer.name,
      customerEmail: quote.customer.email,
      shippingAddress: quote.customer.shippingAddress,
      promoApplied: quote.promoCode,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      totalCents: quote.totalCents,
      userId: quote.userId,
      items: orderItems,
      deliveryMode: quote.deliverySummary.mode,
      deliveryChargeCents: quote.deliverySummary.chargeCents,
      deliveryWeightGrams: quote.deliverySummary.weightGrams,
      createdAt,
    });

    const order = dependencies.orders.findById(orderId);
    if (!order) throw new Error('Created order could not be hydrated');

    dependencies.inventory.commitReservation({
      paymentIdempotencyKey: idempotencyKey,
      orderId,
      ordinaryLines: order.items.map((line) => {
        const variantId =
          line.variantSnapshot?.variantId ??
          dependencies.products.findDefaultVariant(Number(line.productId))?.id ??
          0;
        return {
          orderLineItemId: Number(line.lineId),
          variantId,
          quantity: line.quantity,
        };
      }),
      occurredAt: createdAt,
    });

    if (quote.promoCode)
      dependencies.promos.commitReservation({ paymentIdempotencyKey: idempotencyKey, orderId });
    dependencies.mailbox.add({
      recipient: quote.customer.email,
      subject: `QArefully Powder Co. — order #${orderId} confirmed`,
      body: `Your QArefully Powder Co. order #${orderId} has been recorded. ${
        quote.deliverySummary.mode === 'freight'
          ? `Freight delivery: $${quote.deliverySummary.chargeCents / 100}. `
          : ''
      }Total: $${quote.totalCents / 100}. This was a simulated payment; no card was charged.`,
      kind: 'order_confirmation',
      createdAt,
    });
    dependencies.carts.remove(quote.cartId);
    const result: CheckoutResult = {
      success: true,
      order,
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
      itemCount: quote.variantLines.reduce((total, item) => total + item.quantity, 0),
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
