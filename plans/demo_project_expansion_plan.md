# Demo Project Expansion — Orchestrator Build Plan

Status: approved scope, ready to execute. Audience: orchestrator agent + subagents. Not human docs.
Companion: [demo_project_high_level_plan.md](demo_project_high_level_plan.md). Root rules: [CLAUDE.md](../CLAUDE.md).

## Goal

Grow existing electronics shop -> substantially bigger, richer QA playground, small cost, one long orchestrated session. All features fully functional FE + backend. No tests (course writes tests later).

Scope locked (user decisions 2026-07-08):
- Auth: realistic, zero-native. scrypt (`node:crypto`) hashing -> httpOnly session cookie -> signup/login/logout -> password reset via token surfaced on dev "Mailbox" page (no real email). `role` field baked in.
- One extra big system: fake payment gateway (declines/timeouts/idempotency). NOT building: admin panel/RBAC UI, reviews/ratings, order-status lifecycle state machine. (`role` column exists but no admin UI.)
- Guardrails hold: no automated tests, seed demo data, preserve M1 `SAVE10` + FE 5-item gate, `reference/` untouched, no course-reveal spoilers.

## Invariants — DO NOT BREAK

- M1 lesson frozen: FE 5-item gate in `apps/web/src/features/checkout/cartValidation.ts` unchanged. `SAVE10` stays kind=percent, `discount_percent=10`, `min_item_count=5`. Promo stays single-code, no stacking (`PlaceOrderBody.promoCode` scalar).
- Money: integer cents, backend-authoritative. Never float. Reuse `MoneyCents`.
- Guest checkout still works end-to-end without login (M1 flow is anonymous).
- No new native module deps -> preserve 2-min cross-platform setup. Allowed new dep: `@fastify/cookie` (pure JS). Hashing via built-in `node:crypto` scrypt only. No bcrypt/argon2.
- No tests written. No edits under `reference/` or `.cursor/`. No spoilers of later course reveals in UI/comments/filenames.
- Self-documenting: method names + TSDoc carry meaning, comments only if necessary (CLAUDE.md rule).
- `npm run dev` / `npm run seed` / `npm run reset` / `npm run typecheck` / `npm run lint` / `npm run format` stay green.

## Architecture conventions (recap — subagents follow verbatim)

- Monorepo npm workspaces: `apps/web` (React+Vite+TS), `apps/api` (Fastify+TS), `packages/contracts` (TypeBox schemas = single source of API types).
- Contracts: define TypeBox schema in `packages/contracts/src/schemas.ts` -> export from `src/index.ts`. `Static<typeof X>` for types. Reuse `MoneyCents`, `ErrorResponse`.
- API layering: `routes/*` thin + schema-validated (`typed.get/post` with `schema.{params,body,response}`) -> call `domains/*` pure business logic -> `db/*` SQLite. Error helpers in `utils/errors.ts` (`sendNotFound`, `sendBadRequest`). Domains return result-or-error-union (see `domains/orders.ts` `PlaceOrderError`), routes translate to HTTP.
- DB: `db/connection.ts` `ensureSchema` (all `CREATE TABLE IF NOT EXISTS` + guarded `ALTER TABLE ADD COLUMN`). Singleton `getDb()`. WAL + `foreign_keys=ON`. IDs: INTEGER AUTOINCREMENT for entities, TEXT for carts/sessions. snake_case columns; map to camelCase at route boundary.
- Seed: `db/seed.ts` deterministic upsert (`ON CONFLICT DO UPDATE`), safe every startup. Reset: `db/reset.ts` DELETE in FK-safe order.
- Web: feature folders `src/features/<name>/`, shared `src/components/` + `src/components/ui/` (base-ui + shadcn-style), `src/hooks/`, `src/lib/`, `src/api/`. Routing `react-router-dom` in `App.tsx` under `<Layout>`. Money display `lib/formatMoney.ts`. Cart state `hooks/CartContext.tsx`.
- Stack pins: React 18, react-router-dom 6, Tailwind v4 (`@tailwindcss/vite`), base-ui, lucide-react, TS strict, Node 22.
- UI quality bar: modern, polished, desktop-only (`1366x768` + 4K). Use `shop-frontend-ui` skill when available. Missing skill -> inspect existing components/tokens, follow established design system, continue without blocking. Predictable teaching behavior > decorative complexity.

## Execution bootstrap

Run before implementation:

1. Read full plan + `CLAUDE.md`. Inspect `git status`, current branch, worktrees, branches, recent log.
2. Preserve user work. Never stash, reset, overwrite, or commit unrelated changes. Dirty overlap with planned files -> stop and request user direction, except this untracked plan handled by step 4. Non-overlapping dirty changes -> leave untouched and create integration branch in dedicated `../demo_project_000-worktrees/integration` worktree. Clean worktree or plan-only untracked state -> current worktree may become integration worktree.
3. Integration branch: `codex/demo-project-expansion`. Create from starting `HEAD` when absent; resume when present. Final deliverable stays on integration branch; never merge into starting branch without user request.
4. Plan must be tracked before section worktrees. If plan untracked, create integration-branch bootstrap commit containing only this plan. Never include unrelated files.
5. Section branch: `codex/demo-expansion-<section>` where `<section>` uses lowercase (`wave0`, `w1-a`, `w1-b`, `w1-c`, `w1-d`, `w2-a`, `w2-b`, `wave3`).
6. Worktree path: sibling directory `../demo_project_000-worktrees/<section>`. Integration worktree may use `<section>=integration`. Resolve absolute path before creation. Never delete worktree outside this root.
7. Baseline gate on integration branch: `npm install` only when dependencies missing or lockfile requires sync -> `npm run typecheck` -> `npm run lint` -> `npm run format` -> `npm run seed`. Existing failure -> record exact command/output and stop; do not attribute baseline failure to section.
8. Record starting integration SHA. Every section branch starts from latest green integration SHA unless dependency rule specifies later start.

Resume/recovery:

- Inspect integration log, section branches, worktrees, plan progress notes, agent states.
- Existing section commit + no approval -> assign fresh reviewer. Approved + unmerged -> assign merge subagent. Merged + missing progress note/checks -> finish merge protocol before new work.
- Failed/timed-out implementation -> preserve worktree/branch, inspect commits/diff, send same implementation agent follow-up when available; otherwise assign replacement with state summary.
- Reviewer disagreement -> orchestrator compares findings against locked scope/invariants and records decision. Scope-changing decision -> request user direction.
- Post-merge failure -> keep integration history. Fix through section/repair branch. Unsafe repair -> `git revert` merge through new reviewed commit. Never reset integration or discard valid work.
- Frozen-file conflict, ambiguous user-owned change, repeated blocker across 3 attempts -> stop affected section, preserve evidence, request user direction. Independent sections may continue.

## Orchestration model

### Subagent execution protocol

Apply to sections: `Wave 0` as one section, `W1.A`, `W1.B`, `W1.C`, `W1.D`, `W2.A`, `W2.B`, `Wave 3`. `W0.1`-`W0.5` are ordered tasks inside one Wave 0 section, not separate branches.

1. Orchestrator creates dedicated git worktree + branch for section. One implementation subagent owns worktree. No direct section work in main worktree.
2. Implementation subagent completes section tasks, runs section checks, commits changes, reports commit SHA, changed files, commands + exit codes, acceptance evidence, known concerns. Subagent does not merge own work.
3. Orchestrator launches separate reviewer subagent after implementation finishes. Reviewer reads plan + `CLAUDE.md`, checks every task/criterion, inspects full diff from section base, runs relevant checks, reports findings by severity with file/line evidence. Blocking: invariant/scope breach, correctness/security bug, acceptance miss, ownership violation, required-check failure. Non-blocking: preference outside acceptance. Zero blocking findings -> `approved`; any blocking finding -> `changes requested`.
4. `changes requested` -> implementation subagent fixes findings in same worktree -> reviewer re-reviews. Repeat until `approved`. Unresolved scope or architecture issue -> orchestrator decision before merge.
5. Orchestrator launches separate merge subagent only after reviewer approval. Merge subagent updates section branch from latest integration using merge, resolves conflicts without dropping valid changes, runs section checks, merges with `--no-ff` into integration, reruns checks, commits conflict resolution when needed. Code failure unrelated to conflict -> return to implementation/review loop.
6. Merge subagent updates this plan in integration worktree immediately after merge. Add 1-3 progress bullets under section: status, merge commit, checks, notable decision/conflict. Commit progress note as separate integration commit.
7. Orchestrator removes section worktree + branch only after merge, progress update, checks, and commits succeed. Verify resolved paths remain under configured worktree root before removal. Preserve failed/unmerged worktrees.

Role separation: implementation, review, merge use different subagents. Reviewer and merge subagent receive section task list, acceptance criteria, ownership boundaries, branch/worktree path, and dependency state.

Section state flow: `pending` -> `in progress` -> `review` -> `approved` -> `merging` -> `complete`. `complete` requires merged code, green required checks, and plan progress note.

Required section report:

- State + section branch + base SHA + final SHA.
- Changed files grouped by ownership.
- Each acceptance criterion -> pass/fail + evidence.
- Commands -> exact command, exit code, short result.
- Manual checks -> URL/request, input, expected result, observed result.
- Remaining concerns -> `none` or concrete item. No unsupported approval claim.

Parallel work allowed only for dependency-independent sections with non-overlapping ownership. Active subagents <= available concurrency slots minus orchestrator. Queue excess sections; never assume four implementation slots. Each section uses own worktree, reviewer, merge subagent. Same section requires three distinct agents; agents may serve different roles on other sections. Merge sections serially against latest integration.

### Collision rule (critical for parallel subagents)

Wave 0 owns shared/aggregator initial shape. Later edits require named handoff. Feature agents otherwise edit owned leaves only.

Shared/aggregator files (Wave 0 initial owner):
- `packages/contracts/src/schemas.ts` + `src/index.ts` (all schemas defined up front)
- `apps/api/src/db/connection.ts` (all tables/columns), `db/seed.ts` (all seed data), `db/reset.ts`
- `apps/api/src/index.ts` (register all route modules, incl. stubs), plugin registration
- `apps/web/src/App.tsx` (all routes -> stub pages), `components/nav/navItems.ts`, `components/Header.tsx` nav wiring, `index.css` (tokens)
- `apps/web/src/api/client.ts` core `apiFetch`/error helper only

Leaf files: one active owner. Feature `domains/*.ts`, `routes/*.ts`, `features/<name>/*`, feature hooks, `api/<domain>.ts`, feature-only components.

Named ownership handoffs:

- `apps/api/src/domains/orders.ts`: existing/Wave 0 -> W1.C promo compatibility update -> W1.D transaction refactor.
- `apps/api/src/domains/auth.ts`, `routes/auth.ts`, `api/auth.ts`: W1.A -> W2.B password-change extension.
- `apps/api/src/routes/auth.ts`: W1.A -> W2.B after W1.A merge.
- `apps/web/src/components/ProductCard.tsx`, `features/product/ProductPage.tsx`: W1.B -> W2.A after W1.B merge.
- `apps/web/src/components/Header.tsx`: Wave 0 seams -> W1.A account-state wiring -> Wave 3 final nav/count polish. Never parallel edits.
- `apps/web/src/features/checkout/CheckoutPage.tsx`, `hooks/useCheckout.ts`: W1.D only. W1.C supplies promo domain/API behavior; no checkout-file edits.
- `apps/api/src/domains/promo.ts`: W1.C finalizes helper signatures before W1.D starts.

Unlisted frozen-file need -> report gap. Orchestrator serializes small integration edit through implementation/review/merge flow. No feature agent edits frozen file without ownership assignment.

### Wave ownership pattern

Prefer vertical slices. Wave 0 moves domain calls out of `api/client.ts` into owned modules (`api/cart.ts`, `api/orders.ts`, `api/promo.ts`, `api/products.ts`), updates imports, then freezes core helper. Wave 0 pre-lays route/page/API seams so later slices edit owned leaves.

### Waves

Wave 0 (serial, blocking, single agent): foundations + seams. Everything typechecks with stubs.
Wave 1a (parallel as capacity permits): auth; catalog/search/product-page; promotions/vouchers/discounts.
Wave 1b (dependency-blocked): merge W1.C -> start payment gateway from latest integration. W1.D consumes merged W1.C helpers. W1.A/W1.B may merge before or after W1.D; all Wave 1 sections must merge before Wave 2.
Wave 2 (parallel as capacity permits): favourites/wishlist depends on W1.A + W1.B; account hub depends on W1.A.
Wave 3 (serial, single agent): home composition + nav finalize + polish + seed verify + full manual smoke + typecheck/lint/format + docs/plan TLDR.

Every listed section follows subagent execution protocol. Between waves: merged progress notes present -> `npm run typecheck` -> `npm run lint` -> `npm run format`; all green before next wave.

## Data model additions

New tables (`ensureSchema`):
- `users`: id PK, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at.
- `sessions`: token TEXT PK, user_id INTEGER NOT NULL -> users(id) ON DELETE CASCADE, created_at, expires_at TEXT NOT NULL.
- `password_reset_tokens`: id PK, user_id -> users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, expires_at NOT NULL, used_at TEXT NULL.
- `dev_mailbox`: id PK, to_email TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL (`password_reset`|`order_confirmation`), created_at.
- `favourites`: id PK, user_id -> users(id) ON DELETE CASCADE, product_id -> products(id), created_at, UNIQUE(user_id, product_id).
- `payments`: id PK, order_id INTEGER NULL -> orders(id) ON DELETE SET NULL, idempotency_key TEXT UNIQUE NOT NULL, request_fingerprint TEXT NOT NULL, status TEXT NOT NULL (`succeeded`|`declined`|`error`), amount_cents INTEGER NOT NULL, card_last4 TEXT, card_brand TEXT, failure_reason TEXT NULL, created_at.
- `promo_redemptions`: id PK, code TEXT NOT NULL, user_id INTEGER NULL -> users(id) ON DELETE SET NULL, order_id INTEGER NULL -> orders(id) ON DELETE SET NULL, created_at TEXT NOT NULL.

Additive columns (guarded `ALTER TABLE ADD COLUMN`, nullable/defaulted -> back-compat):
- `products`: slug TEXT (seed-guaranteed unique; no migration-time UNIQUE constraint), compare_at_price_cents INTEGER NULL (sale strikethrough; NULL=not on sale), sales_count INTEGER NOT NULL DEFAULT 0 (bestsellers).
- `promo_codes`: kind TEXT NOT NULL DEFAULT 'percent' (`percent`|`fixed`), amount_cents INTEGER NULL (fixed value), min_subtotal_cents INTEGER NOT NULL DEFAULT 0, starts_at TEXT NULL, ends_at TEXT NULL, max_redemptions INTEGER NULL, redeemed_count INTEGER NOT NULL DEFAULT 0, per_user_limit INTEGER NULL. (`discount_percent`, `min_item_count`, `active` already exist.)
- `orders`: user_id INTEGER NULL -> users(id) ON DELETE SET NULL (guest orders keep NULL).

`ensureSchema` guarded-alter helper: check `PRAGMA table_info(<t>)` for column, `ALTER TABLE ADD COLUMN` if missing. Idempotent.
`reset.ts`: extend DELETE order -> payments, promo_redemptions, favourites, password_reset_tokens, sessions, dev_mailbox, order_line_items, orders, cart_line_items, carts, promo_codes, products, users.
Timestamp rule: application-generated UTC ISO 8601 strings. Required timestamps use `TEXT NOT NULL`; nullable lifecycle timestamps remain `TEXT NULL`. Payment last4/brand required `TEXT NOT NULL`.

## Contracts additions (Wave 0 defines all)

Product schema (extend `Product`): add `slug: string`, `compareAtPriceCents: Optional(MoneyCents)`, `salesCount: number`. Back-compat: existing fields unchanged.

Catalog list -> paginated. New `ProductQuery` (querystring): `q?`, `category?`, `onSale?` boolean, `sort?` (`newest`|`price_asc`|`price_desc`|`bestselling`), `page?` integer 1..10000 default 1, `pageSize?` integer 1..48 default 12. Change `ProductListResponse` -> `PaginatedProducts { items: Product[], total, page, pageSize }`. `CategoriesResponse = string[]`. `BestsellersResponse = Product[]` fixed limit 8. `RelatedProductsResponse = Product[]` fixed limit 4.

Auth: `SignupBody {email, password, displayName}`, `LoginBody {email, password}`, `ForgotPasswordBody {email}`, `ResetPasswordBody {token, newPassword}`, `ChangePasswordBody {currentPassword, newPassword}`, `PublicUser {id, email, displayName, role:'customer'|'admin'}`, `AuthResponse {user: PublicUser}`, `MeResponse = Union(PublicUser, Null)`; anonymous `/me` -> `200 null`. `MailboxMessage {id, toEmail, subject, body, kind:'password_reset'|'order_confirmation', createdAt}`, `MailboxResponse = MailboxMessage[]`. `SuccessResponse {success: Literal(true)}`.

Favourites: `FavouriteBody {productId}`, `FavouritesResponse = Product[]`, `FavouriteProductIdParam {productId}`.

Promotions v2 (extend `PromoCode`): add `kind` (`percent`|`fixed`), `amountCents?`, `minSubtotalCents`. Keep `discountPercent`, `minItemCount`. `PromoValidationError` exact union: `EXPIRED|NOT_STARTED|MIN_ITEMS|MIN_SUBTOTAL|USAGE_LIMIT|AUTH_REQUIRED|INVALID`. `ValidatePromoResponse` keeps existing fields; `error?` uses union.

Payments: `PayBody {cartId, promoCode?, customerName, customerEmail, shippingAddress, card: {number, expMonth, expYear, cvc}, idempotencyKey}`. Card number accepts digits/spaces -> normalize to digits -> require 12-19 digits + valid Luhn. Expiry current/future; CVC 3-4 digits. Success -> `Order`. `PaymentFailure {error, failureReason:'CARD_DECLINED'|'GATEWAY_TIMEOUT'}` via 402. Same key + different normalized payload -> 409. Never return/store PAN/CVC; store last4 + brand only.

Rule: password/card fields never returned in any response. `PublicUser` excludes hash/salt.

## API endpoint manifest

All routes use TypeBox request/response schemas. Validation failure -> 400 `ErrorResponse`. Unexpected failure -> 500 `ErrorResponse`. Wave 0 unfinished stubs -> 501 `ErrorResponse {error: "Not implemented"}`. Route order registers static product paths before `/:id`.

- Products:
  - `GET /api/products` -> public; `ProductQuery`; 200 `PaginatedProducts`.
  - `GET /api/products/categories` -> public; 200 sorted `CategoriesResponse`.
  - `GET /api/products/bestsellers` -> public; 200 `BestsellersResponse` containing <=8.
  - `GET /api/products/:id` -> public; 200 `Product`; 404 `ErrorResponse`.
  - `GET /api/products/:id/related` -> public; 200 `RelatedProductsResponse` containing <=4; 404 missing source product.
- Auth:
  - `POST /api/auth/signup` -> anonymous; 201 `AuthResponse`; 409 duplicate email.
  - `POST /api/auth/login` -> anonymous; 200 `AuthResponse`; 401 invalid credentials.
  - `POST /api/auth/logout` -> public; 200 `SuccessResponse`; deletes current session when present and clears cookie.
  - `GET /api/auth/me` -> public; 200 `MeResponse`; anonymous returns `null`.
  - `POST /api/auth/forgot-password` -> anonymous; 200 `SuccessResponse` for existing/missing email.
  - `POST /api/auth/reset-password` -> anonymous; 200 `SuccessResponse`; 400 invalid/used/expired token; invalidates all user sessions.
  - `PATCH /api/auth/password` -> auth; 200 `SuccessResponse`; 400 wrong current password or invalid new password; invalidates other sessions, keeps current session.
- Mailbox:
  - `GET /api/dev/mailbox` -> public dev convenience; 200 `MailboxResponse` newest first. No message-detail endpoint.
- Favourites:
  - `GET /api/favourites` -> auth; 200 `FavouritesResponse`; 401 anonymous.
  - `POST /api/favourites` -> auth; 200 `FavouritesResponse` after idempotent add; 404 product missing.
  - `DELETE /api/favourites/:productId` -> auth; 200 `FavouritesResponse` after idempotent remove.
- Promo:
  - `POST /api/promo/validate` -> public; 200 `ValidatePromoResponse`. Business rejection uses `valid:false`, not HTTP error.
- Payment/order:
  - `POST /api/payments/pay` -> public; 200 `Order`; 402 `PaymentFailure` for decline/timeout; 404 cart missing; 409 same idempotency key + different payload.
  - `POST /api/checkout` -> public legacy M1 compatibility; keep existing `PlaceOrderBody`/`PlaceOrderResponse` behavior and single-code rule. New UI never calls it. Do not remove or route through card gateway.
  - `GET /api/orders/:orderId` -> public existing behavior; 200 `Order`; 404 missing order.

Auth cookie: `sid`, random 32-byte hex token, httpOnly, SameSite=Lax, Path=/, Max-Age=604800, `secure:false` for local HTTP. Email normalization: trim + lowercase before lookup/store. Password: 8..128 characters. Display name: trimmed 1..80 characters.

## Wave 0 — Foundations & seams (serial, blocking)

Single agent. Output: repo typechecks + lints; all stubs return `501`/placeholder; `npm run seed` populates expanded data.

W0.1 Contracts: add all schemas above to `schemas.ts`, export from `index.ts`. Update `Product`. Replace `ProductListResponse` with `PaginatedProducts`. Typecheck contracts (`npm run build -w @shop/contracts`).

W0.2 DB + password utility:
- Extend `ensureSchema` -> all new tables + guarded alters. Extend `reset.ts` delete order.
- Add Wave-0-owned `apps/api/src/utils/passwords.ts`: `hashPassword()` + `verifyPassword()` using `node:crypto` scrypt. Seed + W1.A auth domain consume utility. W1.A does not redefine hashing.

W0.3 Seed: rewrite `seed.ts` per "Seed data spec" below. Preserve `SAVE10` exactly. Upsert users by normalized email. Re-hash seeded passwords; delete seeded-user sessions + unused reset tokens so stale auth state never survives changed hash.

W0.4 API seams:
- New `apps/api/src/plugins/auth.ts`: export `registerAuth(app)` called directly on root Fastify instance, not through encapsulated sibling plugin. Function awaits `@fastify/cookie` registration, adds TypeScript request declaration, decorates internal `request.user` with `PublicUser` fields + `sessionToken`, adds global `preHandler` reading `sid` -> unexpired `sessions` -> `users`, exports `requireAuth` preHandler. Never serialize `sessionToken`. `index.ts` awaits it before route registration.
- Run `npm install @fastify/cookie -w @shop/api` from repo root; commit package + lockfile changes.
- Create schema-valid route stubs registered in `index.ts`: `routes/auth.ts`, `routes/favourites.ts`, `routes/payments.ts`, `routes/mailbox.ts`. Each manifest endpoint returns 501 `ErrorResponse`. Extend `routes/products.ts` with categories/bestsellers/related stubs owned by catalog slice.
- Create empty domain files: `domains/auth.ts`, `domains/favourites.ts`, `domains/payments.ts`, `domains/mailbox.ts`. Add promo TODO seam. Update products domain/route minimally: existing list -> default `PaginatedProducts`; existing detail maps additive fields; bestsellers/related remain 501 for W1.B.
- `utils/errors.ts`: add `sendUnauthorized`, `sendPaymentRequired` (402), `sendConflict` (409).

W0.5 Web seams:
- `src/api/client.ts`: retain/export core `apiFetch` + typed error helpers; send `credentials: 'include'`.
- Move existing cart/order/promo/product functions into `src/api/cart.ts`, `orders.ts`, `promo.ts`, `products.ts`; update all imports. Update existing product hook/catalog to consume `PaginatedProducts.items` with default query. Create `auth.ts`, `favourites.ts`, `payments.ts` stubs matching manifest. Later slices edit domain module only, never core client.
- `src/hooks/AuthContext.tsx` skeleton: `useAuth()` -> `{user, loading, login, signup, logout, refresh}`; wraps app in `main.tsx`.
- `App.tsx`: add ALL routes -> stub page components (each renders "coming soon" placeholder): `/` HomePage, `/catalog` CatalogPage (move existing catalog here), `/product/:id` ProductPage, `/cart`, `/checkout`, `/checkout/payment` PaymentPage, `/order-confirmation/:orderId`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/wishlist`, `/dev/mailbox`. Guarded routes (`/account`, `/wishlist`) -> redirect to `/login` when anon (guard component).
- Create stub page files under `features/{home,auth,account,product,wishlist,checkout,catalog,dev}/`.
- `navItems.ts`: set `search`/`account`/`wishlist` `enabled: true`. `Header.tsx`: wire nav links (search -> `/catalog?q=`, account -> menu login/account, wishlist -> `/wishlist`). Keep existing cart.
- `index.css`: keep existing tokens unchanged; freeze. Wave 3 uses existing tokens/utilities.

W0 acceptance: contracts build, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run reset`, `npm run seed` exit 0. Start `npm run dev`, wait <=60s for API + Vite URLs, verify existing catalog->cart->checkout->confirmation, verify new pages render placeholders + stub API returns 501, stop only task-started server.

## Wave 1 — staged slices

### W1.A Auth system (BE+FE)
Owns: `domains/auth.ts`, `domains/mailbox.ts`, `routes/auth.ts`, `routes/mailbox.ts`, `api/auth.ts`, `hooks/AuthContext.tsx`, `features/auth/*`, account route guard, `features/dev/MailboxPage.tsx`, Header account-state handoff. Does not implement `AccountPage`.
BE:
- Hashing: use Wave 0 `utils/passwords.ts`: `scryptSync(password, salt, 64)` + `randomBytes(16)` salt hex; compare equal-length buffers with `timingSafeEqual`.
- signup: validate email format + password min length (>=8); reject dup email (409); create user role `customer`; create session; set `sid` httpOnly cookie (SameSite=Lax, 7d). login: verify -> session+cookie. logout: delete session + clear cookie. me: from `request.user`.
- forgot: if email exists, invalidate prior unused reset tokens, create random 32-byte hex token with 30-minute expiry, write `dev_mailbox` row kind `password_reset` with `/reset-password?token=...`. Always 200. reset: token exists + unused + unexpired -> update hash/salt, mark used, invalidate all user sessions.
- mailbox route: `GET /api/dev/mailbox` returns messages newest first. Dev convenience, no auth. No detail route.
FE:
- Pages: `/login`, `/signup`, `/forgot-password`, `/reset-password` (reads `?token`). AuthContext: `refresh()` calls `/api/auth/me` on mount. Header account menu: anon -> Login/Signup; auth -> displayName, Account, Logout.
- `/dev/mailbox` page: list captured emails, click reset link. Label clearly "Dev Mailbox".
Acceptance: signup->login->me->logout cycle; forgot writes mailbox msg; reset via token link works; guarded routes redirect when anon.

### W1.B Catalog / search / product page (BE+FE)
Owns: `domains/products.ts` (extend), `routes/products.ts` (extend), `api/products.ts`, `features/catalog/CatalogPage.tsx`, `features/product/ProductPage.tsx`, `hooks/useProducts.ts`+`useProductSearch`, `components/ProductCard.tsx` (sale/badges), `SearchBar.tsx`, `CategoryNav.tsx`.
BE:
- `GET /api/products` -> query params (`q`,`category`,`onSale`,`sort`,`page`,`pageSize`) -> `PaginatedProducts`. `q` matches name/description with escaped LIKE. `category` exact case-insensitive match. `onSale=true` -> non-null compare price greater than price. Sort uses ID tiebreaker: newest `id DESC`, price asc/desc, bestselling `sales_count DESC`. Map new columns.
- `GET /api/products/:id` -> extended Product; non-integer/non-positive ID -> 400, missing positive ID -> 404.
- `GET /api/products/categories` -> all distinct categories sorted ascending, independent of current page/filter.
- `GET /api/products/bestsellers` -> top 8 by `sales_count DESC, id ASC`.
- `GET /api/products/:id/related` -> same-category others (limit 4).
FE:
- CatalogPage: search box with 300ms debounce + category filter from categories endpoint + sort + pagination; URL query is source of truth. Filter/sort/q change resets page=1. Product grid uses paginated response. Sale strikethrough via `compareAtPriceCents`. "Bestseller" badge when `salesCount >= 250`.
- ProductPage: image, name, price/sale, description, stock/low-stock, add-to-cart, related products row, existing `WishlistButton` seam rendered without adding W2 behavior.
Acceptance: search/filter/sort/paginate all drive results; product page loads by id; related shows; sale prices render.

### W1.C Promotions / vouchers / discounts (BE + promo API)
Owns: `domains/promo.ts`, `routes/promo.ts`, `api/promo.ts`, minimal `domains/orders.ts` compatibility update. No checkout component/hook ownership.
BE:
- Export fixed helpers: `validatePromoCode({code, cartId, userId})`, `calculateDiscount({promo, subtotalCents})`, `recordRedemption({db, promo, userId, orderId})`. Validation loads cart totals. Support percent/fixed; enforce active, UTC date window, item/subtotal minimums, global limit, per-user limit. Promo with `per_user_limit` + anonymous user -> `AUTH_REQUIRED`. Fixed discount = min(amount, subtotal); percent uses existing integer formula.
- Legacy `placeOrder`: use new validation/calculation, record nullable-user redemption + increment count inside existing order transaction. Preserve SAVE10 behavior. W1.D later extracts transaction-aware order writer.
- Return exact codes: `EXPIRED`, `NOT_STARTED`, `MIN_ITEMS`, `MIN_SUBTOTAL`, `USAGE_LIMIT`, `AUTH_REQUIRED`, `INVALID`. `ValidatePromoResponse.error` carries code; W1.D owns messages + checkout display.
Coordination: merge W1.C before creating W1.D branch. W1.D calls frozen helpers and owns redemption transaction use.
Acceptance: SAVE10 unchanged (10%, min 5); fixed voucher applies; expired/future/min-subtotal/global-limit codes exact; anonymous WELCOME5 -> `AUTH_REQUIRED`; authenticated first use succeeds and second -> `USAGE_LIMIT`.

### W1.D Payment gateway (BE+FE)
Owns: `domains/payments.ts`, `domains/orders.ts` transaction refactor, `routes/payments.ts`, `api/payments.ts`, `features/checkout/PaymentPage.tsx`, `features/checkout/CheckoutPage.tsx`, `hooks/useCheckout.ts`.
BE:
- Fake gateway: `4242424242424242` succeeds; `4000000000000002` -> `CARD_DECLINED`; `4000000000000069` waits 250ms -> `GATEWAY_TIMEOUT`; other valid-Luhn succeeds. Card brand: Visa for leading 4, Mastercard for 51-55/2221-2720, `unknown` otherwise. 402 body: `{error:"Payment failed", failureReason:<code>}`.
- Idempotency fingerprint: SHA-256 of stable normalized `PayBody`, including normalized PAN but never persist raw payload. Existing key + same fingerprint -> reconstruct prior 200/402 response without gateway/order write. Existing key + different fingerprint -> 409. `idempotencyKey`: trimmed 8..128 characters.
- Flow: fingerprint/idempotency lookup -> validate cart -> validate promo with `request.user?.id` -> gateway. Decline/timeout -> one transaction inserts failure payment only; no order/redemption/mailbox/cart deletion; return 402.
- Success transaction: create order + line items with optional `user_id` -> insert succeeded payment -> record promo redemption + increment count -> insert order-confirmation mailbox message -> delete cart. All commit or roll back together.
- Refactor orders domain: `createOrderInTransaction(db, params)` performs writes without opening transaction; `placeOrder(params)` legacy wrapper opens transaction and preserves `/api/checkout`. No stock decrement; stock-race lesson remains deferred.
- Store `card_last4` + `card_brand` only; never persist full PAN/cvc.
- Attach `user_id` from `request.user` if logged in (guest -> NULL).
FE:
- Checkout: step 1 shipping/contact, prefill name/email from user, validate -> navigate `/checkout/payment` with shipping data in React Router state. Missing state/refresh on payment route -> redirect `/checkout`; never persist card data. Payment page shows card, summary, promo. Promo codes map exact codes to messages. Generate idempotency key on entering payment; duplicate submits reuse it. Any cart/shipping/card/promo edit generates new key. After 402, explicit Retry starts new attempt with new key. Success -> clear local cart -> `/order-confirmation/:orderId`.
Acceptance: success card -> order + confirmation + mailbox msg; declined/timeout cards -> 402, no order; same idempotency key -> single order; guest + logged-in both work; 5-item gate + SAVE10 still enforced.

## Wave 2 — account-dependent slices

### W2.A Favourites / wishlist (BE+FE)
Owns: `domains/favourites.ts`, `routes/favourites.ts`, `api/favourites.ts`, `hooks/useFavourites.ts`, `features/wishlist/WishlistPage.tsx`, `components/WishlistButton.tsx`, post-W1.B `ProductCard.tsx` + `ProductPage.tsx` wiring.
BE (all `requireAuth`): `GET /api/favourites` -> Product[]; `POST /api/favourites {productId}` (idempotent via UNIQUE); `DELETE /api/favourites/:productId`.
FE: WishlistButton heart toggle (optimistic) on ProductCard + ProductPage; anon click -> redirect/prompt login. `/wishlist` lists favourited products with remove + add-to-cart.
Acceptance: toggle persists across reload; wishlist page reflects state; anon prompted to login.

### W2.B Account hub (FE + password change)
Owns: `features/account/AccountPage.tsx`, account-only components, `routes/auth.ts` post-W1.A handoff, `domains/auth.ts` password-change extension, `api/auth.ts` extension.
BE: `PATCH /api/auth/password`; require current password, validate new password 8..128, reject same password, update hash/salt, invalidate other sessions, keep current session.
FE: `/account` -> displayName, email, role, logout, wishlist link, change-password form. No display-name edit endpoint. Guarded.
Acceptance: current user renders; wrong current password rejected; valid change succeeds; current session remains; old password login fails; new password login succeeds.

Note: "My Orders" history + order-status lifecycle intentionally OUT of scope (user declined). Keep `orders.user_id` populated -> future orders-history slice stays pure addition. Do NOT build order-history UI.

## Wave 3 — integration, polish, verify (serial)

Single agent.
- Home page `/`: hero + search entry, category tiles from `/api/products/categories`, bestsellers row, on-sale row (`/api/products?onSale=true&pageSize=8`), newest/featured grid (`/api/products?sort=newest&pageSize=8`). Use global UI-skill fallback rule.
- Finalize Header/nav: search active -> `/catalog?q=`, account menu states, wishlist count badge (from favourites when authed), cart count (existing).
- Cross-cutting polish: loading/empty/error states for new pages (reuse `LoadingSpinner`, `ErrorMessage`), toasts for add-to-cart/favourite/promo, form validation messages, `formatMoney` everywhere, 404 route.
- Seed verify: run `npm run reset && npm run seed`; assert exact counts + `SAVE10` values from seed verification spec.
- Full manual smoke against `http://127.0.0.1:5173`; use browser-control skill when available, else normal browser + HTTP requests. Never use `file://`. Start `npm run dev`, wait <=60s for `GET http://127.0.0.1:3001/health` 200 + Vite 200, capture evidence, stop only task-started server.
- Smoke cases: guest search/filter/sort/page -> product/related -> cart -> FE 5-item gate -> SAVE10 -> success card -> confirmation/mailbox; signup -> me -> favourite/reload/wishlist -> prefilled checkout -> WELCOME5 first success -> logout/login; forgot/reset via mailbox -> old login fails/new login succeeds; decline + timeout -> 402/no order; same success key -> same single order; same key changed body -> 409; EXPIRED10/SOON10/LIMITED5 exact rejection; legacy `/api/checkout` still succeeds.
- Quality gate: run `npm run format:fix` after edits -> `npm run typecheck` -> `npm run lint` -> `npm run format`. All exit 0.
- Docs: update `README.md` (human-oriented -> normal prose: new features, test cards, demo credentials, dev mailbox). Append TLDR to [demo_project_high_level_plan.md](demo_project_high_level_plan.md) Phase-1 log. Do NOT spoil course reveals.

## Seed data spec (Wave 0 owns)

Products: exactly 45 across categories: Audio, Peripherals, Displays, Accessories, Storage, Networking, Power, Cables, Wearables, Smart Home. Each: name, description, price_cents, category, stock_count (mix incl. low stock 1-3 and out-of-stock 0), image_url, unique kebab slug, compare_at_price_cents (14 products on sale, > price), sales_count 0..500. Keep existing 8 IDs/values stable except additive fields.
Images: reuse only `apps/web/public/images/*`; map new products deterministically across existing eight images. No external fetch/new image requirement. Preserve existing paths.
Users (documented in README): `alice@example.com` / `Password123!` role customer; `bob@example.com` / `Password123!` role customer; `admin@example.com` / `Password123!` role admin. Hash through `utils/passwords.ts` at seed time.
Promos/vouchers:
- `SAVE10` -> percent 10, min_item_count 5, active. FROZEN.
- `SAVE20` -> percent 20, min_subtotal_cents 10000, active.
- `WELCOME5` -> fixed amount_cents 500, per_user_limit 1, active.
- `VIP15` -> percent 15, active.
- `EXPIRED10` -> percent 10, ends_at in past (rejection test).
- `SOON10` -> percent 10, starts_at in future (not-started test).
- `LIMITED5` -> fixed 500, max_redemptions 1, redeemed_count 1 (deterministic usage-limit rejection).
Favourites: exactly 3 for alice, referencing in-stock products.
Mailbox: seed inserts/deletes nothing. Reset clears mailbox; reset+seed result empty.

Seed verification after `npm run reset && npm run seed`: products=45, users=3, promo_codes=7, favourites=3, sessions=0, dev_mailbox=0. Assert `SAVE10`: kind=percent, discount_percent=10, min_item_count=5, active=1.

## Deferred / out of scope (do not build)

- Automated tests (course writes them). Admin panel + RBAC UI. Reviews/ratings. Order-status lifecycle state machine + My-Orders history UI. Real email/SMTP. Shipping/zip validation (Phase 2 M8). Race condition (Phase 2 M9). Kafka/multi-service/contract tests (Phase 3 later). Real payment provider.

## Orchestrator completion condition

Continue until every section `complete` or blocked by user-authority need. Difficulty, context compaction, agent timeout, failed review, or check failure are not completion conditions; use recovery protocol.

Before final response:

1. Confirm all section progress notes committed on `codex/demo-project-expansion`.
2. Run final `npm run reset` -> `npm run seed` -> exact seed assertions -> `npm run typecheck` -> `npm run lint` -> `npm run format`.
3. Run full Wave 3 smoke from clean reset state. Confirm task-started servers stopped.
4. Inspect `git status`; integration worktree clean. Preserve unrelated main-worktree state.
5. Report integration branch, final SHA, section merge SHAs, checks, smoke evidence, deferred scope, remaining concerns. State starting branch not auto-merged.
