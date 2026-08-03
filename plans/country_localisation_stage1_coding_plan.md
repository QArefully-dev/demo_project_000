# Country Localisation Stage 1 Coding Plan

Status: proposed
Source: `plans/country_localisation_handoff.md` -> `Delivery Stages` stage 1 ("country exists"); high-level plan item 10
Repository baseline: branch `expansion_002`, `HEAD c452c4c`, migration head `031`, inspection date 2026-08-03

## Runtime Worktree

- source: current branch at runtime -> record branch and `HEAD` before any write
- create: dedicated implementation branch + worktree before first implementation write
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree
- integration: no merge, rebase, cherry-pick, copy-back, worktree deletion; user owns integration
- completion reply: absolute worktree path + implementation branch + source branch + base revision
- source checkout stays read-only after worktree creation, except this saved plan and run-scoped temp state

## Objective

Make country a first-class identity axis with no other visible behaviour change. After stage 1: seven countries exist as a shared contract enum; one account belongs to exactly one country; same email may exist once per country as separate accounts with separate passwords and carts; login carries country; top bar carries a country picker visible to logged-out visitors defaulting `US` and remembered in browser; all pre-existing rows read `UK`; seed proves the same-email-two-countries case; README states seeded country out loud.

Completion boundary: identity, persistence, transport, selection, seed, docs. No availability, blocking, banner, promo targeting, postcode, timezone, translation, or money work.

## Scope

### In

- `Country` transport enum -> `UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`
- migration `032` -> `users` rebuild for composite uniqueness; `country` column on `orders`, `carts`, `company_accounts`; backfill `UK`
- `users` uniqueness -> `(email, country)` replaces `email`
- signup, login, password reset, session read -> country-qualified
- `PublicUser.country` exposed on `/signup`, `/login`, `/me`
- cart creation carries country; cart id kept per country in browser
- top-bar country picker; login and signup country dropdowns
- guest country default `US`, persisted in browser, versioned storage
- account country wins on login; guest cart does not follow into a different country, stated plainly
- seed fixtures -> all seeded accounts `UK`; new `alice@example.com` `DE` account with different password and own cart
- README + `AGENTS.md` + high-level plan status sync

### Out

- category or product blocking, `BLOCKED_IN_COUNTRY` skip reason, catalog filtering
- country banners, country-targeted promos, admin country scoping across nine sections
- cross-border delivery refusal, per-country postcode rule or label, timezone delivery cut-off
- per-country config files (language, exchange rate, formats, blocked lists, banner)
- translation lookup layer, money/date formatter deforking, display currency conversion
- narrowing `packages/contracts/src/address.ts` `CountryCode`; postal address stays ISO alpha-2
- `country` column on `saved_lists` (derivable via `user_id`) and `products` (contradicts shared stock pool + config-file availability); user-confirmed 2026-08-03
- per-country stock, geolocation detection, multi-country companies

## Repository Findings

- existing: `apps/api/src/db/migrations/001_initial.ts:67` -> `users` with `email TEXT NOT NULL UNIQUE` inline column constraint; only implicit `sqlite_autoindex_users_1`
- existing: `apps/api/src/db/migrations/027_admin_surface.ts:33` -> `users` gained `suspended_at`, `suspension_reason`, `suspended_by_user_id INTEGER REFERENCES users(id)` self-FK; `users` never rebuilt
- existing: `apps/api/src/db/migrate.ts` -> `Migration { version, name, up(db) }`; hand-registered array in `migrations/index.ts`; strict prefix ordering; one transaction per migration; `PRAGMA foreign_key_check` before commit; FK enforcement suspended for whole run
- constraint: migrations must not toggle `foreign_keys` internally (021+ convention, `AGENTS.md:50`); new migration must be appended and numbered `032`
- reuse: `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> guard -> `*_new` table -> explicit column list `INSERT ... SELECT` -> `DROP` -> `RENAME` -> index -> `assertForeignKeysClean`. Closest precedent for constraint swap
- reuse: `apps/api/src/db/migrations/021_remove_powderizer.ts:166` -> parent-table rebuild precedent; row-count assertion + `sqlite_sequence` AUTOINCREMENT high-water-mark restore. Required because `users` is FK parent to ~20 tables
- reuse: `apps/api/src/db/migrations/019_variant_moq.ts` + `027:10` `addColumnIfMissing` -> `ALTER TABLE ... ADD COLUMN` precedent for non-rebuilt tables
- existing: `apps/api/src/features/auth/userRepository.ts:57` -> `findCredentialsByEmail(email)` -> `SELECT ... FROM users WHERE email = ?`. Security-critical seam
- existing: `apps/api/src/features/auth/authService.ts:67` -> `isUniqueEmailError` matches `/UNIQUE constraint failed: users\.email/`; feeds `EMAIL_EXISTS` -> 409 at `apps/api/src/routes/auth.ts:56`
- existing: `apps/api/src/features/passwordReset/passwordResetRepository.ts:40` -> `SELECT id, email FROM users WHERE email = ? AND password_hash != ''`; ambiguous under composite key
- existing: `apps/api/src/features/auth/sessionRepository.ts:76` -> `findUser` joins `users` for `email`, `display_name`, `role`; must also select `country` for `/me`
- existing: `apps/api/src/plugins/auth.ts` -> opaque `sid` cookie + `sessions` row; no JWT; `requireAuth`/`requireAdmin`/`requireCustomer`
- gap: no country, locale, region, currency, or timezone concept on identity anywhere in repo
- constraint: `packages/contracts/src/address.ts:30` -> `CountryCode = Type.String({ pattern: '^[A-Z]{2}$' })`, ISO-3166 alpha-2, seeded `'GB'`. Account country uses `'UK'`, which is not ISO alpha-2. Two distinct concepts; must not be unified
- existing: `packages/contracts/src/auth.ts` -> `PublicUser`, `LoginBody`, `SignupBody`; enum convention is hand-written `Type.Union([Type.Literal(...)])` + same-named `Static` export (`src/reorder.ts:16` `ReorderSkipReason`)
- constraint: adding a contracts module requires three edits -> source file, `export * from './x.js'` in `packages/contracts/src/index.ts`, kebab-case subpath in `packages/contracts/package.json` `exports`
- obsolete plan claim: handoff `Country Selection` cites `routes/cart.ts:28` `{ type: 'anonymous', userId: null }` as anonymous-cart evidence. That literal is the audit actor (`AuditActor` in `apps/api/src/features/audit/auditEvent.ts:131`), not cart ownership
- existing: `carts` table is `(id TEXT PRIMARY KEY, created_at, updated_at)` only. No `user_id`, no owner column, no join table. Cart is a bearer capability; possession of UUID is identity. `apps/api/src/features/cart/cartService.ts:297` `createCart` -> `crypto.randomUUID()`
- existing: `apps/web/src/lib/cartStorage.ts` -> single localStorage key `shop-qarefully-cart-id`; `apps/web/src/hooks/cartClient.ts` -> `loadOrCreate` / `recoverMissingCart`
- reuse: `apps/web/src/features/comparison/comparisonStorage.ts` -> versioned key `shop.comparison.product-ids.v1`, try/catch on every access, validate-on-read, injectable `Pick<Storage,'getItem'|'setItem'|'removeItem'>`. Correct precedent for guest-country storage
- existing: `apps/web/src/components/Layout.tsx` -> provider nest, `AuthProvider` outermost; `apps/web/src/components/Header.tsx:28` -> `role="group" aria-label="Customer tools"` cluster renders unconditionally, only `NotificationBell` gated on `user`
- existing: `apps/web/src/components/ui/dropdown-menu.tsx:182` -> `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` exist with zero consumers. No `select.tsx` primitive; native `<select>` used in 19 files (`features/catalog/CatalogToolbar.tsx` cleanest)
- existing: `apps/web/src/hooks/AuthContext.tsx` -> `useAuth`, `AuthProvider`; `login(email, password)` positional; no localStorage; session survives by `getMe()` refetch
- constraint: `apps/web/src/api/client.ts` validates every success response with `Value.Check`, throwing `ApiContractError`. Contract change must land before web consumes new field
- existing: `apps/api/src/db/seed.ts:361` -> `seededPassword(email)` derives salt from email alone. Same email in two countries would yield identical hash, defeating the "different passwords" fixture
- existing: `apps/api/src/db/seed.ts:657` -> `ON CONFLICT(email) DO UPDATE` for suspended user. Conflict target requires unique index on `email` alone; breaks under composite unique
- existing: email-only user lookups in `apps/api/src/db/seed.ts:687`, `companyAccountsSeed.ts:12`, `backInStockSeed.ts:18`, `savedListSeed.ts:21`, `orderSeedScenarios.ts:296`, `reviewSeedScenarios.ts:45`, `seedAsyncScenarios.ts:29`
- existing: `apps/api/test/db/migrations.integration.test.ts:22` -> `expectedVersions` hard-coded `'001'..'031'`; must gain `'032'`
- constraint: `apps/api/test/**` and `apps/api/src/features/**` insert users with raw SQL omitting new columns. `country TEXT NOT NULL DEFAULT 'UK'` keeps these compiling and passing; do not make the column defaultless
- existing: `apps/api/src/db/reset.ts:86` -> ordered `DELETE FROM` list, `users` last. Stage 1 adds no table, so list is unchanged
- constraint: `npm run verify` -> `npm test` -> `@shop/web` `test` == `test:unit` only. Web integration tier is invisible to `verify`; schedule `npm run test:integration -w @shop/web` explicitly
- constraint: Node not on default `PATH`. Prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` before any node/npm command (`AGENTS.md:81`)
- existing: `apps/api/data/shop.db` on disk is stale (only `001`..`023` applied). Never treat it as schema reference; reconstruct via runner against fresh database

## Decisions and Invariants

- `Country` is a new contracts enum, separate from `address.ts` `CountryCode`. Never unify. Account country `'UK'`; postal country `'GB'`. Both remain valid simultaneously
- `Country` owns no availability, price, currency, format, or timezone meaning in stage 1. Enum plus identity only
- server is sole authority on account country. Client-selected country never overrides authenticated account country
- guest country is client state only. Default `US`. Persisted under versioned key. Never inferred from IP, geolocation, or delivery address
- `users` uniqueness invariant: `(email, country)` unique. Right password + wrong country must fail exactly as wrong password fails, with identical 401 body and no country disclosure
- login failure response stays `'Invalid email or password'` for wrong credentials, wrong country, and suspended account. No enumeration of which countries hold an email
- password reset is country-qualified. Request for an email in a country with no account is a silent no-op, matching existing non-enumeration behaviour
- `country TEXT NOT NULL DEFAULT 'UK' CHECK (country IN (...))` on every new column, so pre-existing raw-SQL inserts across seed and tests keep working
- migration `032` is forward-only, idempotent, transactional, FK-clean. `users` rebuild preserves self-FK `suspended_by_user_id`, row count, and `sqlite_sequence` high-water mark
- cart country is set at cart creation and never mutated. Switching country selects a different cart; it never rewrites an existing cart's country
- guest cart does not follow across a country change. Never silently merge, never silently bin. Surface a plain message
- account deletion tombstone `deleted-${userId}@tombstone.local` already embeds the id, so it stays unique under composite key. Do not add country to the tombstone address
- assumption (validate at `G0`): admin top-bar country switching beyond guest-country selection, and admin nine-section country scoping, are stage 2. Stage 1 gives every visitor one picker; per-country cart isolation falls out of cart-id-per-country and needs no admin-only path
- assumption (validate at `G0`): `company_accounts.country` lands in stage 1 as data only. Cross-country invite rejection is stage 2 behaviour
- assumption (validate at `G0`): `POST /api/cart` gains an optional country defaulting `UK`, keeping existing callers and tests valid

## Target Design

### Contracts

- new `packages/contracts/src/country.ts`
- `Country` -> `Type.Union` of seven `Type.Literal`; paired `Static` type export; follow `src/reorder.ts:16` shape and TSDoc density
- `SUPPORTED_COUNTRIES` -> `as const satisfies readonly Country[]`, ordered `UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`; single source for UI option lists and seed
- `DEFAULT_GUEST_COUNTRY = 'US'`, `LEGACY_DATA_COUNTRY = 'UK'`
- TSDoc must state the `CountryCode` distinction explicitly so the next reader cannot conflate them
- register -> `export * from './country.js'` in `src/index.ts`; `"./country"` subpath in `package.json` exports
- `src/auth.ts` -> `PublicUser` gains `country: Country`; `LoginBody` and `SignupBody` gain `country: Country`. `AdminUserView` inherits via existing `...PublicUser.properties` spread
- `src/cart.ts` -> `CreateCartBody` with optional `country`, defaulted server-side
- update `address.ts:29` TSDoc "No localisation profile exists" -> now inaccurate; state postal-vs-identity split without changing the schema

### Schema

- `apps/api/src/db/migrations/032_country_localisation.ts` -> `countryLocalisationMigration`, `version: '032'`
- guard -> skip when `users` already has `country` column
- rebuild `users` -> all ten existing columns in declared order plus `country TEXT NOT NULL DEFAULT 'UK' CHECK (country IN ('UK','US','CN','PL','ES','DE','FR'))`, self-FK `suspended_by_user_id INTEGER REFERENCES users(id)`, table constraint `UNIQUE (email, country)`; drop the old inline `email UNIQUE`
- capture row count and `sqlite_sequence` seq before rebuild; assert equal count after copy; restore high-water mark per `021` precedent
- explicit column lists on both sides of `INSERT INTO users_new (...) SELECT ... FROM users ORDER BY id`. No `SELECT *`
- `addColumnIfMissing` -> `orders.country`, `carts.country`, `company_accounts.country`, each `TEXT NOT NULL DEFAULT 'UK' CHECK (...)`
- close with local `assertForeignKeysClean(db)` matching `031` idiom
- append import + array entry in `apps/api/src/db/migrations/index.ts`

### Identity Domain and Persistence

- `userRepository.create({ email, displayName, country, passwordHash, now })` -> `INSERT` gains `country`
- `findCredentialsByEmail(email, country)` -> `WHERE email = ? AND country = ?`. Signature change is the enforcement point; no overload, no optional country
- `UserRecord` and `UserRow` gain `country`; `toUser` maps it
- `authService.signup` and `authService.login` accept `country`; `toPublicUser` emits it
- `isUniqueEmailError` -> assert against actual better-sqlite3 message under composite constraint; keep `SQLITE_CONSTRAINT_UNIQUE` code check as primary; add named unit test pinning the mapping so a silent message change cannot degrade 409 into 500
- `passwordResetRepository.findUserByEmail(email, country)`; `passwordResetService.request(email, country, context)`
- `sessionRepository.findUser` -> select `u.country`; `SessionUser` gains `country`
- `cartRepository.create(id, country)`; `cartService.createCart(repository, country)`
- `apps/api/src/app.ts` -> wiring updated for changed factory signatures only

### API Transport

- `POST /signup` and `POST /login` -> `country` required in body, validated by `Country` enum; invalid value rejected 400 by TypeBox before handler
- `POST /forgot-password` -> `country` required; unchanged silent-success semantics
- `GET /me` -> `PublicUser` including `country`
- `POST /api/cart` -> optional `country`, default `LEGACY_DATA_COUNTRY`
- no change to status codes, error prose, or session mechanism

### Web Country State

- `apps/web/src/lib/countryStorage.ts` -> key `shop.country.selected.v1`; `readSelectedCountry`, `writeSelectedCountry`, `clearSelectedCountry`; try/catch every access; validate against `SUPPORTED_COUNTRIES` on read; discard corrupt value; injectable storage type mirroring `comparisonStorage.ts`
- `apps/web/src/hooks/CountryContext.tsx` -> `CountryProvider`, `useCountry()` -> `{ activeCountry, isAccountBound, selectCountry }`
- mount inside `AuthProvider` in `Layout.tsx` so it can read `user`; account country wins when `user` present, guest selection wins otherwise
- `cartStorage.ts` -> key becomes `shop-qarefully-cart-id.<COUNTRY>`; one-time legacy migration -> when no per-country key exists and legacy `shop-qarefully-cart-id` exists, adopt it under the `UK` slot and remove the legacy key. Deterministic, documented, covered by test
- `cartClient.loadOrCreate` and `useCart` take active country; country change re-resolves cart id, so cart never follows across countries

### Web UI

- `apps/web/src/components/CountryPicker.tsx` -> native `<select>` styled per `CatalogToolbar.tsx`, labelled for screen readers; options from `SUPPORTED_COUNTRIES`
- mount in `Header.tsx` `aria-label="Customer tools"` group before `AccountMenu`; renders for logged-out visitors
- authenticated non-admin -> picker shows account country and is disabled with an explanatory label. Server authority is never client-overridable
- `LoginPage.tsx` and `SignupPage.tsx` -> country `<select>` matching local bare-`<input>` styling; default to active country; included in existing inline validation
- `apps/web/src/api/auth.ts` -> `login`/`signup` bodies carry country
- `AuthContext` -> `login(email, password, country)`, `signup(email, password, displayName, country)`
- country change while holding a non-empty guest cart -> plain message stating cart stays with previous country and is not merged or discarded

### Seed and Docs

- `seededPassword(email, country)` -> salt derived from both, so the `DE` fixture password differs from `UK`
- all existing seeded accounts -> `UK`
- new fixture -> `alice@example.com` in `DE`, distinct password, own cart, proving separate accounts
- `ON CONFLICT(email)` -> `ON CONFLICT(email, country)`
- every seed user lookup -> `WHERE email = ? AND country = ?`
- README -> credentials state country; explain that seeded accounts are `UK` while default landing country is `US`, so Alice fails to log in until the dropdown changes
- `AGENTS.md` -> migration head `031` -> `032`; repository map note for country identity
- `plans/demo_project_high_level_plan.md` -> item 10 stage 1 status; `plans/country_localisation_handoff.md` -> stage 1 status line only, decisions untouched

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2}`
`GR1 -> P7 -> R7 -> GR7 -> P8 -> R8 -> GR8`
`G1 -> {P3 -> R3 -> GR3 || P5 -> R5 -> GR5 || P6 -> R6 -> GR6}`
`GR3 -> P4 -> R4 -> GR4`
`G2 -> S1 -> R9 -> GR9 -> G3`

- `G0`: worktree verified; Node 22 selected; `npm ci` health passes; baseline suite evidence captured; three stage-boundary assumptions validated
- `GR1`: contracts review gate; blocks every consumer
- `GR2`: migration review gate; blocks all persistence consumers
- `G1`: `GR1` + `GR2` both passed -> API consumers launch
- `GR3`: identity domain review gate; blocks `P4`
- `GR5`, `GR6`: seed and cart-persistence review gates
- `GR7`: web country foundation review gate; blocks `P8`
- `GR8`: web UI review gate
- `G2`: `GR4` + `GR5` + `GR6` + `GR8` all passed -> convergence launches
- `GR9`: convergence review gate
- `G3`: completion gate; broad suite plus web integration tier green once after all fixes settle

Parallelism justification: `P1` owns `packages/contracts/**` only; `P2` owns `apps/api/src/db/migrations/**` plus its schema test. Disjoint writes, independent verification, no shared composition file. `P3`, `P5`, `P6` own disjoint API directories and no shared registry. `P7` needs only the contract, so it starts at `GR1` rather than waiting for schema.

Serialization points: `packages/contracts/package.json` + `src/index.ts` owned solely by `P1`; `apps/api/src/db/migrations/index.ts` owned solely by `P2`; `apps/api/src/app.ts` owned solely by `P3`; `apps/web/src/components/Layout.tsx` owned solely by `P7`; `apps/web/src/components/Header.tsx` owned solely by `P8`; README, `AGENTS.md`, and `plans/**` owned solely by `S1`.

## Work Packets

### P1: Country contract enum and auth transport

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/country.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/src/auth.ts`, `packages/contracts/src/cart.ts`, `packages/contracts/src/address.ts`, `packages/contracts/test/country-contracts.test.ts`
- reads: `packages/contracts/src/reorder.ts` -> `ReorderSkipReason` -> exact enum declaration idiom to copy; `packages/contracts/src/auth.ts` -> `PublicUser`, `AdminUserView`, `LoginBody`, `SignupBody` -> extension points and the `...PublicUser.properties` spread; `packages/contracts/src/address.ts` -> `CountryCode`, `PostalAddress` -> the type that must stay untouched; `packages/contracts/package.json` -> `exports` -> kebab-case subpath convention; `packages/contracts/test/transport-contracts.test.ts` -> `void test` + `Value.Check` accept/reject convention
- acceptance: `Country`, `SUPPORTED_COUNTRIES`, `DEFAULT_GUEST_COUNTRY`, `LEGACY_DATA_COUNTRY` exported from `@shop/contracts/country` and root barrel; `PublicUser`, `LoginBody`, `SignupBody` carry `country`; `CreateCartBody` carries optional `country`; `CountryCode` and `PostalAddress` unchanged in shape; contracts build and tests pass
- non-goals: no per-country config data, no language, rate, format, timezone, postcode, or blocked-list fields; no change to `CountryCode` pattern or `PostalAddress` properties; no API or web edits
- upstream inputs: none
- changes:
  - add `src/country.ts` with `Country` union, `SUPPORTED_COUNTRIES`, `DEFAULT_GUEST_COUNTRY`, `LEGACY_DATA_COUNTRY`, TSDoc stating the identity-vs-postal split
  - register in `src/index.ts` and `package.json` `exports` as `"./country"`
  - extend `PublicUser`, `LoginBody`, `SignupBody` in `src/auth.ts`
  - add optional `country` to `CreateCartBody` in `src/cart.ts`
  - correct the stale `address.ts:29` TSDoc claim without altering the schema
  - add `test/country-contracts.test.ts` -> accept each of seven literals; reject `'GB'`, `'gb'`, `'EU'`, empty; assert `PublicUser` requires `country`; assert root-barrel and subpath export parity
- invariants: `Country` never equals `CountryCode`; `'GB'` remains valid for `PostalAddress.countryCode` and invalid for `Country`; enum order stable for deterministic UI lists
- relevant evidence: `E0-contracts` baseline
- test duty: run `npm test -w @shop/contracts` and `npm run build -w @shop/contracts` at packet completion
- verification: contracts suite green; build emits `dist/country.js` + `dist/country.d.ts`; no browser or visual step
- handoff: `Country` enum, constant names, and exact `country` field placement on auth and cart bodies
- review: `R1` -> `GR1` blocks `P3`, `P5`, `P6`, `P7`

### P2: Migration 032 country schema

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/032_country_localisation.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/countrySchema.integration.test.ts`, `apps/api/test/db/migrations.integration.test.ts`
- reads: `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> whole file -> constraint-swap rebuild idiom; `apps/api/src/db/migrations/021_remove_powderizer.ts:166-279` -> parent-table rebuild, row-count assertion, `sqlite_sequence` restore; `apps/api/src/db/migrations/027_admin_surface.ts:10-35` -> `addColumnIfMissing` helper and the three `users` columns added there; `apps/api/src/db/migrations/001_initial.ts:67-75` -> exact current `users` definition; `apps/api/src/db/migrate.ts` -> `Migration` interface, ordering rules, FK suspension contract; `apps/api/test/db/migrations.integration.test.ts:22-54` -> `expectedVersions` and the pre-migration-fixture pattern
- acceptance: `032` applies cleanly on a fresh database and on a database migrated to `031` with legacy rows; `users` has `UNIQUE (email, country)` and no bare `email` unique; same email inserts twice under different countries and fails under the same country; `orders`, `carts`, `company_accounts` carry `country` defaulted `UK`; all pre-existing rows read `UK`; row count and AUTOINCREMENT high-water mark preserved; `PRAGMA foreign_key_check` clean
- non-goals: no `country` on `saved_lists` or `products`; no repository, service, route, seed, or web edit; no change to landed migrations
- upstream inputs: none. Country literal set is duplicated as a SQL `CHECK`, matching existing inline-enum precedent; do not import contracts into a migration
- changes:
  - add `032_country_localisation.ts` with local `hasColumn`, `assertForeignKeysClean`, guard on `users.country`
  - capture pre-rebuild row count and `sqlite_sequence` seq for `users`
  - create `users_new` with full column list, `country` column, self-FK, `UNIQUE (email, country)`
  - copy with explicit column lists ordered by `id`; assert copied count equals captured count
  - drop, rename, restore `sqlite_sequence` high-water mark
  - `addColumnIfMissing` for `orders.country`, `carts.country`, `company_accounts.country`
  - append import and array entry in `migrations/index.ts`
  - extend `expectedVersions` with `'032'`
  - add `countrySchema.integration.test.ts` -> pre-`032` fixture with legacy users/orders/carts/companies -> migrate -> assert backfill `UK`, composite uniqueness accept/reject, count preservation, FK cleanliness, idempotent replay
- invariants: append-only and forward-only; no landed migration edited or renumbered; no local `PRAGMA foreign_keys` toggle; `users` self-FK and every inbound FK survive; column defaults keep existing raw-SQL inserts valid
- relevant evidence: `E0-api-int` baseline
- test duty: run `npm exec -w @shop/api -- tsx --test test/db/countrySchema.integration.test.ts test/db/migrations.integration.test.ts` at packet completion. Paths are workspace-relative: `npm exec -w` sets the working directory to `apps/api`
- verification: both schema suites green; replay-idempotency assertion present; no browser or visual step
- handoff: exact column names, defaults, CHECK text, and the composite unique constraint name/shape consumers must expect
- review: `R2` -> `GR2` blocks `P3`, `P5`, `P6`

### P3: Identity domain and persistence

- mode: parallel with `P5`, `P6` after `G1`
- depends on: `P1`, `P2`, `G1`
- owns: `apps/api/src/features/auth/userRepository.ts`, `apps/api/src/features/auth/authService.ts`, `apps/api/src/features/auth/authService.test.ts`, `apps/api/src/features/auth/sessionRepository.ts`, `apps/api/src/features/passwordReset/passwordResetRepository.ts`, `apps/api/src/features/passwordReset/passwordResetService.ts`, `apps/api/src/app.ts`
- reads: `apps/api/src/features/auth/userRepository.ts` -> `UserRecord`, `UserRow`, `findCredentialsByEmail`, `create` -> exact seam to country-qualify; `apps/api/src/features/auth/authService.ts:54-140` -> `toPublicUser`, `isUniqueEmailError`, `login`, `signup` -> mapping and error paths; `apps/api/src/features/passwordReset/passwordResetRepository.ts:40-49` -> email lookup to qualify; `apps/api/src/features/auth/sessionRepository.ts:76-90` -> `findUser` join to extend; `apps/api/src/db/unitOfWork.ts` -> synchronous transaction contract, async hashing stays outside `run`; `apps/api/src/app.ts:285-500` -> factory wiring for changed signatures
- acceptance: `findCredentialsByEmail(email, country)` requires both arguments; signup persists country and maps duplicate `(email, country)` to `EMAIL_EXISTS`; signup of same email under a different country succeeds; login with correct password and wrong country returns the same failure shape as wrong password; `toPublicUser` emits country; session lookup returns country; password reset is country-qualified
- non-goals: no route, schema, seed, or web edit; no change to session token mechanism, cookie attributes, or lifetimes; no change to login failure prose or status codes
- upstream inputs: `P1` -> accepted contracts change set -> `Country` type and `PublicUser.country`; `P2` -> accepted migration change set -> `users.country` column and `(email, country)` unique constraint
- changes:
  - extend `UserRecord`, `UserRow`, `toUser` with country
  - country-qualify `create` and `findCredentialsByEmail`
  - thread country through `authService.signup` and `authService.login`; emit country from `toPublicUser`
  - verify actual duplicate-key error text under the composite constraint; keep `SQLITE_CONSTRAINT_UNIQUE` code as primary discriminator
  - country-qualify `passwordResetRepository.findUserByEmail` and `passwordResetService.request`
  - select `country` in `sessionRepository.findUser`; extend `SessionUser`
  - update `app.ts` wiring for changed signatures only
  - extend `authService.test.ts` -> same email two countries are separate accounts; right password wrong country fails; duplicate `(email, country)` maps to `EMAIL_EXISTS` not an unhandled throw
- invariants: wrong-country login is indistinguishable from wrong-password login in status, body, and timing characteristics already present; no country value appears in any error message; async password hashing stays outside `unitOfWork.run`; audit actor assertions unchanged
- relevant evidence: `E1-contracts`, `E2-schema`
- test duty: run `npm exec -w @shop/api -- tsx --test src/features/auth/authService.test.ts` then `npm run test:unit -w @shop/api` at packet completion
- verification: auth unit suite green; API unit tier green; no browser or visual step
- handoff: final repository and service signatures for the route layer
- review: `R3` -> `GR3` blocks `P4`

### P4: Identity route and transport surface

- mode: sequential after `GR3`
- depends on: `P3`, `GR3`
- owns: `apps/api/src/routes/auth.ts`, `apps/api/test/auth/countryIdentity.integration.test.ts`, `apps/api/test/auth/auth.integration.test.ts`, `apps/api/test/passwordReset/passwordReset.integration.test.ts`
- reads: `apps/api/src/routes/auth.ts` -> all seven handlers -> schema registration and error mapping; `apps/api/src/utils/errors.ts` -> `sendBadRequest`, `sendUnauthorized`, `sendConflict` -> exact senders; `apps/api/src/plugins/auth.ts` -> `createSession`, `requireAuth` -> session issuing unchanged; `apps/api/test/auth/auth.integration.test.ts:46-83` -> `mkdtempSync` + `buildApp` + `app.inject` harness and injected clock/token source
- acceptance: `/signup`, `/login`, `/forgot-password` require a valid `Country`; invalid country rejected 400 by schema; `/me` returns country; duplicate `(email, country)` returns 409 with existing prose; same email under two countries yields two accounts with independent sessions; right password wrong country returns 401 `'Invalid email or password'`
- non-goals: no domain or repository edit; no new endpoint; no change to cookie attributes or session lifetime; no admin route change
- upstream inputs: `P3` -> accepted identity change set -> country-qualified repository and service signatures; `P1` -> accepted contracts change set -> request and response schemas
- changes:
  - pass country from validated body into auth service calls
  - keep every existing status and message mapping intact
  - add `countryIdentity.integration.test.ts` -> the security matrix: same email registered `UK` and `DE` with different passwords; each password works only in its own country; cross-country password fails 401 with exact body; `/me` reports the right country per session; both sessions valid concurrently
  - extend existing auth and password-reset integration suites for the country field
- invariants: 401 body byte-identical across wrong-password and wrong-country; no response or log discloses which countries hold an email; existing signup race test still yields exactly one account
- relevant evidence: `E3-identity`
- test duty: run `npm exec -w @shop/api -- tsx --test test/auth/countryIdentity.integration.test.ts`, then `npm run test:integration -w @shop/api`
- verification: new security suite green; API integration tier green; no browser or visual step
- handoff: request and response shapes the web client consumes
- review: `R4` -> `GR4` blocks `G2`

### P5: Seed, fixtures, and reset compatibility

- mode: parallel with `P3`, `P6` after `G1`
- depends on: `P1`, `P2`, `G1`
- owns: `apps/api/src/db/seed.ts`, `apps/api/src/db/companyAccountsSeed.ts`, `apps/api/src/db/backInStockSeed.ts`, `apps/api/src/db/savedListSeed.ts`, `apps/api/src/db/orderSeedScenarios.ts`, `apps/api/src/db/reviewSeedScenarios.ts`, `apps/api/src/db/seedAsyncScenarios.ts`, `apps/api/test/db/seed.integration.test.ts`
- reads: `apps/api/src/db/seed.ts:12-28` -> `USERS`, `ADMIN_SUSPENDED_USER` -> fixture list; `apps/api/src/db/seed.ts:361-364` -> `seededPassword` -> salt derivation to country-qualify; `apps/api/src/db/seed.ts:643-690` -> `insertUser`, `upsertSuspendedUser` `ON CONFLICT(email)`, `userIdByEmail` -> the three breakages; `apps/api/src/db/seed.ts:372-383` -> idempotency contract and single-transaction wrapper; `apps/api/src/db/reset.ts` -> ordered delete list -> confirm no change needed
- acceptance: `npm run reset` completes; every pre-existing seeded account is `UK`; `alice@example.com` exists in both `UK` and `DE` with different passwords, different ids, and independent carts; re-running seed is a no-op; every seed user lookup is country-qualified; `ON CONFLICT` targets the composite key
- non-goals: no schema, domain, route, or web edit; no new table; no change to product, promo, or catalog fixtures; no README edit
- upstream inputs: `P2` -> accepted migration change set -> country columns and composite unique; `P1` -> accepted contracts change set -> `SUPPORTED_COUNTRIES` and `LEGACY_DATA_COUNTRY`
- changes:
  - country-qualify `seededPassword(email, country)` so the `DE` fixture password differs from `UK`
  - add country to `USERS` and `ADMIN_SUSPENDED_USER`, all `UK`
  - add the `DE` `alice@example.com` fixture with its own password and cart
  - change `ON CONFLICT(email)` to `ON CONFLICT(email, country)`
  - country-qualify every `SELECT id FROM users WHERE email = ?` across the seven seed modules
  - extend `seed.integration.test.ts` -> both Alice rows exist with distinct ids and hashes; each password verifies only against its own row; idempotent re-seed; scope assertions to test-owned identifiers per `AGENTS.md:134`
- invariants: seed stays idempotent and insert-only for users; `resetDatabase` remains FK-safe; reserved canonical product ids untouched; deterministic hashes so repeated seeds produce identical rows
- relevant evidence: `E2-schema`
- test duty: run `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts`, then `npm run reset` from the repository root
- verification: seed suite green; reset completes without error; no browser or visual step
- handoff: exact demo credentials and countries for the README section `S1` owns
- review: `R5` -> `GR5` blocks `G2`

### P6: Cart country persistence

- mode: parallel with `P3`, `P5` after `G1`
- depends on: `P1`, `P2`, `G1`
- owns: `apps/api/src/features/cart/cartRepository.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/src/routes/cart.ts`, `apps/api/test/cart/cartCountry.integration.test.ts`
- reads: `apps/api/src/features/cart/cartService.ts:286-301` -> `runCartMutation`, `createCart` -> creation seam; `apps/api/src/features/cart/cartRepository.ts` -> `create`, `exists` -> statement style and row types; `apps/api/src/routes/cart.ts:21-51` -> `auditContext` and `POST /api/cart` -> the audit-actor distinction and creation handler; `apps/api/test/cart/cart.integration.test.ts:48-58` -> temp-database harness
- acceptance: `POST /api/cart` accepts optional country and persists it; omitted country defaults `UK`; invalid country rejected 400 by schema; cart country is immutable after creation; carts created under different countries are distinct rows
- non-goals: no cart-line, pricing, promo, reservation, or checkout change; no blocking or availability rule; no user-to-cart ownership binding; no web edit
- upstream inputs: `P1` -> accepted contracts change set -> `CreateCartBody.country`; `P2` -> accepted migration change set -> `carts.country` default `UK`
- changes:
  - `cartRepository.create(id, country)` -> insert country
  - `cartService.createCart(repository, country)` -> thread through
  - `routes/cart.ts` -> read optional body country, default `LEGACY_DATA_COUNTRY`
  - add `cartCountry.integration.test.ts` -> creation persists country; default applies on omission; invalid value rejected; two carts under different countries stay separate
- invariants: no endpoint mutates an existing cart's country; audit context stays the actor record and is never conflated with cart country; existing cart routes and their 404 semantics unchanged
- relevant evidence: `E2-schema`
- test duty: run `npm exec -w @shop/api -- tsx --test test/cart/cartCountry.integration.test.ts`
- verification: cart country suite green; no browser or visual step
- handoff: cart creation request shape for the web client
- review: `R6` -> `GR6` blocks `G2`

### P7: Web country foundation

- mode: sequential after `GR1`; parallel with API lane
- depends on: `P1`, `GR1`
- owns: `apps/web/src/lib/countryStorage.ts`, `apps/web/src/lib/countryStorage.test.ts`, `apps/web/src/hooks/CountryContext.tsx`, `apps/web/src/hooks/CountryContext.test.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/lib/cartStorage.ts`, `apps/web/src/lib/cartStorage.test.ts`, `apps/web/src/hooks/cartClient.ts`, `apps/web/src/hooks/useCart.ts`
- reads: `apps/web/src/features/comparison/comparisonStorage.ts` -> whole file -> versioned key, try/catch, validate-on-read, injectable storage precedent; `apps/web/src/features/comparison/ComparisonSelectionContext.tsx` -> optional `storage` prop and `browserStorage()` helper -> testable injection idiom; `apps/web/src/lib/cartStorage.ts` -> `getCartId`, `setCartId`, `clearCartId` -> exact functions to key by country; `apps/web/src/hooks/cartClient.ts` -> `loadOrCreate`, `recoverMissingCart` -> creation and 404 recovery path; `apps/web/src/components/Layout.tsx` -> provider nest order -> mount point inside `AuthProvider`; `apps/web/src/hooks/AuthContext.tsx` -> `useAuth` shape -> how account country is read
- acceptance: guest country defaults `US` and survives reload; corrupt or unknown stored value is discarded and falls back to `US`; account country wins whenever a user is present; cart id is stored per country; switching country resolves a different cart; legacy single-key cart id migrates once into the `UK` slot and the legacy key is removed
- non-goals: no visible picker, header, login, or signup change; no admin behaviour; no catalog query parameter; no blocking or availability logic
- upstream inputs: `P1` -> accepted contracts change set -> `Country`, `SUPPORTED_COUNTRIES`, `DEFAULT_GUEST_COUNTRY`, `LEGACY_DATA_COUNTRY`
- changes:
  - add `countryStorage.ts` under key `shop.country.selected.v1`, mirroring `comparisonStorage.ts` guards and injectable storage type
  - add `CountryContext.tsx` exporting `CountryProvider` and `useCountry`, resolving account country over guest selection
  - mount `CountryProvider` inside `AuthProvider` in `Layout.tsx`
  - key cart id by country in `cartStorage.ts`; implement the one-time legacy adoption into the `UK` slot
  - thread active country through `cartClient.loadOrCreate` and `useCart`
  - add colocated tests for storage round-trip, corrupt-value discard, legacy migration, and account-country precedence
- invariants: every storage access try/catch guarded so privacy settings or quota failures never break render; stored value validated against `SUPPORTED_COUNTRIES` before use; legacy cart migration runs at most once and is idempotent; client country never overrides authenticated account country
- relevant evidence: `E1-contracts`
- test duty: run `npm exec -w @shop/web -- vitest run --configLoader runner src/lib/countryStorage.test.ts src/lib/cartStorage.test.ts src/hooks/CountryContext.test.tsx`
- verification: focused web unit files green; no browser session, screenshot, or click-through
- handoff: `useCountry` contract and per-country cart storage key format
- review: `R7` -> `GR7` blocks `P8`

### P8: Web country UI surfaces

- mode: sequential after `GR7`
- depends on: `P7`, `GR7`
- owns: `apps/web/src/components/CountryPicker.tsx`, `apps/web/src/components/CountryPicker.test.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/components/Header.test.tsx`, `apps/web/src/features/auth/LoginPage.tsx`, `apps/web/src/features/auth/LoginPage.test.tsx`, `apps/web/src/features/auth/SignupPage.tsx`, `apps/web/src/api/auth.ts`, `apps/web/src/hooks/AuthContext.tsx`, `apps/web/src/features/auth/CountryLogin.integration.test.tsx`
- reads: `apps/web/src/components/Header.tsx:28-49` -> `aria-label="Customer tools"` group -> exact mount point and inherited focus-ring selectors; `apps/web/src/features/catalog/CatalogToolbar.tsx` -> native `<select>` label and class idiom; `apps/web/src/features/auth/LoginPage.tsx` -> bare `<input>` styling, inline validation, `ApiError` handling -> local form conventions; `apps/web/src/api/auth.ts` -> `login`, `signup` signatures -> body shapes to extend; `apps/web/src/hooks/AuthContext.tsx` -> `AuthState` -> positional signatures to change; `apps/web/src/components/Header.test.tsx` -> child-stub and `vi.hoisted` idiom; `apps/web/src/features/savedLists/SavedListsJourney.integration.test.tsx` -> provider-wrapping and whole-module API mocking pattern
- acceptance: picker renders for logged-out visitors and shows `US` by default; selection persists across remount; authenticated non-admin sees account country and cannot change it; login and signup submit the selected country; login failure prose unchanged; changing country while holding a non-empty guest cart shows a plain message that the cart stays with the previous country
- non-goals: no admin country switching across admin sections; no banner, blocking, currency, date, or translation change; no restyle of unrelated header controls; no new route
- upstream inputs: `P7` -> accepted web foundation change set -> `useCountry` and per-country cart storage; `P1` -> accepted contracts change set -> `SUPPORTED_COUNTRIES` and auth body fields
- changes:
  - add `CountryPicker.tsx` as a labelled native `<select>` driven by `SUPPORTED_COUNTRIES`
  - mount in the `Header.tsx` customer-tools group ahead of `AccountMenu`
  - disable the picker with an explanatory label when a non-admin user is signed in
  - add country selects to `LoginPage.tsx` and `SignupPage.tsx`, defaulting to active country, covered by existing inline validation
  - extend `api/auth.ts` bodies and `AuthContext` `login`/`signup` signatures
  - surface the guest-cart-does-not-follow message on country change
  - add `CountryLogin.integration.test.tsx` -> pick `DE`, submit login, assert country in the request body; assert account country wins after login; assert cart does not follow across the country change and the message renders
- invariants: picker reachable by keyboard with an accessible name; no country value in any error prose; account country never editable from the client for non-admins; async submissions ignore stale completions per existing repository rule
- relevant evidence: `E7-web-foundation`
- test duty: run `npm exec -w @shop/web -- vitest run --configLoader runner src/components/CountryPicker.test.tsx src/components/Header.test.tsx src/features/auth/LoginPage.test.tsx`, then `npm run test:integration -w @shop/web`
- verification: focused web unit files green; web integration tier green; UI behaviour proven by React integration and unit tests only, never by browser session, screenshot, or click-through
- handoff: final login and signup request shapes plus picker accessible names for convergence assertions
- review: `R8` -> `GR8` blocks `G2`

### S1: Convergence, documentation, and final gate

- mode: sequential after `G2`
- depends on: `P4`, `P5`, `P6`, `P8`, `G2`
- owns: `README.md`, `AGENTS.md`, `plans/demo_project_high_level_plan.md`, `plans/country_localisation_handoff.md`, `apps/api/test/integration/countryIdentityEndToEnd.integration.test.ts`
- reads: `README.md:116-128` -> `### User Credentials` and `### Local Administration` -> exact sections to extend; `AGENTS.md:68` -> migration head `031` -> value to update; `AGENTS.md:54-77` -> repository map -> where country identity belongs; `plans/demo_project_high_level_plan.md` -> item 10 and the migration-head line in `Current Baseline` -> status text to sync; `plans/country_localisation_handoff.md` -> `Delivery Stages` -> stage 1 status line only; `apps/api/test/integration/accountDepthEndToEnd.integration.test.ts` -> cross-domain end-to-end harness idiom
- acceptance: README states seeded accounts are `UK` while default landing country is `US` and that Alice fails to log in until the dropdown changes; both Alice credentials documented with countries; `AGENTS.md` migration head reads `032`; high-level plan records stage 1 landed; handoff carries a stage 1 status line with product decisions untouched; end-to-end suite proves the full journey; full verification green
- non-goals: no implementation change beyond fixing convergence defects; no stage 2 or stage 3 content; no rewrite of handoff product decisions; no new feature surface
- upstream inputs: `P4` -> accepted route change set -> endpoint shapes; `P5` -> accepted seed change set -> exact demo credentials and countries; `P6` -> accepted cart change set -> creation contract; `P8` -> accepted web change set -> picker and form behaviour
- changes:
  - add `countryIdentityEndToEnd.integration.test.ts` -> seed, sign in as `UK` Alice, confirm country on `/me`, create a cart, sign in as `DE` Alice in a second session, confirm distinct account and distinct cart, confirm cross-country password rejection
  - update README credentials and administration sections with countries and the `US`-landing caveat
  - update `AGENTS.md` migration head and repository map
  - sync high-level plan item 10 stage 1 status and the `Current Baseline` migration-head line
  - add a stage 1 status line to the handoff without altering decisions
- invariants: documentation matches seeded reality exactly; no course-spoiler content for stage 2 or 3; Markdown stays outside Prettier per `.prettierignore`
- relevant evidence: `E4-routes`, `E5-seed`, `E6-cart`, `E8-web-ui`
- test duty: run `npm exec -w @shop/api -- tsx --test test/integration/countryIdentityEndToEnd.integration.test.ts`, then from the repository root `npm run reset`, then `npm run verify`, then `npm run test:integration -w @shop/web`
- verification: end-to-end suite green; reset deterministic; full verify green; web integration tier green because `verify` does not cover it; no browser, screenshot, or manual UI step at this gate
- handoff: completion evidence for `G3`
- review: `R9` -> `GR9` blocks `G3`

## Review Assignments

Every reviewer assignment below sets `review_skill=code-reviewer`, applies its critical-plus-high severity gate and verification-before-reporting duty, and maps surviving findings into `reviewer_report_v1`. Reviewers are inspect-only. `code-reviewer` carries `disable-model-invocation`, so the reviewer invokes it explicitly by name through the Skill tool; if the harness refuses model invocation, the reviewer reads `.claude/skills/code-reviewer/SKILL.md` directly and applies it in full. Never skip the severity gate.

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P1` -> settled contracts change set
- timing: immediately after `P1` reports; before `P3`, `P5`, `P6`, `P7` launch
- blocks: `P3`, `P5`, `P6`, `P7`, `G1`
- consolidation reason: none; contracts are a high-risk producer consumed by every lane
- reads: `packages/contracts/src/country.ts` -> all exports -> enum correctness and stability; `packages/contracts/src/auth.ts` -> `PublicUser`, `LoginBody`, `SignupBody` -> field placement and required-ness; `packages/contracts/src/address.ts` -> `CountryCode`, `PostalAddress` -> confirm unchanged shape; `packages/contracts/package.json` -> `exports` -> subpath correctness; `packages/contracts/src/index.ts` -> barrel registration
- acceptance: seven literals exactly; identity enum distinct from postal `CountryCode`; `'GB'` still valid for addresses and invalid for `Country`; subpath and barrel both resolve; tests assert reject cases, not only accept cases
- invariants: no availability, currency, format, or timezone meaning attached; enum order stable; no breaking change to existing consumers of `auth.ts` or `address.ts` beyond the intended additions
- risk focus: silent widening via `Type.String`; `CountryCode` accidentally narrowed breaking seeded `'GB'` addresses; missing `exports` entry producing a resolution failure only at consumer build; tests that assert nothing
- non-goals: API, web, seed, migration review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E1-contracts`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P2` -> settled migration change set
- timing: immediately after `P2` reports; before `P3`, `P5`, `P6` launch
- blocks: `P3`, `P5`, `P6`, `G1`
- consolidation reason: none; migration is the highest-risk producer in this plan
- reads: `apps/api/src/db/migrations/032_country_localisation.ts` -> whole file -> rebuild correctness; `apps/api/src/db/migrations/021_remove_powderizer.ts:166-279` -> rebuild precedent to compare against; `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> constraint-swap precedent; `apps/api/src/db/migrate.ts` -> runner ordering and FK contract; `apps/api/test/db/countrySchema.integration.test.ts` -> assertion strength
- acceptance: composite unique replaces bare email unique; every original column, type, default, and CHECK preserved; self-FK preserved; row count asserted; `sqlite_sequence` high-water mark restored; backfill `UK` on all four tables; idempotent replay; FK check clean
- invariants: append-only and forward-only; no landed migration edited; no local `foreign_keys` toggle; no data loss; no `SELECT *` in the copy; defaults keep existing raw-SQL inserts valid
- risk focus: dropped column, constraint, or index during rebuild; lost AUTOINCREMENT high-water mark handing out recycled user ids; orphaned child rows across ~20 inbound FKs; guard that misfires and reapplies the rebuild; `expectedVersions` not updated; test that asserts schema shape without asserting data survival
- non-goals: domain, route, seed, web review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E2-schema`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R3: Review `P3`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P3` -> settled identity domain change set
- timing: immediately after `P3` reports; before `P4` launches
- blocks: `P4`, `G2`
- consolidation reason: none; auth correctness is a security surface
- reads: `apps/api/src/features/auth/userRepository.ts` -> `create`, `findCredentialsByEmail` -> country qualification completeness; `apps/api/src/features/auth/authService.ts` -> `login`, `signup`, `isUniqueEmailError`, `toPublicUser` -> failure paths and mapping; `apps/api/src/features/passwordReset/passwordResetRepository.ts` -> email lookup; `apps/api/src/features/auth/sessionRepository.ts` -> `findUser` join; `apps/api/src/features/auth/authService.test.ts` -> assertion strength
- acceptance: no residual code path resolves a user by email alone; wrong-country login fails identically to wrong-password; duplicate `(email, country)` maps to `EMAIL_EXISTS`; country emitted on public user and session user
- invariants: no country disclosure in errors or logs; async hashing outside `unitOfWork.run`; suspension and tombstone checks unchanged; audit actor assertions unchanged
- risk focus: an overload or default that lets country be omitted, silently restoring global email lookup; `isUniqueEmailError` failing under the new constraint message and turning 409 into an unhandled 500; password reset resolving the wrong country's account; a test that passes because both fixtures share a country
- non-goals: route, migration, seed, web review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E3-identity`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R4: Review `P4`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P4` -> settled route change set
- timing: immediately after `P4` reports; before `G2`
- blocks: `G2`
- consolidation reason: none; public contract and auth surface
- reads: `apps/api/src/routes/auth.ts` -> all handlers -> schema and error mapping; `apps/api/test/auth/countryIdentity.integration.test.ts` -> the security matrix -> coverage adequacy; `apps/api/src/utils/errors.ts` -> senders -> status and body correctness
- acceptance: country required and enum-validated on all three bodies; `/me` returns country; 409 and 401 semantics preserved; security matrix covers cross-country password rejection and concurrent independent sessions
- invariants: 401 body identical across wrong-password and wrong-country; no account enumeration; session mechanism, cookie attributes, and lifetimes unchanged
- risk focus: country accepted as free string bypassing the enum; error prose leaking country existence; the security test asserting only the status code and not the body; regression in the existing signup-race conflict behaviour
- non-goals: domain, migration, seed, web review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E4-routes`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R5: Review `P5`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P5` -> settled seed change set
- timing: immediately after `P5` reports; before `G2`
- blocks: `G2`
- consolidation reason: none; seed determinism is a repository-wide dependency
- reads: `apps/api/src/db/seed.ts` -> user fixtures, `seededPassword`, insert and upsert statements, lookups -> correctness and idempotency; the six sub-seeder modules -> lookup qualification; `apps/api/test/db/seed.integration.test.ts` -> assertion strength; `apps/api/src/db/reset.ts` -> confirm no change needed
- acceptance: two Alice accounts with distinct ids and distinct password hashes; every seeded account country-correct; every user lookup country-qualified; re-seed is a no-op; reset stays FK-safe
- invariants: deterministic hashes; insert-only user seeding; reserved product ids untouched; assertions scoped to test-owned identifiers
- risk focus: a residual email-only lookup silently binding a fixture to the wrong Alice; `ON CONFLICT` target mismatch failing only on second run; identical hashes across the two Alices defeating the primary demo; non-idempotent re-seed
- non-goals: schema, domain, route, web review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E5-seed`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R6: Review `P6`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P6` -> settled cart persistence change set
- timing: immediately after `P6` reports; before `G2`
- blocks: `G2`
- consolidation reason: none; cart persistence feeds stage 2 availability enforcement
- reads: `apps/api/src/features/cart/cartRepository.ts` -> `create` -> insert correctness; `apps/api/src/features/cart/cartService.ts` -> `createCart` -> threading; `apps/api/src/routes/cart.ts` -> creation handler -> default and validation; `apps/api/test/cart/cartCountry.integration.test.ts` -> coverage
- acceptance: country persisted at creation, defaulted on omission, enum-validated, immutable afterwards
- invariants: audit actor never conflated with cart country; no cart route mutates country; existing cart semantics and 404 behaviour unchanged
- risk focus: country mutable through an existing update path; default applied in one layer but not another producing rows that bypass the CHECK; test that creates carts without asserting the stored column
- non-goals: identity, migration, seed, web review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E6-cart`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R7: Review `P7`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P7` -> settled web foundation change set
- timing: immediately after `P7` reports; before `P8` launches
- blocks: `P8`, `G2`
- consolidation reason: none; shared client state consumed by every later surface
- reads: `apps/web/src/lib/countryStorage.ts` -> guards and validation; `apps/web/src/hooks/CountryContext.tsx` -> precedence rule; `apps/web/src/lib/cartStorage.ts` -> per-country keying and legacy migration; `apps/web/src/hooks/cartClient.ts` and `useCart.ts` -> threading; `apps/web/src/features/comparison/comparisonStorage.ts` -> the precedent being followed
- acceptance: default `US`; corrupt value discarded; account country wins over guest selection; cart id keyed per country; legacy key adopted once into `UK` then removed
- invariants: every storage access guarded; value validated against `SUPPORTED_COUNTRIES`; legacy migration idempotent; client never overrides authenticated account country
- risk focus: unguarded `localStorage` access crashing render under privacy settings; legacy migration running repeatedly or losing an existing cart; account-versus-guest precedence inverted so a signed-in user can browse under the wrong country; stale-country cart request after a switch
- non-goals: picker, header, form, API review
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E7-web-foundation`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R8: Review `P8`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `P8` -> settled web UI change set
- timing: immediately after `P8` reports; before `G2`
- blocks: `G2`
- consolidation reason: none; this is the user-visible surface of the whole stage
- reads: `apps/web/src/components/CountryPicker.tsx` -> accessible naming and options; `apps/web/src/components/Header.tsx` -> mount and gating; `apps/web/src/features/auth/LoginPage.tsx` and `SignupPage.tsx` -> field wiring and validation; `apps/web/src/hooks/AuthContext.tsx` and `apps/web/src/api/auth.ts` -> signature and body changes; `apps/web/src/features/auth/CountryLogin.integration.test.tsx` -> coverage adequacy
- acceptance: picker visible logged-out, defaults `US`, persists; disabled with explanation for signed-in non-admins; login and signup submit country; guest-cart message renders on country change
- invariants: keyboard reachable with accessible name; no country disclosure in error prose; account country not client-editable for non-admins; stale async completions ignored
- risk focus: picker letting a signed-in user desynchronise from account country; country omitted from the request body while the UI appears to work; integration test asserting rendered text without asserting the submitted body; guest-cart message claiming a merge or discard that does not match behaviour
- non-goals: API, migration, seed review; no visual or aesthetic judgement
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E8-web-ui`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R9: Review `S1`

- method: invoke `code-reviewer` skill; apply severity gate and verification-before-reporting duty
- target: `S1` -> settled convergence change set
- timing: after `S1` reports; before `G3`
- blocks: `G3`
- consolidation reason: none; integration behaviour is not covered by earlier packet reviews
- reads: `apps/api/test/integration/countryIdentityEndToEnd.integration.test.ts` -> end-to-end coverage; `README.md` credentials and administration sections -> accuracy against seed; `AGENTS.md` migration head and repository map; `plans/demo_project_high_level_plan.md` item 10 and baseline line
- acceptance: end-to-end suite proves two-country identity, cart separation, and cross-country rejection; documentation matches seeded reality exactly; migration head accurate; plan status synced
- invariants: no stage 2 or stage 3 spoiler content; handoff product decisions unaltered; documented credentials work verbatim after `npm run reset`
- risk focus: README credentials that do not actually log in; end-to-end test asserting setup rather than behaviour; migration head left at `031`; convergence quietly changing implementation behaviour instead of fixing defects
- non-goals: re-review of already-gated packet internals
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing or stale blocks the verdict
- relevant evidence: `E9-endtoend`, `E10-verify`, `E11-web-int`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `packages/contracts/src/index.ts` and `packages/contracts/package.json`: owned only by `P1`; every other packet reads
- `apps/api/src/db/migrations/index.ts`: owned only by `P2`; migration version `032` reserved for `P2`; no other packet adds a migration
- `apps/api/src/app.ts`: owned only by `P3`; `P6` must not edit composition wiring, so `cartService`/`cartRepository` signature changes stay source-compatible or are coordinated through `P3` before `G2`
- `apps/web/src/components/Layout.tsx`: owned only by `P7`
- `apps/web/src/components/Header.tsx`: owned only by `P8`
- `apps/web/src/lib/cartStorage.ts`, `cartClient.ts`, `useCart.ts`: owned only by `P7`; `P8` consumes `useCountry` and must not re-key storage
- `apps/api/src/features/auth/**` and `features/passwordReset/**`: owned only by `P3`
- `apps/api/src/features/cart/**` and `routes/cart.ts`: owned only by `P6`
- `apps/api/src/db/seed*.ts` and sub-seeders: owned only by `P5`
- `apps/api/src/routes/auth.ts`: owned only by `P4`
- `README.md`, `AGENTS.md`, `plans/**`: owned only by `S1`
- test files: each listed under exactly one packet; `apps/api/test/db/migrations.integration.test.ts` belongs to `P2` alone
- contract changes: producer `P1` completes and passes `GR1` before any consumer packet launches
- schema changes: producer `P2` completes and passes `GR2` before any persistence consumer launches
- composition and documentation: single integration owner `S1`

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values here or in assignments
- non-Codex harnesses: ignore the Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and the communication contracts
- all harnesses: the reviewer agent runs `code-reviewer` as its review method. Assignments set `review_skill=code-reviewer`; the reviewer invokes it explicitly by name because the skill carries `disable-model-invocation`. If invocation is refused, the reviewer reads `.claude/skills/code-reviewer/SKILL.md` directly and applies its severity gate in full

## Test Execution Schedule

Run every command from the repository root with Node 22 selected first: `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`. Exception: `npm exec -w <workspace>` sets the working directory to that workspace, so its file arguments are workspace-relative, never repository-relative. Never silently skip an assigned command; missing evidence is a blocker, not a pass.

- `E0-baseline`: at `G0` -> owner: `G0` -> `npm ci` then `npm exec -- tsx --version` then `npm run typecheck -w @shop/api` then `npm run smoke`
- `E1-contracts`: after `P1` -> owner: `P1` -> `npm test -w @shop/contracts` and `npm run build -w @shop/contracts`
- `E2-schema`: after `P2` -> owner: `P2` -> `npm exec -w @shop/api -- tsx --test test/db/countrySchema.integration.test.ts test/db/migrations.integration.test.ts`
- `E3-identity`: after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test src/features/auth/authService.test.ts` then `npm run test:unit -w @shop/api`
- `E4-routes`: after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test test/auth/countryIdentity.integration.test.ts` then `npm run test:integration -w @shop/api`
- `E5-seed`: after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts` then `npm run reset`
- `E6-cart`: after `P6` -> owner: `P6` -> `npm exec -w @shop/api -- tsx --test test/cart/cartCountry.integration.test.ts`
- `E7-web-foundation`: after `P7` -> owner: `P7` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/lib/countryStorage.test.ts src/lib/cartStorage.test.ts src/hooks/CountryContext.test.tsx`
- `E8-web-ui`: after `P8` -> owner: `P8` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/components/CountryPicker.test.tsx src/components/Header.test.tsx src/features/auth/LoginPage.test.tsx` then `npm run test:integration -w @shop/web`
- `E9-endtoend`: after `S1` integration work -> owner: `S1` -> `npm exec -w @shop/api -- tsx --test test/integration/countryIdentityEndToEnd.integration.test.ts` then `npm run reset`
- `E10-verify`: at `G3`, once, after all fixes settle -> owner: `S1` -> `npm run verify`
- `E11-web-int`: at `G3`, once, after all fixes settle -> owner: `S1` -> `npm run test:integration -w @shop/web`
- policy: automated repository commands only; no browser session, screenshot, dev-server click-through, console or network inspection, or `browser-qa` invocation in any entry, gate, or review
- reuse: passing evidence stays valid while the command still covers current code and no listed invalidator changed afterwards. A new agent session alone never invalidates evidence. Give each agent only its relevant ledger entries and instruct it not to rerun valid commands
- `E10-verify` note: `npm run verify` runs `@shop/web`'s `test` script, which is `test:unit` only. The web integration tier is invisible to `verify`, so `E11-web-int` is mandatory and separate. Never treat a green `verify` as covering web integration
- invalidation: `packages/contracts/**` -> rerun `E1-contracts`, `E3-identity`, `E4-routes`, `E7-web-foundation`, `E8-web-ui`; `apps/api/src/db/migrations/**` -> rerun `E2-schema`, `E5-seed`, `E9-endtoend`; `apps/api/src/features/auth/**` or `features/passwordReset/**` -> rerun `E3-identity`, `E4-routes`, `E9-endtoend`; `apps/api/src/db/seed*.ts` -> rerun `E5-seed`, `E9-endtoend`; `apps/api/src/features/cart/**` or `routes/cart.ts` -> rerun `E6-cart`, `E9-endtoend`; `apps/web/src/lib/**` or `apps/web/src/hooks/**` -> rerun `E7-web-foundation`, `E8-web-ui`; any change after `G2` -> rerun `E10-verify` and `E11-web-int` once

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and for every JSON string value; preserve code, commands, paths, identifiers, and errors exactly
- transport: one canonical JSON object per message, inline, no free-text wrapper; temp artifact references only under protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet plus repository instructions plus relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`; store at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md` when object arrays become non-empty
- reviewer method: assignment carries `review_skill=code-reviewer`
- worktree context: every assignment includes absolute worktree path, implementation branch, and base revision; every repository-relative path resolves under the worktree root; every command runs with the worktree as working directory
- fix flow: stable reviewer finding ID -> fresh worker assignment with incremented `assignment_revision` -> `action=fix` directive carrying finding IDs -> targeted verification -> orchestrator records closure. Never re-review a fix. Reviewer-targeted `fix` corrects report or protocol only

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load source-checkout repository instructions, this plan, canonical contracts, and the current checkpoint only.
3. Record source branch and `HEAD`. Stop and ask if `HEAD` is detached, or if relevant uncommitted or untracked changes are absent from branch `HEAD`. Never copy, stash, or discard them without explicit approval.
4. Create the implementation branch and worktree from the recorded `HEAD`: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`. Persist worktree identity in the checkpoint.
5. Switch the execution root to the worktree; load repository instructions from the worktree.
6. Validate `G0`: select Node 22, run `npm ci`, confirm post-install health, capture `E0-baseline`, and validate the three stage-boundary assumptions in Decisions and Invariants.
7. Launch `P1 || P2` in fresh worker contexts inside the worktree.
8. Accept each report; update checkpoint and evidence; launch `R1` and `R2` against the exact settled change sets before any consumer starts.
9. Route stable findings to fresh workers with `action=fix` directives; close after targeted evidence; do not re-review fixes. Validate `GR1` and `GR2`.
10. On `GR1`, launch `P7`. On `G1`, launch `P3 || P5 || P6`. Review each settled lane concurrently; ownership is disjoint.
11. On `GR3`, launch `P4`. On `GR7`, launch `P8`. Review each before `G2`.
12. Validate `G2` after `GR4`, `GR5`, `GR6`, and `GR8` all pass; only then launch `S1` and run the fan-in commands once.
13. Review `S1` as a separate integration target through `R9`; close findings through fresh-worker fixes plus targeted evidence.
14. Validate `GR9` and `G3`; run `E10-verify` and `E11-web-int` once after all fixes settle.
15. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision. State that the user owns the merge.

## Risks and Open Questions

- risk: `users` rebuild silently drops a column, index, or the self-FK -> mitigation: explicit column lists both sides, row-count assertion, `sqlite_sequence` restore, `PRAGMA foreign_key_check`, dedicated `countrySchema` suite, mandatory `R2` gate before any consumer
- risk: AUTOINCREMENT high-water mark lost, recycling user ids into stale FK references -> mitigation: capture and restore per `021` precedent; assert in `countrySchema` suite
- risk: a residual email-only user lookup silently reintroduces global identity -> mitigation: `findCredentialsByEmail` signature requires country with no optional or overload; `R3` and `R5` risk focus name this explicitly; security matrix in `P4`
- risk: `isUniqueEmailError` stops matching under the composite constraint, converting a 409 into an unhandled 500 -> mitigation: `P3` verifies the actual driver message and pins the mapping with a named unit test
- risk: seeded salt collision makes both Alice accounts share a password, destroying the primary demo -> mitigation: `seededPassword(email, country)`; `P5` acceptance and `R5` risk focus assert distinct hashes
- risk: green `npm run verify` hides a broken web integration tier -> mitigation: `E11-web-int` is a separate mandatory `G3` entry, restated in the schedule
- risk: `apps/api/data/shop.db` is stale at `023` and misleads schema reasoning -> mitigation: recorded in Repository Findings; always reconstruct through the runner against a fresh database
- risk: `Country` and postal `CountryCode` conflated, breaking seeded `'GB'` addresses -> mitigation: separate module, explicit TSDoc, reject-`'GB'` contract test, `R1` risk focus
- risk: legacy browser cart id orphaned or duplicated on upgrade -> mitigation: one-time idempotent adoption into the `UK` slot with a dedicated test; `R7` risk focus
- question: should an admin be able to switch country from the top bar in stage 1, or only from stage 2 alongside admin section scoping? -> owner/gate: validate at `G0`; plan currently defers admin switching to stage 2
- question: should `company_accounts.country` be enforced against member countries in stage 1, or stay data-only until the stage 2 invite gate? -> owner/gate: validate at `G0`; plan currently keeps it data-only
- question: human smoke check of the picker and login journey at `1920x1080` -> owner: user, after merge. Never a packet test duty, verification, acceptance, or gate condition

## Done Criteria

- seven-country enum exists in shared contracts, distinct from postal `CountryCode`, with `'GB'` still valid for addresses
- migration `032` applied; `users` unique on `(email, country)`; `orders`, `carts`, `company_accounts` carry country; every pre-existing row reads `UK`; row counts and AUTOINCREMENT high-water mark preserved; `PRAGMA foreign_key_check` clean
- same email exists as separate accounts in `UK` and `DE` with different passwords, different ids, and independent carts
- right password with wrong country fails with a response byte-identical to a wrong-password failure, proven by an automated security test
- login and signup carry country; `/me` reports it; picker visible to logged-out visitors, defaults `US`, persists across reload
- guest cart does not follow across a country change, and the message states that plainly without claiming a merge or discard
- `npm run reset` deterministic; seeded fixtures match documented credentials verbatim
- `npm run verify` green and `npm run test:integration -w @shop/web` green, both run once after all fixes settle
- README states seeded accounts are `UK` while the default landing country is `US`; `AGENTS.md` migration head reads `032`; high-level plan and handoff carry stage 1 status
- no availability, blocking, banner, promo-targeting, postcode, timezone, translation, or money behaviour introduced
