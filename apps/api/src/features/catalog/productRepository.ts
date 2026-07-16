import type Database from 'better-sqlite3';
import { CATALOG_SPECIFICATION_DEFINITIONS, CATALOG_SPECIFICATION_GROUPS } from '@shop/catalog';
import type { ProductFilterOptionsResponse, ProductQuery } from '@shop/contracts/products';
import { buildCatalogPredicate, catalogOrderBy } from './catalogSql.js';
import { normalizeCatalogQuery } from './catalogQuery.js';

export interface ProductRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_set_id: string | null;
  slug: string;
  compare_at_price_cents: number | null;
  sales_count: number;
  mixable?: number;
  mix_unit_grams?: number | null;
  active: number;
  created_at: string;
}

export interface ProductList {
  items: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductRepository {
  list(query: ProductQuery): ProductList;
  listFilterOptions(): ProductFilterOptionsResponse;
  /** Internal lookup for checkout, order history, and persisted mix components. */
  findById(id: number): ProductRow | undefined;
  /** Customer discovery lookup. Inactive products must remain invisible. */
  findActiveById(id: number): ProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): ProductRow[];
  listRelated(productId: number, limit?: number): ProductRow[];
  listEligibleMixProducts(): ProductRow[];
  /** Active-only component selection for new Powderizer quotes and mixes. */
  listActiveMixProducts(productIds: readonly number[]): ProductRow[];
  /** Internal component lookup for retained mix/cart history. */
  listMixProducts(productIds: readonly number[]): ProductRow[];
}

export function createProductRepository(db: Database.Database): ProductRepository {
  return {
    list(query) {
      const normalized = normalizeCatalogQuery(query);
      const predicate = buildCatalogPredicate(normalized);
      const total = (
        db
          .prepare(`SELECT COUNT(*) AS count FROM products p ${predicate.where}`)
          .get(...predicate.params) as {
          count: number;
        }
      ).count;
      const items = db
        .prepare(
          `SELECT p.* FROM products p ${predicate.where} ${catalogOrderBy(normalized.sort)} LIMIT ? OFFSET ?`,
        )
        .all(
          ...predicate.params,
          normalized.pageSize,
          (normalized.page - 1) * normalized.pageSize,
        ) as ProductRow[];
      return { items, total, page: normalized.page, pageSize: normalized.pageSize };
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
        const definition = CATALOG_SPECIFICATION_DEFINITIONS.find(
          (candidate) => candidate.key === value.specification_key,
        );
        if (!definition?.filterable) continue;
        const specificationValues = valuesBySpecification.get(definition.key) ?? new Map();
        specificationValues.set(value.value_key, value.display_value);
        valuesBySpecification.set(definition.key, specificationValues);
      }
      const specificationGroups = CATALOG_SPECIFICATION_GROUPS.flatMap((group) => {
        const specifications = CATALOG_SPECIFICATION_DEFINITIONS.flatMap((definition) => {
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
    findActiveById(id) {
      return db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id) as
        ProductRow | undefined;
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
    listBestsellers(limit = 8) {
      return db
        .prepare(
          'SELECT * FROM products WHERE active = 1 AND sales_count >= 250 ORDER BY sales_count DESC, id ASC LIMIT ?',
        )
        .all(limit) as ProductRow[];
    },
    listRelated(productId, limit = 4) {
      return db
        .prepare(
          `SELECT * FROM products WHERE active = 1
           AND category = (SELECT category FROM products WHERE id = ? AND active = 1)
           AND id != ? ORDER BY id ASC LIMIT ?`,
        )
        .all(productId, productId, limit) as ProductRow[];
    },
    listEligibleMixProducts() {
      return db
        .prepare(
          `SELECT * FROM products
           WHERE active = 1 AND mixable = 1 AND mix_unit_grams IS NOT NULL AND mix_unit_grams > 0
           ORDER BY id ASC`,
        )
        .all() as ProductRow[];
    },
    listActiveMixProducts(productIds) {
      if (productIds.length === 0) return [];
      const placeholders = productIds.map(() => '?').join(', ');
      return db
        .prepare(
          `SELECT * FROM products WHERE active = 1 AND id IN (${placeholders}) ORDER BY id ASC`,
        )
        .all(...productIds) as ProductRow[];
    },
    listMixProducts(productIds) {
      if (productIds.length === 0) return [];
      const placeholders = productIds.map(() => '?').join(', ');
      return db
        .prepare(`SELECT * FROM products WHERE id IN (${placeholders}) ORDER BY id ASC`)
        .all(...productIds) as ProductRow[];
    },
  };
}
