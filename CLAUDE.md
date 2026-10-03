# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QArefully Materials Exchange: a local-only bulk-materials wholesale shop (React web + Fastify/SQLite API) built for QA education. Everything runs offline with no external services. Requires **Node 22.x**; the API integration runner refuses to start on any other major version.

## Commands

```bash
npm ci                     # install; postinstall builds packages/contracts, catalog, localisation into dist/
npm run dev                # seed DB if needed, then API (:3001) + Vite web (:5173, proxies /api)
npm run reset              # drop DB and rebuild from migrations + seed (restores all README fixtures)
npm run verify             # full gate: format, localisation guard, typecheck, lint, all tests, builds
npm run smoke              # typecheck + unit + integration
npm run lint / npm run format / npm run format:fix / npm run typecheck
npm run check:localisation # AST guard against hard-coded user-facing copy (see Localisation)
npm run test:e2e           # Playwright (Chromium); starts `npm run dev` or reuses a running app
```

Running a single test:

```bash
# API unit (node:test via tsx; colocated src/**/*.test.ts)
cd apps/api && npx tsx --test src/features/cart/cartBulkAddRules.test.ts

# API integration (test/**/*.integration.test.ts). Pass a path to skip the default glob;
# --test-name-pattern also works. SHOP_TEST_CONCURRENCY=<n> limits parallelism.
npm run test:integration -w @shop/api -- test/cart/cart.integration.test.ts

# Web unit/component (Vitest + jsdom + Testing Library)
cd apps/web && npx vitest run --configLoader runner src/features/cart/CartPage.test.tsx

# Web integration (*.integration.test.ts[x], separate config)
cd apps/web && npx vitest run --configLoader runner --config vitest.integration.config.ts <file>

# Packages
npm run test -w @shop/contracts   # likewise @shop/catalog, @shop/localisation

# E2E
npx playwright test e2e/catalog.spec.ts
```

The API `test:unit` script lists a few `test/*.test.ts` files explicitly. If you add a non-integration test under `apps/api/test/`, add it to that script or it won't run.

## Architecture

npm workspaces: `apps/api`, `apps/web`, `packages/{contracts,catalog,localisation}`.

**Dependency direction is enforced by ESLint `no-restricted-imports`:**
- `@shop/contracts`: TypeBox request/response schemas, public error codes, country profiles. Must not import catalog or app code.
- `@shop/catalog`: canonical product, variant, and packaging data plus bundles.
- `@shop/localisation`: translation messages and locale-aware money/number/date formatters.
- `apps/api` owns persistence and workflows. `apps/web` consumes contracts only and **must never import API source**.
- Packages and `scripts/` must not import from `apps/`.

Packages are consumed from their built `dist/` via subpath `exports` (e.g. `@shop/contracts/cart`). **After changing a package, rebuild it** (`npm run build -w @shop/contracts`) before the apps or typecheck see the change. A new contracts module also needs an entry in `packages/contracts/package.json` `exports`.

### API (`apps/api/src`)
- `app.ts` `buildApp()` is the composition root: it constructs every repository and service by hand (factory functions `createXRepository(db)` / `createXService(...)`) and passes them to route modules as `AppContext.services`. There is no DI container, so a new feature must be wired here.
- `routes/*.ts`: Fastify plugins using `TypeBoxTypeProvider`, with schemas imported from `@shop/contracts`. Errors go through `sendPublicError` (`utils/errors.ts`) using codes from `@shop/contracts/public-errors`.
- `features/<area>/`: `*Repository.ts` holds raw better-sqlite3 SQL, `*Service.ts` holds business rules, and `*Rules.ts` holds pure logic with colocated unit tests. Multi-table writes use `UnitOfWork.run()` (`db/unitOfWork.ts`, synchronous SQLite transactions).
- `plugins/auth.ts` (cookie session → `request.authenticatedUser`) and `plugins/countryContext.ts` (request country).
- `db/migrations/NNN_*.ts`: sequential TS migrations registered in `db/migrations/index.ts`. The current head is `038`; the README states the head number, so update it when you add one. Seeds (`db/seed.ts` plus `*Seed*.ts` scenario files) are idempotent upserts that preserve non-seed rows. `reset` restores fixtures exactly.
- Services take an injectable `Clock` and gateway (`features/payments/paymentGateway.ts`, simulated) so tests can be deterministic.

### Web (`apps/web/src`)
- `api/*.ts`: one module per feature, all built on `api/client.ts` `apiFetch(schema, path, init)`. Every successful response is **validated against its contracts schema at runtime** before feature code sees it. Failures become `ApiError` with a typed `code`/`meta` and the request country.
- `features/<area>/`: pages and components. `components/` holds shared and shadcn/Base UI components (Tailwind v4). `@/` aliases `src/`.
- `i18n/LocaleContext.tsx` provides the active country/locale. Cart and country are persisted client-side in `lib/cartStorage.ts` and `lib/countryStorage.ts`.

### Domain invariants worth knowing before editing
- **Money is integer GBP pence everywhere authoritative** (persistence, payment, refunds, receipts). Country exchange rates are for display only and are applied at render time. Never store or charge a converted amount.
- **Checkout is a server-owned payment-intent flow.** The server validates, reserves cart and promo capacity, persists an immutable quote, and charges that quote. Finalization builds the order from the quote, not the live cart. Every request carries an **idempotency key**: the same key with the same payload replays the result, and the same key with a different payload returns a conflict. Card number and CVC are never persisted. Admin mutations use the same idempotency-key plus optimistic `version` pattern.
- **Country scoping.** Seven country profiles (`UK, US, CN, PL, ES, DE, FR`) drive accounts (the same email can exist once per country, with separate passwords and carts), server-side category blocking, postcode and delivery rules, promo targeting, and translations. Guests default to `US`.
- Stock is held in a 15-minute checkout reservation. Restock paths (admin receipts, variant stock writes, returns, cancellations) all go through the same path, which queues back-in-stock jobs. Async work (notifications, webhooks, standing orders) runs through a job queue that is drained manually from the admin UI.

### Localisation
User-facing copy must go through `@shop/localisation` message modules (`packages/localisation/src/messages/*`) and its formatters. `scripts/check-localisation-core.mjs` scans the TS AST for hard-coded JSX text, visible props, error strings, and direct `Intl`/`toLocale*` formatting. Its allowlist names exact files and functions, so add an entry only with a justification comment.

## Testing conventions

- API integration tests run each file in its own process against a clone of a pre-seeded SQLite template (`test/support/seededDatabase.ts`), so tests can depend on seeded fixtures and mutate freely.
- E2E (`e2e/README.md`): page objects in `e2e/pages/` expose locators only, and assertions live in specs. Locate elements by role, label, or placeholder; **never add `data-testid` to app code**. Use web-first assertions and never `waitForTimeout`. Avoid `.first()` on a locator meant to match one thing. Assert counts. Pin seeded-data facts to named constants with a comment.
- For agent browser exploration, use the **`playwright-cli` shell tool (see `.claude/skills/playwright-cli`), not a Playwright MCP server**. It writes a gitignored `.playwright-cli/` scratch directory.
- Seeded credentials, promo codes, test cards (`4242…` succeeds, `4000 0000 0000 0002` declines, `…0069` times out), and fixture orders/SKUs are documented in `README.md`. UK accounts (`alice@`/`bob@`/`admin@example.com`, password `Password123!`) need the login country dropdown set to `UK`.

## Style

Prettier: single quotes, semicolons, trailing commas, 100-character width, 2-space indent, LF. ESLint uses `typescript-eslint` recommended-type-checked rules. All packages are ESM, and API source uses `.js` extensions in relative imports.
