import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOG_PRODUCTS } from '@shop/catalog';
import { closeDatabase, openDatabase, resetDatabase, seedDatabase } from '../../src/db/index.js';

void test('seed preserves local state; reset restores canonical data', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-seed-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  seedDatabase(db);
  seedDatabase(db);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count,
    45,
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count,
    3,
  );
  db.prepare("UPDATE users SET display_name = 'Local' WHERE email = 'alice@example.com'").run();
  db.prepare(
    "INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, sales_count) VALUES (99, 'Local', 'Local row', 100, 'Local', 1, 'local', 'local', 0)",
  ).run();
  seedDatabase(db);
  assert.equal(
    (
      db.prepare("SELECT display_name FROM users WHERE email = 'alice@example.com'").get() as {
        display_name: string;
      }
    ).display_name,
    'Local',
  );
  assert.equal(
    (db.prepare('SELECT name FROM products WHERE id = 99').get() as { name: string }).name,
    'Local',
  );

  resetDatabase(db);
  seedDatabase(db);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = 99').get(), undefined);
  assert.deepEqual(
    db.prepare('SELECT id, slug FROM products WHERE id BETWEEN 1 AND 45 ORDER BY id').all(),
    CATALOG_PRODUCTS.map(({ id, slug }) => ({ id, slug })),
  );
});
