import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase, seedDatabase } from '../../src/db/index.js';
import { createFavouritesRepository } from '../../src/features/favourites/favouritesRepository.js';
import {
  addFavourite,
  listFavourites,
  removeFavourite,
} from '../../src/features/favourites/favouritesService.js';

void test('favourites service owns product-existence rule; repository owns persistence', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-favourites-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  seedDatabase(db);
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  const favourites = createFavouritesRepository(db);
  assert.equal(addFavourite(favourites, 1, 1), true);
  assert.equal(addFavourite(favourites, 1, 9_999), 'NOT_FOUND');
  assert.ok(listFavourites(favourites, 1).some((product) => product.id === 1));
  assert.equal(removeFavourite(favourites, 1, 1), true);
});
