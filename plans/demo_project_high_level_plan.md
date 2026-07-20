# Demo Project High-Level Plan

Status: current product direction.

## Direction Change

Repo originally built as B2C powder retail (`QArefully Powder Co.`, consumer browse -> bag -> checkout). Now shifting to B2B bulk-powder wholesale portal for trade buyers (shops, supermarkets) ordering by pallet, sugar -> cement, plus live trading/auctions on selected lots.

Reason: original consumer-shop idea works but B2B bulk trade + live auctions is more grounded in real-world commerce -> better QA learning material. New surfaces (bulk pricing tiers, minimum order quantities, pallet/freight logistics, concurrent bidding, auction settlement) generate richer, more realistic agentic engineering + QA scenarios than single-unit retail.

Pivot is additive, not rewrite. Reuse catalog/pricing/inventory/checkout/orders foundations. Reframe UI + rules toward trade buyer; retain production boundaries.

## Purpose

Local bulk-powder wholesale codebase for course exercises and large-repository harness demos. Deployment remains non-live demo; code follows production defaults.

Goals:

- immediate recognition: credible B2B wholesale portal with real-world bulk powder catalogue (sugar -> cement)
- clear domain journey: browse -> quote/cart -> bulk checkout -> confirmation
- live trading: real-time auctions/bidding on selected pallet lots
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront foundations
- production-grade migrations, validation, authorization, transactions, error handling, and data integrity
- simulated local integrations without production deployment obligations

## Product Direction

B2B wholesale portal selling bulk powders by pallet: food/pantry (sugar, flour), performance/sports nutrition, household/cleaning, garden, and trade/construction (cement, plaster, fillers). Buyers are trade accounts (independent shops, supermarkets) reselling stock. Brand voice: industrial, confident, unrestrained (locked in `plans/b2b_materials_exchange_rebrand_handoff.md`). Non-food products remain clearly marked `Not for consumption`.

Core journey:

`home -> catalog -> lot detail -> cart -> bulk checkout -> payment -> confirmation -> order history`

No persisted quote object; cart-only (rebrand handoff decision).

Live trading journey:

`auction listings -> lot detail -> place bid -> real-time outbid/win -> settlement -> order`

Extended familiar journeys:

- search, filter, sort, paginate
- select variant (SKU, pack/pallet size, weight, delivery class)
- bulk pricing tiers + minimum order quantity per lot
- apply promotion or trade discount
- save trade delivery sites and payment preference metadata
- track, cancel, or return order
- write verified-purchase review
- manage watchlist, trade profile, sessions, and notification preferences

Live trading scope:

- selected lots offered via timed auction instead of (or alongside) fixed price
- real-time bid submission, current-price/outbid state, reserve price, bid increments
- concurrency-safe settlement -> highest valid bid at close converts to order
- backend authoritative on bid validity, auction state, and close timing

Avoid visible platform complexity:

- no open seller marketplace as main concept; catalog is operator-listed
- keep logistics framing simple (pallet + freight), no standalone warehouse product
- no external/live financial-market dependency; auctions are local simulated real-time
- no microservice topology exposed to users
- optional admin tooling stays secondary and absent from normal journey

## Current Baseline

- monorepo: npm workspaces
- web: React, Vite, TypeScript
- API: Fastify, TypeScript
- database: local SQLite
- shared contracts: TypeBox
- launch: `npm ci` -> `npm run dev`
- external services: none
- implemented commerce: auth, catalog, cart, inventory, promotions, checkout, simulated payment, orders, returns and refunds, favourites, account, dev mailbox
- implemented catalog depth: 100 products across 6 credible categories, typed specifications and tags, advanced filters and stable sorts, product variants with SKU/price/weight/stock, comparison, similar products, curated bundles, customer reviews with helpfulness and abuse reporting
- implemented customer journey: composed product detail, comparison entry points, help and policy center, Custom Powder blend builder and history
- implemented delivery: parcel and freight classification, simulated freight charge at checkout
- implemented integrity: ordered migrations, append-only audit ledger, sanitized admin audit reads
- seed: 100 deterministic powder products across 6 categories (Sports Nutrition 20, Baking & Pantry 20, Drinks 15, Household & Cleaning 15, Garden & Outdoors 15, Trade & Creative Materials 15), plus users, promotions, favourites, catalog metadata, curated bundles, and inventory/backorder scenarios
- tests: focused unit, contract, route, SQLite integration, React integration, and accessibility coverage; broad E2E coverage reserved for course
- completed expansion records: `plans/powder_shop_catalog_expansion_plan.md`, `plans/inventory_coding_plan.md`, `plans/old/returns_and_refunds_coding_plan.md`, `plans/old/order_history_and_lifecycle_coding_plan.md`, `plans/old/review_depth_coding_plan.md`

## Hard Constraints

- Windows and macOS support
- Node.js-only toolchain
- no Docker
- no required account, API key, cloud service, or network after install
- clone-to-running target: about two minutes on supported machine
- single customer-facing web application
- SQLite remains default local database
- integer minor units for money; backend authoritative
- deterministic reset and seed
- production code standards apply despite demo-only runtime
- modern desktop UI at `1920x1080`, `1920x1200`, `3840x2160`
- preserve course behavior: frontend five-item promo gate in `cartValidation.ts`; backend promotion rules; `SAVE10` remains 10% with five-item minimum (under pack-quantity ordering, "item" = one pack/pallet unit in the cart)

## Growth Strategy

Grow through depth behind familiar store actions. Prefer modular monolith until distributed behavior serves named demo.

Domain package shape:

```text
packages/
  catalog/
  pricing/
  promotions/
  inventory/
  checkout/
  orders/
  payments/
  shipping/
  returns/
  reviews/
  notifications/
  identity/
```

Each domain may contain:

- models and contracts
- business rules
- commands and queries
- validation and error definitions
- persistence adapters
- domain events
- focused test helpers
- basic unit tests for critical pure rules
- basic SQLite integration tests for persistence and transactions

Build vertical slices:

`database -> domain -> API -> UI -> critical unit or SQLite integration test`

Avoid empty scaffolding, copied framework internals, vendored projects, generated-code padding, duplicate abstractions.

## Future Expansion Order

Status: delivery order for remaining work. `partial` = implemented subset; `future` = listed capability not delivered.

Precursor: B2B rebrand pass (`plans/b2b_materials_exchange_rebrand_handoff.md` -> coding plan) precedes all items below. It lands brand/copy rebrand, pack/pallet unit model, `£/tonne` display, and the MOQ + qty-break tier engine; item 5's baseline shifts accordingly.

1. Order history and lifecycle: completed
2. Inventory: completed
3. Returns and refunds: completed
4. Checkout depth: future
   - foundation: validated contact, delivery address, server-authoritative totals, idempotent simulated payment
   - remaining: saved trade delivery sites, billing entity, freight lead-time windows and delivery slot booking, PO/reference number on order
   - dropped (B2B pivot): gift options; parcel/express delivery-method choice (all lots pallet freight; `deliveryClass` enum retained but seeded `freight`)
5. Pricing and promotions: partial
   - completed: percentage and fixed discounts, start/end scheduling, item/subtotal gates, global and per-user limits, reservation-safe redemption
   - baseline shift: rebrand pass replaces flat variant price with MOQ + qty-break tiers; later work builds on that engine
   - remaining: category offers, stacking, tier-boundary and MOQ edge-case depth, clearance/spot-priced lot presentation
   - dropped (B2B pivot): gift cards, loyalty points
   - rejected, do not re-add (handoff Out Of Scope): RFQ/persisted quotes, trade-account net-price tiering, login-to-see-price
6. Review depth: completed
7. Account depth: partial
   - completed: session creation, expiry, logout, password-change invalidation, profile read, password change
   - remaining: trade delivery sites (address model), session list and selective revocation, preferences, data export, account deletion
   - added (B2B): company accounts with multi-user roles (buyer, approver) and order-approval threshold workflow
8. Async behavior: future
   - remaining: local job queue, notifications, retry policy, captured webhooks, failure injection
   - added consumers (B2B): standing/repeat order scheduling; auction outbid and settlement notifications once 11 lands
9. Secondary admin: partial
   - completed: review moderation API and UI; paginated, filtered, read-only audit API
   - remaining: product, order, refund, user, and feature-flag management
   - added (B2B, after 11): lot and auction management
10. Country localisation: future
    - region profiles: USA, Europe, China; configurable catalog, stock, currency, trading hours, time zones, language, formatting, and policy text
    - behavior: region-aware availability, order validation, seeded scenarios, and deterministic time-zone boundaries
    - architecture: shared domain core -> explicit region config -> localized API and UI behavior
    - scope: localisation-ready content and boundaries only in this baseline; translation and multi-currency belong to a dedicated future plan
11. Live trading of bulk volumes: future
    - separate dedicated plan; rebrand pass only labels the surface "coming next", builds nothing

### Sequencing Guidelines

Readiness favors `partial` items with self-contained remaining slices over greenfield `future` subsystems.

Recommended order:

1. Parallel: Account depth (7) and Secondary admin (9). Both extend existing subsystems (auth/session; moderation + audit API) with additive, mostly disjoint boundaries. Assign the shared user/session domain lane (account deletion, session revocation in 7 vs. user management in 9) to a single owner to avoid conflicting edits.
2. Checkout depth (4). Highest product value; consumes the address model landed in 7. Do 7's address work first.
3. Pricing and promotions (5). Riskiest money path (stacking, rounding). Run after checkout money path is settled.
4. Then Async behavior (8), Country localisation (10), Live bulk trading (11).

Parallelization rules:

- Safe: 7 + 9 concurrently, with the shared user/session lane owned by one side only.
- Sequential dependency: 7 (delivery-site/address model) -> 4 (saved delivery sites at checkout). Not parallel. Same for 7 (company accounts, approver roles) -> 4 if order-approval thresholds gate checkout.
- Must not run in parallel: 4 and 5 both mutate the server-side total path (freight charge, tier discounts, MOQ validation, rounding); concurrent edits invite the boundary and rounding bugs flagged in the QA surface. Serialize them.
- Defer 10 until 4 and 5 stabilize the money path; it touches currency, availability, and policy across nearly everything.

## Agentic AI and QA Surface

Prefer tasks crossing several clear boundaries without changing visible product concept.

High-value scenarios:

- price changes while item remains in cart
- concurrent purchases compete for final stock
- duplicate payment submission uses idempotency key
- promotion combinations produce boundary and rounding bugs
- partial cancellation changes tax, discount, and refund totals
- webhook arrives twice or out of order
- background notification retries after transient failure
- role lacks permission for refund or moderation action
- feature flag changes checkout behavior
- migration must preserve existing seeded and user-created data
- search, order, and notification state becomes eventually consistent

## Basic Test Baseline

Purpose: protect absolute must-have rules while leaving major test-design work for course.

Unit scope:

- frontend five-item promo gate
- money and discount rounding
- promotion eligibility and discount calculation
- order transition guards
- inventory quantity and reservation rules

Integration scope:

- isolated temporary SQLite database
- schema creation and guarded migrations
- repository create/read/update flows for critical domains
- order/payment/inventory transaction commit and rollback
- deterministic reset and seed counts

Integration boundary:

`domain service -> SQLite adapter -> temporary database`

Excluded from minimum baseline; scoped vertical slices may add focused coverage when risk requires:

- HTTP route tests
- API tests through Fastify injection, `fetch`, or other client
- E2E tests
- Playwright
- browser automation
- contract tests
- visual regression tests
- accessibility automation
- property-based tests
- load or performance tests
- broad coverage target

Keep suite focused, stable, fast, and obvious. Test only critical happy paths, invariants, and one or two high-risk failures per selected rule. Course owns expansion into full testing strategy.

## LOC Target

Target: 150k+ meaningful authored LOC. Report production and test LOC separately.

Suggested allocation:

- customer React application: 40k-45k
- API and domain implementations: 65k-75k
- shared contracts and infrastructure: 20k-25k
- basic unit and SQLite integration tests: 4k-6k
- seed scenarios and developer tooling: 15k-20k

Count:

- authored TypeScript, TSX, CSS, SQL, test code, migrations, developer tooling

Exclude:

- `node_modules`
- lockfiles
- build output
- coverage output
- generated clients
- snapshots
- vendored code
- downloaded assets

## Product Image Strategy

Rule: database product does not imply unique committed image.

Use deterministic powder-bag artwork generated from checked-in catalog visual tokens:

- image-set IDs, one per canonical powder product
- thumbnail, card, and detail WebP renditions generated locally
- product variants may share the parent bag art when appearance does not change
- no source photos, remote CDN, or private asset inputs

Stored asset format:

- thumbnail: WebP, 320px
- card: WebP, 720px
- detail: WebP, 1200px
- immutable hashed filenames and a checked-in manifest

Catalog artwork uses standing bags with a readable product label, category color band, batch code, and controlled powder-color variation. UI badges and layout remain separate from product art.

Data relation:

`product -> imageSetId -> shared image paths`

Fallback: unknown or corrupt image records receive deterministic local SVG; normal catalog records use manifest-backed WebP.

Asset budget:

- built-in product assets stay within repository asset checks
- card and detail use role-specific local renditions

Avoid:

- external or private source-photo setup
- missing manifest entries for canonical powder products
- committed PNG or large JPEG originals
- Git LFS in default student flow
- remote CDN dependency for required product rendering
- unstable third-party image URLs

Fallback behavior:

- missing image -> deterministic local SVG
- offline use -> complete visual journey remains available
- no broken layout or network request

## Delivery Principles

- each expansion adds working customer value or named QA scenario
- keep main journey obvious without documentation
- prefer domain correctness over architecture theater
- preserve one-command startup
- keep fake integrations local and controllable
- seed edge cases intentionally and document credentials or triggers in human README
- validate clean setup before release
