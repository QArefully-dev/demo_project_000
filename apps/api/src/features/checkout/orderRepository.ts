import type Database from 'better-sqlite3';
import type { Order, OrderLineItem } from '@shop/contracts/orders';
import type { PowderMixOrderItem } from '@shop/contracts/powderizer';

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
  mixItems: PowderMixOrderItem[];
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
      const insertMix = db.prepare(
        'INSERT INTO order_powder_mix_items (order_id, snapshot_json) VALUES (?, ?)',
      );
      for (const mix of params.mixItems) insertMix.run(orderId, JSON.stringify(mix));
      return orderId;
    },
    findById(orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
        OrderRow | undefined;
      if (!order) return undefined;
      const items = db
        .prepare('SELECT * FROM order_line_items WHERE order_id = ?')
        .all(orderId) as OrderLineItemRow[];
      const mixItems = db
        .prepare(
          'SELECT snapshot_json FROM order_powder_mix_items WHERE order_id = ? ORDER BY id ASC',
        )
        .all(orderId) as Array<{ snapshot_json: string }>;
      return {
        id: String(order.id),
        items: items.map((item) => ({
          productId: String(item.product_id),
          productName: item.product_name,
          unitPriceCents: item.product_price_cents,
          quantity: item.quantity,
          lineTotalCents: item.line_total_cents,
        })),
        mixItems: mixItems.map((row) => parseMixSnapshot(row.snapshot_json)),
        subtotalCents: order.subtotal_cents,
        discountCents: order.discount_cents,
        totalCents: order.total_cents,
        promoApplied: order.promo_code_applied,
        createdAt: order.created_at,
      };
    },
  };
}

function parseMixSnapshot(value: string): PowderMixOrderItem {
  try {
    const parsed = JSON.parse(value) as PowderMixOrderItem;
    if (
      !isRecord(parsed) ||
      !hasOnlyKeys(parsed, [
        'mixId',
        'components',
        'bagSizeGrams',
        'fineness',
        'customLabel',
        'priceVersion',
        'unitPriceCents',
        'quantity',
        'lineTotalCents',
        'snapshotVersion',
      ]) ||
      parsed.snapshotVersion !== 1 ||
      !isUuid(parsed.mixId) ||
      !Array.isArray(parsed.components) ||
      parsed.components.length < 2 ||
      parsed.components.length > 5 ||
      ![250, 500, 1000].includes(parsed.bagSizeGrams) ||
      !['coarse', 'standard', 'fine'].includes(parsed.fineness) ||
      !(typeof parsed.customLabel === 'string' || parsed.customLabel === null) ||
      (typeof parsed.customLabel === 'string' && parsed.customLabel.length > 160) ||
      parsed.priceVersion !== 'powderizer-v1' ||
      !isNonNegativeInteger(parsed.unitPriceCents) ||
      !isNonNegativeInteger(parsed.quantity) ||
      parsed.quantity < 1 ||
      !isNonNegativeInteger(parsed.lineTotalCents) ||
      parsed.lineTotalCents !== parsed.unitPriceCents * parsed.quantity ||
      parsed.components.some(
        (component) =>
          !isRecord(component) ||
          !hasOnlyKeys(component, ['productId', 'productName', 'percentage', 'allocatedGrams']) ||
          !isPositiveIntegerString(component.productId) ||
          typeof component.productName !== 'string' ||
          component.productName.length < 1 ||
          component.productName.length > 200 ||
          !isNonNegativeInteger(component.percentage) ||
          component.percentage < 1 ||
          component.percentage > 100 ||
          !isNonNegativeInteger(component.allocatedGrams) ||
          component.allocatedGrams < 1,
      )
    )
      throw new Error('Invalid order mix snapshot');
    return parsed;
  } catch {
    throw new Error('Invalid order mix snapshot');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
