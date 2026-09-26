# apps/api

## Architecture

- Layering: `src/routes/*` -> `src/features/<name>/*Service` -> `*Repository` -> SQLite. Routes stay thin: call service, map failure via `sendPublicError`.
- Composition root: `src/app.ts`. `createAppServices()` instantiates repos/services; `buildApp()` registers routes with shared `AppContext`. New service -> add to `AppServices` + instantiate + `app.register(routes, context)`.
- Plugin order in `buildApp()` matters: `authPlugin` before `countryContextPlugin` (country reads `request.authenticatedUser`).
- Validation: route `schema` uses `@shop/contracts` TypeBox via `TypeBoxTypeProvider`. Ajv `removeAdditional: false` -> unknown body fields rejected 400, not stripped.
- Errors: `src/utils/errors.ts` `sendPublicError(request, reply, status, code, meta?)` only. Never `reply.send({ error })` by hand. Global error handler never leaks exception text.
- Auth: `src/plugins/auth.ts`. Cookie `sid` session, resolved once in `preValidation`. Route guards `requireAuth` / `requireCustomer` / `requireAdmin`. `requireCustomer` rejects admins. No CSRF layer; sameSite=lax only.
- Country: `src/plugins/countryContext.ts` sets `request.resolvedCountry`. `x-shop-country` header honoured for admins and guests only; buyers always get account country.
- Transactions: `src/db/unitOfWork.ts`, single shared instance from `app.ts`. Nested `run()` -> savepoint. Mutating services take `unitOfWork`, `audit`, `clock` deps.
- Security: passwords scrypt via `src/utils/passwords.ts`. Only card last4/brand persisted; DB CHECK constraints enforce payment-method field exclusivity.

## Database

- Migrations: `src/db/migrations/NNN_name.ts`, registered by explicit append to array in `src/db/migrations/index.ts`. Append-only at tail; never edit, renumber, or insert before applied ones (`migrate.ts` validates applied history is prefix).
- Table rebuild migrations: copy shape of latest migration in `index.ts` -> completion guard (no-op if applied), temp table + copy + row-count check, `PRAGMA foreign_key_check`. `migrate.ts` runs FK check after each `up()`.
- Seed `src/db/seed.ts`: idempotent. Canonical products (ids from `@shop/catalog` pools) upserted; other rows insert-or-ignore; non-seed rows preserved. Calls `validateCatalog()` first.
- Reset `src/db/reset.ts`: deletes data in FK-safe order, keeps schema and `audit_events`, recreates immutability triggers, then re-seeds.
- Runtime truth for products/stock/prices = SQLite, not `@shop/catalog`. Catalog edits reach DB only via seed/reset.

## Exemplars

- read endpoint -> `src/routes/products.ts` + `src/features/catalog/`
- mutation + audit -> `src/routes/cart.ts` + `src/features/cart/`
- async job feature -> `src/routes/backInStock.ts` + `src/features/backInStock/`

## Pitfalls

- New immutable (append-only) table -> add its no-update/no-delete trigger pair to `reset.ts` too, else invariant vanishes after reset.
- Checkout has no `routes/checkout.ts`; entry is `src/routes/payments.ts` -> `services.checkout`.
- `src/server.ts` starts `jobRunner` 1s interval in dev server -> due jobs self-drain; admin "drain" not only trigger. Deterministic job tests use services directly, not live server.
- Webhook route authenticates by HMAC `x-webhook-signature` over raw body, not session.
