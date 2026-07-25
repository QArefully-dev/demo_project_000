import type Database from 'better-sqlite3';
import { MIXING_GROUPS } from '@shop/catalog';

const SACK_WEIGHT_GRAMS = 25_000;
const supportedMixingGroupPlaceholders = MIXING_GROUPS.map(() => '?').join(', ');

export interface CustomBlendFactRow {
  product_id: number;
  product_name: string;
  product_description: string;
  mixing_group: string;
  variant_id: number;
  sku: string;
  label: string;
  weight_grams: number;
  price_cents: number;
  moq_sacks: number;
  compare_at_price_cents: number | null;
  stock_count: number;
  backorderable: number;
  backorder_lead_days: number | null;
  delivery_class: string;
  variant_active: number;
  sort_order: number;
}

export interface CustomBlendRepository {
  findEligibleVariant(variantId: number): CustomBlendFactRow | undefined;
  listCompatibleIngredients(base: CustomBlendFactRow): CustomBlendFactRow[];
}

const factColumns = `
  p.id AS product_id,
  p.name AS product_name,
  p.description AS product_description,
  p.mixing_group,
  pv.id AS variant_id,
  pv.sku,
  pv.label,
  pv.weight_grams,
  pv.price_cents,
  pv.moq_sacks,
  pv.compare_at_price_cents,
  pv.stock_count,
  pv.backorderable,
  pv.backorder_lead_days,
  pv.delivery_class,
  pv.active AS variant_active,
  pv.sort_order`;

const eligibleLotPredicate = `
  p.active = 1
  AND pv.active = 1
  AND pv.sort_order = 1
  AND pv.weight_grams = ${SACK_WEIGHT_GRAMS}
  AND p.mixing_group IN (${supportedMixingGroupPlaceholders})`;

/** Resolves only public, active, supported 25 kg Custom Blend lots. */
export function createCustomBlendRepository(db: Database.Database): CustomBlendRepository {
  return {
    findEligibleVariant(variantId) {
      return db
        .prepare(
          `SELECT ${factColumns}
           FROM product_variants pv
           INNER JOIN products p ON p.id = pv.product_id
           WHERE pv.id = ? AND ${eligibleLotPredicate}`,
        )
        .get(variantId, ...MIXING_GROUPS) as CustomBlendFactRow | undefined;
    },
    listCompatibleIngredients(base) {
      return db
        .prepare(
          `SELECT ${factColumns}
           FROM product_variants pv
           INNER JOIN products p ON p.id = pv.product_id
           WHERE ${eligibleLotPredicate}
             AND p.mixing_group = ?
             AND pv.id != ?
           ORDER BY p.mixing_group COLLATE NOCASE ASC,
                    p.name COLLATE NOCASE ASC,
                    pv.id ASC`,
        )
        .all(...MIXING_GROUPS, base.mixing_group, base.variant_id) as CustomBlendFactRow[];
    },
  };
}
