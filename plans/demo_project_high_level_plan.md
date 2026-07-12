# Demo Project High-Level Plan

Status: current product direction.

## Purpose

Single local sample project for course exercises and large-repository harness demos.

Goals:

- immediate recognition: ordinary online department store
- no domain explanation: browse -> cart -> checkout -> track or return order
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront

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
- test builders
- unit and integration tests when named course phase permits tests

Build vertical slices:

`database -> domain -> API -> UI -> automated tests`

Avoid empty scaffolding, copied framework internals, vendored projects, generated-code padding, duplicate abstractions.

## Expansion Order

1. Product variants and richer catalog
   - sizes, colors, capacities, SKUs
   - variant price and stock
   - specifications, bundles, comparisons, recently viewed
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
7. Reviews
   - verified purchases, moderation, helpful votes, rating aggregation
8. Account depth
   - addresses, sessions, preferences, data export, account deletion
9. Async behavior
   - local job queue, notifications, retry policy, captured webhooks, failure injection
10. Secondary admin
   - products, orders, refunds, reviews, users, feature flags, audit log

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

Testing growth:

- domain unit tests
- property-based pricing and promotion tests
- API integration tests
- database migration tests
- contract tests
- Playwright customer journeys
- accessibility and visual regression tests
- failure-injection and concurrency tests

Course schedule controls when test suites become visible to students.

## LOC Target

Target: 150k+ meaningful authored LOC. Report production and test LOC separately.

Suggested allocation:

- customer React application: 30k-35k
- API and domain implementations: 40k-45k
- shared contracts and infrastructure: 12k-15k
- unit and property-based tests: 25k-30k
- integration, contract, and E2E tests: 20k-25k
- seed scenarios and developer tooling: 8k-10k

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
