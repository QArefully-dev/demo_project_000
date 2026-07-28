# AGENTS.md

`QArefully Materials Exchange`-> local non-live powder ecommerce demo, QA-education + agentic-engineering testbed, zero external services.

## Repo map

- `apps/api` -> Fastify server, SQLite (better-sqlite3, WAL), auth/checkout/orders/inventory/returns/admin-sim. Src: `routes`, `features`, `db`, `mappers`, `plugins`, `utils`.
- `apps/web` -> React + Vite storefront. Src: `features`, `components`, `api`, `hooks`, `lib`.
- `packages/contracts` -> shared request/response schemas (auth, cart, orders, payments, promos, returns, inventory, ...). Owned by neither app; both depend on it.
- `packages/catalog` -> canonical product/variant/bundle model + pricing/category data.
- `plans/` -> design + coding plan docs.
- `data/` -> SQLite db file, auto-created, gitignored.
- `.agents/skills/` -> skill packs (browser-qa, shop-frontend-ui, code-reviewer, etc).

Dependency direction: `contracts` + `catalog` <- `api` <- `web` (one-way). Web never imports API source; apps never import each other's private source.

## Architecture / domain decisions

- Checkout = server-owned payment-intent flow: validate cart/promo/customer/card -> reserve cart+promo capacity -> persist immutable quote -> call simulated gateway with quote total -> finalize creates order from saved quote (later cart edits can't touch an authorized payment).
- Every checkout/admin mutation carries an idempotency key + expected `version`; replay of same key+payload returns prior result, same key+different payload or stale version returns a conflict. Card number/CVC never persisted.
- No ops/admin UI by design — admin lifecycle, inventory receipts, and returns are driven via raw HTTP calls documented in `README.md` (sign in as `admin@example.com`, use fresh UUID idempotency keys, current `version` from `GET /api/orders/:orderId` or `GET /api/admin/returns`).
- Returns: delivered ordinary products only, 30-day window from exact delivery event; refunds are simulated, prorated, never touch original order/payment/promo rows.
- Web validates every API response against the shared `contracts` schema before feature code sees it.
- Product taxonomy: food-grade categories (Sports Nutrition, Baking & Pantry, Drinks) show ingredients/allergens/nutrition; non-food (Household & Cleaning, Garden & Outdoors, Trade & Creative Materials) marked "Not for consumption" with handling/PPE guidance. Variants scale from consumer packs up to 1 tonne trade packs; heavy/over-threshold orders become freight.
- Design constraint: every storefront feature must be usable with zero explanation — reject bespoke B2B/trade mechanics (pallet minimums, mixed-pallet fees) that need teaching first; depth belongs in familiar actions (partial failure, price drift, stock races), not new jargon-laden concepts.

## Commands

- `npm ci` -> install + auto-build `contracts`/`catalog` (postinstall).
- `npm run dev` -> seed db + run api(3001)+web(5173) concurrently.
- `npm run seed` / `npm run reset` -> idempotent upsert / full wipe+reseed.
- `npm run typecheck` / `npm run lint` / `npm run format` (`format:fix` to autofix).
- `npm test` (all), `npm run test:unit`, `npm run test:integration`.
- `npm run smoke` -> typecheck + unit + integration.
- `npm run verify` -> format + typecheck + lint + test + build, all workspaces (pre-PR gate).

## Common technical issues

- `better-sqlite3` install fails -> needs native build tools: Windows = VS Build Tools "Desktop development with C++"; macOS = `xcode-select --install`.
- Port 3001/5173 already in use -> find + kill stale process (`netstat -ano | findstr :3001` on Windows, `lsof -i :3001` on macOS/Linux, then `kill -9 <PID>`).
- Permission denied on `data/` -> check write perms in project dir; on macOS avoid iCloud-synced Desktop/Documents.
- Corrupted/inconsistent local data -> `npm run reset` (drops db, rebuilds from migrations+seed); `npm run seed` alone only upserts, won't fix broken non-seed rows.
