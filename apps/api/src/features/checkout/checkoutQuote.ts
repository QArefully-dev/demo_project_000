import type { Cart } from '@shop/contracts/cart';
import type { PersistedCheckoutQuoteV5 } from '@shop/contracts/payments';
import { calculateDiscount, type ValidPromo } from '../promos/promoService.js';
import type { PersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { CheckoutParams } from './checkoutTypes.js';
import type { InventoryReservationAllocation } from '../inventory/inventoryTypes.js';
import { quoteCartDelivery } from '../delivery/deliveryRules.js';

/** Maps cart data once into an immutable, persistence-safe checkout quote. */
export function createCheckoutQuote(params: {
  cart: Cart;
  checkout: CheckoutParams;
  promo: ValidPromo | undefined;
  createdAt: string;
  inventoryAllocations: readonly InventoryReservationAllocation[];
}): PersistedCheckoutQuote {
  const discountCents = params.promo
    ? calculateDiscount({
        promo: params.promo,
        subtotalCents: params.cart.subtotalCents,
      })
    : 0;

  const variantLines: PersistedCheckoutQuoteV5['variantLines'] = params.cart.items.map((item) => {
    const snap = item.variantSnap;
    return {
      productId: item.productId,
      variantId: snap?.variantId ?? 0,
      productName: item.product.name,
      variantLabel: snap?.label ?? item.product.name,
      unitPriceCents: resolvedLineUnitPrice(item.lineTotalCents, item.quantity),
      weightGrams: snap?.weightGrams ?? 1000,
      deliveryClass: snap?.deliveryClass ?? 'parcel',
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      consumptionClassification: item.product.consumptionClassification ?? 'non-food',
    };
  });

  const orderMixSnapshots = params.cart.mixItems.map((item) => ({
    ...item,
    snapshotVersion: 2 as const,
  }));

  const mixLines: PersistedCheckoutQuoteV5['mixLines'] = params.cart.mixItems.map((item) => {
    const bagWeight = item.bagSizeGrams;
    const totalWeight = bagWeight * item.quantity;
    return {
      mixId: item.mixId,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      deliveryClass: 'parcel',
      weightGrams: totalWeight,
    };
  });

  const deliverySummary = quoteCartDelivery(params.cart);
  const totalCents = params.cart.subtotalCents - discountCents + deliverySummary.chargeCents;

  return {
    version: 5,
    cartId: params.cart.id,
    customer: {
      name: params.checkout.customerName.trim(),
      email: params.checkout.customerEmail.trim().toLowerCase(),
      shippingAddress: params.checkout.shippingAddress.trim(),
    },
    userId: params.checkout.userId,
    promoCode: params.promo?.code ?? null,
    subtotalCents: params.cart.subtotalCents,
    discountCents,
    totalCents,
    lines: [],
    variantLines,
    mixLines,
    orderMixSnapshots,
    deliverySummary,
    inventoryAllocations: params.inventoryAllocations
      .filter((allocation) => allocation.demandKind === 'product')
      .map((allocation) => ({
        productId: String(allocation.variantId),
        reservedQuantity: allocation.reservedQuantity,
        backorderedQuantity: allocation.backorderedQuantity,
      })),
    createdAt: params.createdAt,
  };
}

function resolvedLineUnitPrice(lineTotalCents: number, quantity: number): number {
  if (
    !Number.isSafeInteger(lineTotalCents) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    lineTotalCents < 0 ||
    lineTotalCents % quantity !== 0
  ) {
    throw new Error('Cart line has an invalid resolved price.');
  }
  return lineTotalCents / quantity;
}
