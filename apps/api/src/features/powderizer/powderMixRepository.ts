import type Database from 'better-sqlite3';
import {
  POWDER_MIX_BAG_COLOUR_SCHEME_VALUES,
  type PowderMixBagColourScheme,
  type PowderMixFineness,
  type PowderMixPriceVersion,
} from '@shop/contracts/powderizer';
import type { PowderMixAllocation, PowderMixStockRequirement } from './powderizerTypes.js';

export interface PowderMixRow {
  id: string;
  cart_id: string;
  quantity: number;
  bag_size_grams: number;
  fineness: PowderMixFineness;
  bag_colour_scheme: PowderMixBagColourScheme;
  custom_label: string | null;
  price_version: PowderMixPriceVersion;
  quoted_unit_price_cents: number;
  created_at: string;
  updated_at: string;
}

export interface PowderMixComponentRow {
  mix_id: string;
  product_id: number;
  percentage: number;
  allocated_grams: number;
}

export interface CartPowderMixRow extends PowderMixRow {
  components: Array<
    PowderMixComponentRow & {
      product_name: string;
    }
  >;
}

export interface NewPowderMix {
  id: string;
  cartId: string;
  quantity: number;
  bagSizeGrams: number;
  fineness: PowderMixFineness;
  bagColourScheme: PowderMixBagColourScheme;
  customLabel: string | null;
  priceVersion: PowderMixPriceVersion;
  quotedUnitPriceCents: number;
  allocations: readonly PowderMixAllocation[];
}

interface StoredPowderMixRow extends Omit<
  PowderMixRow,
  'bag_colour_scheme' | 'fineness' | 'price_version'
> {
  bag_colour_scheme: unknown;
  fineness: unknown;
  price_version: unknown;
}

function parseBagColourScheme(value: unknown): PowderMixBagColourScheme {
  for (const scheme of POWDER_MIX_BAG_COLOUR_SCHEME_VALUES) {
    if (value === scheme) return scheme;
  }
  throw new Error('Invalid persisted powder mix bag colour scheme.');
}

function parseFineness(value: unknown): PowderMixFineness {
  if (value === 'coarse' || value === 'standard' || value === 'fine') return value;
  throw new Error('Invalid persisted powder mix fineness.');
}

function parsePriceVersion(value: unknown): PowderMixPriceVersion {
  if (value === 'powderizer-v1') return value;
  throw new Error('Invalid persisted powder mix price version.');
}

function hydratePowderMixRow(row: StoredPowderMixRow): PowderMixRow {
  return {
    ...row,
    bag_colour_scheme: parseBagColourScheme(row.bag_colour_scheme),
    fineness: parseFineness(row.fineness),
    price_version: parsePriceVersion(row.price_version),
  };
}

export interface PowderMixRepository {
  find(cartId: string, mixId: string): PowderMixRow | undefined;
  listForCart(cartId: string): CartPowderMixRow[];
  listComponents(mixId: string): PowderMixComponentRow[];
  create(mix: NewPowderMix): void;
  replace(mixId: string, mix: Omit<NewPowderMix, 'id' | 'cartId' | 'quantity'>): boolean;
  updateQuote(mixId: string, mix: Omit<NewPowderMix, 'id' | 'cartId' | 'quantity'>): boolean;
  updateQuantity(cartId: string, mixId: string, quantity: number): boolean;
  remove(cartId: string, mixId: string): boolean;
  reserveStock(
    paymentIdempotencyKey: string,
    requirements: readonly PowderMixStockRequirement[],
  ): void;
  releaseStockReservation(paymentIdempotencyKey: string): void;
  reservedStock(productId: number): number;
  consumeReservedStock(paymentIdempotencyKey: string): void;
}

/** Direct persistence for cart-scoped powder mixes; callers own transaction boundaries. */
export function createPowderMixRepository(db: Database.Database): PowderMixRepository {
  const insertComponent = db.prepare(
    `INSERT INTO powder_mix_components (mix_id, product_id, percentage, allocated_grams)
     VALUES (?, ?, ?, ?)`,
  );

  function replaceComponents(mixId: string, allocations: readonly PowderMixAllocation[]): void {
    db.prepare('DELETE FROM powder_mix_components WHERE mix_id = ?').run(mixId);
    for (const allocation of allocations) {
      insertComponent.run(
        mixId,
        allocation.productId,
        allocation.percentage,
        allocation.allocatedGrams,
      );
    }
  }

  return {
    find(cartId, mixId) {
      const row = db
        .prepare('SELECT * FROM powder_mixes WHERE cart_id = ? AND id = ?')
        .get(cartId, mixId) as StoredPowderMixRow | undefined;
      return row ? hydratePowderMixRow(row) : undefined;
    },
    listForCart(cartId) {
      const rows = db
        .prepare(
          `SELECT m.*, c.product_id, c.percentage, c.allocated_grams, p.name AS product_name
           FROM powder_mixes m
           JOIN powder_mix_components c ON c.mix_id = m.id
           JOIN products p ON p.id = c.product_id
           WHERE m.cart_id = ?
           ORDER BY m.created_at ASC, m.id ASC, c.product_id ASC`,
        )
        .all(cartId) as Array<
        StoredPowderMixRow & PowderMixComponentRow & { product_name: string }
      >;
      const mixes = new Map<string, CartPowderMixRow>();
      for (const row of rows) {
        const mix = mixes.get(row.id);
        const component = {
          mix_id: row.mix_id,
          product_id: row.product_id,
          percentage: row.percentage,
          allocated_grams: row.allocated_grams,
          product_name: row.product_name,
        };
        if (mix) {
          mix.components.push(component);
          continue;
        }
        mixes.set(row.id, {
          ...hydratePowderMixRow(row),
          components: [component],
        });
      }
      return [...mixes.values()];
    },
    listComponents(mixId) {
      return db
        .prepare('SELECT * FROM powder_mix_components WHERE mix_id = ? ORDER BY product_id ASC')
        .all(mixId) as PowderMixComponentRow[];
    },
    create(mix) {
      db.prepare(
        `INSERT INTO powder_mixes
          (id, cart_id, quantity, bag_size_grams, fineness, bag_colour_scheme, custom_label, price_version,
           quoted_unit_price_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ).run(
        mix.id,
        mix.cartId,
        mix.quantity,
        mix.bagSizeGrams,
        mix.fineness,
        mix.bagColourScheme,
        mix.customLabel,
        mix.priceVersion,
        mix.quotedUnitPriceCents,
      );
      replaceComponents(mix.id, mix.allocations);
    },
    replace(mixId, mix) {
      const result = db
        .prepare(
          `UPDATE powder_mixes
           SET bag_size_grams = ?, fineness = ?, bag_colour_scheme = ?, custom_label = ?, price_version = ?,
               quoted_unit_price_cents = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          mix.bagSizeGrams,
          mix.fineness,
          mix.bagColourScheme,
          mix.customLabel,
          mix.priceVersion,
          mix.quotedUnitPriceCents,
          mixId,
        );
      if (result.changes === 0) return false;
      replaceComponents(mixId, mix.allocations);
      return true;
    },
    updateQuote(mixId, mix) {
      return this.replace(mixId, mix);
    },
    updateQuantity(cartId, mixId, quantity) {
      return (
        db
          .prepare(
            `UPDATE powder_mixes SET quantity = ?, updated_at = datetime('now')
             WHERE cart_id = ? AND id = ?`,
          )
          .run(quantity, cartId, mixId).changes > 0
      );
    },
    remove(cartId, mixId) {
      return (
        db.prepare('DELETE FROM powder_mixes WHERE cart_id = ? AND id = ?').run(cartId, mixId)
          .changes > 0
      );
    },
    reserveStock(paymentIdempotencyKey, requirements) {
      const insert = db.prepare(
        `INSERT INTO powder_mix_stock_reservations
          (payment_idempotency_key, product_id, bag_equivalents) VALUES (?, ?, ?)`,
      );
      for (const requirement of requirements) {
        insert.run(paymentIdempotencyKey, requirement.productId, requirement.bagEquivalents);
      }
    },
    releaseStockReservation(paymentIdempotencyKey) {
      db.prepare('DELETE FROM powder_mix_stock_reservations WHERE payment_idempotency_key = ?').run(
        paymentIdempotencyKey,
      );
    },
    reservedStock(productId) {
      return (
        db
          .prepare(
            `SELECT COALESCE(SUM(bag_equivalents), 0) AS reserved
             FROM powder_mix_stock_reservations WHERE product_id = ?`,
          )
          .get(productId) as { reserved: number }
      ).reserved;
    },
    consumeReservedStock(paymentIdempotencyKey) {
      const reservations = db
        .prepare(
          `SELECT product_id, bag_equivalents FROM powder_mix_stock_reservations
           WHERE payment_idempotency_key = ?`,
        )
        .all(paymentIdempotencyKey) as Array<{ product_id: number; bag_equivalents: number }>;
      const decrement = db.prepare(
        `UPDATE products SET stock_count = stock_count - ? WHERE id = ? AND stock_count >= ?`,
      );
      for (const reservation of reservations) {
        if (
          decrement.run(
            reservation.bag_equivalents,
            reservation.product_id,
            reservation.bag_equivalents,
          ).changes !== 1
        ) {
          throw new Error('Reserved mix stock is no longer available.');
        }
      }
      db.prepare('DELETE FROM powder_mix_stock_reservations WHERE payment_idempotency_key = ?').run(
        paymentIdempotencyKey,
      );
    },
  };
}
