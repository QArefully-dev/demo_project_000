import type Database from 'better-sqlite3';
import type {
  NormalizedOrderPowderMixItem,
  Order,
  OrderDetailResponse,
  OrderLifecycleEvent,
  OrderLineItem,
  OrderShipment,
  OrderStatus,
  OrderSummary,
  ShipmentStatus,
} from '@shop/contracts/orders';
import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  parsePowderMixOrderItemSnapshot,
} from '@shop/contracts/powderizer';
import type { CreateOrderParams, LifecycleEventInput, PersistedShipment } from './orderTypes.js';

interface OrderRow {
  id: number;
  promo_code_applied: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  lifecycle_status: OrderStatus;
  version: number;
  cancelled_at: string | null;
  user_id: number | null;
}
interface ProductLineRow {
  id: number;
  product_id: number;
  product_name: string;
  product_price_cents: number;
  quantity: number;
  line_total_cents: number;
  allocated_quantity?: number | null;
  backordered_quantity?: number | null;
  cancelled_quantity?: number | null;
}
interface MixLineRow {
  id: number;
  snapshot_json: string;
}
interface ShipmentRow {
  id: number;
  order_id: number;
  shipment_number: number;
  status: ShipmentStatus;
  tracking_reference: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
interface EventRow {
  id: number;
  shipment_id: number | null;
  event_type: OrderLifecycleEvent['type'];
  tracking_code: OrderLifecycleEvent['code'];
  title: string;
  detail: string | null;
  location: string | null;
  occurred_at: string;
  idempotency_key: string | null;
  request_fingerprint: string | null;
}

export interface OrderAccessRepository {
  replaceAccessGrant(input: {
    orderId: number;
    tokenDigest: string;
    expiresAt: string;
    createdAt: string;
  }): void;
  hasValidAccessGrant(orderId: number, tokenDigest: string, now: string): boolean;
}

export interface OrderRepository extends OrderAccessRepository {
  create(params: CreateOrderParams): number;
  findById(orderId: number): Order | undefined;
  findDetailById(orderId: number): OrderDetailResponse | undefined;
  findOwnedDetail(orderId: number, userId: number): OrderDetailResponse | undefined;
  listOwned(
    userId: number,
    page: number,
    pageSize: number,
  ): { items: OrderSummary[]; total: number };
  getOrderState(
    orderId: number,
  ): { id: number; status: OrderStatus; version: number; cancelledAt: string | null } | undefined;
  getShipment(shipmentId: number): PersistedShipment | undefined;
  listShipments(orderId: number): PersistedShipment[];
  listAllocatableLines(
    orderId: number,
  ): Array<{ lineKind: 'product' | 'powder_mix'; lineId: string; quantity: number }>;
  hasOutstandingBackorder(orderId: number): boolean;
  insertShipment(input: {
    orderId: number;
    shipmentNumber: number;
    trackingReference: string | null;
    createdAt: string;
  }): number;
  insertShipmentLine(input: {
    shipmentId: number;
    lineId: number;
    lineKind: 'product' | 'powder_mix';
    quantity: number;
  }): void;
  updateShipmentStatus(input: {
    shipmentId: number;
    expectedVersion: number;
    status: ShipmentStatus;
    updatedAt: string;
  }): boolean;
  touchShipment(input: { shipmentId: number; expectedVersion: number; updatedAt: string }): boolean;
  updateOrderStatus(input: {
    orderId: number;
    expectedVersion: number;
    status: OrderStatus;
    cancelledAt?: string | null;
  }): boolean;
  cancelPackedShipments(orderId: number, updatedAt: string): void;
  insertEvent(input: LifecycleEventInput): number;
  findEventByIdempotencyKey(
    key: string,
  ): { orderId: number; requestFingerprint: string } | undefined;
}

function parseMixSnapshot(value: string): NormalizedOrderPowderMixItem {
  try {
    const parsed = parsePowderMixOrderItemSnapshot(JSON.parse(value));
    return parsed.snapshotVersion === 1
      ? {
          ...parsed,
          bagColourScheme: DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
          usageLabel: 'Check ingredient labels',
        }
      : parsed;
  } catch {
    throw new Error('Invalid order mix snapshot');
  }
}

function mapOrder(row: OrderRow, items: ProductLineRow[], mixes: MixLineRow[]): Order {
  return {
    id: String(row.id),
    status: row.lifecycle_status,
    version: row.version,
    items: items.map((item): OrderLineItem => ({
      lineId: String(item.id),
      productId: String(item.product_id),
      productName: item.product_name,
      unitPriceCents: item.product_price_cents,
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
      inventoryStatus:
        (item.cancelled_quantity ?? 0) > 0
          ? 'cancelled'
          : (item.backordered_quantity ?? 0) === 0
            ? 'allocated'
            : (item.allocated_quantity ?? 0) === 0
              ? 'backordered'
              : 'partially_backordered',
      allocatedQuantity: item.allocated_quantity ?? item.quantity,
      backorderedQuantity: item.backordered_quantity ?? 0,
    })),
    mixItems: mixes.map((mix) => ({
      ...parseMixSnapshot(mix.snapshot_json),
      lineId: String(mix.id),
    })),
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    promoApplied: row.promo_code_applied,
    createdAt: row.created_at,
  };
}

function mapShipment(
  row: ShipmentRow,
  lines: Array<{ line_kind: 'product' | 'powder_mix'; line_id: number; quantity: number }>,
): OrderShipment {
  return {
    id: String(row.id),
    shipmentNumber: row.shipment_number,
    status: row.status,
    trackingReference: row.tracking_reference,
    version: row.version,
    lines: lines.map((line) => ({
      lineKind: line.line_kind,
      lineId: String(line.line_id),
      quantity: line.quantity,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrderRepository(db: Database.Database): OrderRepository {
  const loadOrder = (orderId: number): OrderRow | undefined =>
    db
      .prepare(
        `SELECT id, promo_code_applied, subtotal_cents, discount_cents, total_cents, created_at,
            lifecycle_status, version, cancelled_at, user_id FROM orders WHERE id = ?`,
      )
      .get(orderId) as OrderRow | undefined;
  const loadLines = (orderId: number) => ({
    items: db
      .prepare(
        `SELECT line.id, line.product_id, line.product_name, line.product_price_cents, line.quantity, line.line_total_cents,
          allocation.allocated_quantity, allocation.backordered_quantity, allocation.cancelled_quantity
         FROM order_line_items line
         LEFT JOIN order_inventory_allocations allocation ON allocation.order_line_item_id = line.id
         WHERE line.order_id = ? ORDER BY line.id ASC`,
      )
      .all(orderId) as ProductLineRow[],
    mixes: db
      .prepare(
        'SELECT id, snapshot_json FROM order_powder_mix_items WHERE order_id = ? ORDER BY id ASC',
      )
      .all(orderId) as MixLineRow[],
  });
  const loadShipments = (orderId: number): ShipmentRow[] =>
    db
      .prepare(
        'SELECT id, order_id, shipment_number, status, tracking_reference, version, created_at, updated_at FROM order_shipments WHERE order_id = ? ORDER BY shipment_number ASC, id ASC',
      )
      .all(orderId) as ShipmentRow[];
  const findDetail = (orderId: number): OrderDetailResponse | undefined => {
    const row = loadOrder(orderId);
    if (!row) return undefined;
    const lines = loadLines(orderId);
    const shipments = loadShipments(orderId);
    const shipmentLines = db
      .prepare(
        `SELECT shipment_id, order_line_item_id, order_powder_mix_item_id, quantity FROM order_shipment_items WHERE shipment_id IN (SELECT id FROM order_shipments WHERE order_id = ?) ORDER BY shipment_id ASC, order_line_item_id ASC, order_powder_mix_item_id ASC`,
      )
      .all(orderId) as Array<{
      shipment_id: number;
      order_line_item_id: number | null;
      order_powder_mix_item_id: number | null;
      quantity: number;
    }>;
    const events = db
      .prepare(
        `SELECT id, shipment_id, event_type, tracking_code, title, detail, location, occurred_at, idempotency_key, request_fingerprint FROM order_lifecycle_events WHERE order_id = ? ORDER BY occurred_at ASC, id ASC`,
      )
      .all(orderId) as EventRow[];
    return {
      ...mapOrder(row, lines.items, lines.mixes),
      shipments: shipments.map((shipment) =>
        mapShipment(
          shipment,
          shipmentLines
            .filter((line) => line.shipment_id === shipment.id)
            .map((line) =>
              line.order_line_item_id === null
                ? {
                    line_kind: 'powder_mix',
                    line_id: line.order_powder_mix_item_id!,
                    quantity: line.quantity,
                  }
                : {
                    line_kind: 'product',
                    line_id: line.order_line_item_id,
                    quantity: line.quantity,
                  },
            ),
        ),
      ),
      events: events.map((event) => ({
        id: String(event.id),
        shipmentId: event.shipment_id === null ? null : String(event.shipment_id),
        type: event.event_type,
        code: event.tracking_code,
        title: event.title,
        detail: event.detail,
        location: event.location,
        occurredAt: event.occurred_at,
      })),
      canCancel:
        (row.lifecycle_status === 'processing' || row.lifecycle_status === 'packed') &&
        shipments.every((shipment) => shipment.status === 'packed'),
    };
  };
  return {
    create(params) {
      const result = db
        .prepare(
          `INSERT INTO orders (customer_name, customer_email, shipping_address, promo_code_applied, subtotal_cents, discount_cents, total_cents, user_id, created_at, lifecycle_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 0)`,
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
      const addItem = db.prepare(
        'INSERT INTO order_line_items (order_id, product_id, product_name, product_price_cents, quantity, line_total_cents) VALUES (?, ?, ?, ?, ?, ?)',
      );
      for (const item of params.items)
        addItem.run(
          orderId,
          item.productId,
          item.productName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        );
      const addMix = db.prepare(
        'INSERT INTO order_powder_mix_items (order_id, snapshot_json) VALUES (?, ?)',
      );
      for (const mix of params.mixItems) addMix.run(orderId, JSON.stringify(mix));
      db.prepare(
        `INSERT INTO order_lifecycle_events (order_id, event_type, title, occurred_at) VALUES (?, 'order_created', 'Order created', ?)`,
      ).run(orderId, params.createdAt);
      return orderId;
    },
    findById(orderId) {
      const row = loadOrder(orderId);
      if (!row) return undefined;
      const lines = loadLines(orderId);
      return mapOrder(row, lines.items, lines.mixes);
    },
    findDetailById: findDetail,
    findOwnedDetail(orderId, userId) {
      const row = db
        .prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?')
        .get(orderId, userId) as { id: number } | undefined;
      return row ? findDetail(orderId) : undefined;
    },
    listOwned(userId, page, pageSize) {
      const offset = (page - 1) * pageSize;
      const items = db
        .prepare(
          `SELECT o.id, o.lifecycle_status, o.version, o.total_cents, o.created_at,
          COALESCE((SELECT SUM(quantity) FROM order_line_items WHERE order_id = o.id), 0) +
          COALESCE((SELECT SUM(CAST(json_extract(snapshot_json, '$.quantity') AS INTEGER)) FROM order_powder_mix_items WHERE order_id = o.id), 0) AS total_items,
          EXISTS(SELECT 1 FROM order_inventory_allocations allocation
            JOIN order_line_items line ON line.id = allocation.order_line_item_id
            WHERE line.order_id = o.id AND allocation.backordered_quantity > 0) AS has_backorder
        FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
        )
        .all(userId, pageSize, offset) as Array<{
        id: number;
        lifecycle_status: OrderStatus;
        version: number;
        total_cents: number;
        total_items: number;
        has_backorder: number;
        created_at: string;
      }>;
      const count = db
        .prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?')
        .get(userId) as { count: number };
      return {
        items: items.map((row) => ({
          id: String(row.id),
          status: row.lifecycle_status,
          version: row.version,
          totalCents: row.total_cents,
          totalItems: row.total_items,
          hasBackorder: row.has_backorder === 1,
          createdAt: row.created_at,
        })),
        total: count.count,
      };
    },
    getOrderState(orderId) {
      const row = loadOrder(orderId);
      return (
        row && {
          id: row.id,
          status: row.lifecycle_status,
          version: row.version,
          cancelledAt: row.cancelled_at,
        }
      );
    },
    getShipment(shipmentId) {
      const row = db
        .prepare(
          'SELECT id, order_id, shipment_number, status, tracking_reference, version, created_at, updated_at FROM order_shipments WHERE id = ?',
        )
        .get(shipmentId) as ShipmentRow | undefined;
      return (
        row && {
          id: row.id,
          orderId: row.order_id,
          shipmentNumber: row.shipment_number,
          status: row.status,
          trackingReference: row.tracking_reference,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      );
    },
    listShipments(orderId) {
      return loadShipments(orderId).map((row) => ({
        id: row.id,
        orderId: row.order_id,
        shipmentNumber: row.shipment_number,
        status: row.status,
        trackingReference: row.tracking_reference,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    listAllocatableLines(orderId) {
      const product = db
        .prepare(
          `SELECT line.id, COALESCE(allocation.allocated_quantity, line.quantity) AS quantity
           FROM order_line_items line
           LEFT JOIN order_inventory_allocations allocation ON allocation.order_line_item_id = line.id
           WHERE line.order_id = ? ORDER BY line.id`,
        )
        .all(orderId) as Array<{ id: number; quantity: number }>;
      const mix = db
        .prepare(
          'SELECT id, snapshot_json FROM order_powder_mix_items WHERE order_id = ? ORDER BY id',
        )
        .all(orderId) as MixLineRow[];
      return [
        ...product.map((line) => ({
          lineKind: 'product' as const,
          lineId: String(line.id),
          quantity: line.quantity,
        })),
        ...mix.map((line) => ({
          lineKind: 'powder_mix' as const,
          lineId: String(line.id),
          quantity: parseMixSnapshot(line.snapshot_json).quantity,
        })),
      ];
    },
    hasOutstandingBackorder(orderId) {
      return !!db
        .prepare(
          `SELECT 1 FROM order_inventory_allocations allocation
           JOIN order_line_items line ON line.id = allocation.order_line_item_id
           WHERE line.order_id = ? AND allocation.backordered_quantity > 0 LIMIT 1`,
        )
        .get(orderId);
    },
    insertShipment({ orderId, shipmentNumber, trackingReference, createdAt }) {
      return Number(
        db
          .prepare(
            `INSERT INTO order_shipments (order_id, shipment_number, status, tracking_reference, version, created_at, updated_at) VALUES (?, ?, 'packed', ?, 0, ?, ?)`,
          )
          .run(orderId, shipmentNumber, trackingReference, createdAt, createdAt).lastInsertRowid,
      );
    },
    insertShipmentLine({ shipmentId, lineId, lineKind, quantity }) {
      if (lineKind === 'product')
        db.prepare(
          'INSERT INTO order_shipment_items (shipment_id, order_line_item_id, quantity) VALUES (?, ?, ?)',
        ).run(shipmentId, lineId, quantity);
      else
        db.prepare(
          'INSERT INTO order_shipment_items (shipment_id, order_powder_mix_item_id, quantity) VALUES (?, ?, ?)',
        ).run(shipmentId, lineId, quantity);
    },
    updateShipmentStatus({ shipmentId, expectedVersion, status, updatedAt }) {
      return (
        db
          .prepare(
            'UPDATE order_shipments SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
          )
          .run(status, updatedAt, shipmentId, expectedVersion).changes === 1
      );
    },
    touchShipment({ shipmentId, expectedVersion, updatedAt }) {
      return (
        db
          .prepare(
            'UPDATE order_shipments SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
          )
          .run(updatedAt, shipmentId, expectedVersion).changes === 1
      );
    },
    updateOrderStatus({ orderId, expectedVersion, status, cancelledAt = null }) {
      return (
        db
          .prepare(
            'UPDATE orders SET lifecycle_status = ?, cancelled_at = ?, version = version + 1 WHERE id = ? AND version = ?',
          )
          .run(status, cancelledAt, orderId, expectedVersion).changes === 1
      );
    },
    cancelPackedShipments(orderId, updatedAt) {
      db.prepare(
        "UPDATE order_shipments SET status = 'cancelled', version = version + 1, updated_at = ? WHERE order_id = ? AND status = 'packed'",
      ).run(updatedAt, orderId);
    },
    insertEvent(input) {
      return Number(
        db
          .prepare(
            'INSERT INTO order_lifecycle_events (order_id, shipment_id, event_type, tracking_code, title, detail, location, idempotency_key, request_fingerprint, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            input.orderId,
            input.shipmentId ?? null,
            input.type,
            input.code ?? null,
            input.title,
            input.detail ?? null,
            input.location ?? null,
            input.idempotencyKey ?? null,
            input.requestFingerprint ?? null,
            input.occurredAt,
          ).lastInsertRowid,
      );
    },
    findEventByIdempotencyKey(key) {
      const row = db
        .prepare(
          'SELECT order_id, request_fingerprint FROM order_lifecycle_events WHERE idempotency_key = ?',
        )
        .get(key) as { order_id: number; request_fingerprint: string } | undefined;
      return row && { orderId: row.order_id, requestFingerprint: row.request_fingerprint };
    },
    replaceAccessGrant({ orderId, tokenDigest, expiresAt, createdAt }) {
      db.prepare('DELETE FROM order_access_grants WHERE order_id = ?').run(orderId);
      db.prepare(
        'INSERT INTO order_access_grants (order_id, token_digest, expires_at, created_at) VALUES (?, ?, ?, ?)',
      ).run(orderId, tokenDigest, expiresAt, createdAt);
    },
    hasValidAccessGrant(orderId, tokenDigest, now) {
      return Boolean(
        db
          .prepare(
            'SELECT 1 FROM order_access_grants WHERE order_id = ? AND token_digest = ? AND expires_at > ?',
          )
          .get(orderId, tokenDigest, now),
      );
    },
  };
}
