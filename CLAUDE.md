# QArefully Materials Exchange

Local, non-live bulk-materials wholesale portal for QA education and repository-scale engineering exercises. No external services, no Docker, no API keys.

## Repository map

- `apps/api` — Fastify + SQLite. Feature dirs in `apps/api/src/features/`, HTTP in `apps/api/src/routes/`, DI composition root `apps/api/src/app.ts`, schema in `apps/api/src/db/migrations/`.
- `apps/web` — React + Vite SPA. Feature dirs in `apps/web/src/features/`, HTTP boundary `apps/web/src/api/`.
- `packages/contracts` — `@shop/contracts`, TypeBox transport schemas and shared structural constants.
- `packages/catalog` — `@shop/catalog`, canonical catalog/packaging data, `MIXING_GROUPS`.
- `packages/localisation` — `@shop/localisation`, translation and money/date/number presentation.
- `e2e` — Playwright specs. Not an npm workspace.
- `scripts` — repository quality checks invoked through `npm run`.
- `plans`, `workshop` — exercise material, not product code.

Reference instead of restating: `README.md` (seeded data, credentials, promo codes, test cards, troubleshooting), `e2e/README.md`, `workshop/feature-ticket.md` (QME-418 Custom Blend ticket).

## Runtime

- Node 22.x. `package.json` engines `>=22.0.0 <23.0.0`; API integration runner hard-asserts major === 22 and fails the suite otherwise.
- npm workspaces `apps/*`, `packages/*`; lockfile `package-lock.json`.
- `better-sqlite3` needs a native toolchain (Windows: VS Build Tools "Desktop development with C++").
- `postinstall` builds `@shop/contracts`, `@shop/catalog`, `@shop/localisation`. Apps resolve these through `dist/` via `exports` maps -> apps do not typecheck or run until packages are built. Editing package source after install needs a manual rebuild (`npm run build -w @shop/contracts`); only `npm ci`/`npm install` re-trigger `postinstall`.

## Commands

Root:

- install: `npm ci`
- run: `npm run dev` (seeds first, then API + web via `concurrently --kill-others`)
- typecheck: `npm run typecheck`
- lint: `npm run lint`; format: `npm run format`; fix: `npm run format:fix`
- localisation guard: `npm run check:localisation`
- tests: `npm test`, `npm run test:packages`, `npm run test:unit`, `npm run test:integration`
- e2e: `npm run test:e2e`, `npm run test:e2e:ui`
- fast gate: `npm run smoke` (typecheck + unit + integration)
- full gate: `npm run verify` (format, localisation, typecheck, lint, tests, workspace builds)

No CI exists (`.github/` holds only agent definitions). `npm run verify` is the definition of green; `npm run smoke` is the fast loop. `verify` includes `check:localisation`, `smoke` does not. No root `build` script; build per workspace or via `npm run build --workspaces --if-present`.

Single-file runs:

- API unit: `npx tsx --test apps/api/src/features/customBlend/customBlendRules.test.ts`
- API integration, from `apps/api`: `npm run test:integration -- test/customBlend/customBlendOptions.integration.test.ts`
- Web, from `apps/web`: `npx vitest run --configLoader runner src/features/customBlend/RatioEditor.test.tsx`
- Playwright: `npx playwright test e2e/catalog.spec.ts`

Destructive, requires user authorization:

- `npm run reset` — drops the database file, rebuilds from migrations and seed. All user-created data lost.
- `npm run seed` — idempotent upsert of canonical records; non-seed rows preserved. Runs automatically inside `npm run dev`.

## Architecture

Dependency direction is one-way and lint-enforced in `eslint.config.mjs` via `no-restricted-imports`:

- `packages/**` and `scripts/**` must not import `**/apps/**`.
- `apps/web/**` must not import `**/apps/api/**` or `@shop/api*`. Web uses contracts, never API source.
- `packages/contracts/**` must not import `**/apps/**` or `@shop/catalog*`. Contracts own transport schemas only.

Authority:

- API owns persistence, policy, and workflows. Web mirrors structural bounds for UX only; the server re-validates every fact at mutation time.
- `packages/contracts/src/` is the source of truth for transport shapes and structural constants. Never redeclare numeric policy locally — import the `CUSTOM_BLEND_*`, `SACK_WEIGHT_GRAMS`, `TIER_LADDER` style constants.
- `packages/contracts/src/country.ts` defines `SUPPORTED_COUNTRIES` (7: `UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`); `DEFAULT_GUEST_COUNTRY` is `US`.
- Integer GBP pence is authoritative for settlement, persistence, refunds. Country rates convert display figures only.
- `apps/api/src/db/index.ts` is the only DB lifecycle surface.

## Required patterns

- API and package source: ESM relative imports carry `.js` extensions (`./customBlendRepository.js`). Web source: `@/` alias for cross-feature imports, extensionless relative imports for siblings.
- New package module -> add an `exports` subpath in that package's `package.json`, or the import will not resolve.
- Web HTTP goes through `apiFetch(Schema, ...)` in `apps/web/src/api/client.ts`, which validates every successful response against the shared schema. Features never call `fetch` directly.
- API public errors go through `sendPublicError` (`apps/api/src/utils/errors.ts`), which validates metadata against the code-specific schema and localises it. Never `reply.send({ error: '...' })`.
- API routes declare TypeBox schemas per status via `app.withTypeProvider<TypeBoxTypeProvider>()`.
- New public error code -> add to `packages/contracts/src/publicErrors.ts` and to every country in `packages/localisation/src/messages/apiErrors.ts`, or `packages/localisation/test/api-errors.test.ts` fails.
- All user-facing copy lives in `packages/localisation/src/messages/`. The localisation guard (`scripts/check-localisation-core.mjs`) is AST-based and blocks hard-coded JSX text, visible props (`label`, `placeholder`, `alt`, `aria-label`, `helperText`, ...), error setters, and raw route error fields. Exemptions are an exact-path allowlist with no directory wildcards — the fix is a message key, not an allowlist entry.
- `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`.

Cross-layer change through the customBlend boundary touches, in order: contracts schema/constant -> rebuild contracts -> migration (only if persisted) -> repository -> rules -> resolver -> service -> route -> `apps/api/src/app.ts` (only if new wiring) -> localisation catalogs -> `apps/web/src/api/` -> web feature state/hook/component -> tests at each tier.

## Testing

- API unit: colocated `apps/api/src/**/*.test.ts`, plus an explicit file list in `apps/api/package.json`. Pure `node:test`, no DB, no Fastify.
- API integration: `apps/api/test/**/*.integration.test.ts` through `apps/api/test/support/run-integration-tests.ts`.
- Web unit: colocated `*.test.tsx` under vitest + jsdom (`apps/web/vite.config.ts`, setup `apps/web/src/test/setup.ts`).
- Web integration: `apps/web/src/**/*.integration.test.tsx` via `apps/web/vitest.integration.config.ts`; excluded from the unit tier by name.
- Packages: `node:test` via `tsx`, tests in `packages/*/test/`.
- E2E is owned exclusively by `e2e/`. No other layer drives a browser.

## Generated paths

Never hand-edit or commit: `dist/`, `*.tsbuildinfo`, `apps/api/data/shop.db` (`*.db`, `*.db-journal`), `playwright-report/`, `test-results/`, `blob-report/`, `.playwright-cli/`. `apps/web/src/data/` is real source despite the `data/` ignore rule — it is force re-included in `.gitignore`.

## Pitfalls

- Packages resolve through `dist/`. A contracts edit without `npm run build -w @shop/contracts` leaves apps compiling against stale types.
- `apps/api/test/` and `e2e/` are not covered by `npm run typecheck` (`apps/api/tsconfig.json` includes only `src`; `apps/api/test/tsconfig.json` and `e2e/tsconfig.json` are referenced by no script). Type errors there surface only via `eslint .` or at runtime.
- A new test file under `apps/api/test/` not named `*.integration.test.ts` runs in no tier until added to the explicit `test:unit` list in `apps/api/package.json`.
- `apps/web` vite/vitest invocations require `--configLoader runner`; omitting it deviates from every working script.
- Logged-out visitors default to country `US`. UK seeded accounts fail to log in until the country selector is changed to `UK`.
- `README.md` script table omits `test:packages`, `test:profile`, `test:e2e`, `test:e2e:ui`. Treat `package.json` as authoritative.
- WARNING: `README.md` asserts GBP-pence authority but its promo and clearance tables show `$` amounts. Unresolved doc inconsistency; trust the code.

## Maintenance

Update applicable instruction file when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. Instruction/evidence conflict -> warn user with "WARNING".
