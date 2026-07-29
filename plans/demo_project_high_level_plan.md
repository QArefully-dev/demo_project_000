# Demo Project High-Level Plan

Status: current product direction. Last refresh 2026-07-28 @ `ec37390` (branch `materials_exchange_refactor`).

## Direction Change

Repo originally built as B2C powder retail (`QArefully Powder Co.`, consumer browse -> bag -> checkout). Now a B2B bulk-materials wholesale portal (`QArefully Materials Exchange`) for trade buyers (shops, supermarkets) ordering by sack/pallet, sugar -> cement.

Reason: original consumer-shop idea works but B2B bulk trade is more grounded in real-world commerce -> better QA learning material. New surfaces (bulk pricing tiers, minimum order quantities, pallet/freight logistics) generate richer, more realistic agentic engineering + QA scenarios than single-unit retail.

Pivot is additive, not rewrite. Reuse catalog/pricing/inventory/checkout/orders foundations. Reframe UI + rules toward trade buyer; retain production boundaries.

Phase status: rebrand pass COMPLETE. Three passes landed and merged -> B2B rebrand, gap closure, catalog colour schemes and pigments. Expansion items landed since the pivot: Custom Blend (16), Checkout depth (4), Pricing and promotions (5). Current phase: expansion per `Future Expansion Order` below.

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
- configure a custom blend on a base lot -> one cart line
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
- implemented B2B unit and pricing model: 25 kg sack purchase unit, 40 sacks = 1 t pallet, per-variant `moqSacks` floor, qty-break `TIER_LADDER` (1 t 0%, 5 t 5%, 10 t 10%, non-compounding), derived `perTonneCents` for `£/tonne` display; active clearance windows replace list-price base before tier calculation; cart and product views disclose next tier and MOQ shortfall; constants owned by `packages/contracts/src/pricing.ts`, rules by `apps/api/src/features/pricing/`
- implemented pricing and promotions: category-scoped promotion eligibility and discount bases, `CATEGORY_MISMATCH`, clearance -> tier -> promo stacking over material only, and persisted V8 checkout/order snapshots carrying promo scope and discount base; freight, booked delivery slots, and Custom Blend fees remain outside discount calculations
- implemented Custom Blend: `/custom-blend` configurator -> base lot plus 1-4 catalog-lot ingredients at whole-percent ratios (each 5-50%, total <= 50%, base is remainder), `mixingGroup` compatibility gate, `configKey` blend identity on cart and order lines, flat `CUSTOM_BLEND_FEE_CENTS` per line outside the tier-discountable subtotal, ingredients drawing no inventory, blend lines excluded from returns while cancellation stays unchanged
- implemented customer journey: composed product detail, comparison entry points, help and policy center
- implemented packaging artwork: web-side resolver on category + facts -> food bag, stitched kraft sack, woven PP sack, rigid HDPE keg; deterministic per-category colour schemes and pigment accents; `/bag-designs` fixture page
- implemented delivery: freight-only seeded lots with simulated freight charge at checkout; `deliveryClass` enum retains `parcel` unused; freight lead-time calculation and bookable delivery slots (`apps/api/src/features/delivery/`)
- implemented trade accounts: saved delivery sites and billing entities with shared address normalisation and defaults (`apps/api/src/features/tradeAccount/`, `apps/web/src/features/account/`), consumed at checkout alongside a buyer PO/reference number recorded on the order
- implemented integrity: ordered migrations through `024` (`sort_order < 1` variants retired in `020`; obsolete Custom Small Order schema physically removed in `021`; custom blend tables plus cart/order line rebuild in `022`; trade delivery sites, billing entities, and order delivery/billing detail in `023`; clearance, scoped promo, and order discount-base columns in `024`), append-only audit ledger, sanitized admin audit reads
- seed: 100 deterministic products across 6 categories (Sports Nutrition 20, Baking & Pantry 20, Drinks 15, Household & Cleaning 15, Garden & Outdoors 15, Trade & Creative Materials 15), each carrying a nullable `mixingGroup` from a fixed set of eight (`food-grade`, `cleaning`, `garden-treatment`, `cementitious-materials`, `casting-materials`, `pigments`, `theatrical-effects`, `absorbents`) validated in `packages/catalog`, plus users, promotions including `GARDEN10` and `CLEANFIVE`, active/expired/future clearance fixtures, favourites, catalog metadata, curated bundles, and inventory/backorder scenarios
- tests: focused unit, contract, route, SQLite integration, React integration, and accessibility coverage; broad E2E coverage reserved for course
- completed expansion records under `plans/old/`: `powder_shop_catalog_expansion_plan.md`, `inventory_coding_plan.md`, `returns_and_refunds_coding_plan.md`, `order_history_and_lifecycle_coding_plan.md`, `review_depth_coding_plan.md`, `materials_exchange_gap_closure_coding_plan.md`, `catalog_bag_colour_schemes_and_pigments_coding_plan.md`, `powderizer_removal_coding_plan.md`, `heavy_duty_sack_prototypes.html`
- completed plan records for Custom Blend (16) and Checkout depth (4) are no longer on disk; implementation truth is the code, migrations `022`-`023`, and commits `f63e9bf` / `b1957ba`

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

Domain shape, as built: domains are directories under `apps/api/src/features/` (`catalog`, `pricing`, `promos`, `inventory`, `checkout`, `orders`, `payments`, `delivery`, `returns`, `reviews`, `auth`, `audit`, `cart`, `bundles`, `favourites`, `mailbox`, `passwordReset`, `customBlend`). Workspace packages stay limited to `contracts` (transport) and `catalog` (canonical static content). Promote a domain to its own workspace package only when a second consumer needs it; do not pre-split.

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
4. Checkout depth: completed
   - landed 2026-07-28 (`b1957ba`), merged `ec37390`
   - foundation: validated contact, delivery address, server-authoritative totals, idempotent simulated payment
   - delivered: saved trade delivery sites and billing entities (`apps/api/src/features/tradeAccount/`, account UI sections, shared address normalisation in `packages/contracts/src/address.ts`), freight lead-time calculation plus bookable delivery slot selection (`features/delivery/deliverySlotRules.ts`, `routes/deliverySlots.ts`), PO/reference number captured at checkout and surfaced on order history/detail
   - schema: migration `023` adds trade delivery sites, billing entities, and order delivery/billing columns
   - dropped (B2B pivot): gift options; parcel/express delivery-method choice (all lots pallet freight; `deliveryClass` enum retained but seeded `freight`)
   - QA surface, live: lead-time boundary vs slot cutoff, slot no longer bookable between quote and payment, address normalisation and default-site selection, PO reference validation, idempotent payment replay carrying delivery/billing detail
5. Pricing and promotions: delivered slices
   - completed: percentage and fixed discounts, start/end scheduling, item/subtotal gates, global and per-user limits, reservation-safe redemption
   - completed: MOQ + qty-break tier engine replacing flat variant price; exact-boundary, rounding, next-tier-progress, and MOQ-shortfall coverage
   - completed: active clearance windows feed list-price replacement -> tier -> promo; catalog, product, cart, checkout, persisted V8 quotes, and orders use server-resolved pricing
   - completed: category-scoped promo codes calculate gates and discounts on matching material lines only; `CATEGORY_MISMATCH`, eligible subtotal, scope, and discount base are surfaced through checkout and orders
   - completed: discountable subtotal split, so the Custom Blend fee (16) is excluded from promo and tier maths; freight remains outside promo discounts
   - remaining: promotion/clearance administration UI belongs to Secondary admin (9); multiple promotion codes, automatic category offers, RFQ/persisted quotes, trade-account net pricing, and login-to-see-price remain out of scope
   - dropped (B2B pivot): gift cards, loyalty points
   - rejected, do not re-add: RFQ/persisted quotes, trade-account net-price tiering, login-to-see-price
6. Review depth: completed
7. Account depth: partial
   - completed: session creation, expiry, logout, password-change invalidation, profile read, password change
   - completed via 4: trade delivery sites + billing entities (address model, account UI)
   - remaining: session list and selective revocation, preferences, data export, account deletion
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
11. Custom Small Order retirement: completed
    - decision closed: consumer-scale custom ordering conflicted with the 25 kg sack / `£/tonne` model and was redundant beside the 4-sack MOQ
    - removed end-to-end: UI, routes, API, contracts, tests, help content, and obsolete styling
    - migration `021` physically removes obsolete schema. Earlier migrations remain immutable history; local SQLite is disposable
    - frees one nav slot for 16; retained `.custom-blend-nav-link` CSS is reserved for its greenfield UI
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
16. Custom Blend: completed
    - decision 2026-07-25 APPROVED, landed 2026-07-26. Buyer picks base lot -> adds ingredients at ratios -> one configured cart line. Value proposition = "spec the material", not "order small"
    - distinct from retired 11: anchored to an existing base lot, sold in the 25 kg sack / `£/tonne` unit model. Item 11 rejection reasons (redundant vs MOQ 4 sacks; consumer bag scale) do not transfer
    - built greenfield after 11. Reuses no retired code; took the freed nav slot and the preserved `.custom-blend-nav-link` treatment, now live on the `Custom Blend` nav entry
    - ingredients are references to real catalog lots, drawn from any category, gated by `mixingGroup`. Ingredients displace base material; line weight stays fixed by sack count
    - rules as built: 1-4 ingredients, each 5-50%, total <= 50%, whole percent steps; base is the remainder; blend inherits base lot MOQ
    - pricing as built: base `£/tonne` for full line weight plus flat `CUSTOM_BLEND_FEE_CENTS` per line, independent of contents. Ingredient cost not passed through; tier applies to the material subtotal, fee sits outside the discountable subtotal -> no compounding, and promotions never discount the fee
    - ingredients draw no inventory (always-available blending stock); base lot draws stock normally
    - blends are non-returnable, made to order; marked at configure, cart, checkout, and order. Cancellation terms unchanged
    - line identity: canonical ingredient ordering -> hashed `configKey` distinguishes blend lines from stock lines and from each other; shared by web (`lib/cartLineIdentity.ts`) and API
    - schema: migration `022` adds custom blend tables and rebuilds cart/order line items to carry blend identity and fee
    - QA surface, live: ratio cap and floor boundaries, mixing-group incompatibility, ingredient lot sold out yet specifiable, MOQ floor on a blend line, tier boundary with non-compounding fee, blend excluded from returns while stock lines stay eligible, base lot retired while blend held in cart
    - records: `plans/custom_blend_coding_plan.md` (implementation), `plans/custom_additives_handoff.md` (product input)

Items 12-15 replace the retired 11. They compose as one line of work -> order -> save as list -> reorder -> notify. All funnel through the same multi-line cart-add path, so 13-15 are cheap once 12 lands. Together they set up standing/repeat orders under 8 without committing to it now. 16 sat outside that chain and has consumed the nav slot; 12-15 remain reachable from order history, account, and catalog surfaces without new nav entries.

Landed 16 constrains later work: cart and order lines now key on variant plus `configKey`, and line totals separate a discountable material subtotal from a non-discountable blending fee. Items 5 and 12-14 must respect both -> multi-line cart-add paths carry blend identity, and promotion/tier maths applies to the material subtotal only. 4 already respects both.

Landed 4 constrains later work: checkout now resolves a delivery site, billing entity, delivery slot, and PO reference before payment. Items 5, 8, and 12 must carry that context -> total recalculation keeps the freight charge and slot selection intact, reorder (12) re-enters checkout without assuming a bare address form, and any scheduling in 8 reuses the lead-time rules rather than forking them.

### Sequencing Guidelines

Readiness favors `partial` items with self-contained remaining slices over greenfield `future` subsystems.

Recommended order:

1. Pricing and promotions (5). Riskiest money path (stacking, rounding); checkout money path is now settled by landed 4, so this is next.
2. Parallel: Account depth (7, remaining session/preferences/export/deletion slices) and Secondary admin (9). Both extend existing subsystems (auth/session; moderation + audit API) with additive, mostly disjoint boundaries. Assign the shared user/session domain lane (account deletion, session revocation in 7 vs. user management in 9) to a single owner to avoid conflicting edits.
3. Then Async behavior (8), Country localisation (10).

Custom Small Order retirement (11), Custom Blend (16), and Checkout depth (4) are complete. 16 landed before 4, taking 11's freed nav slot and Custom Blend CSS; 4 then landed on the settled money path.

Reorder chain (12 -> 13 -> 14) sits outside the money path -> safe before or alongside 5. Build 12 first; 13 and 14 reuse its multi-line cart-add path. Back-in-stock (15) waits on 8.

Parallelization rules:

- Safe: 7 + 9 concurrently, with the shared user/session lane owned by one side only.
- Resolved: 4 landed the delivery-site/address model itself rather than consuming it from 7. Remaining 7 work no longer blocks anything in 4. Company accounts + approver roles (7) still gate any later order-approval threshold at checkout.
- Resolved: 4 and 5 were serialized on the server-side total path (freight charge, tier discounts, MOQ validation, blending-fee exclusion, rounding). 4 is landed, so 5 now owns that path alone; no other in-flight item may mutate it concurrently.
- Defer 10 until 4 and 5 stabilize the money path; it touches currency, availability, and policy across nearly everything.

## Agentic AI and QA Surface

Prefer tasks crossing several clear boundaries without changing visible product concept.

High-value scenarios:

- quantity crosses a qty-break tier boundary mid-cart -> per-unit and `£/tonne` figures must both move
- MOQ floor rejects a line at exactly one sack below minimum; passes at exactly minimum
- `perTonneCents` rounding drifts against line total on non-round weights
- blend ratios sit exactly at a boundary (one ingredient at 50%, four at 5%, total at 51%)
- promotion or tier discount leaks onto the non-discountable blending fee
- two cart lines share a base lot but differ by one ingredient percent -> must stay separate `configKey` lines
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
- blend ratio validation, canonical `configKey` derivation, and blending-fee exclusion from the discountable subtotal
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

Measured 2026-07-28 @ `ec37390` (tracked `apps/**` + `packages/**`, `*.ts|*.tsx|*.css|*.sql`, excluding `node_modules`, `dist`, `coverage`): production ~47.2k across 332 files; test ~32.5k across 144 files; total ~79.7k. Roughly 53% of target -> expansion items 5, 7-10, and 12-15 carry remaining growth.

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

Custom Blend (16) is the one exception to per-category colour resolution: blends print a single fixed charcoal livery with a `CUSTOM BLEND` spec band, reusing the base lot's vessel shape. Deliberate — composition must not be readable from the packaging, so no ingredient, percentage, or mixing group may reach a colour.

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
