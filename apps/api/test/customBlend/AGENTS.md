# AGENTS.md — apps/api/test/customBlend

Integration tests for the custom-blend feature (see root AGENTS.md for repository-wide testing setup).

## Local scope

- Integration only: customBlendEvaluation, customBlendOptions, customBlendRulesJourney (*.integration.test.ts).
- Use the seededDatabase fixture or `openDatabase()` from apps/api/test/support/seededDatabase.ts; never open apps/api/data/shop.db directly.
- Tests assert against documented seeded facts (e.g. specific lot/variant availability) — check the current seed data before changing assertions.
- Must run via `npm run test:integration` (apps/api/test/support/run-integration-tests.ts spawns an isolated child process per file against a seeded SQLite template).

## Pitfalls

- Running these files with a plain test runner bypasses the seeded template and WAL-checkpoint step and hits stale or locked data.
