# Demo Companion Repo — High-Level Plan

Status: draft for approval. Detailed build plans follow once decisions below are locked.

## Purpose

The single sample project students download and use in every module of the Udemy course
(`pierwszy_kurs_udemy.md`). It is **the course's primary deliverable**, not a bonus.

Two jobs:
1. **Now** — small e-commerce shop that runs from one command, carries the promo-code scenario
   (Module 1) and the other module exercises.
2. **Later** — grows naturally into the 100k+ LOC codebase the flagship course needs. So it must
   be **extendable by addition**, not rebuilt.

## Hard constraints

- Frontend + backend + local SQLite DB.
- Launches from a **single command**, works on **Mac and Windows**, **no Docker**.
- Clone → running in **~2 minutes** (setup friction = refunds on a tripwire course).

## Stack decisions (and why)

| Choice | Decision | Why |
| --- | --- | --- |
| Repo shape | **Monorepo, npm workspaces** (`apps/web`, `apps/api`, `packages/*`) | Grows to 100k LOC by adding domains/packages, not refactoring. npm (not pnpm/Turbo) keeps student prerequisites at zero now. |
| Frontend | **React + Vite + TypeScript** | Vite SPA keeps frontend and backend cleanly **separate** — which makes the "explore the dev repo, find where the rule lives" narrative (Modules 7-8) richer. Next.js would blur that line. |
| Backend | **Node (Fastify or Express) + TypeScript** | The frontend already forces Node onto every machine, so a Node backend = **one runtime**. Java/Python would mean a second toolchain to install and fight cross-platform — kills the 2-minute promise. All-TS also keeps the codebase coherent for the agent to explore. |
| Database | **SQLite via better-sqlite3** (fallback: sql.js) | What real apps use; students recognize it. Risk: it's a native module — usually downloads a prebuilt binary, but on some machines falls back to compiling from source (needs a C++ toolchain) and that's where day-one setup fails. **Mitigation:** verify on clean Win + Mac before shipping; sql.js (pure WASM, zero native) is the documented escape hatch. |
| One command | `npm install` once, then `npm run dev` → seed-if-missing → run api + web together (cross-platform, no bash-isms) | Bulletproof single entry point. |

**Teaching nuance baked into the design:** the 5-item promo gate is enforced in the **frontend**
(`cartValidation.ts`, as the course script requires), while promo definitions / min-order /
stackability rules live in the **backend**. This sets up the later lesson that a business rule can
sit on either side — you have to look in both.

## Proposed structure

```
qarefully-shop/
  apps/web/    React + Vite + TS   (checkout/cartValidation.ts = the named rule file)
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
  reference/   answer-keys (Rules / AGENTS.md / Skills) — NOT in the clean clone
  .cursor/agents/  pre-built Vision Run agent only
```

**Clean baseline vs. answer-keys:** Module 1 demands students start with *no* Rules / MCP /
AGENTS.md. Reference solutions therefore live in a separate `reference/` folder (simpler than
git branches, which the audience's "basic Git only" assumption makes risky).

## What it must carry (course → repo)

- **Module 1:** checkout page; promo field always in DOM but disabled when cart < 5 items;
  `SAVE10` = 10% + discount summary panel; deliberate messiness (`uat_03.spec.ts`, one partial
  page object); pre-built Cursor Agent.
- **Module 8:** second feature — shipping address zip-format validation.
- **Module 9:** a real race condition that makes a test genuinely flaky.
- Mock Jira tickets, saved bad output (M1), degrading-session transcript (M5).

## Phasing

1. **Phase 1 (course MVP):** auth/login, catalog, cart + 5-item gate, checkout + `SAVE10` +
   summary panel, the named `cartValidation.ts`, mock tickets, exercise artifacts. Small.
2. **Phase 2:** shipping/zip validation (M8) + deliberate race condition (M9). Real Playwright
   tests added here.
3. **Phase 3 (flagship growth):** additive domains — orders, inventory, returns, reviews,
   payments, admin. Draw domain boundaries now (cart / checkout / catalog / account / shipping)
   so growth stays additive.

### Phase 1 implementation TL;DR — 2026-07-08

Status: implementation remediation complete; final verification matrix incomplete.

- Built: npm-workspaces monorepo; React/Vite storefront; Fastify API; SQLite; shared TypeBox contracts.
- Built: canonical 8-product Electronics catalog with local images, deterministic seed convergence, reset path.
- Built: server-held cart with persisted browser ID, shared initialization/recovery, add/update/remove, backend-authoritative totals.
- Built: `SAVE10` eligibility at 5+ total items, invalid-code feedback, server quote, quote invalidation after cart mutation, transactional order persistence, confirmation, fresh cart after checkout.
- Built: polished desktop catalog/cart/checkout/confirmation journey, labeled fields, action/recovery feedback, loading/empty states.
- Built: cross-platform install lifecycle; API on `127.0.0.1:3001`; web on `127.0.0.1:5173`; Node `>=22.0.0 <23.0.0`; README verified against clean Windows copy.
- Verified on Windows + Node 22: clean `npm ci`/`npm install`, lint, typecheck, format, workspace builds, seed/reset, primary browser journey at `1366x768`.
- Scope preserved: no tests, test tooling, deferred Phase 2 features, Cursor Rules, MCP config, `AGENTS.md`, or clean-baseline agent artifacts added.
- Remaining gates: macOS + Node 22; isolated `npm run dev` startup and PowerShell/Command Prompt shutdown; browser journey at `3840x2160`; post-fix browser-console check; current-build runtime check for add-path missing-cart vs missing-product errors; final StrictMode/cart-recovery verification.
- Completion rule: do not mark Phase 1 complete until remaining platform/runtime/browser evidence passes.

**Layout must stay modern and extension-ready.** The monorepo shape is chosen so we can later add,
without rebuilding:
- **Local DB upgrade** — swap/augment SQLite with a "real" local DB (Postgres) for the flagship.
- **Kafka / event-driven** — async messaging between services (order placed → inventory →
  notifications), which introduces eventual consistency and *legitimate* flakiness to test.
- **Multiple backend services** — split the monolith API into independent services under `apps/`.
- **Contract tests** — consumer-driven contracts (e.g. Pact) once more than one service exists,
  plus a `tests/contract/` placeholder alongside unit/integration/e2e.

## Realistic-complexity menu (Phase 3)

The Udemy build stays **small but designed with these extensions in mind** — domain boundaries,
the monorepo shape, and the `tests/` layout above all assume this menu will land later. Don't build
these for the tripwire course; bank them so growth stays additive. Grouped by the QA skill each
unlocks:

**State & async (highest teaching value)**
- **Order lifecycle state machine** (`created → paid → shipped → delivered → returned/refunded`) —
  the best single addition: unlocks state-transition testing and illegal-transition guards, and
  each transition emits a Kafka event.
- **Background workers / job queue** (e.g. release abandoned-cart reservation after N min) — forces
  testing *eventual* outcomes, not synchronous responses; the realistic basis for "poll vs. flaky
  sleep" lessons.

**Integration boundaries (where mocking & contract tests live)**
- **Fake third-party services we control** — payment gateway, email/notification sender,
  shipping-rate API. Stubbed locally with realistic failure modes (timeouts, 500s, declined cards).
  Natural home for service virtualization, contract tests, and unhappy-path testing.
- **Inbound webhooks** (payment confirmation callback) — teaches idempotency and
  signature-verification testing.

**Money & data correctness (classic bug nurseries)**
- **Decimal/rounding** on prices, tax, multi-item discounts — deliberate precision traps.
- **Idempotency keys** on order/payment submission — makes duplicate-click and retry handling
  testable.
- **Inventory concurrency / overselling** — promote the M9 race condition into a real
  stock-decrement race so it's authentic, not contrived.

**Authz & config combinatorics**
- **Roles / RBAC** (customer / admin / support) — permission-matrix testing.
- **Feature flags** — environment-dependent behavior, combinatorial surface, and a tie-in to
  "behavior depends on config you have to go find."

**Boundary inputs**
- Pagination / filter / sort on catalog, CSV product import or image upload (validation + file
  handling), and i18n / currency / timezone — cheap to add, rich in edge cases.

**Notifications & email (later work)**
- User-facing **email and in-app notifications** (order confirmation, shipping update, password
  reset) — driven off the lifecycle events above. Teaches testing async side effects, template
  rendering, and asserting against a captured outbox / mailhog-style sink rather than a live inbox.

**Lead-with three:** order state machine + fake payment gateway + inventory race — because they
justify Kafka, contract tests, and multi-service splits respectively, rather than adding those for
their own sake.

## Decisions to approve

1. Vite SPA + separate Fastify API (recommended) **vs.** Next.js full-stack.
2. better-sqlite3 (realistic, small native risk) **vs.** sql.js (zero risk, less realistic).
3. `reference/` folder **vs.** git branches for the clean-baseline split.
4. E-commerce theme — plain B2C storefront, or something more memorable for the course?

**Noted for later:** real Playwright tests are a later pass; for now `tests/` is a placeholder.
