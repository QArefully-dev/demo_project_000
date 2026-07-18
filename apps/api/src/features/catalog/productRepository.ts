import type Database from 'better-sqlite3';
import { CATALOG_SPECIFICATION_DEFINITIONS, CATALOG_SPECIFICATION_GROUPS } from '@shop/catalog';
import type {
  ProductFilterOptionsResponse,
  ProductQuery,
  ProductSpecificationGroup,
  ProductTag,
} from '@shop/contracts/products';
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

/** Customer read model with metadata hydrated from persisted catalog tables. */
export interface CustomerProductRow extends ProductRow {
  tags: ProductTag[];
  specificationGroups: ProductSpecificationGroup[];
}

export interface ProductList {
  items: CustomerProductRow[];
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
  findActiveById(id: number): CustomerProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): CustomerProductRow[];
  /** Explicit comparison lookup; includes active and inactive products only. */
  listByIds(ids: readonly number[]): CustomerProductRow[];
  /** Active customer reads for deterministic similarity scoring. */
  listActiveCandidatesExcluding(sourceId: number): CustomerProductRow[];
  listEligibleMixProducts(): ProductRow[];
  /** Active-only component selection for new Powderizer quotes and mixes. */
  listActiveMixProducts(productIds: readonly number[]): ProductRow[];
  /** Internal component lookup for retained mix/cart history. */
  listMixProducts(productIds: readonly number[]): ProductRow[];
}

export function createProductRepository(db: Database.Database): ProductRepository {
  const hydrateCustomerRows = (rows: readonly ProductRow[]): CustomerProductRow[] => {
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
      const definition = CATALOG_SPECIFICATION_DEFINITIONS.find(
        (candidate) => candidate.key === specification.specification_key,
      );
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
          const leftOrder = CATALOG_SPECIFICATION_DEFINITIONS.find(
            (definition) => definition.key === left.key,
          )!.order;
          const rightOrder = CATALOG_SPECIFICATION_DEFINITIONS.find(
            (definition) => definition.key === right.key,
          )!.order;
          return leftOrder - rightOrder || left.key.localeCompare(right.key);
        });
        return [{ key: group.key, label: group.label, order: group.order, specifications }];
      });
      return { ...row, tags: tagsByProduct.get(row.id) ?? [], specificationGroups };
    });
  };

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
        const definition = CATALOG_SPECIFICATION_DEFINITIONS.find(
          (candidate) => candidate.key === value.specification_key,
        );
        if (!definition?.filterable) continue;
        const specificationValues =
          valuesBySpecification.get(definition.key) ?? new Map<string, string>();
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
      const row = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id) as
        ProductRow | undefined;
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
    listBestsellers(limit = 8) {
      const rows = db
        .prepare(
          'SELECT * FROM products WHERE active = 1 AND sales_count >= 250 ORDER BY sales_count DESC, id ASC LIMIT ?',
        )
        .all(limit) as ProductRow[];
      return hydrateCustomerRows(rows);
    },
    listByIds(ids) {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(', ');
      const rows = db
        .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
        .all(...ids) as ProductRow[];
      return hydrateCustomerRows(rows);
    },
    listActiveCandidatesExcluding(sourceId) {
      const rows = db
        .prepare('SELECT * FROM products WHERE active = 1 AND id != ? ORDER BY id ASC')
        .all(sourceId) as ProductRow[];
      return hydrateCustomerRows(rows);
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
