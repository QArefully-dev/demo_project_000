import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, openDatabase } from '../../src/db/index.js';
import { createMailboxRepository } from '../../src/features/mailbox/mailboxRepository.js';
import { createPasswordResetRepository } from '../../src/features/passwordReset/passwordResetRepository.js';
import { createPasswordResetService } from '../../src/features/passwordReset/passwordResetService.js';

void test('password reset never restores tombstoned account credentials', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-deleted-reset-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  const now = new Date('2026-07-29T12:00:00.000Z');
  t.after(() => {
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const userId = Number(
    (
      db
        .prepare(
          `INSERT INTO users (email, display_name, password_hash, password_salt, role, created_at)
           VALUES ('deleted-1@tombstone.local', 'Deleted User', '', '', 'customer', ?)
           RETURNING id`,
        )
        .get(now.toISOString()) as { id: number }
    ).id,
  );
  const token = 'stale-reset-token';
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_digest, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    userId,
    createHash('sha256').update(token).digest('hex'),
    new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    now.toISOString(),
  );
  const mailbox = createMailboxRepository(db);
  const resets = createPasswordResetService({
    repository: createPasswordResetRepository(db),
    mailbox,
    clock: { now: () => now },
    baseUrl: 'https://web.example.test',
  });

  resets.request('deleted-1@tombstone.local', 'UK');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS total FROM dev_mailbox').get() as { total: number }).total,
    0,
  );
  assert.equal(
    await resets.reset({ token, newPassword: 'replacement-password-123' }),
    'INVALID_TOKEN',
  );
  assert.deepEqual(
    db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').get(userId),
    {
      password_hash: '',
      password_salt: '',
    },
  );
});
