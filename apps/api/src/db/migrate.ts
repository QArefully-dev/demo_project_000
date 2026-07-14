import type Database from 'better-sqlite3';
import { migrations } from './migrations/index.js';

export interface Migration {
  version: string;
  name: string;
  up(db: Database.Database): void;
}

function validateMigrations(available: readonly Migration[], applied: readonly string[]): void {
  const versions = available.map((migration) => migration.version);
  if (new Set(versions).size !== versions.length) {
    throw new Error('Migration versions must be unique');
  }

  for (const version of applied) {
    if (!versions.includes(version)) {
      throw new Error(`Database has unknown migration version ${version}`);
    }
  }

  let expectedIndex = 0;
  for (const version of applied) {
    const index = versions.indexOf(version);
    if (index !== expectedIndex) {
      throw new Error(`Database migration history is not ordered at version ${version}`);
    }
    expectedIndex += 1;
  }
}

/** Apply each unrecorded migration once. Each schema change and ledger entry share one transaction. */
export function migrateDatabase(
  db: Database.Database,
  availableMigrations: readonly Migration[] = migrations,
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map((row) => (row as { version: string }).version);
  validateMigrations(availableMigrations, applied);

  const recorded = new Set(applied);
  for (const migration of availableMigrations) {
    if (recorded.has(migration.version)) continue;

    db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
    })();
  }
}
