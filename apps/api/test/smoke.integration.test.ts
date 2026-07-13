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
import { validatePromoCode } from '../src/domains/promo.js';

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
    });

    await t.test('seeds local product images and deterministic fallback paths', () => {
      resetAndSeed();
      const products = db
        .prepare('SELECT name, category, image_set_id FROM products ORDER BY id')
        .all() as { name: string; category: string; image_set_id: string }[];

      assert.equal(products.length, 45);
      for (const product of products) {
        const [image] = getApiProductImages(product.image_set_id, product.category, product.name);
        assert.ok(image);
        assert.match(image.src, /^\/images\/products\/.+\.card\.[a-f0-9]{12}\.720\.webp$/);
        assert.equal(image.width, 720);
        assert.equal(image.height, 720);
        assert.ok(!image.src.includes('://'));
      }

      assert.equal(
        getApiProductImages('missing-set', 'Audio', 'Fallback')[0]?.src,
        '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
      );
      assert.match(
        getApiProductImages('missing-set', 'Unknown', 'Fallback')[0]?.src ?? '',
        /^data:image\/svg\+xml,/,
      );
    });

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

      assert.equal(manifest.version, 1);
      assert.equal(manifest.files.length, 24);
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
      assert.equal(renditions.size, 24);
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

    await t.test('commits successful payment state and removes its cart', async () => {
      resetAndSeed();
      const product = seededProduct();
      const { cartId } = createCart();
      addItemToCart(cartId, String(product.id));

      const result = await processPayment({
        cartId,
        customerName: 'Smoke Success',
        customerEmail: 'smoke-success@example.test',
        shippingAddress: '1 Test Street',
        cardNumber: '4242 4242 4242 4242',
        cardExpiry: '12/99',
        cardCvc: '123',
        idempotencyKey: 'smoke-success-payment',
        userId: null,
      });

      assert.equal(result.success, true);
      if (!result.success) throw new Error('Expected successful payment');
      assert.equal(countRows('orders'), 1);
      assert.equal(countRows('order_line_items'), 1);
      assert.deepEqual(
        db
          .prepare('SELECT status, order_id FROM payments WHERE idempotency_key = ?')
          .get('smoke-success-payment'),
        { status: 'success', order_id: Number(result.orderId) },
      );
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) AS count FROM dev_mailbox WHERE kind = 'order_confirmation'")
            .get() as { count: number }
        ).count,
        1,
      );
      assert.equal(getCart(cartId), undefined);
    });

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
  } finally {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
  }
});
