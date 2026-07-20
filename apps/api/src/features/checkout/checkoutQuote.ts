import type { Cart } from '@shop/contracts/cart';
import type { DeliveryClass } from '@shop/contracts/delivery';
import {
  calculateDiscount,
  type ValidPromo,
} from '../promos/promoService.js';
import type { PersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { CheckoutParams } from './checkoutTypes.js';
import type { InventoryReservationAllocation } from '../inventory/inventoryTypes.js';
import { quoteDelivery } from '../delivery/deliveryRules.js';
import type { DeliveryLine } from '../delivery/deliveryRules.js';

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

  const variantLines = params.cart.items.map((item) => {
    const snap = item.variantSnap;
    return {
      productId: item.productId,
      variantId: snap?.variantId ?? 0,
      productName: item.product.name,
      variantLabel: snap?.label ?? item.product.name,
      unitPriceCents: item.product.priceCents,
      weightGrams: snap?.weightGrams ?? 1000,
      deliveryClass: (snap?.deliveryClass ?? 'parcel') as DeliveryClass,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    };
  });

  const orderMixSnapshots = params.cart.mixItems.map((item) => ({
    ...item,
    snapshotVersion: 2 as const,
  }));

  const mixLines = params.cart.mixItems.map((item) => {
    const bagWeight = item.bagSizeGrams;
    const totalWeight = bagWeight * item.quantity;
    return {
      mixId: item.mixId,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
      deliveryClass: 'parcel' as DeliveryClass,
      weightGrams: totalWeight,
    };
  });

  const deliveryLines: DeliveryLine[] = [
    ...variantLines.map((v) => ({
      deliveryClass: v.deliveryClass,
      unitWeightGrams: v.weightGrams,
      quantity: v.quantity,
    })),
    ...mixLines.map((m) => ({
      deliveryClass: m.deliveryClass,
      unitWeightGrams: m.weightGrams / Math.max(m.quantity, 1),
      quantity: m.quantity,
    })),
  ];

  const deliverySummary = quoteDelivery(deliveryLines);
  const totalCents =
    params.cart.subtotalCents - discountCents + deliverySummary.chargeCents;

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
