import { createHash, scryptSync } from 'node:crypto';
import { PRODUCT_MEDIA_REGISTRY } from '@shop/contracts';
import type Database from 'better-sqlite3';
import { POWDER_CATALOG, validatePowderCatalog } from './powderCatalog.js';

const USERS = [
  { id: 1, email: 'alice@example.com', display_name: 'Alice', role: 'customer' },
  { id: 2, email: 'bob@example.com', display_name: 'Bob', role: 'customer' },
  { id: 3, email: 'admin@example.com', display_name: 'Admin', role: 'admin' },
] as const;

// Keep the established promotion behaviour, including SAVE10's five-item rule.
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

const ALICE_FAVOURITE_SLUGS = ['protein-powder', 'powdered-water', 'powdered-campfire'] as const;

function seededPassword(email: string): string {
  const salt = createHash('sha256').update(`seed-salt-${email}`).digest('hex').slice(0, 64);
  return `${salt}.${scryptSync('Password123!', salt, 64).toString('hex')}`;
}

/**
 * Idempotently installs the canonical powder catalogue.
 *
 * Product IDs 1-45 are reserved canonical rows and are updated in place. This
 * preserves foreign-key references while leaving rows outside that range and
 * all user-created data untouched. Seed users, promos, and favourites are
 * insert-only; resetDatabase is the explicit destructive clean-slate path.
 */
export function seedDatabase(db: Database.Database): void {
  validatePowderCatalog(POWDER_CATALOG, Object.keys(PRODUCT_MEDIA_REGISTRY));

  const seed = db.transaction(() => {
    const upsertProduct = db.prepare(`
      INSERT INTO products
        (id, name, description, price_cents, category, stock_count, image_set_id, slug, compare_at_price_cents, sales_count)
      VALUES
        (@id, @name, @description, @price_cents, @category, @stock_count, @image_set_id, @slug, @compare_at_price_cents, @sales_count)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        price_cents = excluded.price_cents,
        category = excluded.category,
        stock_count = excluded.stock_count,
        image_set_id = excluded.image_set_id,
        slug = excluded.slug,
        compare_at_price_cents = excluded.compare_at_price_cents,
        sales_count = excluded.sales_count
    `);
    for (const product of POWDER_CATALOG) upsertProduct.run(product);

    // Existing promo redemption counts must not be reset by a normal seed.
    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promo_codes
        (code, discount_percent, min_item_count, active, kind, amount_cents, min_subtotal_cents, start_at, end_at, max_redemptions, redemption_count, per_user_limit)
      VALUES
        (@code, @discount_percent, @min_item_count, @active, @kind, @amount_cents, @min_subtotal_cents, @start_at, @end_at, @max_redemptions, @redemption_count, @per_user_limit)
    `);
    for (const promo of PROMOS) insertPromo.run(promo);

    // INSERT OR IGNORE protects accounts that changed credentials/profile data.
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
      db.prepare('SELECT COUNT(*) AS count FROM products WHERE id BETWEEN 1 AND 45').get() as {
        count: number;
      }
    ).count;
    if (canonicalCount !== POWDER_CATALOG.length) {
      throw new Error(
        `Seed assertion failed: expected ${POWDER_CATALOG.length} canonical powder products, got ${canonicalCount}`,
      );
    }
  });

  seed();
}
