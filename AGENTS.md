# QArefully Materials Exchange

Local, non-live B2B bulk-materials shop. Demo repo for QA AI engineering lessons. All external effects (payment gateway, webhooks, mail, jobs) simulated in-process; no network services, no API keys.

## Repository map

- `apps/api` -> Fastify API, SQLite persistence, all business workflows.
- `apps/web` -> React 18 + Vite storefront and admin UI.
- `packages/contracts` -> TypeBox transport schemas + public error codes, shared by api and web.
- `packages/catalog` -> canonical catalog seed data + validation.
- `packages/localisation` -> message catalogs, translate, money/date/number formatting.
- `scripts/` -> repo quality checks (`check-localisation*.mjs`, `profile-tests.mjs`).
- `plans/` -> historical handoff/coding plans for completed work; not current spec. Code wins.
- `data/shop.db` -> runtime SQLite DB, gitignored, created by seed. Path override: `SHOP_DB_PATH`.

## Runtime

- Node `>=22 <23` required (`package.json` engines). `better-sqlite3` native-compiles against active Node ABI -> wrong Node major breaks install/runtime.
- npm workspaces. Install with `npm ci`; `postinstall` builds `@shop/contracts`, `@shop/catalog`, `@shop/localisation` into `dist/`.
- Ports: web 5173, api 3001. Web dev server proxies `/api` and auth paths to api.

## Commands

- Setup/run: `npm ci`; `npm run dev` (seed + api + web); `npm run seed` (idempotent upsert of canonical data).
- Checks: `npm run typecheck`, `lint`, `format` (check; `format:fix` writes), `check:localisation` (AST guard vs hardcoded user-facing copy).
- Tests: `npm test` (packages + unit + integration) or `npm run test:packages`, `test:unit`, `test:integration`.
- Gates: `npm run smoke` (typecheck + unit + integration); `npm run verify` (full: format, localisation, typecheck, lint, tests, builds).
- Workspace-scoped: `npm run <script> -w @shop/<api|web|contracts|catalog|localisation>`, e.g. rebuild package `npm run build -w @shop/contracts`.
- DESTRUCTIVE `npm run reset` -> wipes carts, orders, payments, users, mailbox etc. in local DB, then re-seeds. Run only when user asks or task requires known state.

## Architecture

- Dependency direction: `contracts` <- `catalog`/`localisation` <- `api`; `contracts` + `localisation` <- `web`. Enforced by `eslint.config.mjs` `no-restricted-imports`:
  - packages, scripts -> never import `apps/**`
  - web -> never imports api source; talks to api only via HTTP + `@shop/contracts`
  - contracts -> never imports apps or `@shop/catalog`
- Cross-package imports use subpaths (`@shop/contracts/<domain>`, `@shop/localisation/messages/<domain>`); relative imports carry `.js` suffix.
- Packages consumed from `dist/`: after editing `packages/*/src` -> rebuild that package before api/web see change.
- Server authority: api owns validation, pricing, permissions, stock, quotes. Web validation and role guards are UX only.
- Money: integer GBP pence everywhere authoritative (persistence, settlement, refunds, receipts). Country exchange rates convert display figures only, via `@shop/localisation` formatters.
- Country: account country (`Country`, 7 supported) is identity + display context; distinct from postal `CountryCode`. Resolved server-side per request.
- Public errors: closed code list in `packages/contracts/src/publicErrors.ts`; api emits via `sendPublicError`; messages localised through `packages/localisation/src/messages/apiErrors.ts`.
- User-facing copy: never literal in app code -> message key in `packages/localisation/src/messages/<domain>.ts` + `translate`. `check:localisation` enforces.

## Cross-layer change path

New buyer feature touching all layers:
1. schema -> `packages/contracts/src/<domain>.ts` + `exports` subpath in `packages/contracts/package.json` -> rebuild contracts
2. copy -> `packages/localisation/src/messages/<domain>.ts` (+ api error text if new public error code) -> rebuild localisation
3. api -> migration (if schema) -> feature repo/rules/service -> route -> wire in `apps/api/src/app.ts`
4. web -> `apps/web/src/api/<domain>.ts` -> hook -> feature page -> route in `apps/web/src/App.tsx`
5. tests at each layer -> `npm run smoke`, then `npm run check:localisation` + `npm run lint`

## Testing

- api + packages -> `node:test` via `tsx`; web -> Vitest + Testing Library (jsdom).
- Unit vs integration split by filename: `*.integration.test.ts(x)` -> integration runner; rest -> unit. Some unit scripts list files explicitly (see nested docs).
- No Playwright/browser E2E suite exists.
- Seeded fixtures (users, products, promo codes, test cards, order scenarios) documented in `README.md`; seed code in `apps/api/src/db/*Seed*.ts`, `seed*.ts`.

## Pitfalls

- Stale package `dist/` -> api/web silently use old schemas/messages/catalog; `npm run lint` shows hundreds of `no-unsafe-*` "type cannot be resolved" errors. Fix: `npm run build -w @shop/contracts -w @shop/catalog -w @shop/localisation`.
- `.prettierignore` excludes `*.md` -> markdown never format-checked.
- Commit style mostly conventional (`test(api): ...`, `fix(web): ...`); not enforced.

# Maintenance

Update this file or closest nested AGENTS.md/CLAUDE.md when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. AGENTS.md/CLAUDE.md conflict with repository evidence -> warn user with "WARNING".

# AI Documentation and Code Comments

Write any AI documentation (AGENTS/CLAUDE.md) or code comments in terse language, for future AI agents. Facts only, minimal language. No history, dates, just core info. Don't re-tell code, say only what can't be derived from code - architecture, decisions, cross-cutting concerns. Default is no comment at all. Leave comments and edit AI docs only if needed. No duplication between code comments or any AI docs. Information lives in one place only.
