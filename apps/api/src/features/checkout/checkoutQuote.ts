import type { Cart } from '@shop/contracts/cart';
import { calculateDiscount, type ValidPromo } from '../promos/promoService.js';
import type { PersistedCheckoutQuote } from '../payments/paymentRepository.js';
import type { CheckoutParams } from './checkoutTypes.js';
import type { InventoryReservationAllocation } from '../inventory/inventoryTypes.js';

/** Maps cart data once into an immutable, persistence-safe checkout quote. */
export function createCheckoutQuote(params: {
  cart: Cart;
  checkout: CheckoutParams;
  promo: ValidPromo | undefined;
  createdAt: string;
  inventoryAllocations: readonly InventoryReservationAllocation[];
}): PersistedCheckoutQuote {
  const discountCents = params.promo
    ? calculateDiscount({ promo: params.promo, subtotalCents: params.cart.subtotalCents })
    : 0;
  return {
    version: 4,
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
    totalCents: params.cart.subtotalCents - discountCents,
    lines: params.cart.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      unitPriceCents: item.product.priceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
    mixLines: params.cart.mixItems.map((item) => ({ ...item, snapshotVersion: 2 })),
    inventoryAllocations: params.inventoryAllocations
      .filter((allocation) => allocation.demandKind === 'product')
      .map((allocation) => ({
        productId: String(allocation.productId),
        reservedQuantity: allocation.reservedQuantity,
        backorderedQuantity: allocation.backorderedQuantity,
      })),
    createdAt: params.createdAt,
  };
}
