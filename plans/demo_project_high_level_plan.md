# Demo Project High-Level Plan

Status: current product direction.

## Purpose

Local, production-style department-store codebase for course exercises and large-repository harness demos. Deployment remains non-live demo; code follows production defaults.

Goals:

- immediate recognition: ordinary online department store
- no domain explanation: browse -> cart -> checkout -> track or return order
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront
- production-grade migrations, validation, authorization, transactions, error handling, and data integrity
- simulated local integrations without production deployment obligations

## Product Direction

General-purpose department store. Customer-facing experience remains only required product concept.

Core journey:

`home -> catalog -> product -> cart -> checkout -> payment -> confirmation -> order history`

Extended familiar journeys:

- search, filter, sort, paginate
- select product variant
- apply promotion or gift card
- save address and payment preference metadata
- track, cancel, or return order
- write verified-purchase review
- manage wishlist, profile, sessions, and notification preferences

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
- implemented: auth, catalog, search, filters, sorting, product pages, cart, promotions, checkout, simulated payment, orders, favourites, account, dev mailbox
- seed: deterministic products, users, promotions, favourites
- tests: focused unit and SQLite integration baseline required; broad API and E2E coverage reserved for course
- active expansion: `plans/catalog_reviews_audit_seed_content_implementation_plan.md`

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

## Active Expansion

Implementation plan: `plans/catalog_reviews_audit_seed_content_implementation_plan.md`.

Scope:

- product variants, specifications, bundles, comparison
- customer reviews and verified-purchase summaries
- deterministic similar products
- price, date, name filters and stable sorting
- append-only auditing
- deterministic named seed scenarios and validation tooling
- help, policy, FAQ, shipping, returns, size-guide pages
- focused core unit and SQLite integration tests

## Expansion Order

1. Active catalog and review expansion
   - sizes, colors, capacities, SKUs
   - variant price and stock, specifications, bundles, comparisons
   - customer reviews, deterministic similar products
   - price, date, name filtering and stable sorting
   - append-only audit events, seed scenarios, customer help and policy content
2. Order history and lifecycle
   - processing -> packed -> shipped -> delivered
   - cancellation, split shipment, delivery failure, tracking events
3. Inventory
   - reservations, expiry, backorders, concurrent purchase protection
4. Returns and refunds
   - return windows, partial quantities, refund rules, stock restoration
5. Checkout depth
   - saved addresses, billing address, delivery methods, estimates, gift options
6. Pricing and promotions
   - scheduled sales, category offers, stacking, gift cards, loyalty points
7. Review depth
   - moderation workflows, helpful votes, abuse controls, aggregate maintenance
8. Account depth
   - addresses, sessions, preferences, data export, account deletion
9. Async behavior
   - local job queue, notifications, retry policy, captured webhooks, failure injection
10. Secondary admin
   - products, orders, refunds, reviews, users, feature flags, expanded audit tooling

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

Excluded:

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

Use reusable image-set library:

- target image sets: 80-150
- many products reference same `imageSetId`
- product variants share parent image set
- color or capacity variants reuse photography when difference need not be visible
- seed may create thousands of products without duplicating image files

Stored asset format:

- detail image: WebP or AVIF, 600-800px
- optional thumbnail: WebP or AVIF, 250-350px
- no committed full-resolution originals
- immutable hashed filenames when practical; avoid binary churn in Git history

Catalog mix:

- 50-80 polished images for prominent products
- 50-100 generic product or category images for long-tail reuse
- deterministic generated SVG artwork for bulk seeded products and missing assets
- UI badges, labels, gradients, and backgrounds rendered separately from product image

Data relation:

`product -> imageSetId -> shared image paths`

Example:

```ts
{
  name: "Studio Wireless Headphones X2",
  imageSetId: "headphones/studio-black"
}
```

Runtime SVG option:

`product ID + category + palette + label -> deterministic local SVG response`

Asset budget:

- built-in product assets target: 5-15 MB
- same source may serve catalog and product detail when performance remains acceptable
- optional high-resolution asset pack distributed separately from default clone

Avoid:

- one photo set per seeded SKU
- committed PNG or large JPEG originals
- Git LFS in default student flow
- remote CDN dependency for required product rendering
- unstable third-party image URLs

Fallback behavior:

- missing image -> deterministic local category SVG
- offline use -> complete visual journey remains available
- optional asset pack absent -> no broken layout or network request

## Delivery Principles

- each expansion adds working customer value or named QA scenario
- keep main journey obvious without documentation
- prefer domain correctness over architecture theater
- preserve one-command startup
- keep fake integrations local and controllable
- seed edge cases intentionally and document credentials or triggers in human README
- validate clean setup before release
