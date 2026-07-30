import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase } from '../../db/index.js';
import { createAuthService } from './authService.js';
import { createUserRepository } from './userRepository.js';

void test('login rejects a persisted suspended user before session issuance', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-auth-suspension-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });
  db.prepare(
    `INSERT INTO users
      (email, display_name, password_hash, password_salt, role, created_at, suspended_at)
     VALUES (?, ?, ?, '', 'customer', ?, ?)`,
  ).run(
    'suspended@example.test',
    'Suspended User',
    'stored-password',
    '2026-07-29T10:00:00.000Z',
    '2026-07-29T11:00:00.000Z',
  );
  const service = createAuthService({
    users: createUserRepository(db),
    clock: { now: () => new Date('2026-07-29T12:00:00.000Z') },
    passwords: { hash: () => Promise.resolve('unused'), verify: () => Promise.resolve(true) },
  });
  assert.deepEqual(await service.login({ email: 'suspended@example.test', password: 'password' }), {
    ok: false,
    error: 'AUTH_SUSPENDED',
  });
});
