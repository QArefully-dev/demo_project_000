import type { Order } from '@shop/contracts/orders';
import type { Clock } from '../auth/authService.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { CartRepository } from '../cart/cartRepository.js';
import type { MailboxRepository } from '../mailbox/mailboxRepository.js';
import type { PaymentGateway } from '../payments/paymentGateway.js';
import type { PaymentRepository } from '../payments/paymentRepository.js';
import type { PromoRepository } from '../promos/promoRepository.js';
import type { OrderRepository } from './orderRepository.js';

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
  unitOfWork: UnitOfWork;
  carts: CartRepository;
  promos: PromoRepository;
  payments: PaymentRepository;
  orders: OrderRepository;
  mailbox: MailboxRepository;
  gateway: PaymentGateway;
  clock: Clock;
}

export interface CheckoutService {
  process(params: CheckoutParams): Promise<CheckoutResult>;
}
