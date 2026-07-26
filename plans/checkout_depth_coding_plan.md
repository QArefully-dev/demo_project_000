# Checkout Depth Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `4. Checkout depth`
Repository baseline: branch `materials_exchange_refactor` @ `7d7e3ce`, inspected 2026-07-26

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD` before any write
- detached `HEAD` -> stop, ask user to select branch
- relevant uncommitted/untracked source changes absent from branch `HEAD` -> stop, ask user to commit or choose baseline; never stash, copy, discard
- create: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>` before first implementation write
- execution root: every worker, reviewer, test, fix, convergence action runs with worktree as working directory; repository-relative paths resolve under worktree root
- source checkout read-only after worktree creation, except saved plan + run-scoped temp state
- integration: no merge, rebase, cherry-pick, copy-back, worktree deletion, branch deletion; user handles merge into the source branch
- completion reply: absolute worktree path + implementation branch + source branch + base revision; user handles integration

## Objective

Close item 4 remaining scope -> B2B checkout captures where, when, who pays, and buyer reference. Deliver saved trade delivery sites (structured address model), billing entity, freight lead-time + bookable delivery slot, purchase-order reference. Server stays authoritative for address resolution, slot validity, totals. Complete when buyer journey `cart -> delivery -> schedule + billing -> payment -> confirmation -> order history` carries all four, persisted and displayed, with `npm run verify` green.

## Scope

### In

- structured postal address contract + `delivery_sites` per-user records; account CRUD; default site; retire-not-delete
- `billing_entities` per-user records (legal name, registration number, VAT number, billing address); account CRUD; default entity
- freight lead-time derivation from delivery class + cart weight against injected `Clock`; deterministic bookable slot list; slot re-validated at payment
- purchase-order / buyer reference captured at checkout, snapshotted on order, shown in confirmation + order history
- checkout UI restructured to 3 steps -> delivery -> schedule + billing -> payment
- order snapshots for delivery address, billing entity, slot, PO reference; confirmation email carries slot + PO reference
- seeded demo delivery sites + billing entities; README credentials/triggers

### Out

- gift options; parcel/express delivery-method choice (source plan drops both under B2B pivot)
- slot capacity, per-slot booking limits, slot contention (user decision 2026-07-26 -> deterministic slots, no capacity)
- persisted quote/RFQ object; trade-account net-price tiering; login-to-see-price (rejected directions)
- company accounts, approver roles, order-approval thresholds (item 7 `added (B2B)` scope, separate plan)
- session list, preferences, data export, account deletion (item 7 remaining, separate plan)
- pricing/promotion changes of any kind (item 5); no new charge, no tier or promo maths edit
- region/timezone localisation (item 10); slot dates computed in UTC only
- Playwright / E2E suites

## Repository Findings

- existing: `packages/contracts/src/common.ts:36` -> `ShippingAddress = Type.String({minLength:5,maxLength:500})`; address is free text end-to-end
- existing: `packages/contracts/src/orders.ts:213` -> `PlaceOrderBody`; no route consumes it -> obsolete contract
- existing: `packages/contracts/src/payments.ts:127` -> `PersistedCheckoutQuoteV6`, `CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 6`, strict single-version parser `parsePersistedCheckoutQuote`; version integer never restarts
- existing: `packages/contracts/src/delivery.ts` -> `DeliveryMode`, `DeliveryClass`, `DeliverySummary`, `FREIGHT_WEIGHT_THRESHOLD_GRAMS`, `FREIGHT_CHARGE_CENTS`; no lead-time or slot concept
- existing: `apps/api/src/features/delivery/deliveryRules.ts` -> `quoteDelivery`, `quoteCartDelivery`; pure, weight-driven
- existing: `apps/api/src/features/checkout/checkoutService.ts` -> `prepare` transaction owns cart resolve, blend eligibility, MOQ, promo reserve, cart reserve, inventory reserve, quote persist; `providerFailure`, `terminalizePreparedExpiry` own release paths
- existing: `apps/api/src/features/checkout/checkoutQuote.ts:59` -> `customer.shippingAddress` trimmed string; `totalCents = subtotal - discount + deliveryCharge`
- existing: `apps/api/src/features/checkout/checkoutFinalizer.ts:45` -> `orders.create` call; `:85` mailbox subject/body still says `QArefully Powder Co.` -> stale brand
- existing: `apps/api/src/features/payments/paymentRepository.ts:78` -> `createSafeFingerprint` hashes `cartId`, `promoCode`, name, email, `shippingAddress`, `cardExpiry`, brand, last4; PAN/CVC excluded
- existing: `apps/api/src/db/migrations/001_initial.ts:44` -> `orders.shipping_address TEXT NOT NULL`; `users` table has no address relation
- existing: migrations land at `022`; `apps/api/src/db/migrations/index.ts` is append-only ordered array; `022_custom_blends.ts` is the table-rebuild + `assertForeignKeysClean` reference pattern
- existing: `apps/api/src/routes/favourites.ts` -> per-user authenticated CRUD route pattern with `requireAuth(services.sessions)`
- existing: `apps/api/src/app.ts` -> single composition root; `AppServices` interface + `createAppServices`
- existing: `apps/web/src/features/checkout/` -> 2-step flow; `useCheckoutNavigation.ts` drives step off `?step=payment`; `checkoutState.ts` reducer holds `contact` + `card` records; `usePaymentSubmission.ts:67` sends flat `shippingAddress`
- existing: `apps/web/src/features/account/AccountPage.tsx` -> profile + password change only; no address UI
- existing: `apps/web/src/App.tsx` -> `/account` behind `ProtectedRoute`; nav slots full
- gap: no structured address type, no `delivery_sites`, no `billing_entities`, no lead-time, no slot, no PO reference, anywhere
- constraint: high-level plan marks `7 (address model) -> 4` sequential; item 7 address slice not built -> user decision 2026-07-26 assigns address model to this plan
- constraint: item 16 landed -> cart/order lines key on variant + `configKey`; line totals split discountable material subtotal vs non-discountable blending fee. This plan must preserve both untouched
- constraint: `deliveryClass` enum retains unused `parcel`; all seeded lots `freight`
- constraint: money integer minor units, backend authoritative; migrations append-only forward-only; runner owns FK suspension
- reuse: `favourites` route/service/repository shape -> trade account CRUD; `022` migration idioms -> `023`; `020` retire-not-delete precedent -> retired delivery sites; `deliveryRules.ts` purity -> slot rules; `customBlend` feature directory shape -> `tradeAccount` feature directory

## Decisions and Invariants

- server authoritative on destination: `deliverySiteId` supplied -> server loads stored site address; client-supplied address ignored. Contract models destination as discriminated union -> `{kind:'saved', deliverySiteId}` XOR `{kind:'adhoc', address}`. Same shape for billing entity selection
- saved site / billing entity must belong to `params.userId` and be `active = 1`. Anonymous checkout may use `adhoc` only. Cross-user id -> `404`-class domain error, never leak existence
- slot authority: buyer picks from server-offered list; checkout re-derives lead time inside preparation transaction and re-validates the submitted slot. Stale or unbookable slot -> `409 DELIVERY_SLOT_UNAVAILABLE`, no reservation, no gateway call, no money movement
- slot determinism: all dates derived from injected `Clock` in UTC; business days exclude Saturday/Sunday; no locale, no timezone profile (item 10 owns that)
- no capacity model. Two buyers may hold the same slot. Stated as product behavior, not oversight
- money unchanged: delivery slot, PO reference, billing entity, saved site add zero cents. `totalCents` formula, tier ladder, MOQ floor, promo maths, `CUSTOM_BLEND_FEE_CENTS` exclusion from discountable subtotal all stay byte-identical
- idempotency: `createSafeFingerprint` must hash formatted delivery address, resolved billing legal name, slot date + window, PO reference. Same key + any changed field -> `IDEMPOTENT_CONFLICT`; never silent replay under a changed destination or slot
- persisted quote bumps to `V7`; `CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 7`; parser accepts `V7` only; version integer never restarts (existing `payments.ts` TSDoc rule)
- `orders.shipping_address` stays NOT NULL and becomes the deterministic render of the structured address through one shared formatter in contracts -> no second formatting implementation, no drift
- new `orders` columns nullable; pre-existing rows keep NULL; matching `Order` contract fields optional, same style as existing `deliveryMode` / `deliveryChargeCents`
- delivery sites referenced by orders retire (`active = 0`), never delete (migration `020` precedent)
- one default delivery site and one default billing entity per user, enforced by partial unique index plus transaction-scoped flag swap
- feature reads from UI alone: sections named `Delivery sites`, `Billing details`, `Delivery slot`, `Purchase order reference`. No bespoke rule requiring explanation
- assumption (validate at `G0`): `plans/` holds only current plans; completed plans are removed, not archived under `plans/old/` despite CLAUDE.md reference. Do not create `plans/old/`
- assumption (validate at `G0`): repo has no address-format localisation requirement -> single generic postal shape with ISO-3166-1 alpha-2 country code

## Target Design

### Contracts

- new `packages/contracts/src/address.ts` -> subpath `./address`. `PostalAddress` object -> `line1`, `line2?`, `city`, `region?`, `postcode`, `countryCode`. Bounded string constraints; `countryCode` pattern `^[A-Z]{2}$`. Exports pure `formatPostalAddress(address): string` -> deterministic comma-joined single line, output length <= 500 so existing `orders.shipping_address` column and legacy readers stay valid
- new `packages/contracts/src/tradeAccount.ts` -> subpath `./trade-account`. `DeliverySite`, `BillingEntity`, create/update bodies, list responses, id params, `BillingEntityInput` (adhoc billing payload)
- extend `packages/contracts/src/delivery.ts` -> lead-time + slot constants, `DeliverySlotWindow` (`am` | `pm`), `DeliverySlot` (`date` `YYYY-MM-DD` + `window`), `DeliveryLeadTime` (`earliestDate`, `latestDate`, `businessDays`, `reason`), `DeliverySlotOptionsQuery`, `DeliverySlotOptionsResponse`
- extend `packages/contracts/src/orders.ts` -> `Order` gains optional `deliveryAddress`, `billingEntity` snapshot, `deliverySlot`, `purchaseOrderReference`. Retire unused `PlaceOrderBody`
- extend `packages/contracts/src/payments.ts` -> `PaymentBody` replaces `shippingAddress` with `deliveryDestination` union + `billingSelection` union + `deliverySlot` + optional `purchaseOrderReference`. New `PersistedCheckoutQuoteV7`. `PaymentConflictResponse` gains `DELIVERY_SLOT_UNAVAILABLE` member
- retire `ShippingAddress` from `common.ts` once both consumers move

### Schema

- migration `023_trade_delivery_and_checkout_depth.ts`, appended to `migrations/index.ts`
- `delivery_sites` -> `user_id` FK cascade, `label`, `contact_name`, `contact_phone`, address columns, `is_default`, `active`, timestamps; `UNIQUE(user_id, label)`; partial unique index on `(user_id) WHERE is_default = 1 AND active = 1`; lookup index `(user_id, active)`
- `billing_entities` -> `user_id` FK cascade, `legal_name`, `registration_number`, `vat_number`, billing address columns, `is_default`, `active`, timestamps; same uniqueness shape
- `orders` additive `ALTER TABLE ADD COLUMN` -> `delivery_site_id` (nullable FK), `delivery_address_json`, `billing_entity_json` (both JSON-validity CHECKed), `delivery_slot_date`, `delivery_slot_window` (CHECK in `am`,`pm`), `purchase_order_reference`. No `orders` rebuild -> shipment, allocation, movement, return, refund references untouched
- partial index on `orders(purchase_order_reference) WHERE purchase_order_reference IS NOT NULL`
- CHECK constraints for boolean columns and country code casing; `PRAGMA foreign_key_check` clean per runner contract

### Trade Account Domain

- new `apps/api/src/features/tradeAccount/` -> `addressRules.ts` (normalize/trim, uppercase country + postcode, row <-> `PostalAddress` mapping), `deliverySiteRepository.ts`, `deliverySiteService.ts`, `billingEntityRepository.ts`, `billingEntityService.ts`, `tradeAccountErrors.ts`
- service rules -> ownership check on every read/write; per-user record cap; duplicate label/legal-name rejection; default swap runs inside one transaction (clear prior default, set new); delete is retire (`active = 0`)
- errors -> `SITE_NOT_FOUND`, `SITE_LIMIT_REACHED`, `DUPLICATE_LABEL`, `BILLING_ENTITY_NOT_FOUND`, `BILLING_ENTITY_LIMIT_REACHED`, `DUPLICATE_LEGAL_NAME`

### Delivery Slot Domain

- extend `apps/api/src/features/delivery/` -> `deliverySlotRules.ts` (pure), `deliverySlotService.ts` (cart -> `quoteCartDelivery` -> lead time -> slot list, `Clock` injected)
- `calculateLeadTime({deliverySummary, now})` -> base freight business days plus weight tier step; returns `earliestDate`, `latestDate`, `businessDays`, human `reason`
- `listBookableSlots({leadTime, now, horizonDays})` -> business days only, `am` + `pm` per day, stable ascending order
- `isSlotBookable(slot, leadTime, now)` -> re-validation predicate reused by checkout

### API Surface

- new `apps/api/src/routes/tradeAccount.ts` -> `GET|POST /api/account/delivery-sites`, `PATCH|DELETE /api/account/delivery-sites/:siteId`, same set under `/api/account/billing-entities`; all behind `requireAuth`
- new `apps/api/src/routes/deliverySlots.ts` -> `GET /api/delivery/slots?cartId=` -> `DeliverySlotOptionsResponse`; unauthenticated, cart-scoped
- `apps/api/src/app.ts` -> construct trade account + delivery slot services, register both route modules, extend `AppServices`
- `apps/api/src/routes/payments.ts` -> map new body fields into `CheckoutParams`; map new error codes -> `400` for site/entity resolution failure, `409` for `DELIVERY_SLOT_UNAVAILABLE`

### Checkout Money Path

- `checkoutTypes.ts` -> `CheckoutParams` gains `deliveryDestination`, `billingSelection`, `deliverySlot`, `purchaseOrderReference`; `CheckoutDependencies` gains `tradeAccount` + `deliverySlots`; `CheckoutErrorCode` gains `DELIVERY_SITE_NOT_FOUND`, `BILLING_ENTITY_INVALID`, `DELIVERY_SLOT_UNAVAILABLE`; `CheckoutResult` gains slot-conflict variant carrying `earliestDate`
- `checkoutService.prepare` -> resolve destination and billing entity, then re-derive lead time and re-validate slot, all before cart reserve / promo reserve / inventory reserve. Failures route through existing `failPreparation` -> audit trail preserved
- `checkoutQuote.ts` -> emit `V7` with `customer.deliveryAddress` structured, `customer.shippingAddress` = `formatPostalAddress(resolved)`, plus `billingEntity`, `deliverySlot`, `purchaseOrderReference`. `totalCents` formula unchanged
- `checkoutFinalizer.ts` -> pass new fields to `orders.create`; mailbox body gains booked slot + PO reference; correct stale `QArefully Powder Co.` brand string to `QArefully Materials Exchange`
- `paymentRepository.ts` -> `createSafeFingerprint` hashes formatted address, billing legal name, slot date + window, PO reference; `V7` parse
- `orderRepository.create` + order hydration -> persist and read new columns; `orderTypes.ts` params widened

### Web

- `apps/web/src/api/tradeAccount.ts`, `apps/web/src/api/deliverySlots.ts` -> typed clients validating responses against shared schemas
- `apps/web/src/features/account/` -> `Delivery sites` and `Billing details` sections inside existing `/account` page; create/edit/retire/set-default; no new nav entry, no new route
- `apps/web/src/features/checkout/` -> steps `delivery` -> `schedule` -> `payment` driven by `?step=`; `DeliveryStep` (saved-site picker when authenticated, ad-hoc address form otherwise), `ScheduleBillingStep` (slot picker, billing entity, PO reference), existing `PaymentDetailsStep` retained; `CheckoutSummary` shows site, slot, PO reference; `OrderConfirmationPage` shows all four
- `apps/web/src/features/orders/` -> order detail shows delivery address, slot, billing entity, PO reference; order history list shows PO reference when present
- async UI -> slot fetch and trade-profile mutations abort or ignore stale completion; explicit loading, empty, error, retry states

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> {P3 -> R3 -> GR3 || P4 -> R4 -> GR4 || P7 -> R7 -> GR7 || P9 -> R9 -> GR9} -> G2 -> {P5 -> R5 -> GR5 -> P6 -> R6 -> GR6 || P8 -> R8 -> GR8} -> G3 -> S1 -> R10 -> GR10 -> G4`

- `G0`: worktree created and verified; Node 22 selected; `npm ci` clean; post-install health pass; baseline `npm run smoke` recorded; plan assumptions validated
- `GR1`: contracts review gate; blocks every consumer of shared transport types
- `GR2`: migration review gate; blocks every repository packet
- `G1`: both producer gates passed -> schema and transport frozen for consumers
- `GR3`, `GR4`, `GR7`, `GR9`: lane review gates; `GR3` + `GR4` block `P5`; `GR7` blocks `P8`
- `G2`: API domain lanes reviewed -> composition may wire them
- `GR5`: composition + trade/slot route gate; blocks `P6` (sequential co-ownership of `apps/api/src/app.ts`)
- `GR6`: checkout money path gate; highest-risk producer
- `GR8`: web checkout gate
- `G3`: reviewed fan-in of API lane (`GR6`) and web lanes (`GR8`, `GR9`)
- `GR10`: convergence review gate
- `G4`: completion gate -> `npm run verify` pass plus browser journey evidence, then final reply

## Work Packets

### P1: Address, trade account, slot, order, and payment contracts

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/address.ts`, `packages/contracts/src/tradeAccount.ts`, `packages/contracts/src/delivery.ts`, `packages/contracts/src/orders.ts`, `packages/contracts/src/payments.ts`, `packages/contracts/src/common.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/**`
- reads: `packages/contracts/src/payments.ts` -> `PersistedCheckoutQuoteV6`, `parsePersistedCheckoutQuote`, `CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION` -> version-bump rule and strict parser shape; `packages/contracts/src/customBlends.ts` -> `CustomBlendSnapshot` -> optional-snapshot precedent; `packages/contracts/src/delivery.ts` -> existing constants and `DeliverySummary`; `packages/contracts/src/common.ts` -> `ShippingAddress`, `PositiveIntegerString`, `Uuid`, `MoneyCents`; `packages/contracts/package.json` -> subpath export shape
- acceptance: `./address` and `./trade-account` subpaths resolve after build; `PaymentBody` carries discriminated destination and billing unions, slot, optional PO reference, and no `shippingAddress`; `PersistedCheckoutQuoteV7` is the sole readable/writable version with `CURRENT_PERSISTED_CHECKOUT_QUOTE_VERSION = 7`; `Order` exposes four new optional fields; `formatPostalAddress` deterministic and <= 500 chars for every schema-valid input; `PlaceOrderBody` and `ShippingAddress` removed with no remaining reference in `packages/`
- non-goals: any `apps/api` or `apps/web` edit; migration work; runtime behavior
- upstream inputs: `G0` -> baseline `7d7e3ce` -> plan decisions on destination union, billing union, quote `V7`
- changes:
  - add `address.ts` with `PostalAddress` field schemas and `formatPostalAddress`
  - add `tradeAccount.ts` with site + billing entity types, bodies, list responses, id params
  - extend `delivery.ts` with lead-time/slot constants, `DeliverySlotWindow`, `DeliverySlot`, `DeliveryLeadTime`, slot options query/response
  - extend `orders.ts` `Order` with `deliveryAddress`, `billingEntity`, `deliverySlot`, `purchaseOrderReference`; delete `PlaceOrderBody`
  - rewrite `payments.ts` `PaymentBody` fields; add `PersistedCheckoutQuoteV7`; bump current version constant and strict parser; add `DELIVERY_SLOT_UNAVAILABLE` conflict member
  - delete `ShippingAddress` from `common.ts`
  - add `./address` + `./trade-account` to `package.json` exports and `index.ts` re-exports
  - add contract unit tests -> `formatPostalAddress` determinism and length bound; `V7` accepted, `V6` blob rejected; destination/billing union discrimination
- invariants: transport types stay in contracts only; no domain rule, no persistence, no I/O; version integer never restarts; additive `Order` fields optional so historic rows stay representable
- relevant evidence: `E0` -> baseline smoke on `7d7e3ce`
- test duty: `E1` -> `npm run build -w @shop/contracts` then `npm test -w @shop/contracts`
- verification: `rg` shows zero `ShippingAddress` / `PlaceOrderBody` references under `packages/`; both new subpaths import cleanly from a scratch TypeScript check
- handoff: frozen transport surface -> `P2` (column shapes), `P3`, `P4`, `P5`, `P6`, `P7`, `P8`, `P9`
- review: `R1` -> `GR1` blocks all consumers

### P2: Migration 023 schema

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/023_trade_delivery_and_checkout_depth.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/migrations.integration.test.ts`
- reads: `apps/api/src/db/migrations/022_custom_blends.ts` -> `hasColumn`, `countRows`, `preserveSequence`, `assertForeignKeysClean` -> idempotence and FK-check idioms; `apps/api/src/db/migrations/020_retire_legacy_variants.ts` -> retire-not-delete precedent; `apps/api/src/db/migrate.ts` -> `Migration` type, FK suspension ownership, per-migration `foreign_key_check`; `apps/api/src/db/migrations/001_initial.ts` -> `orders` and `users` column shapes; `apps/api/test/db/migrations.integration.test.ts` -> existing assertion style
- acceptance: fresh `npm run reset` applies `023` clean; re-running migrations is a no-op (idempotence guards); `delivery_sites` and `billing_entities` exist with FK cascade to `users`, partial unique default indexes, boolean and country-code CHECKs; `orders` gains six nullable columns with JSON-validity and slot-window CHECKs; `PRAGMA foreign_key_check` empty; existing seeded orders survive with NULLs
- non-goals: repositories, services, routes, contracts, seed data
- upstream inputs: `G0` -> baseline `7d7e3ce`
- changes:
  - create `023` migration exporting `Migration` with `version: '023'`
  - create both tables with columns, CHECKs, `UNIQUE(user_id, label)` / `UNIQUE(user_id, legal_name)`, partial unique default indexes, `(user_id, active)` lookup indexes
  - add six `ALTER TABLE orders ADD COLUMN` statements; no `orders` rebuild
  - add partial index on `orders(purchase_order_reference)`
  - append migration to `migrations/index.ts` array
  - extend migrations integration test -> table + index presence, CHECK rejection cases, second-run idempotence, FK-check clean, pre-existing order rows preserved
- invariants: append-only forward-only; never edit or renumber a landed migration; never toggle `foreign_keys` inside the migration transaction; `orders` stays un-rebuilt so shipment/allocation/movement/return/refund references remain intact
- relevant evidence: `E0` -> baseline smoke on `7d7e3ce`
- test duty: `E2` -> `npm exec -w @shop/api -- tsx --test apps/api/test/db/migrations.integration.test.ts`
- verification: fresh-database and existing-database paths both applied; index list inspected from a temp SQLite database
- handoff: table + column names -> `P3`, `P6`, `S1`
- review: `R2` -> `GR2` blocks all repository packets

### P3: Trade account persistence and domain

- mode: parallel with `P4`, `P7`, `P9` after `G1`
- depends on: `G1`
- owns: `apps/api/src/features/tradeAccount/**`, `apps/api/test/tradeAccount/**`
- reads: `apps/api/src/features/favourites/favouritesRepository.ts` + `favouritesService.ts` -> per-user repository/service split and ownership-check shape; `apps/api/src/features/customBlend/customBlendRepository.ts` -> row-type ownership and mapper placement; `apps/api/src/db/unitOfWork.ts` -> transaction API for default swap; `packages/contracts/src/trade-account` + `./address` -> transport types the mappers target; `apps/api/test/checkout/delivery.integration.test.ts` -> temp-database integration test setup
- acceptance: create, list, update, set-default, retire all work per user; second default set clears prior default in one transaction; cross-user id returns not-found rather than another user's row; retired site excluded from list but still resolvable by id for order hydration; duplicate label and record-cap rejections return typed errors; row -> `PostalAddress` mapping normalizes country to upper case and trims all fields
- non-goals: routes, `app.ts`, checkout integration, web work, contracts edits
- upstream inputs: `GR1` -> contracts `V7` change set -> `DeliverySite`, `BillingEntity`, `PostalAddress`; `GR2` -> migration `023` change set -> `delivery_sites`, `billing_entities` columns and indexes
- changes:
  - add `addressRules.ts` -> normalization and row/contract mapping
  - add `deliverySiteRepository.ts` owning SQL and row types
  - add `deliverySiteService.ts` -> ownership, cap, duplicate, default-swap transaction, retire
  - add `billingEntityRepository.ts` and `billingEntityService.ts` mirroring the same rules
  - add `tradeAccountErrors.ts` with the six typed codes
  - add SQLite integration tests scoped to test-owned user emails; assert default-swap atomicity, cross-user isolation, retire semantics, cap and duplicate rejection
- invariants: repository owns SQL and row types; service owns rules; no mutable module-global state; ownership checked on every operation; retire never deletes; partial unique default index never violated
- relevant evidence: `E2` -> `023` schema applied on the same change set
- test duty: `E3` -> `npm exec -w @shop/api -- tsx --test apps/api/test/tradeAccount/deliverySites.integration.test.ts apps/api/test/tradeAccount/billingEntities.integration.test.ts`
- verification: tests scope counts to test-owned identifiers; seeded global rows never assumed absent
- handoff: `DeliverySiteService`, `BillingEntityService` interfaces -> `P5`, `P6`
- review: `R3` -> `GR3` blocks `P5`

### P4: Freight lead-time and delivery slot rules

- mode: parallel with `P3`, `P7`, `P9` after `G1`
- depends on: `G1`
- owns: `apps/api/src/features/delivery/deliverySlotRules.ts`, `apps/api/src/features/delivery/deliverySlotService.ts`, `apps/api/test/delivery/deliverySlotRules.test.ts`
- reads: `apps/api/src/features/delivery/deliverySlotRules.ts` sibling `deliveryRules.ts` -> `quoteDelivery`, `quoteCartDelivery`, pure-function style; `apps/api/src/features/auth/authService.ts` -> `Clock` interface; `packages/contracts/src/delivery.ts` -> new lead-time/slot types and constants; `apps/api/src/features/cart/cartService.ts` -> `getCart` signature for the service composition
- acceptance: lead time derived from freight mode plus cart weight tier, returning `earliestDate`, `latestDate`, `businessDays`, and a plain `reason`; slot list contains only business days from `earliestDate` through the horizon, `am` + `pm` per day, ascending, stable across repeat calls at the same `Clock` instant; `isSlotBookable` rejects past dates, weekend dates, pre-earliest dates, beyond-horizon dates, and unknown windows; every date computed in UTC
- non-goals: capacity, per-slot booking counts, contention, timezone profiles, persistence, routes
- upstream inputs: `GR1` -> contracts change set -> `DeliverySlot`, `DeliveryLeadTime`, slot constants
- changes:
  - add `deliverySlotRules.ts` -> `calculateLeadTime`, `listBookableSlots`, `isSlotBookable`, all pure
  - add `deliverySlotService.ts` -> cart id -> cart -> `quoteCartDelivery` -> lead time -> slot options, `Clock` injected through factory
  - add unit tests -> weight-tier boundaries at exactly the tier thresholds, weekend skip across a Friday `now`, earliest-date inclusive boundary, horizon-last-day inclusive boundary, past-slot rejection, repeat-call stability
- invariants: rules stay pure and side-effect free; no `Date.now()`, no ambient clock; no locale-dependent formatting; slot identity is `date` + `window` only
- relevant evidence: `E0` -> baseline smoke
- test duty: `E4` -> `npm exec -w @shop/api -- tsx --test apps/api/test/delivery/deliverySlotRules.test.ts`
- verification: two calls at one fixed instant produce identical slot arrays
- handoff: `DeliverySlotService` interface plus `isSlotBookable` -> `P5`, `P6`
- review: `R4` -> `GR4` blocks `P5`

### P5: API composition and trade/slot routes

- mode: sequential after `G2`
- depends on: `P3`, `P4`, `G2`
- owns: `apps/api/src/routes/tradeAccount.ts`, `apps/api/src/routes/deliverySlots.ts`, `apps/api/src/app.ts` (service construction + route registration regions only), `apps/api/test/tradeAccount/tradeAccountRoutes.integration.test.ts`, `apps/api/test/delivery/deliverySlotRoutes.integration.test.ts`
- reads: `apps/api/src/routes/favourites.ts` -> `requireAuth` gate, schema-per-status shape, `sendNotFound` usage; `apps/api/src/app.ts` -> `AppServices`, `createAppServices`, route registration order; `apps/api/src/plugins/auth.ts` -> `requireAuth`, `requireCustomer`, `authenticatedUser`; `apps/api/src/utils/errors.ts` -> error senders; `apps/api/test/http/app.integration.test.ts` -> `app.inject()` harness setup
- acceptance: all eight trade-account routes enforce auth and return contract-valid payloads; another user's site or entity id returns `404`; validation failures return `400` with no stack leakage; `GET /api/delivery/slots?cartId=` returns lead time plus slots for an existing cart and `404` for an unknown cart; `AppServices` exposes the two new services; composition performs no listen, seed, migration, or persistent-resource opening at import
- non-goals: any `checkout/**` file; `routes/payments.ts`; checkout dependency wiring; web work
- upstream inputs: `GR3` -> trade account services change set -> service interfaces and error codes; `GR4` -> slot services change set -> `DeliverySlotService`; `GR1` -> contracts change set -> route schemas
- changes:
  - add `routes/tradeAccount.ts` with the eight authenticated endpoints and domain-error -> status mapping
  - add `routes/deliverySlots.ts` with the cart-scoped slot options endpoint
  - extend `app.ts` -> construct repositories and services, add fields to `AppServices`, register both route modules
  - add route integration tests through `app.inject()` -> auth gate, cross-user isolation, validation rejection, default-swap through HTTP, retire through HTTP, slot options for a seeded cart
- invariants: routes stay thin -> schema, auth gate, transport mapping only; no SQL, no business rule in the route layer; composition root remains the only owner of database, clock, IDs, config, adapters; no secret or card data in logs
- relevant evidence: `E3` -> trade account services; `E4` -> slot rules
- test duty: `E5` -> `npm exec -w @shop/api -- tsx --test apps/api/test/tradeAccount/tradeAccountRoutes.integration.test.ts apps/api/test/delivery/deliverySlotRoutes.integration.test.ts`
- verification: `npm run typecheck -w @shop/api` green with the checkout path untouched
- handoff: wired `AppServices` fields -> `P6`; live route contract -> `P7`, `P8`
- review: `R5` -> `GR5` blocks `P6`

### P6: Checkout money path, order persistence, payment route

- mode: sequential after `GR5`; parallel with `P8` (disjoint workspaces)
- depends on: `P5`, `GR5`
- owns: `apps/api/src/features/checkout/checkoutTypes.ts`, `checkoutQuote.ts`, `checkoutFinalizer.ts`, `checkoutService.ts`, `apps/api/src/features/payments/paymentRepository.ts`, `apps/api/src/features/orders/orderTypes.ts`, `apps/api/src/features/orders/orderRepository.ts`, `apps/api/src/routes/payments.ts`, `apps/api/src/app.ts` (`createCheckoutService` dependency literal only), `apps/api/test/checkout/**`, `apps/api/test/orders/orderDeliveryDetails.integration.test.ts`
- reads: `apps/api/src/features/checkout/checkoutService.ts` -> `prepare`, `failPreparation`, `providerFailure`, `terminalizePreparedExpiry`, `replay` -> where new validation must sit and which release paths must run; `checkoutQuote.ts` -> `createCheckoutQuote`, `resolvedLineUnitPrice` -> money split that must not move; `checkoutFinalizer.ts` -> `finalizeAuthorizedCheckout` -> order creation and mailbox emission; `apps/api/src/features/payments/paymentRepository.ts` -> `createSafeFingerprint`, quote persistence, `PaymentRecord` statuses; `apps/api/src/features/orders/orderRepository.ts` -> `create` INSERT and order hydration mapper; `packages/contracts/src/payments.ts` -> `PaymentBody`, `PersistedCheckoutQuoteV7`, conflict members; `apps/api/test/checkout/payment.integration.test.ts` + `paymentIntent.integration.test.ts` -> existing idempotency and reservation coverage to extend
- acceptance: saved-site checkout resolves the address server-side and ignores any client address; ad-hoc checkout persists the submitted address; cross-user or retired site fails before any reservation; anonymous checkout rejects saved selections; a slot that is no longer bookable at preparation time returns `409 DELIVERY_SLOT_UNAVAILABLE` with cart, promo, and inventory reservations released and no gateway call; same idempotency key with a changed slot, address, billing entity, or PO reference returns `IDEMPOTENT_CONFLICT`; created order carries structured address, billing snapshot, slot, PO reference, and `shipping_address` equal to `formatPostalAddress` output; totals for an unchanged cart are identical to the pre-change baseline including blend-fee exclusion; confirmation mail names the booked slot and PO reference and uses the Materials Exchange brand
- non-goals: pricing or promotion rule changes; new charges; slot capacity; web work; trade account or slot route edits
- upstream inputs: `GR5` -> composition change set -> `AppServices.tradeAccount`, `AppServices.deliverySlots`; `GR3` -> service interfaces and error codes; `GR4` -> `isSlotBookable`; `GR1` -> `PaymentBody`, `PersistedCheckoutQuoteV7`; `GR2` -> `orders` columns
- changes:
  - extend `checkoutTypes.ts` -> params, dependencies, error codes, slot-conflict result variant
  - add destination + billing resolution and slot re-validation to `prepare`, positioned before cart/promo/inventory reservation, routed through `failPreparation`
  - emit `V7` from `createCheckoutQuote` with structured address, formatted string, billing snapshot, slot, PO reference; leave the totals expression untouched
  - widen `createSafeFingerprint` input and hashed body with the four new buyer-visible values
  - widen `CreateOrderParams` and the `orders` INSERT plus hydration mapper for the six new columns
  - pass new fields to `orders.create` in `checkoutFinalizer`; extend mailbox body; fix stale brand string
  - map new body fields and error codes in `routes/payments.ts`
  - append the two new dependencies to the `createCheckoutService` literal in `app.ts`
  - extend checkout integration tests and add `checkoutDepth.integration.test.ts` covering the acceptance list; add order hydration test for the new fields
- invariants: preparation transaction owns the full business invariant; no partial reservation left on any failure path; PAN and CVC never enter fingerprint, logs, or persistence; discountable subtotal split and tier maths unchanged; `configKey` blend-line identity unchanged; `orders.shipping_address` derived only through the shared formatter; unknown persisted quote version rejected loudly
- relevant evidence: `E5` -> composition and route surface; `E2` -> schema
- test duty: `E6` -> `npm exec -w @shop/api -- tsx --test apps/api/test/checkout/payment.integration.test.ts apps/api/test/checkout/paymentIntent.integration.test.ts apps/api/test/checkout/checkoutDepth.integration.test.ts apps/api/test/orders/orderDeliveryDetails.integration.test.ts`
- verification: unchanged-cart total compared against the recorded baseline figure; audit rows still written on every new failure path
- handoff: live payment contract behavior -> `P8`; order field population -> `P9`, `S1`
- review: `R6` -> `GR6` blocks `G3`

### P7: Web trade profile clients and account sections

- mode: parallel with `P3`, `P4`, `P9` after `G1`
- depends on: `G1`
- owns: `apps/web/src/api/tradeAccount.ts`, `apps/web/src/api/deliverySlots.ts`, `apps/web/src/features/account/**`
- reads: `apps/web/src/api/favourites.ts` + `apps/web/src/api/client.ts` -> `apiFetch` schema-validating client pattern and `ApiError`; `apps/web/src/features/account/AccountPage.tsx` -> existing page composition and form idiom; `apps/web/src/hooks/useFavourites.ts` -> per-user data hook with loading/error handling; `apps/web/src/components/ui/` -> available primitives; `packages/contracts/src/trade-account` + `./address` -> request/response types
- acceptance: account page gains `Delivery sites` and `Billing details` sections; buyer can create, edit, retire, and set default for both record types; every list and mutation has explicit loading, empty, error, and retry states; a superseded in-flight request never overwrites newer state; forms surface field-level validation matching the contract bounds; sections render only for authenticated users; no new route and no new nav entry
- non-goals: checkout UI; order surfaces; any `apps/web/src/App.tsx` edit; API work
- upstream inputs: `GR1` -> contracts change set -> trade account transport types
- changes:
  - add typed clients validating responses against shared schemas
  - add `useTradeProfile.ts` hook owning list state, mutation, abort of stale requests
  - add site and billing-entity section components plus a shared address form component
  - compose both sections into `AccountPage.tsx`
  - add React tests -> create/edit/retire/set-default flows, stale-response discard, request failure and retry, validation messaging, accessible labels for every field
- invariants: web never imports API source; response validation happens in the client module; UI state owned by the feature; async work aborts or ignores stale completion
- relevant evidence: `E1` -> contracts build
- test duty: `E7` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/account`
- verification: `npm run typecheck -w @shop/web` green
- handoff: `apps/web/src/api/tradeAccount.ts`, `apps/web/src/api/deliverySlots.ts`, address form component -> `P8`
- review: `R7` -> `GR7` blocks `P8`

### P8: Web checkout three-step restructure

- mode: parallel with `P5` and `P6` (disjoint workspaces); starts after `GR7`
- depends on: `P7`, `GR7`
- owns: `apps/web/src/features/checkout/**`, `apps/web/src/api/payments.ts`
- reads: `apps/web/src/features/checkout/checkoutState.ts` -> reducer, field unions, `createCartQuoteKey`, quote-change reset; `useCheckoutNavigation.ts` -> step derivation from `?step=`; `useCheckoutFlow.ts` -> facade wiring and idempotency-key regeneration; `usePaymentSubmission.ts` -> submission and `409` conflict mapping; `CheckoutPage.test.tsx` -> existing test harness and conflict assertions; `cartValidation.ts` -> five-item promo gate that must stay untouched; `apps/web/src/api/tradeAccount.ts` + `deliverySlots.ts` -> accepted client interfaces
- acceptance: steps are `delivery` -> `schedule` -> `payment`, each reachable only when prior steps validate, deep links to a later step redirect back when invalid; authenticated buyers pick a saved site or enter an ad-hoc address, anonymous buyers only see the ad-hoc form; slot picker loads server-offered slots, shows the lead-time reason, and discards stale responses when the cart changes; billing entity selection and optional PO reference captured; summary shows site, slot, and PO reference; `DELIVERY_SLOT_UNAVAILABLE` renders a distinct recoverable alert alongside existing stock and reservation conflicts; changing any new field regenerates the idempotency key; confirmation page shows all four new values
- non-goals: order history and order detail surfaces; account sections; promo gate changes; API work
- upstream inputs: `GR7` -> web client change set -> trade profile and slot clients, address form component; `GR1` -> `PaymentBody` shape
- changes:
  - extend `checkoutState.ts` -> delivery, schedule, and billing field groups, slot selection, new conflict variant, key regeneration on every new field
  - extend `checkoutValidation.ts` for the new field groups
  - rework `useCheckoutNavigation.ts` for three steps and invalid-step redirect
  - add `useDeliverySlots.ts` with abort of stale fetches
  - add `DeliveryStep.tsx` and `ScheduleBillingStep.tsx`; retain `PaymentDetailsStep.tsx`
  - update `CheckoutSummary.tsx`, `CheckoutPage.tsx`, `OrderConfirmationPage.tsx`, `usePaymentSubmission.ts`, `apps/web/src/api/payments.ts`
  - extend `CheckoutPage.test.tsx` and add step/slot tests -> step gating, saved vs ad-hoc destination, slot load error and retry, stale slot response discard, slot-unavailable conflict, idempotency-key regeneration, keyboard and label accessibility
- invariants: backend stays authoritative for totals, slots, and address resolution; frontend five-item promo gate in `cartValidation.ts` unchanged; no card data in storage or logs; async work aborts or ignores stale completion
- relevant evidence: `E7` -> web trade clients
- test duty: `E8` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/checkout`
- verification: `npm run typecheck -w @shop/web` green
- handoff: completed buyer checkout journey -> `S1`
- review: `R8` -> `GR8` blocks `G3`

### P9: Web order history and detail surfaces

- mode: parallel with `P3`, `P4`, `P7` after `G1`
- depends on: `G1`
- owns: `apps/web/src/features/orders/**`
- reads: `apps/web/src/features/orders/orderPresentation.ts` -> existing derivation helpers; `OrderDetailView.tsx` -> section layout and delivery summary rendering; `OrderHistoryPage.tsx` -> list row composition; `OrderPages.test.tsx` -> existing harness and fixtures; `packages/contracts/src/orders.ts` -> new optional `Order` fields
- acceptance: order detail shows delivery address, booked slot, billing entity, and PO reference when present; order history rows show PO reference when present; orders lacking the new fields render exactly as before with no empty labels or layout break; presentation helpers are pure and unit-covered
- non-goals: checkout UI; account sections; API work; new routes
- upstream inputs: `GR1` -> contracts change set -> `Order` optional fields
- changes:
  - extend `orderPresentation.ts` with formatters for address, slot, and reference
  - extend `OrderDetailView.tsx` with a delivery-and-billing section
  - extend `OrderHistoryPage.tsx` rows with the reference
  - extend `OrderPages.test.tsx` -> populated order, legacy order with all four absent, partially populated order
- invariants: optional contract fields treated as genuinely absent, never rendered as empty strings; no derived business rule in the view layer
- relevant evidence: `E1` -> contracts build
- test duty: `E9` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/orders`
- verification: `npm run typecheck -w @shop/web` green
- handoff: order display surface -> `S1`
- review: `R9` -> `GR9` blocks `G3`

### S1: Seed, documentation, and cross-lane convergence

- mode: sequential after `G3`
- depends on: `P6`, `P8`, `P9`, `G3`
- owns: `apps/api/src/db/seed.ts`, `apps/api/test/db/seed.integration.test.ts`, `README.md`, `CLAUDE.md` (repository-map lines only)
- reads: `apps/api/src/db/seed.ts` -> idempotent seed structure and seeded user identities; `apps/api/src/db/reset.ts` -> reset ordering; `apps/api/test/db/seed.integration.test.ts` -> deterministic count assertions; `README.md` -> credentials and trigger documentation section; `CLAUDE.md` -> repository map section
- acceptance: `npm run reset` seeds deterministic delivery sites and billing entities for seeded users, including exactly one default of each per user; repeat `npm run seed` preserves non-seed rows and adds no duplicates; README documents the new demo records and the slot-booking trigger; repository map lists the new API feature directory and route modules; full customer journey passes in browser at `1920x1080`; `npm run verify` green
- non-goals: new behavior; new schema; scope beyond seed, docs, and verification
- upstream inputs: `GR6` -> checkout money path change set -> persisted order fields; `GR8` -> checkout UI change set; `GR9` -> order surfaces change set; `GR2` -> table shapes
- changes:
  - seed delivery sites and billing entities for the existing seeded users, deterministic ids and defaults
  - extend seed integration test -> counts scoped to seeded identifiers, default uniqueness, idempotent re-seed
  - document credentials and triggers in README
  - update the `CLAUDE.md` repository map for `apps/api/src/features/tradeAccount/` and the two new route modules
  - run the browser journey through `.claude/skills/browser-qa` -> catalog -> cart -> three-step checkout -> confirmation -> order history, capturing PNG evidence at `1920x1080`
- invariants: seed stays idempotent and preserves non-seed rows; reset stays deterministic; Prettier never formats Markdown; browser work runs only through `browser-qa` headless Chromium, never the user's Chrome
- relevant evidence: `E6`, `E8`, `E9` -> lane completion
- test duty: `E11` -> `npm run reset` then `npm exec -w @shop/api -- tsx --test apps/api/test/db/seed.integration.test.ts`; `E12` -> `npm run verify` once after all fixes settle; `E13` -> browser journey evidence
- verification: journey screenshots show slot selection, PO reference on confirmation, and PO reference in order history
- handoff: completion evidence -> `G4`
- review: `R10` -> `GR10` blocks `G4`

## Review Assignments

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its severity gate (critical + high only) and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set on the implementation branch
- timing: immediately after `P1` report and `E1`; before any consumer packet launches
- blocks: `G1`, `P2` gate pairing, `P3`, `P4`, `P5`, `P6`, `P7`, `P8`, `P9`
- consolidation reason: none
- reads: `packages/contracts/src/address.ts`, `tradeAccount.ts`, `delivery.ts`, `orders.ts`, `payments.ts`, `common.ts`, `index.ts`, `packages/contracts/package.json`, `packages/contracts/test/**` -> full change surface
- acceptance: quote version bump correct and irreversible-by-accident; strict parser rejects `V6`; destination and billing unions unambiguously discriminated; `formatPostalAddress` deterministic and length-bounded for all schema-valid inputs; subpath exports complete and consistent; removed symbols have no residual reference
- invariants: transport-only ownership; no domain logic; optional additive `Order` fields; version integer never restarts
- risk focus: persisted-blob compatibility, union discrimination ambiguity, formatter output exceeding the 500-character `shipping_address` bound, missing export wiring
- non-goals: implementation suggestions for API or web packets
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E1`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P2` -> settled change set
- timing: immediately after `P2` report and `E2`; before any repository packet
- blocks: `G1`, `P3`, `P6`, `S1`
- consolidation reason: none
- reads: `apps/api/src/db/migrations/023_trade_delivery_and_checkout_depth.ts`, `migrations/index.ts`, `apps/api/test/db/migrations.integration.test.ts`, `apps/api/src/db/migrate.ts` -> migration correctness against runner contract
- acceptance: transactional, idempotent, FK-clean; indexes present; CHECK constraints enforce booleans, country casing, slot window, JSON validity; `orders` not rebuilt; existing rows preserved; array append ordering correct
- invariants: append-only forward-only; landed migrations untouched; no `foreign_keys` toggling inside the migration transaction
- risk focus: partial unique index semantics for defaults, `ALTER TABLE ADD COLUMN` with a foreign-key reference, silent no-op on re-run, missing index on a new lookup path
- non-goals: repository or service design
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E2`
- return: `reviewer_report_v1`

### R3: Review `P3`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P3` -> settled change set
- timing: immediately after `P3` report and `E3`; before `P5`
- blocks: `G2`, `P5`
- consolidation reason: none
- reads: `apps/api/src/features/tradeAccount/**`, `apps/api/test/tradeAccount/**`, `apps/api/src/db/unitOfWork.ts` -> ownership, transaction, and mapping correctness
- acceptance: ownership enforced on every operation; default swap atomic; retire never deletes; typed errors complete; row/contract mapping normalizes correctly; tests scoped to test-owned identifiers
- invariants: repository owns SQL and row types; service owns rules; no module-global mutable state; transaction owner covers the full invariant
- risk focus: cross-user data exposure, default-flag race leaving two defaults, unscoped test assertions against seeded rows, unnormalized country or postcode reaching persistence
- non-goals: route or composition design
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E3`, `E2`
- return: `reviewer_report_v1`

### R4: Review `P4`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P4` -> settled change set
- timing: immediately after `P4` report and `E4`; before `P5`
- blocks: `G2`, `P5`
- consolidation reason: none
- reads: `apps/api/src/features/delivery/deliverySlotRules.ts`, `deliverySlotService.ts`, `deliveryRules.ts`, `apps/api/test/delivery/deliverySlotRules.test.ts` -> purity and boundary correctness
- acceptance: rules pure and clock-injected; business-day and horizon boundaries inclusive as specified; repeat calls stable; `isSlotBookable` agrees with `listBookableSlots` membership for every generated slot
- invariants: no ambient clock, no locale dependence, UTC-only date derivation, slot identity is date plus window
- risk focus: off-by-one at earliest date and horizon end, weekend handling across month and year boundaries, drift between generation and validation predicates, hidden `Date.now()` use
- non-goals: capacity design, route design
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E4`
- return: `reviewer_report_v1`

### R5: Review `P5`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P5` -> settled change set
- timing: immediately after `P5` report and `E5`; before `P6`
- blocks: `P6`
- consolidation reason: none
- reads: `apps/api/src/routes/tradeAccount.ts`, `routes/deliverySlots.ts`, `apps/api/src/app.ts`, `apps/api/src/plugins/auth.ts`, `apps/api/test/tradeAccount/tradeAccountRoutes.integration.test.ts`, `apps/api/test/delivery/deliverySlotRoutes.integration.test.ts` -> auth gating, transport mapping, composition correctness
- acceptance: every mutating route behind auth; cross-user access returns not-found; response schemas declared per status; composition performs no side effect at import; no business rule in the route layer
- invariants: thin routes; single composition root; no mutable module-global request or session state
- risk focus: missing auth gate on any endpoint, existence leakage through distinguishable error codes, schema/status mismatch, side effects at import time
- non-goals: checkout behavior
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E5`, `E3`, `E4`
- return: `reviewer_report_v1`

### R6: Review `P6`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P6` -> settled change set
- timing: immediately after `P6` report and `E6`; before `G3`
- blocks: `G3`, `S1`
- consolidation reason: none
- reads: `apps/api/src/features/checkout/checkoutTypes.ts`, `checkoutQuote.ts`, `checkoutFinalizer.ts`, `checkoutService.ts`, `apps/api/src/features/payments/paymentRepository.ts`, `apps/api/src/features/orders/orderTypes.ts`, `orderRepository.ts`, `apps/api/src/routes/payments.ts`, `apps/api/src/app.ts`, `apps/api/test/checkout/**`, `apps/api/test/orders/orderDeliveryDetails.integration.test.ts` -> money path, idempotency, transaction boundaries
- acceptance: destination and billing resolved server-side with ownership and active checks; slot re-validated inside the preparation transaction before any reservation; every new failure path releases cart, promo, and inventory reservations and writes audit; fingerprint covers all new buyer-visible fields; `V7` quote written and only `V7` read; totals identical for unchanged carts; `shipping_address` derived only through the shared formatter
- invariants: money integer minor units and backend authority; discountable-subtotal split and tier maths untouched; blend `configKey` identity untouched; PAN and CVC never in fingerprint, logs, or persistence; transaction owner covers the full business invariant
- risk focus: reservation or money leak on a new failure branch, idempotency replay under a changed slot or destination, quote-version handling regression, cross-user site or entity acceptance, delivery charge or discount drift, order hydration mismatch
- non-goals: web behavior, seed data
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E6`, `E5`, `E2`
- return: `reviewer_report_v1`

### R7: Review `P7`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P7` -> settled change set
- timing: immediately after `P7` report and `E7`; before `P8`
- blocks: `P8`
- consolidation reason: none
- reads: `apps/web/src/api/tradeAccount.ts`, `apps/web/src/api/deliverySlots.ts`, `apps/web/src/features/account/**`, `apps/web/src/api/client.ts` -> client validation, state ownership, async correctness
- acceptance: responses validated against shared schemas; stale in-flight responses discarded; loading, empty, error, retry states present; field labels and error associations accessible; no API source import
- invariants: web never imports API source; UI state owned by the feature; async work aborts or ignores stale completion
- risk focus: stale-response overwrite, unvalidated response consumption, unhandled mutation failure, missing accessible labelling
- non-goals: checkout flow design
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E7`
- return: `reviewer_report_v1`

### R8: Review `P8`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P8` -> settled change set
- timing: immediately after `P8` report and `E8`; before `G3`
- blocks: `G3`, `S1`
- consolidation reason: none
- reads: `apps/web/src/features/checkout/**`, `apps/web/src/api/payments.ts`, `apps/web/src/features/checkout/cartValidation.ts` -> step gating, submission correctness, conflict handling
- acceptance: step gating and invalid-step redirect correct; saved-site path unavailable to anonymous buyers; slot fetch cancels or ignores stale completion; idempotency key regenerates on every new field change; slot-unavailable conflict rendered recoverably; five-item promo gate unchanged
- invariants: backend authoritative for totals, slots, and address resolution; no card data in storage or logs; async work aborts or ignores stale completion
- risk focus: reused idempotency key after a field change, step bypass through a direct URL, stale slot list applied to a changed cart, silent swallow of a payment conflict, regression in the promo gate
- non-goals: API behavior, order surfaces
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E8`, `E7`
- return: `reviewer_report_v1`

### R9: Review `P9`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P9` -> settled change set
- timing: immediately after `P9` report and `E9`; before `G3`
- blocks: `G3`
- consolidation reason: none
- reads: `apps/web/src/features/orders/**`, `packages/contracts/src/orders.ts` -> optional-field handling and presentation purity
- acceptance: absent optional fields render nothing rather than empty labels; populated fields render correctly; presentation helpers pure and covered; legacy orders unaffected
- invariants: no business rule in the view layer; optional contract fields treated as genuinely absent
- risk focus: undefined-field rendering artifacts, layout break on legacy orders, duplicated formatting logic diverging from the contracts formatter
- non-goals: checkout flow, account sections
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E9`
- return: `reviewer_report_v1`

### R10: Review `S1`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `S1` -> settled convergence change set
- timing: after `S1` report and `E11`, `E12`, `E13`; before `G4`
- blocks: `G4`
- consolidation reason: none
- reads: `apps/api/src/db/seed.ts`, `apps/api/test/db/seed.integration.test.ts`, `README.md`, `CLAUDE.md` -> seed determinism, documentation accuracy, repository-map correctness
- acceptance: seed idempotent and non-destructive to non-seed rows; exactly one default per user per record type; README instructions reproduce the demo journey; repository map matches landed paths; verification evidence covers the integrated result rather than individual lanes
- invariants: deterministic reset and seed; Markdown excluded from Prettier; browser evidence produced only through `browser-qa` headless Chromium
- risk focus: non-idempotent seed inserts, seeded defaults violating the partial unique index, documentation naming paths that do not exist, verification evidence predating the final fixes
- non-goals: re-reviewing lane-level implementation already gated
- write policy: inspect-only
- test policy: assess supplied evidence; run only when stale or missing evidence blocks the verdict
- relevant evidence: `E11`, `E12`, `E13`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `packages/contracts/**`: owned only by `P1`; every other packet reads
- `apps/api/src/db/migrations/**`: owned only by `P2`; migration version `023` reserved for it; no other packet adds a migration
- `apps/api/src/app.ts`: sequential co-ownership only -> `P5` owns service construction and route registration; `P6` owns the `createCheckoutService` dependency literal after `GR5`. Never concurrent
- `apps/api/src/features/checkout/**`: owned only by `P6`
- `apps/api/src/routes/payments.ts`: owned only by `P6`; `apps/api/src/routes/tradeAccount.ts` and `routes/deliverySlots.ts` owned only by `P5`
- `apps/api/src/features/delivery/`: `deliveryRules.ts` unchanged by every packet; `P4` adds sibling modules only
- `apps/web/src/api/`: `tradeAccount.ts` + `deliverySlots.ts` owned by `P7`; `payments.ts` owned by `P8`
- `apps/web/src/features/account/**` -> `P7`; `apps/web/src/features/checkout/**` -> `P8`; `apps/web/src/features/orders/**` -> `P9`
- `apps/web/src/App.tsx`: unowned; no packet adds a route or nav entry
- `apps/api/src/db/seed.ts`, `README.md`, `CLAUDE.md`: owned only by `S1`
- contract changes: producer `P1` -> consumers `P3`, `P4`, `P5`, `P6`, `P7`, `P8`, `P9` after `GR1`
- composition and integration ownership: `P5` for API composition, `S1` for cross-lane convergence

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment
- non-Codex harnesses: ignore the Codex binding; use harness-native role configuration while preserving worker and reviewer responsibilities and communication contracts
- all harnesses: reviewer runs `code-reviewer` as review method; assignment sets `review_skill=code-reviewer`; reviewer invokes it explicitly by name because the skill carries `disable-model-invocation`

## Test Execution Schedule

Every command runs from the worktree root after prepending Node 22 to `PATH` in PowerShell -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`. Node-unavailable protocol from `CLAUDE.md` applies; never silently skip an assigned command.

- `T1` -> evidence `E0`: at `G0` -> owner: orchestrator -> `npm ci` then `npm run smoke`
- `T2` -> evidence `E1`: focused, after `P1` -> owner: `P1` -> `npm run build -w @shop/contracts` then `npm test -w @shop/contracts`
- `T3` -> evidence `E2`: focused, after `P2` -> owner: `P2` -> `npm exec -w @shop/api -- tsx --test apps/api/test/db/migrations.integration.test.ts`
- `T4` -> evidence `E3`: focused, after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test apps/api/test/tradeAccount/deliverySites.integration.test.ts apps/api/test/tradeAccount/billingEntities.integration.test.ts`
- `T5` -> evidence `E4`: focused, after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test apps/api/test/delivery/deliverySlotRules.test.ts`
- `T6` -> evidence `E5`: focused, after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test apps/api/test/tradeAccount/tradeAccountRoutes.integration.test.ts apps/api/test/delivery/deliverySlotRoutes.integration.test.ts`
- `T7` -> evidence `E6`: focused, after `P6` -> owner: `P6` -> `npm exec -w @shop/api -- tsx --test apps/api/test/checkout/payment.integration.test.ts apps/api/test/checkout/paymentIntent.integration.test.ts apps/api/test/checkout/checkoutDepth.integration.test.ts apps/api/test/orders/orderDeliveryDetails.integration.test.ts`
- `T8` -> evidence `E7`: focused, after `P7` -> owner: `P7` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/account`
- `T9` -> evidence `E8`: focused, after `P8` -> owner: `P8` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/checkout`
- `T10` -> evidence `E9`: focused, after `P9` -> owner: `P9` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/orders`
- `T11` -> evidence `E10`: fan-in, once at `G3` -> owner: `S1` -> `npm test -w @shop/api`, covering cross-lane API regression
- `T12` -> evidence `E11`: fan-in, after `S1` seed work -> owner: `S1` -> `npm run reset` then `npm exec -w @shop/api -- tsx --test apps/api/test/db/seed.integration.test.ts`
- `T13` -> evidence `E12`: final gate, once after every fix settles -> owner: `S1` -> `npm run verify`
- `T14` -> evidence `E13`: final gate -> owner: `S1` -> browser journey through `.claude/skills/browser-qa` at `1920x1080`, PNG evidence to disk
- reuse: a passing entry stays valid across sessions while no invalidating path changed; hand each agent only the entries covering its packet or review target and instruct it not to rerun valid commands
- invalidation: `packages/contracts/**` -> rerun `E1` plus every consumer entry; `apps/api/src/db/migrations/**` -> `E2`, `E3`, `E5`, `E6`, `E11`; `apps/api/src/features/tradeAccount/**` -> `E3`, `E5`, `E6`; `apps/api/src/features/delivery/**` -> `E4`, `E5`, `E6`; `apps/api/src/features/checkout/**` or `features/payments/**` or `features/orders/**` -> `E6`, `E10`; `apps/api/src/app.ts` or `apps/api/src/routes/**` -> `E5`, `E6`, `E10`; `apps/web/src/api/**` -> `E7`, `E8`, `E9`; `apps/web/src/features/**` -> the matching web entry; any of the above after `E12` -> rerun the smallest affected command, then `E12` again only when the change can alter the final result

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and for every JSON string value; preserve code, commands, paths, identifiers, and errors exactly
- transport: one canonical JSON object per message, inline, no free-text wrapper; run-scoped temp files only for bulky logs, screenshots, or large diffs under `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]` with inline summary, path, format, SHA-256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet plus repository instructions plus relevant artifact references; exclude full plans, prior reports, the global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1` at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- worktree context: every assignment carries absolute worktree path, implementation branch, base revision; every repository-relative path resolves under the worktree root
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load source-checkout repository instructions, this plan, canonical contracts, and the current checkpoint.
3. Record source branch and `HEAD`; apply the worktree contract to detached `HEAD` or relevant uncommitted input.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity into the checkpoint.
5. Switch the execution root to the worktree; load repository instructions from the worktree.
6. Validate `G0` -> Node 22 selected, `npm ci` clean, post-install health pass, `E0` recorded, plan assumptions confirmed.
7. Launch `P1` and `P2` as fresh worker contexts in parallel.
8. Accept each report; update checkpoint and ledger; launch `R1` and `R2` against the exact settled change sets before any consumer starts.
9. Route stable findings to fresh workers with `action=fix` directives; close after targeted verification; never re-review a fix. Validate `GR1`, `GR2`, then `G1`.
10. Launch `P3`, `P4`, `P7`, `P9` in parallel; review each settled lane concurrently; validate `GR3`, `GR4`, `GR7`, `GR9`.
11. Validate `G2`; launch `P5`; review; validate `GR5`. Launch `P8` once `GR7` holds; it may run alongside `P5`.
12. Launch `P6` only after `GR5`; review; validate `GR6`. Validate `GR8`.
13. Validate reviewed fan-in `G3`; launch `S1`; run `E10`, `E11` once at fan-in.
14. Review `S1` as a separate integration target; close findings through fresh-worker fixes plus targeted evidence.
15. Validate `GR10`; run `E12` and `E13` once after all fixes settle; validate `G4`.
16. Leave the implementation branch and worktree intact. Reply with absolute worktree path, implementation branch, source branch, base revision, and the statement that the user owns the merge.

## Risks and Open Questions

- risk: fingerprint widened incorrectly -> a changed slot or destination replays an earlier payment -> mitigation: explicit `P6` acceptance criterion, dedicated integration case, `R6` risk focus
- risk: new validation placed after reservation -> stock or promo held on a rejected checkout -> mitigation: `P6` change order mandates validation before every reservation; `R6` inspects each failure branch for full release
- risk: quote version bump misapplied -> stale `V6` blobs read as current -> mitigation: strict single-version parser retained, `P1` contract test asserts `V6` rejection, `R1` risk focus
- risk: `orders.shipping_address` and structured columns drift -> mitigation: single shared formatter in contracts, `P6` invariant, `R6` acceptance
- risk: dual default rows per user under concurrent updates -> mitigation: partial unique index plus transaction-scoped swap, `P3` test, `R3` risk focus
- risk: slot rules diverge between generation and re-validation -> buyer books an offered slot and is rejected at payment -> mitigation: `isSlotBookable` shared by both paths, `R4` cross-check requirement
- risk: `apps/api/src/app.ts` sequential co-ownership violated by concurrent launch -> mitigation: `GR5` gate strictly precedes `P6`; ownership rule stated explicitly
- risk: three-step checkout regresses the five-item promo gate that course material depends on -> mitigation: `P8` non-goal plus `R8` risk focus plus untouched `cartValidation.ts`
- question: record cap per user for delivery sites and billing entities -> owner: `P3` worker; pick a bounded default and state it in the report; orchestrator records it as a decision
- question: exact freight lead-time base days and weight tier steps -> owner: `P4` worker; derive from existing freight constants, document the chosen ladder in `deliverySlotRules.ts` TSDoc, report as a decision
- question: whether `CLAUDE.md` repository-map edits are in scope for this branch -> owner: `S1`; default yes for the two new API paths only

## Done Criteria

- authenticated buyer manages trade delivery sites and billing entities from `/account`, including default selection and retirement
- checkout runs three steps, resolves saved destinations server-side, offers server-derived freight lead time and bookable slots, and captures billing entity plus optional purchase-order reference
- placed order persists structured delivery address, billing entity snapshot, booked slot, and purchase-order reference; confirmation page, confirmation email, order detail, and order history all display them
- stale or unbookable slot returns `409 DELIVERY_SLOT_UNAVAILABLE` with no reservation held and no payment taken; same idempotency key with any changed checkout field returns `IDEMPOTENT_CONFLICT`
- totals, tier discounts, MOQ enforcement, promotion maths, and the non-discountable blending-fee split are byte-identical to the baseline for unchanged carts
- migration `023` applies cleanly on a fresh database, preserves existing orders, and passes `PRAGMA foreign_key_check`
- `npm run reset` seeds deterministic delivery sites and billing entities; repeat `npm run seed` adds no duplicates
- `npm run verify` passes once after all fixes settle; browser journey evidence captured at `1920x1080`
- README documents new demo records and triggers; repository map lists the new API paths
- implementation branch and worktree retained; final reply reports worktree path, implementation branch, source branch, and base revision
