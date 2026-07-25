# Powderizer Removal — Coding Plan

Status: ready for execution. Written 2026-07-25 @ `d8b7882` (branch `materials_exchange_refactor`). Revised same day after data-policy ruling.
Implements high-level plan item 11 (`Custom Small Order retirement`) + amendments in `plans/custom_additives_handoff.md`.
Blocks item 16 (`Custom Blend`). Hard sequence 11 -> 16, not parallel.

Precedence: user request -> this plan -> `custom_additives_handoff.md` -> `demo_project_high_level_plan.md` -> repo defaults.

## Data policy (user ruling 2026-07-25)

Repo is WIP. No students, no users, no local DB worth keeping. Local SQLite is disposable -> recreate from scratch.
-> Historical `powder_mix` rows, payments, and orders carry NO preservation obligation.
-> Item 11's `retire-not-delete` constraint and the handoff's "preserve `powder_mix*` tables + `demand_kind = 'powder_mix'` rows" clause are SUPERSEDED for this feature. Delete physically.
-> Migration `021` is a destructive cleanup, not a retirement.
-> Recovery from any migration problem: delete `data/shop.db` -> `npm run reset`.

Scope of supersession: powderizer only. Retire-not-delete still governs variant `sortOrder` (migration `020`) and all future catalog work.

## Goal

Delete `powderizer` end-to-end: contracts, API domain/routes, web feature/UI, cart+order transport surface, persistence tables/columns, seed data, tests.
Zero survivors outside migration history. Free nav slot + nav-link colours for item 16.

## Non-goals

- do NOT build any Custom Blend surface. This plan removes only
- do NOT edit or renumber migrations `001`-`020`. Migration history stays append-only; `021` undoes `008`/`009` forward
- do NOT relax schema, auth, validation, or transaction standards. Disposable data is not licence to drop rigor (`CLAUDE.md` Change Rules)
- do NOT alter promo rules, MOQ, tier ladder, freight, returns windows
- do NOT rename legacy identifiers outside deleted code

## Decisions

All resolved. No open sign-off.

D1. `Cart.mixItems` + `Order.mixItems` -> REMOVED from contracts, not kept as always-empty arrays.
Reason: no writer remains; empty arrays keep dead union types alive and pre-pollute item 16's line model.

D2. All powder-mix persistence -> physically dropped in migration `021`. Tables, columns, rows.
No read path, no compatibility shim, no retained snapshot parsing.

D3. Persisted checkout quotes -> collapse to ONE current version.
Delete `PersistedCheckoutQuoteV1`-`V5` and `parsePersistedCheckoutQuote`'s version ladder. Define `PersistedCheckoutQuoteV6` = V5 shape minus `mixLines` minus `orderMixSnapshots`; union of one.
Keep the number `6` rather than renumbering to `1` — the version integer is written into persisted JSON, and a fresh number means a stale blob can never be misread as current. Zero cost.
`checkoutFinalizer.ts` V4/V5 branches collapse to a single V6 path.

D4. `products.mixable` + `products.mix_unit_grams` -> dropped in `021`.
Both carry no information (`seed.ts:252` hardcodes `isMixable = true` for all 100 products).
SQLite refuses `DROP COLUMN` on a column bound by a CHECK constraint (`mixable INTEGER NOT NULL DEFAULT 0 CHECK (mixable IN (0,1))`) -> full `products` table rebuild required. `products` is the most FK-referenced table in the schema.
Risk is now low: migrations run against an empty `products` on a fresh DB (migrate -> seed), and any failure is recoverable by deleting the file. Still write the rebuild to copy rows correctly — `npm run seed` is documented as preserving non-seed rows, so the migration must not be the thing that breaks that promise.

D5. `demand_kind` -> the concept is DELETED, not narrowed.
Two demand kinds only ever existed to let powderizer reserve stock. With powderizer gone there is one kind.
- drop the `demand_kind` column from `inventory_reservations` in `021`; PK becomes `(payment_idempotency_key, variant_id)`; the `demand_kind = 'product' OR backordered_quantity = 0` CHECK becomes vacuous -> delete it
- delete `InventoryDemandKind` from `inventoryTypes.ts` and every `demandKind` field/argument through `checkoutService.ts`, `inventoryRules.ts`, `inventoryService.ts`
- contracts `OrderLineKind` and returns `lineKind` narrow to `'product'`; audit whether either type still earns its existence or should be deleted outright

D6. `powderizer-nav-link` CSS -> RENAMED to `custom-blend-nav-link`, colours + keyframes preserved verbatim (handoff amendment). All other `powderizer-*` CSS deleted.
Nav ENTRY is removed, not left pointing at a placeholder — repo rule forbids empty scaffolding, and a nav button to nothing is worse than a missing one. Item 16 re-adds the entry against the preserved class.

D7. Help slug `custom-powder` -> article deleted, slug retired from `HelpArticleSlug`, FAQ entry `custom-powder-history` deleted. No replacement article here; item 16 owns its own. Unrelated slug `powder-safety` stays live.

## Surface Inventory

Verified by grep at `d8b7882`. Excludes `dist/`, `node_modules/`.

### Delete outright

API:
- `apps/api/src/features/powderizer/**` -> 7 files, ~1935 LOC incl. `powderMixRules.test.ts` (746)
- `apps/api/src/routes/powderizer.ts` (300), `apps/api/src/routes/customPowder.ts` (10)
- `apps/api/src/features/checkout/checkoutMixPreparation.ts` (174)
- `apps/api/test/powderizer/**` -> 2 files (710)

Contracts:
- `packages/contracts/src/powderizer.ts` (323), `packages/contracts/src/customPowder.ts` (103)

Web:
- `apps/web/src/features/customSmallOrder/**` -> 2 files
- `apps/web/src/features/cart/PowderMixCartLineItem.tsx` (127)
- `apps/web/src/api/powderizer.ts` (24)
- `apps/web/src/components/powderMixBagScheme.ts` (44)
- `apps/web/src/features/checkout/PowderMixPurchaseRendering.test.tsx`

### Edit

API: `app.ts`, `features/cart/cartRepository.ts`, `features/cart/cartService.ts`, `features/checkout/checkoutService.ts`, `features/checkout/checkoutTypes.ts`, `features/checkout/checkoutQuote.ts`, `features/checkout/checkoutFinalizer.ts`, `features/orders/orderRepository.ts`, `features/orders/orderTypes.ts`, `features/orders/orderLifecycle.ts`, `features/inventory/inventoryRules.ts`, `features/inventory/inventoryTypes.ts`, `features/inventory/inventoryService.ts`, `features/returns/returnRules.ts`, `features/returns/returnService.ts`, `features/promos/promoService.ts`, `features/bundles/bundleService.ts`, `features/bundles/bundleRepository.ts`, `features/catalog/productRepository.ts`, `mappers/product.ts`, `db/seed.ts`, `db/reset.ts`, `db/orderSeedScenarios.ts`, `db/migrations/index.ts`

Contracts: `src/index.ts`, `src/cart.ts`, `src/orders.ts`, `src/payments.ts`, `src/products.ts`, `package.json` (drop `./powderizer` + `./customPowder` exports)

Web: `App.tsx`, `features/cart/CartPage.tsx`, `components/CartSheet.tsx`, `features/checkout/CheckoutPage.tsx`, `features/checkout/CheckoutSummary.tsx`, `features/orders/OrderDetailView.tsx`, `hooks/useCart.ts`, `components/nav/navItems.ts`, `components/CategoryNav.tsx`, `index.css`, `features/help/content/{faqArticle,serviceArticles,helpContentRegistry,helpContentTypes}.ts`

### Tests touched

Heavy (rewrite/prune): `apps/api/test/db/migrations.integration.test.ts` (35 refs, imports the deleted `createPowderMixRepository` -> replace with raw SQL), `packages/contracts/test/transport-contracts.test.ts` (48), `packages/contracts/test/powder-shop-contracts.test.ts` (36, mixed content -> keep product-contract cases, drop mix + dead quote-version cases), `apps/api/test/db/seed.integration.test.ts` (16), `apps/api/test/cart/cart.integration.test.ts` (16), `apps/web/src/hooks/useCart.test.tsx` (10), `apps/api/test/cart/bundles.integration.test.ts` (10), `apps/web/src/features/checkout/CheckoutPage.test.tsx` (8), `apps/api/src/features/returns/returnRules.test.ts` (7), `apps/web/src/components/CategoryNav.test.tsx` (6)

Light (mostly `mixItems: []` fixture removal, 1-4 refs each): ~35 further test files across `apps/api/test/**`, `apps/web/src/**`, `packages/contracts/test/**`.

## Migration `021`

`apps/api/src/db/migrations/021_remove_powderizer.ts` -> `removePowderizerMigration`, registered last in `migrations/index.ts`.

Ordered steps. FK dependency order matters — do not reorder. Each step idempotent (`IF EXISTS` / `PRAGMA table_info` guards), whole migration inside the runner's transaction.

1. rebuild `order_shipment_items` without `order_powder_mix_item_id`. Current DDL (`014_order_lifecycle.ts:46-57`) has the column, the either/or CHECK, and `UNIQUE (shipment_id, order_powder_mix_item_id)`. New shape: `order_line_item_id INTEGER NOT NULL REFERENCES order_line_items(id) ON DELETE CASCADE`, no mix column, no either/or CHECK, keep `UNIQUE (shipment_id, order_line_item_id)`. Copy only rows where `order_powder_mix_item_id IS NULL`.
2. `DROP TABLE IF EXISTS order_powder_mix_items`
3. `DROP TABLE IF EXISTS powder_mix_components`
4. `DROP TABLE IF EXISTS powder_mixes`
5. `DROP TABLE IF EXISTS powder_mix_stock_reservations` — verify whether `018` already removed it (`migrations.integration.test.ts:679` asserts its absence at some version); guard regardless
6. rebuild `inventory_reservations` without `demand_kind` (D5). Current DDL `018_grounded_catalog_variants.ts:295-305`. New PK `(payment_idempotency_key, variant_id)`; keep the `reserved_quantity > 0 OR backordered_quantity > 0` CHECK; drop the `demand_kind = 'product' OR ...` CHECK. Copy only rows where `demand_kind = 'product'`
7. rebuild `products` without `mixable`, `mix_unit_grams` (D4)

Rebuild pattern for steps 1, 6, 7 — follow `018_grounded_catalog_variants.ts:140-180` exactly:
`PRAGMA foreign_keys = OFF` -> `CREATE TABLE <name>_new (...)` -> `INSERT INTO <name>_new SELECT <cols> FROM <name>` -> `DROP TABLE <name>` -> `ALTER TABLE <name>_new RENAME TO <name>` -> recreate every index that existed -> `PRAGMA foreign_key_check` (fail loudly on any row) -> `PRAGMA foreign_keys = ON`.

Enumerate live column lists from `PRAGMA table_info(...)` at implementation time — `001`, `002`, `010`, `018`, `019` all added columns to `products`. Do not transcribe from `001_initial.ts`.

Forward-only; no `down`. Matches every existing migration module.

## Phases

Gate: each phase ends green on its own checks before the next starts.

### P0 — baseline (blocking, single owner, short)

- record `npm run verify` green at `d8b7882`
- capture pre-change reference values to diff against later: seeded row counts per table, order list `total_items` for the 5 demo scenarios, `SAVE10` gate behavior, freight + `£/tonne` figures on a seeded checkout
- no characterization test for the `products` rebuild — data is disposable and `seed.integration.test.ts` row-count assertions plus `npm run reset` already cover determinism. (`CLAUDE.md` "destructive refactor -> characterization test first" is aimed at behavior, and behavior is covered; the deleted behavior is the point of the change)

### P1 — contracts (blocking, single owner, no parallelism)

Everything downstream typechecks against this. Land alone.

- delete `src/powderizer.ts`, `src/customPowder.ts`; drop both from `src/index.ts` and both subpath entries from `package.json`
- `src/cart.ts` -> drop `mixItems` field + import
- `src/orders.ts` -> drop `NormalizedOrderPowderMixItem*`, `OrderPowderMixLineItem*`, `Order.mixItems`; narrow or delete `OrderLineKind`
- `src/products.ts` -> drop `mixable`, `mixUnitGrams`
- `src/payments.ts` -> delete `PersistedCheckoutQuoteV1`-`V5`; add `PersistedCheckoutQuoteV6`; `parsePersistedCheckoutQuote` checks V6 only (D3)
- exit check: `npm test -w @shop/contracts`, `npm run build --workspaces --if-present`

### P2 — API (starts after P1; owns `apps/api/**` exclusively)

1. delete `features/powderizer/**`, `routes/powderizer.ts`, `routes/customPowder.ts`, `features/checkout/checkoutMixPreparation.ts`, `test/powderizer/**`
2. `app.ts` -> drop route registrations, `createPowderMixRepository`, `PowderizerService` from `AppContext`, `PowderMixDomainError` branch in the error handler
3. cart: `cartRepository.ts` drop `product_mixable`/`product_mix_unit_grams` row fields + SELECT columns; `cartService.ts` drop `mixes` params (all 5 call sites incl. the `mines` typo at :395), `toPowderMixCartItem`, mix contribution to `totalItems`/`subtotalCents`
4. checkout: `checkoutTypes.ts` drop `mixes` dep; `checkoutService.ts` drop `prepareMixes`/`withPreparedMixes` and the `demandKind` requirement mapping; `checkoutQuote.ts` emit `version: 6` without mix lines; `checkoutFinalizer.ts` collapse to the single V6 path
5. orders: `orderRepository.ts` drop mix reads/writes/snapshot parsing, the `order_powder_mix_item_id` column from the shipment-items query, and the `order_powder_mix_items` subquery from `listOwned` `total_items`; `orderTypes.ts` drop `mixItems`; `orderLifecycle.ts` narrow `lineKind`
6. inventory: delete `InventoryDemandKind` and every `demandKind` field/argument/filter (`inventoryTypes.ts`, `inventoryRules.ts:72,83`, `inventoryService.ts:216`); the hard-vs-backorderable split at `inventoryRules.ts:72` now keys on `!product.backorderable` alone
7. returns: `returnRules.ts` narrow `lineKind`/`kind`, drop the product-before-`powder_mix` tiebreak; `returnService.ts` drop the `'powder_mix'` allocation branch
8. promos/bundles: drop `mixes` from `PromoService`/`BundleServiceDependencies` and `getCart` calls
9. catalog: `productRepository.ts` drop `mixable`/`mix_unit_grams` row fields and `listEligibleMixProducts`; audit `listActiveMixProducts`/`listMixProducts` — delete if powderizer was the only consumer
10. `mappers/product.ts` drop both fields
11. exit check: `npm run typecheck -w @shop/api`, `npm test -w @shop/api`

### P3 — persistence (starts after P2 step 10; owns `apps/api/src/db/**`)

- write migration `021` per spec above; register in `migrations/index.ts`
- `seed.ts` -> drop `mixable`/`mix_unit_grams` from the products INSERT column list, params, and `ON CONFLICT` update set; delete the `isMixable` block at :252
- `orderSeedScenarios.ts` -> delete `DEMO_MIX`, `mixItems` on `alice-split-shipped`, the `powder_mix` `ShipmentLine` variant, and both mix insert statements. Keep the split-shipment scenario — replace the mix line with a second product line so split-shipment QA coverage survives
- `reset.ts` -> DELETE the three `powder_mix*` / `order_powder_mix_items` statements. Tables no longer exist; leaving them makes `reset` throw
- `test/db/migrations.integration.test.ts` -> replace the `createPowderMixRepository` import with raw SQL; keep `008`/`009` history assertions (they run at those versions and still pass); update the post-chain `products` assertion at :567 to the new column set; add `021` cases -> tables gone, `order_shipment_items` + `inventory_reservations` rebuilt with correct shape, re-run idempotent, `foreign_key_check` clean
- `test/db/seed.integration.test.ts` -> update counts
- exit check: delete `data/shop.db` -> `npm run reset` -> `npm test -w @shop/api`

### P4 — web (parallel with P3; owns `apps/web/**`)

- delete `features/customSmallOrder/**`, `features/cart/PowderMixCartLineItem.tsx`, `api/powderizer.ts`, `components/powderMixBagScheme.ts`, `features/checkout/PowderMixPurchaseRendering.test.tsx`
- `App.tsx` -> drop `/custom-powder` route, `/powderizer` route, `PowderizerRedirect`
- `navItems.ts` -> drop `customPowderItem` + its `navItems` entry; `CategoryNav.tsx` -> drop the link block
- `index.css` -> rename `.powderizer-nav-link` -> `.custom-blend-nav-link`, `@keyframes powderizer-iridescence` -> `custom-blend-iridescence`, `--powderizer-*` tokens -> `--custom-blend-*` (light + dark blocks, lines ~58-68, ~109-116, ~172-190, ~297, ~318). CSS comment naming item 16 as intended consumer
- `CartPage.tsx`, `CartSheet.tsx`, `CheckoutSummary.tsx`, `OrderDetailView.tsx` -> drop `mixItems` rendering blocks and scheme lookups
- `CheckoutPage.tsx` -> drop both `/custom-powder?edit=` links (:89, :112) and the surrounding mix-edit affordance
- `useCart.ts` -> drop `powderizerApi` import and the three mix mutations
- help: delete `customPowderArticle` from `serviceArticles.ts`, its registry entries + `customPowder` content link, `'custom-powder'` from `HelpArticleSlug`, `'custom-powder-history'` from the FAQ id union and `faqArticle.ts`, the `safety-custom-powder` section. Leave `powder-safety` alone
- update touched web tests; delete `mixItems` fixtures
- exit check: `npm run typecheck -w @shop/web`, `npm test -w @shop/web`

### P5 — convergence (single owner, after P3 + P4)

- sweep: `grep -ri "powderizer\|powder_mix\|powderMix\|custom-powder\|customPowder\|mixable\|mix_unit_grams\|demand_kind\|demandKind" apps packages --include="*.ts" --include="*.tsx" --include="*.css" --include="*.json"` -> only permitted survivors are migrations `008`/`009`/`014`/`015`/`018` (history) and `021` (the removal itself), plus the renamed CSS
- clean build to clear stale `apps/api/dist/**`, `apps/web/dist/**`
- update `CLAUDE.md`: drop the powderizer legacy-identifier paragraph, drop `powderizer` from any domain listing, refresh Repository Map. (Data-policy line already landed with this revision)
- update `demo_project_high_level_plan.md`: item 11 -> `completed`; correct item 12's "consumes freed nav slot" line (slot goes to 16); update `Current Baseline` placeholder bullet, migration ceiling `020` -> `021`, domain list, LOC figures
- `custom_additives_handoff.md` stays in `plans/` — still active input for item 16. Move THIS plan to `plans/old/` once 16 starts

## Behavior-preservation checks

Identical before/after on a fresh `npm run reset`:

- `SAVE10` five-item gate: `cart.totalItems` no longer sums mix quantities. Zero mixes exist in a fresh DB -> arithmetic unchanged. Assert explicitly, course behavior is protected
- order detail + order list for all 5 seeded scenarios; `alice-split-shipped` keeps two shipments after the mix line is swapped for a product line
- payment idempotent replay: same idempotency key -> same response, now off a V6 quote
- inventory reservation/backorder counts unchanged (no `powder_mix` demand in seed)
- returns eligibility + 30-day window unchanged
- freight charge + `£/tonne` display unchanged
- `checkoutQuote.ts:59` money composition (`subtotal - discount + freight`) unshifted when mix lines leave

## Risks

- three table rebuilds in one migration (`order_shipment_items`, `inventory_reservations`, `products`). Mitigate: strict FK ordering above, `PRAGMA foreign_key_check` after each, recreate every index, one transaction. Recovery is `rm data/shop.db && npm run reset`
- index recreation is the classic miss in SQLite rebuilds — enumerate via `PRAGMA index_list(<table>)` before dropping, assert the same set after
- `powder-shop-contracts.test.ts` is mixed-content, not powderizer-only. Prune case-by-case; do not delete the file
- deleting `demand_kind` (D5) touches the reservation PK. Re-check the reservation-expiry and backorder paths after — they filter on that PK
- `cartService.ts:395` parameter is spelled `mines` — do not "fix" it, delete it

## Verification

Per-phase exit checks above, then full gate from repo root:

`npm run format` -> `npm run typecheck` -> `npm run lint` -> `npm test` -> `rm data/shop.db` -> `npm run reset` -> `npm run verify`

Node: prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` before any node/npm command.

Customer journey, browser QA on loopback: home -> catalog -> lot detail -> cart -> checkout -> payment -> confirmation -> order history -> order detail -> returns. Confirm no nav entry, route, link, or help article reaches a removed surface; no 404, no console error.
