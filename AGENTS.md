# AGENTS.md

QArefully Materials Exchange: TypeScript/Node.js 22 monorepo, wholesale catalog + custom-blend ordering demo, zero external services.

## Repository map

- apps/api -> Fastify 5 API, TypeBoxTypeProvider validation, better-sqlite3 persistence (apps/api/data/shop.db).
- apps/web -> React 18 + Vite + React Router, Vitest.
- packages/contracts -> TypeBox schemas, single source of truth for request/response/domain shapes.
- packages/catalog, packages/localisation -> shared domain/display libraries.
- e2e -> Playwright end-to-end tests.
- scripts -> localisation consistency checks, test profiling.

## Runtime

- Node.js 22.x exact (package.json engines).
- npm workspaces; `npm install` postinstall builds contracts, catalog, localisation before anything else can typecheck.
- SQLite db auto-created on first `npm run dev`; override path via `SHOP_DB_PATH`.

## Commands

- `npm run dev` -> seed db, start api:3001 + web:5173 (web proxies /api/*).
- `npm run seed` / `npm run reset` -> idempotent upsert / truncate+reseed.
- `npm run typecheck` -> tsc --noEmit across workspaces.
- `npm test` -> test:packages + test:unit + test:integration.
- `npm run test:integration` -> spawns child processes against a seeded SQLite template (apps/api/test/support/run-integration-tests.ts); do not run integration test files with a plain test runner.
- `npm run test:e2e` -> Playwright against http://127.0.0.1:5173.
- `npm run lint` / `npm run verify` -> verify = format + check:localisation + typecheck + lint + test + build.

## Architecture

- Dependency direction is one-way and eslint-enforced (eslint.config.mjs no-restricted-imports): packages/contracts -> apps/*, other packages; packages never import apps/* source; apps/web never imports apps/api source.
- apps/api owns persistence, validation enforcement, checkout/payment state machine, audit trail. apps/web mirrors those bounds for UX only and never substitutes for server validation.
- Feature module pattern, apps/api/src/features/<name>: repository (SQL) -> resolver/service (business logic) -> apps/api/src/routes/<name>.ts (FastifyInstance + AppContext). Wire new features into apps/api/src/app.ts: import creators, add to `AppServices` interface, compose in `createAppServices()`, `app.register(<name>Routes, context)`.
- Schemas defined once in packages/contracts/src/<name>.ts (TypeBox `Type.Object`), re-exported from packages/contracts/src/index.ts, consumed by api routes and web (`Value.Parse`).
- Translations live in packages/localisation/src/messages/<name>.ts via `defineMessages()` keyed by country (UK, US, CN, PL, ES, DE, FR); accessed with `translate(messages, country, key, params)`. Pricing, settlement, refunds, receipts stay integer GBP pence regardless of locale; only display is country-aware.

## Testing

- Unit: Node test runner (api) / Vitest (web), no DB, colocated `*.test.ts(x)`.
- Integration: apps/api/test/<feature>/*.integration.test.ts, seeded SQLite via apps/api/test/support/seededDatabase.ts, run only through `npm run test:integration`.
- E2E: e2e/*.spec.ts, Playwright, page-object model under e2e/pages.

## Agent hints

- A cross-layer change touches, in order: packages/contracts schema -> apps/api feature (repository/resolver/service/routes + app.ts wiring) -> apps/api/test integration coverage -> apps/web feature consumer -> packages/localisation messages if user-facing copy changes.
- Shared resolver instances (e.g. custom-blend resolver) are composed once in apps/api/src/app.ts `createAppServices()` and passed into dependent services (e.g. cart) so every path observes identical facts/clock/pricing. Never construct a second instance.
- Every cart/checkout/order mutation requires an AuditContext (actor type + userId + requestId); anonymous requests use `actor.type='anonymous'`.

## Pitfalls

- Integration test child processes need the seeded SQLite template WAL-checkpointed (`wal_checkpoint(TRUNCATE)`) and `--experimental-test-isolation=process` (apps/api/test/support/run-integration-tests.ts); running integration tests any other way hits stale or locked data.
- packages/* importing apps/* source, or apps/web importing apps/api source, fails lint (eslint.config.mjs no-restricted-imports), not just review.

## Maintenance

Update applicable instruction file when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. Instruction/evidence conflict -> warn user with "WARNING".
