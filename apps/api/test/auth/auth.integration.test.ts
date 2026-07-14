import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { closeDatabase, openDatabase } from '../../src/db/index.js';

function readError(response: { body: string }): string {
  const body: unknown = JSON.parse(response.body);
  assert.ok(typeof body === 'object' && body !== null && 'error' in body);
  assert.equal(typeof body.error, 'string');
  return body.error;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function firstMailboxMessageBody(response: { body: string }): string {
  const body: unknown = JSON.parse(response.body);
  assert.ok(isUnknownArray(body));
  const message = body[0];
  assert.ok(typeof message === 'object' && message !== null && 'body' in message);
  const messageBody = message.body;
  if (typeof messageBody !== 'string') throw new Error('Mailbox message body must be a string');
  return messageBody;
}

void test('auth services isolate sessions, reset tokens, and mailbox', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-auth-'));
  const db = openDatabase({ path: join(directory, 'shop.db') });
  let now = new Date('2026-07-13T12:00:00.000Z');
  let token = 'raw-reset-token-one';
  const app = await buildApp({
    db,
    resetBaseUrl: 'https://web.example.test/store',
    clock: { now: () => now },
    resetTokenSource: () => token,
  });
  t.after(async () => {
    await app.close();
    closeDatabase(db);
    rmSync(directory, { recursive: true, force: true });
  });

  const signupBody = {
    email: 'alice@example.test',
    password: 'password-one',
    displayName: 'Alice',
  };
  await t.test('duplicate signup race maps one account to one clean conflict', async () => {
    const [first, second] = await Promise.all(
      [1, 2].map(() => app.inject({ method: 'POST', url: '/signup', payload: signupBody })),
    );
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [201, 409]);
    assert.equal(
      (
        db
          .prepare('SELECT COUNT(*) AS count FROM users WHERE email = ?')
          .get('alice@example.test') as {
          count: number;
        }
      ).count,
      1,
    );
  });

  await t.test('reset link uses configured URL and raw token is never persisted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/forgot-password',
      payload: { email: signupBody.email },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      db
        .prepare('PRAGMA table_info(password_reset_tokens)')
        .all()
        .map((column) => (column as { name: string }).name),
      ['id', 'user_id', 'token_digest', 'expires_at', 'used_at', 'created_at'],
    );
    const row = db.prepare('SELECT token_digest FROM password_reset_tokens').get() as {
      token_digest: string;
    };
    assert.notEqual(row.token_digest, token);
    assert.equal(JSON.stringify(row).includes(token), false);

    const mailbox = await app.inject({ method: 'GET', url: '/api/dev/mailbox' });
    assert.equal(mailbox.statusCode, 200);
    const mailboxBody = firstMailboxMessageBody(mailbox);
    assert.match(
      mailboxBody,
      /https:\/\/web\.example\.test\/reset-password\?token=raw-reset-token-one/,
    );
  });

  await t.test('expired, used, and successful reset behavior remains deterministic', async () => {
    now = new Date(now.getTime() + 31 * 60 * 1000);
    const expired = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { token, newPassword: 'password-two' },
    });
    assert.equal(expired.statusCode, 400);
    assert.match(readError(expired), /expired/);

    token = 'raw-reset-token-two';
    await app.inject({
      method: 'POST',
      url: '/forgot-password',
      payload: { email: signupBody.email },
    });
    const reset = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { token, newPassword: 'password-two' },
    });
    assert.equal(reset.statusCode, 200);
    assert.equal(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM sessions WHERE user_id =
             (SELECT id FROM users WHERE email = 'alice@example.test')`,
          )
          .get() as { count: number }
      ).count,
      0,
    );
    const used = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { token, newPassword: 'password-three' },
    });
    assert.equal(used.statusCode, 400);
    assert.match(readError(used), /already been used/);
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/login',
          payload: { email: signupBody.email, password: 'password-one' },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/login',
          payload: { email: signupBody.email, password: 'password-two' },
        })
      ).statusCode,
      200,
    );
  });

  await t.test('reset rolls back password and session changes together on failure', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/signup',
      payload: { email: 'bob@example.test', password: 'password-one', displayName: 'Bob' },
    });
    assert.equal(signup.statusCode, 201);
    token = 'raw-reset-token-three';
    await app.inject({
      method: 'POST',
      url: '/forgot-password',
      payload: { email: 'bob@example.test' },
    });
    db.exec(
      `CREATE TRIGGER abort_reset_session_delete BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'session delete failed'); END`,
    );
    const failed = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { token, newPassword: 'password-two' },
    });
    assert.equal(failed.statusCode, 500);
    assert.equal(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM sessions WHERE user_id =
             (SELECT id FROM users WHERE email = 'bob@example.test')`,
          )
          .get() as { count: number }
      ).count,
      1,
    );
    assert.equal(
      (
        db
          .prepare(
            'SELECT used_at FROM password_reset_tokens WHERE token_digest IS NOT NULL ORDER BY id DESC',
          )
          .get() as {
          used_at: string | null;
        }
      ).used_at,
      null,
    );
    db.exec('DROP TRIGGER abort_reset_session_delete');
    const completed = await app.inject({
      method: 'POST',
      url: '/reset-password',
      payload: { token, newPassword: 'password-two' },
    });
    assert.equal(completed.statusCode, 200);
    assert.equal(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM sessions WHERE user_id =
             (SELECT id FROM users WHERE email = 'bob@example.test')`,
          )
          .get() as { count: number }
      ).count,
      0,
    );
  });
});
