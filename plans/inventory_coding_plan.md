# Inventory Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `2. Inventory: partial`
Repository baseline: branch `powder_expansion_2`, commit `3b786e9`, inspected 2026-07-19; user-owned order-lifecycle changes present and must settle before runtime `G0`

## Objective

Complete ordinary-product inventory slice without weakening existing Powderizer protection. Checkout reserves ordinary lines and mix components against one stock authority, expires abandoned prepared reservations after 15 minutes, consumes stock atomically after authorization, creates per-product backorders only for opted-in products, fulfills backorders FIFO from admin-recorded receipts, and restores unshipped ordinary stock on cancellation.

Completion boundary: customer catalog, cart, checkout, confirmation, and order detail expose truthful in-stock/backorder state; admin-only local receipt API drives deterministic replenishment; no background queue or live fulfillment.

## Scope

### In

- ordinary product-line reservation before simulated gateway call
- shared availability accounting across ordinary lines and Powderizer component bag equivalents
- 15-minute prepared-reservation lease; lazy cleanup during cart and checkout activity
- non-expiring `authorized_pending_finalize` reservations
- atomic stock consumption, order allocation creation, movement facts, rollback, and same-key replay
- per-product backorder opt-in; seeded `Moon Rock` (`id=49`) example with 14-day estimate
- available quantity reserved first; remaining opted-in quantity queued as backorder
- FIFO backorder allocation from idempotent admin-only local stock receipts
- cancellation restoration for unshipped ordinary allocations; restored quantity feeds oldest open backorders
- reservation-aware catalog, cart, bundle, product, checkout, order, help, and seed behavior
- focused unit, contract, SQLite, Fastify, React, accessibility, and broad regression verification

### Out

- Powderizer backorders or Powderizer cancellation restoration
- supplier purchase orders, warehouse bins, lots, batches, expiry dates for physical goods, or multi-location stock
- customer backorder cancellation by line, partial order cancellation, substitutions, or waitlist preferences
- refunds, returns, payment voids, or money changes
- background workers, scheduled cleanup, email notifications, or webhooks
- admin UI, bulk stock import, stock adjustment UI, or inventory forecasting
- shipment of partially backordered orders; complete shipment plan remains required

## Repository Findings

- existing: `apps/api/src/db/migrations/001_initial.ts` -> `products.stock_count`; no nonnegative database constraint
- existing: `apps/api/src/db/migrations/007_checkout_intents.ts` -> `cart_reservations`, `promo_reservations`, persisted payment intent; no expiry
- existing: `apps/api/src/db/migrations/008_powderizer.ts` -> `powder_mix_stock_reservations`; reservation rows aggregate component bag equivalents by payment and product
- existing: `apps/api/src/features/checkout/checkoutService.ts` -> `prepare()` reserves payment, cart, promo, and Powderizer stock inside one SQLite transaction before gateway
- existing: `apps/api/src/features/checkout/checkoutFinalizer.ts` -> order creation, Powderizer stock consumption, promo commit, mailbox, cart deletion, payment success, and audit share one transaction
- existing: `apps/api/src/features/powderizer/powderMixRepository.ts` -> `reservedStock()`, `reserveStock()`, `consumeReservedStock()`; guarded decrement prevents negative stock but ordinary lines bypass it
- existing: `apps/api/src/features/checkout/checkoutMixPreparation.ts` -> mix validation, current-price verification, requirements, and reservation-aware availability check
- existing: `apps/api/src/features/cart/cartRepository.ts` -> cart reservation uniqueness locks mutations; `isReserved()` treats abandoned rows as permanent
- existing: `apps/api/src/features/cart/cartService.ts` -> ordinary cart lines retain current product snapshot; add/update do not reserve or enforce checkout stock
- existing: `apps/api/src/features/bundles/bundleService.ts` -> cart-time availability uses raw `stock_count`; bundle adds become ordinary cart lines
- existing: `apps/api/src/features/catalog/productRepository.ts` and `catalogSql.ts` -> customer stock/filter state uses raw `stock_count`, not active reservations
- existing: `apps/api/src/mappers/product.ts` -> transport `stock` and `available` derive from raw row stock
- existing: `packages/contracts/src/payments.ts` -> strict persisted quote versions `1|2|3`; current writer version `3`
- existing: `apps/api/src/features/orders/orderRepository.ts` -> product order lines have stable line IDs; shipment allocation reads full purchased quantity
- existing: `apps/api/src/features/orders/orderService.ts` -> cancellation and shipment commands share order unit of work; cancellation currently preserves stock facts
- existing: `apps/api/src/routes/adminOrders.ts` -> `requireAdmin`, UUID idempotency, typed command, and conflict mapping pattern
- existing: `apps/api/src/features/audit/auditEvent.ts` -> system actors supported; inventory actions and entity type absent
- existing: `apps/api/src/db/reset.ts` -> explicit foreign-key-safe reset order includes legacy mix reservations
- existing: `apps/api/src/db/seed.ts` -> canonical product upsert preserves noncanonical rows and seeds deterministic lifecycle scenarios
- existing: `packages/catalog/src/categories/impossible.ts` -> `Moon Rock`, product `49`, stock `1`; suitable deterministic backorder fixture
- existing: `apps/web/src/components/ProductCard.tsx` and `apps/web/src/features/product/ProductPurchasePanel.tsx` -> zero stock always disables purchase
- existing: `apps/web/src/features/checkout/CheckoutPage.tsx` and `checkoutState.ts` -> typed mix conflicts only; retry key behavior already centralized
- existing: `apps/web/src/features/orders/OrderDetailView.tsx` -> product lines render immutable name, quantity, total; no allocation/backorder state
- gap: ordinary checkout never reserves or decrements `products.stock_count`; concurrent product purchases can oversell
- gap: ordinary and Powderizer reservations use different accounting paths and can compete incorrectly
- gap: abandoned `prepared` intent can lock cart, promo capacity, and mix stock forever
- gap: no persisted allocation, backorder, receipt, or stock-movement facts
- gap: shipment packing can allocate quantity whose ordinary stock was never secured
- constraint: current dirty worktree contains order-lifecycle implementation, migration `014`, order contracts, routes, web pages, seed scenarios, and tests; inventory work starts only after exact accepted baseline recorded
- constraint: SQLite remains sole authority; transaction owner must cover payment, reservation, stock, order, backorder, audit, and cancellation invariants
- reuse: `createUnitOfWork()` -> atomic service workflows
- reuse: payment and order request fingerprints -> receipt idempotency
- reuse: `requireAdmin()` and `adminOrders.ts` -> hidden local operations API
- reuse: strict TypeBox storage parsing -> persisted receipt response and checkout quote evolution

## Decisions and Invariants

- decision: one inventory repository owns active reservation totals for ordinary product and Powderizer demand
- decision: `products.stock_count` remains on-hand quantity; customer `Product.stock` becomes reservation-aware available-to-sell quantity
- decision: active demand = all `authorized_pending_finalize` reservations plus unexpired `prepared` reservations
- decision: 15-minute lease starts from checkout preparation clock; expiry comparison uses injected UTC clock, never SQLite wall clock
- decision: lazy cleanup runs before cart reservation checks and checkout preparation; no timer or worker
- decision: prepared payment expiring transitions to terminal pre-gateway failure, releases cart, promo, and inventory rows, and replays `RESERVATION_EXPIRED` for same key
- decision: gateway result arriving after lease cleanup cannot revive payment or consume stock; failed compare-and-set returns reservation-expired result
- decision: transition to `authorized_pending_finalize` and reservation lease removal share one transaction; authorized reservation never expires
- decision: hard demand = Powderizer requirements plus ordinary quantities for non-backorderable products; insufficient hard demand fails before gateway with no retained reservation
- decision: opted-in ordinary demand reserves remaining available quantity after hard demand; deficit becomes backordered quantity
- decision: Powderizer components never backorder
- decision: same product appearing in mix and ordinary line counts once against shared available-to-sell pool; hard mix demand wins before opted-in ordinary backorder split
- decision: order success debits only reserved quantity; backordered quantity never drives stock negative
- decision: product order line gains persisted allocation view through separate allocation table; immutable price/name/quantity snapshots remain unchanged
- decision: legacy order lines backfill as fulfillment-allocated with `stock_debited_quantity=0`; cancellation never invents restoration for stock not consumed by inventory slice
- decision: FIFO order = allocation `created_at ASC, order_line_item_id ASC`; one receipt transaction allocates oldest demand first
- decision: stock receipt increments on-hand, immediately fulfills FIFO backorders, then leaves remainder available
- decision: receipt idempotency key plus normalized fingerprint replays identical response; changed payload returns conflict
- decision: complete shipment planning rejects any order with outstanding ordinary backorder
- decision: eligible order cancellation restores `stock_debited_quantity`, cancels outstanding backorder quantity, allocates restored stock to other open backorders, and preserves payment/totals/promo
- decision: Powderizer stock remains consumed after cancellation during this slice
- decision: `Product.available` remains purchasability compatibility field: active and (`stock > 0` or backorderable); new `availability` distinguishes `in_stock|backorder|out_of_stock`
- decision: catalog query retains `available` meaning physically available-to-sell, adds `backorder`, and narrows `out_of_stock` to zero stock plus no backorder opt-in
- decision: cart does not reserve stock; cart display marks backorder eligibility but checkout remains final authority
- decision: all stock mutations emit append-only inventory movement facts; direct product updates remain limited to inventory repository and seed/reset
- decision: inventory receipt, reservation expiry, checkout commit, and cancellation restoration add allowlisted audit facts without customer data
- assumption requiring `G0` validation: accepted order-lifecycle change set keeps cancellation limited to pre-shipment states and complete shipment planning
- assumption requiring `G0` validation: migration `015` remains next free version after accepted `014`
- assumption requiring `G0` validation: `Moon Rock` remains canonical product `49`; set `backorderable=true`, `backorderLeadDays=14`

## Target Design

### Data and migration

- proposed `apps/api/src/db/migrations/015_inventory.ts`
- add `products.backorderable INTEGER NOT NULL DEFAULT 0 CHECK (backorderable IN (0,1))`
- add `products.backorder_lead_days INTEGER`; trigger enforces null when disabled and positive bounded integer when enabled
- add insert/update triggers preventing noninteger or negative `products.stock_count`
- add `payments.reservation_expires_at TEXT`; nullable outside active prepared lease
- proposed `inventory_reservations`
  - key: `(payment_idempotency_key, product_id, demand_kind)` where kind = `product|powder_mix`
  - fields: `reserved_quantity > 0` or `backordered_quantity > 0`, nonnegative quantities, nullable `expires_at`, created timestamp
  - foreign keys: payment and product; indexes on product/expiry and payment
- proposed `order_inventory_allocations`
  - one row per ordinary `order_line_items.id`
  - fields: product, allocated quantity, backordered quantity, cancelled quantity, stock-debited quantity, created/updated timestamps
  - nonnegative integer constraints; service invariant ties sum to immutable ordered quantity
  - indexes: open FIFO `(product_id, backordered_quantity, created_at, order_line_item_id)` and order lookup
- proposed `inventory_receipts`
  - immutable admin command: UUID idempotency key, request fingerprint, product, received quantity, strict response JSON, admin user, created timestamp
- proposed `inventory_stock_movements`
  - append-only delta facts: `checkout_consumed|receipt_received|backorder_allocated|cancellation_restored`
  - product, signed nonzero quantity, optional payment/order/order-line/receipt references, occurred timestamp
  - triggers reject update/delete; indexes support product chronology and order lookup
- migration copies live legacy `powder_mix_stock_reservations` into unified rows
- copied `prepared` rows receive expiry from persisted payment update time plus 15 minutes; copied authorized rows use null expiry
- migration drops `powder_mix_stock_reservations` after copy and validation; no dual authority remains
- migration backfills legacy order lines with allocated quantity equal to ordered quantity and `stock_debited_quantity=0`
- migration preserves product stock, payments, carts, promos, orders, Powderizer snapshots, and lifecycle rows
- fresh schema, legacy fixture, pending prepared reservation, authorized reservation, malformed scalar, idempotent runner, and rollback coverage required
- `apps/api/src/db/reset.ts` removes new dependent rows before payments/orders/products; obsolete legacy delete removed

### Domain and persistence

- proposed `apps/api/src/features/inventory/inventoryTypes.ts` -> demand, allocation, receipt, expiry, error, and handoff types
- proposed `inventoryRules.ts` -> pure hard-demand aggregation, backorder split, expiry boundary, FIFO allocation, cancellation restoration, and receipt fingerprint rules
- proposed `inventoryRepository.ts` -> SQL rows, active availability reads, reservation writes/releases/authorization lock, expiry candidates, guarded stock mutation, allocation rows, receipts, and movement facts
- proposed `inventoryService.ts` -> transaction-free inventory operations called inside owning workflow unit of work
- availability formula: `max(0, stock_count - SUM(active reserved_quantity))`; backordered quantity excluded
- `availableToSell(productIds, now)` batches lookup; stable product-ID ordering; missing product omitted, never synthesized
- `reserveCheckout()` aggregates duplicate demand, validates product state and integer quantities, reserves all rows atomically, and returns either exact split or conflict facts
- `authorizeReservation()` changes active rows to null expiry only when payment compare-and-set authorization succeeds
- `commitReservation(paymentKey, orderId)` guards every stock decrement, creates ordinary allocation rows, creates movement facts, and deletes reservation rows
- finalization rollback restores stock, allocations, movements, order, payment, promo, mailbox, cart, and audit together
- `expirePrepared()` identifies lease boundary with `expires_at <= now`, releases inventory rows, and returns payment keys for checkout coordinator release/transition
- `receiveStock()` persists/replays receipt, increments stock, allocates FIFO, updates allocation rows, writes movements, and returns exact allocation summary
- `cancelOrderInventory()` zeroes outstanding/allocated quantities into cancelled quantity, restores only stock-debited allocation, writes movements, then applies FIFO allocation excluding cancelled order
- corruption, missing reservation, negative stock, quantity mismatch, or duplicate allocation throws; transaction rolls back

### Checkout coordination

- `checkoutMixPreparation.ts` keeps mix validation, requote, and requirement calculation; removes independent reserved-stock availability check
- checkout builds one demand set from persisted quote ordinary lines plus prepared mix requirements
- checkout coordinator expires abandoned prepared intents before existing-key replay and before new cart reservation
- preparation order: payment reservation -> cart/promo validation -> mix preparation -> immutable quote -> cart reservation -> promo reservation -> unified inventory reservation -> persisted quote
- product stock conflict result: `PRODUCT_STOCK_UNAVAILABLE` with stable product ID, requested quantity, available quantity
- successful backorder split persists with reservation; checkout total and purchased quantity remain unchanged
- provider decline/timeout releases unified inventory reservation with cart and promo
- gateway success path: payment compare-and-set plus `authorizeReservation()` in one transaction; failed transition returns terminal replay state
- authorized finalization: create order -> commit unified reservation -> promo commit -> mailbox -> cart removal -> payment success -> audit
- persisted quote writer advances to version `4`; product lines include reserved/backordered split captured before gateway
- strict parser keeps versions `1|2|3`; legacy versions finalize ordinary lines as no inventory allocation only when already-authorized persisted data lacks new reservation metadata
- same-key replay never re-reserves, duplicates order, duplicates movement, or changes backorder split

### Catalog, cart, and bundles

- canonical catalog model adds optional backorder policy fields; only `Moon Rock` opts in during this slice
- seed writes canonical policy idempotently without resetting local stock or noncanonical products
- customer product mapping accepts available-to-sell override; raw on-hand stays internal
- product repository availability predicates use inventory SQL helper plus bound injected time so totals and pagination match returned state
- query state: `available` -> available-to-sell > 0; `backorder` -> zero available plus opt-in; `out_of_stock` -> zero available plus no opt-in
- product contract adds `availability`, `backorderable`, optional `backorderLeadDays`; existing `stock` nonnegative
- cart and bundle reads batch available-to-sell; bundle cart-time validation permits opted-in ordinary deficits but never promises exact checkout split
- inactive products remain invisible to new selection and never become purchasable through backorder flag
- cart mutation reservation checks ignore expired prepared locks using injected clock; authorized locks remain immutable

### Orders, receipts, and cancellation

- order product contract adds `inventoryStatus: allocated|partially_backordered|backordered|cancelled`, `allocatedQuantity`, `backorderedQuantity`
- legacy order line without inventory debits maps as allocated; transport remains valid after migration backfill
- order detail and checkout success hydrate allocation state from `order_inventory_allocations`
- order summary adds `hasBackorder`; list query derives through allocation existence
- `listAllocatableLines()` exposes only allocated quantity and order packing rejects any outstanding backorder before creating shipments
- proposed `packages/contracts/src/inventory.ts` defines receipt body/response and inventory conflict code
- proposed `POST /api/admin/inventory/receipts` uses `requireAdmin`; `201` first write, `200` identical replay, `404` missing product, `409` changed-key conflict
- receipt response: receipt ID, product ID, received quantity, allocated quantity, remaining stock, ordered allocation facts
- order cancellation calls inventory restoration inside existing order transaction before final status/event/audit commit
- cancellation replay does not restore twice; stale/illegal cancellation restores nothing
- receipt or cancellation audit failure rolls back stock, backorder, movement, and order changes

### Customer UI and content

- product card/detail: `In stock`, `Available to backorder`, or `Out of stock`; opted-in zero-stock purchase stays enabled
- backorder label includes 14-day estimate when contract supplies it; no promise of exact delivery date
- catalog filter adds `Available to backorder`; URL parsing and active-filter labels remain deterministic
- cart line distinguishes current in-stock quantity from eligible backorder remainder; checkout warning states allocation finalizes during submission
- checkout conflict handles ordinary stock separately from mix conflicts, links affected products/cart, refreshes cart state, and rotates idempotency key
- expired reservation message permits safe retry with new key; no stale `submitting` or conflict state
- confirmation/order detail renders allocated/backordered quantities per ordinary line
- order detail cancellation copy states unshipped ordinary stock returns to inventory; no refund and no Powderizer restoration
- help content removes claims that demo has no inventory; documents simulated local stock, reservations, backorders, receipt trigger, and no real fulfillment

## Execution Graph

`G0 -> F1 -> P1 -> R1 -> G1 -> {P2 || P3 || P4 || P5} -> {R2 || R3 || R4 || R5} -> G2 -> C1 -> R6 -> G3`

- `G0`: accept exact order-lifecycle baseline; confirm migration `015`, selected seed product, defaults, clean ownership, and no conflicting user edits
- `G1`: accept schema/contracts plus inventory core interfaces; record contract build and focused repository evidence
- `G2`: accept all consumer packets and reviews; close required findings; freeze shared interfaces
- `G3`: final composition, docs, seed/reset, smoke, full verify, and manual journey gate
- capacity: launch up to three worker packets concurrently; start remaining ready packet when slot opens without changing dependency graph

## Work Packets

### F1: Contracts, migration, and canonical policy

- mode: sequential after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/products.ts`, `packages/contracts/src/cart.ts`, `packages/contracts/src/payments.ts`, `packages/contracts/src/orders.ts`, `packages/contracts/src/inventory.ts` (proposed), `packages/contracts/src/audit.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/*contract*.test.ts`, `packages/catalog/src/model.ts`, `packages/catalog/src/categories/impossible.ts`, `packages/catalog/test/**`, `apps/api/src/db/migrations/015_inventory.ts` (proposed), `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/reset.ts`, `apps/api/src/db/seed.ts`, `apps/api/test/db/migrations.integration.test.ts`, `apps/api/test/db/seed.integration.test.ts`
- reads: `apps/api/src/db/migrations/007_checkout_intents.ts` -> payment/cart/promo reservation schema -> compatibility
- reads: `apps/api/src/db/migrations/008_powderizer.ts` -> legacy mix reservation schema -> data copy
- reads: `apps/api/src/db/migrations/014_order_lifecycle.ts` -> accepted order and lifecycle schema -> version/order-line compatibility
- reads: `apps/api/src/features/payments/paymentRepository.ts` -> persisted statuses and quote parser -> version `4`
- reads: `packages/catalog/src/categories/impossible.ts` -> `Moon Rock` -> deterministic opt-in
- acceptance: fresh and legacy databases reach version `015`; live legacy reservations and all order/product data preserved; contracts express all accepted states; canonical seed is repeatable
- non-goals: inventory runtime service, route handlers, customer rendering
- upstream inputs: `G0` -> accepted baseline -> exact `014` schema and free `015` slot
- changes: add strict transport/storage contracts; implement constrained tables/triggers/indexes; migrate/drop legacy mix reservation table; backfill legacy order allocations; update reset and canonical policy; extend contract/migration/seed tests
- invariants: no raw card data; no negative stock; old checkout quote versions parse unchanged; legacy orders gain no invented stock debit; seed preserves local rows and stock
- relevant evidence: none at assignment; `G0` baseline only
- test duty: `npm run build -w @shop/contracts`; `npm run build -w @shop/catalog`; `npm test -w @shop/contracts`; `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts test/db/seed.integration.test.ts`
- verification: inspect `PRAGMA foreign_key_check`; confirm old table absent and copied live rows exact; confirm migration list ordered through `015`
- handoff: versioned contracts, migration schema, seed policy, `EV-F1-CONTRACTS`, `EV-F1-DB`

### P1: Inventory rules and SQLite authority

- mode: sequential after `F1`
- depends on: `F1`
- owns: `apps/api/src/features/inventory/**` (proposed), `apps/api/test/inventory/inventoryRepository.integration.test.ts` (proposed)
- reads: `apps/api/src/db/unitOfWork.ts` -> caller-owned transaction pattern
- reads: `apps/api/src/features/powderizer/powderMixRules.ts` -> bag-equivalent requirements
- reads: `apps/api/src/features/payments/paymentRepository.ts` -> payment status and compare-and-set semantics
- reads: `apps/api/src/features/orders/orderRepository.ts` -> stable order-line IDs
- acceptance: one core API calculates availability, reserves mixed demand, expires prepared leases, authorizes, commits, receives, allocates FIFO, and restores cancellation stock without owning outer workflow transaction
- non-goals: checkout/order orchestration, HTTP, React, direct audit writes
- upstream inputs: `F1` accepted change set -> reservation/allocation/receipt/movement schema and strict types
- changes: implement pure rules and errors; implement batch availability and SQL helper; implement reservation lifecycle; implement guarded stock and movement writes; implement receipt replay/FIFO; implement cancellation release/reallocation; add corruption and rollback-focused SQLite tests
- invariants: deterministic product/line ordering; integer quantities; hard demand never backorders; available-to-sell never negative; exact one allocation row per new ordinary order line; receipt replay no duplicate delta
- relevant evidence: `EV-F1-CONTRACTS`, `EV-F1-DB`
- test duty: `npm exec -w @shop/api -- tsx --test src/features/inventory/inventoryRules.test.ts test/inventory/inventoryRepository.integration.test.ts`
- verification: assert concurrent connections cannot reserve same final unit; assert movement sum matches every stock mutation; assert boundary `expires_at === now` expires
- handoff: `InventoryService`, `InventoryRepository`, availability SQL/read interface, accepted error codes, `EV-P1-INVENTORY`

### P2: Reservation-aware catalog, cart, and bundle reads

- mode: parallel with `P3`, `P4`, `P5` after `G1`
- depends on: `P1`, `R1`, `G1`
- owns: `apps/api/src/features/catalog/productRepository.ts`, `apps/api/src/features/catalog/productService.ts`, `apps/api/src/features/catalog/catalogQuery.ts`, `apps/api/src/features/catalog/catalogSql.ts`, `apps/api/src/features/catalog/catalogSql.test.ts`, `apps/api/src/mappers/product.ts`, `apps/api/src/mappers/product.test.ts`, `apps/api/src/features/cart/cartRepository.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/src/features/bundles/bundleService.ts`, `apps/api/test/catalog/products.integration.test.ts`, `apps/api/test/catalog/productRepository.integration.test.ts`, `apps/api/test/cart/cart.integration.test.ts`, `apps/api/test/cart/bundles.integration.test.ts`
- reads: `apps/api/src/features/inventory/**` -> accepted availability reader and SQL fragment
- reads: `apps/api/src/routes/products.ts` and `routes/cart.ts` -> transport mapping boundaries
- acceptance: all customer product/cart/bundle stock states use available-to-sell at injected time; filters paginate correctly; expired cart locks no longer block mutation; authorized locks still block
- non-goals: payment workflow, order allocation, web UI, composition root
- upstream inputs: `G1` -> accepted `InventoryService` read interface and product contract
- changes: thread clock and inventory reader through services; add bound-time SQL predicates; map three availability states; preserve inactive visibility rules; adapt bundle eligibility to backorder opt-in; update focused API tests
- invariants: raw on-hand never exposed as available stock; query SQL remains allowlisted; no N+1 availability reads; cart never claims reservation
- relevant evidence: `EV-P1-INVENTORY`
- test duty: `npm exec -w @shop/api -- tsx --test src/features/catalog/catalogSql.test.ts src/mappers/product.test.ts test/catalog/products.integration.test.ts test/catalog/productRepository.integration.test.ts test/cart/cart.integration.test.ts test/cart/bundles.integration.test.ts`
- verification: catalog count/page/items agree for each availability filter; same active reservation affects product, cart, and bundle consistently
- handoff: backend customer availability behavior and `EV-P2-READS`

### P3: Checkout reservation lifecycle and atomic consumption

- mode: parallel with `P2`, `P4`, `P5` after `G1`
- depends on: `P1`, `R1`, `G1`
- owns: `apps/api/src/features/checkout/checkoutTypes.ts`, `apps/api/src/features/checkout/checkoutMixPreparation.ts`, `apps/api/src/features/checkout/checkoutQuote.ts`, `apps/api/src/features/checkout/checkoutService.ts`, `apps/api/src/features/checkout/checkoutFinalizer.ts`, `apps/api/src/features/powderizer/powderMixRepository.ts`, `apps/api/src/features/payments/paymentRepository.ts`, `apps/api/src/routes/payments.ts`, `apps/api/test/checkout/payment.integration.test.ts`, `apps/api/test/checkout/paymentIntent.integration.test.ts`, `apps/api/test/powderizer/powderizerCheckout.integration.test.ts`
- reads: `apps/api/src/features/inventory/**` -> accepted reservation/authorization/commit interfaces
- reads: `packages/contracts/src/payments.ts` -> quote v4 and conflict contracts
- reads: `apps/api/src/features/promos/promoRepository.ts` -> release/commit behavior
- acceptance: ordinary and mix demand reserve together before gateway; expiry releases every checkout lock; authorization freezes lease; finalization consumes once; all failures and retries preserve idempotency
- non-goals: receipt endpoint, cancellation, customer rendering, composition root
- upstream inputs: `G1` -> accepted inventory core, quote v4, error shapes
- changes: centralize demand aggregation; remove mix repository stock authority; add lazy expiry coordinator; persist split; make authorization compare-and-set mandatory; commit unified reservation after order create; map stock/expiry errors; extend checkout and concurrency tests
- invariants: no gateway call on hard stock conflict; no stock mutation before authorization; authorized reservation never expires; provider failure releases all rows; late gateway result cannot revive expired payment; replay duplicates nothing
- relevant evidence: `EV-P1-INVENTORY`, `EV-F1-CONTRACTS`
- test duty: `npm exec -w @shop/api -- tsx --test test/checkout/paymentIntent.integration.test.ts test/checkout/payment.integration.test.ts test/powderizer/powderizerCheckout.integration.test.ts`
- verification: two separate SQLite connections compete for final unit; audit/mailbox failure rolls back stock and allocations; strict legacy quote replay remains valid
- handoff: checkout behavior, finalized allocation creation, `EV-P3-CHECKOUT`

### P4: Orders, receipts, packing guard, and cancellation restoration

- mode: parallel with `P2`, `P3`, `P5` after `G1`
- depends on: `P1`, `R1`, `G1`
- owns: `apps/api/src/features/orders/orderTypes.ts`, `apps/api/src/features/orders/orderRepository.ts`, `apps/api/src/features/orders/orderService.ts`, `apps/api/src/features/orders/orderErrors.ts`, `apps/api/src/routes/adminInventory.ts` (proposed), `apps/api/test/orders/orderLifecycle.integration.test.ts`, `apps/api/test/orders/orderRoutes.integration.test.ts`, `apps/api/test/inventory/inventoryRoutes.integration.test.ts` (proposed)
- reads: `apps/api/src/features/inventory/**` -> receipt and cancellation interfaces
- reads: `apps/api/src/routes/adminOrders.ts` -> admin auth/idempotency/error pattern
- reads: `packages/contracts/src/orders.ts` and `inventory.ts` -> accepted response schemas
- acceptance: order reads expose allocations; pending backorders block packing; admin receipt is authorized/idempotent/FIFO; eligible cancellation restores once and reallocates atomically
- non-goals: order UI, refund, Powderizer restoration, composition root
- upstream inputs: `G1` -> accepted inventory service and contracts; accepted order-lifecycle baseline
- changes: hydrate allocation state and summary flag; restrict allocatable quantity; add receipt route; call inventory restoration inside cancellation transaction; extend order/route tests for authorization, replay, FIFO, packing, stale cancellation, and audit rollback
- invariants: foreign/anonymous receipt denied; full shipment plan cannot include outstanding backorder; cancellation after shipment still rejected before inventory write; same cancellation key restores once
- relevant evidence: `EV-P1-INVENTORY`, accepted order-lifecycle baseline evidence
- test duty: `npm exec -w @shop/api -- tsx --test test/inventory/inventoryRoutes.integration.test.ts test/orders/orderLifecycle.integration.test.ts test/orders/orderRoutes.integration.test.ts`
- verification: receipt response validates against contract; cancellation movement and FIFO reallocation sum to restored quantity; legacy order cancellation restores zero stock
- handoff: order/admin inventory behavior and `EV-P4-ORDERS`

### P5: Customer inventory and backorder presentation

- mode: parallel with `P2`, `P3`, `P4` after `G1`; start when concurrency slot opens
- depends on: `F1`, `R1`, `G1`
- owns: `apps/web/src/catalogQuery.ts`, `apps/web/src/components/ProductCard.tsx`, `apps/web/src/components/ProductCard.test.tsx`, `apps/web/src/components/CartLineItem.tsx`, `apps/web/src/features/catalog/CatalogSidebarControls.tsx`, `apps/web/src/features/catalog/CatalogActiveFilters.tsx`, `apps/web/src/features/catalog/CatalogPage.test.tsx`, `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/product/ProductPurchasePanel.test.tsx`, `apps/web/src/features/checkout/checkoutState.ts`, `apps/web/src/features/checkout/usePaymentSubmission.ts`, `apps/web/src/features/checkout/CheckoutPage.tsx`, `apps/web/src/features/checkout/CheckoutPage.test.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/features/orders/OrderDetailPage.tsx`, `apps/web/src/features/orders/OrderPages.test.tsx`
- reads: `packages/contracts/src/products.ts`, `payments.ts`, `orders.ts` -> accepted states
- reads: `apps/web/src/api/client.ts` and `api/payments.ts` -> validated success/error behavior
- acceptance: backorderable products remain purchasable; filters, cart, checkout conflicts, confirmation/detail, cancellation copy, focus, and live announcements remain truthful and accessible
- non-goals: admin inventory UI, direct API contract edits, help/README
- upstream inputs: `F1` accepted change set -> stable transport fields and error codes
- changes: add availability presentation; add URL filter state; show cart eligibility; parse ordinary stock and expiry conflicts; rotate key/refresh safely; show order allocation; update focused tests and stale-state coverage
- invariants: no exact delivery date; no client stock authority; no automatic cart-line deletion; retry never reuses terminal expired/conflict key; loading/error states preserve core checkout
- relevant evidence: `EV-F1-CONTRACTS`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/components/ProductCard.test.tsx src/features/catalog/CatalogPage.test.tsx src/features/product/ProductPurchasePanel.test.tsx src/features/checkout/CheckoutPage.test.tsx src/features/orders/OrderPages.test.tsx`
- verification: keyboard filters and cancellation remain operable; conflict uses `role=alert`; retry and refresh suppress stale completion
- handoff: customer presentation and `EV-P5-WEB`

### C1: Composition, content, seed scenario, and regression convergence

- mode: sequential after `G2`
- depends on: `P2`, `P3`, `P4`, `P5`, `R2`, `R3`, `R4`, `R5`, `G2`
- owns: `apps/api/src/app.ts`, `apps/api/package.json`, `apps/web/src/features/help/content/serviceArticles.ts`, `apps/web/src/features/help/content/helpContentRegistry.test.ts`, `README.md`, final cross-lane test edits only when assigned by orchestrator
- reads: accepted handoffs from `P2|P3|P4|P5` -> service constructors, route registration, contracts, evidence
- reads: `apps/api/src/db/orderSeedScenarios.ts` -> accepted seeded lifecycle records -> manual backorder scenario compatibility
- acceptance: composition root injects one inventory repository/service and clock everywhere; admin route registered; test scripts include inventory suite; docs are truthful; seeded/manual journey and broad checks pass
- non-goals: redesign accepted interfaces, duplicate focused tests, unrelated cleanup
- upstream inputs: `G2` -> accepted consumer change sets, closed findings, valid evidence ledger
- changes: wire inventory into product/cart/bundle/checkout/order services; register admin inventory route; add inventory test glob; update help and README; resolve integration-only conflicts; run shared and broad verification once
- invariants: imports open no resources; one database/clock/unit-of-work authority; no network dependency; current order, Powderizer, promo, and five-item gate behavior preserved
- relevant evidence: `EV-P2-READS`, `EV-P3-CHECKOUT`, `EV-P4-ORDERS`, `EV-P5-WEB`
- test duty: `npm run smoke`; after review fixes settle, `npm run verify`
- verification: seed/reset twice; manual final-unit competition, expiry recovery, backorder checkout, receipt FIFO, pack guard, cancellation restoration, Powderizer regression
- handoff: integrated change set, `EV-C1-SMOKE`, `EV-C1-VERIFY`, manual evidence

## Review Assignments

### R1: Review `F1 + P1` schema and inventory authority

- target: accepted `F1` and `P1` change sets recorded in checkpoint; base = exact `G0` revision; head = accepted `P1` head
- reads: migration `015` -> data preservation, constraints, copy/drop order
- reads: `apps/api/src/features/inventory/**` -> transaction-free core and invariants
- acceptance: contracts, migration, availability, reservation, expiry, receipt, FIFO, cancellation, and movement design match plan
- invariants: no negative stock; no dual reservation authority; legacy debit remains zero; receipt replay exact
- risk focus: migration loss, cross-product aggregation, expiry boundary, stale authorization, SQLite concurrency, stock/movement mismatch
- non-goals: customer copy, route formatting, broad test rerun
- write policy: inspect-only
- test policy: assess `EV-F1-CONTRACTS`, `EV-F1-DB`, `EV-P1-INVENTORY`; run only assigned command or stale/missing evidence blocking verdict
- relevant evidence: exact three evidence entries from accepted worker reports
- return: `reviewer_report_v1` with exact targets, verdict, stable finding IDs, evidence assessment

### R2: Review `P2` customer availability reads

- target: accepted `P2` change set; base/head from checkpoint
- reads: catalog SQL, product mapper, cart/bundle services -> reservation-aware consistency
- acceptance: filter count/page, product stock, cart, and bundle use same time-bound available-to-sell semantics
- invariants: allowlisted SQL; inactive products hidden; no N+1 reads; authorized locks active
- risk focus: raw stock leakage, query/filter mismatch, expired-lock boundary, bundle policy drift
- non-goals: checkout writes, web styling
- write policy: inspect-only
- test policy: assess `EV-P2-READS`; no valid command rerun
- relevant evidence: `EV-P2-READS`
- return: `reviewer_report_v1`

### R3: Review `P3` checkout concurrency and idempotency

- target: accepted `P3` change set; base/head from checkpoint
- reads: checkout preparation/finalizer, payment repository, mix repository -> exact reservation lifecycle
- acceptance: reservation before gateway, authorization lock, expiry, provider release, final consumption, replay, and rollback remain atomic
- invariants: no oversell; no late resurrection; no duplicate movement/order; old quote replay safe
- risk focus: external wait boundary, compare-and-set result ignored, mixed-demand double count, partial cleanup, retry after rollback
- non-goals: receipt and cancellation behavior
- write policy: inspect-only
- test policy: assess `EV-P3-CHECKOUT`; run only if evidence stale/missing blocks verdict
- relevant evidence: `EV-P3-CHECKOUT`, `EV-P1-INVENTORY`
- return: `reviewer_report_v1`

### R4: Review `P4` receipt, packing, and cancellation behavior

- target: accepted `P4` change set; base/head from checkpoint
- reads: order service/repository and admin inventory route -> auth, FIFO, packing guard, restoration
- acceptance: only admin receives stock; replay exact; pending backorder blocks packing; eligible cancellation restores/reallocates once
- invariants: no refund/totals change; no Powderizer restore; stale/illegal cancellation writes nothing
- risk focus: cross-order FIFO, legacy orders, audit rollback, idempotency conflict, allocation overrun
- non-goals: customer UI
- write policy: inspect-only
- test policy: assess `EV-P4-ORDERS`; no broad rerun
- relevant evidence: `EV-P4-ORDERS`, `EV-P1-INVENTORY`
- return: `reviewer_report_v1`

### R5: Review `P5` customer behavior and accessibility

- target: accepted `P5` change set; base/head from checkpoint
- reads: product/cart/catalog/checkout/order components -> state and copy
- acceptance: three availability states, retry key rotation, order allocation, focus, alerts, and filters match contracts
- invariants: backend remains authority; no delivery promise; no hidden failure; stale async result ignored
- risk focus: zero-stock purchase disabled incorrectly, terminal key reuse, generic 409 swallowing, accessibility regression
- non-goals: backend implementation
- write policy: inspect-only
- test policy: assess `EV-P5-WEB`; no valid command rerun
- relevant evidence: `EV-P5-WEB`, `EV-F1-CONTRACTS`
- return: `reviewer_report_v1`

### R6: Review integrated inventory slice

- target: exact `C1` integrated change set after all finding fixes; base/head from checkpoint
- reads: `plans/inventory_coding_plan.md` -> done criteria
- reads: composition, migration, checkout, inventory, order, web, help -> cross-lane consistency
- acceptance: full scope integrated; collision rules honored; evidence current; no future-scope leakage
- invariants: clone-to-running constraints, deterministic seed/reset, transaction authority, public compatibility, five-item promo gate
- risk focus: wiring omissions, stale contract build, reset FK order, unsupported test glob, help contradiction, unreviewed cross-lane fix
- non-goals: feature expansion
- write policy: inspect-only
- test policy: assess `EV-C1-SMOKE` and manual evidence; `npm run verify` remains `C1` duty after required review fixes
- relevant evidence: all current noninvalidated packet entries projected by orchestrator
- return: `reviewer_report_v1`; required findings route once to responsible worker or `C1`

## Ownership and Collision Rules

- `packages/contracts/**`: `F1` only; consumers read after accepted build
- `packages/catalog/**`: `F1` only
- migration version `015`, migration index, reset, seed: `F1` only; no later migration created in this run
- `apps/api/src/features/inventory/**`: `P1` only; fixes return to `P1` unless cross-packet architecture finding requires replacement
- API catalog/cart/bundle/mappers: `P2` only
- checkout/payment route/Powderizer reservation removal: `P3` only
- order repository/service and `adminInventory.ts`: `P4` only
- customer inventory UI: `P5` only
- `apps/api/src/app.ts`, `apps/api/package.json`, help content, README: `C1` only; parallel packets read only
- test files follow owning production packet; `C1` changes test file only for integration conflict assigned after fan-in
- contract change after `G1`: return to `F1`; invalidate all consumer evidence touching changed schema
- inventory core change after `G1`: return to `P1`; invalidate affected `P2|P3|P4` evidence and handoffs
- order-lifecycle baseline changes after `G0`: stop affected packet launch; revalidate migration, order contract, cancellation, and packing inputs

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment.
- non-Codex harnesses: ignore Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and communication contracts.

## Test Execution Schedule

- `T1`: after `F1` -> owner `F1` -> contracts/catalog builds, contract suite, migration/seed integration; evidence `EV-F1-CONTRACTS`, `EV-F1-DB`
- `T2`: after `P1` -> owner `P1` -> inventory rule and SQLite repository tests; evidence `EV-P1-INVENTORY`
- `T3`: after `P2` -> owner `P2` -> focused catalog/cart/bundle tests; evidence `EV-P2-READS`
- `T4`: after `P3` -> owner `P3` -> checkout/payment/Powderizer integration; evidence `EV-P3-CHECKOUT`
- `T5`: after `P4` -> owner `P4` -> inventory route and order lifecycle integration; evidence `EV-P4-ORDERS`
- `T6`: after `P5` -> owner `P5` -> focused React tests; evidence `EV-P5-WEB`
- `T7`: after fan-in and review fixes -> owner `C1` -> `npm run smoke`; evidence `EV-C1-SMOKE`
- `T8`: after `R6` fixes settle -> owner `C1` -> `npm run verify` once; evidence `EV-C1-VERIFY`
- reuse: pass current evidence IDs plus exact change set; new session does not rerun valid command
- invalidation: contract or catalog model change -> `T1`, `T3|T4|T5|T6` affected consumers
- invalidation: migration/reset/seed change -> `T1`, `T2`, `T7|T8`
- invalidation: inventory core change -> `T2` plus smallest affected `T3|T4|T5`; final broad entries invalid
- invalidation: checkout/payment change -> `T4`, `T7|T8`
- invalidation: order/cancellation/receipt change -> `T5`, `T7|T8`
- invalidation: customer UI change -> smallest focused `T6` file, `T7|T8` when web suite coverage changed
- reviewer commands: none by default; inspection plus supplied current evidence

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values
- transport: inline canonical JSON; temp artifact references only under protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + `CLAUDE.md` + relevant artifact references + accepted upstream inputs; exclude full source plan, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- recovery snapshot: `orchestrator_run_state_v1`
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- runtime state: platform temp root `/orchestrator/[run_id]/state.json`; atomic replacement; no repository runtime reports
- finding flow: stable reviewer finding ID -> originating worker fix directive -> smallest post-fix evidence -> orchestrator closure; no reviewer loop

## Orchestrator Run Order

1. End planning context after saving this file.
2. Start fresh runtime orchestrator; load `CLAUDE.md`, this plan, canonical contracts, current checkpoint.
3. Validate `G0`: inspect status/diff, accept exact order-lifecycle baseline, reserve migration `015`, confirm defaults.
4. Assign `F1`; accept contract/schema handoff and evidence.
5. Assign `P1`; accept inventory interfaces and evidence; assign inspect-only `R1`; close findings; validate `G1`.
6. Launch `P2`, `P3`, `P4`; launch `P5` when capacity opens. Send only packet reads, accepted interfaces, invariants, and relevant evidence.
7. Accept worker reports; update checkpoint/evidence. Launch `R2|R3|R4|R5` as targets become exact and slots permit.
8. Route each required finding once to responsible worker; record fix change set and targeted evidence; validate `G2`.
9. Assign `C1`; integrate composition/docs, run manual scenarios and `npm run smoke` once.
10. Assign `R6` exact integrated target; route required findings once; invalidate only affected evidence.
11. `C1` runs smallest fix checks, then `npm run verify` once. Validate `G3`; mark complete.

## Risks and Open Questions

- risk: current order-lifecycle work changes during inventory run -> mitigation: freeze exact `G0` base; invalidate order/migration packets on drift
- risk: raw stock and reserved stock diverge across catalog/cart/checkout -> mitigation: one availability reader/SQL helper; cross-surface integration assertion
- risk: late gateway success follows lease expiry -> mitigation: mandatory payment compare-and-set plus inventory authorization lock; no transition means no finalization
- risk: old authorized quote lacks allocation metadata -> mitigation: strict version dispatch; only v4 writes inventory allocation; legacy replay compatibility tests
- risk: migration invents stock debit for old orders -> mitigation: backfill allocated quantity with zero stock-debited quantity
- risk: receipt or cancellation FIFO allocation races checkout -> mitigation: SQLite transaction and guarded stock updates under one unit of work
- risk: backorderable zero-stock item remains disabled in one UI surface -> mitigation: contract-driven `availability`; focused card/detail/catalog/cart tests
- risk: cancellation copy implies refund or Powderizer restoration -> mitigation: explicit no-refund and ordinary-only text; existing money facts immutable
- risk: opportunistic cleanup leaves dormant rows until activity -> mitigation: active queries ignore expired prepared rows; checkout performs physical cleanup before new reservation
- question resolved: backorder policy -> per-product opt-in, available-first split, FIFO receipt allocation
- question resolved: expiry -> 15-minute lazy lease; authorized reservations never expire
- question resolved: cancellation -> restore unshipped ordinary allocation and feed oldest backorders; Powderizer unchanged

## Done Criteria

- two concurrent ordinary checkouts cannot consume same final non-backorderable unit
- ordinary and Powderizer demand cannot jointly oversell one product
- opted-in ordinary deficit checks out with exact allocated/backordered split; non-opted-in deficit fails before gateway
- abandoned prepared reservation expires at 15-minute boundary, unlocks cart/promo/stock, and cannot be revived by late gateway result
- authorized pending finalization survives elapsed lease and resumes once
- finalization atomically creates order allocation, debits stock, records movement, clears reservation, and replays without duplication
- admin receipt requires admin, replays same payload, rejects changed payload, and allocates oldest backorders first
- pending backorder blocks complete shipment planning until allocated
- eligible cancellation restores unshipped ordinary debits once, cancels deficit, reallocates FIFO, and leaves money/Powderizer facts unchanged
- legacy products, payments, reservations, orders, snapshots, lifecycle rows, and seed data migrate without loss or invented stock restoration
- catalog/filter/cart/bundle/product/checkout/order UI shows contract-consistent availability and accessible failure/retry states
- reset and seed remain deterministic; canonical `Moon Rock` demonstrates backorder flow
- help and README describe simulated inventory truthfully
- all focused evidence current; `npm run smoke` and final `npm run verify` pass
