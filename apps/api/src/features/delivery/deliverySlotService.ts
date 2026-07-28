import type { Cart } from '@shop/contracts/cart';
import type { DeliverySlotOptionsResponse } from '@shop/contracts/delivery';
import type { Clock } from '../auth/authService.js';
import { quoteCartDelivery } from './deliveryRules.js';
import { calculateLeadTime, listBookableSlots } from './deliverySlotRules.js';

/** Minimal cart read surface this service needs; satisfied by `CartService`. */
export interface DeliverySlotCartReader {
  get(cartId: string): Cart | undefined;
}

export interface DeliverySlotDependencies {
  cart: DeliverySlotCartReader;
  clock: Clock;
}

export interface DeliverySlotService {
  /** Slot options for a cart, or `'CART_NOT_FOUND'` when the cart does not exist. */
  optionsForCart(cartId: string): DeliverySlotOptionsResponse | 'CART_NOT_FOUND';
}

/**
 * Composes the cart read, the existing delivery quote, and the pure slot rules.
 * The clock is injected through this factory; no ambient clock is read anywhere
 * on the path.
 */
export function createDeliverySlotService(
  dependencies: DeliverySlotDependencies,
): DeliverySlotService {
  return {
    optionsForCart(cartId) {
      const cart = dependencies.cart.get(cartId);
      if (!cart) return 'CART_NOT_FOUND';

      const now = dependencies.clock.now();
      const delivery = quoteCartDelivery(cart);
      const leadTime = calculateLeadTime({ deliverySummary: delivery, now });
      const slots = listBookableSlots({ leadTime, now });

      return { delivery, leadTime, slots };
    },
  };
}
