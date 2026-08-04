# Country Localisation Stage 2 Coding Plan

Status: proposed
Source: `plans/country_localisation_handoff.md` -> "Delivery Stages" item 2 (behaviour), with binding detail from Availability Rules, Country Selection, Identity, Configuration Location, Blocked Product Meets Existing Features
Repository baseline: branch `expansion_002`, merge `a37104a` (stage 1 `259b2bf`); inspected 2026-08-04

## Runtime Worktree

- source: current branch at runtime -> record source checkout absolute path, branch name, and branch `HEAD` revision before any implementation write
- detached `HEAD` -> stop and ask user to select a branch
- uncommitted or untracked source-checkout changes relevant to this work and absent from branch `HEAD` -> stop and ask user to commit them or choose a baseline. Never copy, stash, discard, or import them without explicit approval
- create: dedicated implementation branch + dedicated worktree -> `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`; verify branch and base revision before `G0`
- execution root: every worker, reviewer, test, fix, and convergence action runs inside the worktree; repository-relative paths resolve against the worktree root
- integration: no merge, rebase, cherry-pick, copy-back, branch deletion, or worktree cleanup at completion; user handles merge into the source branch
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state the worktree remains intact and user handles merge
- source checkout stays read-only after worktree creation, except the saved plan and run-scoped temp state

## Objective

Ship stage 2 behaviour: per-country availability blocking enforced server-side, per-country banner, country-targeted promotions, cross-border delivery refusal, per-country postcode rules, time-zone-driven delivery cut-off, admin country picker unlock, admin country scoping + audit. Stage 2 completes when a buyer in one country provably cannot see, open, add, or check out a lot blocked for that country through any read or write path, cannot have it delivered across a border, and an admin can stand in a chosen country across `/admin`.

Stage 1 (identity, selection, migration) is landed and is input, not scope. Stage 3 (translation lookup layer, money/date formatter defork) is out.

## Scope

### In

- checked-in per-country profile files owning stage-2 facts, exported to both apps
- server-side availability blocking at category level and product level, per country
- `BLOCKED_IN_COUNTRY` in first precedence position of the shared bulk-add skip vocabulary
- blocked-lot propagation: cart add, bulk add, reorder, saved lists, Quick Order, Custom Blend, checkout, back-in-stock
- per-country banner surfaced from profile
- country-targeted promotions administered through existing `/admin` promo screens
- cross-border delivery refusal at delivery-site write and at checkout
- per-country postcode pattern + label replacing the single generic web-facing rule
- country time zone driving the delivery cut-off against existing UTC lead-time arithmetic
- admin picker unlock: browsing country overrides account country for reads, admin sections, and cart
- admin country scoping for country-bearing admin sections + admin audit country
- seed fixtures, README credentials, plan status sync

### Out

- translation lookup layer, language field, banner translation -> stage 3
- exchange rate, number/date format fields, money/date formatter defork -> stage 3
- per-country stock, cross-border delivery, IP/geolocation detection, address-derived region, menu-only hiding, second promo system in files, multi-country companies, translated product data -> rejected in handoff, never re-add
- standing-order schedule time zones (`features/standingOrders/standingOrderRules.ts` stays UTC)
- country on non-admin audit events
- `orders` snapshot of promo country scope
- billing-entity address country restriction (delivery only)
- cart read response marking blocked lines (checkout is the enforcement point)

## Repository Findings

- existing: `packages/contracts/src/country.ts` -> `Country`, `SUPPORTED_COUNTRIES`, `DEFAULT_GUEST_COUNTRY='US'`, `LEGACY_DATA_COUNTRY='UK'`; doc states no availability/timezone/format meaning attached yet
- existing: `apps/api/src/db/migrations/032_country_localisation.ts` -> `country` on `users` (`UNIQUE (email, country)`), `orders`, `carts`, `company_accounts`; migration head `032`, registered last in `apps/api/src/db/migrations/index.ts`
- existing: `apps/api/src/plugins/auth.ts:96` `authPlugin` -> only `decorateRequest` site in the API; `request.authenticatedUser` is `SessionUser`, which already carries `country` (`apps/api/src/features/auth/sessionRepository.ts:4`)
- gap: no request-scoped resolved country. Country reaches the API only as a body field on `POST /api/cart`, `/signup`, `/login`, `/forgot-password`
- gap: no catalog read path consults country. `apps/api/src/features/catalog/catalogSql.ts:24` `buildCatalogPredicate` is the single list/count choke point; detail/comparison/SKU paths bypass it (`productRepository.ts:277,305,333,342`)
- gap: `apps/api/src/features/cart/cartBulkAddRules.ts:24` `BULK_ADD_SKIP_REASONS` has five members, no `BLOCKED_IN_COUNTRY`; precedence is expressed only by the `if`-chain order inside `classifyBulkAddGroup` (`:143`) plus a doc comment (`:20`)
- gap: transport skip vocabulary is hand-duplicated three times -> `packages/contracts/src/reorder.ts:17`, `savedLists.ts:126`, `quickOrder.ts:22`; web mirrors are `Readonly<Record<Reason,string>>` so a contract addition breaks web typecheck immediately
- gap: `packages/contracts/src/address.ts:25` holds one generic postcode pattern `^[A-Za-z0-9][A-Za-z0-9 -]*$`; `apps/web/src/features/account/PostalAddressFields.tsx:54` mirrors it; `apps/api/src/features/tradeAccount/addressRules.ts:39` normalises but never validates format
- gap: no time-zone handling anywhere. `apps/api/src/features/delivery/deliverySlotRules.ts:47` `toUtcDayStart` discards time of day, so no cut-off hour exists. `Clock` is `{ now(): Date }` (`features/auth/authService.ts:17`), defaulted at `apps/api/src/app.ts:279`
- gap: no banner data feature. `apps/web/src/components/home/PromoBanner.tsx` and siblings are static prop-less marketing JSX; zero `banner` hits in `packages/contracts/src`
- gap: `promo_codes` has no country column (`001_initial.ts:19`, `003_promo_columns.ts:15`, `024_pricing_promotions.ts:90`); `promo_code_countries` does not exist
- gap: `AuditContext` (`apps/api/src/features/audit/auditEvent.ts:137`) carries actor + requestId only; every admin action builds `metadata = {}`
- gap: admin web shell holds no shared state. `apps/web/src/features/admin/AdminLayout.tsx:5` is pure layout; no admin page calls `useCountry()`
- constraint: `apps/web` must not import `@shop/catalog` (asserted in `apps/web/src/components/packaging/catalogPackagingPalettes.ts:18`). `@shop/contracts` is the only shared package both apps consume
- constraint: `packages/contracts` cannot import `@shop/catalog` (dependency direction `contracts -> api + web`, `catalog -> api`)
- constraint: contracts test runner glob is flat -> `packages/contracts/test/*.test.ts` only (`packages/contracts/package.json`)
- constraint: API suites register by glob -> unit `apps/api/src/**/*.test.ts`, integration `apps/api/test/**/*.integration.test.ts`. Off-convention files never run
- constraint: root `npm test` runs web `test:unit` only; `apps/web` integration tier runs solely through `npm run test:integration -w @shop/web`
- constraint: stale `packages/contracts/dist` makes downstream typecheck fail with phantom missing-export errors -> rebuild contracts after every contracts change
- constraint: `npm exec -w <workspace>` changes cwd -> focused test paths are workspace-relative, not repository-relative
- constraint: seeded integration DBs carry global demo rows -> scope assertions to test-owned identifiers (unique email, request id, idempotency key)
- reuse: `apps/api/src/features/checkout/checkoutService.ts:464` `cartMeetsVariantMoq` already re-reads each line's live variant inside the preparation transaction -> the natural sibling hook for a blocked-line gate
- reuse: `apps/api/src/features/backInStock/backInStockNotifyHandler.ts:57` already cancels pending alerts for retired lots inside a per-row transaction -> blocked lots join the same branch
- reuse: `apps/api/src/features/catalog/catalogSql.ts:24` `buildCatalogPredicate` -> extend with a blocked-slug/category exclusion rather than filtering in the service
- reuse: `apps/api/src/features/featureFlags/featureFlagResolver.ts:9` read-through resolver -> pattern for a process-local profile lookup
- reuse: `apps/web/src/hooks/CountryContext.tsx:33` `isAccountBound = user !== null` -> single edit point for the admin unlock
- reuse: `apps/web/src/lib/cartStorage.ts:8` cart id already keyed `shop-qarefully-cart-id.<COUNTRY>` and `carts.country` already persisted -> seven independent admin carts need no new schema

## Decisions and Invariants

- profile home: `packages/contracts/src/countryProfiles/` -> one file per country (`uk.ts`,`us.ts`,`cn.ts`,`pl.ts`,`es.ts`,`de.ts`,`fr.ts`) + `types.ts` + `index.ts`, re-exported through `packages/contracts/src/index.ts` and a new `./country-profiles` subpath. Rationale: contracts is the only package both apps import, and already owns shared static business constants (`pricing.ts` `TIER_LADDER`, `delivery.ts` lead-time constants). No new workspace.
- stage-2 profile fields only: `blockedCategories`, `blockedProductSlugs`, `banner`, `postcode {pattern,label,example}`, `deliveryCountryCodes`, `timeZone`, `deliveryCutoffHour`. Stage-3 fields (language, exchange rate, number/date formats) are not pre-declared -> no empty scaffolding.
- `Country` (identity) never equals `PostalAddress.countryCode` (ISO postal). Profile `deliveryCountryCodes` is the only bridge. Preserve the doc invariant in `packages/contracts/src/address.ts:29`.
- resolved country precedence, request-scoped: admin browsing header -> authenticated account country -> guest `x-shop-country` header -> `DEFAULT_GUEST_COUNTRY`. A signed-in non-admin's header is ignored, always.
- header is advisory for browsing only. Every cart-scoped and checkout-scoped decision resolves country from the persisted `carts.country` row, never from the header -> a spoofed header cannot bypass a block on an existing cart.
- blocking is file-driven and read-only. It never writes stock, never emits a stock-change event, never calls `StockChangeObserver`. One shared stock pool stays intact.
- blocked lot is indistinguishable from a non-existent lot. Detail and reviews return the existing 404 shape; back-in-stock subscribe returns existing `VARIANT_NOT_FOUND`; promo country mismatch returns existing `PromoValidationErrorCode` member `INVALID`. No new code discloses that a blocked thing exists elsewhere. Matches the existing non-disclosure rationale on `DELIVERY_SITE_NOT_FOUND` (`apps/api/src/features/checkout/checkoutTypes.ts:43`).
- `BLOCKED_IN_COUNTRY` takes first precedence in `classifyBulkAddGroup`, ahead of `VARIANT_RETIRED`. Any lower position leaks retirement or stock state of a blocked lot.
- Custom Blend reuses `BLEND_UNAVAILABLE` when base or any ingredient is blocked. No blend-specific blocked reason.
- Quick Order keeps `SKU_NOT_FOUND` and `BLOCKED_IN_COUNTRY` distinguishable: an unknown SKU is unknown, a known-but-blocked SKU is blocked. This is the one deliberate exception to non-disclosure, taken from the handoff.
- admin browsing country overrides account country for catalog reads, availability, admin sections, audit, and cart. Account country remains identity: login, order ownership, and `(email, country)` uniqueness are untouched.
- migration `033` is additive and forward-only. No rebuild of a landed table. Head becomes `033`.
- promo country targeting is a child table with empty-set semantics: no rows -> promo applies to every country. Avoids a nullable delimited column and matches the existing `category_scope` intent without overloading it.
- delivery cut-off derives the buyer's local civil day and hour from the profile IANA zone through `Intl.DateTimeFormat`; at or after `deliveryCutoffHour` the lead-time anchor advances one civil day before existing business-day arithmetic. `DeliveryDate` stays a `YYYY-MM-DD` civil date; the contract shape does not change.
- profile-to-catalog consistency is asserted at seed: every `blockedCategories` entry must match a live `products.category`, every `blockedProductSlugs` entry must match a live `products.slug`. Typos fail loudly, in the spirit of `validateCatalog`.
- assumption (validate at `G2`): "`/admin` follows the selected country across all nine sections" is implemented as -> filter by country where the data has a country dimension (`orders`, `users`, `reviews`, `promos`); annotate blocked state where the data is global catalog (`products`, `lots`); display the standing country without filtering where no country dimension exists (`jobs`, `webhooks`, `featureFlags`). Inventing a country column for infrastructure tables is rejected.
- assumption (validate at `G2`): admin audit country is recorded for admin-actor actions only. Country on customer-actor audit events is deferred.
- assumption (validate at `G1`): banner copy ships in English in stage 2 and moves behind a lookup key in stage 3.

## Target Design

### Country profile module (`packages/contracts`)

- `types.ts` -> `CountryProfile` interface + TypeBox schema where transport exposure is needed (banner only). Postcode rule ships as a string pattern plus label + example, not a `RegExp`, so it crosses the transport boundary unchanged.
- per-country file -> one `const` satisfying `CountryProfile`, `as const satisfies`.
- `index.ts` -> `COUNTRY_PROFILES: Readonly<Record<Country, CountryProfile>>` + `countryProfile(country): CountryProfile` accessor.
- fixture shape required by handoff: one category blocked in one country (sports drinks precedent), banner present only for `ES`.

### Request country resolution (`apps/api`)

- proposed `apps/api/src/plugins/countryContext.ts` -> `countryContextPlugin(sessions)`; `decorateRequest('resolvedCountry', null)` + `preHandler` running after `authPlugin`, reading `request.authenticatedUser` and the `x-shop-country` header.
- module augmentation adds `resolvedCountry: Country` to `FastifyRequest`, mirroring `apps/api/src/plugins/auth.ts:111`.
- registration in `apps/api/src/app.ts` immediately after the `authPlugin` invocation at `:661`, before route plugins at `:662`.
- proposed `apps/api/src/features/countryProfile/countryProfileService.ts` -> `isCategoryBlocked`, `isProductBlocked`, `blockedSlugsFor`, `blockedCategoriesFor`, `assertProfilesMatchCatalog(db)`.
- pure rules live in proposed `apps/api/src/features/countryProfile/availabilityRules.ts` so unit tests need no database.

### Catalog enforcement

- `buildCatalogPredicate` gains a country argument -> `AND p.category NOT IN (...) AND p.slug NOT IN (...)` bound parameters, empty sets degrade to no clause.
- detail, comparison, similar, related, bestsellers, filter-options, categories, bundles, custom-blend options, reviews-by-product all resolve through the same predicate or an explicit blocked check before mapping.
- `GET /api/products/:id` on a blocked product -> existing 404 path.
- `listCategories` excludes blocked categories, so the menu follows the server rather than being hidden client-side.

### Cart and bulk add

- `BULK_ADD_SKIP_REASONS` gains `BLOCKED_IN_COUNTRY` in first array position; `classifyBulkAddGroup` gains the matching first branch; the file doc comment at `:20` updates to the six-member order.
- `ClassifyBulkAddGroupInput` gains a `blocked: boolean` fact supplied by `addManyItems` from the cart's country.
- single add (`addItem`, `addConfigured`) gains `'BLOCKED_IN_COUNTRY'` in its result union; `routes/cart.ts` maps it to the same status used for a lot that cannot be added.
- `resolveBulkAddBlend` returns `undefined` when base or ingredient is blocked -> existing `BLEND_UNAVAILABLE` output, no new reason.

### Checkout

- new sibling of `cartMeetsVariantMoq` -> `cartLinesUnblocked(cart, dependencies)` inside the preparation transaction, before reservation and gateway.
- `CheckoutErrorCode` gains `'BLOCKED_IN_COUNTRY'` (carries `productIds`, mirroring `INSUFFICIENT_STOCK`) and `'DELIVERY_COUNTRY_NOT_ALLOWED'`.
- `resolveCommitments` rejects a delivery address whose `countryCode` is absent from the cart country's `deliveryCountryCodes`, for both saved-site and ad-hoc destinations.

### Back-in-stock

- subscribe on a blocked lot -> `VARIANT_NOT_FOUND`.
- `backInStockNotifyHandler` extends the retired-lot branch at `:57` to cancel a `pending` alert whose lot is blocked in the subscriber's country, re-read per row inside the existing per-row transaction, reusing `markCancelled` + the `back_in_stock.cancelled` audit action.
- subscriber country resolves from the alert's owning user row, not from a request.

### Delivery

- postcode: profile pattern validated in `apps/api/src/features/tradeAccount/addressRules.ts` at normalisation call sites; transport keeps the loose generic pattern so every existing address route stays valid; domain returns a clear country-named error.
- cut-off: `calculateLeadTime` gains the profile; proposed helpers derive local civil date + hour; existing business-day arithmetic is unchanged downstream of the anchor.
- `deliverySlotService` resolves the profile from the cart's country and passes it through; `isSlotBookable` receives the same anchor rule so checkout re-validation agrees with the offered list.

### Promotions

- migration `033` -> `promo_code_countries(promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE, country TEXT NOT NULL CHECK(...), PRIMARY KEY (promo_code_id, country))` + index on `country`.
- `validatePromo` gains the cart country; a promo with targeting rows that exclude the country fails as `INVALID`.
- admin promo create/update accept an optional country array; empty/omitted means all countries.

### Web

- `apiFetch` attaches `x-shop-country` on every request from a module-level country holder set by `CountryProvider`, so no call site changes.
- `CountryContext` -> `isAccountBound = user !== null && user.role !== 'admin'`; admin selection persists through the existing `countryStorage` key.
- banner renders from the profile in `Layout`, above `<main>`, only when the active country's profile carries one.
- `PostalAddressFields` takes label/pattern/example from the active country profile instead of its hard-coded constants.

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> P3 -> R3 -> GR3 -> P4 -> R4 -> GR4 -> {P5 -> R5 -> GR5 -> P6 -> R6 -> GR6 -> P7 -> R7 -> GR7 -> P8 -> R8 -> GR8 -> P9 -> R9 -> GR9 -> P10 -> R10 -> GR10 -> P11 -> R11 -> GR11 -> P12 -> R12 -> GR12 || W1 -> RW1 -> GW1 -> W2 -> RW2 -> GW2 -> W3 -> RW3 -> GW3 -> W4 -> RW4 -> GW4} -> G2 -> S1 -> R13 -> GR13 -> G3`

- `G0`: worktree created and verified; Node 22 selected; baseline evidence `E0`, `E0b` captured green
- `GR1`,`GR2`: contracts-layer review gates; both must pass before any consumer compiles against the new surface
- `G1`: contracts settled + `npm run build -w @shop/contracts` succeeded -> downstream typecheck uses fresh `dist`
- `GR3`: migration review gate; blocks every promo consumer
- `GR4`: country-resolution review gate; blocks both lanes (API spine needs the service, web lane needs the header contract)
- `GR5`: catalog-enforcement gate; additionally blocks `W2`
- `GR8`: delivery-domain gate; additionally blocks `W3`
- `GR11`: admin-scoping gate; additionally blocks `W4`
- `G2`: reviewed fan-in of both lanes; assumptions in Decisions confirmed or corrected here
- `GR13`: convergence review gate
- `G3`: completion gate; full suite plus web integration tier green once after all fixes settle

Cross-lane rule: API spine owns `apps/api/**` plus the contracts edits in `P10`; web lane owns `apps/web/**`. Write ownership is disjoint at every point where the lanes run concurrently.

## Work Packets

### P1: Country profile module in contracts

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/countryProfiles/**`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/country-profiles.test.ts`
- reads: `packages/contracts/src/country.ts` -> `Country`, `SUPPORTED_COUNTRIES` -> country vocabulary and ordering; `packages/contracts/src/pricing.ts` -> module shape for shared static business constants; `packages/contracts/src/address.ts` -> `Postcode`, `CountryCode`, doc at `:29` -> identity-vs-postal invariant to preserve; `packages/contracts/package.json` -> `exports` map + flat test glob
- acceptance: `COUNTRY_PROFILES` covers all seven countries with no missing key; `countryProfile()` is total over `Country`; new `./country-profiles` subpath resolves; `ES` is the only profile carrying a banner; exactly one country blocks a category; `packages/contracts` tests pass
- non-goals: language, exchange rate, number/date formats; any API or web consumption; blocked-slug existence checks against the database
- changes:
  - add `types.ts` -> `CountryProfile` with `blockedCategories`, `blockedProductSlugs`, `banner`, `postcode {pattern,label,example}`, `deliveryCountryCodes`, `timeZone`, `deliveryCutoffHour`; TSDoc each field with its stage-2 meaning and the identity-vs-postal warning on `deliveryCountryCodes`
  - add one file per country, `as const satisfies CountryProfile`; postal mapping `UK->GB`, others -> own ISO code; IANA zones `Europe/London`, `America/New_York`, `Asia/Shanghai`, `Europe/Warsaw`, `Europe/Madrid`, `Europe/Berlin`, `Europe/Paris`
  - postcode rules per handoff: `US` 5-digit + label `ZIP`, `PL` `00-001`, `CN` 6-digit, `UK` current format, `DE`/`FR`/`ES` 5-digit with local labels
  - block a category in exactly one country using the sports-drinks precedent; give `ES` a banner; leave the other six banners absent
  - add `index.ts` with `COUNTRY_PROFILES` + `countryProfile()`; export from `packages/contracts/src/index.ts`; add the `./country-profiles` subpath to `exports`
  - add `packages/contracts/test/country-profiles.test.ts` -> totality over `SUPPORTED_COUNTRIES`, postcode patterns accept their own example and reject a neighbour's, `deliveryCountryCodes` non-empty, `deliveryCutoffHour` in `0..23`, banner presence exactly `ES`
- invariants: no import from `@shop/catalog` or any app; postcode rule is a string pattern, never a `RegExp` literal in the exported shape; profile files are data only, no functions beyond the accessor in `index.ts`
- relevant evidence: `E0`
- test duty: `npm test -w @shop/contracts` -> `E1`; then `npm run build -w @shop/contracts` -> `E1b`
- verification: `E1` pass, `E1b` pass, fresh `packages/contracts/dist/countryProfiles/` present
- handoff: `CountryProfile` type, `COUNTRY_PROFILES`, `countryProfile()`, `./country-profiles` subpath
- review: `R1` -> `GR1` blocks `G1` and every downstream consumer

### P2: `BLOCKED_IN_COUNTRY` vocabulary

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/reorder.ts`, `packages/contracts/src/savedLists.ts`, `packages/contracts/src/quickOrder.ts`, `apps/web/src/features/reorder/reorderPresentation.ts`, `apps/web/src/features/savedLists/savedListsPresentation.ts`, `apps/web/src/features/quickOrder/quickOrderPresentation.ts`, colocated tests for those web modules
- reads: `packages/contracts/src/reorder.ts:17`, `savedLists.ts:126`, `quickOrder.ts:22` -> the three duplicated skip unions; `apps/api/src/features/cart/cartBulkAddRules.ts:20-32` -> documented precedence order (read only, `P6` owns the file); `apps/web/src/features/quickOrder/quickOrderPresentation.ts:20` -> `Readonly<Record<Reason,string>>` mirror pattern
- acceptance: all three transport unions carry `BLOCKED_IN_COUNTRY`; all three web label maps carry a message that names the country restriction without naming stock or retirement; `npm run typecheck` passes repository-wide
- non-goals: editing `cartBulkAddRules.ts`; producing the reason anywhere; unifying the three duplicated unions into one shared schema
- changes:
  - add `BLOCKED_IN_COUNTRY` to each transport union with a TSDoc line stating it outranks every other reason and never discloses retirement or stock
  - `savedLists.ts` and `quickOrder.ts` carry existing "never produced by this surface" notes on `BLEND_UNAVAILABLE`; match that convention where the surface cannot produce the new reason
  - extend the three web label maps; keep wording free of stock and retirement language
  - extend the colocated web presentation tests to assert a message exists for the new reason and that `SKIP_REASONS`-style derived lists include it
- invariants: Quick Order keeps `SKU_NOT_FOUND` distinct from `BLOCKED_IN_COUNTRY`; the compile-time assignability assertion in `apps/api/src/features/quickOrder/quickOrderRules.ts:34` must still hold after `P6`
- relevant evidence: `E0`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/quickOrder/quickOrderPresentation.test.ts src/features/reorder/reorderPresentation.test.ts src/features/savedLists/savedListsPresentation.test.ts` -> `E2` (paths are workspace-relative); then `npm test -w @shop/contracts` -> `E2b`
- verification: `E2`, `E2b` pass
- handoff: widened `ReorderSkipReason`, `SavedListSkipReason`, `QuickOrderSkipReason`
- review: `R2` -> `GR2` blocks `G1`

### P3: Migration 033, promo country targeting

- mode: sequential after `G1`
- depends on: `G1`
- owns: `apps/api/src/db/migrations/033_promo_country_targeting.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/promoCountryTargeting.integration.test.ts`
- reads: `apps/api/src/db/migrations/032_country_localisation.ts` -> `COUNTRY_DEFINITION` CHECK literal, `addColumnIfMissing`, `assertForeignKeysClean` helpers; `apps/api/src/db/migrations/024_pricing_promotions.ts:69` -> promo migration precedent and `category_scope` CHECK style; `apps/api/src/db/migrate.ts` -> runner foreign-key suspension contract; `apps/api/test/db/countrySchema.integration.test.ts` -> schema assertion conventions
- acceptance: migration head is `033`; `promo_code_countries` exists with composite primary key, country CHECK, cascade delete; re-running migrations is a no-op; `PRAGMA foreign_key_check` clean
- non-goals: repository, service, route, or contract changes for promos (`P10` owns those); any column on `orders`; touching landed migrations
- changes:
  - create `033_promo_country_targeting.ts` -> `CREATE TABLE IF NOT EXISTS promo_code_countries(...)` with `promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE`, `country TEXT NOT NULL CHECK (country IN (...))`, `PRIMARY KEY (promo_code_id, country)`; index on `country`
  - reuse the seven-country CHECK literal exactly as written in `032`
  - append to `migrations` array in `index.ts`, last position
  - add the integration test: table shape, idempotent re-run, cascade delete removes targeting rows, foreign-key check clean, head version assertion
- invariants: additive, forward-only, transactional, idempotent; never toggle `foreign_keys` inside the migration transaction; empty targeting set means all countries (encoded by absence of rows, not by a sentinel)
- relevant evidence: `E0`
- test duty: `npm exec -w @shop/api -- tsx --test test/db/promoCountryTargeting.integration.test.ts test/db/migrations.integration.test.ts` -> `E3`
- verification: `E3` pass
- handoff: `promo_code_countries` schema; migration head `033`
- review: `R3` -> `GR3` blocks `P4` and `P10`

### P4: Request country resolution + profile service

- mode: sequential after `GR3`
- depends on: `P1`, `P3`
- owns: `apps/api/src/plugins/countryContext.ts`, `apps/api/src/features/countryProfile/**`, `apps/api/src/app.ts`, `apps/api/test/country/countryResolution.integration.test.ts`
- reads: `apps/api/src/plugins/auth.ts:41-116` -> `getAuthenticatedUser`, `decorateRequest` idiom, module augmentation block; `apps/api/src/app.ts:276-290,631-702` -> `AppContext`, `createAppServices` head, plugin registration order at `:660-662`; `apps/api/src/features/auth/sessionRepository.ts:4` -> `SessionUser.country`; `apps/api/src/features/featureFlags/featureFlagResolver.ts:9` -> process-local resolver pattern; `apps/api/src/features/catalog/productRepository.ts:286` -> `listCategories` source of category values
- acceptance: `request.resolvedCountry` is a valid `Country` on every request; admin header override applies only to `role === 'admin'`; signed-in customer header is ignored; guest header respected; invalid or absent header falls back to `DEFAULT_GUEST_COUNTRY`; `assertProfilesMatchCatalog` throws naming the offending category or slug
- non-goals: consuming the resolved country in any route or service (`P5`-`P12` own that); calling `assertProfilesMatchCatalog` from seed (`S1` owns that call)
- changes:
  - add `apps/api/src/features/countryProfile/availabilityRules.ts` -> pure `isCategoryBlocked(profile, category)`, `isProductBlocked(profile, slug)`, `blockedCategoriesFor`, `blockedSlugsFor`; colocated `availabilityRules.test.ts`
  - add `apps/api/src/features/countryProfile/countryProfileService.ts` -> `createCountryProfileService()` exposing profile lookup plus the availability predicates, and `assertProfilesMatchCatalog(db)` querying `DISTINCT category` and `slug` from `products`
  - add `apps/api/src/plugins/countryContext.ts` -> `countryContextPlugin(sessions)`; `decorateRequest('resolvedCountry', null)`; `preHandler` applying the documented precedence; module augmentation adding `resolvedCountry: Country` to `FastifyRequest`
  - register the plugin in `app.ts` directly after the `authPlugin` invocation, before route plugins; expose `countryProfiles` on `AppServices`
  - add `apps/api/test/country/countryResolution.integration.test.ts` -> guest default, guest header honoured, invalid header rejected to default, signed-in customer header ignored, admin header honoured, header case-insensitivity
- invariants: no per-request database read for the profile; no mutable module-global request state; the plugin never throws on a malformed header, it falls back; `authPlugin` stays the only session resolver
- relevant evidence: `E1`, `E3`
- test duty: `npm exec -w @shop/api -- tsx --test test/country/countryResolution.integration.test.ts "src/features/countryProfile/*.test.ts"` -> `E4`
- verification: `E4` pass; `npm run typecheck -w @shop/api` clean
- handoff: `request.resolvedCountry`; `services.countryProfiles`; availability predicates; `assertProfilesMatchCatalog`
- review: `R4` -> `GR4` blocks `P5` and `W1`

### P5: Catalog read-path enforcement

- mode: sequential after `GR4`; parallel with web lane
- depends on: `P4`
- owns: `apps/api/src/features/catalog/**`, `apps/api/src/routes/products.ts`, `apps/api/src/routes/bundles.ts`, `apps/api/src/mappers/product.ts`, `apps/api/src/app.ts`, `apps/api/test/catalog/countryAvailability.integration.test.ts`
- reads: `apps/api/src/features/catalog/catalogSql.ts:12,24,112` -> `availableToSellSql`, `buildCatalogPredicate`, `catalogOrderBy`; `apps/api/src/features/catalog/productRepository.ts:78,172,277,286,295,305,313,322,329,333,342,355` -> every read method and which ones lack an `active` filter; `apps/api/src/routes/products.ts:23-205` -> all eight endpoints; `apps/api/src/features/bundles/bundleService.ts:58,125` -> `toCuratedBundle`, `collectUnavailableComponentVariantIds`; `apps/api/src/features/countryProfile/availabilityRules.ts` -> predicates from `P4`
- acceptance: for a country blocking a category, list/search/bestsellers/filter-options/categories/compare/similar/related omit every product in it; detail returns 404; bundles containing a blocked component treat it as unavailable; SKU and variant lookups used by other features expose no blocked row; a country not blocking it sees everything unchanged
- non-goals: cart, checkout, back-in-stock, reviews moderation, admin catalog surfaces
- changes:
  - extend `buildCatalogPredicate` with country-derived exclusions on `p.category` and `p.slug`; empty sets emit no clause
  - thread the country through `ProductService` from `request.resolvedCountry` at each route; wire `services.countryProfiles` into `createProductService` in `app.ts`
  - close the unfiltered paths: `findById`, `listByIds`, `findVariantById`, `findVariantsByIds`, `findVariantsBySkus` gain the same exclusion so Quick Order SKU resolution and comparison cannot surface a blocked lot
  - `listCategories` excludes blocked categories
  - bundles and custom-blend options treat blocked components as unavailable through their existing unavailability paths
  - add the integration test covering every endpoint above for a blocking country and a non-blocking country, using a seeded blocked category and a test-owned product slug
- invariants: blocked and non-existent are indistinguishable in every response; no response body gains a `blocked` field; product-level and category-level blocking behave identically at the boundary; no stock write, no stock event
- relevant evidence: `E1`, `E4`
- test duty: `npm exec -w @shop/api -- tsx --test test/catalog/countryAvailability.integration.test.ts` -> `E5`
- verification: `E5` pass; existing `apps/api/test` catalog suites still pass under `E5b` = `npm exec -w @shop/api -- tsx --test "test/**/*.integration.test.ts"` only if `E5` surfaces regressions; otherwise defer breadth to `G3`
- handoff: country-aware catalog repository + service signatures
- review: `R5` -> `GR5` blocks `P6` and `W2`

### P6: Cart, bulk add, Custom Blend enforcement

- mode: sequential after `GR5`
- depends on: `P2`, `P5`
- owns: `apps/api/src/features/cart/**`, `apps/api/src/routes/cart.ts`, `apps/api/src/features/customBlend/**`, `apps/api/src/routes/customBlends.ts`, `apps/api/src/features/reorder/reorderRules.ts`, `apps/api/src/features/savedLists/savedListRules.ts`, `apps/api/src/features/quickOrder/quickOrderRules.ts`, `apps/api/src/app.ts`, `apps/api/test/cart/cartCountryBlocking.integration.test.ts`
- reads: `apps/api/src/features/cart/cartBulkAddRules.ts:20-32,73-84,143-177` -> doc comment, `BULK_ADD_SKIP_REASONS`, `ClassifyBulkAddGroupInput`, the `if`-chain; `apps/api/src/features/cart/cartService.ts:489,521,565,615,642-670` -> `addItem`, `addConfigured`, `resolveBulkAddBlend`, `addManyItems` and its group loop; `apps/api/src/features/cart/cartRepository.ts:42,82` -> `create(id, country)`, country is currently write-only; `apps/api/src/routes/cart.ts:80-159` -> add route and its outcome mapping; `apps/api/src/features/quickOrder/quickOrderRules.ts:19-37` -> pre-skip reasons and the compile-time assignability assertion
- acceptance: adding a blocked lot to a cart in a blocking country is refused; bulk add reports `BLOCKED_IN_COUNTRY` and nothing else for that line even when the lot is also retired, out of stock, and below MOQ; reorder, saved lists, and Quick Order surface the reason without new vocabulary; Quick Order distinguishes an unknown SKU from a blocked SKU; a blend whose base or ingredient is blocked yields `BLEND_UNAVAILABLE`
- non-goals: checkout, back-in-stock, cart read response shape
- changes:
  - add `blockedInCountry` read to `CartRepository` so cart-scoped operations resolve country from the `carts` row
  - add `BLOCKED_IN_COUNTRY` first in `BULK_ADD_SKIP_REASONS`; add the matching first branch in `classifyBulkAddGroup`; extend `ClassifyBulkAddGroupInput` with the blocked fact; update the precedence doc comment to the six-member order
  - supply the fact in `addManyItems` from the cart country + profile predicates
  - extend `addItem` and `addConfigured` result unions with `'BLOCKED_IN_COUNTRY'`; map it in `routes/cart.ts` and `routes/customBlends.ts`
  - extend `resolveBulkAddBlend` to return `undefined` when base or any ingredient is blocked
  - widen the reorder/savedLists/quickOrder rule-side unions to match the contracts widened in `P2`; keep the Quick Order assignability assertion satisfied
  - extend `cartBulkAddRules.test.ts`, `reorderRules.test.ts`, `quickOrderRules.test.ts` with precedence cases: blocked + retired, blocked + out of stock, blocked + below MOQ, blocked + invalid quantity -> always `BLOCKED_IN_COUNTRY`
  - add the integration test: add refused, bulk add reason, blend unavailable, cart in a non-blocking country unaffected
- invariants: precedence order is the single source of the answer; a blocked line's response never varies with its retirement or stock state; cart country comes from the persisted row, never the request header
- relevant evidence: `E2`, `E4`, `E5`
- test duty: `npm exec -w @shop/api -- tsx --test test/cart/cartCountryBlocking.integration.test.ts "src/features/cart/*.test.ts" "src/features/quickOrder/*.test.ts" "src/features/reorder/*.test.ts"` -> `E6`
- verification: `E6` pass
- handoff: six-member skip vocabulary with blocked-first precedence; cart-country resolution helper
- review: `R6` -> `GR6` blocks `P7`

### P7: Checkout + back-in-stock enforcement

- mode: sequential after `GR6`
- depends on: `P6`
- owns: `apps/api/src/features/checkout/**`, `apps/api/src/features/backInStock/**`, `apps/api/src/routes/backInStock.ts`, `apps/api/src/app.ts`, `apps/api/test/checkout/checkoutCountryBlocking.integration.test.ts`, `apps/api/test/backInStock/backInStockCountry.integration.test.ts`
- reads: `apps/api/src/features/checkout/checkoutService.ts:184-303,425,464` -> `prepare` gate order, `customBlendLinesRemainEligible`, `cartMeetsVariantMoq`; `apps/api/src/features/checkout/checkoutTypes.ts:25-80` -> `CheckoutErrorCode`, `CheckoutResult` variants and the `INSUFFICIENT_STOCK` payload shape; `apps/api/src/features/backInStock/backInStockNotifyHandler.ts:43-107` -> drain-time gates and the per-row transaction; `apps/api/src/features/backInStock/backInStockService.ts:67,87,113-127` -> `isRetired`, `subscribe`, `cancel`; `apps/api/src/features/backInStock/backInStockErrors.ts` -> `BackInStockErrorCode`
- acceptance: checkout of a cart containing a blocked line fails before reservation and before any gateway call with `BLOCKED_IN_COUNTRY` carrying the offending product ids; subscribing to a blocked lot returns `VARIANT_NOT_FOUND`; a `pending` alert whose lot is blocked for the subscriber's country is cancelled at drain with the existing `back_in_stock.cancelled` audit action; a block landing mid-drain is respected by the per-row re-read
- non-goals: refund, return, approval, or payment-gateway behaviour; new audit action names
- changes:
  - add `cartLinesUnblocked(cart, dependencies)` beside `cartMeetsVariantMoq`; call it inside the preparation transaction before `resolveCommitments`
  - add `'BLOCKED_IN_COUNTRY'` to `CheckoutErrorCode` and a `CheckoutResult` variant carrying `productIds`, mirroring `INSUFFICIENT_STOCK`; exclude it from the plain-error branch as that union already does for payload-carrying codes
  - map the new code in the payments route to a status consistent with the existing pre-gateway failure mapping
  - extend `subscribe` to treat a blocked lot as `VARIANT_NOT_FOUND`, checked before the retired check so retirement is never disclosed
  - extend the notify handler's retired branch to cancel blocked alerts, resolving each subscriber's country from their user row inside the existing per-row transaction
  - add both integration tests, including a mid-drain block applied between list and fan-out
- invariants: no state change before the block is detected; cancellation reuses the existing path and audit action, adds no new action; subscriber country comes from persistence, never a request
- relevant evidence: `E4`, `E6`
- test duty: `npm exec -w @shop/api -- tsx --test test/checkout/checkoutCountryBlocking.integration.test.ts test/backInStock/backInStockCountry.integration.test.ts` -> `E7`
- verification: `E7` pass
- handoff: `BLOCKED_IN_COUNTRY` checkout failure shape
- review: `R7` -> `GR7` blocks `P8`

### P8: Postcode rules + cross-border delivery refusal

- mode: sequential after `GR7`
- depends on: `P4`, `P7`
- owns: `apps/api/src/features/tradeAccount/**`, `apps/api/src/routes/tradeAccount.ts`, `apps/api/src/features/checkout/checkoutService.ts` (cross-border gate only), `apps/api/test/tradeAccount/addressCountry.integration.test.ts`, `apps/api/test/checkout/crossBorderDelivery.integration.test.ts`
- reads: `apps/api/src/features/tradeAccount/addressRules.ts:18-75` -> `normalizeText`, `normalizePostalAddress`, `toAddressColumns`; `apps/api/src/features/tradeAccount/deliverySiteService.ts:116,140` and `billingEntityService.ts:119,148` -> normalisation call sites; `apps/api/src/features/checkout/checkoutService.ts:120-182` -> `resolveCommitments`, saved vs ad-hoc destination branches; `packages/contracts/src/address.ts:22-53` -> `Postcode`, `CountryCode`, `PostalAddress`; `apps/api/src/features/payments/paymentRepository.ts:104,121` -> address folded into the idempotency fingerprint
- acceptance: saving a delivery site whose postcode fails the account country's pattern is refused with a message naming the country's label; saving a delivery site whose `countryCode` is outside the account country's `deliveryCountryCodes` is refused; checkout refuses both saved and ad-hoc delivery addresses outside the cart country's allowlist with `DELIVERY_COUNTRY_NOT_ALLOWED`; billing entity addresses stay unrestricted; existing UK fixtures keep passing
- non-goals: transport-schema postcode tightening; billing address country rules; returns addresses; changing the payment idempotency fingerprint
- changes:
  - add `validatePostcodeForCountry(profile, postcode)` and `isDeliverableCountryCode(profile, countryCode)` to `addressRules.ts`, with colocated unit tests per country including a neighbour-format rejection
  - call postcode validation from delivery-site create/update after normalisation; return a domain error the route maps to 400 with the profile label
  - call the deliverable-country check from delivery-site create/update and from `resolveCommitments` for both destination branches
  - add `'DELIVERY_COUNTRY_NOT_ALLOWED'` to `CheckoutErrorCode` as a plain error
  - add both integration tests
- invariants: normalisation still runs before validation, so the stored value and the validated value agree; `PostalAddress.countryCode` remains ISO postal and is never compared to `Country` except through `deliveryCountryCodes`; the payment idempotency fingerprint input is unchanged
- relevant evidence: `E1`, `E4`, `E7`
- test duty: `npm exec -w @shop/api -- tsx --test test/tradeAccount/addressCountry.integration.test.ts test/checkout/crossBorderDelivery.integration.test.ts "src/features/tradeAccount/*.test.ts"` -> `E8`
- verification: `E8` pass
- handoff: postcode + deliverable-country predicates; `DELIVERY_COUNTRY_NOT_ALLOWED`
- review: `R8` -> `GR8` blocks `P9` and `W3`

### P9: Time-zone delivery cut-off

- mode: sequential after `GR8`
- depends on: `P4`, `P8`
- owns: `apps/api/src/features/delivery/**`, `apps/api/src/routes/deliverySlots.ts`, `apps/api/test/delivery/deliveryCutoff.integration.test.ts`, `apps/api/test/delivery/deliverySlotRules.test.ts`
- reads: `apps/api/src/features/delivery/deliverySlotRules.ts:16-40,42-97,122-154,166-181,191-207` -> module doc, private day helpers, `calculateLeadTime`, `listBookableSlots`, `isSlotBookable`; `apps/api/src/features/delivery/deliverySlotService.ts:12-43` -> `DeliverySlotDependencies`, clock injection at `:35`; `apps/api/src/features/checkout/checkoutService.ts:161-171` -> checkout re-validation via `isSlotBookable`; `packages/contracts/src/delivery.ts:9-17,55` -> lead-time constants and the civil-date doc
- acceptance: an order placed before the country cut-off keeps today's anchor; at or after the cut-off the anchor advances one civil day; two countries with different zones and the same UTC instant can produce different earliest dates; DST transitions produce no skipped or duplicated day; `CN` (no DST) behaves stably across the northern-hemisphere transition dates; the offered list and the checkout re-validation always agree
- non-goals: standing-order schedules; ordering blackouts; changing `DeliveryDate` shape or lead-time constants; web rendering
- changes:
  - extend `CalculateLeadTimeInput` and `ListBookableSlotsInput` with the country profile; derive local civil year-month-day and hour through `Intl.DateTimeFormat` with the profile zone
  - replace `toUtcDayStart(now)` as the anchor with the local civil day, advanced by one when local hour >= `deliveryCutoffHour`; leave `addBusinessDays`, `isBusinessDay`, `nextBusinessDay` untouched
  - apply the same anchor rule inside `isSlotBookable` so checkout cannot accept a slot the list would not offer
  - `deliverySlotService` resolves the profile from the cart's country and passes it through
  - rewrite the module doc at `:16-40` to state the new rule precisely; the old "no timezone profile" claim becomes wrong
  - extend `deliverySlotRules.test.ts` with fixed-instant cases: just before cut-off, exactly at cut-off, just after, local midnight boundary, EU spring-forward, EU fall-back, US transition on its own date, `CN` across both
  - add the integration test driving `GET /api/delivery/slots` for two countries at one instant
- invariants: no ambient clock, locale, or zone read; every input instant still arrives through the injected `Clock`; business-day arithmetic stays calendar-based; weekend rule unchanged
- relevant evidence: `E4`, `E8`
- test duty: `npm exec -w @shop/api -- tsx --test test/delivery/deliverySlotRules.test.ts test/delivery/deliveryCutoff.integration.test.ts test/delivery/deliverySlotRoutes.integration.test.ts` -> `E9`
- verification: `E9` pass
- handoff: profile-aware lead-time API
- review: `R9` -> `GR9` blocks `P10`

### P10: Country-targeted promotions

- mode: sequential after `GR9`
- depends on: `P3`, `P9`
- owns: `apps/api/src/features/promos/**`, `apps/api/src/routes/promo.ts`, `apps/api/src/routes/adminPromos.ts`, `packages/contracts/src/promos.ts`, `packages/contracts/src/adminPromos.ts`, `apps/api/test/promos/promoCountry.integration.test.ts`
- reads: `apps/api/src/features/promos/promoService.ts:35,71,96,155` -> `createPromoService`, `resolvePromoScope`, `validatePromo`, `calculateDiscount`; `apps/api/src/features/promos/promoRepository.ts:3,35,69,72` -> `PromoRecord`, lookup by code; `apps/api/src/features/promos/promoAdminService.ts:88,136,155,176,192` -> `normalizeWrite`, audit actions; `apps/api/src/routes/promo.ts:34-43` and `apps/api/src/features/checkout/checkoutService.ts:257-278` -> the two promo application sites; `packages/contracts/src/promos.ts:16` -> `PromoValidationErrorCode` members; `packages/contracts/src/adminPromos.ts:11,53,59` -> promo write shape
- acceptance: a promo with no targeting rows applies in every country; a promo targeted to a subset fails as `INVALID` elsewhere, with no hint that it exists for another country; admin create/update persist and return the targeting set; deactivate is unaffected; existing untargeted seeded promos behave exactly as before
- non-goals: admin web UI (`W4` owns it); snapshotting country scope on orders; new promo validation error codes
- changes:
  - extend `PromoRepository` with targeting read plus replace-on-write inside the existing transaction boundary
  - extend `validatePromo` with the cart country; a targeting miss returns `INVALID`
  - pass the cart country at both application sites
  - extend `AdminPromo`, `CreateAdminPromoBody`, `UpdateAdminPromoBody` with an optional country array; `normalizeWrite` rejects duplicates and unknown countries
  - keep the promo audit actions unchanged; record targeting size in metadata only if metadata already exists for that action
  - extend `promoService.test.ts`, `promoAdminService.test.ts`; add the integration test covering apply-in-target, reject-outside-target, untargeted-applies-everywhere
- invariants: country mismatch is indistinguishable from an unknown code; empty targeting means all countries; promo remains database-owned with no file-based fork
- relevant evidence: `E3`, `E6`, `E9`
- test duty: `npm run build -w @shop/contracts` then `npm exec -w @shop/api -- tsx --test test/promos/promoCountry.integration.test.ts "src/features/promos/*.test.ts"` -> `E10`
- verification: `E10` pass; `npm run typecheck` clean
- handoff: country-targeted promo contracts + service
- review: `R10` -> `GR10` blocks `P11`

### P11: Admin country scoping

- mode: sequential after `GR10`
- depends on: `P4`, `P10`
- owns: `apps/api/src/routes/adminOrdersList.ts`, `apps/api/src/routes/adminUsers.ts`, `apps/api/src/routes/adminPromos.ts`, `apps/api/src/routes/reviews.ts` (admin moderation endpoints only), `apps/api/src/routes/adminProducts.ts`, `apps/api/src/routes/adminVariants.ts`, `apps/api/src/features/catalog/productAdminService.ts`, `apps/api/src/features/catalog/variantAdminService.ts`, `apps/api/src/features/auth/userAdminRepository.ts`, `apps/api/src/features/orders/orderRepository.ts` (admin list query only), `apps/api/test/admin/adminCountryScope.integration.test.ts`
- reads: `apps/api/src/plugins/auth.ts:62` -> `requireAdmin`; `apps/api/src/routes/adminOrdersList.ts:28-70`, `adminUsers.ts:40-60`, `reviews.ts:339-365` -> admin list/detail handlers and their query shapes; `apps/api/src/features/countryProfile/countryProfileService.ts` -> availability predicates from `P4`; `apps/api/src/db/migrations/032_country_localisation.ts:99` -> `orders.country`
- acceptance: admin orders, users, reviews, and promos lists return only rows for the admin's standing country; a detail read of a row from another country returns the existing not-found response; admin product and lot listings annotate blocked state for the standing country without filtering; jobs, webhooks, and feature flags are unfiltered and unchanged; a non-admin cannot reach any of it
- non-goals: web admin shell (`W4`); audit country (`P12`); adding a country column to infrastructure tables; changing admin auth
- changes:
  - thread `request.resolvedCountry` into each country-bearing admin read; add the country predicate at the repository layer, not in route handlers
  - add blocked-state annotation to admin product and lot list responses, sourced from the profile
  - leave jobs, webhooks, and feature-flag handlers untouched
  - add the integration test: two admins standing in different countries see disjoint orders and users, a cross-country detail read is not found, catalog annotation reflects the standing country, infrastructure sections are unchanged
- invariants: country scoping is a filter, never a permission escalation; cross-country reads use the existing not-found response, never a distinct code; `requireAdmin` stays the only role gate
- relevant evidence: `E4`, `E10`
- test duty: `npm exec -w @shop/api -- tsx --test test/admin/adminCountryScope.integration.test.ts test/adminSurface.integration.test.ts` -> `E11`
- verification: `E11` pass
- handoff: country-scoped admin read surface
- review: `R11` -> `GR11` blocks `P12` and `W4`

### P12: Admin audit country

- mode: sequential after `GR11`
- depends on: `P11`
- owns: `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditService.ts`, admin route audit-context helpers in the files owned by `P11` plus `apps/api/src/routes/adminOrders.ts`, `adminRefunds.ts`, `adminInventory.ts`, `adminReturns.ts`, `adminFeatureFlags.ts`, `adminJobs.ts`, `adminWebhooks.ts`, `apps/api/test/audit/adminAuditCountry.integration.test.ts`
- reads: `apps/api/src/features/audit/auditEvent.ts:131-173,398-411,635` -> `AuditActor`, `AuditContext`, metadata value constraints, `MAX_METADATA_BYTES`, `buildAuditEvent`; `apps/api/src/features/audit/auditService.ts:31` -> `createAuditWriter`; `apps/api/src/routes/adminPromos.ts:27-30` -> the per-file `auditContext(request)` helper idiom; `apps/api/src/features/audit/auditRepository.ts:95` -> append and the append-only triggers
- acceptance: every admin-actor audit event records the country the admin stood in; customer and system events are unchanged; metadata stays within the size limit and the string-or-number value constraint; the append-only triggers and existing indexes are untouched
- non-goals: schema change; country on customer events; a country filter on the audit query contract
- changes:
  - extend `AuditContext` with an optional standing country; populate it in each admin route's `auditContext(request)` helper from `request.resolvedCountry`
  - carry it into metadata for admin action builders that currently emit `{}`; leave builders with existing metadata additive
  - extend audit unit tests for presence on admin actions and absence on customer actions
  - add the integration test asserting a promo mutation from two different standing countries records different metadata
- invariants: `audit_events` remains append-only and excluded from reset; no migration; metadata values stay `string | number`
- relevant evidence: `E11`
- test duty: `npm exec -w @shop/api -- tsx --test test/audit/adminAuditCountry.integration.test.ts "src/features/audit/*.test.ts"` -> `E12`
- verification: `E12` pass
- handoff: admin audit country recording
- review: `R12` -> `GR12` blocks `G2`

### W1: Country header transmission + admin picker unlock

- mode: sequential head of web lane; parallel with API spine after `GR4`
- depends on: `P1`, `P4`
- owns: `apps/web/src/api/client.ts`, `apps/web/src/hooks/CountryContext.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/components/CountryPicker.tsx`, `apps/web/src/components/Header.test.tsx`, `apps/web/src/components/CountryPicker.test.tsx`, `apps/web/src/hooks/CountryContext.test.tsx`
- reads: `apps/web/src/api/client.ts:56-98` -> `fetchWithResponseSchema`, header merge at `:63`; `apps/web/src/hooks/CountryContext.tsx:20-56` -> provider, `isAccountBound` at `:33`, `activeCountry` at `:34`, `selectCountry` at `:36`; `apps/web/src/components/Header.tsx:15-42` -> `countryDisabled` at `:20` and picker props; `apps/web/src/components/Header.test.tsx:98-113` -> the stage-1 admin pinning test and its deferral comment; `apps/web/src/hooks/useCart.ts:136-177` -> country-change re-seed already implemented
- acceptance: every API request carries `x-shop-country` matching the active country; an admin can change the picker and the header follows; a signed-in customer's picker stays disabled with the existing explanation; the stage-1 admin pinning test is replaced by an unlock test that cites the stage-2 decision; an admin switching country lands on the other country's cart id
- non-goals: banner, blocked-product UI, postcode UI, admin section UI
- changes:
  - add a module-level active-country holder in `client.ts` set by `CountryProvider`; `fetchWithResponseSchema` sets the header when a country is known; no call-site changes
  - `isAccountBound = user !== null && user.role !== 'admin'`; admin selection persists through the existing `countryStorage` key
  - delete the stage-1 admin pinning test at `Header.test.tsx:101` and add its replacement, keeping the customer-disabled test unchanged
  - extend `CountryContext.test.tsx` for admin selection persistence and for the header holder being updated on change
  - extend `CountryPicker.test.tsx` for the admin-enabled label path
- invariants: the picker stays disabled for signed-in customers; account country still wins for customers; no country is sent when no provider is mounted; no new storage key
- relevant evidence: `E1`, `E4`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/components/Header.test.tsx src/components/CountryPicker.test.tsx src/hooks/CountryContext.test.tsx src/hooks/useCart.country.test.tsx` -> `EW1`
- verification: `EW1` pass
- handoff: header transmission; admin unlock semantics
- review: `RW1` -> `GW1` blocks `W2`

### W2: Banner + blocked-lot buyer experience

- mode: sequential after `GW1`; requires `GR5`
- depends on: `W1`, `P5`
- owns: `apps/web/src/components/CountryBanner.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/features/product/**` (blocked-detail handling only), `apps/web/src/hooks/useCart.ts` (blocked add message only), `apps/web/src/features/catalog/**` (blocked-category nav only), colocated tests, `apps/web/src/features/country/CountryAvailability.integration.test.tsx`
- reads: `apps/web/src/components/Layout.tsx:16-41` -> provider nesting and where `Header`/`main` compose; `apps/web/src/components/home/PromoBanner.tsx` -> existing static banner markup and classes to match; `apps/web/src/hooks/useCart.ts:90` -> single-add error label pattern; `apps/web/src/features/reorder/reorderPresentation.ts` -> the `P2` label wording to stay consistent with; `apps/web/src/features/auth/CountryLogin.integration.test.tsx:52-60` -> storage fake and provider-stack render helper to copy
- acceptance: the `ES` banner renders for `ES` and for no other country; a blocked product detail route renders the existing not-found state, never a "blocked" state; a blocked single add shows the country-restriction message with no stock or retirement wording; category nav omits blocked categories because the API omitted them, with no client-side filter added
- non-goals: postcode UI, admin UI, translation, any client-side availability filtering
- changes:
  - add `CountryBanner` reading the active profile; render in `Layout` above `main`; absent profile banner renders nothing
  - map the API's blocked single-add response to a message in `useCart`
  - confirm the product detail not-found path already covers a blocked id; add a test rather than new branching if it does
  - add the web integration test as `*.integration.test.tsx` so it registers with the integration tier
- invariants: the web never decides availability; it renders what the server returned; blocked and not-found look identical to the buyer
- relevant evidence: `E5`, `EW1`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/components/CountryBanner.test.tsx` -> `EW2`; then `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/country/CountryAvailability.integration.test.tsx` -> `EW2b`
- verification: `EW2`, `EW2b` pass
- handoff: banner slot; blocked-add messaging
- review: `RW2` -> `GW2` blocks `W3`

### W3: Postcode + cross-border delivery UI

- mode: sequential after `GW2`; requires `GR8`
- depends on: `W2`, `P8`
- owns: `apps/web/src/features/account/PostalAddressFields.tsx`, `apps/web/src/features/account/DeliverySitesSection.tsx`, `apps/web/src/features/checkout/DeliveryStep.tsx`, `apps/web/src/features/checkout/checkoutValidation.ts`, `apps/web/src/features/checkout/usePaymentSubmission.ts`, `apps/web/src/features/checkout/checkoutState.ts`, colocated tests
- reads: `apps/web/src/features/account/PostalAddressFields.tsx:29-114,233-250` -> `EMPTY_POSTAL_ADDRESS_DRAFT` with its `'GB'` default, mirrored bounds, `validatePostalAddressDraft`, postcode and country inputs; `apps/web/src/features/checkout/checkoutValidation.ts:49-58` -> `validateDelivery`; `apps/web/src/features/checkout/usePaymentSubmission.ts:23-30` -> conflict mapping shape; `apps/web/src/features/checkout/checkoutState.ts:60-61` -> `CheckoutConflict` union
- acceptance: the postcode field label, placeholder example, and inline validation come from the active country profile; the country-code field defaults to the active country's postal code rather than a hard-coded `'GB'`; a `DELIVERY_COUNTRY_NOT_ALLOWED` response renders a clear conflict message naming the delivery restriction; existing UK flows still validate identically
- non-goals: banner, admin UI, translation, transport-schema changes
- changes:
  - replace the hard-coded postcode constants with profile-derived label, pattern, and example; keep the existing `MARKUP_PATTERN` and length checks
  - derive the default country code from the active profile's first `deliveryCountryCodes` entry
  - add the cross-border conflict to `CheckoutConflict` and map it in `usePaymentSubmission`
  - extend colocated tests: per-country accept/reject of a postcode, label rendering, conflict rendering
- invariants: the web mirror is advisory; the server remains authoritative; `aria-invalid`/`aria-describedby` wiring on address fields is preserved
- relevant evidence: `E8`, `EW2`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/account/PostalAddressFields.test.tsx src/features/checkout/checkoutValidation.test.ts` -> `EW3`
- verification: `EW3` pass
- handoff: profile-driven address UI
- review: `RW3` -> `GW3` blocks `W4`

### W4: Admin shell country + promo targeting UI

- mode: sequential after `GW3`; requires `GR11`
- depends on: `W3`, `P11`
- owns: `apps/web/src/features/admin/AdminLayout.tsx`, `apps/web/src/features/admin/AdminNav.tsx`, `apps/web/src/features/admin/promos/AdminPromosPage.tsx`, `apps/web/src/api/adminPromos.ts`, colocated admin tests
- reads: `apps/web/src/features/admin/AdminLayout.tsx:5` -> pure-layout shape; `apps/web/src/features/admin/promos/AdminPromosPage.tsx:70-90` -> local state and `load` refetch pattern; `apps/web/src/hooks/CountryContext.tsx` -> `useCountry` from `W1`; `packages/contracts/src/adminPromos.ts` -> targeting field shape from `P10`
- acceptance: the admin shell displays the standing country and refetches sections when it changes; the promo editor reads and writes the targeting set; an empty selection means all countries and is labelled as such; sections without a country dimension state that they are global rather than showing a stale filter
- non-goals: new admin sections; per-section state refactors beyond the refetch trigger; translation
- changes:
  - display the standing country in `AdminLayout` from `useCountry`
  - add the active country to each section page's refetch dependency so a switch reloads data
  - add a country multi-select to the promo form, wired through `apps/web/src/api/adminPromos.ts`
  - label global sections explicitly
  - extend admin tests for refetch-on-switch and targeting round-trip
- invariants: the admin picker lives in the top bar, not inside `/admin`; the web never filters admin data locally
- relevant evidence: `E11`, `EW3`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/admin` -> `EW4`
- verification: `EW4` pass
- handoff: admin country shell + promo targeting UI
- review: `RW4` -> `GW4` blocks `G2`

### S1: Seed, fixtures, documentation, cross-lane convergence

- mode: sequential after `G2`
- owns: `apps/api/src/db/seed.ts`, `apps/api/src/db/*Seed*.ts` as needed, `apps/api/test/db/seed.integration.test.ts`, `README.md`, `AGENTS.md` (repository map + migration head only), `plans/country_localisation_handoff.md`, `plans/demo_project_high_level_plan.md`, `apps/api/test/country/countryStage2EndToEnd.integration.test.ts`
- depends on: `P12`, `W4`, `G2`
- reads: `apps/api/src/db/seed.ts:13-73,406-409,691-746` -> `USERS`, `DE_ALICE`, `seededPassword`, composite-key inserts; `apps/api/src/db/seed.ts:96,197` -> `PROMOS`, `SCOPED_PROMOS`; `apps/api/src/features/countryProfile/countryProfileService.ts` -> `assertProfilesMatchCatalog`; `README.md:118-129` -> the stage-1 credential block; `plans/country_localisation_handoff.md` -> "Seed and Migration" required fixtures; `AGENTS.md:68` -> the recorded migration head
- acceptance: `npm run reset` succeeds and asserts profile-to-catalog consistency; every handoff fixture exists (same email in `UK` and `DE` with different passwords and carts, one category blocked in one country, banner visible only in `ES`, a promo targeting some countries); README states the seeded country facts and the cross-border and blocking demos; `AGENTS.md` records migration head `033`; the handoff and high-level plan record stage 2 as landed with stage 3 remaining
- non-goals: stage-3 work; new product data; changing existing seeded order or payment scenarios
- changes:
  - call `assertProfilesMatchCatalog` from seed after catalog insertion so a profile typo fails the seed loudly
  - add a country-targeted promo fixture and any missing blocked-category demo data
  - extend `seed.integration.test.ts` for the new fixtures, scoped to test-owned identifiers
  - add the cross-lane end-to-end integration test: guest in a blocking country cannot browse, open, add, or check out the blocked lot; the same lot works in a non-blocking country; a cross-border delivery address is refused; a targeted promo applies in one country and not another
  - update `README.md`, `AGENTS.md`, `plans/country_localisation_handoff.md`, `plans/demo_project_high_level_plan.md`
- invariants: seed stays idempotent and deterministic; `INSERT OR IGNORE` / `ON CONFLICT(email, country)` patterns preserved; no fixed id assumed for `DE_ALICE`; `audit_events` stays excluded from reset
- relevant evidence: all packet evidence ids
- test duty: `npm ci` health check, then `npm run reset`, then `npm run verify` -> `E13`, then `npm run test:integration -w @shop/web` -> `E14`
- verification: `E13` and `E14` pass; documentation obligations complete
- handoff: completion evidence for `G3`
- review: `R13` -> `GR13` blocks `G3`

## Review Assignments

Every reviewer assignment below sets `review_skill=code-reviewer`, directs the reviewer to invoke the `code-reviewer` skill by name through the Skill tool (it carries `disable-model-invocation`), and applies that skill's severity gate (critical + high only) and verification-before-reporting duty. Reviewers are inspect-only and map surviving findings into `reviewer_report_v1`.

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P1` -> settled change set
- timing: after `P1` reports and `E1`/`E1b` exist; before `G1`
- blocks: `G1`, therefore every consumer
- consolidation reason: none
- reads: `packages/contracts/src/countryProfiles/**`; `packages/contracts/src/index.ts`; `packages/contracts/package.json` -> `exports`; `packages/contracts/src/country.ts` -> `Country` totality; `packages/contracts/src/address.ts:29` -> identity-vs-postal doc invariant
- acceptance: profile totality over `Country`; subpath export correctness; postcode patterns anchored and country-correct; `deliveryCountryCodes` maps identity to ISO postal without conflating them; no `@shop/catalog` or app import; fixtures match handoff requirements
- invariants: contracts stays app-independent; data-only profile files; stage-3 fields absent
- risk focus: unanchored or over-permissive postcode patterns; wrong IANA zone strings; a country missing from the record; subpath map typo producing a runtime resolution failure only under `apps/web`
- non-goals: consumption sites; blocked-slug existence against the database
- write policy: inspect-only
- test policy: assess `E1`, `E1b`; run nothing unless evidence is missing or stale
- relevant evidence: `E1`, `E1b`
- return: `reviewer_report_v1`

### R2: Review `P2`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P2` -> settled change set
- timing: after `P2` reports and `E2`/`E2b` exist; before `G1`
- blocks: `G1`
- consolidation reason: none
- reads: `packages/contracts/src/reorder.ts`, `savedLists.ts`, `quickOrder.ts`; the three web presentation modules and their tests
- acceptance: all three unions widened; all label maps exhaustive; wording discloses no stock or retirement state; Quick Order keeps `SKU_NOT_FOUND` distinct
- invariants: no production of the reason yet; `cartBulkAddRules.ts` untouched
- risk focus: a label map that compiles through a widening cast instead of an exhaustive record; wording that leaks retirement
- non-goals: API rule files
- write policy: inspect-only
- test policy: assess `E2`, `E2b`
- relevant evidence: `E2`, `E2b`
- return: `reviewer_report_v1`

### R3: Review `P3`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P3` -> settled change set
- timing: after `P3` reports and `E3` exists; before `P4`
- blocks: `P4`, `P10`
- consolidation reason: none
- reads: `apps/api/src/db/migrations/033_promo_country_targeting.ts`; `apps/api/src/db/migrations/index.ts`; `apps/api/src/db/migrate.ts` -> runner foreign-key contract; `apps/api/src/db/migrations/032_country_localisation.ts` -> CHECK literal to match
- acceptance: additive, idempotent, transactional, FK-clean; CHECK literal identical to `032`; cascade delete correct; head registered last
- invariants: never edit or renumber a landed migration; no `foreign_keys` toggle inside the transaction
- risk focus: missing cascade leaving orphan targeting rows; CHECK drift from the country list; non-idempotent re-run
- non-goals: promo domain behaviour
- write policy: inspect-only
- test policy: assess `E3`
- relevant evidence: `E3`
- return: `reviewer_report_v1`

### R4: Review `P4`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P4` -> settled change set
- timing: after `P4` reports and `E4` exists; before `P5` and `W1`
- blocks: `P5`, `W1`
- consolidation reason: none
- reads: `apps/api/src/plugins/countryContext.ts`; `apps/api/src/features/countryProfile/**`; `apps/api/src/app.ts` diff; `apps/api/src/plugins/auth.ts:41-116` -> ordering and augmentation precedent
- acceptance: precedence exactly as decided; admin override gated on role; malformed header falls back without throwing; plugin ordering guarantees `authenticatedUser` is set first; no per-request profile database read
- invariants: no mutable module-global request state; composition root opens no resource at import
- risk focus: security — a customer or anonymous caller escalating browsing country through the header; hook ordering making `resolvedCountry` undefined for some routes; the admin override leaking into identity or cart keys
- non-goals: consumption sites
- write policy: inspect-only
- test policy: assess `E4`; may run `npm exec -w @shop/api -- tsx --test test/country/countryResolution.integration.test.ts` only if `E4` is stale
- relevant evidence: `E4`
- return: `reviewer_report_v1`

### R5: Review `P5`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P5` -> settled change set
- timing: after `P5` reports and `E5` exists; before `P6` and `W2`
- blocks: `P6`, `W2`
- consolidation reason: none
- reads: `apps/api/src/features/catalog/catalogSql.ts`; `apps/api/src/features/catalog/productRepository.ts`; `apps/api/src/routes/products.ts`; `apps/api/src/routes/bundles.ts`; `apps/api/src/mappers/product.ts`
- acceptance: every read path enumerated in Repository Findings is covered, including the five methods that previously lacked an `active` filter; no response discloses blocked existence; SQL parameters are bound, never interpolated
- invariants: shared stock pool untouched; no stock write or stock event; blocked equals not-found at the boundary
- risk focus: a leak path — comparison, similar, related, SKU resolution, bundles, custom-blend options, reviews-by-product; SQL injection through category or slug interpolation; performance collapse from a per-row predicate
- non-goals: cart and checkout paths
- write policy: inspect-only
- test policy: assess `E5`
- relevant evidence: `E4`, `E5`
- return: `reviewer_report_v1`

### R6: Review `P6`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P6` -> settled change set
- timing: after `P6` reports and `E6` exists; before `P7`
- blocks: `P7`
- consolidation reason: none
- reads: `apps/api/src/features/cart/cartBulkAddRules.ts`; `apps/api/src/features/cart/cartService.ts`; `apps/api/src/routes/cart.ts`; `apps/api/src/features/customBlend/**`; the three consumer rule modules
- acceptance: `BLOCKED_IN_COUNTRY` is first in both the array and the `if`-chain; the doc comment matches the code; cart country is read from persistence; blend blocking reuses `BLEND_UNAVAILABLE`
- invariants: precedence is the single answer regardless of other line state; no parallel vocabulary in consumers
- risk focus: precedence expressed in one place but not the other; a blocked line whose response still varies with stock or retirement; header-derived country reaching a cart mutation
- non-goals: checkout, back-in-stock
- write policy: inspect-only
- test policy: assess `E6`
- relevant evidence: `E5`, `E6`
- return: `reviewer_report_v1`

### R7: Review `P7`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P7` -> settled change set
- timing: after `P7` reports and `E7` exists; before `P8`
- blocks: `P8`
- consolidation reason: none
- reads: `apps/api/src/features/checkout/checkoutService.ts`; `apps/api/src/features/checkout/checkoutTypes.ts`; `apps/api/src/features/backInStock/**`
- acceptance: the block gate runs inside the preparation transaction before reservation and gateway; the new result variant matches the established payload-carrying pattern; alert cancellation reuses the existing path and audit action; per-row re-read preserved
- invariants: no money movement, reservation, or notification before the block is detected; append-only audit unchanged
- risk focus: money and inventory — a blocked line reaching reservation or the gateway; a cancellation escaping its transaction; a notification firing for a lot the buyer cannot purchase
- non-goals: delivery rules
- write policy: inspect-only
- test policy: assess `E7`
- relevant evidence: `E6`, `E7`
- return: `reviewer_report_v1`

### R8: Review `P8`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P8` -> settled change set
- timing: after `P8` reports and `E8` exists; before `P9` and `W3`
- blocks: `P9`, `W3`
- consolidation reason: none
- reads: `apps/api/src/features/tradeAccount/addressRules.ts`; the delivery-site and billing-entity services; `apps/api/src/features/checkout/checkoutService.ts:120-182`; `apps/api/src/features/payments/paymentRepository.ts:104,121`
- acceptance: postcode validated after normalisation; both saved and ad-hoc checkout destinations gated; billing entities unrestricted; error messages name the country label without leaking other countries' rules
- invariants: `Country` never compared to `countryCode` except through `deliveryCountryCodes`; idempotency fingerprint input unchanged
- risk focus: compatibility — existing UK fixtures and seeded addresses failing new validation; an ad-hoc destination bypassing the gate; a fingerprint change silently invalidating idempotency
- non-goals: web mirrors
- write policy: inspect-only
- test policy: assess `E8`
- relevant evidence: `E7`, `E8`
- return: `reviewer_report_v1`

### R9: Review `P9`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P9` -> settled change set
- timing: after `P9` reports and `E9` exists; before `P10`
- blocks: `P10`
- consolidation reason: none
- reads: `apps/api/src/features/delivery/deliverySlotRules.ts`; `apps/api/src/features/delivery/deliverySlotService.ts`; `apps/api/src/features/checkout/checkoutService.ts:161-171`
- acceptance: offered list and checkout re-validation share one anchor rule; DST and midnight cases covered by fixed-instant tests; module doc no longer claims UTC-only; no ambient clock or locale read
- invariants: `DeliveryDate` shape unchanged; business-day arithmetic unchanged; `Clock` remains the only instant source
- risk focus: correctness — a slot offered but rejected at checkout, or the reverse; DST producing a skipped or duplicated day; `Intl` behaviour assumed rather than asserted
- non-goals: standing orders
- write policy: inspect-only
- test policy: assess `E9`
- relevant evidence: `E8`, `E9`
- return: `reviewer_report_v1`

### R10: Review `P10`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P10` -> settled change set
- timing: after `P10` reports and `E10` exists; before `P11`
- blocks: `P11`
- consolidation reason: none
- reads: `apps/api/src/features/promos/**`; `apps/api/src/routes/promo.ts`; `apps/api/src/routes/adminPromos.ts`; `packages/contracts/src/promos.ts`; `packages/contracts/src/adminPromos.ts`
- acceptance: empty targeting means all countries; a targeting miss returns `INVALID`; targeting writes are transactional with the promo write; existing untargeted promos unchanged
- invariants: money — discount arithmetic untouched; promos stay database-owned
- risk focus: money and disclosure — a targeted promo applying in the wrong country; a distinct error code revealing that a code exists elsewhere; a partial write leaving stale targeting rows
- non-goals: admin web UI
- write policy: inspect-only
- test policy: assess `E10`
- relevant evidence: `E9`, `E10`
- return: `reviewer_report_v1`

### R11: Review `P11`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P11` -> settled change set
- timing: after `P11` reports and `E11` exists; before `P12` and `W4`
- blocks: `P12`, `W4`
- consolidation reason: none
- reads: the admin route files and admin repositories owned by `P11`; `apps/api/src/plugins/auth.ts:62`
- acceptance: filtering happens at the repository layer; cross-country detail reads use the existing not-found response; infrastructure sections unchanged; the documented section-by-section treatment matches the Decisions assumption
- invariants: scoping is a filter, never an escalation; `requireAdmin` remains the only role gate
- risk focus: security — an admin reading another country's rows through an unfiltered path; a filter applied in the route but missing from the count query, producing wrong pagination
- non-goals: audit metadata
- write policy: inspect-only
- test policy: assess `E11`
- relevant evidence: `E10`, `E11`
- return: `reviewer_report_v1`

### R12: Review `P12`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `P12` -> settled change set
- timing: after `P12` reports and `E12` exists; before `G2`
- blocks: `G2`
- consolidation reason: none
- reads: `apps/api/src/features/audit/auditEvent.ts`; `apps/api/src/features/audit/auditService.ts`; the admin route audit-context helpers
- acceptance: admin events carry the standing country; customer and system events unchanged; metadata within size and value constraints; no schema change
- invariants: `audit_events` append-only and reset-excluded
- risk focus: a metadata value type violation reaching the size or `json_valid` constraint at runtime; country recorded from the account instead of the standing selection
- non-goals: audit query contract
- write policy: inspect-only
- test policy: assess `E12`
- relevant evidence: `E11`, `E12`
- return: `reviewer_report_v1`

### RW1-RW4: Review `W1`, `W2`, `W3`, `W4`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: the named web packet -> settled change set (one assignment per packet, four separate reviews)
- timing: after each packet reports and its evidence exists; before the next web packet and before `G2`
- blocks: `RW1` -> `W2`; `RW2` -> `W3`; `RW3` -> `W4`; `RW4` -> `G2`
- consolidation reason: none
- reads: only the files owned by the packet under review, plus `apps/web/src/hooks/CountryContext.tsx` and `apps/web/src/api/client.ts` as shared context
- acceptance: per-packet acceptance criteria as stated in the packet; UI behaviour proven by React integration, route, and unit tests
- invariants: the web never decides availability, promo eligibility, or deliverability; the server is authoritative; existing accessibility wiring preserved; stale async completion still ignored
- risk focus: `RW1` header leakage or an admin override reaching identity; `RW2` a client-side availability decision creeping in; `RW3` a mirror rule diverging from the server rule; `RW4` local filtering of admin data
- non-goals: any browser session, screenshot, or manual click-through as review evidence
- write policy: inspect-only
- test policy: assess the packet's evidence (`EW1`-`EW4`); run nothing unless stale
- relevant evidence: the reviewed packet's evidence ids only
- return: `reviewer_report_v1`

### R13: Review `S1`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty
- target: `S1` -> settled convergence change set
- timing: after `S1` reports and `E13`/`E14` exist; before `G3`
- blocks: `G3`
- consolidation reason: none
- reads: `apps/api/src/db/seed.ts` diff; `apps/api/test/country/countryStage2EndToEnd.integration.test.ts`; `README.md` diff; `AGENTS.md` diff; `plans/country_localisation_handoff.md` diff; `plans/demo_project_high_level_plan.md` diff
- acceptance: seed idempotent and deterministic; every handoff fixture present; the end-to-end test genuinely exercises cross-packet behaviour rather than restating packet tests; documentation states the country facts a human operator needs
- invariants: no fixed id assumed for country-duplicate accounts; reset excludes audit; docs match shipped behaviour
- risk focus: a seed that passes only on a fresh database; documentation claiming behaviour the code does not have; integration behaviour no earlier review covered
- non-goals: re-reviewing packet-level implementations already gated
- write policy: inspect-only
- test policy: assess `E13`, `E14`
- relevant evidence: `E13`, `E14`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/api/src/app.ts`: touched by `P4`, `P5`, `P6`, `P7` — strictly sequential, one owner per slot, never concurrent
- `packages/contracts/src/index.ts` and `packages/contracts/package.json`: owned only by `P1`; `P2` and `P10` edit existing contract modules and must not touch either
- `apps/api/src/features/cart/cartBulkAddRules.ts`: owned only by `P6`; `P2` reads it
- `apps/api/src/features/checkout/checkoutService.ts`: `P7` owns the blocking gate, `P8` owns the cross-border gate, `P9` reads the slot re-validation — sequential, non-overlapping regions, each worker re-reads the file before editing
- `apps/web/src/hooks/CountryContext.tsx` and `apps/web/src/api/client.ts`: owned only by `W1`; later web packets read them
- migration versions: `033` reserved by `P3`; no other packet adds a migration in this run
- contract producers -> consumers: `P1`/`P2` before every API and web consumer; `P3` before `P10`; `P10` before `W4`
- lane separation: API spine owns `apps/api/**` plus the `P10` contract edits; web lane owns `apps/web/**`. No file is written by both lanes
- composition and documentation: `S1` is the single owner of seed, README, `AGENTS.md`, and both plan files

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment.
- non-Codex harnesses: ignore the Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and the communication contracts.
- all harnesses: the reviewer agent runs the `code-reviewer` skill as its review method. Assignments set `review_skill=code-reviewer`; the reviewer invokes it explicitly by name through the Skill tool.

## Test Execution Schedule

Three scheduling points, each with one owner: `T1` focused packet-completion runs (`E1`-`E12`, `EW1`-`EW4`, owner is the packet that produced the change); `T2` fan-in integration run after both lanes settle (`E13`, owner `S1`); `T3` final broad gate run once after every fix settles (`E14` plus the `E13` re-run only if invalidated, owner `S1` at `G3`).

- `E0`: at `G0` -> owner: orchestrator -> `npm run verify`
- `E0b`: at `G0` -> owner: orchestrator -> `npm run test:integration -w @shop/web`
- `E1`,`E1b`: after `P1` -> owner: `P1` -> `npm test -w @shop/contracts`; `npm run build -w @shop/contracts`
- `E2`,`E2b`: after `P2` -> owner: `P2` -> focused web presentation vitest run; `npm test -w @shop/contracts`
- `E3`: after `P3` -> owner: `P3` -> focused API migration tests
- `E4`: after `P4` -> owner: `P4` -> focused country-resolution tests
- `E5`: after `P5` -> owner: `P5` -> focused catalog availability integration test
- `E6`: after `P6` -> owner: `P6` -> focused cart, quick-order, reorder tests
- `E7`: after `P7` -> owner: `P7` -> focused checkout and back-in-stock tests
- `E8`: after `P8` -> owner: `P8` -> focused address and cross-border tests
- `E9`: after `P9` -> owner: `P9` -> focused delivery rules, cut-off, and route tests
- `E10`: after `P10` -> owner: `P10` -> contracts rebuild then focused promo tests
- `E11`: after `P11` -> owner: `P11` -> focused admin scope tests
- `E12`: after `P12` -> owner: `P12` -> focused audit tests
- `EW1`-`EW4`: after each web packet -> owner: that packet -> focused vitest runs; `EW2b` additionally runs the integration config
- `E13`: after `G2` -> owner: `S1` -> `npm run reset` then `npm run verify`, once
- `E14`: after `E13` -> owner: `S1` -> `npm run test:integration -w @shop/web`, once
- policy: automated repository commands only. No browser session, screenshot, dev-server click-through, `browser-qa` invocation, or visual confirmation appears in any test duty, verification, gate, or review policy, including `S1` and `G3`
- environment: prepend Node 22 to `PATH` before any node or npm command (`$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`); confirm `node --version` reports `v22.x`; never select the `v24` install. A missing Node 22 is a blocker, never a silent skip
- workspace paths: `npm exec -w <workspace>` changes the working directory, so focused test paths are workspace-relative, not repository-relative
- contracts staleness: after any `packages/contracts` change, run `npm run build -w @shop/contracts` before any `apps/api` or `apps/web` typecheck or test, otherwise typecheck fails with phantom missing-export errors
- reuse: reuse a passing entry when the command covers the current code and no invalidating path changed. A new session alone never invalidates evidence. Give each agent only the entries covering its packet or review target and instruct it not to rerun valid commands
- invalidation: `packages/contracts/**` -> `E1`,`E1b`,`E2`,`E2b` plus every downstream entry; `apps/api/src/features/catalog/**` -> `E5`,`E6`,`E7`; `apps/api/src/features/cart/**` -> `E6`,`E7`; `apps/api/src/features/checkout/**` -> `E7`,`E8`,`E9`; `apps/api/src/features/delivery/**` -> `E9`; `apps/api/src/db/migrations/**` -> `E3`,`E13`; `apps/api/src/db/seed.ts` -> `E13`,`E14`; `apps/web/src/hooks/CountryContext.tsx` or `apps/web/src/api/client.ts` -> `EW1`-`EW4`; any change after `E13` -> rerun the smallest affected focused command, and rerun `E13`/`E14` only when the change invalidates the final result

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values; preserve code, commands, paths, identifiers, and errors exactly
- transport: inline canonical JSON, one object per message, no free-text wrapper; run-scoped temp artifacts only for bulky logs or diffs, under `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]` with an inline summary, path, format, and SHA-256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, the global evidence ledger, closed findings, and unrelated state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`, written to `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md` when object arrays become non-empty
- worktree context: every assignment includes the absolute worktree path, implementation branch, and base revision; every repository-relative path resolves under the worktree root

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load source-checkout repository instructions (`AGENTS.md`, `CLAUDE.md`), this plan, the canonical contracts, and the current checkpoint.
3. Record the source branch and `HEAD`. Stop and ask if `HEAD` is detached or if relevant uncommitted or untracked changes are absent from branch `HEAD`.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity in the checkpoint.
5. Switch the execution root to the worktree; load the worktree's repository instructions.
6. Validate `G0`: Node 22 selected, `npm ci` health checks pass, `E0` and `E0b` captured green.
7. Launch `P1 || P2` in fresh worker contexts inside the worktree.
8. Accept each report, update the checkpoint and evidence ledger, launch `R1`/`R2` against the exact settled change sets.
9. Route stable findings to fresh workers with an `action=fix` directive; close after targeted evidence; never re-review a fix. Validate `GR1`, `GR2`.
10. Validate `G1` after `npm run build -w @shop/contracts` succeeds; run the sequential prefix `P3 -> P4` with their review gates.
11. After `GR4`, run the API spine and the web lane concurrently, honouring the cross-lane gates `GR5 -> W2`, `GR8 -> W3`, `GR11 -> W4`. Review each packet immediately; never let a dependent packet consume an unreviewed change set.
12. Validate `G2`: both lanes' review gates passed; confirm or correct the three Decisions assumptions and record the outcome as a checkpoint decision.
13. Launch `S1`; run `E13` and `E14` once after fan-in; review `S1` as a separate integration target; close findings through fresh-worker fixes plus targeted evidence.
14. Validate `GR13` and `G3`. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision, and state that the user owns the merge.

## Risks and Open Questions

- risk: a catalog leak path missed -> a blocked lot reachable through comparison, SKU paste, bundles, or reviews. Mitigation: `P5` enumerates every repository method that previously lacked an `active` filter; `R5` risk focus is leak paths; `S1`'s end-to-end test probes browse, open, add, and checkout in one run
- risk: `Intl` time-zone behaviour differing across Node builds -> cut-off tests flaking. Mitigation: `P9` asserts local civil day and hour derivation directly against fixed instants, and the repository pins Node 22.x
- risk: the postcode rules rejecting existing seeded UK addresses -> broad integration breakage. Mitigation: `P8` validates after normalisation, `R8` risk focus is compatibility with seeded fixtures, `E13` runs a full reset plus verify
- risk: the contracts change breaking `apps/web` typecheck between packets. Mitigation: `P2` owns both the union and its web mirrors; `G1` gates on a successful contracts build
- risk: the admin browsing-country override leaking into identity, order ownership, or `(email, country)` uniqueness. Mitigation: stated invariant, `R4` and `R11` security risk focus, `P11` scoping is filter-only
- risk: admin section scoping wider than the data supports -> invented country columns on infrastructure tables. Mitigation: the treatment is recorded as an assumption and confirmed at `G2` before `W4` renders it
- question: should stage 2 ship the `orders.promo_country_scope`-style snapshot for promo country targeting? -> owner: user; gate: `G2`; current answer is no, on the grounds that country targeting is a validity rule rather than a priced fact
- question: does the `ES`-only banner need an admin-editable variant? -> owner: user; gate: `G2`; current answer is no, banners stay in the checked-in profile per the handoff
- human-owned follow-up, outside every gate: a manual storefront pass in one blocking and one non-blocking country before the user merges. Not a packet duty, not verification, not a gate condition

## Done Criteria

- a buyer in a blocking country cannot see, open, add, bulk-add, blend, or check out a blocked lot through any read or write path, and cannot distinguish blocked from non-existent
- `BLOCKED_IN_COUNTRY` holds first precedence in the shared vocabulary and propagates to reorder, saved lists, and Quick Order without new vocabulary, with `SKU_NOT_FOUND` still distinct
- a pending back-in-stock alert for a lot blocked in the subscriber's country is cancelled through the existing retirement path, including a block landing mid-drain
- delivery outside the buyer's country is refused at delivery-site write and at checkout; postcode rules and labels are per country
- the country time zone drives the delivery cut-off, with midnight-boundary and daylight-saving cases proven, and the offered list agrees with checkout re-validation
- promotions carry country targeting administered in the existing `/admin` screens, with a country miss indistinguishable from an unknown code
- an admin can stand in a chosen country, holds an independent cart per country, sees country-scoped admin data, and every admin audit event records the standing country
- the `ES` banner renders only in `ES`; no other country shows one
- migration `033` is additive, idempotent, and FK-clean; head recorded in `AGENTS.md`; stage-1 data and behaviour unchanged for `UK`
- seed carries every handoff fixture; `npm run reset` asserts profile-to-catalog consistency and fails loudly on a typo
- `E13` (`npm run verify`) and `E14` (`npm run test:integration -w @shop/web`) pass once after all fixes settle
- README states the country facts an operator needs; the handoff and high-level plan record stage 2 as landed and stage 3 as remaining
