import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { getDb, resetDatabase, seedDatabase } from '../src/db/index.js';
import {
  addItemToCart,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../src/domains/cart.js';
import { processPayment } from '../src/domains/payments.js';
import { getApiProductImages } from '../src/domains/productMedia.js';
import { POWDER_CATALOG } from '../src/db/powderCatalog.js';
import { addFavourite, listFavourites } from '../src/domains/favourites.js';
import { validatePromoCode } from '../src/domains/promo.js';
import { getCategories, getRelatedProducts, listProducts } from '../src/domains/products.js';

const apiRoot = dirname(fileURLToPath(import.meta.url));
const productAssetDirectory = resolve(apiRoot, '../../web/public/images/products');

const tempDir = mkdtempSync(join(tmpdir(), 'shop-api-smoke-'));
const dbPath = join(tempDir, 'shop.db');
const db = getDb(dbPath);

function resetAndSeed(): void {
  resetDatabase(db);
  seedDatabase(db);
}

function countRows(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function seededProduct(): { id: number; price_cents: number } {
  return db.prepare('SELECT id, price_cents FROM products ORDER BY id LIMIT 1').get() as {
    id: number;
    price_cents: number;
  };
}

void test('SQLite smoke integration', async (t) => {
  try {
    await t.test('creates schema and seeds canonical data idempotently', () => {
      resetAndSeed();
      seedDatabase(db);

      assert.equal(countRows('products'), 45);
      assert.equal(countRows('users'), 3);
      assert.equal(countRows('promo_codes'), 7);
      assert.equal(countRows('favourites'), 3);
      assert.deepEqual(
        db
          .prepare(
            "SELECT active, discount_percent, min_item_count FROM promo_codes WHERE code = 'SAVE10'",
          )
          .get(),
        { active: 1, discount_percent: 10, min_item_count: 5 },
      );
      assert.deepEqual(
        (
          db
            .prepare(
              'SELECT p.slug FROM favourites f JOIN products p ON p.id = f.product_id WHERE f.user_id = 1 ORDER BY p.id',
            )
            .all() as { slug: string }[]
        ).map((row) => row.slug),
        ['protein-powder', 'powdered-campfire', 'powdered-water'],
      );
    });

    await t.test(
      'serves the canonical powder catalogue through search, categories, sale, and ordering',
      () => {
        resetAndSeed();

        assert.deepEqual(getCategories(), [
          'Drinks',
          'Household',
          'Impossible',
          'Outdoors',
          'Pantry Staples',
          'Performance',
          'Questionable',
        ]);
        assert.ok(
          listProducts({ q: 'water', sort: 'newest' }).items.some(
            (product) => product.name === 'Powdered Water',
          ),
        );
        const impossible = listProducts({ category: 'Impossible', sort: 'newest', pageSize: 48 });
        assert.equal(impossible.total, 7);
        assert.ok(impossible.items.every((product) => product.category === 'Impossible'));

        const bestselling = listProducts({ sort: 'bestselling', pageSize: 48 });
        assert.equal(bestselling.items[0]?.name, 'Powdered Water');
        assert.deepEqual(
          bestselling.items.map((product) => product.id),
          [...bestselling.items]
            .sort((left, right) => right.sales_count - left.sales_count || left.id - right.id)
            .map((product) => product.id),
        );
        const sale = listProducts({ onSale: true, sort: 'newest', pageSize: 48 });
        assert.equal(sale.total, 14);
        assert.ok(sale.items.every((product) => product.compare_at_price_cents !== null));

        const emptySearch = listProducts({ q: 'unpowderable signal', sort: 'newest' });
        assert.equal(emptySearch.total, 0);
        assert.deepEqual(emptySearch.items, []);

        const related = getRelatedProducts(45);
        assert.ok(related.length > 0);
        assert.ok(related.every((product) => product.category === 'Impossible'));
      },
    );

    await t.test(
      'normal seed preserves user state and non-canonical products while reset clears snapshots',
      () => {
        resetAndSeed();
        db.prepare(
          "UPDATE users SET display_name = 'Alice Changed' WHERE email = 'alice@example.com'",
        ).run();
        db.prepare(
          "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (99, 'Local Powder', 'A local row.', 100, 'Local', 1, 'missing-set', 'local-powder', 0)",
        ).run();
        db.prepare(
          "INSERT INTO orders (customer_name, customer_email, shipping_address, subtotal_cents, total_cents) VALUES ('Snapshot', 'snapshot@example.test', '1 Test Street', 100, 100)",
        ).run();
        db.prepare(
          "INSERT INTO dev_mailbox (recipient, subject, body, kind) VALUES ('alice@example.com', 'Existing', 'Existing mailbox snapshot', 'plain')",
        ).run();

        seedDatabase(db);
        assert.equal(
          (
            db
              .prepare("SELECT display_name FROM users WHERE email = 'alice@example.com'")
              .get() as { display_name: string }
          ).display_name,
          'Alice Changed',
        );
        assert.equal(
          (db.prepare('SELECT name FROM products WHERE id = 99').get() as { name: string }).name,
          'Local Powder',
        );
        assert.equal(countRows('orders'), 1);
        assert.equal(countRows('dev_mailbox'), 1);

        resetAndSeed();
        assert.equal(countRows('orders'), 0);
        assert.equal(countRows('dev_mailbox'), 0);
        assert.equal(
          db.prepare('SELECT COUNT(*) AS count FROM products WHERE id = 99').get().count,
          0,
        );
        const canonicalRows = db
          .prepare('SELECT id, name, slug FROM products WHERE id BETWEEN 1 AND 45 ORDER BY id')
          .all() as { id: number; name: string; slug: string }[];
        assert.deepEqual(
          canonicalRows,
          POWDER_CATALOG.map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
          })),
        );
      },
    );

    await t.test(
      'resolves generated powder image metadata and deterministic unknown fallback',
      () => {
        for (const product of POWDER_CATALOG) {
          const images = getApiProductImages(product.image_set_id, product.category, product.name);
          assert.deepEqual(
            images.map((image) => image.role),
            ['thumbnail', 'card', 'detail'],
          );
          for (const image of images) {
            assert.match(
              image.src,
              /^\/images\/products\/.+\.(thumbnail|card|detail)\.[a-f0-9]{12}\.(320|720|1200)\.webp$/,
            );
            assert.equal(image.alt, `${product.name} powder bag`);
            assert.ok(!image.src.includes('://'));
          }
        }

        assert.match(
          getApiProductImages('missing-set', 'Unknown', 'Fallback powder bag')[0]?.src ?? '',
          /^data:image\/svg\+xml,/,
        );
      },
    );

    await t.test('reset restores seeded SAVE10 eligibility', () => {
      resetAndSeed();
      const { cartId } = createCart();
      for (const productId of ['1', '2', '3', '4']) addItemToCart(cartId, productId);
      assert.equal(
        validatePromoCode({ code: 'SAVE10', cartId, userId: null }).errorCode,
        'MIN_ITEMS',
      );

      addItemToCart(cartId, '5');
      assert.deepEqual(validatePromoCode({ code: 'SAVE10', cartId, userId: null }).promoCode, {
        code: 'SAVE10',
        discountPercent: 10,
        minItemCount: 5,
        kind: 'percent',
        amountCents: undefined,
        minSubtotalCents: undefined,
      });

      assert.equal(
        validatePromoCode({ code: 'EXPIRED10', cartId, userId: null }).errorCode,
        'EXPIRED',
      );

      resetAndSeed();
      assert.deepEqual(
        db
          .prepare(
            "SELECT active, discount_percent, min_item_count FROM promo_codes WHERE code = 'SAVE10'",
          )
          .get(),
        { active: 1, discount_percent: 10, min_item_count: 5 },
      );
    });

    await t.test('committed asset manifest tracks complete local WebP outputs', () => {
      const manifest = JSON.parse(
        readFileSync(join(productAssetDirectory, 'manifest.json'), 'utf8'),
      ) as {
        version: number;
        files: {
          sourceId: string;
          role: string;
          path: string;
          width: number;
          height: number;
          bytes: number;
        }[];
      };
      const expectedRoles = new Set(['thumbnail', 'card', 'detail']);
      const paths = new Set<string>();
      const renditions = new Set<string>();

      assert.equal(manifest.version, 2);
      assert.equal(manifest.files.length, 135);
      for (const file of manifest.files) {
        assert.ok(expectedRoles.has(file.role));
        assert.match(
          file.path,
          /^\/images\/products\/[a-z0-9-]+\.(thumbnail|card|detail)\.[a-f0-9]{12}\.(320|720|1200)\.webp$/,
        );
        assert.ok(!paths.has(file.path), `duplicate asset path: ${file.path}`);
        assert.ok(!renditions.has(`${file.sourceId}:${file.role}`));
        paths.add(file.path);
        renditions.add(`${file.sourceId}:${file.role}`);
        assert.equal(file.width, file.height);
        assert.equal(file.width, { thumbnail: 320, card: 720, detail: 1200 }[file.role]);
        assert.equal(
          statSync(join(productAssetDirectory, file.path.slice('/images/products/'.length))).size,
          file.bytes,
        );
      }
      assert.equal(renditions.size, 135);
    });

    await t.test('persists cart create, update, read, and remove operations', () => {
      resetAndSeed();
      const product = seededProduct();
      const { cartId } = createCart();

      assert.notEqual(addItemToCart(cartId, String(product.id)), 'CART_NOT_FOUND');
      assert.notEqual(updateCartItem(cartId, String(product.id), 2), 'PRODUCT_NOT_IN_CART');

      const cart = getCart(cartId);
      assert.ok(cart);
      assert.equal(cart.items[0]?.quantity, 2);
      assert.equal(cart.items[0]?.lineTotalCents, product.price_cents * 2);
      assert.equal(cart.subtotalCents, product.price_cents * 2);
      assert.equal(cart.totalItems, 2);

      assert.notEqual(removeCartItem(cartId, String(product.id)), 'PRODUCT_NOT_IN_CART');
      assert.deepEqual(getCart(cartId)?.items, []);
    });

    await t.test(
      'completes the favourite, five-bag SAVE10 payment, and mailbox receipt flow',
      async () => {
        resetAndSeed();
        const { cartId } = createCart();
        const productIds = ['1', '2', '3', '4', '5'];
        assert.equal(addFavourite(1, Number(productIds[0])), true);
        assert.ok(listFavourites(1).some((product) => product.id === Number(productIds[0])));
        for (const productId of productIds) addItemToCart(cartId, productId);
        const cartBeforePayment = getCart(cartId);
        assert.ok(cartBeforePayment);
        const expectedDiscountCents = Math.floor(cartBeforePayment.subtotalCents * 0.1);

        const promo = validatePromoCode({ code: 'SAVE10', cartId, userId: 1 });
        assert.equal(promo.valid, true);

        const result = await processPayment({
          cartId,
          promoCode: 'SAVE10',
          customerName: 'Smoke Success',
          customerEmail: 'smoke-success@example.test',
          shippingAddress: '1 Test Street',
          cardNumber: '4242 4242 4242 4242',
          cardExpiry: '12/99',
          cardCvc: '123',
          idempotencyKey: 'smoke-success-payment',
          userId: 1,
        });

        assert.equal(result.success, true);
        if (!result.success) throw new Error('Expected successful payment');
        assert.equal(countRows('orders'), 1);
        assert.equal(countRows('order_line_items'), 5);
        assert.deepEqual(
          db
            .prepare('SELECT status, order_id FROM payments WHERE idempotency_key = ?')
            .get('smoke-success-payment'),
          { status: 'success', order_id: Number(result.orderId) },
        );
        assert.equal(
          (
            db
              .prepare(
                "SELECT COUNT(*) AS count FROM dev_mailbox WHERE kind = 'order_confirmation'",
              )
              .get() as { count: number }
          ).count,
          1,
        );
        assert.deepEqual(
          db
            .prepare('SELECT promo_code_applied, discount_cents FROM orders WHERE id = ?')
            .get(Number(result.orderId)),
          { promo_code_applied: 'SAVE10', discount_cents: expectedDiscountCents },
        );
        assert.equal(getCart(cartId), undefined);
      },
    );

    await t.test(
      'records declined payment without creating an order or deleting its cart',
      async () => {
        resetAndSeed();
        const product = seededProduct();
        const { cartId } = createCart();
        addItemToCart(cartId, String(product.id));

        const result = await processPayment({
          cartId,
          customerName: 'Smoke Decline',
          customerEmail: 'smoke-decline@example.test',
          shippingAddress: '2 Test Street',
          cardNumber: '4000 0000 0000 0002',
          cardExpiry: '12/99',
          cardCvc: '123',
          idempotencyKey: 'smoke-decline-payment',
          userId: null,
        });

        assert.deepEqual(result, { success: false, error: 'DECLINED' });
        assert.equal(countRows('orders'), 0);
        assert.deepEqual(
          db
            .prepare('SELECT status, order_id FROM payments WHERE idempotency_key = ?')
            .get('smoke-decline-payment'),
          { status: 'declined', order_id: null },
        );
        assert.equal(getCart(cartId)?.totalItems, 1);
      },
    );

    await t.test(
      'records gateway timeout without creating an order or deleting its cart',
      async () => {
        resetAndSeed();
        const product = seededProduct();
        const { cartId } = createCart();
        addItemToCart(cartId, String(product.id));

        const result = await processPayment({
          cartId,
          customerName: 'Smoke Timeout',
          customerEmail: 'smoke-timeout@example.test',
          shippingAddress: '3 Test Street',
          cardNumber: '4000 0000 0000 0069',
          cardExpiry: '12/99',
          cardCvc: '123',
          idempotencyKey: 'smoke-timeout-payment',
          userId: null,
        });

        assert.deepEqual(result, { success: false, error: 'TIMEOUT' });
        assert.equal(countRows('orders'), 0);
        assert.deepEqual(
          db
            .prepare(
              'SELECT status, order_id, failure_reason FROM payments WHERE idempotency_key = ?',
            )
            .get('smoke-timeout-payment'),
          { status: 'timeout', order_id: null, failure_reason: 'GATEWAY_TIMEOUT' },
        );
        assert.equal(getCart(cartId)?.totalItems, 1);
      },
    );
  } finally {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
  }
});
