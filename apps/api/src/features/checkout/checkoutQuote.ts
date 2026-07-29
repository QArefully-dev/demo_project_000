import type { Cart } from '@shop/contracts/cart';
import {
  CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION,
  type PersistedCheckoutQuoteV8,
} from '@shop/contracts/payments';
import { formatPostalAddress } from '@shop/contracts/address';
import { calculateDiscount, resolvePromoScope, type ValidPromo } from '../promos/promoService.js';
import type { PersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { CheckoutParams, ResolvedCheckoutCommitments } from './checkoutTypes.js';
import type { InventoryReservationAllocation } from '../inventory/inventoryTypes.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';

/** Maps cart data once into an immutable, persistence-safe checkout quote. */
export function createCheckoutQuote(params: {
  cart: Cart;
  checkout: CheckoutParams;
  /** Server-resolved destination, billing party, slot, and buyer reference. */
  resolved: ResolvedCheckoutCommitments;
  promo: ValidPromo | undefined;
  createdAt: string;
  inventoryAllocations: readonly InventoryReservationAllocation[];
}): PersistedCheckoutQuote {
  const promoScope = params.promo
    ? resolvePromoScope({ promo: params.promo, cart: params.cart })
    : undefined;
  const discountCents = params.promo
    ? calculateDiscount({
        promo: params.promo,
        discountableSubtotalCents: promoScope!.discountBaseCents,
      })
    : 0;

  const variantLines: PersistedCheckoutQuoteV8['variantLines'] = params.cart.items.map((item) => {
    const snap = item.variantSnap;
    const line = {
      productId: item.productId,
      variantId: snap?.variantId ?? 0,
      productName: item.product.name,
      variantLabel: snap?.label ?? item.product.name,
      unitPriceCents: resolvedLineUnitPrice(item),
      weightGrams: snap?.weightGrams ?? 1000,
      deliveryClass: snap?.deliveryClass ?? 'parcel',
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      consumptionClassification: item.product.consumptionClassification ?? 'non-food',
    };
    // Plain lines keep the historical shape: the money split and specification are written only
    // where a configured blend exists, so ordinary quotes stay byte-identical to prior releases.
    if (!item.customBlend) return line;
    return {
      ...line,
      materialSubtotalCents: item.materialSubtotalCents,
      blendingFeeCents: item.blendingFeeCents,
      discountableTotalCents: item.discountableTotalCents,
      customBlend: item.customBlend,
    };
  });

  const deliverySummary = quoteCartDelivery(params.cart);
  const totalCents = params.cart.subtotalCents - discountCents + deliverySummary.chargeCents;

  return {
    version: CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION,
    cartId: params.cart.id,
    customer: {
      name: params.checkout.customerName.trim(),
      email: params.checkout.customerEmail.trim().toLowerCase(),
      deliveryAddress: params.resolved.deliveryAddress,
      // The legacy free-text address is rendered here and nowhere else, so the structured value
      // and the flat `orders.shipping_address` column can never disagree.
      shippingAddress: formatPostalAddress(params.resolved.deliveryAddress),
    },
    userId: params.checkout.userId,
    promoCode: params.promo?.code ?? null,
    subtotalCents: params.cart.subtotalCents,
    discountBaseCents: promoScope?.discountBaseCents ?? 0,
    promoCategoryScope: params.promo?.categoryScope ?? null,
    discountCents,
    totalCents,
    lines: [],
    variantLines,
    deliverySummary,
    inventoryAllocations: params.inventoryAllocations.map((allocation) => ({
      productId: String(allocation.variantId),
      reservedQuantity: allocation.reservedQuantity,
      backorderedQuantity: allocation.backorderedQuantity,
    })),
    billingEntity: params.resolved.billingEntity,
    deliverySlot: params.resolved.deliverySlot,
    purchaseOrderReference: params.resolved.purchaseOrderReference,
    createdAt: params.createdAt,
  };
}

/**
 * Unit price comes from the material subtotal, never the line total: a blending fee is charged
 * once per configured line, so dividing the line total by quantity would smear it across sacks.
 */
function resolvedLineUnitPrice(item: Cart['items'][number]): number {
  const { materialSubtotalCents, blendingFeeCents, lineTotalCents, quantity } = item;
  if (
    !Number.isSafeInteger(materialSubtotalCents) ||
    !Number.isSafeInteger(blendingFeeCents) ||
    !Number.isSafeInteger(lineTotalCents) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    materialSubtotalCents < 0 ||
    blendingFeeCents < 0 ||
    materialSubtotalCents % quantity !== 0 ||
    materialSubtotalCents + blendingFeeCents !== lineTotalCents ||
    materialSubtotalCents !== item.resolvedUnitPriceCents * quantity
  ) {
    throw new Error('Cart line has an invalid resolved price.');
  }
  return materialSubtotalCents / quantity;
}
