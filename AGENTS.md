# Agent Instructions

## Scope

Local B2B bulk-materials wholesale codebase (`QArefully Materials Exchange`) for QA education and repository-scale agent demos. Non-live runtime; production-grade boundaries.

- Product: wholesale ordering portal; trade buyers (shops, supermarkets) order materials by sack/pallet, sugar -> cement. Browse -> cart -> bulk checkout -> order
- Cart-only; no persisted quote/RFQ object
- No live trading, auctions, or bidding; rejected direction, do not add
- Runtime: deterministic, local-first, low setup
- Engineering: realistic rules; strict validation, auth, migrations, transactions, errors
- Lifecycle: WIP, pre-release. No students, no users, no production instance

Phase note: repo originally B2C powder retail (`QArefully Powder Co.`). Materials Exchange rebrand + gap closure + packaging pigments: complete. Landed brand/copy, sack/pallet unit model, `£/tonne` display, MOQ + qty-break tier engine, heavy-duty vessel artwork, legacy-variant retirement, Custom Small Order placeholder. Current phase: additive expansion per `plans/demo_project_high_level_plan.md`. Reuse catalog/domain foundations; do not rewrite storefront.

## Context

- task scope: named plan/specification
- implementation truth: code, manifests, migrations

Precedence: user request -> task plan -> high-level plan -> repository defaults.

Read task-relevant plans only. Ignore old status, evidence, handoff, completed orchestration unless user names it. Unresolved product/course conflict -> request decision.

## Constraints

- Keep normal customer path simple; keep admin/diagnostics outside it.
- Check high-level plan before changing course scenarios. Avoid later-course spoilers in early UI, comments, filenames, starter artifacts.
- Support Windows and macOS; no Docker, cloud service, account, API key, or post-install network.
- Keep one install flow, one dev command, deterministic seed/reset.
- Keep simulated integrations local and controllable; retain production boundaries.
- Local SQLite is disposable. No stored row has preservation value; recovery from any migration problem is `rm apps/api/data/shop.db` -> `npm run reset`. This licenses destructive migrations, not lax ones — see Architecture and Change Rules.

## Architecture

Stack: npm workspaces; React/Vite/TypeScript web; Fastify/TypeScript API; SQLite; shared TypeScript contracts. Inspect manifests for exact versions/scripts.

- Default: modular monolith. Split service only for named distributed-behavior demo.
- Flow: frontend -> API contracts -> domain -> persistence.
- Backend owns money, inventory, orders, payments, permissions, delivery classification/charge. Money uses integer minor units.
- Purchasable identity is variant/SKU-scoped: base product owns merchandising/reviews/favourites/comparison; variant owns SKU, pack, price, stock, weight, MOQ, tier ladder, delivery class. Cart/inventory/order lines key on variant; contracts retain productId for navigation.
- Unit model: purchase unit = 25 kg sack; 40 sacks = 1 t pallet. `packages/contracts/src/pricing.ts` owns `SACK_WEIGHT_GRAMS`, `PALLET_WEIGHT_GRAMS`, `SACKS_PER_PALLET`, `MOQ_DEFAULT_SACKS`, `TIER_LADDER`. Backend derives `perTonneCents` + tier discount from line weight; tiers never compound; MOQ enforced as line-weight floor.
- Variant `sortOrder` contract-floor is 1; rows below it are retired (`active = 0`), never deleted (migration `020`). Seeded lots are all `deliveryClass 'freight'`; enum retains `parcel`.
- Packaging artwork is web-side only: resolver keys on category + facts. Contract `ProductPackaging` stays optional and unpopulated by API.
- Contracts own transport types/schemas; shared data owns canonical static catalog/content.
- Web never imports API source. Packages/scripts never import app-private source.
- Backend: thin routes -> workflow services -> repositories owning SQL/row types. One transport mapper per record type.
- Composition root owns database, clock, IDs, config, adapters. Imports perform no listen, seed, migration, or persistent-resource opening.
- Use ordered versioned migrations, append-only, forward-only; surface unknown migration errors. Never edit or renumber a landed migration; undo forward with a new one.
- Migration runner (`apps/api/src/db/migrate.ts`) suspends foreign keys around migration loop and runs `PRAGMA foreign_key_check` per migration. Table rebuilds use runner; never toggle `foreign_keys` inside migration transaction.
- Data preservation is a per-task decision, not a default. A migration may drop tables, columns, and rows when the plan says the feature is gone; it must still be correct, transactional, idempotent, and FK-clean (`PRAGMA foreign_key_check`, indexes recreated). Retire-not-delete stays the default for catalog rows referenced by orders (variant `sortOrder`, migration `020`).
- Transaction owner covers full business invariant.

## Repository Map (update after new implementations if needed - keep the map general, not detailed)

- `apps/web/`: React/Vite customer app
  - `src/api/`: typed HTTP clients; validate successful responses against shared schemas
  - `src/features/`: page and workflow ownership by domain
  - `src/components/`: shared UI and shell; `src/components/ui/` contains framework primitives
  - `src/components/packaging/`: vessel artwork (kraft sack, woven sack, HDPE keg), spec resolver, per-category colour/pigment palettes; food bag stays in `src/components/BagArtwork.tsx`
  - `src/hooks/`: cross-feature auth, cart, catalog, favourites state
  - `src/features/designs/`: `/bag-designs` internal artwork fixture page; outside customer journey
  - tests: colocated `*.test.ts(x)`; browser journeys use `*.integration.test.tsx`
- `apps/api/`: Fastify API and SQLite runtime
  - `src/app.ts`: composition root; services, plugins, routes
  - `src/routes/`: HTTP schemas, auth gates, transport mapping; `tradeAccount.ts` = saved delivery sites + billing entities, `deliverySlots.ts` = offered delivery slots
  - `src/features/`: domain services, repositories, workflow rules; `tradeAccount/` = delivery site + billing entity rules, shared address normalisation
  - `src/db/`: database lifecycle, unit of work, migrations, seed/reset
  - `test/`: SQLite and `app.inject()` integration tests grouped by domain
- `packages/contracts/`: TypeBox transport schemas/types and public subpath exports
- `packages/catalog/`: canonical product/category/packaging content plus validation
- `apps/api/data/`: ignored local SQLite runtime files; default `apps/api/data/shop.db`
- `plans/`: `demo_project_high_level_plan.md` = current direction; `custom_additives_handoff.md` = item 16 product input; `plans/old/powderizer_removal_coding_plan.md` = completed item 11; `plans/old/` = completed/historical context
- `.claude/skills/`: repo-local agent skills; load only when task matches. `browser-qa` = required entry point for all browser work (see Quality)
- root configs: workspaces/scripts in `package.json`; shared TypeScript, ESLint, Prettier configuration

Dependency direction: `packages/contracts` -> `apps/api` + `apps/web`; `packages/catalog` -> `apps/api`; `apps/api` -> HTTP -> `apps/web`.

## Commands

Prerequisite: Node 22.x; root `engines` range authoritative. Windows Node 22 path: `C:\Users\iwano\AppData\Local\nvm\v22.23.1` (nvm-managed; verified 2026-07-20 -> `node v22.23.1`, `npm 10.9.8`). Node is NOT on default `PATH`; prepend before any node/npm command: `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` -> `node --version` -> `v22.x`. Stop on Node 23+ even when npm runs (`C:\Users\iwano\AppData\Local\nvm\v24.18.0` exists — never select it). Run commands from repository root unless stated otherwise.

Node-unavailable protocol: prepend path -> retry. Still unresolved -> locate install (`Get-ChildItem C:\Users\iwano\AppData\Local\nvm -Directory`) -> use `v22.*` entry. Report Node 22 unavailable only after both steps fail; state exact paths tried. Never silently skip an assigned test command — missing evidence is a blocker, not a pass.

### Toolchain and dependency health

- npm: use version bundled with selected Node 22. No global npm upgrade/downgrade unless manifest pins version. Current lockfile/workspaces need no separate npm pin.
- install/recovery: `npm ci`. Never repair incomplete workspace with `npm install`; never re-add declared dependency to replace missing executable.
- post-install health: `npm exec -- tsx --version` -> pass; `npm run typecheck -w @shop/api` -> pass. Required before `reset`, focused TypeScript tests, or `verify` evidence.
- incomplete-install signals: missing `tsx`; dot-prefixed temporary shims under `node_modules/.bin`; `TS2688` for `node`. Response: stop repository edits -> close worktree-owned Node processes -> select Node 22 -> `npm ci`.
- TLS inspection: `npm ping --fetch-timeout=5000 --fetch-retries=0`. `UNABLE_TO_VERIFY_LEAF_SIGNATURE` -> system trust store for current shell (`$env:NODE_OPTIONS='--use-system-ca'` in PowerShell) -> retry `npm ping` -> `npm ci`. Never set `strict-ssl=false`. System-CA unavailable -> update within Node 22.x or set npm `cafile` to approved organization root certificate.
- clean gate: suspect/changed dependencies -> `npm ci` -> `npm run reset` -> proportional journey checks -> `npm run verify`. Focused suites alone never final-gate evidence.

- install locked dependencies + build shared packages: `npm ci`
- seed then start API and web: `npm run dev`
  - web: `http://127.0.0.1:5173`
  - API: `http://127.0.0.1:3001`
- idempotent canonical seed, preserve non-seed rows: `npm run seed`
- clear all local data then re-seed: `npm run reset`
- full pre-handoff verification: `npm run verify`
- fast broad checks: `npm run smoke`
- individual checks: `npm run format`, `npm run typecheck`, `npm run lint`, `npm test`
- split suites: `npm run test:unit`, `npm run test:integration`
- all workspace builds: `npm run build --workspaces --if-present`
- one workspace: `npm test -w @shop/api`, `npm test -w @shop/web`, `npm test -w @shop/contracts`, `npm test -w @shop/catalog`
- focused API test: `npm exec -w @shop/api -- tsx --test <path-to-test.ts>`
- focused web Vitest file: `npm exec -w @shop/web -- vitest run --configLoader runner <path-to-test.tsx>`
- focused web Node test: `npm exec -w @shop/web -- tsx --test <path-to-test.ts>`
- auto-format supported non-Markdown files: `npm run format:fix`

Keep `--configLoader runner` on Vite/Vitest commands. Root scripts already supply required flags. `SHOP_DB_PATH` overrides SQLite path; `SHOP_API_HOST`, `SHOP_API_PORT`, `SHOP_RESET_BASE_URL`, `SHOP_SEED` configure API runtime.

## Change Rules

- Preserve unrelated work; make smallest coherent scoped change; retain public behavior unless requested.
- Phased work: complete assigned ready packet, pass exit checks, update status, stop.
- Avoid empty scaffolding, speculative abstractions, vendored code, generated padding.
- Remove obsolete path after final consumer moves; avoid parallel legacy/new implementations.
- Separate static data, generated artifacts, transport schemas, domain rules, persistence, rendering.
- No mutable module-global request, cart, session, or database lifecycle state.
- Demo status never relaxes schema, auth, validation, transaction, integrity standards.
- Do not edit `reference/` or `.cursor/` unless scoped. Course-visible change -> inspect affected course artifacts first.

## Quality

- Use repository scripts; run format, typecheck, lint, build, seed/reset, tests proportional to change.
- Any browser task (screenshot, visual check, journey click-through, console/network read, UI bug repro) -> load `.claude/skills/browser-qa` and follow it. Mandatory entry point; no ad-hoc browser driving.
- Viewport scope: 1080p (`1920x1080`) only. No mobile/tablet/responsive checks unless user names explicit size.
- Never use, control, capture, or activate user's Chrome. `browser-qa` headless Chromium unavailable -> report blocker; no Chrome fallback.
- Prettier formats code and config only; Markdown (`*.md`) stays excluded through `.prettierignore`.
- Keep Vite/Vitest `--configLoader runner`; bundled config loader traverses sandbox-blocked Windows ancestors.
- Tests: pure rule -> unit; repository/transaction -> SQLite integration; route/schema/auth -> Fastify `app.inject()`.
- API suites register by path glob, not by hand-listed file: `apps/api/src/**/*.test.ts` -> unit; `apps/api/test/**/*.integration.test.ts` -> integration. New file off-convention never runs. Keep globs quoted in scripts (cross-shell).
- Seeded integration DBs contain global demo orders, payments, lifecycle events, stable users. Scope counts/lists to test-owned identifiers: unique email, request ID, idempotency key. Never assume empty commerce tables or fixed starting IDs.
- Deliberately corrupted persistence fixture -> restore valid snapshot before replay/other read path unless corrupt-state rejection is test target.
- Destructive refactor -> characterization test first. Async UI -> stale-response, cancellation, error, retry coverage where relevant.
- Keep coverage focused; preserve QA exercise gaps. No Playwright frontend/API E2E tests unless task overrides.
- UI/business change -> verify customer journey. Keep failures deterministic and domain errors exact.
- Type ownership: persistence rows -> repositories; transport types -> contracts; UI state -> owning feature/provider. Derive request types from schemas; avoid bypass casts.
- Async UI work aborts or ignores stale completion. Keep payment/auth secrets out of logs, persistent fingerprints, browser storage.
- TSDoc public/non-obvious contracts. Comments explain rationale, invariants, risk; never obvious code.
- Reuse established patterns before dependencies/frameworks. Keep business rules traceable frontend-to-backend.
- User-needed credentials, triggers, operator steps -> human-facing README. Stop only current-task servers.
