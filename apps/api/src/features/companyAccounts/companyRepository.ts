import type Database from 'better-sqlite3';

export interface CompanyRow {
  id: number;
  name: string;
  created_by_user_id: number;
  active: number;
  approval_threshold_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyRepository {
  create(input: { name: string; createdByUserId: number; now: string }): CompanyRow;
  findActiveById(id: number): CompanyRow | null;
  updateThreshold(id: number, thresholdCents: number | null, now: string): void;
}

export function createCompanyRepository(db: Database.Database): CompanyRepository {
  const get = (id: number) =>
    (db
      .prepare(
        `SELECT id, name, created_by_user_id, active,
    approval_threshold_cents, created_at, updated_at FROM company_accounts WHERE id = ? AND active = 1`,
      )
      .get(id) as CompanyRow | undefined) ?? null;
  return {
    create({ name, createdByUserId, now }) {
      const id = Number(
        db
          .prepare(
            `INSERT INTO company_accounts
        (name, created_by_user_id, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`,
          )
          .run(name, createdByUserId, now, now).lastInsertRowid,
      );
      return get(id)!;
    },
    findActiveById: get,
    updateThreshold(id, thresholdCents, now) {
      db.prepare(
        `UPDATE company_accounts SET approval_threshold_cents = ?, updated_at = ?
        WHERE id = ? AND active = 1`,
      ).run(thresholdCents, now, id);
    },
  };
}
