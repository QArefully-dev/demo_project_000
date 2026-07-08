# Demo Companion Repo — High-Level Plan

Status: draft for approval. Detailed build plans follow once decisions below locked.

## Purpose

Single sample project students download/use in every module of Udemy course
(`pierwszy_kurs_udemy.md`). Course's primary deliverable, not bonus.

Two jobs:
1. **Now** -> small e-commerce shop, runs from one command, carries promo-code scenario
   (Module 1) + other module exercises.
2. **Later** -> grows into 100k+ LOC codebase flagship course needs. Must be
   **extendable by addition**, not rebuilt.

## Hard constraints

- Frontend + backend + local SQLite DB.
- Launches from single command, works on Mac + Windows, no Docker.
- Clone -> running in ~2 minutes (setup friction = refunds on tripwire course).

## Stack decisions

- Repo shape: **monorepo, npm workspaces** (`apps/web`, `apps/api`, `packages/*`)
  - why: grows to 100k LOC by adding domains/packages, not refactoring. npm (not pnpm/Turbo) keeps student prerequisites zero now.
- Frontend: **React + Vite + TypeScript**
  - why: Vite SPA keeps frontend/backend cleanly separate -> makes "explore dev repo, find where rule lives" narrative (Modules 7-8) richer. Next.js would blur that line.
- Backend: **Node (Fastify or Express) + TypeScript**
  - why: frontend already forces Node onto every machine -> Node backend = one runtime. Java/Python = second toolchain, fights cross-platform, kills 2-minute promise. All-TS keeps codebase coherent for agent exploration.
- Database: **SQLite via better-sqlite3** (fallback: sql.js)
  - why: what real apps use, students recognize it. Risk: native module — usually downloads prebuilt binary, but some machines fall back to compiling from source (needs C++ toolchain) -> day-one setup failure. Mitigation: verify on clean Win + Mac before shipping; sql.js (pure WASM, zero native) is documented escape hatch.
- One command: `npm install` once, then `npm run dev` -> seed-if-missing -> run api + web together (cross-platform, no bash-isms)
  - why: bulletproof single entry point.

**Teaching nuance baked into design:** 5-item promo gate enforced in **frontend**
(`cartValidation.ts`, per course script), while promo definitions / min-order / stackability
rules live in **backend**. Sets up later lesson: business rule can sit on either side, must
look in both.

## Proposed structure

```
qarefully-shop/
  apps/web/    React + Vite + TS   (checkout/cartValidation.ts = named rule file)
  apps/api/    Fastify + TS        (db/, domain rules, routes)
  packages/    shared types/utils  (primary growth area)
  tests/       (placeholders for now — no real tests yet)
    unit/
    integrations/
    e2e/
      frontend/  Playwright
      api/       Playwright
  tickets/     mock Jira markdown
  exercises/   module-01, module-05 artifacts
  reference/   answer-keys (Rules / AGENTS.md / Skills) — NOT in clean clone
  .cursor/agents/  pre-built Vision Run agent only
```

**Clean baseline vs. answer-keys:** Module 1 demands students start with no Rules / MCP /
AGENTS.md. Reference solutions live in separate `reference/` folder (simpler than git branches,
which audience's "basic Git only" assumption makes risky).

## What it must carry (course -> repo)

- Module 1: checkout page; promo field always in DOM but disabled when cart < 5 items;
  `SAVE10` = 10% + discount summary panel; deliberate messiness (`uat_03.spec.ts`, one partial
  page object); pre-built Cursor Agent.
- Module 8: second feature — shipping address zip-format validation.
- Module 9: real race condition making a test genuinely flaky.
- Mock Jira tickets, saved bad output (M1), degrading-session transcript (M5).

## Phasing

**Current focus: build the app (Phase 1 + additive Phase 3 groundwork).** Phase 2 feature work
and real Playwright tests are deferred — do not start them until explicitly requested.

1. **Phase 1 (course MVP)** — active now: auth/login, catalog, cart + 5-item gate,
   checkout + `SAVE10` + summary panel, named `cartValidation.ts`, mock tickets, exercise
   artifacts. Small.
2. **Phase 2 (deferred)**: shipping/zip validation (M8) + deliberate race condition (M9).
   Real Playwright tests added here — not before.
3. **Phase 3 (flagship growth, additive)**: orders, inventory, returns, reviews, payments,
   admin. Domain boundaries drawn now (cart / checkout / catalog / account / shipping) so
   growth stays additive.

### Completed TLDR — 2026-07-08

- Built: npm workspaces -> React/Vite web + Fastify API + SQLite + shared contracts.
- Built: catalog -> cart -> checkout -> `SAVE10` -> confirmation flow.
- Built: desktop shop UI -> catalog, cart sheet/page, checkout, confirmation, category nav, inert search/account/wishlist placeholders.
- Verified: Windows + Node 22 install/build path, lint, typecheck, format baseline, seed/reset, main browser journey at `1366x768`.
- Preserved: no tests, no deferred Phase 2 features, no clean-baseline agent/config artifacts.


**Layout must stay modern, extension-ready.** Monorepo shape chosen to later add, without
rebuilding:
- Local DB upgrade — swap/augment SQLite with "real" local DB (Postgres) for flagship.
- Kafka / event-driven — async messaging between services (order placed -> inventory ->
  notifications), introduces eventual consistency + legitimate flakiness to test.
- Multiple backend services — split monolith API into independent services under `apps/`.
- Contract tests — consumer-driven contracts (e.g. Pact) once more than one service exists,
  plus `tests/contract/` placeholder alongside unit/integration/e2e.

## Realistic-complexity menu (Phase 3)

Udemy build stays small but designed with these extensions in mind — domain boundaries,
monorepo shape, `tests/` layout above all assume this menu lands later. Not built for tripwire
course now; banked so growth stays additive. Grouped by QA skill each unlocks:

**State & async (highest teaching value)**
- Order lifecycle state machine (`created -> paid -> shipped -> delivered -> returned/refunded`)
  — best single addition: unlocks state-transition testing + illegal-transition guards, each
  transition emits Kafka event.
- Background workers / job queue (e.g. release abandoned-cart reservation after N min) — forces
  testing eventual outcomes, not synchronous responses; realistic basis for "poll vs. flaky
  sleep" lessons.

**Integration boundaries (where mocking & contract tests live)**
- Fake third-party services we control — payment gateway, email/notification sender,
  shipping-rate API. Stubbed locally with realistic failure modes (timeouts, 500s, declined
  cards). Natural home for service virtualization, contract tests, unhappy-path testing.
- Inbound webhooks (payment confirmation callback) — teaches idempotency +
  signature-verification testing.

**Money & data correctness (classic bug nurseries)**
- Decimal/rounding on prices, tax, multi-item discounts — deliberate precision traps.
- Idempotency keys on order/payment submission — makes duplicate-click + retry handling testable.
- Inventory concurrency / overselling — promote M9 race condition into real stock-decrement
  race so it's authentic, not contrived.

**Authz & config combinatorics**
- Roles / RBAC (customer / admin / support) — permission-matrix testing.
- Feature flags — environment-dependent behavior, combinatorial surface, ties into "behavior
  depends on config you have to go find."

**Boundary inputs**
- Pagination / filter / sort on catalog, CSV product import or image upload (validation + file
  handling), i18n / currency / timezone — cheap to add, rich in edge cases.

**Notifications & email (later work)**
- User-facing email + in-app notifications (order confirmation, shipping update, password
  reset) — driven off lifecycle events above. Teaches testing async side effects, template
  rendering, asserting against captured outbox / mailhog-style sink rather than live inbox.

**Lead-with three:** order state machine + fake payment gateway + inventory race — justify
Kafka, contract tests, multi-service splits respectively, rather than adding those for their
own sake.

## Decisions to approve

1. Vite SPA + separate Fastify API (recommended) vs. Next.js full-stack.
2. better-sqlite3 (realistic, small native risk) vs. sql.js (zero risk, less realistic).
3. `reference/` folder vs. git branches for clean-baseline split.
4. E-commerce theme — plain B2C storefront, or something more memorable for course?

**Noted for later:** real Playwright tests are a later pass; for now `tests/` is a placeholder.
Phase 2 feature work is a later pass too — current work is building the app (Phase 1
completion + additive Phase 3 groundwork).
