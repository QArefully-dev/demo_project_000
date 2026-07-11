# Demo Project Expansion — Section Specification

Audience: bootstrap, section, review, merge, gate, final-verification coordinators. Root orchestrator does not read unless escalation requires it.

Global control rules: [demo_project_expansion_plan.md](demo_project_expansion_plan.md). Project rules: [CLAUDE.md](../CLAUDE.md).

## Architecture

- monorepo: `apps/web`, `apps/api`, `packages/contracts`
- contracts: TypeBox in `packages/contracts/src/schemas.ts`; export from `src/index.ts`; reuse `MoneyCents`, `ErrorResponse`
- API: thin typed routes -> pure domains -> SQLite DB
- domain errors: result/error unions; routes translate to HTTP
- DB: `ensureSchema`; WAL; foreign keys on; guarded additive migrations; snake_case DB -> camelCase API
- seed: deterministic upsert; reset: FK-safe deletes
- web: feature folders, shared UI components, React Router under `Layout`, `formatMoney`, `CartContext`
- stack: React 18, Fastify, Vite, TypeScript strict, Tailwind v4, base-ui, lucide-react, Node 22
- UI: polished desktop at `1366x768` and 4K; predictable teaching behavior

## Data model

New tables:

- `users`: id, unique email, display name, password hash/salt, role, created timestamp
- `sessions`: token, user FK cascade, created/expires timestamps
- `password_reset_tokens`: user FK cascade, unique token, expires/used timestamps
- `dev_mailbox`: recipient, subject, body, kind, created timestamp
- `favourites`: user/product FKs, created timestamp, unique user/product
- `payments`: nullable order FK, unique idempotency key, request fingerprint, status, amount, required last4/brand, nullable failure reason, created timestamp
- `promo_redemptions`: code, nullable user/order FKs, created timestamp

Additive columns:

- products: `slug`, `compare_at_price_cents`, `sales_count`
- promo codes: `kind`, `amount_cents`, `min_subtotal_cents`, start/end, max/redemption count, per-user limit
- orders: nullable `user_id`

Timestamps: application UTC ISO 8601 strings. Money: integer cents. Never store or return PAN/CVC/password/hash/salt.

Reset delete order: payments -> promo redemptions -> favourites -> reset tokens -> sessions -> mailbox -> order lines -> orders -> cart lines -> carts -> promo codes -> products -> users.

## API contracts

Products:

- `Product`: existing fields + `slug`, optional `compareAtPriceCents`, `salesCount`
- `ProductQuery`: optional `q`, `category`, `onSale`, `sort`; page 1..10000 default 1; pageSize 1..48 default 12
- sort: `newest|price_asc|price_desc|bestselling`
- product list: `{items,total,page,pageSize}`
- categories: string array; bestsellers <=8; related <=4

Auth:

- signup: email, password, displayName
- login: email, password
- forgot: email; reset: token + newPassword; change: currentPassword + newPassword
- public user: id, email, displayName, role `customer|admin`
- `/me`: public user or null
- mailbox message: id, recipient, subject, body, kind, created timestamp
- success: `{success:true}`

Favourites: product ID body/param; response product array.

Promo:

- kinds: `percent|fixed`
- validation errors: `EXPIRED|NOT_STARTED|MIN_ITEMS|MIN_SUBTOTAL|USAGE_LIMIT|AUTH_REQUIRED|INVALID`
- preserve existing response fields; optional exact error code

Payment:

- body: cart ID, optional promo, customer name/email/address, card fields, idempotency key
- card number: spaces allowed, normalize digits, length 12..19, valid Luhn
- expiry current/future; CVC 3..4 digits
- success: order
- 402: `{error:"Payment failed",failureReason:"CARD_DECLINED"|"GATEWAY_TIMEOUT"}`
- reused key + changed normalized payload: 409

All routes schema-validated. Validation -> 400 `ErrorResponse`; unexpected -> 500. Unfinished Wave 0 stubs -> 501 `{error:"Not implemented"}`. Static product routes register before `/:id`.

Endpoint manifest:

- products: `GET /api/products`, `/categories`, `/bestsellers`, `/:id`, `/:id/related`
- auth: `POST /signup`, `/login`, `/logout`, `/forgot-password`, `/reset-password`; `GET /me`; `PATCH /password`
- mailbox: `GET /api/dev/mailbox`
- favourites: `GET/POST /api/favourites`; `DELETE /api/favourites/:productId`
- promo: `POST /api/promo/validate`
- payment: `POST /api/payments/pay`
- legacy: `POST /api/checkout`; `GET /api/orders/:orderId`

Auth cookie: `sid`; random 32-byte hex; httpOnly; SameSite=Lax; Path=/; Max-Age=604800; secure false for local HTTP. Normalize email trim + lowercase. Password 8..128. Display name trimmed 1..80.

## Ownership

Wave 0 initial shared-file owner:

- contracts schemas/exports
- DB connection, seed, reset
- API index, plugin registration, route stubs
- web App routes, nav items, Header seams, CSS tokens
- core web API client

Leaf files -> one active owner.

Handoffs:

- `domains/orders.ts`: Wave 0 -> W1.C -> W1.D
- auth domain/route/web API: W1.A -> W2.B
- ProductCard/ProductPage: W1.B -> W2.A
- Header: Wave 0 -> W1.A -> Wave 3
- CheckoutPage/useCheckout: W1.D only
- promo domain: W1.C frozen before W1.D

Unlisted shared-file need -> coordinator stops edit and requests ownership decision. No parallel edits across handoff.

## Wave 0 — Foundations and seams

One section: `wave0`.

Tasks:

- define/export all contracts
- create all tables, guarded columns, reset order
- add `utils/passwords.ts`: scrypt hash/verify using `node:crypto`
- seed full deterministic dataset; preserve `SAVE10`
- install `@fastify/cookie`; register root-level auth plugin before routes
- auth plugin: cookie parse, session/user hydration, internal session token, `requireAuth`; never serialize token
- create schema-valid 501 route/domain seams
- extend errors with 401, 402, 409 helpers
- split web API client into core fetch plus cart/orders/promo/products modules; credentials included
- add auth/favourites/payment API seams and AuthContext skeleton
- add routes/pages: home, catalog, product, cart, checkout, payment, confirmation, login, signup, forgot/reset, account, wishlist, mailbox
- guard account/wishlist; wire navigation; keep CSS tokens unchanged

Acceptance:

- contracts build; typecheck, lint, format, reset, seed pass
- existing catalog -> cart -> checkout -> confirmation works
- new placeholder pages render; stub APIs return 501

## W1.A — Auth

Owns auth/mailbox domains/routes/API, AuthContext, auth pages, route guard, mailbox page, Header handoff.

Tasks:

- signup/login/logout/me with sessions and cookie
- scrypt utility reuse; constant-time comparison
- forgot response always success; existing user gets 30-minute reset token + mailbox link
- reset rejects invalid/used/expired token, updates hash, marks used, invalidates sessions
- login/signup/forgot/reset pages; AuthContext refresh on mount
- Header anonymous/authenticated menu
- dev mailbox list with clickable reset link

Acceptance: signup -> login -> me -> logout; forgot -> mailbox -> reset; anonymous guard redirect.

## W1.B — Catalog and product

Owns product domain/routes/API, catalog/product pages, product hooks, ProductCard, SearchBar, CategoryNav.

Tasks:

- paginated query with escaped LIKE, exact case-insensitive category, sale filter, stable sort tiebreakers
- product ID validation: malformed/non-positive 400; missing positive 404
- sorted categories; top 8 bestsellers; four same-category related products
- URL-source-of-truth catalog with 300ms search debounce, filter/sort/page reset
- sale display; bestseller badge at sales count >=250
- product detail, stock state, cart action, related row, inactive WishlistButton seam

Acceptance: search/filter/sort/page drive results; detail/related load; sale values render.

## W1.C — Promotions

Owns promo domain/route/API and minimal legacy orders compatibility.

Required exports:

- `validatePromoCode({code,cartId,userId})`
- `calculateDiscount({promo,subtotalCents})`
- `recordRedemption({db,promo,userId,orderId})`

Rules:

- enforce active, UTC window, item/subtotal minimum, global/per-user limit
- anonymous + per-user promo -> `AUTH_REQUIRED`
- fixed discount capped at subtotal; percent uses existing integer formula
- legacy order path validates, calculates, records redemption inside transaction
- preserve `SAVE10` and scalar promo behavior

Acceptance: exact rejection codes; fixed promo works; `WELCOME5` first authenticated use only; `SAVE10` unchanged.

## W1.D — Payment

Starts after W1.C merge. Owns payments, orders transaction refactor, payment route/API/page, CheckoutPage, useCheckout.

Gateway cards:

- `4242424242424242` -> success
- `4000000000000002` -> decline
- `4000000000000069` -> 250ms timeout
- other valid-Luhn -> success

Tasks:

- detect Visa and Mastercard ranges; unknown otherwise
- SHA-256 stable normalized body fingerprint; raw body never stored
- same key/fingerprint replays prior response; changed fingerprint -> 409
- decline/timeout transaction writes payment only
- success transaction writes order/lines/payment/redemption/mailbox and deletes cart atomically
- attach authenticated user ID; guest null
- refactor transaction-aware order writer; legacy checkout remains independent from gateway
- shipping/contact step -> Router state -> payment step; missing state redirects
- never persist card data client-side; regenerate idempotency key after input changes/retry; duplicate submit reuses key
- exact promo error messages; successful payment clears cart and opens confirmation

Acceptance: success, decline, timeout, replay, conflict, guest/auth flows; no PAN/CVC storage; M1 gate and `SAVE10` preserved.

## W2.A — Favourites

Depends on W1.A + W1.B. Owns favourite domain/route/API/hook/page/button plus ProductCard/ProductPage wiring.

Tasks:

- authenticated list, idempotent add/remove
- optimistic heart toggle; anonymous action prompts/redirects login
- wishlist list, remove, add to cart

Acceptance: toggle persists after reload; wishlist matches; anonymous user reaches login.

## W2.B — Account

Depends on W1.A. Owns AccountPage/components and auth password-change extensions.

Tasks:

- authenticated password change
- verify current password; reject same/invalid new password
- update hash; invalidate other sessions; preserve current session
- account displays user fields, logout, wishlist link, password form

Acceptance: wrong password rejected; valid change keeps current session; old login fails; new login succeeds.

## Wave 3 — Integration and polish

One section: `wave3`.

Tasks:

- home: hero/search, categories, bestsellers, sale row, newest grid
- Header: search, account states, wishlist count, cart count
- loading/empty/error states, toasts, validation messages, money formatting, 404
- reset/seed exact-count verification
- full manual smoke via `http://127.0.0.1:5173`; never `file://`
- run `format:fix`, typecheck, lint, format
- update human README with features, cards, credentials, mailbox
- append Phase-1 TLDR to high-level plan

Smoke:

- guest catalog/search/filter/sort/page -> product/related -> cart -> 5-item gate -> `SAVE10` -> pay -> confirmation/mailbox
- signup -> me -> favourite/reload/wishlist -> prefilled checkout -> first `WELCOME5` -> logout/login
- forgot/reset through mailbox; old login fails; new login succeeds
- decline/timeout -> 402 and no order
- same key -> one order; changed body -> 409
- `EXPIRED10`, `SOON10`, `LIMITED5` exact rejection
- legacy checkout succeeds

## Seed specification

- products: exactly 45 across Audio, Peripherals, Displays, Accessories, Storage, Networking, Power, Cables, Wearables, Smart Home
- preserve existing eight product IDs/values; add unique slugs, 14 sale products, sales count 0..500; deterministic existing local images only
- users: alice, bob, admin at `@example.com`; password `Password123!`; roles customer, customer, admin
- seed rehashes passwords and removes seeded-user sessions/unused reset tokens
- promos: `SAVE10` percent 10/min 5; `SAVE20` percent 20/min subtotal 10000; `WELCOME5` fixed 500/per-user 1; `VIP15` percent 15; expired `EXPIRED10`; future `SOON10`; exhausted `LIMITED5`
- favourites: exactly 3 for alice, in-stock products
- mailbox: reset clears; seed leaves empty

Exact post-reset counts: products 45, users 3, promo codes 7, favourites 3, sessions 0, mailbox 0. Assert `SAVE10`: percent, 10, minimum 5, active.
