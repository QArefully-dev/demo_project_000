import type Database from 'better-sqlite3';
import {
  CATALOG_SPECIFICATION_DEFINITIONS,
  CATALOG_SPECIFICATION_GROUPS,
} from './catalogSpecifications.js';
import type { CatalogSpecificationDefinition } from './catalogSpecifications.js';
import type {
  ProductFilterOptionsResponse,
  ProductQuery,
  ProductSpecificationGroup,
  ProductTag,
} from '@shop/contracts/products';
import { availableToSellSql, buildCatalogPredicate, catalogOrderBy } from './catalogSql.js';
import { normalizeCatalogQuery } from './catalogQuery.js';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  available_to_sell?: number;
  backorderable?: number;
  backorder_lead_days?: number | null;
  image_set_id: string | null;
  slug: string;
  compare_at_price_cents: number | null;
  sales_count: number;
  active: number;
  created_at: string;
  consumption_classification: string;
  mixing_group: string | null;
  details_json: string | null;
  default_variant_id: number | null;
  blend_source_variant_id: number | null;
  has_active_clearance?: number;
}

export interface CustomerProductRow extends ProductRow {
  tags: ProductTag[];
  specificationGroups: ProductSpecificationGroup[];
}

export interface VariantRow {
  id: number;
  product_id: number;
  sku: string;
  label: string;
  weight_grams: number;
  price_cents: number;
  moq_sacks: number;
  compare_at_price_cents: number | null;
  clearance_price_cents: number | null;
  clearance_starts_at: string | null;
  clearance_ends_at: string | null;
  stock_count: number;
  backorderable: number;
  backorder_lead_days: number | null;
  delivery_class: string;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductList {
  items: CustomerProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductRepository {
  list(query: ProductQuery, now?: string): ProductList;
  listFilterOptions(): ProductFilterOptionsResponse;
  findById(id: number): ProductRow | undefined;
  findActiveById(id: number, now?: string): CustomerProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number, now?: string): CustomerProductRow[];
  listByIds(ids: readonly number[], now?: string): CustomerProductRow[];
  listActiveCandidatesExcluding(sourceId: number, now?: string): CustomerProductRow[];
  findAllVariants(productId: number): VariantRow[];
  findVariantById(variantId: number): VariantRow | undefined;
  findVariantsByIds(variantIds: readonly number[]): VariantRow[];
  findDefaultVariant(productId: number): VariantRow | undefined;
}

export function createProductRepository(db: Database.Database): ProductRepository {
  const currentTime = (now?: string): string => now ?? new Date().toISOString();
  const customerColumns = `p.*, ${availableToSellSql} AS available_to_sell`;

  function hydrateCustomerRows(rows: readonly ProductRow[]): CustomerProductRow[] {
    if (rows.length === 0) return [];
    const productIds = [...new Set(rows.map((row) => row.id))];
    const placeholders = productIds.map(() => '?').join(', ');
    const tagRows = db
      .prepare(
        `SELECT pt.product_id, ct.key, ct.label
         FROM product_tags pt
         INNER JOIN catalog_tags ct ON ct.key = pt.tag_key
         WHERE pt.product_id IN (${placeholders})
         ORDER BY ct.label COLLATE NOCASE ASC, ct.key ASC`,
      )
      .all(...productIds) as Array<{ product_id: number; key: string; label: string }>;
    const specificationRows = db
      .prepare(
        `SELECT product_id, specification_key, value_key, display_value
         FROM product_specifications
         WHERE product_id IN (${placeholders})`,
      )
      .all(...productIds) as Array<{
      product_id: number;
      specification_key: string;
      value_key: string;
      display_value: string;
    }>;
    const tagsByProduct = new Map<number, ProductTag[]>();
    for (const tag of tagRows) {
      const tags = tagsByProduct.get(tag.product_id) ?? [];
      tags.push({ key: tag.key, label: tag.label });
      tagsByProduct.set(tag.product_id, tags);
    }
    const specificationsByProduct = new Map<
      number,
      Map<string, ProductSpecificationGroup['specifications']>
    >();
    for (const specification of specificationRows) {
      const definition = (
        CATALOG_SPECIFICATION_DEFINITIONS as readonly CatalogSpecificationDefinition[]
      ).find((candidate) => candidate.key === specification.specification_key);
      if (!definition) continue;
      const productSpecifications =
        specificationsByProduct.get(specification.product_id) ??
        new Map<string, ProductSpecificationGroup['specifications']>();
      const groupSpecifications = productSpecifications.get(definition.group) ?? [];
      groupSpecifications.push({
        key: definition.key,
        label: definition.label,
        valueKey: specification.value_key,
        value: specification.display_value,
      });
      productSpecifications.set(definition.group, groupSpecifications);
      specificationsByProduct.set(specification.product_id, productSpecifications);
    }
    return rows.map((row) => {
      const groupedSpecifications = specificationsByProduct.get(row.id);
      const specificationGroups = CATALOG_SPECIFICATION_GROUPS.flatMap((group) => {
        const specifications = groupedSpecifications?.get(group.key);
        if (!specifications?.length) return [];
        specifications.sort((left, right) => {
          const leftDef = (
            CATALOG_SPECIFICATION_DEFINITIONS as readonly CatalogSpecificationDefinition[]
          ).find((d) => d.key === left.key)!;
          const rightDef = (
            CATALOG_SPECIFICATION_DEFINITIONS as readonly CatalogSpecificationDefinition[]
          ).find((d) => d.key === right.key)!;
          return leftDef.order - rightDef.order || left.key.localeCompare(right.key);
        });
        return [{ key: group.key, label: group.label, order: group.order, specifications }];
      });
      return { ...row, tags: tagsByProduct.get(row.id) ?? [], specificationGroups };
    });
  }

  return {
    list(query, now) {
      const at = currentTime(now);
      const normalized = normalizeCatalogQuery(query);
      const predicate = buildCatalogPredicate(normalized, at);
      const total = (
        db
          .prepare(`SELECT COUNT(*) AS count FROM products p ${predicate.where}`)
          .get(...predicate.params) as {
          count: number;
        }
      ).count;
      const items = db
        .prepare(
          `SELECT ${customerColumns},
             EXISTS (
               SELECT 1 FROM product_variants pv
               WHERE pv.product_id = p.id
                 AND pv.active = 1
                 AND pv.clearance_price_cents IS NOT NULL
                 AND pv.clearance_price_cents > 0
                 AND pv.clearance_price_cents < pv.price_cents
                 AND pv.clearance_starts_at IS NOT NULL
                 AND pv.clearance_ends_at IS NOT NULL
                 AND julianday(pv.clearance_starts_at) < julianday(pv.clearance_ends_at)
                 AND julianday(pv.clearance_starts_at) <= julianday(?)
                 AND julianday(pv.clearance_ends_at) > julianday(?)
             ) AS has_active_clearance
           FROM products p ${predicate.where} ${catalogOrderBy(normalized.sort)} LIMIT ? OFFSET ?`,
        )
        .all(
          at,
          at,
          at,
          ...predicate.params,
          normalized.pageSize,
          (normalized.page - 1) * normalized.pageSize,
        ) as ProductRow[];
      return {
        items: hydrateCustomerRows(items),
        total,
        page: normalized.page,
        pageSize: normalized.pageSize,
      };
    },
    listFilterOptions() {
      const tags = db
        .prepare(
          `SELECT DISTINCT ct.key, ct.label
           FROM catalog_tags ct
           INNER JOIN product_tags pt ON pt.tag_key = ct.key
           INNER JOIN products p ON p.id = pt.product_id
           WHERE p.active = 1
           ORDER BY ct.label COLLATE NOCASE ASC, ct.key ASC`,
        )
        .all() as ProductFilterOptionsResponse['tags'];
      const values = db
        .prepare(
          `SELECT DISTINCT ps.specification_key, ps.value_key, ps.display_value
           FROM product_specifications ps
           INNER JOIN products p ON p.id = ps.product_id
           WHERE p.active = 1`,
        )
        .all() as Array<{
        specification_key: string;
        value_key: string;
        display_value: string;
      }>;
      const valuesBySpecification = new Map<string, Map<string, string>>();
      for (const value of values) {
        const definition = (
          CATALOG_SPECIFICATION_DEFINITIONS as readonly CatalogSpecificationDefinition[]
        ).find((candidate) => candidate.key === value.specification_key);
        if (!definition?.filterable) continue;
        const specificationValues =
          valuesBySpecification.get(definition.key) ?? new Map<string, string>();
        specificationValues.set(value.value_key, value.display_value);
        valuesBySpecification.set(definition.key, specificationValues);
      }
      const specificationGroups = CATALOG_SPECIFICATION_GROUPS.flatMap((group) => {
        const specifications = (
          CATALOG_SPECIFICATION_DEFINITIONS as readonly CatalogSpecificationDefinition[]
        ).flatMap((definition) => {
          if (definition.group !== group.key || !definition.filterable) return [];
          const valuesForDefinition = valuesBySpecification.get(definition.key);
          if (!valuesForDefinition?.size) return [];
          return [
            {
              key: definition.key,
              label: definition.label,
              values: [...valuesForDefinition]
                .sort(
                  ([leftKey, leftLabel], [rightKey, rightLabel]) =>
                    leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' }) ||
                    leftKey.localeCompare(rightKey),
                )
                .map(([key, label]) => ({ key, label })),
            },
          ];
        });
        return specifications.length
          ? [{ key: group.key, label: group.label, order: group.order, specifications }]
          : [];
      });
      return { tags, specificationGroups };
    },
    findById(id) {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
    },
    findActiveById(id, now) {
      const row = db
        .prepare(`SELECT ${customerColumns} FROM products p WHERE p.id = ? AND p.active = 1`)
        .get(currentTime(now), id) as ProductRow | undefined;
      return row ? hydrateCustomerRows([row])[0] : undefined;
    },
    listCategories() {
      return (
        db
          .prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category ASC')
          .all() as {
          category: string;
        }[]
      ).map((row) => row.category);
    },
    listBestsellers(limit = 8, now) {
      const rows = db
        .prepare(
          `SELECT ${customerColumns} FROM products p
           WHERE p.active = 1 AND p.sales_count >= 250
           ORDER BY p.sales_count DESC, p.id ASC LIMIT ?`,
        )
        .all(currentTime(now), limit) as ProductRow[];
      return hydrateCustomerRows(rows);
    },
    listByIds(ids, now) {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(', ');
      const rows = db
        .prepare(`SELECT ${customerColumns} FROM products p WHERE p.id IN (${placeholders})`)
        .all(currentTime(now), ...ids) as ProductRow[];
      return hydrateCustomerRows(rows);
    },
    listActiveCandidatesExcluding(sourceId, now) {
      const rows = db
        .prepare(
          `SELECT ${customerColumns} FROM products p
           WHERE p.active = 1 AND p.id != ? ORDER BY p.id ASC`,
        )
        .all(currentTime(now), sourceId) as ProductRow[];
      return hydrateCustomerRows(rows);
    },
    findAllVariants(productId) {
      return db
        .prepare(
          `SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order ASC`,
        )
        .all(productId) as VariantRow[];
    },
    findVariantById(variantId) {
      return db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId) as
        VariantRow | undefined;
    },
    findVariantsByIds(variantIds) {
      if (variantIds.length === 0) return [];
      const placeholders = variantIds.map(() => '?').join(', ');
      return db
        .prepare(
          `SELECT * FROM product_variants WHERE id IN (${placeholders}) ORDER BY sort_order ASC`,
        )
        .all(...variantIds) as VariantRow[];
    },
    findDefaultVariant(productId) {
      return db
        .prepare(
          `SELECT * FROM product_variants WHERE product_id = ? AND sort_order = 1 AND active = 1 LIMIT 1`,
        )
        .get(productId) as VariantRow | undefined;
    },
  };
}
