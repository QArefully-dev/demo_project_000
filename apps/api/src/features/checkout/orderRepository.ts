import type Database from 'better-sqlite3';
import type { Order, OrderLineItem } from '@shop/contracts/orders';

interface OrderRow {
  id: number;
  promo_code_applied: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
}

interface OrderLineItemRow {
  product_id: number;
  product_name: string;
  product_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export interface CreateOrderParams {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  promoApplied: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  userId: number | null;
  items: OrderLineItem[];
  createdAt: string;
}

export interface OrderRepository {
  create(params: CreateOrderParams): number;
  findById(orderId: number): Order | undefined;
}

export function createOrderRepository(db: Database.Database): OrderRepository {
  return {
    create(params) {
      const result = db
        .prepare(
          `INSERT INTO orders (customer_name, customer_email, shipping_address, promo_code_applied, subtotal_cents, discount_cents, total_cents, user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.customerName,
          params.customerEmail,
          params.shippingAddress,
          params.promoApplied,
          params.subtotalCents,
          params.discountCents,
          params.totalCents,
          params.userId,
          params.createdAt,
        );
      const orderId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(
        `INSERT INTO order_line_items (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const item of params.items) {
        insertItem.run(
          orderId,
          item.productId,
          item.productName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        );
      }
      return orderId;
    },
    findById(orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
        OrderRow | undefined;
      if (!order) return undefined;
      const items = db
        .prepare('SELECT * FROM order_line_items WHERE order_id = ?')
        .all(orderId) as OrderLineItemRow[];
      return {
        id: String(order.id),
        items: items.map((item) => ({
          productId: String(item.product_id),
          productName: item.product_name,
          unitPriceCents: item.product_price_cents,
          quantity: item.quantity,
          lineTotalCents: item.line_total_cents,
        })),
        subtotalCents: order.subtotal_cents,
        discountCents: order.discount_cents,
        totalCents: order.total_cents,
        promoApplied: order.promo_code_applied,
        createdAt: order.created_at,
      };
    },
  };
}
