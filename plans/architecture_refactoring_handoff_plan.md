# Architecture Refactoring Handoff Plan

## Mission

Refactor current monorepo around explicit ownership, one-way dependencies, testable runtime boundaries. Remove obsolete media path causing largest file. Decompose mixed-responsibility API and web modules without changing storefront behavior.

Primary outcome: smaller authored modules, fewer sources of truth, safer checkout/auth flows, direct HTTP coverage.

## Baseline

Audit date: 2026-07-13.

Branch: `powder_shop_direction` at `ef28189`.

Validation passed before changes:

- `npm run typecheck`
- `npm run lint`
- `npm test`: 39 tests passed
- `npm run assets:check`: 135 WebP files, 2.32 MiB

Current hotspots:

- `packages/contracts/src/productMediaRegistry.ts`: 1,227 lines, generated
- `apps/web/public/images/products/manifest.json`: 1,221 lines, generated duplicate metadata
- `apps/api/src/db/powderCatalog.ts`: 836 lines, catalog data plus validation
- `apps/api/test/smoke.integration.test.ts`: 425 lines, unrelated scenarios in one suite
- `apps/web/src/components/BagArtwork.tsx`: 412 lines, six bag prototypes plus label renderer
- `apps/api/src/domains/payments.ts`: 347 lines, validation through persistence
- `packages/contracts/src/schemas.ts`: 333 lines, every API domain
- `apps/api/src/domains/auth.ts`: 322 lines, auth plus password reset plus mailbox
- `apps/web/src/features/payment/PaymentPage.tsx`: 270 lines
- `apps/web/src/features/checkout/CheckoutPage.tsx`: 267 lines
- `apps/web/src/hooks/useCart.ts`: 255 lines

## Architectural Decisions

Apply these decisions unless user changes product direction.

1. Keep live SVG bag design introduced by `ef28189` as canonical product artwork.
2. Remove obsolete generated WebP product pipeline. Current canonical product cards/pages never render those files because `getProductVisual()` always selects `BagArtwork`.
3. Keep `@shop/contracts` limited to transport schemas and inferred transport types. No catalog content, asset registry, rendering metadata lookup, or app behavior.
4. Create `@shop/catalog` workspace for canonical seed content and packaging metadata. No package or script may import app-private source.
5. Use explicit dependencies at API composition root. No feature-domain call to global `getDb()`.
6. Keep architecture proportionate to small app. Prefer functions, repositories, explicit dependency objects. Avoid class hierarchy, event bus, generic framework, new state library.
7. Treat generated/vendor source separately from authored logic. Do not split files only to satisfy line count.

Target dependency flow:

`@shop/contracts -> TypeBox`

`@shop/catalog -> no app package`

`api -> contracts + catalog + database`

`web -> contracts`

`scripts -> catalog`

Forbidden flow:

`package or script -> apps/** private source`

## Agent Execution Protocol

One work packet -> one agent task. Sequential execution only. Shared contracts, package manifests, database schema, and checkout code create merge risk; do not run packets in parallel.

Before packet:

1. Read this plan, `CLAUDE.md`, current `git status`, packet-owned files.
2. Confirm dependency packet marked complete.
3. Re-run narrow baseline for touched workspace.
4. Preserve unrelated work. Stop on overlapping uncommitted edits.

During packet:

- implement only named packet scope
- add or update behavior tests before destructive cleanup
- keep repository runnable after each coherent edit
- do not leave compatibility path unless packet requires it
- do not commit unless user explicitly requests commit

Packet completion:

1. Run packet checks plus `npm run typecheck` and `npm run lint`.
2. Run full `npm test` when shared contract, schema, database, checkout, auth, or root script changes.
3. Run `git diff --check`.
4. Update packet checkbox only after exit criteria pass.
5. Report files changed, checks run, remaining risk. Stop; next packet belongs to next agent.

## Phase Ledger

- [ ] Packet 0 -> characterization tests. Dependency: none.
- [ ] Packet 1A -> `@shop/catalog` extraction. Dependency: 0.
- [ ] Packet 1B -> packaging contract and web cutover. Dependency: 1A.
- [ ] Packet 1C -> obsolete raster pipeline deletion. Dependency: 1B.
- [ ] Packet 2A -> domain contract split and subpath exports. Dependency: 1C.
- [ ] Packet 2B -> remaining DTO leakage and route typing cleanup. Dependency: 2A.
- [ ] Packet 3A -> API app factory and explicit database lifecycle. Dependency: 2B.
- [ ] Packet 3B -> versioned migrations and upgrade fixtures. Dependency: 3A.
- [ ] Packet 4 -> atomic payment and checkout orchestration. Dependency: 3B.
- [ ] Packet 5 -> auth, session, reset, mailbox separation. Dependency: 4.
- [ ] Packet 6 -> repository and integration-suite alignment. Dependency: 5.
- [ ] Packet 7A -> catalog request race cleanup. Dependency: 6.
- [ ] Packet 7B -> cart provider state cleanup. Dependency: 7A.
- [ ] Packet 7C -> checkout web-flow consolidation. Dependency: 7B.
- [ ] Packet 8 -> architecture guardrails, CI, final verification. Dependency: 7C.

## Findings

### P0: Payment idempotency not concurrency-safe

Evidence: `apps/api/src/domains/payments.ts` checks `payments` for key, awaits simulated gateway, then inserts unique key. Concurrent requests can both observe missing key. Losing request throws unique-constraint error instead of replaying stored result. Success path transaction rolls back duplicate order; failure path can surface unhandled error.

Related problems:

- card validation, gateway simulation, idempotency, promo validation, order writing, payment writing, mailbox writing, cart deletion all owned by one function
- request fingerprint includes PAN and CVC input before persistent hashing; comment claims PAN/CVC never persisted, but persistent derivative still depends on both
- legacy `POST /api/checkout` duplicates ordering, promo, cart deletion flow without payment
- route calls `getOrder()` after successful payment, adding second query and split result ownership

Required fix: Phase 4.

### P0: Startup schema mutation hides migration failures

Evidence: `apps/api/src/db/connection.ts` creates old schema, then calls dynamic `ALTER TABLE` statements on every startup. `addColumn()` catches every error as if duplicate-column error. Disk failure, invalid SQL, locked DB, or incompatible schema can be silently ignored.

Related problems:

- no schema version ledger
- schema creation, migration, connection singleton, directory creation mixed in one module
- optional `dbPath` ignored after first singleton initialization
- no public close/reset lifecycle
- server import starts listening and seeds database immediately

Required fix: Phase 3.

### P1: Two product-media systems conflict

Evidence:

- prior pipeline generates 135 WebP files, 1,221-line manifest, 1,227-line TypeScript registry
- API attaches three image objects to every product
- current `ProductMedia` returns `BagArtwork` for every canonical `imageSetId`
- current `ProductGallery` truncates canonical image list to one item
- only category tiles still use old raster registry directly
- visual metadata copied from `powderCatalog.ts` into generated `productMediaRegistry.ts`

Result: large generated file is symptom of dead parallel architecture, not god class.

Required fix: Phase 1. Do not reformat or manually split `productMediaRegistry.ts`.

### P1: Catalog content lives inside database adapter

Evidence: `apps/api/src/db/powderCatalog.ts` owns product model, 45 content records, packaging visuals, content validation, import-time validation. `scripts/build-product-images.ts` imports this app-private DB module.

Result:

- tooling depends on API internal path
- content ownership confused with persistence
- one 836-line authored file
- validation executes during import
- media and seed builds coupled indirectly

Required fix: Phase 1.

### P1: Contracts package owns unrelated runtime data

Evidence: `@shop/contracts` root exports TypeBox API schemas plus full media registry plus visual lookup functions. API, web, and seed import same root barrel.

Result:

- contract changes and asset changes rebuild same package
- consumers load/evaluate broader module graph
- deployment-specific asset paths presented as domain contract
- package lacks domain-level entry points

Required fix: Phases 1-2.

### P1: API layers leak persistence shapes and duplicate mapping

Evidence: product database-to-contract mapping exists in:

- `apps/api/src/routes/products.ts`
- `apps/api/src/routes/favourites.ts`
- `apps/api/src/domains/cart.ts`

Other duplication:

- `CartResult` duplicates `Cart`
- `OrderResult` duplicates `Order`
- `PublicUserData` differs from `PublicUser` only around persistence ID shape
- raw snake_case row interfaces repeated beside queries

Result: contract additions require multiple edits; inconsistent fallback/default behavior already exists.

Required fix: Packets 1B and 2B.

### P1: Domain functions depend on global database and each other

Every domain calls `getDb()`. Payment calls cart, promo, and order domains. Order also calls cart and promo domains. Auth plugin also queries database directly.

Result:

- unit tests require global SQLite instance
- transaction ownership unclear
- hidden dependencies
- feature boundaries behave as procedural layers, not cohesive services

Required fix: Phases 3-5. Do not build repository interface for every one-line query; group repositories by aggregate/use case.

### P1: Auth module owns unrelated concerns

`apps/api/src/domains/auth.ts` owns signup, login, email normalization, password reset token generation, password change, session invalidation, reset mailbox delivery, mailbox listing.

Additional risks:

- reset URL hard-coded to `http://127.0.0.1:5173`
- reset tokens stored plaintext
- signup checks duplicate email before async password hashing, then relies on uncaught insert race
- route repeats password constraints already partly present in domain
- `routes/mailbox.ts` imports mailbox behavior from auth domain

Required fix: Phase 5.

### P1: Transport validation too weak; route typing bypassed

Examples from `packages/contracts/src/schemas.ts` and routes:

- email fields accept any string
- password length enforced manually in some routes, absent from schemas
- UUID/idempotency keys accept any string
- numeric route IDs accept arbitrary strings then repeat parsing logic
- card expiry/CVC/card number constraints split between schema and domain
- auth/favourite handlers annotate generic `FastifyRequest`, then cast body/params manually despite TypeBox provider

Required fix: Phase 2. Domain validation must still protect non-HTTP callers.

### P2: Tests named integration do not cross HTTP boundary

`apps/api/test/smoke.integration.test.ts` calls domain functions and SQLite directly. Test named “serves” never registers Fastify routes. No `app.inject()` coverage protects response schemas, status mappings, auth pre-handlers, or global error handler.

Required fix: Phases 3 and 6.

### P2: Frontend request/state code allows stale or fragmented state

Evidence:

- `CatalogPage` debounces URL search by 300 ms
- `useProducts` exposes second unused debounce path
- `useProducts` lacks abort/request identity; older response can overwrite newer query
- `useCart` mixes persistence, initialization deduplication, stale-cart recovery, UI state, mutations, error copy; module-global promise leaks across provider instances/tests
- checkout and payment form state split across routes through unchecked `location.state`
- browser refresh on payment route discards checkout state

Required fix: Phase 7.

### P2: Large UI artwork file mostly contains unused prototypes

All production callers use `shape="paper-square"` plus `decoration="paired-ovals"`. Other five shapes and five decoration variants remain from design exploration.

`ProductMedia` parses package quantity from marketing description with regex. `BagArtwork` hard-codes `NOT FOR CONSUMPTION` even when canonical catalog marks pantry/performance products consumable. Rendering lacks explicit packaging model.

`BagArtwork.tsx` is cohesive rendering code, not god component. Shrink by deleting unselected prototypes. Do not create six one-use components.

Required fix: Phase 1.

### P2: Verification and boundary guardrails incomplete

Root `smoke` omits lint, build, format, and asset check. No CI configuration found. No rule prevents scripts or packages importing app-private paths. Large test and schema files can regrow unnoticed.

Required fix: Phase 8.

## Implementation Phases

### Phase 0: Characterization and safe branch point

Packet: 0. Owner: one agent.

Goal: freeze behavior before structural movement.

Tasks:

1. Record baseline commands and results in PR description, not repository docs.
2. Add focused characterization tests only where later phases remove behavior:
   - canonical product renders current live SVG bag
   - unknown/legacy product receives accessible generic fallback
   - category tiles retain four links and artwork
   - same payment idempotency key replays prior result
   - different payload with same key returns conflict
3. Avoid snapshotting giant registries or full rendered SVG trees.

Exit:

- baseline remains green
- tests describe behavior, not current module layout

Suggested commit: `test: characterize architecture refactor boundaries`

### Phase 1: Establish catalog ownership and remove obsolete raster pipeline

Goal: remove biggest files and conflicting media source.

#### Packet 1A: Extract canonical catalog

Create workspace:

`packages/catalog/`

Suggested structure:

- `src/model.ts`: `CatalogProduct`, `ProductPackaging`, category types
- `src/categories/pantry.ts`
- `src/categories/performance.ts`
- `src/categories/drinks.ts`
- `src/categories/household.ts`
- `src/categories/outdoors.ts`
- `src/categories/questionable.ts`
- `src/categories/impossible.ts`
- `src/catalog.ts`: combine category arrays, indexes, exports
- `src/validateCatalog.ts`: explicit pure validation
- `src/index.ts`: public exports

Rules:

- each category module owns only content records
- `validateCatalog()` called by seed/check commands, not module import
- `@shop/catalog` imports no `apps/**` path
- stable product IDs/slugs/artwork IDs preserved
- packaging metadata remains canonical content: label color, powder color, mark, batch code, quantity, consumption label

Packet 1A checks:

- catalog validation unit tests
- seed integration tests
- `npm run typecheck`
- `npm run lint`

Packet 1A stop condition: API seed imports `@shop/catalog`; no script or package imports `apps/api/src/db/powderCatalog.ts`.

#### Packet 1B: Cut transport and web rendering to packaging data

Transport change:

1. Add optional `packaging` object to product contract during migration.
2. Add one API `toProductContract()` mapper. Use from products, favourites, cart.
3. Resolve canonical packaging from `@shop/catalog` using stable artwork ID.
4. Unknown/noncanonical products omit packaging and use generic accessible fallback.
5. Remove `images` transport field after all web consumers use `packaging`.
6. Keep `imageSetId` temporarily as `artworkId`; rename only with migration compatibility or leave stable name until later cleanup.

Web change:

1. Make `ProductMedia` render `BagArtwork` from `product.packaging`, without contract registry lookup.
2. Replace category tile raster lookup with small web-owned representative artwork config or generic category artwork. Do not import full catalog into web.
3. Keep hero curation web-owned; include complete three-item artwork props locally.
4. Render quantity and consumption label from explicit packaging fields. Remove description regex and hard-coded warning.
5. Reduce `BagArtwork` to locked `paper-square` + `paired-ovals` design.
6. Remove unused shape/decoration types, branches, and design prototypes. Keep `BagDesignsPage` only if product still needs internal design route; otherwise remove route and page.

Packet 1B checks:

- product API contract tests
- mapper tests for canonical and unknown products
- `ProductMedia`, product gallery, hero, category tile tests
- consumable/non-consumable label tests
- `npm run build -w @shop/web`

Packet 1B stop condition: canonical UI uses `product.packaging`; no canonical render path calls media registry.

#### Packet 1C: Delete obsolete raster pipeline

Delete after consumer migration:

- `packages/contracts/src/productMediaRegistry.ts`
- product-media exports from `packages/contracts/src/index.ts`
- `apps/api/src/domains/productMedia.ts`
- `apps/web/src/data/productImageSets.ts`
- `scripts/build-product-images.ts`
- `apps/web/public/images/products/manifest.json`
- 135 generated product WebP files
- `sharp` dependency
- `assets:build` and `assets:check` scripts

Update tests to assert SVG packaging behavior and catalog validation. Remove tests asserting obsolete WebP paths.

Packet 1C checks:

- deletion search commands from Phase 8
- `npm install` only when lockfile needs dependency removal
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build -w @shop/web`

Packet 1C stop condition: registry, manifest, WebPs, generator, Sharp dependency, asset scripts absent.

Exit:

- no product media registry
- no product WebP manifest
- no script import from API source
- contracts package contains no catalog content or asset paths
- canonical card/detail rendering unchanged visually
- consumable and non-consumable labels match catalog data
- category tiles still work
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w @shop/web` pass

Suggested commit: `refactor(catalog): make live packaging artwork canonical`

### Phase 2: Split contracts and remove DTO leakage

Goal: domain-level contracts, inferred route types, persistence-only row shapes.

#### Packet 2A: Split transport contracts

Suggested contract structure:

- `src/common.ts`
- `src/products.ts`
- `src/cart.ts`
- `src/auth.ts`
- `src/favourites.ts`
- `src/promos.ts`
- `src/orders.ts`
- `src/payments.ts`
- `src/index.ts`: compatibility barrel only

Add package subpath exports. Prefer imports such as `@shop/contracts/products` and `@shop/contracts/payments`.

Schema work:

- reusable constrained email schema
- reusable password schema with 8-128 length
- reusable positive integer string param schema
- reusable UUID schema for cart/idempotency values where current values are UUIDs
- bounded customer and address strings
- payment field format/min/max constraints aligned with domain guards
- explicit error-code unions per operation

Packet 2A checks:

- contract build/typecheck
- route schema compilation through API typecheck
- web typecheck

Packet 2A stop condition: domain subpath exports work; compatibility barrel contains exports only.

#### Packet 2B: Remove remaining DTO and route typing leakage

API work:

1. Confirm Packet 1B `toProductContract()` remains sole product mapper.
2. Import inferred transport types instead of redefining `CartResult`, `OrderResult`, and response DTOs.
3. Keep persistence row types local to repository modules.
4. Remove generic `FastifyRequest`/`FastifyReply` annotations where inference works.
5. Remove request body/param casts made unnecessary by typed routes.
6. Keep domain guards for direct service calls.

Packet 2B checks:

- products, favourites, cart response tests
- auth, order, payment route typechecks/tests
- `npm test`

Packet 2B stop condition: no duplicate transport DTOs, route casts, or route-owned snake_case mapping.

Exit:

- one product mapper
- no route owns snake_case-to-camelCase mapping
- no manual cast for schema-typed request body/params
- contracts root barrel remains small
- subpath import does not evaluate unrelated schemas

Suggested commit: `refactor(contracts): split domain schemas and response mapping`

### Phase 3: Introduce migrations, database lifecycle, app factory

Goal: deterministic schema changes and injectable runtime.

#### Packet 3A: Build app factory and explicit database lifecycle

Suggested API structure:

- `src/app.ts`: `buildApp(dependencies)`; register plugins/routes/error handlers; never listen
- `src/server.ts`: load config, open DB, initialize current schema, optional seed, build app, listen, close on signals
- `src/config.ts`: typed environment/config parsing
- `src/db/openDatabase.ts`

Packet 3A scope:

- extract `buildApp(dependencies)` without behavior change
- separate listen/start path
- add typed config
- add explicit open/close lifecycle
- inject current database into routes/services; keep existing schema bootstrap temporarily

Dependency composition:

```ts
type AppDependencies = {
  db: Database.Database;
  clock: Clock;
  ids: IdGenerator;
  paymentGateway: PaymentGateway;
  appBaseUrl: string;
};
```

Use narrower feature dependency objects internally. Do not pass global container everywhere.

Seed rules:

- production/start command must not mutate canonical content unexpectedly
- development seed remains explicit config/command
- tests create isolated DB per suite or case

Packet 3A checks:

- app import has no listen/seed side effect
- one `app.inject()` health/product route test
- multiple temporary databases open and close in one process

Packet 3A stop condition: composition root owns runtime dependencies; domain/plugin code no longer calls global database singleton.

#### Packet 3B: Replace startup schema mutation with migrations

Suggested files:

- `src/db/migrate.ts`
- `src/db/migrations/001_initial.ts`
- later migrations for additive columns and token/idempotency changes

Migration rules:

- `schema_migrations(version, applied_at)` ledger
- ordered, transactional, one-time migrations
- no catch-all suppression
- fresh DB and upgrade-from-legacy fixture both tested
- explicit `close()` ownership

Packet 3B checks:

- empty database migration test
- legacy fixture upgrade test
- idempotent second migration run
- migration failure propagation test
- seed/reset integration tests

Packet 3B stop condition: startup uses migration ledger; catch-all `ALTER TABLE` suppression removed.

Exit:

- importing app module never listens or seeds
- every migration has recorded version
- migration failure propagates
- multiple isolated DBs work in one process
- reusable `app.inject()` harness plus health/product route coverage exists

Suggested commit: `refactor(api): add app factory and versioned migrations`

### Phase 4: Make payment orchestration atomic and cohesive

Packet: 4. Owner: one agent.

Goal: concurrency-safe idempotency and single checkout transaction owner.

Suggested feature structure:

- `src/features/payments/cardValidation.ts`: pure normalization/Luhn/expiry/CVC
- `src/features/payments/paymentGateway.ts`: interface plus simulated adapter
- `src/features/payments/paymentRepository.ts`: idempotency/payment records
- `src/features/checkout/checkoutService.ts`: orchestration
- `src/features/checkout/checkoutRepository.ts`: atomic order/payment/redemption/mailbox/cart write
- `src/features/orders/orderRepository.ts`: order reads and line inserts

Required flow:

1. Validate transport and domain input.
2. Normalize non-sensitive request data.
3. Atomically reserve idempotency key before gateway await using unique constraint.
4. Same key + same safe fingerprint:
   - completed -> replay stored response
   - processing -> deterministic in-progress/conflict response
5. Same key + different safe fingerprint -> `IDEMPOTENT_CONFLICT`.
6. Never persist PAN, CVC, or hash derived from full PAN/CVC. Persist last four, detected brand, gateway test token/result only.
7. Re-read cart and promo eligibility inside final transaction before totals/order write.
8. Write order, lines, payment state, redemption, mailbox outbox row, cart deletion atomically.
9. Return complete order response from service; route performs no second lookup.
10. Finalize reserved key for decline/timeout deterministically.

Legacy cleanup:

- remove unused web `placeOrder()` client
- remove `POST /api/checkout` or make it call same checkout service only if backward compatibility explicitly required
- keep `GET /api/orders/:orderId` in order feature

Required tests:

- concurrent same-key same-payload calls create one order
- concurrent same-key different-payload calls create at most one order; loser gets conflict
- decline replay
- timeout replay
- cart/promo change during gateway wait cannot produce stale total
- transaction rollback leaves cart and redemption consistent
- persisted payment data contains no PAN/CVC derivative

Exit:

- one checkout orchestration path
- unique-key race handled as domain outcome, never 500
- payment service module remains orchestration-focused

Suggested commit: `refactor(checkout): enforce atomic idempotent payment flow`

### Phase 5: Separate auth, sessions, password reset, mailbox

Packet: 5. Owner: one agent.

Goal: cohesive services and safer reset lifecycle.

Suggested structure:

- `src/features/auth/authService.ts`
- `src/features/auth/userRepository.ts`
- `src/features/auth/sessionService.ts`
- `src/features/auth/sessionRepository.ts`
- `src/features/passwordReset/passwordResetService.ts`
- `src/features/passwordReset/passwordResetRepository.ts`
- `src/features/mailbox/mailboxRepository.ts`
- `src/features/mailbox/mailboxRoutes.ts`

Tasks:

1. Move mailbox listing out of auth.
2. Inject base URL; remove hard-coded reset URL.
3. Store reset token digest only. Send raw token in dev mailbox link.
4. Consume token atomically with password update and session invalidation.
5. Add expiry cleanup/revocation behavior.
6. Catch unique email constraint and map to `EMAIL_EXISTS`; precheck may remain UX optimization only.
7. Centralize email/password/display-name domain rules.
8. Inject clock and random token source for deterministic tests.
9. Keep cookie/session transport details in Fastify plugin/route layer.

Required tests:

- duplicate signup race produces one account plus clean conflict
- raw reset token absent from database
- expired/used token behavior
- reset updates password and invalidates sessions atomically
- generated link uses configured base URL
- mailbox route independent from auth service

Exit:

- no mailbox function in auth module
- no hard-coded frontend URL in domain code
- no plaintext reset token at rest
- auth service accepts explicit repositories/dependencies

Suggested commit: `refactor(auth): isolate sessions reset and mailbox concerns`

### Phase 6: Split repositories and integration suites by feature

Packet: 6. Owner: one agent.

Goal: clear database ownership without abstraction ceremony.

Repository groups:

- products
- carts
- promos
- orders/checkout
- users/sessions/reset
- favourites
- mailbox

Rules:

- repositories own SQL and row types
- services own workflow/rules
- routes own HTTP mapping
- transaction callback receives same DB connection explicitly
- cross-feature service calls use narrow ports or shared transaction coordinator
- no generic base repository

Split `smoke.integration.test.ts` into:

- `test/db/migrations.integration.test.ts`
- `test/db/seed.integration.test.ts`
- `test/catalog/products.integration.test.ts`
- `test/cart/cart.integration.test.ts`
- `test/checkout/payment.integration.test.ts`
- `test/auth/auth.integration.test.ts`
- `test/http/*.integration.test.ts`

Keep fixtures/builders small and shared only after second real use.

Exit:

- no catch-all smoke suite
- failing feature test identifies owner immediately
- domain pure-rule tests do not open DB

Suggested commit: `refactor(api): align repositories and tests by feature`

### Phase 7: Simplify web async and checkout state

Goal: remove stale-request races and transient cross-route checkout state.

#### Packet 7A: Remove catalog request races

Catalog tasks:

1. Keep debounce in one place: URL search update or request hook, not both.
2. Remove unused `debouncedFetch` from `useProducts`.
3. Add `AbortController` or monotonically increasing request ID.
4. Ensure older query response cannot replace newer result.
5. Extract `useCatalogParams` into feature-local file once reused/tested independently.

Packet 7A checks:

- fake-timer debounce test
- out-of-order response test
- URL back/forward tests

Packet 7A stop condition: one debounce owner; stale request cannot commit state.

#### Packet 7B: Give cart provider one state owner

Cart tasks:

1. Move storage/API/recovery operations into `cartClient` or controller owned by `CartProvider`.
2. Replace many coupled booleans with reducer state:
   - `initializing`
   - `ready`
   - `refreshing`
   - `error`
3. Track per-product mutation state separately.
4. Remove module-global initialization promise. Provider instance owns deduplication.
5. Preserve stale-cart recovery behavior and copy.

Packet 7B checks:

- provider remount/isolation test
- Strict Mode initialization test
- missing-cart recovery tests
- concurrent product action tests

Packet 7B stop condition: provider owns cart lifecycle; no mutable module-global operation state.

#### Packet 7C: Consolidate checkout web flow

Checkout tasks:

1. Merge contact and payment route state into one checkout feature flow.
2. Recommended UI: one `/checkout` route with explicit contact and payment steps/components.
3. Split view components:
   - `ContactDetailsStep`
   - `PaymentDetailsStep`
   - `PromoCodeForm`
   - `CheckoutSummary`
4. Keep one `useCheckoutFlow` reducer/controller.
5. Remove unchecked `location.state`, `/payment` route, and duplicate page orchestration.
6. Keep card values in component memory only; never persist browser storage.
7. Keep idempotency key stable across retry of unchanged attempt; regenerate only when new attempt semantics require it.

Packet 7C checks:

- contact/payment step validation
- back/refresh behavior
- decline/timeout retry behavior
- idempotency-key lifecycle
- order confirmation navigation

Packet 7C stop condition: one checkout controller owns contact, promo, payment, submission state; `/payment` route and unchecked `location.state` removed.

Required tests:

- out-of-order catalog responses
- provider remount/isolation
- missing-cart recovery
- checkout step validation
- refresh/back behavior
- decline/timeout retry and idempotency key behavior

Exit:

- no duplicate search debounce
- no module-global cart promise
- no checkout data passed through unchecked router state
- page components focus on layout, controllers on workflow

Suggested commit: `refactor(web): consolidate async cart and checkout state`

### Phase 8: Add architecture guardrails and final verification

Packet: 8. Owner: one agent.

Goal: prevent recurrence.

Tasks:

1. Add ESLint `no-restricted-imports` boundaries:
   - `packages/**` cannot import `apps/**`
   - `scripts/**` cannot import `apps/**`
   - web cannot import API source
   - contracts cannot import catalog or apps
2. Add authored-file size review rule or report:
   - warning threshold: 300 logical lines
   - failure threshold: 400 logical lines
   - exclude generated files, framework-generated UI adapters, migrations, static fixtures
   - allow documented exception for cohesive declarative renderer
3. Prefer architectural rule over arbitrary split. Report responsibility count beside line count.
4. Add root `verify` script:

```text
npm run format
npm run typecheck
npm run lint
npm test
npm run build --workspaces --if-present
```

Use `prettier --check`, not write mode, under `format`.

5. Add CI workflow running supported Node 22 and `npm ci`, then `npm run verify`.
6. Update README commands and architecture section after code lands.
7. Remove stale “stub”, “legacy”, and old-wave comments when corresponding code is gone.

Final checks:

- `rg "productMediaRegistry|PRODUCT_MEDIA_REGISTRY|PRODUCT_VISUAL_REGISTRY"` -> no result
- `rg "from .*apps/" packages scripts` -> no cross-boundary import
- `rg "getDb\(" apps/api/src/features apps/api/src/routes` -> no result
- `rg "location.state" apps/web/src/features/checkout` -> no result
- `npm run verify` -> pass

Suggested commit: `chore: enforce package boundaries and verification`

## Execution Order

Required sequence:

`0 -> 1A -> 1B -> 1C -> 2A -> 2B -> 3A -> 3B -> 4 -> 5 -> 6 -> 7A -> 7B -> 7C -> 8`

Reasoning:

- catalog/media cleanup removes largest obsolete surface first
- contract change precedes mapper/service cleanup
- app factory and explicit DB lifecycle enable reliable payment/auth tests
- payment correctness precedes broad file-size cleanup
- guardrails land after target boundaries exist

Keep every phase independently green. Avoid one repository-wide rewrite commit.

## Scope Controls

Do:

- preserve existing routes unless phase explicitly removes unused legacy path
- preserve catalog IDs, slugs, prices, category behavior, promos, seed users
- preserve current live bag appearance
- add migration coverage before replacing startup schema mutation
- add concurrency test before payment rewrite
- delete obsolete code only after last consumer moves

Do not:

- introduce ORM during this refactor
- add Redux, React Query, dependency injection framework, or generic service container
- split generated shadcn/Base UI wrappers for line-count compliance
- create one class per domain noun
- create generic repository abstraction
- keep WebP pipeline “just in case” after live SVG decision
- mix new product features into architecture commits

## Completion Criteria

Architecture complete when all conditions hold:

- `productMediaRegistry.ts`, product manifest, generated product WebPs, image build script removed
- canonical catalog owned by `@shop/catalog`, split by category, explicitly validated
- no package/script imports app-private source
- contracts split by domain; no runtime catalog/media registry
- one product record mapper used everywhere
- versioned migrations replace catch-all startup alters
- app factory supports isolated injected databases and `app.inject()` tests
- payment idempotency handles concurrent requests without duplicate order or 500
- no persisted PAN/CVC or derivative based on full sensitive values
- legacy checkout write path removed or delegates to single checkout service
- auth, sessions, reset, mailbox separated
- reset tokens hashed at rest; base URL configured
- web catalog requests cannot commit stale response
- cart provider owns initialization state; no module-global promise
- checkout/payment workflow uses one feature state owner
- authored logic files above 400 logical lines have documented cohesive exception or are decomposed
- tests split by feature and include HTTP boundary coverage
- root `npm run verify` and CI pass

## Expected End State

Largest current source disappears instead of moving. Remaining large content becomes small category-owned modules. Remaining large behavior becomes feature services with explicit dependencies and tests. Contracts return to transport ownership. API startup becomes composable. Checkout becomes one atomic workflow from browser through SQLite.
