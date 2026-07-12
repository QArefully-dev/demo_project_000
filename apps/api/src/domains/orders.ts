import type Database from 'better-sqlite3';
import { getDb } from '../db/index.js';
import { getCart } from './cart.js';
import { validatePromoCode, calculateDiscount, recordRedemption } from './promo.js';

export interface OrderResult {
  id: string;
  items: {
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promoApplied: string | null;
  createdAt: string;
}

export interface PlaceOrderParams {
  cartId: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
}

export type PlaceOrderError = 'CART_NOT_FOUND' | 'CART_EMPTY' | 'PROMO_INVALID';

/**
 * Parameters for writing an order inside an existing transaction.
 * Callers must manage the transaction boundary.
 */
export interface CreateOrderTxParams {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  promoApplied: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  userId: number | null;
  items: {
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  createdAt: string;
}

/**
 * Write an order and its line items within an existing transaction.
 * Returns the new order's integer ID. Does NOT record redemption or delete the cart —
 * those operations belong to the caller's transaction scope.
 */
export function createOrderInTransaction(
  db: Database.Database,
  params: CreateOrderTxParams,
): number {
  const orderResult = db
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

  const orderId = Number(orderResult.lastInsertRowid);

  for (const item of params.items) {
    db.prepare(
      `INSERT INTO order_line_items (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      orderId,
      item.productId,
      item.productName,
      item.unitPriceCents,
      item.quantity,
      item.lineTotalCents,
    );
  }

  return orderId;
}

/** Place an order from a cart. Computes all totals server-side, writes order + line items in a transaction, clears the cart. Single promo code only — no stacking: by design only one promo code can apply per order. */
export function placeOrder(params: PlaceOrderParams): OrderResult | PlaceOrderError {
  const db = getDb();
  const cart = getCart(params.cartId);
  if (!cart) return 'CART_NOT_FOUND';
  if (cart.items.length === 0) return 'CART_EMPTY';

  // Capture cart values before transaction (acceptable for single-user demo scope)
  const cartItems = cart.items;
  const subtotalCents = cart.subtotalCents;

  let discountCents = 0;
  let promoApplied: string | null = null;

  if (params.promoCode) {
    const promoResult = validatePromoCode({
      code: params.promoCode,
      cartId: params.cartId,
      userId: null, // legacy path: anonymous guest
    });
    if (!promoResult.valid) return 'PROMO_INVALID';
    discountCents = calculateDiscount({
      promo: promoResult.promoCode!,
      subtotalCents,
    });
    promoApplied = params.promoCode;
  }

  const totalCents = subtotalCents - discountCents;
  const createdAt = new Date().toISOString();

  const placeOrderTx = db.transaction(() => {
    const orderId = createOrderInTransaction(db, {
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      shippingAddress: params.shippingAddress,
      promoApplied,
      subtotalCents,
      discountCents,
      totalCents,
      userId: null,
      items: cartItems.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        unitPriceCents: item.product.priceCents,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      })),
      createdAt,
    });

    // Record promo redemption if applicable
    if (promoApplied) {
      recordRedemption({
        db,
        promo: { code: promoApplied },
        userId: null,
        orderId,
      });
    }

    // ON DELETE CASCADE on carts.id handles cart_line_items cleanup automatically
    db.prepare('DELETE FROM carts WHERE id = ?').run(params.cartId);

    return orderId;
  });

  const orderId = placeOrderTx();

  return {
    id: String(orderId),
    items: cartItems.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      unitPriceCents: item.product.priceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
    subtotalCents,
    discountCents,
    totalCents,
    promoApplied,
    createdAt,
  };
}

/** Retrieve a completed order by ID. Returns undefined if not found. */
export function getOrder(orderId: number): OrderResult | undefined {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
    | {
        id: number;
        customer_name: string;
        customer_email: string;
        shipping_address: string;
        promo_code_applied: string | null;
        subtotal_cents: number;
        discount_cents: number;
        total_cents: number;
        created_at: string;
      }
    | undefined;

  if (!order) return undefined;

  const lineItems = db
    .prepare('SELECT * FROM order_line_items WHERE order_id = ?')
    .all(orderId) as {
    product_id: number;
    product_name: string;
    product_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }[];

  return {
    id: String(order.id),
    items: lineItems.map((li) => ({
      productId: String(li.product_id),
      productName: li.product_name,
      unitPriceCents: li.product_price_cents,
      quantity: li.quantity,
      lineTotalCents: li.line_total_cents,
    })),
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    totalCents: order.total_cents,
    promoApplied: order.promo_code_applied,
    createdAt: order.created_at,
  };
}
