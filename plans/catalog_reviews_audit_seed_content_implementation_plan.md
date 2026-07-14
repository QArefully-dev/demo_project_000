# Catalog, Reviews, Audit, Seed, Content Implementation Plan

Status: implementation handoff.

Audience: coding agents.

Source direction: `plans/demo_project_high_level_plan.md`.

Execution mode: one phase per agent task. Never continue into next phase without new user request.

Next ready phase: Phase 0.

## Agent Handoff Protocol

Assignment rule: implement first pending phase whose prerequisites show `complete`. User may name different ready phase.

Before coding:

1. Read root `CLAUDE.md`.
2. Read `plans/demo_project_high_level_plan.md`.
3. Read this file fully.
4. Inspect current worktree, relevant manifests, schema, contracts, tests.
5. Confirm prerequisite phases in ledger. Code remains implementation truth.

During phase:

- scope: current phase only
- preserve unrelated work
- keep compatibility called out by phase
- use `apply_patch` for edits
- add only phase-required tests
- run narrow checks during work; run phase verification before handoff
- no commit, stage, branch, push, or PR unless user requests
- blocker: stop after safe investigation; record exact blocker and required decision

After phase:

1. Satisfy every exit-gate item.
2. Update phase ledger status and `Next ready phase`.
3. Replace phase `Handoff` value with concise completion record.
4. Record schema/API compatibility notes needed by next phase.
5. Report changed files, checks, remaining risks.
6. Stop. Do not start next phase.

Status values: `pending`, `in_progress`, `complete`, `blocked`.

Handoff format:

`Handoff: complete YYYY-MM-DD; checks: <commands>; notes: <compatibility or follow-up>`

Blocked format:

`Handoff: blocked YYYY-MM-DD; blocker: <fact>; needs: <decision or external change>`

## Phase Ledger

- Phase 0: `pending` -> migration foundation
- Phase 1: `pending` -> contracts and pure domain packages
- Phase 2: `pending` -> variant catalog persistence and API
- Phase 3: `pending` -> variant cart, order, product UI
- Phase 4: `pending` -> specifications, filters, sorting
- Phase 5: `pending` -> comparison and similar products
- Phase 6: `pending` -> bundles
- Phase 7: `pending` -> customer reviews
- Phase 8: `pending` -> append-only audit
- Phase 9: `pending` -> seed scenario tooling
- Phase 10: `pending` -> help and policy content
- Phase 11: `pending` -> focused verification and documentation

## Objective

Expand department-store demo through production-style vertical slices:

`SQLite -> domain rules -> repositories -> API -> shared contracts -> React UI -> focused tests`

Scope:

- product variants, specifications, bundles, comparison
- customer reviews
- deterministic similar products
- catalog price, date, name filters and sorting
- append-only audit trail
- deterministic seed scenarios and validation tooling
- help, policy, FAQ, size-guide pages
- core unit and SQLite integration coverage

Growth forecast: 27k-43k authored LOC. Forecast guides scope; functional exit gates control completion. No padding, generated clients, copied framework code, duplicated components, or hard-coded bulk data.

## Baseline

- product model: product-level price, stock, category, slug, media, sales count
- catalog query: text, category, sale, newest, price, bestselling, pagination
- detail page: gallery, purchase panel, description, category-based related shelf
- cart line identity: product only
- order line snapshot: product name, unit price, quantity
- schema setup: centralized `ensureSchema()` with guarded additive columns
- seed: monolithic `apps/api/src/db/seed.ts`
- auth: customer and admin roles, cookie session
- tests: focused web behavior plus API domain and SQLite integration baseline

## Constraints

- production-grade code conventions despite non-live demo deployment
- local-first runtime; no required network, account, API key, cloud service, or Docker
- Node.js 22, npm workspaces, React, Fastify, TypeBox, SQLite
- Windows and macOS support
- additive migration path preserving existing databases
- backend authority for price, stock, variant availability, review ownership, audit records
- integer minor units for money
- deterministic reset and named seed scenarios
- no broad E2E, Playwright, visual-regression, property-based, load, or exhaustive contract suite
- preserve `SAVE10`: 10%, five-item minimum
- preserve anonymous browsing, cart, checkout, comparison
- leave non-core test gaps for course lessons

## Non-Goals

- SKU-level inventory reservations
- bundle discounts, bundle price allocation, nested bundles
- review media, replies, helpful votes, full moderation console
- behavioral recommendation tracking or machine learning
- saved server-side comparisons
- external search service
- CMS
- audit export, retention automation, cryptographic chaining
- full admin application

## Architecture

Domain ownership:

- `packages/catalog`: variant, specification, bundle, comparison, similarity, query rules
- `packages/reviews`: rating validation, ownership, verified purchase, summary calculation
- `packages/audit`: event taxonomy, metadata sanitization, append-only model
- `packages/contracts`: transport schemas only
- `apps/api`: migrations, repositories, transactions, authentication, route adapters
- `apps/web`: customer state, forms, routes, rendering

Dependency direction:

`apps/web -> packages/contracts`

`apps/api -> packages/contracts + pure domain packages`

`pure domain packages -> no app or database imports`

Avoid package creation without owned rules. Keep SQL and Fastify types inside API workspace.

## Database Migrations

Replace expanding `ensureSchema()` body with ordered migration runner.

New files:

- `apps/api/src/db/migrations/types.ts`
- `apps/api/src/db/migrations/001-baseline.ts`
- `apps/api/src/db/migrations/002-product-variants.ts`
- `apps/api/src/db/migrations/003-specifications-tags.ts`
- `apps/api/src/db/migrations/004-bundles.ts`
- `apps/api/src/db/migrations/005-reviews.ts`
- `apps/api/src/db/migrations/006-audit.ts`
- `apps/api/src/db/migrations/index.ts`
- `apps/api/src/db/migrate.ts`

Rules:

- `schema_migrations(version, name, applied_at)` records completed versions
- each migration runs once inside transaction
- fresh database and existing pre-runner database converge on same schema
- baseline recognizes existing tables; no destructive recreation
- migrations never depend on seed rows
- failure rolls back version and schema changes
- startup applies pending migrations before repository access

## Product Variants

Product row remains merchandising identity. Variant row becomes authority for SKU, price, stock, active state.

Schema:

- add `products.active`, `products.updated_at`
- `product_options(id, product_id, name, sort_order)`
- `product_option_values(id, option_id, value, sort_order)`
- `product_variants(id, product_id, sku, price_cents, stock_count, image_set_id, active, created_at, updated_at)`
- `product_variant_values(variant_id, option_value_id)`

Rules:

- SKU globally unique, normalized uppercase
- option name unique per product, case-insensitive
- option value unique per option, case-insensitive
- one value per option on each variant
- variant combination unique per product
- price and stock non-negative integers
- inactive variant unavailable for new cart additions
- existing product backfill -> one active `DEFAULT` variant
- product list price -> minimum active variant price
- product list stock -> sum active variant stock
- legacy product price and stock columns retained during compatibility window; no new writes after cutover

Cart migration:

- add nullable `variant_id`, backfill default variant
- rebuild `cart_line_items` with required `variant_id`
- uniqueness -> `(cart_id, variant_id)`
- add body accepts `variantId`; temporary omission resolves default variant
- quantity checks use selected variant stock

Order migration:

- add nullable `variant_id` for historical compatibility
- add snapshot fields `sku`, `variant_label`
- new orders always capture variant ID, SKU, selected option label, unit price
- historical lines remain readable without variant reference

## Specifications and Tags

Schema:

- `product_specifications(id, product_id, key, label, value, unit, group_name, sort_order)`
- `product_tags(product_id, tag)`

Rules:

- specification key stable machine identifier, unique per product
- label and value customer-facing
- unit nullable; never concatenate into stored value
- tag normalized lowercase kebab-case, unique per product
- comparison groups identical keys across selected products
- missing value renders em dash; no fake value synthesis

## Bundles

Schema:

- `product_bundles(id, slug, name, description, active, created_at, updated_at)`
- `product_bundle_items(bundle_id, product_id, variant_id, quantity, sort_order)`

Rules:

- two or more components
- positive component quantity
- optional authoring variant resolves product default variant
- no nesting or bundle discount
- displayed price -> current component total
- add bundle -> one transaction adding or incrementing all component cart lines
- unavailable component blocks whole operation; no partial mutation
- cart retains ordinary variant lines

## Customer Reviews

Schema:

- `reviews(id, product_id, user_id, rating, title, body, status, verified_purchase, created_at, updated_at)`
- add nullable `orders.user_id`

Rules:

- authenticated customer required for create, update, delete
- one review per user per product
- rating integer 1-5
- title trimmed, 3-120 characters
- body trimmed, 20-4000 characters
- initial status `published`
- admin hide/restore API; admin UI deferred
- owner update preserves verification
- owner delete hard-deletes review; audit retains action metadata, never review body
- verified purchase requires paid order owned by authenticated user containing product or selected variant
- anonymous historical orders never auto-verify
- summary includes published reviews only
- average rounded to one decimal plus per-star counts
- sort allowlist: newest, oldest, highest rating, lowest rating

## Append-Only Audit

Schema:

- `audit_events(id, occurred_at, actor_type, actor_id, action, entity_type, entity_id, request_id, metadata_json)`

Enforcement:

- repository exports `append`, `getById`, `list`; no update or delete
- SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers abort with `audit_events are append-only`
- domain mutation and event insert share transaction where practical
- authentication failure audit may use separate transaction
- metadata JSON passes recursive sanitizer

Forbidden metadata:

- passwords and password hashes
- session and reset tokens
- cookies
- card numbers and CVC
- full payment payload
- full review body
- full address

Initial actions:

- `auth.login_succeeded`, `auth.login_failed`, `auth.password_changed`
- `cart.variant_added`, `cart.bundle_added`
- `order.created`
- `payment.succeeded`, `payment.failed`
- `review.created`, `review.updated`, `review.deleted`, `review.hidden`, `review.restored`
- `seed.scenario_applied`

Admin reads:

- `GET /api/audit-events`
- `GET /api/audit-events/:id`
- filters: action, entity type, entity ID, actor ID, date range, page
- occurred-at descending only
- admin authorization required
- no mutation route

Failure behavior:

- required audit failure rolls back matching domain mutation
- login-failure audit failure never changes authentication result
- sanitizer rejects forbidden keys recursively
- rejected raw metadata never enters logs

## Contracts

Split `packages/contracts/src/schemas.ts`:

- `common.ts`
- `catalog.ts`
- `cart.ts`
- `orders.ts`
- `reviews.ts`
- `audit.ts`
- `auth.ts`
- `index.ts`

Catalog contracts:

- `ProductSummary`, `ProductDetail`, `ProductVariant`, `ProductOption`
- `ProductSpecification`, `ProductBundle`, `BundleAvailability`
- `ProductComparisonResponse`, `SimilarProductsResponse`, expanded `ProductQuery`

Review contracts:

- `Review`, `ReviewSummary`, `ReviewListResponse`
- `CreateReviewBody`, `UpdateReviewBody`, `ReviewQuery`

Audit contracts:

- `AuditEvent`, `AuditEventListResponse`, `AuditEventQuery`

Compatibility:

- retain `Product` alias to `ProductSummary` until consumers migrate
- retain `/related` as compatibility alias for one delivery slice
- reject unknown sort and filter values through TypeBox

## Catalog Filters and Sorting

Query parameters:

- `q`: broad text search
- `name`: name-only substring
- `category`: exact category
- `onSale`: boolean
- `minPriceCents`, `maxPriceCents`: inclusive effective variant price
- `addedFrom`, `addedTo`: inclusive ISO date
- `sort`: `newest`, `oldest`, `name_asc`, `name_desc`, `price_asc`, `price_desc`, `bestselling`
- `page`, `pageSize`: existing bounds

Rules:

- URL remains source of truth
- invalid date or price range returns 400
- date-only input uses UTC boundary
- count and item query share one predicate builder
- sort fragments allowlisted; values bound
- price sort uses minimum active variant price
- name sort case-insensitive with ID tie-breaker
- every sort stable across pages

Web work:

- add price range controls
- add date-added range controls
- add name-only input without removing broad search
- expand sort selector
- clear-all removes new filters
- changing filter resets page
- browser back restores full catalog state

## Similar Products

Deterministic score:

- same category: +40
- shared tag: +10 each, cap +30
- effective price within 20%: +15
- shared specification key/value: +5 each, cap +20
- active and available: +5
- exclude source and inactive products
- order: score descending -> sales count descending -> ID ascending
- API maximum 8; page renders 4-5
- no per-user behavior

API:

- `GET /api/products/:id/similar`
- legacy `/related` delegates to same service during compatibility window

Repository fetches bounded candidate pool. Pure scorer lives in `packages/catalog`.

## Comparison

Flow:

`catalog/product -> comparison tray -> /compare?ids=...`

Rules:

- 2-4 products
- duplicate IDs ignored
- URL preserves selection order
- local storage remembers latest valid selection
- URL wins on direct navigation
- removed or inactive product omitted with visible notice
- differing specification rows first; show-all reveals identical rows
- no authentication required

API:

- `GET /api/products/compare?ids=1,2,3`
- reject more than 4 unique IDs
- preserve requested order
- return missing IDs separately

Web files:

- `apps/web/src/features/comparison/ComparisonContext.tsx`
- `apps/web/src/features/comparison/ComparisonTray.tsx`
- `apps/web/src/features/comparison/ComparisonPage.tsx`
- `apps/web/src/features/comparison/ComparisonMatrix.tsx`
- `apps/web/src/features/comparison/comparisonStorage.ts`

## Product Detail

Target order:

`breadcrumbs -> gallery + purchase panel -> specifications -> bundles -> reviews -> similar products`

Variant UI:

- controls derive valid combinations from variant matrix
- unavailable combination disabled
- selection controls price, stock, SKU, optional image set
- default -> first active in-stock variant, then first active
- URL `variant` supports direct link
- add-to-cart sends exact variant ID

Specifications:

- semantic definition lists grouped by `groupName`
- hide section when empty

Bundles:

- show bundles containing current product
- link components to product detail
- add-all exposes pending, success, unavailable, failure

Reviews:

- summary shown only when reviews exist
- list and sort below details
- authenticated form supports create and edit
- unauthenticated CTA preserves return path
- owner controls separate from content
- no fake count or rating

Similar shelf:

- replace generic related shelf
- isolated loading and failure state
- failure never hides product detail

## Help and Policy Content

Routes:

- `/help`
- `/help/faq`
- `/help/shipping`
- `/help/returns`
- `/help/size-guide`
- `/policies/privacy`
- `/policies/terms`

Files:

- `apps/web/src/features/content/ContentPage.tsx`
- `apps/web/src/features/content/contentRegistry.ts`
- `apps/web/src/features/content/HelpIndexPage.tsx`
- `apps/web/src/features/content/FaqPage.tsx`
- `apps/web/src/features/content/SizeGuidePage.tsx`
- `apps/web/src/features/content/PolicyPage.tsx`
- `apps/web/src/components/Footer.tsx`

Rules:

- typed registry with stable route key, title, summary, sections
- shared accessible article layout
- FAQ uses native `details` and `summary`
- size guide uses semantic HTML data tables
- footer exposes every route
- copy states demo limitations truthfully
- no claims of real fulfilment, returns processing, certification, or payment handling
- no API or CMS dependency

## Seed Tooling

Replace monolithic seed with composable deterministic system.

```text
apps/api/src/db/seed/
  context.ts
  ids.ts
  random.ts
  factories/
    users.ts
    products.ts
    variants.ts
    specifications.ts
    bundles.ts
    reviews.ts
    orders.ts
    promotions.ts
  scenarios/
    standard.ts
    catalog-rich.ts
    reviews.ts
    edge-cases.ts
  applyScenario.ts
  validateScenario.ts
  index.ts
```

Scenarios:

- `standard`: default startup, familiar catalog, users, promotions, favourites
- `catalog-rich`: option shapes, price bands, specifications, tags, bundles
- `reviews`: published, hidden, verified, unverified, rating distributions
- `edge-cases`: inactive variants, unavailable combinations, missing comparison item, blocked bundle

Commands:

- `npm run seed -- --scenario standard`
- `npm run reset -- --scenario catalog-rich`
- `npm run seed:check -- --scenario standard`
- default scenario: `standard`

Rules:

- scenario key -> stable entity keys, values, relations, counts
- pseudo-random generator requires explicit seed
- factories return records; repositories write
- scenario composition declares dependencies
- canonical keys prevent duplicate rows
- reset clears mutable tables in foreign-key-safe order
- fixed scenario clock; no wall-clock dependency
- startup seed preserves non-seed user data
- reset removes all data
- validator checks relations, SKU uniqueness, option completeness, bundle expectations, review ownership, audit triggers
- CLI prints scenario, inserted/updated counts, validation result
- README documents credentials and scenario triggers

## API Layout

```text
apps/api/src/domains/
  catalog/
    catalogRepository.ts
    catalogService.ts
    catalogQuery.ts
    variantRepository.ts
    bundleRepository.ts
    similarityRepository.ts
  reviews/
    reviewRepository.ts
    reviewService.ts
  audit/
    auditRepository.ts
    auditService.ts
    auditRequestContext.ts
```

Route files:

- `apps/api/src/routes/catalog.ts`
- `apps/api/src/routes/reviews.ts`
- `apps/api/src/routes/audit.ts`
- update cart, order, payment routes for variants, user ownership, audit

Repository rules:

- explicit row types; no `SELECT *`
- mapping outside route handlers
- no dynamic column or sort input outside allowlist
- transaction passed explicitly for atomic writes
- stable domain error codes mapped centrally
- pagination at database boundary
- validate JSON before response mapping

## Implementation Phases

Strict order: `0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11`.

### Phase 0: Migration Foundation

Status: `pending`.

Prerequisites: none.

Goal: ordered migration runner replacing further `ensureSchema()` growth without behavior change.

Owned files:

- `apps/api/src/db/connection.ts`
- `apps/api/src/db/migrations/**`
- `apps/api/src/db/migrate.ts`
- migration-focused files under `apps/api/test/**`

Work:

1. Add `schema_migrations` ledger.
2. Move current schema setup into baseline migration compatible with fresh and existing databases.
3. Add ordered runner with per-migration transaction and duplicate-application guard.
4. Call runner before repositories or seed execute.
5. Preserve `SHOP_DB_PATH`, in-memory database, reset, seed behavior.
6. Add migration test helpers for fresh database and copied pre-runner fixture.

Required tests:

- fresh database -> current schema plus migration ledger
- existing database -> baseline recorded without data loss
- second run -> no schema or ledger change
- failing migration -> transaction rollback, version absent

Verification:

```powershell
npm run typecheck
npm run test:integration -w @shop/api
npm run lint
git diff --check
```

Exit gate:

- fresh and existing databases converge
- existing rows preserved
- startup, seed, reset still work
- no product, cart, order, auth behavior change

Suggested commit: `refactor(db): add ordered SQLite migrations`

Handoff: `pending`.

### Phase 1: Contracts and Pure Domain Packages

Status: `pending`.

Prerequisites: Phase 0 `complete`.

Goal: split transport schemas; establish catalog, review, audit workspaces with real pure rules only.

Owned files:

- `packages/contracts/src/**`
- `packages/catalog/**`
- `packages/reviews/**`
- `packages/audit/**`
- root and workspace manifests
- package unit tests

Work:

1. Split monolithic contract file into domain files listed under `Contracts`.
2. Preserve every current export through `packages/contracts/src/index.ts`.
3. Add workspace manifests and TypeScript configs.
4. Add catalog option normalization, SKU normalization, stable sort identifiers.
5. Add review rating and text validation primitives.
6. Add audit action type and forbidden-metadata key set.
7. Wire root typecheck and unit scripts through workspaces.

Required tests:

- current contract exports compile unchanged
- SKU and option normalization deterministic
- review primitive bounds enforced
- audit forbidden-key match case-insensitive

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run lint
git diff --check
```

Exit gate:

- current API and web compile without consumer edits beyond imports
- no empty package or placeholder module
- pure packages import no app, Fastify, React, SQLite code

Suggested commit: `refactor(contracts): split schemas and add domain packages`

Handoff: `pending`.

### Phase 2: Variant Catalog Persistence and API

Status: `pending`.

Prerequisites: Phase 1 `complete`.

Goal: variant authority for SKU, effective price, stock; product reads expose option matrix.

Owned files:

- catalog migration
- `apps/api/src/domains/catalog/**`
- product routes and mapping
- catalog contracts and rules
- minimal compatibility updates in current seed
- catalog repository integration tests

Work:

1. Add option, value, variant, variant-value tables and constraints.
2. Backfill one active default variant per existing product.
3. Update current seed path to create default variant for newly seeded product.
4. Add variant repository and explicit row mappers.
5. Derive product summary price from minimum active variant price.
6. Derive product summary stock from active variant stock sum.
7. Extend product detail with options, variants, default variant ID.
8. Retain product-level price and stock columns as read compatibility only.
9. Keep current cart and order writes unchanged until Phase 3.

Required tests:

- migration backfill creates one default variant per product
- SKU and option combination uniqueness enforced
- inactive variant excluded from effective price and stock
- seeded product always receives default variant
- product list and detail mapping deterministic

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration -w @shop/api
npm run lint
git diff --check
```

Exit gate:

- every active product has active default variant
- list and detail responses expose stable variant data
- existing catalog output remains valid
- no cart or order migration yet

Suggested commit: `feat(catalog): add product options and variants`

Handoff: `pending`.

### Phase 3: Variant Cart, Order, Product UI

Status: `pending`.

Prerequisites: Phase 2 `complete`.

Goal: selected variant survives product selection -> cart -> checkout -> order snapshot.

Owned files:

- cart and order migration
- cart, order, payment domains and routes
- cart and order contracts
- web product purchase panel and variant selector
- cart/order rendering
- focused API, SQLite, web tests

Work:

1. Add nullable cart `variant_id`; backfill product default variant.
2. Rebuild cart-line uniqueness as `(cart_id, variant_id)`; require variant after backfill.
3. Add nullable historical order `variant_id`; add `sku`, `variant_label` snapshots.
4. Extend cart mutation body with `variantId`; temporary omission resolves default variant.
5. Enforce active variant and variant stock on add/update.
6. Capture selected SKU, option label, unit price in new orders.
7. Build option selector from valid variant combinations.
8. Add `variant` URL parameter and deterministic default selection.
9. Update cart, checkout, confirmation displays with variant label.
10. Keep `SAVE10` behavior unchanged.

Required tests:

- cart migration preserves product and quantity
- duplicate selected variant increments matching line only
- unavailable variant rejected
- order snapshot remains stable after variant changes
- selector disables impossible combination
- URL variant wins when valid; default used when invalid
- add action submits exact variant ID once

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
npm run assets:check
git diff --check
```

Exit gate:

- selected variant retained across core purchase path
- historical carts and orders remain readable
- product without explicit selection uses default variant
- promo gate and payment behavior unchanged

Suggested commit: `feat(cart): retain selected variant through order snapshot`

Handoff: `pending`.

### Phase 4: Specifications, Filters, Sorting

Status: `pending`.

Prerequisites: Phase 3 `complete`.

Goal: structured specifications plus URL-owned price, date, name catalog controls.

Owned files:

- specifications and tags migration
- catalog query domain, repository, contracts, routes
- catalog sidebar, toolbar, query-state helpers
- product specification detail components
- focused query and web tests

Work:

1. Add specification and tag tables with uniqueness rules.
2. Add repository reads and detail response mapping.
3. Add shared SQL predicate builder used by count and item queries.
4. Add name, min/max price, added-from/to filters.
5. Add oldest, name ascending, name descending sorts.
6. Apply effective variant price to filter and sort.
7. Add stable ID tie-breaker to every sort.
8. Extend URL parse, serialize, clear-all, page-reset behavior.
9. Render grouped semantic specifications on detail page.
10. Add minimal current-seed specification and tag data needed for manual use.

Required tests:

- invalid price/date ranges return stable error
- count predicate matches item predicate
- boundary price and dates inclusive
- sorting stable across pages
- browser back restores filters
- missing specifications hide detail section

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
git diff --check
```

Exit gate:

- query string represents every filter and sort
- count matches result set
- SQL identifiers remain allowlisted
- existing q, category, sale filters remain compatible

Suggested commit: `feat(catalog): add specifications and advanced filters`

Handoff: `pending`.

### Phase 5: Comparison and Similar Products

Status: `pending`.

Prerequisites: Phase 4 `complete`.

Goal: anonymous shareable comparison plus deterministic explainable similarity.

Owned files:

- catalog comparison and similarity rules
- catalog repository and routes
- comparison web feature
- product card, product detail, app routing
- focused unit, API, web tests

Work:

1. Implement comparison ID normalization and 2-4 product limit.
2. Add ordered compare API response with missing IDs.
3. Implement specification matrix with differing rows first.
4. Implement weighted similarity scorer from specified category, tag, price, specification weights.
5. Fetch bounded candidate pool; apply deterministic tie-breakers.
6. Add similar endpoint; retain `/related` compatibility alias.
7. Add comparison context, local storage, tray, page, matrix.
8. Add comparison controls to cards and detail page.
9. Replace related shelf with isolated similar shelf.

Required tests:

- duplicate and excess comparison IDs handled
- requested order preserved
- missing product returned separately
- URL selection overrides local storage
- matrix orders differing rows first
- similarity score weights and tie-breakers exact
- similar endpoint excludes source and inactive product

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
git diff --check
```

Exit gate:

- direct comparison URL works without auth
- comparison persists latest valid selection
- 2-4 product limit enforced client and server
- similar failure never hides product detail

Suggested commit: `feat(catalog): add comparison and deterministic similarity`

Handoff: `pending`.

### Phase 6: Bundles

Status: `pending`.

Prerequisites: Phase 5 `complete`.

Goal: curated component groups with atomic add-all cart behavior; no discount logic.

Owned files:

- bundle migration
- catalog bundle rules, repository, service, routes
- cart bundle transaction
- bundle contracts and product-detail components
- minimal seed compatibility data
- focused transaction and web tests

Work:

1. Add bundle and bundle-item tables.
2. Validate two-component minimum, positive quantity, no nesting.
3. Resolve omitted component variant to default variant.
4. Calculate current component total server-side.
5. Add product-detail bundle reads.
6. Add atomic cart bundle mutation.
7. Return exact unavailable component failure.
8. Render component links, total, pending, success, failure states.
9. Add one available and one unavailable deterministic bundle to current seed.

Required tests:

- bundle validation rejects one component and invalid quantity
- default component variant resolution deterministic
- bundle total uses current variant prices
- add-all commits all lines
- unavailable component rolls back all lines
- repeated add increments correct variant lines

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
git diff --check
```

Exit gate:

- bundle display and add-all work from product detail
- cart contains ordinary variant lines
- no discount, allocation, nesting logic added
- failed add leaves cart unchanged

Suggested commit: `feat(catalog): add atomic product bundles`

Handoff: `pending`.

### Phase 7: Customer Reviews

Status: `pending`.

Prerequisites: Phase 6 `complete`.

Goal: authenticated customer review lifecycle with evidence-based verified purchase.

Owned files:

- review and order-user migration
- review domain package, repository, service, routes
- auth/order/payment integration for order ownership
- review contracts
- product-detail review UI
- focused domain, SQLite, web tests

Work:

1. Add review table and nullable order `user_id`.
2. Attach authenticated user to new order without blocking anonymous checkout.
3. Implement create, update, delete ownership rules.
4. Enforce one review per user/product and text/rating bounds.
5. Derive verified purchase from owned paid order evidence.
6. Add published-only summary and star distribution.
7. Add list sorts: newest, oldest, highest, lowest.
8. Add admin hide/restore API; defer moderation UI.
9. Add review summary, list, form, owner controls.
10. Preserve login return path.

Required tests:

- unauthenticated mutation rejected
- duplicate review rejected
- non-owner update/delete rejected
- verified purchase true only with matching paid order
- anonymous order never verifies
- hidden review excluded from list and summary
- summary average rounding stable
- form exposes validation, pending, failure, owner states

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
git diff --check
```

Exit gate:

- review lifecycle usable from product detail
- authorization server-enforced
- no fake ratings or reviews
- moderation limited to hide/restore API

Suggested commit: `feat(reviews): add customer reviews and rating summaries`

Handoff: `pending`.

### Phase 8: Append-Only Audit

Status: `pending`.

Prerequisites: Phase 7 `complete`.

Goal: immutable mutation history with secret-safe metadata and admin reads.

Owned files:

- audit migration and triggers
- audit domain package, repository, service
- API request context and routes
- auth, cart, order, payment, review transaction integration
- minimal protected audit page
- focused audit and rollback tests

Work:

1. Add audit table, indexes, update/delete rejection triggers.
2. Add append, get, list repository only.
3. Add request ID generation and propagation.
4. Add recursive metadata sanitizer.
5. Integrate actions listed under `Append-Only Audit`.
6. Share transaction for domain mutation and required audit insert.
7. Keep login-failure audit outside auth result decision.
8. Add admin-only paginated reads and filters.
9. Add minimal protected audit list/detail page.

Required tests:

- update and delete rejected at SQLite layer
- forbidden nested key rejected case-insensitively
- required audit failure rolls back mutation
- login-failure audit failure does not alter auth result
- non-admin reads rejected
- list filters and pagination stable

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run lint
git diff --check
```

Exit gate:

- no audit mutation route or repository method
- forbidden data absent from persisted metadata and logs
- core mutation actions recorded once
- admin can inspect events; customer cannot

Suggested commit: `feat(audit): add immutable events and admin reads`

Handoff: `pending`.

### Phase 9: Seed Scenario Tooling

Status: `pending`.

Prerequisites: Phase 8 `complete`.

Goal: composable deterministic scenarios replacing monolithic seed implementation.

Owned files:

- `apps/api/src/db/seed/**`
- seed and reset entry points
- root and API scripts
- README seed documentation
- scenario validation tests

Work:

1. Extract context, stable IDs, fixed clock, seeded random helper.
2. Extract factories listed under `Seed Tooling`.
3. Build dependency-aware scenario composition.
4. Port canonical data into `standard` without visible behavior loss.
5. Add `catalog-rich`, `reviews`, `edge-cases`.
6. Add `--scenario` parsing to seed and reset.
7. Add `seed:check` validation command.
8. Preserve startup idempotency and non-seed user rows.
9. Emit `seed.scenario_applied` audit event without non-deterministic canonical data.
10. Document credentials, counts, notable triggers.

Required tests:

- same scenario twice -> same canonical state
- reset plus same scenario -> same IDs, values, relations, counts
- startup seed preserves user-created rows
- scenario dependency failure actionable
- validator catches SKU, option, bundle, review, audit defects
- fixed random seed and clock stable

Verification:

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run seed:check -- --scenario standard
npm run seed:check -- --scenario catalog-rich
npm run seed:check -- --scenario reviews
npm run seed:check -- --scenario edge-cases
npm run lint
git diff --check
```

Exit gate:

- default `npm run dev` still uses `standard`
- all scenarios validate
- monolithic seed file removed or reduced to entry adapter
- reset and startup semantics documented

Suggested commit: `refactor(seed): add deterministic scenario tooling`

Handoff: `pending`.

### Phase 10: Help and Policy Content

Status: `pending`.

Prerequisites: Phase 9 `complete`.

Goal: static customer guidance and policy routes without API or CMS dependency.

Owned files:

- `apps/web/src/features/content/**`
- `apps/web/src/components/Footer.tsx`
- app routing and layout
- focused content component tests

Work:

1. Add typed content registry and shared article layout.
2. Add help index, FAQ, shipping, returns, size guide, privacy, terms content.
3. Use native `details`/`summary` for FAQ.
4. Use semantic data tables for size guide.
5. Add footer navigation to every route.
6. Route missing content key to not-found page.
7. State local demo data and service limits truthfully.

Required tests:

- every footer target resolves
- registry keys unique
- FAQ keyboard interaction uses native controls
- missing content key renders not-found state
- content rendering makes no API call

Verification:

```powershell
npm run typecheck
npm run test:unit -w @shop/web
npm run build -w @shop/web
npm run lint
git diff --check
```

Exit gate:

- all content routes reachable
- no real fulfilment, returns, compliance, payment claim
- customer app remains usable without API for content routes

Suggested commit: `feat(web): add help and policy content`

Handoff: `pending`.

### Phase 11: Focused Verification and Documentation

Status: `pending`.

Prerequisites: Phases 0-10 `complete`.

Goal: close core gaps, verify integrated result, update human docs, preserve lesson work.

Owned files:

- focused tests needed by completion audit
- README and active plan status
- package scripts only when verification gap requires change

Work:

1. Audit completion definition against code and prior handoffs.
2. Add only missing core tests listed by phase.
3. Run every scenario validator.
4. Run complete static, unit, integration, asset checks.
5. Run targeted Prettier for all files touched across program; run repository format report.
6. Inspect catalog, product, comparison, review, audit, content pages at supported viewports.
7. Update README features, routes, commands, scenarios, credentials.
8. Mark plan status `complete`; mark Phase 11 and ledger complete.
9. Record known lesson-owned gaps; do not implement them.

Required tests:

- no new broad suite
- missing phase-required test only
- one integrated smoke path where current harness already supports it

Verification:

```powershell
npm run typecheck
npm run lint
npm run format
npm run test:unit
npm run test:integration
npm run assets:check
npm run seed:check -- --scenario standard
npm run seed:check -- --scenario catalog-rich
npm run seed:check -- --scenario reviews
npm run seed:check -- --scenario edge-cases
git diff --check
```

Exit gate:

- completion definition satisfied
- all required checks pass or known unrelated baseline recorded exactly
- README matches shipped behavior
- lesson-owned gaps remain
- no stale compatibility alias unless explicitly retained and documented

Suggested commit: `test(core): verify catalog expansion program`

Handoff: `pending`.

## Test Boundary

Each phase owns required tests listed inside phase. Phase 11 adds only missing core coverage found during completion audit.

Lesson-owned gaps:

- broad Fastify injection matrix
- full browser journey automation
- accessibility scanner suite
- mutation and property-based testing
- performance and load testing
- exhaustive malformed inputs
- full audit taxonomy coverage
- exhaustive responsive snapshots
- comprehensive review abuse and concurrency coverage

## Completion Definition

- variants control new cart and order SKU identity
- specifications support detail and comparison
- bundles add components atomically without discount complexity
- comparison works anonymously through shareable URL
- reviews enforce auth, ownership, validation, published summary, verified-purchase evidence
- similar products use deterministic explainable score
- catalog supports price, date, name filtering and stable sorting
- audit events immutable in repository and SQLite
- seed tooling supports deterministic named scenarios and validation
- help, FAQ, policy, shipping, returns, size-guide content reachable from footer
- core unit and SQLite integration tests pass
- course retains broad QA, E2E, abuse, performance, exhaustive boundary work
- root docs describe production-style codebase and non-live demo purpose
