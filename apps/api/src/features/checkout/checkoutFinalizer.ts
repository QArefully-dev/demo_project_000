import { parsePersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { CreateOrderLineVariantSnapshot } from '../orders/orderTypes.js';
import type { CheckoutDependencies, CheckoutResult } from './checkoutTypes.js';

/** Finalizes only an already-authorized intent; rollback leaves it resumable. */
export function finalizeAuthorizedCheckout(
  dependencies: CheckoutDependencies,
  idempotencyKey: string,
  auditContext: AuditContext,
  /**
   * Saved site the buyer selected, or `null` for an ad-hoc destination. The quote snapshots the
   * resolved address rather than the record it came from, so the reference is supplied here.
   */
  deliverySiteId: number | null = null,
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
      // The quote emits the money split and specification only on configured lines, so a plain
      // line falls back to fee-free defaults and persists byte-identically to prior releases.
      return {
        productId: v.productId,
        productName: v.productName,
        unitPriceCents: v.unitPriceCents,
        quantity: v.quantity,
        discountableTotalCents: v.discountableTotalCents ?? v.lineTotalCents,
        blendingFeeCents: v.blendingFeeCents ?? 0,
        lineTotalCents: v.lineTotalCents,
        variantSnapshot,
        ...(v.customBlend ? { customBlend: v.customBlend } : {}),
      };
    });

    const orderId = dependencies.orders.create({
      customerName: quote.customer.name,
      customerEmail: quote.customer.email,
      shippingAddress: quote.customer.shippingAddress,
      promoApplied: quote.promoCode,
      promoCategoryScope: quote.promoCategoryScope,
      subtotalCents: quote.subtotalCents,
      discountBaseCents: quote.discountBaseCents,
      discountCents: quote.discountCents,
      totalCents: quote.totalCents,
      userId: quote.userId,
      items: orderItems,
      deliveryMode: quote.deliverySummary.mode,
      deliveryChargeCents: quote.deliverySummary.chargeCents,
      deliveryWeightGrams: quote.deliverySummary.weightGrams,
      // An anonymous checkout owns no saved records, so it can never stamp a site reference.
      deliverySiteId: quote.userId === null ? null : deliverySiteId,
      deliveryAddress: quote.customer.deliveryAddress,
      billingEntity: quote.billingEntity,
      deliverySlot: quote.deliverySlot,
      purchaseOrderReference: quote.purchaseOrderReference,
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
      subject: `QArefully Materials Exchange — order #${orderId} confirmed`,
      body: `Your QArefully Materials Exchange order #${orderId} has been recorded. ${
        quote.deliverySummary.mode === 'freight'
          ? `Freight delivery: $${quote.deliverySummary.chargeCents / 100}. `
          : ''
      }Delivery slot: ${quote.deliverySlot.date} ${
        quote.deliverySlot.window === 'am' ? 'morning' : 'afternoon'
      }. ${
        quote.purchaseOrderReference === null
          ? ''
          : `Purchase order reference: ${quote.purchaseOrderReference}. `
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
