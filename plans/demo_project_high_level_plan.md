# Demo Project High-Level Plan

Status: current product direction.

## Purpose

Local QArefully Powder Co. codebase for course exercises and large-repository harness demos. Deployment remains non-live demo; code follows production defaults.

Goals:

- immediate recognition: powder shop with credible-to-impossible catalog progression
- clear domain journey: browse -> bag -> checkout -> confirmation
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront
- production-grade migrations, validation, authorization, transactions, error handling, and data integrity
- simulated local integrations without production deployment obligations

## Product Direction

QArefully Powder Co. sells powders, from pantry staples through fictional conceptual goods. Brand voice: dry, confident, precise, mildly absurd. Household, conceptual, and impossible goods remain clearly marked `Not for consumption`.

Core journey:

`home -> powder catalog -> powder detail -> cart -> checkout -> payment -> confirmation -> order history`

Extended familiar journeys:

- search, filter, sort, paginate
- select product options when an additive catalog slice introduces them
- apply promotion or gift card
- save address and payment preference metadata
- track, cancel, or return order
- write verified-purchase review
- manage wishlist, profile, sessions, and notification preferences

## Reverse Process

Powder -> original object. Customer selects eligible powder, uploads or chooses object specification, accepts quote, waits for controlled reconstruction.

- price: `reverse price = corresponding powdering-process price * 10,000`; integer minor units; no discounts, promotions, gift cards, or loyalty redemption
- special request: manual review, custom scope, extra compliance and reconstruction fee; quote required before checkout
- positioning: deliberately prohibitive; ordinary objects expensive, impossible or conceptual objects exceptionally expensive
- lead time: long and price-linked; quote shows multi-week to multi-year estimated completion window, reconstruction stages, and status updates
- examples: powder -> fireplace; powder -> Victorian townhouse; powder -> fresh air; powder -> working time machine; powder -> original moonlight from specific night
- safety: clearly fictional demo service; impossible/conceptual requests remain `Not for consumption`; approval, cancellation, refund, and delivery rules defined in future vertical slice
- scope: high-level product direction only; no reverse-process implementation, catalog eligibility matrix, or pricing engine yet

Avoid visible platform complexity:

- no seller marketplace as main concept
- no warehouse or logistics product requiring explanation
- no live trading or financial-market dependency
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
- implemented commerce: auth, catalog, cart, inventory, promotions, checkout, simulated payment, orders, favourites, account, dev mailbox
- implemented catalog depth: typed specifications and tags, advanced filters and stable sorts, comparison, similar products, curated bundles, customer reviews
- implemented customer journey: composed product detail, comparison entry points, help and policy center, Powderizer custom mixes and history
- implemented integrity: ordered migrations, append-only audit ledger, sanitized admin audit reads
- seed: 50 deterministic powder products across 7 categories, plus users, promotions, favourites, catalog metadata, curated bundles, and inventory/backorder scenarios
- tests: focused unit, contract, route, SQLite integration, React integration, and accessibility coverage; broad E2E coverage reserved for course
- completed expansion record: `plans/powder_shop_catalog_expansion_plan.md`

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
- preserve course behavior: frontend five-item promo gate in `cartValidation.ts`; backend promotion rules; `SAVE10` remains 10% with five-item minimum

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

## Completed Catalog Expansion

Implementation record: `plans/powder_shop_catalog_expansion_plan.md`.

Delivered:

- structured powder specifications, normalized tags, advanced filtering, stable sorting
- anonymous ordered comparison with catalog and product-detail entry points
- deterministic similar products
- curated bundles with current-price totals and atomic cart addition
- authenticated customer reviews, verified-purchase evidence, moderation, rating summaries
- append-only audit ledger across auth, cart, order, payment, bundle, review mutations
- typed help and policy center with product-context links
- resilient product-detail composition; secondary section failure preserves core purchase flow

Preserved:

- QArefully Powder Co. identity, safety messaging, deterministic local runtime
- backend authority for price, stock, purchase evidence, review ownership, audit records
- Powderizer contracts, pricing, stock rules, snapshots, history compatibility

## Future Expansion Order

Status: delivery order for remaining work. `partial` = implemented subset; `future` = listed capability not delivered.

1. Order history and lifecycle: completed
   - foundation: order creation, immutable product and Powderizer snapshots, direct order-detail read
   - remaining: customer order list; processing -> packed -> shipped -> delivered; cancellation, split shipment, delivery failure, tracking events
2. Inventory: completed
   - implementation record: `plans/inventory_coding_plan.md`
   - delivered: unified ordinary-product and Powderizer component availability authority; checkout-time 15-minute reservations; atomic authorization and consumption; concurrent oversell protection; expiry release; product-line allocation records; opted-in backorders; idempotent admin stock receipts with FIFO backorder allocation; cancellation stock restoration for unshipped ordinary lines; customer availability and backorder presentation
3. Returns and refunds: future
   - remaining: return windows, partial quantities, refund rules, stock restoration
4. Checkout depth: future
   - foundation: validated contact, shipping address, server quote, idempotent simulated payment
   - remaining: saved addresses, billing address, delivery methods, estimates, gift options
5. Pricing and promotions: partial
   - completed: percentage and fixed discounts, start/end scheduling, item/subtotal gates, global and per-user limits, reservation-safe redemption
   - remaining: category offers, stacking, gift cards, loyalty points, sales presentation
6. Review depth: partial
   - completed: admin-only hide/restore endpoints, published-only summaries and star distributions
   - remaining: moderation UI and queues, helpful votes, abuse controls, aggregate persistence
7. Account depth: partial
   - completed: session creation, expiry, logout, password-change invalidation, profile read, password change
   - remaining: addresses, session list and selective revocation, preferences, data export, account deletion
8. Async behavior: future
   - remaining: local job queue, notifications, retry policy, captured webhooks, failure injection
9. Secondary admin: partial
   - completed: admin review-moderation API; paginated, filtered, read-only audit API
   - remaining: admin UI; product, order, refund, review, user, feature-flag management
10. Reverse Process: future
   - powder -> original object reconstruction; eligible-powder selection, object specification, controlled reconstruction order, staged status updates
   - pricing: corresponding powdering-process price * 10,000; integer minor units; no discount, promotion, gift-card, or loyalty redemption
   - special requests: manual review, bespoke scope, additional fee, quote acceptance before checkout
   - fulfilment: price-linked multi-week to multi-year wait; cancellation, refund, approval, and delivery rules
   - seed examples: powder -> fireplace; Victorian townhouse; fresh air; working time machine; original moonlight from specified night

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

- 45 stable image-set IDs, one per canonical powder product
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

Example:

```ts
{
  name: "Powdered Water",
  imageSetId: "powdered-water"
}
```

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
