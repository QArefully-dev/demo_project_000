# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QArefully Materials Exchange — a local-only bulk-materials wholesale portal (npm workspaces monorepo) built for QA education and repository-scale engineering exercises. No external services, no Docker, no API keys. Node 22.x only (`engines` pins `>=22 <23`; the API integration runner hard-asserts major 22).

Read `README.md` for the full functional surface: seeded users, promo codes, test cards, country/localisation demos, admin-only HTTP APIs (lifecycle, inventory receipts, returns), async job-queue fault flags, and back-in-stock ordering. It is the source of truth for seeded-data facts.

## Commands

```bash
npm ci                      # installs + builds contracts, catalog, localisation via postinstall
npm run dev                 # seed, then API (3001) + web (5173) concurrently
npm run seed                # idempotent upsert of canonical rows, preserves non-seed data
npm run reset               # drop DB, rebuild from migrations + seed to known state

npm run verify              # format + check:localisation + typecheck + lint + test + build (full gate)
npm run smoke               # typecheck + unit + integration (fast gate)
npm run typecheck           # tsc --noEmit across workspaces
npm run lint                # eslint (type-checked rules; needs built package dist/)
npm run format:fix          # prettier --write
npm run check:localisation  # AST guard for untranslated copy / raw Intl use
```

Tests:

```bash
npm test                    # packages + unit + integration
npm run test:unit           # web + api unit
npm run test:integration    # web + api integration
npm run test:e2e            # playwright (starts npm run dev itself, reuses a running app)
```

Running a single test:

```bash
# API unit (node:test via tsx)
npx tsx --test apps/api/src/features/pricing/pricingRules.test.ts

# API integration — must go through the runner, which builds the seeded template DB first
npm run test:integration -w @shop/api -- test/cart/cartBulkAdd.integration.test.ts
npm run test:integration -w @shop/api -- --test-name-pattern "below MOQ"

# Web (vitest), from apps/web
npx vitest run --configLoader runner src/features/cart/CartPage.test.tsx
npx vitest run --configLoader runner --config vitest.integration.config.ts <path>

# E2E
npx playwright test e2e/catalog.spec.ts -g "no matches"
```

`SHOP_TEST_CONCURRENCY` overrides API integration concurrency. Playwright browsers need `npx playwright install chromium` once per machine.

## Architecture

Dependencies flow strictly one way, and ESLint `no-restricted-imports` enforces it — violating the layering fails `npm run lint`, not just review:

- `@shop/contracts` — TypeBox transport schemas, shared by API and web. May not import apps **or** `@shop/catalog`.
- `@shop/catalog` — canonical catalog/packaging data.
- `@shop/localisation` — country-aware translation and money/date/number formatting.
- `apps/api` — persistence and workflows (Fastify + better-sqlite3).
- `apps/web` — React/Vite SPA. May import API *contracts* only, never `apps/api` source.
- `packages/**` and `scripts/**` may not import app-private source.

The packages are consumed as built `dist/` output (subpath exports like `@shop/contracts/cart`). After editing a package, rebuild it (`npm run build -w @shop/contracts`) or typecheck/lint will use stale types.

### API layering

Every feature is `repository → service → route`, all plain factory functions (`createXRepository`, `createXService`), composed by hand in `apps/api/src/app.ts`, which builds an `AppContext` of services that routes destructure. There is no DI container. Adding a feature means: migration → repository → service → route → register in `app.ts`.

- `apps/api/src/features/<domain>/` — the layers plus pure `*Rules.ts` modules holding business logic (MOQ, pricing tiers, clearance windows, delivery lead times, job retry). Rules files are pure and unit-tested in place as `*.test.ts`; services own orchestration and persistence.
- `apps/api/src/routes/` — thin Fastify handlers with TypeBox schemas from `@shop/contracts`; they map errors via `sendPublicError` and build an `AuditContext` from the request.
- `apps/api/src/db/migrations/` — numbered, append-only (`001_…` upward). Never edit an applied migration; add the next number and register it in `migrations/index.ts`.
- `apps/api/src/mappers/` — row → contract shape conversion.

Config is read from env in `apps/api/src/config.ts`: `SHOP_DB_PATH`, `SHOP_API_PORT`, `SHOP_API_HOST`, `SHOP_SEED`, `SHOP_RESET_BASE_URL`, `SHOP_WEBHOOK_SECRET`.

### Web layering

`apps/web/src/features/<domain>/` for pages and components; `apps/web/src/api/<domain>.ts` for the typed client per domain, all built on `apps/web/src/api/client.ts`. The client validates every successful response against its shared TypeBox schema before feature code sees it, and normalizes failures into `ApiError` carrying a `PublicErrorCode`, safe `meta`, and the country active *when the request was issued*. Add new endpoints by extending a domain client, not by calling `fetch` in a component.

### Cross-cutting invariants

These are deliberate design properties; changes that break them are almost certainly bugs.

- **GBP is authoritative.** Settlement, persistence, refunds, and receipts are integer GBP pence. Country rates convert at render time only; no converted amount is ever stored, charged, or refunded.
- **Checkout is a server-owned payment-intent workflow.** The API validates cart/promo/details/card, reserves cart and promo capacity, persists an immutable quote, then calls the simulated gateway with that quote total. Later cart changes cannot alter an authorized payment.
- **Idempotency + optimistic concurrency.** Checkout and every admin command take a UUID `idempotencyKey`; replaying the same key with the same payload replays the outcome, a different payload returns a conflict. Admin lifecycle/return commands also take the current `version`; a stale version is a conflict.
- **No card data retained.** Card numbers and CVC never reach quotes, fingerprints, or payment responses.
- **Audit trail.** Mutating services take an `AuditWriter` and an `AuditContext` derived from the request.

### Localisation guard

`npm run check:localisation` is a TypeScript-AST check (`scripts/check-localisation-core.mjs`) that catches hard-coded user-facing copy and raw `Intl` use at the first user-facing boundary. Route new copy through `@shop/localisation` message keys and its formatters. The allowlist in that file is exact-path and reason-documented — adding an entry is a deliberate act, and there is no directory wildcard escape hatch.

## Testing layout

| Tier | Where | Runner |
| --- | --- | --- |
| Package tests | `packages/*/test/`, `packages/catalog/src/catalog.test.ts` | `tsx --test` |
| API unit | `apps/api/src/**/*.test.ts` (beside the rules they cover) plus a few `apps/api/test/**` files | `tsx --test` |
| API integration | `apps/api/test/**/*.integration.test.ts` | custom runner |
| Web unit | `apps/web/src/**/*.test.{ts,tsx}` | vitest (jsdom) |
| Web integration | `apps/web/src/**/*.integration.test.{ts,tsx}` | vitest, separate config |
| E2E | `e2e/*.spec.ts` | Playwright |

API integration tests do **not** run under plain `node --test`. `apps/api/test/support/run-integration-tests.ts` seeds one template SQLite file, asserts it is FK-clean, WAL-checkpoints and closes it, then spawns the real runner with `--experimental-test-isolation=process`; each test clones the template via `seededDatabase.ts` and builds a real app with `buildApp`. Process isolation is required and the runner rejects attempts to disable it. Adding a new API unit test file outside `src/**/*.test.ts` means adding it to the explicit `test:unit` list in `apps/api/package.json`.

### E2E conventions

`e2e/README.md` is authoritative. Key rules: locate by role/label/placeholder — **never add `data-testid` to application code**; page objects in `e2e/pages/` expose `Locator`s and navigation with no assertions; assertions live in specs and use web-first `expect`, never `waitForTimeout`; avoid `.first()` on a locator meant to identify one thing (scope it instead); assert result *counts* so a broken filter fails; pin seeded-data facts to named constants with a comment.

For agent-driven browser exploration this repo standardizes on `@playwright/cli` (shell commands, identical in every harness, cheaper in context) rather than `playwright-mcp`. Run it from outside the repo — it writes a `.playwright-cli/` directory.

## Conventions

- TypeScript strict throughout, plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` (`tsconfig.base.json`). ESM only — relative imports carry the `.js` extension.
- Prettier: single quotes, semicolons, trailing commas, 100 columns, 2-space indent.
- Comments here explain *why* a non-obvious constraint exists (WAL checkpointing before copy, the legacy-country fallback on a bodyless cart POST). Match that register: explain the constraint, not the syntax.

## Agent configuration

`.claude/commands/test-plan.md` is the test-planning command; parallel definitions of the same test-planner exist for other harnesses (`.github/agents/`, `.cursor/skills/`, `.codex/agents/`, `.opencode/agent/`). If you change one, change the others to match. `.claude/skills/workshop-env/` is workshop machine setup, not project code.
