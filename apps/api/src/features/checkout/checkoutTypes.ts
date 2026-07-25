import type { Order } from '@shop/contracts/orders';
import type { Clock } from '../auth/authService.js';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { CartRepository } from '../cart/cartRepository.js';
import type { MailboxRepository } from '../mailbox/mailboxRepository.js';
import type { PaymentGateway } from '../payments/paymentGateway.js';
import type { PaymentRepository } from '../payments/paymentRepository.js';
import type { PromoRepository } from '../promos/promoRepository.js';
import type { OrderRepository } from '../orders/orderRepository.js';
import type { ProductRepository } from '../catalog/productRepository.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { InventoryService } from '../inventory/inventoryService.js';

export type CheckoutErrorCode =
  | 'CART_NOT_FOUND'
  | 'CART_EMPTY'
  | 'PROMO_INVALID'
  | 'CARD_INVALID'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'IDEMPOTENT_CONFLICT'
  | 'IDEMPOTENT_IN_PROGRESS'
  | 'RESERVATION_EXPIRED'
  | 'INSUFFICIENT_STOCK'
  | 'BELOW_MOQ'
  | 'CHECKOUT_FAILED';

export type CheckoutResult =
  | { success: true; order: Order }
  | {
      success: false;
      error: Exclude<CheckoutErrorCode, 'RESERVATION_EXPIRED' | 'INSUFFICIENT_STOCK'>;
      promoError?: string;
      promoErrorCode?: string;
    }
  | { success: false; error: 'RESERVATION_EXPIRED'; reservationExpiresAt: string }
  | { success: false; error: 'INSUFFICIENT_STOCK'; productIds: string[] };

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
  auditContext: AuditContext;
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
  products: ProductRepository;
  audit: AuditWriter;
  inventory: InventoryService;
}

export interface CheckoutService {
  process(params: CheckoutParams): Promise<CheckoutResult>;
}
