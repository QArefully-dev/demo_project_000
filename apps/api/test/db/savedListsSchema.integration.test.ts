import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { closeDatabase, migrateDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { migrations } from '../../src/db/migrations/index.js';

function indexNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>).map(
    (index) => index.name,
  );
}

void test('saved-list schema is present with its lookup and uniqueness indexes', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-saved-lists-schema-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  for (const table of ['saved_lists', 'saved_list_items']) {
    assert.ok(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
    );
  }
  assert.deepEqual(indexNames(db, 'saved_lists').sort(), [
    'saved_lists_user_default_idx',
    'saved_lists_user_name_idx',
  ]);
  assert.deepEqual(indexNames(db, 'saved_list_items').sort(), [
    'saved_list_items_list_variant_idx',
    'saved_list_items_variant_idx',
  ]);
  const defaultIndex = (
    db.prepare("PRAGMA index_list('saved_lists')").all() as Array<{
      name: string;
      unique: number;
      partial: number;
    }>
  ).find((index) => index.name === 'saved_lists_user_default_idx');
  assert.equal(defaultIndex?.unique, 1);
  assert.equal(defaultIndex?.partial, 1);
  assert.equal(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'favourites'").get(),
    undefined,
  );
});

void test('migration 029 converts live favourites, drops inactive and missing defaults, and is a runner noop after replay', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-saved-lists-conversion-'));
  const databasePath = join(directory, 'shop.db');
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  migrateDatabase(
    db,
    migrations.filter((migration) => migration.version < '029'),
  );
  seedDatabase(db);
  const aliceId = db
    .prepare("SELECT id FROM users WHERE email = 'alice@example.com'")
    .pluck()
    .get() as number;
  const favourites = db
    .prepare(
      `SELECT products.id AS product_id, products.default_variant_id AS variant_id
       FROM products JOIN product_variants ON product_variants.id = products.default_variant_id
         AND product_variants.active = 1
       ORDER BY products.id LIMIT 2`,
    )
    .all() as Array<{ product_id: number; variant_id: number }>;
  assert.equal(favourites.length, 2);
  const insertFavourite = db.prepare('INSERT INTO favourites (user_id, product_id) VALUES (?, ?)');
  for (const favourite of favourites) insertFavourite.run(aliceId, favourite.product_id);
  const [droppedFavourite] = favourites;
  const [, nonDivisibleFavourite] = favourites;
  db.prepare('UPDATE product_variants SET weight_grams = 30000, moq_sacks = 5 WHERE id = ?').run(
    nonDivisibleFavourite.variant_id,
  );
  db.prepare('UPDATE product_variants SET active = 0 WHERE id = ?').run(
    droppedFavourite.variant_id,
  );
  const missingDefaultProductId = db
    .prepare(
      `SELECT id FROM products
       WHERE id NOT IN (?, ?)
       ORDER BY id LIMIT 1`,
    )
    .pluck()
    .get(droppedFavourite.product_id, nonDivisibleFavourite.product_id) as number;
  assert.ok(missingDefaultProductId);
  db.prepare('UPDATE products SET default_variant_id = NULL WHERE id = ?').run(
    missingDefaultProductId,
  );
  insertFavourite.run(aliceId, missingDefaultProductId);

  const expectedItems = [{ variant_id: nonDivisibleFavourite.variant_id, quantity: 5 }];

  migrateDatabase(db);
  assert.equal(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'favourites'").get(),
    undefined,
  );
  assert.deepEqual(
    db.prepare('SELECT variant_id, quantity FROM saved_list_items ORDER BY variant_id').all(),
    expectedItems,
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) FROM saved_list_items').pluck().get(),
    1,
    'a favourite without a default variant must not create a saved-list item',
  );
  assert.equal(
    db
      .prepare('SELECT COUNT(*) FROM saved_list_items WHERE variant_id = ?')
      .pluck()
      .get(droppedFavourite.variant_id),
    0,
  );
  assert.equal((db.pragma('foreign_key_check') as unknown[]).length, 0);

  migrateDatabase(db);
  assert.equal(
    db.prepare("SELECT COUNT(*) FROM schema_migrations WHERE version = '029'").pluck().get(),
    1,
  );
});
