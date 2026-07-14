import type Database from 'better-sqlite3';
import type { MailboxMessage } from '@shop/contracts/mailbox';

interface MailboxRow {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  kind: string;
  created_at: string;
}

export interface MailboxRepository {
  add(input: {
    recipient: string;
    subject: string;
    body: string;
    kind: string;
    createdAt: string;
  }): void;
  list(): MailboxMessage[];
}

export function createMailboxRepository(db: Database.Database): MailboxRepository {
  return {
    add({ recipient, subject, body, kind, createdAt }) {
      db.prepare(
        `INSERT INTO dev_mailbox (recipient, subject, body, kind, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(recipient, subject, body, kind, createdAt);
    },
    list() {
      const rows = db
        .prepare(
          'SELECT id, recipient, subject, body, kind, created_at FROM dev_mailbox ORDER BY created_at DESC',
        )
        .all() as MailboxRow[];
      return rows.map((row) => ({
        id: String(row.id),
        recipient: row.recipient,
        subject: row.subject,
        body: row.body,
        kind: row.kind,
        created: row.created_at,
      }));
    },
  };
}
