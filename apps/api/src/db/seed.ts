import { createHash, scryptSync } from 'node:crypto';
import { CATALOG_PRODUCTS, CURATED_BUNDLES, validateCatalog } from '@shop/catalog';
import type Database from 'better-sqlite3';
import { catalogProductSpecifications } from '../features/catalog/catalogSpecifications.js';
import { seedOrderScenarios } from './orderSeedScenarios.js';
import { seedReviewScenarios } from './reviewSeedScenarios.js';

const USERS = [
  { id: 1, email: 'alice@example.com', display_name: 'Alice', role: 'customer' },
  { id: 2, email: 'bob@example.com', display_name: 'Bob', role: 'customer' },
  { id: 3, email: 'admin@example.com', display_name: 'Admin', role: 'admin' },
] as const;

const PROMOS = [
  {
    code: 'SAVE10',
    discount_percent: 10,
    min_item_count: 5,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'SAVE20',
    discount_percent: 20,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: 10000,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'WELCOME5',
    discount_percent: 0,
    min_item_count: 0,
    active: 1,
    kind: 'fixed',
    amount_cents: 500,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: 1,
  },
  {
    code: 'VIP15',
    discount_percent: 15,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'EXPIRED10',
    discount_percent: 10,
    min_item_count: 3,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: '2025-01-01T00:00:00.000Z',
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'SOON10',
    discount_percent: 10,
    min_item_count: 3,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: '2099-01-01T00:00:00.000Z',
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'LIMITED5',
    discount_percent: 5,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: 0,
    redemption_count: 0,
    per_user_limit: null,
  },
] as const;

const ALICE_FAVOURITE_SLUGS = [
  'all-purpose-flour',
  'whey-protein-isolate',
  'matcha-green-tea-powder',
] as const;

function seededPassword(email: string): string {
  const salt = createHash('sha256').update(`seed-salt-${email}`).digest('hex').slice(0, 64);
  return `${salt}.${scryptSync('Password123!', salt, 64).toString('hex')}`;
}

const CANONICAL_PRODUCT_IDS = new Set(
  Array.from({ length: 50 }, (_, i) => i + 1).concat(
    Array.from({ length: 50 }, (_, i) => 1001 + i),
  ),
);

/**
 * Idempotently installs the canonical powder catalogue.
 *
 * Product IDs 1-50 and 1001-1050 are reserved canonical rows and are updated in place.
 * This preserves foreign-key references while leaving rows outside that range and
 * all user-created data untouched. Seed users, promos, and favourites are
 * insert-only; resetDatabase is the explicit destructive clean-slate path.
 */
export function seedDatabase(db: Database.Database): void {
  validateCatalog();

  const seed = db.transaction(() => {
    const upsertProduct = db.prepare(`
      INSERT INTO products
        (id, name, description, price_cents, category, backorderable, backorder_lead_days, image_set_id, slug, compare_at_price_cents, sales_count, mixable, mix_unit_grams, active, created_at, consumption_classification, mixing_group, details_json)
      VALUES
        (@id, @name, @description, @price_cents, @category, @backorderable, @backorder_lead_days, @image_set_id, @slug, @compare_at_price_cents, @sales_count, @mixable, @mix_unit_grams, @active, @created_at, @consumption_classification, @mixing_group, @details_json)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        price_cents = excluded.price_cents,
        category = excluded.category,
        backorderable = excluded.backorderable,
        backorder_lead_days = excluded.backorder_lead_days,
        image_set_id = excluded.image_set_id,
        slug = excluded.slug,
        compare_at_price_cents = excluded.compare_at_price_cents,
        sales_count = excluded.sales_count,
        mixable = excluded.mixable,
        mix_unit_grams = excluded.mix_unit_grams,
        active = excluded.active,
        created_at = excluded.created_at,
        consumption_classification = excluded.consumption_classification,
        mixing_group = excluded.mixing_group,
        details_json = excluded.details_json
    `);

    const upsertVariant = db.prepare(`
      INSERT INTO product_variants
        (product_id, sku, label, weight_grams, price_cents, compare_at_price_cents, stock_count, backorderable, backorder_lead_days, delivery_class, active, sort_order, created_at, updated_at)
      VALUES
        (@product_id, @sku, @label, @weight_grams, @price_cents, @compare_at_price_cents, @stock_count, @backorderable, @backorder_lead_days, @delivery_class, @active, @sort_order, @created_at, @updated_at)
      ON CONFLICT(product_id, sort_order) DO UPDATE SET
        sku = excluded.sku,
        label = excluded.label,
        weight_grams = excluded.weight_grams,
        price_cents = excluded.price_cents,
        compare_at_price_cents = excluded.compare_at_price_cents,
        stock_count = excluded.stock_count,
        backorderable = excluded.backorderable,
        backorder_lead_days = excluded.backorder_lead_days,
        delivery_class = excluded.delivery_class,
        active = excluded.active,
        updated_at = excluded.updated_at
    `);

    const upsertTag = db.prepare(`
      INSERT INTO catalog_tags (key, label)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET label = excluded.label
    `);

    const deleteCanonicalTags = db.prepare(
      `DELETE FROM product_tags WHERE product_id IN (${[...CANONICAL_PRODUCT_IDS].join(',')})`,
    );
    const deleteCanonicalSpecifications = db.prepare(
      `DELETE FROM product_specifications WHERE product_id IN (${[...CANONICAL_PRODUCT_IDS].join(',')})`,
    );
    const deactivateExtraVariants = db.prepare(`
      UPDATE product_variants SET active = 0, updated_at = @updated_at
      WHERE product_id = @product_id AND sort_order > @max_sort_order
    `);
    const insertProductTag = db.prepare(
      'INSERT INTO product_tags (product_id, tag_key) VALUES (?, ?)',
    );
    const insertProductSpecification = db.prepare(`
      INSERT INTO product_specifications
        (product_id, specification_key, value_key, display_value, numeric_value)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateDefaultVariant = db.prepare(
      'UPDATE products SET default_variant_id = ? WHERE id = ?',
    );

    const upsertBundle = db.prepare(`
      INSERT INTO curated_bundles (id, key, name, description, active, sort_order)
      VALUES (@id, @key, @name, @description, @active, @sort_order)
      ON CONFLICT(id) DO UPDATE SET
        key = excluded.key,
        name = excluded.name,
        description = excluded.description,
        active = excluded.active,
        sort_order = excluded.sort_order
    `);
    const deleteBundleComponents = db.prepare(
      'DELETE FROM curated_bundle_components WHERE bundle_id = ?',
    );
    const insertBundleComponent = db.prepare(`
      INSERT INTO curated_bundle_components (bundle_id, variant_id, product_id, quantity, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const variantBySku = db.prepare('SELECT id, product_id FROM product_variants WHERE sku = ?');

    deleteCanonicalTags.run();
    deleteCanonicalSpecifications.run();

    const skuToVariant = new Map<string, { id: number; product_id: number }>();

    for (const product of CATALOG_PRODUCTS) {
      const defaultVariant =
        product.variants.find((v) => v.sortOrder === 1 && v.active) ?? product.variants[0];
      const createdAt = product.createdAt;
      const detailsJson = JSON.stringify(product.categoryFacts);

      // Determine base product-level mixable status (all non-food products remain mixable for powderizer compatibility)
      const isMixable = true;
      const defaultWeight = defaultVariant?.weightGrams ?? 0;

      upsertProduct.run({
        id: product.id,
        name: product.name,
        description: product.description,
        price_cents: defaultVariant?.priceCents ?? 0,
        category: product.category,
        backorderable: defaultVariant?.backorderable ? 1 : 0,
        backorder_lead_days: defaultVariant?.backorderable
          ? (defaultVariant.backorderLeadDays ?? null)
          : null,
        image_set_id: product.imageSetId,
        slug: product.slug,
        compare_at_price_cents: defaultVariant?.compareAtPriceCents ?? null,
        sales_count: 0,
        mixable: isMixable ? 1 : 0,
        mix_unit_grams: isMixable ? defaultWeight || 1000 : null,
        active: product.visibility === 'public' ? 1 : 0,
        created_at: createdAt,
        consumption_classification: product.consumptionClassification,
        mixing_group: product.mixingGroup ?? null,
        details_json: detailsJson,
      });

      for (const variant of product.variants) {
        const result = upsertVariant.run({
          product_id: product.id,
          sku: variant.sku,
          label: variant.label,
          weight_grams: variant.weightGrams,
          price_cents: variant.priceCents,
          compare_at_price_cents: variant.compareAtPriceCents ?? null,
          stock_count: variant.stockCount,
          backorderable: variant.backorderable ? 1 : 0,
          backorder_lead_days: variant.backorderable ? (variant.backorderLeadDays ?? null) : null,
          delivery_class: variant.deliveryClass,
          active: variant.active ? 1 : 0,
          sort_order: variant.sortOrder,
          created_at: createdAt,
          updated_at: createdAt,
        });
        const variantId = Number(result.lastInsertRowid);
        skuToVariant.set(variant.sku, { id: variantId, product_id: product.id });
      }

      const defaultVariantId = defaultVariant
        ? skuToVariant.get(defaultVariant.sku)?.id
        : undefined;
      if (defaultVariantId) {
        updateDefaultVariant.run(defaultVariantId, product.id);
      }

      deactivateExtraVariants.run({
        product_id: product.id,
        max_sort_order: product.variants.length,
        updated_at: createdAt,
      });

      for (const tag of product.tags) {
        const normalizedKey = tag
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const label = tag;
        upsertTag.run(normalizedKey, label);
        insertProductTag.run(product.id, normalizedKey);
      }

      for (const specification of catalogProductSpecifications(product)) {
        insertProductSpecification.run(
          product.id,
          specification.key,
          specification.valueKey,
          specification.displayValue,
          specification.numericValue,
        );
      }
    }

    for (const bundle of CURATED_BUNDLES) {
      upsertBundle.run({
        id: bundle.id,
        key: bundle.key,
        name: bundle.name,
        description: bundle.description,
        active: 1,
        sort_order: bundle.sortOrder,
      });
      deleteBundleComponents.run(bundle.id);
      for (const component of bundle.components) {
        const v = variantBySku.get(component.variantSku) as
          { id: number; product_id: number } | undefined;
        if (v) {
          insertBundleComponent.run(
            bundle.id,
            v.id,
            v.product_id,
            component.quantity,
            component.sortOrder,
          );
        }
      }
    }

    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promo_codes
        (code, discount_percent, min_item_count, active, kind, amount_cents, min_subtotal_cents, start_at, end_at, max_redemptions, redemption_count, per_user_limit)
      VALUES
        (@code, @discount_percent, @min_item_count, @active, @kind, @amount_cents, @min_subtotal_cents, @start_at, @end_at, @max_redemptions, @redemption_count, @per_user_limit)
    `);
    for (const promo of PROMOS) insertPromo.run(promo);

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, display_name, password_hash, password_salt, role)
      VALUES (@id, @email, @display_name, @password_hash, @password_salt, @role)
    `);
    for (const user of USERS) {
      insertUser.run({ ...user, password_hash: seededPassword(user.email), password_salt: '' });
    }

    const alice = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@example.com') as
      { id: number } | undefined;
    if (alice) {
      const addFavourite = db.prepare(
        'INSERT OR IGNORE INTO favourites (user_id, product_id) VALUES (?, ?)',
      );
      const productIdForSlug = db.prepare('SELECT id FROM products WHERE slug = ?');
      for (const slug of ALICE_FAVOURITE_SLUGS) {
        const product = productIdForSlug.get(slug) as { id: number } | undefined;
        if (product) addFavourite.run(alice.id, product.id);
      }
    }

    const canonicalCount = (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM products WHERE id IN (${[...CANONICAL_PRODUCT_IDS].join(',')})`,
        )
        .get() as { count: number }
    ).count;
    if (canonicalCount < CATALOG_PRODUCTS.length) {
      throw new Error(
        `Seed assertion failed: expected at least ${CATALOG_PRODUCTS.length} canonical powder products, got ${canonicalCount}`,
      );
    }

    const canonicalBundleCount = (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM curated_bundles
           WHERE id IN (${CURATED_BUNDLES.map(() => '?').join(', ')})`,
        )
        .get(...CURATED_BUNDLES.map((bundle) => bundle.id)) as { count: number }
    ).count;
    if (canonicalBundleCount !== CURATED_BUNDLES.length) {
      throw new Error(
        `Seed assertion failed: expected ${CURATED_BUNDLES.length} canonical curated bundles, got ${canonicalBundleCount}`,
      );
    }

    seedOrderScenarios(db);
    seedReviewScenarios(db);
  });

  seed();
}
