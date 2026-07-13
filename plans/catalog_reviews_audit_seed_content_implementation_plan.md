# Catalog, Reviews, Audit, Seed, Content Implementation Plan

Status: planned.

Audience: coding agents.

Source direction: `plans/demo_project_high_level_plan.md`.

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
- `apps/api/src/db/migrations/002-catalog-depth.ts`
- `apps/api/src/db/migrations/003-reviews.ts`
- `apps/api/src/db/migrations/004-audit.ts`
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

## Delivery Phases

### Phase 0: Foundation

- add migration runner and ledger
- split contracts without behavior change
- add pure domain workspaces with first real rules
- record current migration and seed behavior in focused integration tests

Exit: fresh and existing databases converge; storefront unchanged; checks pass.

### Phase 1: Variant Catalog

- add option, value, variant schema and default backfill
- implement catalog aggregation
- update product list/detail contracts
- update cart and order variant identity
- build selector and URL state
- seed catalog-rich combinations

Exit: every active product has default variant; cart/order retain SKU; unavailable variant rejected; existing carts preserved.

### Phase 2: Specifications, Filters, Sorting

- add specifications and tags
- expand query contract and predicate builder
- add price, date, name controls and sorts
- preserve URL state through navigation and browser back

Exit: count and item queries match; URL represents state; sorts stable across pages.

### Phase 3: Comparison and Similar Products

- implement matrix helper and scorer
- add compare and similar API reads
- add context, tray, route, matrix
- replace related shelf

Exit: 2-4 products compare through shareable URL; missing product tolerated; similarity deterministic.

### Phase 4: Bundles

- add schema, repository, detail section
- add atomic cart operation
- seed available and unavailable bundles

Exit: all components mutate or none; total current; blocker identifies unavailable component.

### Phase 5: Customer Reviews

- add schema, repository, service
- attach authenticated user to new orders
- add verified-purchase lookup
- add customer mutations and admin hide/restore routes
- add summary, list, form, owner controls

Exit: ownership and uniqueness server-enforced; summary published-only; verification evidence-based.

### Phase 6: Append-Only Audit

- add schema, triggers, repository, service
- add request context and sanitizer
- integrate target events
- add admin-only reads and minimal protected audit page

Exit: SQL update/delete fail; secrets absent; required audit failure rolls back mutation; non-admin reads rejected.

### Phase 7: Seed Scenarios

- extract factories and repositories
- implement scenario composition, fixed clock, CLI, validation
- migrate canonical seed to `standard`
- add catalog-rich, reviews, edge-cases

Exit: repeat application identical; reset counts documented; startup preserves user rows; validator errors actionable.

### Phase 8: Help and Policy Content

- add registry, layouts, routes, footer
- add truthful demo wording

Exit: links resolve; content works without API; FAQ and size guide keyboard-readable; no live-service claim.

### Phase 9: Focused Verification

- fill core gaps below
- run static, test, asset, seed checks
- inspect changed pages at supported viewports
- update README feature and seed docs

Exit: checks pass; lesson-owned gaps remain; no obsolete plan or conflicting direction.

## Core Tests

Unit:

- option normalization, combination uniqueness, default selection
- comparison ID normalization, URL precedence, matrix ordering
- similarity score and tie-breakers
- query validation and sort allowlist
- bundle total and component validation
- review bounds, ownership decisions, summary rounding
- audit recursive sanitizer
- seed pseudo-random determinism and dependency ordering
- web variant combination behavior and query parse/serialize

SQLite integration:

- fresh and pre-runner migration paths
- default-variant and cart-line backfill
- unique SKU rejection
- filtered count equals item query
- bundle transaction commit and rollback
- review uniqueness, ownership, verification, published summary
- audit insert/read plus update/delete rejection
- domain rollback on required audit failure
- scenario idempotency, reset determinism, canonical counts

Web components:

- variant changes price, stock, SKU, submitted ID
- comparison maximum, duplicates, missing values
- filters update URL and reset page
- review auth, validation, pending, error, owner controls
- bundle unavailable and add-all states
- footer and content targets

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

## Commands

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
```

## Delivery Slices

1. `refactor(db): add ordered SQLite migrations`
2. `refactor(contracts): split transport schemas by domain`
3. `feat(catalog): add product options and variants`
4. `feat(cart): retain selected variant through order snapshot`
5. `feat(catalog): add specifications and advanced filters`
6. `feat(catalog): add comparison and deterministic similarity`
7. `feat(catalog): add atomic bundles`
8. `feat(reviews): add customer reviews and summaries`
9. `feat(audit): add immutable events and admin reads`
10. `refactor(seed): add deterministic scenario tooling`
11. `feat(web): add help and policy content`
12. `test(core): cover new invariants and SQLite transactions`

Each slice compiles independently. Migration, contract, API, UI, seed, tests may share slice when compatibility requires atomic change.

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
