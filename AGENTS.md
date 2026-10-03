# QArefully Materials Exchange

Local-only bulk-materials wholesale shop for QA education. npm workspaces monorepo; no external services. README.md holds demo data, seeded credentials, test cards, admin HTTP recipes.

## Repository map

- `apps/api`: Fastify 5 + better-sqlite3 API, port 3001. Owns persistence, workflows, permissions.
- `apps/web`: React 18 + Vite + react-router + Tailwind/shadcn, port 5173; proxies `/api` and auth paths to API.
- `packages/contracts`: TypeBox transport schemas, public error codes, country profiles. Transport only; must not import `@shop/catalog` or app source.
- `packages/catalog`: canonical products, packaging, `MIXING_GROUPS`.
- `packages/localisation`: per-country messages, money/date/number formatting.
- `e2e`: Playwright specs + page objects; see e2e/README.md.
- `scripts`: `check:localisation` guard, test profiler.
- `workshop`: exercise tickets/prompts; not app code.

Dependency direction: packages -> apps. Web imports API only via `@shop/contracts/*`, never `apps/api` (ESLint `no-restricted-imports`). Packages and scripts never import `apps/**`.

## Runtime

- Node 22.x only (`engines`; API integration runner asserts it).
- `better-sqlite3` native build; Windows needs VS Build Tools C++.
- DB: `SHOP_DB_PATH`, default `apps/api/data/shop.db` (gitignored). `openDatabase` migrates on every open.
- Packages consumed from `dist/` via `exports` maps. After editing a package -> `npm run build -w @shop/<pkg>` before app typecheck/tests see it.

## Commands

- Setup/run: `npm ci` (postinstall builds packages); `npm run dev` (seeds, then API + web); `npm run seed` (idempotent upsert)
- Checks: `npm run typecheck`; `npm run lint`; `npm run format` / `format:fix`; `npm run check:localisation`
- Tests: `npm run test:packages`; `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` (needs `npx playwright install chromium`; starts or reuses `npm run dev`)
- Gates: `npm test` (packages + unit + integration); `npm run smoke` (typecheck + unit + integration); `npm run verify` (format, localisation, typecheck, lint, test, build)
- Scoped: `npm run <script> -w @shop/<api|web|contracts|catalog|localisation>`; one API integration file: `npm run test:integration -w @shop/api -- test/cart/cart.integration.test.ts`
- Destructive: `npm run reset` drops all user data and reseeds; ask before running.

## Architecture

API layering: route (`apps/api/src/routes/*.ts`, TypeBox schemas from contracts) -> service (`features/<domain>/<x>Service.ts`, `createXService(deps)`) -> repository (`<x>Repository.ts`, raw SQL). Pure logic in `<x>Rules.ts` with colocated `<x>Rules.test.ts`.

- Wiring: hand-written in `apps/api/src/app.ts` `createAppServices`; no DI container. Construction order is load-bearing (comments mark hoisted deps). New feature -> route file + `app.register`, factories wired there, `AppServices` field.
- Plugins: `plugins/auth.ts` then `plugins/countryContext.ts`, called directly (root hooks). `request.resolvedCountry`: admin header override -> user country -> guest header -> `US`.
- Cart, checkout, orders use persisted cart/quote country, never request country.
- Transactions: `apps/api/src/db/unitOfWork.ts` (sync better-sqlite3; nested `run` = savepoint). Only thrown errors roll back; returned failure unions/Results commit prior writes. `inventoryService` is transaction-free; callers wrap it.
- Errors: services return string unions, `{ok,...}` Results, or throw domain error classes; only routes map to public codes via `sendPublicError` (`apps/api/src/utils/errors.ts`). Never send literal error text; `check:localisation` flags it.
- New public error code -> `packages/contracts/src/publicErrors.ts` (append-only; meta schema if parameterised) + `packages/localisation/src/messages/apiErrors.ts` + route mapping + tests in `packages/contracts/test/public-errors.test.ts`, `packages/localisation/test/api-errors.test.ts`, `apps/api/test/errors/`.
- Audit: new action -> `AUDIT_ACTIONS`, `AuditEventInput`, `buildAuditEvent` in `features/audit/auditEvent.ts` + its test. Written inside caller's transaction.
- Money: integer GBP pence everywhere persisted/charged. Country rates convert display only; never store converted amounts.
- Contracts module: source file + `exports` entry in `packages/contracts/package.json` + re-export in `src/index.ts`.
- Custom Blend: API (`apps/api/src/features/customBlend/`) sole authority for compatibility, pigment cap, food/non-food classification, all money. Web (`apps/web/src/features/customBlend/`) validates only structural bounds from `packages/contracts/src/customBlends.ts` (1-4 ingredients, 5-50% each, ingredient total <= 50%, base = 100 - ingredients, 50-95%); never re-implement server rules in web.

Web:

- Provider order in `apps/web/src/main.tsx`/`App.tsx` is load-bearing: Auth -> Country -> Locale -> ... -> Cart.
- API calls: one function per endpoint in `apps/web/src/api/<x>.ts` via `apiFetch(schema, ...)` (`api/client.ts`). Every 2xx is validated against schema; mismatch or empty body -> `ApiContractError`. Some web-local schemas (`api/products.ts`, `api/adminProducts.ts`, `api/adminVariants.ts`, `api/standingOrders.ts`) use `additionalProperties: false`; update them with API shape changes.
- Errors: keep `{code, meta}` and localise at render (exemplar `features/checkout/checkoutCopy.ts`). Never render `error.message`.
- `AdminRoute`/`ProtectedRoute` are presentation guards; API is permission authority.

Localisation: user-visible text goes through `@shop/localisation/messages/<area>` with entries for all 7 countries (UK, US, CN, PL, ES, DE, FR); `translate` throws on missing key/param. `scripts/check-localisation-core.mjs` AST-scans `apps/` and `packages/` for literal JSX text, visible props, error setters, `Intl`/`toLocale*`; exemptions are exact-path `ALLOWLIST` entries only.

Exemplars: result-style feature `apps/api/src/routes/savedLists.ts` + `features/savedLists/*`; versioned idempotent admin command `routes/adminOrders.ts` -> `features/orders/orderService.ts`; web async hook `apps/web/src/hooks/useProducts.ts`.

## Flows

Checkout / payment intent; POST `/api/payments/pay` -> `apps/api/src/routes/payments.ts`
- `checkoutService.process` (`features/checkout/checkoutService.ts`) -> `prepare`: safe fingerprint (`payments/paymentRepository.ts`, no PAN/CVC) -> idempotency replay/conflict by key -> preparation UoW gates (cart, country block, Custom Blend recheck, MOQ, delivery/billing commitments, slot, promo, approvals) -> reservations (credit hold, cart, promo, inventory 15 min lease) -> `checkoutQuote.ts` persisted quote -> gateway call outside any transaction -> authorize UoW -> `checkoutFinalizer.ts` UoW (order, commit reservations, invoice or receipt mailbox, remove cart, `succeeded`).
- Payment states (`paymentRepository.ts`): `prepared` -> `authorized_pending_finalize` -> `succeeded`; `prepared` -> `declined|timed_out|failed_pre_gateway`. CAS on expected status.
- Invariants: pre-reservation gate failures return via `failPreparation`; post-reservation failures release reservations in reverse order; finalizer throw keeps authorization so same key resumes; persisted quote is source of truth at finalization; changing fingerprint inputs breaks replay of existing keys.
- Change set: `checkout{Service,Types,Quote,Finalizer}.ts`, `paymentRepository.ts`, `packages/contracts/src/payments.ts` (new `PersistedCheckoutQuoteVn` + parser union if quote shape changes), route switch (exhaustive `never`), public errors, migration if columns change.
- Web: `features/checkout/useCheckoutFlow.ts` -> `usePaymentSubmission.ts`. Steps `delivery -> schedule -> payment` live only in `?step=`. Idempotency key (`checkoutState.ts`) rotates on any input/quote/identity/promo change and on 409, except `PENDING_APPROVAL`/`APPROVAL_REJECTED`. New conflict code -> `checkoutConflict`, `CheckoutConflict` type, `CheckoutPage` banner, messages, `CheckoutPage.paymentConflicts.test.tsx`.

Web cart state; UI -> `hooks/CartContext.tsx` -> `hooks/useCart.ts` (reducer) -> `hooks/cartClient.ts` -> `api/cart.ts`
- Cart id in localStorage per country (`lib/cartStorage.ts`); country change re-seeds id. Async continuations check country ref and mutation sequence to drop stale responses.
- 404 `CART_NOT_FOUND` -> recover (new cart) and replay add-type actions; update/remove/blend-replace do not replay.
- Line identity `productId:variantId:configKey` in `lib/cartLineIdentity.ts`; `components/CartLineItem.tsx` keeps its own copy, keep in sync.
- New `useCart` return field -> update hand-built `@/hooks/CartContext` mocks across tests (grep `vi.mock('@/hooks/CartContext'`).

API cart; `routes/cart.ts` -> `features/cart/cartService.ts` in `runCartMutation` (UoW + audit)
- Guard order: cart exists -> `getCart` resolves -> not reserved by checkout -> country block -> variant -> MOQ/pricing (`features/pricing/pricingRules.ts`) -> write -> rehydrate.
- `getCart` returns `undefined` if any configured line fails rehydrate; whole cart then reads `CART_NOT_FOUND` for reads and all mutations, plain lines included (asserted in `apps/api/test/cart/customBlendCart.integration.test.ts`).
- Add with `BLOCKED_IN_COUNTRY` maps to 404 `VARIANT_NOT_FOUND`.

Stock -> back-in-stock -> notifications; admin receipt `routes/adminInventory.ts`, order cancel, return receipt, admin variant stock edit
- `inventoryService.receiveStock` -> backorders filled -> `inventory/stockObserver.ts` -> `backInStock/backInStockTrigger.ts` enqueues `back_in_stock.notify` (dedupe key) -> job runner -> `backInStockNotifyHandler.ts` (re-reads state; requires `availableToSell >= MOQ`) -> `notificationService.notify` enqueues `notification.deliver` -> `notificationDeliveryHandler.ts` writes mailbox if preference allows.
- Uses subscriber's persisted country. Checkout reservation release does not fire alerts.

Job queue; `features/jobs/jobService.ts`, 1 s runner from `server.ts`, admin drain POST `/api/admin/jobs/run`
- Claim (UoW, 30 s lease) -> handler from `jobHandlerRegistry.ts` awaited outside transaction -> settle UoW; retry backoff, `dead` after max attempts (`packages/contracts/src/jobs.ts`).
- New job kind -> `JobKind` in `packages/contracts/src/jobs.ts` + `jobKinds` Set in `jobService.ts` + `registry.register` in `app.ts`; optional fault flag in `jobs/faultSwitch.ts`.
- Webhooks: `routes/webhooks.ts` (HMAC verify, raw body) -> `webhookService.capture` -> `webhook.process` job -> `webhookProcessingHandler.ts` payment transition.

Schema change
- New `apps/api/src/db/migrations/0NN_*.ts` appended to `migrations/index.ts` (latest `038`); table rebuild pattern `038_payment_user_identity.ts`.
- `apps/api/src/db/reset.ts` deletes tables in FK-safe order and recreates immutability triggers inline; new table -> add DELETE; new immutable table -> trigger DDL in migration and `reset.ts`.
- Seed: `db/seed.ts` (catalog from `@shop/catalog`, then scenario seeders). Tests: `apps/api/test/db/`.

## Testing

- API unit: `apps/api/src/**/*.test.ts` auto-discovered; files under `apps/api/test/` that are unit tests must be listed explicitly in `apps/api/package.json` `test:unit`.
- API integration: `apps/api/test/**/*.integration.test.ts`, one process per file. `test/support/run-integration-tests.ts` builds a seeded DB template; `test/support/seededDatabase.ts` `createSeededAppFixture` clones it and builds app with injectable `clock`, `paymentGateway`, token sources. Requests via `app.inject`.
- Web: vitest + jsdom, setup `apps/web/src/test/setup.ts`; `*.integration.test.tsx` only via `apps/web/vitest.integration.config.ts`; `features/checkout/cartValidation.node-test.ts` runs under `tsx --test`. Tests mock `@/api/*` modules or stub global `fetch`.
- E2E: Playwright chromium, specs `e2e/*.spec.ts`, page objects `e2e/pages/`, seeded-data facts pinned as constants. Only `e2e/catalog.spec.ts` exists.

## Pitfalls

- Stale package `dist/`: contract/localisation edits invisible to apps until rebuilt.
- `IDEMPOTENCY_CONFLICT` (orders, jobs) and `IDEMPOTENT_CONFLICT` (checkout) both exist; match code already used by the flow being changed.
- `webhookProcessingHandler.ts` and `notificationDeliveryHandler.ts` write without a UoW; not atomic.
- `standingOrderService.enqueueDue` has no production caller; runs come only from run-now and job drain.
- e2e/README.md forbids `data-testid` and `.first()`, but app components and `e2e/pages/catalog-page.ts` use them; follow README for new code.

# Maintenance
Update this file or closest nested AGENTS.md/CLAUDE.md when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. AGENTS.md/CLAUDE.md conflict with repository evidence -> warn user with "WARNING".


# AI Documentation and Code Comments
Write any AI documentation (AGENTS/CLAUDE.md) or code comments in terse language, for future AI agents. Facts only, minimal language. No history, dates, just core info. Don't re-tell code, say only what can't be derived from code - architecture, decisions, cross-cutting concerns. Default is no comment at all. Leave comments and edit AI docs only if needed. No duplication between code comments or any AI docs. Information lives in one place only. 
