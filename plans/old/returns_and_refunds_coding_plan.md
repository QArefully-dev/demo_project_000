# Returns and Refunds Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `3. Returns and refunds`
Repository baseline: `powder_expansion_2` at `1bf9bce45bb1df6b235a236076078b7173a925ab`, inspected 2026-07-19

## Runtime Worktree

- source: current named branch at runtime -> record branch + `HEAD` before implementation write
- source blocker: relevant uncommitted or untracked input absent from `HEAD` -> stop; ask user to commit input or select baseline
- create: unique `codex/returns-and-refunds-*` branch + dedicated worktree from recorded source branch `HEAD`
- command: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- verify: worktree branch + base revision match recorded source identity before `G0`
- execution root: all implementation, generated writes, tests, reviews, fixes, convergence run inside worktree
- source checkout: read-only after worktree creation except saved plan + run-scoped temp state
- integration: no merge, rebase, cherry-pick, copy-back, branch removal, or worktree cleanup; user handles integration
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state worktree remains intact

## Objective

Deliver authenticated customer return requests for delivered ordinary-product quantities within 30-day windows, admin-only API approval, receipt, rejection, and simulated refund execution, deterministic partial-quantity refund proration, atomic stock restoration, customer order-detail visibility, local seed scenarios, audit history, and focused verification.

Completion boundary: return request -> admin decision -> received stock restoration -> simulated refund record -> customer-visible terminal state.

## Scope

### In

- 30-day UTC return window from exact shipment delivery event instant
- delivered ordinary-product shipment quantities only
- authenticated order-owner request creation
- partial quantity across one or more delivered shipment allocations
- request reason allowlist + bounded optional plain-text note
- request states: `requested -> approved -> received -> refunded`; `requested -> rejected`
- admin paginated API queue + admin decision, receive, and refund commands
- optimistic versions + idempotent mutation keys
- original-discount proration across purchased product and Powderizer line totals
- immutable refund facts separate from original payment, order totals, and promotion redemption
- ordinary-product stock restoration at `received`
- restored stock -> existing FIFO backorder allocation in same transaction
- customer order-detail return eligibility, request form, request history, statuses, refund total
- append-only return events, refund records, inventory movements, audit events
- deterministic migrated seed/reset behavior + local API operator examples

### Out

- Powderizer returns or component-stock restoration
- cancellation refunds; existing cancellation remains fulfilment stop + unshipped ordinary-stock restoration only
- exchanges, replacements, store credit, gift cards, loyalty, tax, shipping-fee, or postage calculations
- real payment gateway, card reversal, bank timing, webhook, email, notification, or background job
- customer request withdrawal or edit
- admin web UI; secondary admin refund management remains future
- anonymous order-access-cookie return creation
- reverse-process returns, refund rules, or approval flow
- auto-approval, partial admin approval, partial receipt, partial refund, manual refund amount override
- E2E, Playwright, visual regression, load, or broad coverage target

## Repository Findings

- existing: `apps/api/src/db/migrations/014_order_lifecycle.ts` -> `order_shipments`, `order_shipment_items`, immutable `order_lifecycle_events`; delivered shipment allocations provide return eligibility source
- existing: `apps/api/src/db/migrations/015_inventory.ts` -> `order_inventory_allocations`, immutable `inventory_stock_movements`; movement enum lacks return restoration
- existing: `apps/api/src/features/orders/orderRepository.ts` -> `findDetailById()`, `findOwnedDetail()`, shipment-line mapping, purchased product and Powderizer snapshots
- existing: `apps/api/src/features/orders/orderService.ts` -> `cancel()` wraps inventory release, lifecycle writes, optimistic order update, audit append in `UnitOfWork`
- existing: `apps/api/src/features/inventory/inventoryService.ts` -> `cancelOrderInventory()` restores stock then calls private FIFO `fulfillBackorders()`
- existing: `apps/api/src/features/inventory/inventoryRepository.ts` -> `incrementStock()`, `insertMovement()`, `listOpenBackorders()`, `fulfillBackorder()` support return-restoration extension
- existing: `apps/api/src/features/payments/paymentRepository.ts` -> succeeded payment retains original `amount_cents`, `order_id`, simulated gateway reference; status vocabulary has no refund state
- existing: `packages/contracts/src/orders.ts` -> order, shipment, lifecycle, cancellation contracts; no return or refund transport
- existing: `apps/api/src/routes/orders.ts` -> customer ownership returns 404 for inaccessible order; cancellation requires customer session
- existing: `apps/api/src/routes/adminOrders.ts` -> `requireAdmin()`, TypeBox schemas, narrow admin mutation API, no operations UI
- existing: `apps/api/src/app.ts` -> single SQLite composition root owns repositories, clock, `UnitOfWork`, audit, routes
- existing: `apps/web/src/features/orders/OrderDetailPage.tsx` + `OrderDetailView.tsx` -> protected customer order-detail composition, cancellation stale-version refresh, accessible confirmation dialog
- existing: `apps/web/src/api/orders.ts` -> shared-schema validated order reads and cancellation
- existing: `apps/web/src/features/help/content/serviceArticles.ts` -> returns article explicitly says no return workflow and cancellation issues no refund
- existing: `apps/api/src/db/orderSeedScenarios.ts` -> fixed processing, split-shipped, failed-delivery, and delivered orders
- existing: `apps/api/src/db/reset.ts` -> explicit dependency-ordered cleanup + immutable movement trigger recreation
- existing: `apps/api/src/features/audit/auditService.ts` -> append-only audit writer with injected clock
- gap: no return eligibility rule, persistence, status machine, refund allocation, contracts, route, web client, UI, seed state, or refund stock movement
- constraint: backend owns money, inventory, orders, payments, permissions; integer minor units only
- constraint: SQLite transaction owner must cover quantity reservation, status mutation, stock, backorder allocation, refund persistence, and audit append for each command
- constraint: existing order totals, successful payment row, purchase snapshots, promotion redemption, shipment history, and cancellation semantics remain compatible
- constraint: reset/seed must preserve insert-only normal seed behavior and deterministic reset behavior
- reuse: lifecycle fingerprint canonicalization -> return mutation fingerprints
- reuse: order ownership 404 policy + `requireCustomer()` -> customer return routes
- reuse: admin order route auth/error pattern -> admin return routes
- reuse: inventory receipt/cancellation FIFO path -> received-return restoration
- reuse: secondary product-detail failure isolation -> return panel failure must not hide core order detail

## Decisions and Invariants

- policy: return window = 30 * 24 hours after relevant `shipment_delivered` event `occurred_at`; eligible when `now < window_closes_at`; exact close instant expired
- time: injected clock + UTC ISO instants; no local-time or date-only comparisons
- eligibility identity: `{shipmentId, orderLineItemId}`; backend verifies shipment belongs to order, shipment status `delivered`, allocation contains ordinary line, requested quantity positive
- delivery authority: earliest matching immutable `shipment_delivered` event for shipment after latest shipped transition; missing or corrupt delivery event -> ineligible + integrity error, never infer from client timestamp
- ownership: only authenticated customer whose `orders.user_id` matches creates/lists returns; admin may read/mutate all; inaccessible customer order or return -> 404
- anonymous compatibility: order access grant still reads order detail; grants never authorize return mutation
- nonreturnable: every `order_powder_mix_items` quantity excluded even when delivered
- quantity cap: per shipment allocation, sum quantities in non-rejected requests must not exceed delivered allocation quantity
- rejection: releases reserved return quantity; preserves request, items, events, and audit history
- window lock: window checked only during request transaction; later admin processing may occur after close
- state guard: approve/reject only `requested`; receive only `approved`; refund only `received`; terminal `rejected|refunded`
- command concurrency: `return_requests.version` compare-and-increment for admin state commands; stale version -> typed `STALE_VERSION` conflict
- idempotency: every mutation key globally unique in return event ledger; same key + same operation fingerprint -> replay current resource; same key + different fingerprint -> `IDEMPOTENCY_CONFLICT`
- request atomicity: eligibility recheck + quantity reservation + request/items + event + audit commit or roll back together
- receive atomicity: state guard + stock increments + immutable movements + FIFO backorder allocation + event + audit + version commit or roll back together
- refund atomicity: state guard + succeeded-order-payment lookup + cumulative refund cap + proration + refund/items + event + audit + version commit or roll back together
- refund gateway: local deterministic adapter returns `sim_refund_<idempotencyKey>`; no external call, failure mode, card data, or payment-row status mutation
- money source: purchased `line_total_cents`, Powderizer snapshot `lineTotalCents`, `orders.subtotal_cents`, `discount_cents`, `total_cents`; current catalog prices never used
- order discount allocation: largest-remainder allocation across every purchased ordinary + Powderizer line, weighted by gross line total; base `floor(discount * lineGross / subtotal)`; remaining cents -> descending fractional remainder, tie `product` before `powder_mix`, then numeric line ID
- line refund allocation: ordinary line net = gross line total - allocated line discount; refund command uses cumulative target `floor(lineNet * cumulativeRefundedQuantity / purchasedQuantity)`; current refund cents = new cumulative target - prior cumulative target
- rounding result: full ordinary-line quantity refunds exact ordinary-line net; cumulative line refunds never exceed line net; order refunds never exceed succeeded payment amount or order total
- nonreturnable discount: Powderizer receives discount share during whole-order allocation but never produces refund, preserving original promotion economics
- persisted refund facts: gross returned subtotal, allocated discount share, net refund amount, per-return-item values, payment ID, simulated reference, processor, timestamp
- immutability: original order subtotal/discount/total, payment amount/status, promo redemption, purchase snapshots unchanged
- stock: receive restores exactly requested ordinary quantity once, regardless later refund; `return_received` positive movement precedes any FIFO `backorder_allocated` negative movement
- inventory display: received/refunded return does not rewrite original `allocated_quantity`, `backordered_quantity`, or order lifecycle status; return tables + movement ledger own post-delivery facts
- audit actions: `return.requested`, `return.approved`, `return.rejected`, `return.received`, `payment.refunded`; metadata excludes note text, customer address, payment fingerprint, and card metadata
- plain text: note trimmed, length bounded, markup delimiters rejected using established tracking-text policy
- response stability: lists ordered newest request first by `requested_at DESC, id DESC`; items ordered `shipment_id ASC, order_line_item_id ASC`; events chronological by `occurred_at ASC, id ASC`
- UI resilience: order detail remains usable when return overview fails; return section exposes retry-only failure
- assumption for `G0` validation: shipment has one authoritative `shipment_delivered` event; repository corruption with duplicates fails closed

## Target Design

### Contracts

- proposed: `packages/contracts/src/returns.ts`
- export path: `@shop/contracts/returns` via `packages/contracts/package.json`; barrel via `packages/contracts/src/index.ts`
- `ReturnRequestStatus`: `requested|approved|rejected|received|refunded`
- `ReturnReasonCode`: `damaged|wrong_item|not_as_expected|other`
- `ReturnEligibilityLine`: shipment ID/number, order line ID, product snapshot name, delivered quantity, reserved quantity, available quantity, delivered instant, window close instant
- `ReturnRequestItem`: shipment/order-line identity, product snapshot, quantity, delivery/window snapshots
- `RefundSummary`: gross subtotal cents, discount share cents, amount cents, simulated reference, refunded instant
- `ReturnRequest`: ID, order ID, status, version, reason, nullable note, items, nullable refund, state timestamps
- `ReturnOverviewResponse`: `windowDays=30`, eligible lines, existing requests
- `CreateReturnRequestBody`: UUID idempotency key, reason, optional note, 1..50 `{shipmentId, orderLineItemId, quantity}` selections
- `ReturnIdParam`, admin list query/response, decision/receive/refund command bodies
- admin mutation bodies: nonnegative version + UUID idempotency key; decision adds `approve|reject`
- `ReturnErrorCode`: `RETURN_NOT_FOUND|RETURN_NOT_ELIGIBLE|RETURN_WINDOW_EXPIRED|QUANTITY_UNAVAILABLE|INVALID_TRANSITION|STALE_VERSION|IDEMPOTENCY_CONFLICT|PAYMENT_NOT_REFUNDABLE|RETURN_DATA_CORRUPT`
- route responses: 400 validation, 401 missing session, 403 wrong role, 404 inaccessible resource, 409 state/quantity/idempotency conflict, 422 eligibility/window/payment rule failure

### Data and Migration

- proposed: `apps/api/src/db/migrations/017_returns_refunds.ts`; register after `016_review_depth`
- `return_requests`: order/user FKs, constrained status/reason, bounded note, nonnegative version, state timestamps, requested instant
- `return_request_items`: return FK, shipment FK, ordinary order-line FK, positive quantity, delivery/window snapshot, unique request + shipment + line
- `return_events`: return/order FK, constrained event type, actor user FK, idempotency key + request fingerprint pair, occurred instant; unique idempotency key; update/delete rejection triggers
- `refunds`: unique return FK, succeeded payment FK, unique idempotency key, gross/discount/net nonnegative checks, `gross - discount = net`, processor FK, simulated reference, created instant; update/delete rejection triggers
- `refund_items`: refund + return-item FKs, positive quantity, gross/discount/net checks, unique refund + return item; update/delete rejection triggers
- indexes: customer/order request history, admin status queue, request-item order line, event return chronology, refunds payment lookup
- inventory migration: rebuild `inventory_stock_movements` under foreign keys disabled only within migration helper protocol; preserve all rows/IDs/indexes/triggers; add `return_received` enum member + nullable `return_request_id` FK
- inventory movement check: `return_received` requires positive delta + return request; non-return movement requires null return request; existing movement identity remains valid
- compatibility: no return backfill; existing orders, payments, allocations, movements, events, seed rows preserved byte-equivalent by focused projections
- migration failure: row-count and identity comparison mismatch throws; no silent data loss
- reset: drop immutable triggers, delete refund items/refunds/return events/requests before orders, delete movements, recreate immutable triggers

### Domain Rules

- proposed: `apps/api/src/features/returns/returnRules.ts`, `returnTypes.ts`, `returnErrors.ts`
- `assertReturnTransition()`: exact state graph
- `returnWindowClosesAt()`, `isWithinReturnWindow()`: injected instant + exclusive close boundary
- `assertEligibleSelections()`: unique selection keys, positive safe integers, delivered ordinary allocations, quantity cap
- `returnFingerprint()`: recursive key-sorted SHA-256 operation fingerprint
- `allocateOrderDiscountByLine()`: integer largest-remainder allocation with stable ties
- `calculateCumulativeRefundDelta()`: per-line cumulative refund target + current delta
- pure tests: window before/at/after boundary; mixed delivered/undelivered split shipment; partial quantities; duplicate selections; Powderizer rejection; rejected-quantity release; discount remainder ties; multi-refund cumulative rounding; full-line exactness; nonreturnable Powderizer discount share; zero discount; corruption checks

### Persistence and Workflow

- proposed: `apps/api/src/features/returns/returnRepository.ts`
- eligibility query joins orders -> delivered shipments -> shipment items -> ordinary purchase lines -> delivery events; excludes Powderizer; aggregates non-rejected requested quantity
- request repository inserts request, items, immutable event; reads owned/admin detail and stable pages
- state repository uses expected version + expected status predicates; one-row mutation required
- idempotency lookup reads return event key/fingerprint/return ID
- refund repository resolves one `payments.status='succeeded'` row by order, prior refunded quantity/amount per order line, inserts immutable refund header/items
- proposed: `apps/api/src/features/returns/returnService.ts`
- customer `getOverview()`: ownership-gated eligibility + history
- customer `requestReturn()`: transaction-owned revalidation, quantity reservation, event, audit, replay
- admin `listReturns()`, `decideReturn()`, `receiveReturn()`, `refundReturn()`
- service never accepts client-calculated eligibility, delivery time, price, discount, refund, payment, or stock facts
- proposed: `apps/api/src/features/returns/refundGateway.ts` -> deterministic local reference only
- inventory extension: `InventoryService.restoreReturnInventory()` validates product/line/quantity, increments stock, writes `return_received`, feeds existing FIFO backorders excluding no order; caller owns transaction
- return receive passes request ID + exact product line quantities from persisted request items

### API

- proposed: `apps/api/src/routes/returns.ts`
- `GET /api/orders/:orderId/returns` -> customer-owned `ReturnOverviewResponse`
- `POST /api/orders/:orderId/returns` -> idempotent request creation, `ReturnRequest`
- proposed: `apps/api/src/routes/adminReturns.ts`
- `GET /api/admin/returns?status=&page=&pageSize=` -> stable paginated queue
- `POST /api/admin/returns/:returnId/decision` -> approve or reject
- `POST /api/admin/returns/:returnId/receive` -> stock restoration
- `POST /api/admin/returns/:returnId/refund` -> simulated refund
- thin routes: TypeBox validation -> auth gate -> service -> typed error/status mapping
- no raw note, payment fingerprint, card metadata, customer address, or stack trace in logs/errors

### Customer Web

- proposed: `apps/web/src/api/returns.ts`; validate every success with shared schemas
- proposed: `apps/web/src/features/returns/ReturnPanel.tsx`
- panel loads overview independently after order detail; aborts/ignores stale completion on order change/unmount
- eligible rows grouped by delivered shipment; quantity control max = server `availableQuantity`
- request form: reason, conditional optional note, selected quantities, submit disabled during request
- server owns final eligibility; 409/422 refreshes overview and announces changed eligibility
- idempotency key retained across ambiguous/network retry; cleared after success or definitive payload conflict
- history: status label, requested items, timestamps, refund amount/reference only after refunded
- empty states: not delivered, window expired, all eligible quantity reserved/returned, Powderizer-only order
- accessibility: explicit labels, field errors, keyboard flow, focus to first invalid control, `aria-live` mutation result, no color-only statuses
- responsive: preserve current max-width order layout; no horizontal overflow at supported desktop sizes
- integrate into `OrderDetailPage.tsx` below core `OrderDetailView`; return failure never replaces core order content
- update `serviceArticles.ts`: simulated 30-day workflow, no real postage/payment, Powderizer exclusion, admin processing, cancellation distinction

### Seed and Operator Surface

- extend fixed delivered seed scenarios with one eligible unrequested ordinary quantity and one completed/refunded request
- seed return/refund/event/inventory rows insert-only by stable seed key; normal `seed` never rewrites user-mutated request state
- reset removes return/refund state then restores canonical rows
- README: customer credentials, eligible order scenario, admin credentials, curl payloads for list/approve/receive/refund, simulated-only warning

## Execution Graph

`G0 -> F1 -> R1 -> G1 -> {B1 || W1} -> {R2 || R3} -> G2 -> S1 -> R4 -> G3`

- `G0`: worktree identity valid; source baseline committed; Node 22 active; dependency health passes; policy decisions accepted
- `G1`: foundation migration, contracts, rule APIs, focused evidence accepted; `R1` has no open required finding
- `G2`: backend + web lanes complete; exact change sets reviewed; all required findings closed with targeted evidence
- `G3`: convergence review passed; reset, broad verification, manual journey checks passed; checkpoint complete

## Work Packets

### F1: Return Contracts, Migration, and Pure Rules

- mode: sequential after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/returns.ts` proposed; `packages/contracts/src/index.ts`; `packages/contracts/package.json`; `packages/contracts/test/return-contracts.test.ts` proposed; `apps/api/src/db/migrations/017_returns_refunds.ts` proposed; `apps/api/src/db/migrations/index.ts`; `apps/api/test/db/migrations.integration.test.ts`; `apps/api/src/features/returns/returnRules.ts` proposed; `returnTypes.ts` proposed; `returnErrors.ts` proposed; `returnRules.test.ts` proposed
- reads: `packages/contracts/src/orders.ts` -> ID/time/money/order line schemas -> transport conventions
- reads: `apps/api/src/db/migrations/014_order_lifecycle.ts` -> shipment/event schema + immutable triggers -> delivery authority
- reads: `apps/api/src/db/migrations/015_inventory.ts` -> movement rebuild target + existing compatibility copy checks
- reads: `apps/api/src/features/orders/orderLifecycle.ts` -> fingerprint + pure guard pattern
- reads: `apps/api/src/features/promos/promoService.ts` -> integer discount conventions
- acceptance: fresh and legacy databases migrate to v017; existing movement/order/payment identities preserved; return schemas reject unknown/invalid fields; pure rules satisfy decisions
- non-goals: SQL repositories, routes, app composition, web UI, seed/reset
- upstream inputs: `G0` -> recorded worktree identity + confirmed policy decisions
- changes:
  - define return/refund schemas, request/response types, error codes, public exports
  - create v017 tables, checks, indexes, immutable triggers, movement-table rebuild, migration compatibility assertions
  - implement state, time, eligibility input, fingerprint, discount, cumulative-refund pure rules
  - add contract, migration, and pure-rule scenarios named in target design
- invariants: no float money persistence; no current-price lookup; no existing-row rewrite beyond movement schema rebuild; unknown migration still fails
- relevant evidence: none at assignment
- test duty: `E-F1-CONTRACTS` -> `npm exec -w @shop/contracts -- tsx --test test/return-contracts.test.ts`; `E-F1-RULES` -> `npm exec -w @shop/api -- tsx --test src/features/returns/returnRules.test.ts`; `E-F1-MIGRATION` -> `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts`
- verification: inspect `PRAGMA foreign_key_check`; compare pre/post legacy movement IDs, deltas, links; report exact changed symbols + evidence IDs
- handoff: accepted schemas, table/column names, status graph, error codes, rule signatures, migration v017 change set -> `B1`, `W1`, `S1`

### B1: Return Persistence, Workflow, Inventory, and Routes

- mode: parallel with `W1` after `G1`
- depends on: `F1`, `R1`, `G1`
- owns: `apps/api/src/features/returns/returnRepository.ts` proposed; `returnService.ts` proposed; `refundGateway.ts` proposed; `apps/api/src/features/inventory/inventoryRepository.ts`; `apps/api/src/features/inventory/inventoryService.ts`; `apps/api/src/features/inventory/inventoryTypes.ts`; `apps/api/src/routes/returns.ts` proposed; `apps/api/src/routes/adminReturns.ts` proposed; `apps/api/test/returns/*.integration.test.ts` proposed; focused inventory integration test additions
- reads: `apps/api/src/features/orders/orderRepository.ts` -> owned detail, shipment allocations, purchase snapshots
- reads: `apps/api/src/features/orders/orderService.ts` -> UoW, replay, optimistic state, audit pattern
- reads: `apps/api/src/features/payments/paymentRepository.ts` -> succeeded payment source
- reads: `apps/api/src/features/inventory/inventoryService.ts` -> receipt/cancellation FIFO coordinator
- reads: `apps/api/src/routes/orders.ts` + `adminOrders.ts` -> auth + 404/conflict route policy
- reads: `apps/api/src/features/audit/auditEvent.ts` + `auditService.ts` -> safe event inputs
- acceptance: customer ownership and eligibility enforced; admin role enforced; every transition/idempotency rule works; received return restores stock once and feeds FIFO; refund records exact proration without changing order/payment/promo facts
- non-goals: `apps/api/src/app.ts`, seed/reset, customer UI, admin UI, README
- upstream inputs: `F1` accepted change set -> exact contracts, schema, rules, error vocabulary
- changes:
  - implement eligibility/history/admin queue SQL with stable ordering and corruption checks
  - implement transactional customer request + admin decision/receive/refund services
  - extend inventory repository/service for linked return restoration + existing FIFO allocation
  - implement customer/admin route plugins and typed error mapping
  - test owner/admin/anonymous isolation, window boundary, split shipment, partial cap, Powderizer exclusion, replay/conflict, stale state, rollback, stock/FIFO, rounding, immutable originals, audit sanitization
- invariants: route input never controls money/stock/time/ownership; same-key replay writes nothing; transaction failure leaves state/stock/refund/audit unchanged
- relevant evidence: `E-F1-CONTRACTS`, `E-F1-RULES`, `E-F1-MIGRATION` only if change set still valid
- test duty: `E-B1-RETURNS` -> `npm exec -w @shop/api -- tsx --test test/returns/*.integration.test.ts`; `E-B1-INVENTORY` -> `npm exec -w @shop/api -- tsx --test test/inventory/inventoryRepository.integration.test.ts`
- verification: direct SQLite assertions for original orders/payments/promo rows; movement/event/refund immutability; unauthorized mutation absence
- handoff: route plugin exports, service factory/dependencies, repository contracts, inventory extension, focused evidence -> `S1`

### W1: Customer Return Experience

- mode: parallel with `B1` after `G1`
- depends on: `F1`, `R1`, `G1`
- owns: `apps/web/src/api/returns.ts` proposed; `apps/web/src/features/returns/**` proposed; `apps/web/src/features/orders/OrderDetailPage.tsx`; `apps/web/src/features/orders/OrderPages.test.tsx`; `apps/web/src/features/help/content/serviceArticles.ts`; focused help tests
- reads: `apps/web/src/api/orders.ts` -> schema-validated client pattern
- reads: `apps/web/src/features/orders/OrderDetailPage.tsx` -> load/cancel/stale refresh/focus behavior
- reads: `apps/web/src/features/orders/OrderDetailView.tsx` -> placement + purchase/shipment labels; read-only
- reads: `apps/web/src/features/product/ReviewsSection.tsx` -> secondary-section failure isolation
- reads: `apps/web/src/features/help/content/helpContentTypes.ts` -> typed article content
- acceptance: customer can select eligible delivered ordinary quantities, submit one request, recover from validation/state/network failures, and read request/refund history without disrupting order detail
- non-goals: admin UI, order total mutation, cancellation redesign, route registry, backend behavior
- upstream inputs: `F1` accepted change set -> return schemas + status/error types; use mocked API until `S1`
- changes:
  - add shared-schema return client
  - implement independent overview load, quantity/reason/note form, mutation idempotency lifecycle, history/status presentation
  - integrate panel into order detail while preserving cancellation and core-load paths
  - replace obsolete no-workflow help copy with accurate simulated policy + exclusions
  - test success, empty/expired/Powderizer states, quantity bounds, 409/422 refresh, ambiguous retry key reuse, secondary-load failure, keyboard/focus/live-region behavior
- invariants: no client refund calculation or eligibility authority; no raw note rendering as markup; stale async result ignored
- relevant evidence: `E-F1-CONTRACTS` only if contract change set still valid
- test duty: `E-W1-UI` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/orders/OrderPages.test.tsx src/features/returns/*.test.tsx`; `E-W1-HELP` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/help/HelpPages.test.tsx`
- verification: DOM checks for labels, focus, live announcements, core order survival; report exact mocked contract assumptions
- handoff: API client + integrated panel + help copy + focused evidence -> `S1`

### S1: Composition, Seed, Documentation, and Fan-In

- mode: sequential after `G2`
- depends on: `B1`, `W1`, `R2`, `R3`, `G2`
- owns: `apps/api/src/app.ts`; `apps/api/src/db/seed.ts`; `apps/api/src/db/reset.ts`; `apps/api/src/db/orderSeedScenarios.ts`; `apps/api/test/db/seed.integration.test.ts`; `apps/api/test/http/app.integration.test.ts`; `README.md`
- reads: `B1` accepted service/route exports -> dependency wiring
- reads: `W1` accepted client calls -> end-to-end contract match
- reads: `apps/api/src/app.ts` -> service graph + route registration
- reads: `apps/api/src/db/orderSeedScenarios.ts` + `reset.ts` -> deterministic commerce fixture ownership
- reads: `CLAUDE.md` -> clean gate + operator documentation requirements
- acceptance: composed app serves all customer/admin return routes; reset/seed yields canonical eligible + refunded scenarios; README commands match contracts; fan-in tests pass once
- non-goals: admin UI, new return policy, unrelated refactor, dependency addition
- upstream inputs: `B1` accepted change set -> service factory, route plugins, inventory API; `W1` accepted change set -> requested transport; `G2` -> closed findings + valid focused evidence
- changes:
  - instantiate return repository/service with DB, UoW, clock, audit, inventory, refund adapter
  - expose service through `AppServices`; register customer/admin route plugins
  - add insert-only stable return/refund seed scenarios + dependency-ordered reset cleanup
  - add full-app route smoke + seed/reset determinism assertions
  - document local customer/admin trigger path + simulated-only constraints
  - reconcile contract mismatch through producer-owner fix directive, not unilateral cross-owned rewrite
- invariants: imports create no DB/listener side effects; seed rerun preserves user-created/mutated rows; reset re-creates immutable triggers
- relevant evidence: accepted `E-F1-*`, `E-B1-*`, `E-W1-*` entries whose invalidators unchanged
- test duty: `E-S1-FANIN` -> `npm run test:integration`; do not rerun valid focused commands
- verification: `npm run seed` twice -> stable canonical counts/state; full app injection confirms auth + success schemas; inspect README payloads against contracts
- handoff: composed final change set + fan-in evidence + seed credentials/triggers -> `R4`, `G3`

## Review Assignments

### R1: Review `F1`

- target: `F1` exact accepted base/head revision or immutable diff
- reads: v017 migration -> data preservation/checks/triggers; return contracts -> transport strictness; return rules/tests -> policy and rounding
- acceptance: migration safe for existing rows; schema exports valid; pure rules encode every fixed invariant and boundary
- invariants: no float money; exclusive window close; stable remainder ties; full cumulative refund exact; no Powderizer return
- risk focus: SQLite table rebuild, FK restoration, movement enum compatibility, cumulative rounding overrefund, permissive TypeBox shapes
- non-goals: repository SQL, routes, UI, seed
- write policy: inspect-only
- test policy: assess `E-F1-CONTRACTS`, `E-F1-RULES`, `E-F1-MIGRATION`; run only assigned command or stale/missing evidence blocking verdict
- relevant evidence: `E-F1-CONTRACTS`, `E-F1-RULES`, `E-F1-MIGRATION`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `B1`

- target: `B1` exact accepted base/head revision or immutable diff
- reads: return repository/service/routes + inventory extension + integration tests
- acceptance: auth, quantity reservation, transition, idempotency, refund, stock, audit, rollback requirements satisfied
- invariants: customer sees only owned data; admin-only processing; receive/refund exactly once; original money facts immutable; all multi-write commands transactional
- risk focus: TOCTOU eligibility, duplicate delivery events, replay after later state, concurrent quantities, stock double-credit, FIFO ordering, refund cap, sensitive logging
- non-goals: web UX, seed, README, general order lifecycle
- write policy: inspect-only
- test policy: assess `E-B1-RETURNS`, `E-B1-INVENTORY` + relevant valid foundation evidence; no duplicate run
- relevant evidence: `E-B1-RETURNS`, `E-B1-INVENTORY`, valid `E-F1-*`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R3: Review `W1`

- target: `W1` exact accepted base/head revision or immutable diff
- reads: return client/panel/order integration/help copy/tests
- acceptance: UI exposes server facts accurately, survives secondary failure, handles stale/conflict flows, meets keyboard/focus/live-region requirements
- invariants: no client money/eligibility authority; retry key behavior correct; no unsafe note rendering; Powderizer and cancellation wording accurate
- risk focus: duplicate submission, stale async overwrite, quantity state after refresh, inaccessible errors/dialogs, core order regression
- non-goals: backend correctness, admin UI, styling outside order/return section
- write policy: inspect-only
- test policy: assess `E-W1-UI`, `E-W1-HELP` + contract evidence; no duplicate run
- relevant evidence: `E-W1-UI`, `E-W1-HELP`, valid `E-F1-CONTRACTS`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R4: Review `S1` and Integrated Change Set

- target: `S1` exact integrated base/head revision or immutable diff including accepted `F1+B1+W1`
- reads: composition root, seed/reset, README, route-contract call sites, supplied fan-in evidence
- acceptance: dependency graph correct; route and client contracts converge; seed/reset deterministic; docs executable; no unresolved required finding
- invariants: one SQLite transaction authority per command; source checkout untouched; no external service/dependency; no admin UI; no automatic integration back
- risk focus: missing route registration, wrong injected service, reset trigger loss, seed rewrite, contract drift, final evidence invalidation
- non-goals: rerunning full suite, new policy, cosmetic UI review
- write policy: inspect-only
- test policy: assess `E-S1-FANIN` + valid focused ledger; run only when missing/stale evidence blocks verdict
- relevant evidence: all valid `E-F1-*`, `E-B1-*`, `E-W1-*`, `E-S1-FANIN`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `F1` finishes before consumers; no parallel write to contracts, v017 migration, migration registry, return pure-rule files
- `B1 || W1`: disjoint API vs web ownership; both treat `F1` contracts read-only
- `apps/api/src/app.ts`, seed/reset/scenario files, full-app tests, `README.md`: `S1` only
- `apps/web/src/features/orders/OrderDetailView.tsx`: read-only unless `W1` assignment revision explicitly adds ownership; default panel composition remains `OrderDetailPage.tsx`
- `packages/contracts/src/index.ts` + `packages/contracts/package.json`: `F1` only
- `apps/api/src/db/migrations/index.ts`: `F1` only; reserve version `017`
- `apps/api/src/features/inventory/*`: `B1` only after `F1`; `S1` consumes interface without edits
- shared-surface defect after handoff: orchestrator reissues owner assignment or sends worker fix directive; reviewer never edits
- composition conflict: `S1` resolves only owned composition/docs/seed files; producer defects return to `F1`, `B1`, or `W1`

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, worker-owned verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, developer instructions from global Codex settings. Never override those values in plan or assignment.
- non-Codex harness: use harness-native role configuration while preserving worker/reviewer duties and communication contracts

## Test Execution Schedule

- `T0`: `G0` -> owner: orchestrator -> prepend documented Node 22 path when needed; run `node --version`; require v22.x; run `npm exec -- tsx --version`; run `npm run typecheck -w @shop/api`
- `T1`: `F1` settled -> owner: `F1` -> `E-F1-CONTRACTS`, `E-F1-RULES`, `E-F1-MIGRATION`
- `T2`: `B1` settled -> owner: `B1` -> `E-B1-RETURNS`, `E-B1-INVENTORY`
- `T3`: `W1` settled -> owner: `W1` -> `E-W1-UI`, `E-W1-HELP`
- `T4`: parallel fan-in + composition settled -> owner: `S1` -> `npm run test:integration` once as `E-S1-FANIN`
- `T5`: all review fixes settled -> owner: `G3` -> `npm run reset` once as `E-G3-RESET`; then `npm run verify` once as `E-G3-VERIFY`
- manual: after `E-G3-VERIFY` -> owner: `G3` -> serve via existing or hidden loopback dev server; verify customer request, expired/empty state, admin approve/receive/refund through API, customer refreshed history, stock/backorder result; stop only task-started server
- reuse: passing evidence remains valid across sessions when covered change set + invalidators unchanged; assignment receives relevant entries only
- invalidation: `packages/contracts/src/returns.ts|package.json|index.ts` -> invalidate consumer type/build/UI/API contract evidence
- invalidation: v017 migration/schema/return rules -> invalidate migration + B1 + fan-in + final evidence
- invalidation: return repository/service/routes or inventory files -> invalidate B1 + fan-in + final evidence
- invalidation: return web/order integration/help -> invalidate W1 + fan-in where contract behavior affected + final evidence
- invalidation: app/seed/reset/config/fixtures -> invalidate fan-in + reset + final evidence
- fixes: fixing worker runs smallest affected command; orchestrator records new change set and invalidates only covered downstream entries
- reviewer sessions: no test rerun solely for confidence

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every orchestrator-subagent message and JSON string value
- transport: one inline canonical JSON object; no free-text wrapper; temp artifact references only for bulky logs/diffs under protocol
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: packet objective + acceptance + owned paths + focused reads + invariants + accepted upstream inputs + relevant evidence + non-goals; exclude full plans, source plan, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-run-state.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- required worktree context: absolute worktree path + implementation branch + base revision in every assignment; repository-relative paths resolve below worktree root
- message identity: unique `message_id`; exact `in_reply_to`; active `assignment_revision`
- assignment change: objective/ownership/acceptance/review target/verification duty change -> full reissue + revision increment
- directive use: narrow clarification, scope correction, finding fix, protocol correction, continuation, stop
- finding flow: stable reviewer finding ID -> originating worker `action=fix` directive -> targeted fix evidence -> checkpoint closure; no reviewer return loop
- replacement worker: only flawed architecture/security, cross-ownership fix, failed fix, unavailable owner; bootstrap full revised assignment before fix directive
- state: atomically replace `[platform temp root]/orchestrator/[run_id]/state.json` after accepted report, directive, finding transition, decision, handoff, evidence invalidation
- recovery: saved plan + current checkpoint + referenced artifacts; never replay transcript
- temp cleanup: orchestrator removes only run-scoped temp artifacts after final gate; repository receives no routine report artifacts

## Orchestrator Run Order

1. End planning context after plan save.
2. Start fresh runtime orchestrator; load source-checkout `CLAUDE.md`, saved plan, canonical communication templates, record shapes, current checkpoint.
3. Record source checkout absolute path, named branch, `HEAD`; stop on detached `HEAD`.
4. Inspect relevant uncommitted/untracked inputs; stop for user commit or baseline decision when absent from `HEAD`.
5. Create unique implementation branch + shared worktree from source branch `HEAD`; verify identity; persist source/worktree facts.
6. Switch execution root to worktree; load worktree repository instructions; run `T0`; validate `G0` decisions and assumption.
7. Launch fresh/minimal `F1` worker inside worktree; accept report + evidence; update checkpoint.
8. Launch inspect-only `R1` against exact `F1` change set; route required finding IDs to `F1`; close with targeted evidence; validate `G1`.
9. Launch fresh/minimal `B1 || W1` workers inside same worktree with disjoint ownership + accepted `F1` interfaces.
10. Accept reports; update handoffs/evidence; launch inspect-only `R2 || R3` against exact lane change sets.
11. Route stable required findings once to originating workers; record fixes, targeted evidence, invalidations, closure; validate `G2`.
12. Launch fresh/minimal `S1` with accepted backend/web interfaces + relevant evidence; compose, seed, document, run `T4` once.
13. Launch inspect-only `R4` against exact integrated change set; route findings to correct implementation owner; run targeted fix evidence; no reviewer return.
14. Validate `G3` prerequisites; run `T5` once after fixes settle; run manual loopback checks.
15. Leave worktree + implementation branch intact. Reply with absolute worktree path, implementation branch, source branch, base revision; state user owns merge.

## Risks and Open Questions

- risk: split shipments use order-level status only -> mitigation: eligibility keyed to delivered shipment allocation + immutable delivery event
- risk: multiple requests oversubscribe one delivered allocation -> mitigation: active-quantity aggregate + insert inside one SQLite transaction
- risk: partial refund rounding leaks cents or over-refunds -> mitigation: stable whole-order discount allocation + cumulative per-line target + aggregate caps + pure boundary tests
- risk: Powderizer absorbs discount share but cannot return -> mitigation: allocate discount across every purchased line before ordinary-line refund computation; document expected retained discount
- risk: stock credited twice on retry -> mitigation: state/version guard + return-event idempotency + receive transaction + unique key
- risk: restored stock immediately disappears into FIFO backorder -> mitigation: paired `return_received` and `backorder_allocated` movements; response/history does not promise ending stock increase
- risk: movement-table rebuild loses immutable rows/triggers -> mitigation: copy identity assertions, FK check, trigger tests, migration reviewer focus
- risk: customer note leaks through audit/log/UI -> mitigation: bounded plain-text contract, no note audit metadata, React text rendering
- risk: seeded eligibility expires after fixed date -> mitigation: seed terminal refunded state remains demonstrable; README explains creating fresh delivered fixture through existing admin lifecycle API
- question: duplicate shipment delivery events in corrupt legacy data -> owner/gate: `G0` accepts fail-closed assumption; `F1` migration/repository tests enforce one authoritative delivery event

## Done Criteria

- eligible authenticated customer creates partial ordinary-product return within 30-day window
- expired, undelivered, Powderizer, duplicate, excessive, and foreign-order requests fail without writes
- admin-only API lists, approves/rejects, receives, and refunds through guarded state graph
- receive restores ordinary stock exactly once and preserves FIFO backorder behavior atomically
- refund proration remains integer, deterministic, cumulatively capped, exact at full ordinary-line return
- refund record and audit exist; original order/payment/promotion facts remain unchanged
- customer order detail shows independent eligibility, request state, terminal refund facts, resilient failures, accessible interactions
- migration preserves existing data; seed/reset deterministic; README/help describe simulated behavior accurately
- focused, fan-in, reset, broad verification, and manual journey evidence pass on final change set
- implementation remains isolated in retained worktree/branch; user owns integration
