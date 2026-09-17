# AGENTS.md

QArefully Materials Exchange — a wholesale materials shop demo (Fastify API + React web) used for QA/engineering exercises. Full product description, seeded data, and scripts: [README.md](README.md).

## Workspace layout

npm workspaces monorepo: `apps/api`, `apps/web`, `packages/contracts`, `packages/catalog`, `packages/localisation`. Dependencies flow one way and are **enforced by ESLint** (`no-restricted-imports` in [eslint.config.mjs](eslint.config.mjs)):

- `packages/*` and `scripts/*` must never import `apps/**`.
- `apps/web` must never import `apps/api` source — only `@shop/contracts`.
- `packages/contracts` must never import `@shop/catalog`.

**Packages are consumed via their built `dist` output**, not `src` (`exports`/`main` point at `./dist`). Editing `packages/contracts`, `packages/catalog`, or `packages/localisation` source has no effect on the apps until you rebuild: `npm run build -w @shop/<pkg>` (or rerun the root `postinstall`, which builds all three).

## Commands

Run from repo root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Seed DB, start API (3001) + web (5173) together |
| `npm run reset` | Wipe and reseed the SQLite DB to the documented known state |
| `npm run typecheck` / `npm run lint` / `npm run format` | Per-workspace TS, ESLint, Prettier checks |
| `npm run test:unit` / `npm run test:integration` | Unit vs. integration suites for web + api |
| `npm run check:localisation` | AST guard against hard-coded user-facing strings (see below) |
| `npm run verify` | Full gate: format → check:localisation → typecheck → lint → test → build all — run this before calling a change done |
| `npm run test:e2e` / `npm run test:e2e:ui` | Playwright specs in `e2e/` (not part of `verify`) |

There is no CI workflow in this repo — `npm run verify` is the canonical "everything passes" check.

## API (`apps/api`)

- Feature-first: each folder under `src/features/*` typically exports `create<X>Repository` + `create<X>Service` plus typed domain errors (e.g. `OrderDomainError`). No DI framework — factories are composed by hand in [apps/api/src/app.ts](apps/api/src/app.ts).
- Persistence is raw SQL via `better-sqlite3` (no ORM). Multi-step writes go through [apps/api/src/db/unitOfWork.ts](apps/api/src/db/unitOfWork.ts) for atomicity.
- Routes (`src/routes/*.ts`, one per resource) use `@fastify/type-provider-typebox` and import request/response schemas directly from `@shop/contracts/*` — don't hand-roll duplicate schemas.
- Error convention: services throw a typed `*DomainError` with a `code`; route handlers switch on `.code` and call `sendPublicError(...)` ([apps/api/src/utils/errors.ts](apps/api/src/utils/errors.ts)), which auto-localises the message from the request's resolved country. Forbidden and not-found are deliberately returned identically (404) to avoid leaking existence.
- Checkout ([apps/api/src/features/checkout](apps/api/src/features/checkout)) is the most representative complex workflow: server-owned payment-intent with idempotency keys, card data never persisted.
- DB migrations live in [apps/api/src/db/migrations](apps/api/src/db/migrations) as sequential numbered files (`NNN_name.ts`) registered in `migrations/index.ts`; the runner enforces strict, unbroken version ordering. When adding one, append the next number, register it, and update the "Migration head is NNN" line in the README.
- Integration tests run each `*.integration.test.ts` file as a **separate child process** against a cloned seeded SQLite template (see [apps/api/test/support](apps/api/test/support)) — real DB, not mocks.

## Web (`apps/web`)

- React 18 + Vite + `react-router-dom`, routes centralized in [apps/web/src/App.tsx](apps/web/src/App.tsx). Feature-first folders under `src/features/*`.
- State via React Context (`src/hooks/*Context.tsx`), not Redux/Zustand.
- API calls go through per-resource modules in `src/api/*.ts`, typed from `@shop/contracts/*`; responses are validated at runtime with TypeBox (`Value.Check`), not just cast — follow this pattern for new endpoints.
- Styling: Tailwind v4 + shadcn (`components.json`); path alias `@/*` → `src/*`.
- Integration tests (`*.integration.test.{ts,tsx}`, separate Vitest config) run against a live API on `127.0.0.1:3001` via the Vite dev proxy — start the API before running them.

## Localisation

Never hard-code user-facing copy in API responses or web components — go through `@shop/localisation` message catalogs / `translate()`. `npm run check:localisation` statically enforces this (AST-based, with a narrow explicit allowlist) and is part of `verify`; run it whenever you touch user-visible text or error messages.

## Testing conventions & agents

- E2E specs use Playwright; conventions (page objects, no `data-testid`, web-first assertions, seeded-data constants) are documented in [e2e/README.md](e2e/README.md) — read it before adding a spec.
- To explore the running app as an agent (find a locator, check what a page renders), use the `playwright-cli` skill/CLI, **not** playwright-mcp — see [e2e/README.md](e2e/README.md) for why.
- The **Test Planner** custom agent ([.github/agents/test-planner.agent.md](.github/agents/test-planner.agent.md)) plans E2E tests for a ticket and writes a markdown plan only — it never implements tests.
