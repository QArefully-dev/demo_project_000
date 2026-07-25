# Demo Project High-Level Plan

Status: current product direction. Last refresh 2026-07-25 @ `2c08ae3` (branch `materials_exchange_refactor`).

## Direction Change

Repo originally built as B2C powder retail (`QArefully Powder Co.`, consumer browse -> bag -> checkout). Now a B2B bulk-materials wholesale portal (`QArefully Materials Exchange`) for trade buyers (shops, supermarkets) ordering by sack/pallet, sugar -> cement.

Reason: original consumer-shop idea works but B2B bulk trade is more grounded in real-world commerce -> better QA learning material. New surfaces (bulk pricing tiers, minimum order quantities, pallet/freight logistics) generate richer, more realistic agentic engineering + QA scenarios than single-unit retail.

Pivot is additive, not rewrite. Reuse catalog/pricing/inventory/checkout/orders foundations. Reframe UI + rules toward trade buyer; retain production boundaries.

Phase status: rebrand pass COMPLETE. Three passes landed and merged -> B2B rebrand, gap closure, catalog colour schemes and pigments. Current phase: expansion per `Future Expansion Order` below.

## Purpose

Local bulk-materials wholesale codebase for course exercises and large-repository harness demos. Deployment remains non-live demo; code follows production defaults.

Goals:

- immediate recognition: credible B2B wholesale portal with real-world bulk materials catalogue (sugar -> cement)
- clear domain journey: browse -> cart -> bulk checkout -> confirmation
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront foundations
- production-grade migrations, validation, authorization, transactions, error handling, and data integrity
- simulated local integrations without production deployment obligations

## Product Direction

B2B wholesale portal selling bulk materials by sack/pallet across six catalog categories: Baking & Pantry, Sports Nutrition, Drinks, Household & Cleaning, Garden & Outdoors, Trade & Creative Materials. Buyers are trade accounts (independent shops, supermarkets) reselling stock. Brand voice: industrial, confident, unrestrained. Non-food products remain clearly marked `Not for consumption`.

Core journey:

`home -> catalog -> lot detail -> cart -> bulk checkout -> payment -> confirmation -> order history`

No persisted quote object; cart-only. RFQ/persisted quotes rejected, do not re-add.

Extended familiar journeys:

- search, filter, sort, paginate
- select variant (SKU, pack/pallet size, weight, delivery class)
- bulk pricing tiers + minimum order quantity per lot
- apply promotion or trade discount
- save trade delivery sites and payment preference metadata
- track, cancel, or return order
- write verified-purchase review
- manage watchlist, trade profile, sessions, and notification preferences

Avoid visible platform complexity:

- no open seller marketplace as main concept; catalog is operator-listed
- keep logistics framing simple (pallet + freight), no standalone warehouse product
- no live trading, auctions, or bidding; rejected direction, do not re-add
- no external/live financial-market dependency
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
- implemented catalog depth: 100 products across 6 categories, typed specifications and tags, advanced filters and stable sorts, product variants with SKU/price/weight/stock, comparison, similar products, curated bundles, customer reviews with helpfulness and abuse reporting
- implemented B2B unit and pricing model: 25 kg sack purchase unit, 40 sacks = 1 t pallet, per-variant `moqSacks` floor, qty-break `TIER_LADDER` (1 t 0%, 5 t 5%, 10 t 10%, non-compounding), derived `perTonneCents` for `£/tonne` display; constants owned by `packages/contracts/src/pricing.ts`, rules by `apps/api/src/features/pricing/`
- implemented customer journey: composed product detail, comparison entry points, help and policy center
- implemented packaging artwork: web-side resolver on category + facts -> food bag, stitched kraft sack, woven PP sack, rigid HDPE keg; deterministic per-category colour schemes and pigment accents; `/bag-designs` fixture page
- implemented delivery: freight-only seeded lots with simulated freight charge at checkout; `deliveryClass` enum retains `parcel` unused
- implemented integrity: ordered migrations through `020` (legacy `sort_order < 1` variants retired, never deleted), append-only audit ledger, sanitized admin audit reads
- seed: 100 deterministic products across 6 categories (Sports Nutrition 20, Baking & Pantry 20, Drinks 15, Household & Cleaning 15, Garden & Outdoors 15, Trade & Creative Materials 15), plus users, promotions, favourites, catalog metadata, curated bundles, and inventory/backorder scenarios
- placeholder: `Custom Small Order` (`/custom-powder`) renders WIP notice; builder UI deleted, `powderizer` backend/contracts/tables intact and untouched -> scheduled for full retirement, item 11; its nav slot and colours pass to `Custom Blend`, item 16
- tests: focused unit, contract, route, SQLite integration, React integration, and accessibility coverage; broad E2E coverage reserved for course
- completed expansion records, all under `plans/old/`: `powder_shop_catalog_expansion_plan.md`, `inventory_coding_plan.md`, `returns_and_refunds_coding_plan.md`, `order_history_and_lifecycle_coding_plan.md`, `review_depth_coding_plan.md`, `materials_exchange_gap_closure_coding_plan.md`, `catalog_bag_colour_schemes_and_pigments_coding_plan.md`, `heavy_duty_sack_prototypes.html`

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
- preserve course behavior: frontend five-item promo gate in `cartValidation.ts`; backend promotion rules; `SAVE10` remains 10% with five-item minimum ("item" = one cart line unit, i.e. one 25 kg sack)

## Growth Strategy

Grow through depth behind familiar store actions. Prefer modular monolith until distributed behavior serves named demo.

Domain shape, as built: domains are directories under `apps/api/src/features/` (`catalog`, `pricing`, `promos`, `inventory`, `checkout`, `orders`, `payments`, `delivery`, `returns`, `reviews`, `auth`, `audit`, `cart`, `bundles`, `favourites`, `mailbox`, `passwordReset`, `powderizer`). Workspace packages stay limited to `contracts` (transport) and `catalog` (canonical static content). Promote a domain to its own workspace package only when a second consumer needs it; do not pre-split.

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

Precursor B2B rebrand pass: COMPLETE. Brand/copy, sack/pallet unit model, `£/tonne` display, MOQ + qty-break tier engine, heavy-duty packaging artwork all landed. All items below build on that baseline.

1. Order history and lifecycle: completed
2. Inventory: completed
3. Returns and refunds: completed
4. Checkout depth: future
   - foundation: validated contact, delivery address, server-authoritative totals, idempotent simulated payment
   - remaining: saved trade delivery sites, billing entity, freight lead-time windows and delivery slot booking, PO/reference number on order
   - dropped (B2B pivot): gift options; parcel/express delivery-method choice (all lots pallet freight; `deliveryClass` enum retained but seeded `freight`)
5. Pricing and promotions: partial
   - completed: percentage and fixed discounts, start/end scheduling, item/subtotal gates, global and per-user limits, reservation-safe redemption
   - completed: MOQ + qty-break tier engine replacing flat variant price; later work extends it, does not replace it
   - remaining: category offers, stacking (promo on top of tier discount), tier-boundary and MOQ edge-case depth, clearance/spot-priced lot presentation
   - dropped (B2B pivot): gift cards, loyalty points
   - rejected, do not re-add: RFQ/persisted quotes, trade-account net-price tiering, login-to-see-price
6. Review depth: completed
7. Account depth: partial
   - completed: session creation, expiry, logout, password-change invalidation, profile read, password change
   - remaining: trade delivery sites (address model), session list and selective revocation, preferences, data export, account deletion
   - added (B2B): company accounts with multi-user roles (buyer, approver) and order-approval threshold workflow
8. Async behavior: future
   - remaining: local job queue, notifications, retry policy, captured webhooks, failure injection
   - added consumers (B2B): standing/repeat order scheduling
9. Secondary admin: partial
   - completed: review moderation API and UI; paginated, filtered, read-only audit API
   - remaining: product, order, refund, user, and feature-flag management
   - added (B2B): lot management
10. Country localisation: future
    - region profiles: USA, Europe, China; configurable catalog, stock, currency, trading hours, time zones, language, formatting, and policy text
    - behavior: region-aware availability, order validation, seeded scenarios, and deterministic time-zone boundaries
    - architecture: shared domain core -> explicit region config -> localized API and UI behavior
    - scope: localisation-ready content and boundaries only in this baseline; translation and multi-currency belong to a dedicated future plan
11. Custom Small Order retirement: future
    - decision 2026-07-25: RETIRE. Rebuild rejected, decision closed, do not reopen
    - reason: storefront MOQ is 4 sacks (100 kg) per line and `TIER_LADDER` starts at 1 t / 0% -> sub-pallet ordering is already the default path; a feature whose value is "order small" is redundant. Full-pallet MOQ + mixed-pallet/pallet-fit alternatives rejected as over-engineered -> shop must read without explanation for a worldwide QA audience
    - legacy backend unusable regardless: `powderMixRules.ts` bag sizes 250/500/1000 g plus packaging fee -> consumer scale, irreconcilable with the 25 kg sack / `£/tonne` model
    - remaining, web: delete `features/customSmallOrder/`, routes `/custom-powder` + `/powderizer`, `customPowderItem` nav entry, `PowderMixCartLineItem`, `powderizer-*` CSS, help article/slug `custom-powder`
    - remaining, API: delete `apps/api/src/features/powderizer/**`, `apps/api/test/powderizer/**`, routes `/api/powderizer/*` + `/api/custom-powder/*`, contracts `powderizer` subpath
    - constraint: historical order lines reference mix rows -> retire `powder_mix*` tables and `demand_kind = 'powder_mix'` by ordered migration preserving data, never drop. Same retire-not-delete pattern as migration `020`
    - amendment 2026-07-25: no salvage. Delete all `powderizer` code; 16 rebuilds mixing-group compat greenfield
    - amendment 2026-07-25: `powderizer-nav-link` CSS colours are reused by 16 -> rename, do not delete. Rest of `powderizer-*` CSS still deleted
    - frees one nav slot -> consumed by 16, not 12
12. Buy Again / reorder: future
    - one action on any past order -> re-add its lines to cart. Universally recognised, no new domain concept, no explanatory copy
    - reuses orders + cart + inventory + pricing; adds no new mental model
    - core rule: partial success is normal and must be explained per line -> price moved since order, stock short, variant retired (`active = 0` rows from migration `020`), quantity no longer valid under MOQ
    - QA surface: partial add-to-cart reporting, price-drift disclosure, retired-variant substitution refusal, stock race between reorder and checkout
13. Saved Lists: future
    - named buyer lists (e.g. `Monthly restock`) -> add whole list to cart
    - extends existing `favourites` domain; absorbs Wishlist so nav item count stays flat
    - shares the multi-line add-to-cart path with 12 -> build after 12 and reuse, do not fork a second implementation
14. Quick Order: future
    - paste or type `SKU, qty` lines -> cart. Trade-counter staple; self-explanatory from the input alone
    - QA surface: unknown SKU, duplicate SKU, malformed quantity, MOQ rounding, mixed valid/invalid input in one submission
    - shares the multi-line add-to-cart path with 12
15. Back-in-stock notification: future
    - `notify me when available` on out-of-stock lots
    - one-line concept, real async behavior -> first consumer of the local job queue in 8
    - depends on 8; do not build standalone polling
16. Custom Blend: future
    - decision 2026-07-25: APPROVED. Buyer picks base lot -> adds ingredients at ratios -> one configured cart line. Value proposition = "spec the material", not "order small"
    - distinct from retired 11: anchored to an existing base lot, sold in the 25 kg sack / `£/tonne` unit model. Item 11 rejection reasons (redundant vs MOQ 4 sacks; consumer bag scale) do not transfer
    - depends on 11: greenfield build, reuses no `powderizer` code. Consumes the nav slot 11 frees
    - ingredients are references to real catalog lots, drawn from any category, gated by `mixingGroup`. Ingredients displace base material; line weight stays fixed by sack count
    - rules: ingredients total <= 50%, max 4, each >= 5%, whole percent steps; base is the remainder; blend inherits base lot MOQ
    - pricing: base `£/tonne` for full line weight plus flat blending charge per line, independent of contents. Ingredient cost not passed through; tier applies to material weight, fee sits outside -> no compounding
    - ingredients do not draw inventory (always-available blending stock); base lot draws stock normally
    - blends are non-returnable, made to order; marked at configure, checkout, and order
    - QA surface: ratio cap and floor boundaries, mixing-group incompatibility, ingredient lot sold out yet specifiable, MOQ floor on a blend line, tier boundary with non-compounding fee, blend excluded from returns while stock lines stay eligible, base lot retired while blend held in cart
    - detail: `plans/custom_additives_handoff.md`

Items 12-15 replace the retired 11. They compose as one line of work -> order -> save as list -> reorder -> notify. All funnel through the same multi-line cart-add path, so 13-15 are cheap once 12 lands. Together they set up standing/repeat orders under 8 without committing to it now. 16 sits outside that chain and takes the nav slot instead of 12; 12-15 remain reachable from order history, account, and catalog surfaces.

### Sequencing Guidelines

Readiness favors `partial` items with self-contained remaining slices over greenfield `future` subsystems.

Recommended order:

1. Parallel: Account depth (7) and Secondary admin (9). Both extend existing subsystems (auth/session; moderation + audit API) with additive, mostly disjoint boundaries. Assign the shared user/session domain lane (account deletion, session revocation in 7 vs. user management in 9) to a single owner to avoid conflicting edits.
2. Checkout depth (4). Highest product value; consumes the address model landed in 7. Do 7's address work first.
3. Pricing and promotions (5). Riskiest money path (stacking, rounding). Run after checkout money path is settled.
4. Then Async behavior (8), Country localisation (10).

Custom Small Order retirement (11) is independent of the money-path chain -> schedule any time; blocks 16 by way of both the deleted code and the freed nav slot. 11 -> 16 is a hard sequence, not parallel.

Custom Blend (16) touches line pricing (blending fee) and the cart line key -> do not run in parallel with 4 or 5. Schedule after 5, or before 4 if 16 lands first and the money path is left settled.

Reorder chain (12 -> 13 -> 14) sits outside the money path -> safe before or alongside 4 and 5. Build 12 first; 13 and 14 reuse its multi-line cart-add path. Back-in-stock (15) waits on 8.

Parallelization rules:

- Safe: 7 + 9 concurrently, with the shared user/session lane owned by one side only.
- Sequential dependency: 7 (delivery-site/address model) -> 4 (saved delivery sites at checkout). Not parallel. Same for 7 (company accounts, approver roles) -> 4 if order-approval thresholds gate checkout.
- Must not run in parallel: 4 and 5 both mutate the server-side total path (freight charge, tier discounts, MOQ validation, rounding); concurrent edits invite the boundary and rounding bugs flagged in the QA surface. Serialize them.
- Defer 10 until 4 and 5 stabilize the money path; it touches currency, availability, and policy across nearly everything.

## Agentic AI and QA Surface

Prefer tasks crossing several clear boundaries without changing visible product concept.

High-value scenarios:

- quantity crosses a qty-break tier boundary mid-cart -> per-unit and `£/tonne` figures must both move
- MOQ floor rejects a line at exactly one sack below minimum; passes at exactly minimum
- `perTonneCents` rounding drifts against line total on non-round weights
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
- MOQ floor and qty-break tier selection; `perTonneCents` derivation
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

Measured 2026-07-25 (`apps/**` + `packages/**`, `*.ts|*.tsx|*.css|*.sql`, excluding `node_modules`, `dist`, `coverage`): production ~38.3k across 303 files; test ~22.9k across 116 files; total ~61k. Roughly 40% of target -> expansion items 4-15 carry the remaining growth.

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

Current implementation: product media is rendered as deterministic in-app SVG vessel artwork, not stored raster files. The web packaging resolver maps category + product facts -> vessel + colour scheme + pigment accent:

- food bag: Baking & Pantry, Sports Nutrition, Drinks
- rigid HDPE keg: Household & Cleaning
- woven PP sack: Garden & Outdoors
- stitched kraft sack: Trade & Creative Materials

Five colour schemes per category, distributed deterministically across that category's products. Brand string on every vessel: `QAREFULLY MATERIALS EXCHANGE`. Resolution is web-side only; contract `ProductPackaging` stays unpopulated by the API.

Raster pipeline below remains the target shape if stored renditions are ever introduced; it is not currently built:

- image-set IDs, one per canonical product
- thumbnail, card, and detail WebP renditions generated locally
- product variants may share the parent vessel art when appearance does not change
- no source photos, remote CDN, or private asset inputs

Stored asset format:

- thumbnail: WebP, 320px
- card: WebP, 720px
- detail: WebP, 1200px
- immutable hashed filenames and a checked-in manifest

Every vessel carries a readable product label, category colour band, batch code, and controlled pigment variation. UI badges and layout remain separate from product art.

Data relation:

`product -> category + facts -> packaging spec -> vessel component + palette`

Unresolvable spec -> deterministic local SVG fallback; never a broken layout or network request.

Asset budget:

- built-in product assets stay within repository asset checks
- card and detail use role-specific local renditions

Avoid:

- external or private source-photo setup
- catalog products with no resolvable packaging spec
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
