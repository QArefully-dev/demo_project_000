# Order History and Lifecycle Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `1. Order history and lifecycle`
Repository baseline: `powder_expansion_2` at `3cf9473`, inspected 2026-07-19; user-owned working-tree changes present

## Objective

Deliver secure customer order history plus persisted simulated fulfilment lifecycle. Customer can list owned orders, inspect immutable purchased lines, follow shipment-specific tracking, and cancel eligible orders. Admin-only API can create complete shipment plans and advance simulated shipments without exposing operations UI.

Completion boundary:

`checkout -> processing order -> packed shipment plan -> shipped -> delivered | delivery_failed`

Split shipment represented by multiple shipment records and per-line quantity allocations. Cancellation stops fulfilment before any shipment leaves. No refund, return, live carrier, background progression, or ordinary-product inventory work.

## Scope

### In

- authenticated customer order list with stable newest-first pagination
- authenticated owner order detail at `/orders/:orderId`
- existing checkout confirmation at `/order-confirmation/:orderId`
- secure guest confirmation through exact-order HttpOnly capability cookie
- immutable ordinary-product and Powderizer snapshot rendering
- order states: `processing`, `packed`, `shipped`, `delivered`, `delivery_failed`, `cancelled`
- shipment states: `packed`, `shipped`, `delivered`, `delivery_failed`, `cancelled`
- complete one-or-many shipment allocation per order
- shipment tracking references and ordered lifecycle events
- customer full-order cancellation while no shipment has shipped
- admin-only API commands for packing, shipment transition, and tracking update
- optimistic versions, idempotency keys, transactions, ownership checks, sanitized audit events
- deterministic Alice/Bob lifecycle seed scenarios
- migration, reset, contracts, API, domain, SQLite, React, accessibility, and journey verification

### Out

- partial line cancellation
- refund, payment reversal, store credit, or total mutation
- return authorization, return windows, or stock restoration
- ordinary product stock reservation or consumption
- backorders, reservation expiry, delivery estimates, or delivery methods
- live carrier API, webhook, queue, notification retry, or automatic time-based progression
- customer tracking-number search outside owned order detail
- admin UI or broad order-management dashboard
- guest order history or guest cancellation
- editing customer, address, purchased lines, prices, discounts, or Powderizer snapshots

## Repository Findings

- existing: `packages/contracts/src/orders.ts` -> `Order`, `OrderLineItem`, `OrderDetailResponse`; numeric order IDs, immutable names/prices, Powderizer snapshot normalization, no lifecycle or list contracts
- existing: `apps/api/src/features/checkout/orderRepository.ts` -> `create()` and `findById()`; repository owns order plus line snapshot SQL but lives under checkout
- existing: `apps/api/src/features/checkout/orderService.ts` -> unrestricted ID read only
- existing: `apps/api/src/features/checkout/checkoutFinalizer.ts` -> order, payment, cart consumption, mailbox receipt, audit writes share one SQLite transaction
- existing: `apps/api/src/features/checkout/checkoutService.ts` -> successful idempotency replay can return stale `payments.response_json` instead of rehydrating current order
- existing: `apps/api/src/routes/orders.ts` -> unauthenticated `GET /api/orders/:orderId`; sequential IDs expose unrelated customer orders by enumeration
- existing: `apps/api/src/routes/payments.ts` -> guest checkout supported; session-derived `userId` attached only when signed in
- existing: `apps/api/src/plugins/auth.ts` -> `requireAuth`, `requireCustomer`, `requireAdmin`, request-local optional user, HttpOnly `sid` cookie pattern
- existing: `apps/api/src/db/migrations/001_initial.ts` and `004_order_user.ts` -> nullable `orders.user_id`; legacy and guest orders remain unowned
- existing: `apps/api/src/db/migrations/008_powderizer.ts` -> `order_powder_mix_items.id` plus strict JSON snapshot; row ID not exposed by order contract
- existing: `apps/api/src/db/migrations/013_customer_reviews.ts` -> ownership and successful-payment indexes already support verified-purchase reads
- existing: `apps/api/src/features/audit/*` -> allowlisted append-only audit ledger and transaction-external writer; supports `order.created`, not lifecycle actions or shipment entity
- existing: `apps/web/src/features/checkout/OrderConfirmationPage.tsx` -> direct read, loading/error/retry, ordinary and mix rendering; no status, shipment, or cancellation UI
- existing: `apps/web/src/api/client.ts` -> successful response TypeBox validation and credentialed fetch
- existing: `apps/web/src/App.tsx`, `components/ProtectedRoute.tsx`, `components/AccountMenu.tsx`, `features/account/AccountPage.tsx` -> protected account patterns and navigation composition points
- existing: `apps/web/src/features/help/content/serviceArticles.ts` -> truthful simulated shipping and return disclaimers; copy anticipates order states but says no tracking number exists
- existing: `apps/api/src/db/seed.ts` -> three deterministic users and canonical catalog, promo, favourite data; no orders
- existing: `apps/api/src/db/reset.ts` -> foreign-key-ordered commerce cleanup while preserving audit ledger
- existing: root `package.json` and workspace manifests -> exact focused and broad verification commands; API integration glob omits proposed `test/orders/`
- gap: no customer order list, owner authorization, status guard, shipment model, tracking history, lifecycle command, cancellation, lifecycle seed, or UI route
- constraint: successful checkout response and `/order-confirmation/:orderId` URL must remain compatible; new detail fields additive
- constraint: existing persisted product and Powderizer snapshots remain source for purchased identity; current catalog never rewrites history
- constraint: existing anonymous order rows cannot receive unknown historical capability tokens during migration
- constraint: source plan says 45 canonical products; `apps/api/src/db/seed.ts` and tests currently reserve 50. Follow code; do not alter catalog counts in this slice
- reuse: password-reset token pattern -> random 32-byte token, SHA-256 digest only, injected token source for deterministic tests
- reuse: review and audit query patterns -> bounded TypeBox pagination, allowlisted SQL, stable secondary ID ordering
- reuse: review route/service error pattern -> typed domain error mapped to 400/404/409 without leaking ownership

## Decisions and Invariants

- order authority: backend persistence and lifecycle service; UI never derives mutation eligibility
- line identity: expose database `order_line_items.id` and `order_powder_mix_items.id` as `lineId`; never mutate embedded purchase snapshot
- order status: persisted denormalized projection recomputed inside same transaction as shipment mutation and lifecycle event
- aggregate precedence: `cancelled` -> `delivery_failed` when any active shipment failed -> `delivered` when all delivered -> `shipped` when any shipped or delivered -> `packed` when shipment plan exists -> `processing`
- split visibility: aggregate remains compact; shipment cards show per-shipment status and allocations
- packing invariant: one atomic command creates 1+ shipments; summed allocation for every order line equals ordered quantity; no missing, unknown, zero, negative, or overallocated line
- transition invariant: shipment `packed -> shipped -> delivered | delivery_failed`; failed, delivered, and cancelled terminal in this scope
- cancellation invariant: authenticated owner only; allowed in `processing` or `packed`; reject after any shipment reaches `shipped`, `delivered`, or `delivery_failed`
- cancellation effect: mark order and any packed shipments cancelled; append lifecycle plus audit facts; retain payment, totals, lines, promo redemption, and stock facts unchanged
- concurrency: order and shipment rows carry non-negative integer `version`; status mutations use guarded `UPDATE ... WHERE version = ?`
- idempotency: each lifecycle command requires UUID idempotency key; persisted event stores normalized request fingerprint; same key plus same fingerprint returns current result, same key plus changed payload returns 409
- history: lifecycle events insert only through repository; no update API; database blocks event updates but permits cascade/reset deletes
- event ordering: `occurred_at ASC, id ASC`; list ordering: `orders.created_at DESC, orders.id DESC`
- authorization: order list requires customer session; detail permits owner, admin, or valid exact-order guest capability; unauthorized and foreign-order detail return 404
- guest capability: payment success for anonymous checkout issues random token, stores digest and expiry, sets `qpc_order_<id>` HttpOnly SameSite=Lax cookie scoped to `/api/orders/<id>`; raw token never enters JSON, logs, audit, or payment replay storage
- guest capability expiry: 24 hours from issuance; same-key guest payment replay may rotate grant and cookie
- migration compatibility: retain all existing orders and snapshots as `processing`; add initial lifecycle event at original `created_at`; existing authenticated ownership continues; pre-migration anonymous rows remain admin-readable but cannot be anonymously reclaimed
- checkout replay compatibility: succeeded payment replay rehydrates order by `payment.order_id`; do not trust legacy success JSON missing lifecycle fields
- route errors: malformed input 400; missing session 401; wrong admin role 403; absent/foreign order 404; invalid transition, stale version, or idempotency conflict 409
- time: injected backend clock creates all timestamps; client and admin payloads cannot choose occurrence time
- tracking content: bounded server-known event code plus optional bounded plain-text location/detail; no HTML, address, email, payment, card, session, or token data
- audit: lifecycle mutation plus sanitized audit row share transaction; lifecycle history stays customer-facing, audit ledger stays operator-facing
- no async side effects: lifecycle changes do not send mailbox or notification messages in this slice
- assumption requiring `G0` validation: security benefit outweighs loss of anonymous access to pre-migration guest order URLs
- assumption requiring `G0` validation: admin-only lifecycle command API counts as narrow backend foundation, not deferred broad admin order management
- assumption requiring `G0` validation: cancellation records fulfilment stop only; refund work remains later expansion

## Target Design

### Contracts

- extend `packages/contracts/src/orders.ts`
  - `OrderStatus`, `ShipmentStatus`, `OrderLifecycleEventType`
  - `OrderLineItem.lineId`
  - `OrderPowderMixLineItem`: normalized snapshot plus `lineId`
  - `Order`: current status/version plus existing totals, promo, lines, timestamps
  - `OrderSummary`, `OrderListQuery`, `OrderListResponse`
  - `OrderShipmentLine`, `OrderShipment`, `OrderLifecycleEvent`
  - `OrderDetailResponse`: `Order` plus shipments, events, `canCancel`
  - `CancelOrderBody`, `PackOrderBody`, `TransitionShipmentBody`, `CreateTrackingEventBody`
  - strict `additionalProperties: false`, positive IDs, bounded pages, UUID idempotency keys, ISO UTC instants
- retain `PlaceOrderResponse = Order`; checkout response remains order-shaped and gains additive lifecycle fields
- add focused `packages/contracts/test/order-contracts.test.ts` for valid states, split lines, strict payloads, bounds, and invalid transitions at transport boundary

### Data

- proposed migration: `apps/api/src/db/migrations/014_order_lifecycle.ts`
- `orders` additions:
  - `lifecycle_status TEXT NOT NULL DEFAULT 'processing'` with allowed-state check
  - `version INTEGER NOT NULL DEFAULT 0` with non-negative integer check
  - `cancelled_at TEXT`
  - `demo_seed_key TEXT`; unique partial index for non-null values because SQLite cannot add unique column through `ALTER TABLE`
- `order_shipments`:
  - `id`, `order_id`, `shipment_number`, `status`, `tracking_reference`, `version`, `created_at`, `updated_at`
  - unique `(order_id, shipment_number)` and `(order_id, tracking_reference)`
- `order_shipment_items`:
  - `shipment_id`, nullable `order_line_item_id`, nullable `order_powder_mix_item_id`, `quantity`
  - XOR line foreign keys, positive integer quantity, per-shipment unique line constraint
- `order_lifecycle_events`:
  - `id`, `order_id`, nullable `shipment_id`, `event_type`, `title`, nullable `detail`, nullable `location`, nullable `idempotency_key`, nullable `request_fingerprint`, `occurred_at`
  - unique non-null idempotency key, bounded scalar checks, event update-blocking trigger
- `order_access_grants`:
  - `id`, unique `order_id`, unique SHA-256 `token_digest`, `expires_at`, `created_at`
  - no plaintext token
- indexes:
  - `orders(user_id, created_at DESC, id DESC)`
  - shipments by `(order_id, shipment_number)`
  - shipment items by both nullable line foreign keys
  - lifecycle events by `(order_id, occurred_at, id)` and `(shipment_id, occurred_at, id)`
  - access grant expiry plus order lookup
- migration backfill:
  - all prior orders stay `processing`, version `0`, cancellation null
  - one `order_created` lifecycle event per existing order at persisted creation time
  - no synthetic shipment or access grant
- update migration registry, migration expectations, legacy upgrade assertions, and reset delete order

### Domain and Persistence

- move order ownership from checkout into proposed `apps/api/src/features/orders/`
- proposed files:
  - `orderTypes.ts`: persisted records and command input types
  - `orderLifecycle.ts`: pure transition, aggregate-status, allocation, and cancellation guards
  - `orderErrors.ts`: stable error codes/messages
  - `orderRepository.ts`: order hydration, owned pagination, guarded status writes, shipment allocations, events, access grants
  - `orderService.ts`: authorization-aware reads and transactional lifecycle commands
  - `orderAccessService.ts`: capability issue/digest/expiry validation
- remove obsolete `apps/api/src/features/checkout/orderRepository.ts` and `orderService.ts` after all consumers move
- order hydration uses explicit selected columns and mappers; no `SELECT *`
- detail hydration batches order, lines, shipments, allocations, events; preserve deterministic order for every collection
- list SQL calculates item quantity and shipment count without multiplying totals across joins; count query reuses owner predicate
- checkout create writes `processing` order and `order_created` lifecycle event inside existing payment finalization transaction
- checkout finalizer re-reads created order before response so line IDs, status, version, and lifecycle fields match persistence
- payment replay loads succeeded order from repository before legacy `response_json`
- lifecycle service owns unit of work around state guard -> row writes -> event -> audit
- access grant issuance replaces prior order grant after successful anonymous checkout result at route boundary; failure returns 500 while order remains safely replayable, and same payment idempotency key can retry grant issuance

### API and Security

- customer routes in `apps/api/src/routes/orders.ts`
  - `GET /api/orders?page=&pageSize=` -> authenticated customer-owned summaries
  - `GET /api/orders/:orderId` -> owner/admin/exact-order capability detail
  - `POST /api/orders/:orderId/cancel` -> authenticated customer owner
- proposed admin routes in `apps/api/src/routes/adminOrders.ts`
  - `POST /api/admin/orders/:orderId/shipments` -> exact complete packing allocation
  - `POST /api/admin/order-shipments/:shipmentId/transition` -> `shipped`, `delivered`, or `delivery_failed`
  - `POST /api/admin/order-shipments/:shipmentId/tracking-events` -> non-status tracking update while shipped
- register both route modules in `apps/api/src/app.ts`; composition root injects clock, token source, repositories, unit of work, audit writer
- add optional `orderAccessTokenSource` to `AppDependencies` for deterministic tests
- payment route sets guest capability cookie only after anonymous successful result; authenticated checkout relies on session ownership
- order detail checks session ownership first, then admin, then capability digest; never exposes existence on failed customer/capability lookup
- admin mutation handlers use `requireAdmin`; customer cancellation uses `requireCustomer`
- add lifecycle audit actions and `shipment` entity support in `apps/api/src/features/audit/auditEvent.ts`; allowlisted metadata only

### Customer UI

- proposed feature root: `apps/web/src/features/orders/`
- proposed files:
  - `OrdersPage.tsx`: paginated history with loading, empty, retry, status, date, total, line-count summary
  - `OrderDetailPage.tsx`: owned-detail route shell
  - `OrderDetails.tsx`: shared confirmation/detail purchased-line and total rendering
  - `OrderStatusBadge.tsx`: text plus visual status, never color-only
  - `OrderTimeline.tsx`: semantic ordered events, shipment labels, location/detail
  - `ShipmentCard.tsx`: tracking reference, status, allocated product/mix quantities
  - `CancelOrderAction.tsx`: explicit two-step confirmation, pending/error/success handling
  - `useOrderDetail.ts`, `orderPresentation.ts`: stale-response guard and pure labels
- extend `apps/web/src/api/orders.ts` with validated list, detail, and cancellation calls; create UUID idempotency key per cancellation attempt and reuse across retry
- refactor `apps/web/src/features/checkout/OrderConfirmationPage.tsx` to reuse `OrderDetails`; retain confirmation copy and guest-compatible route
- add protected `/orders` and `/orders/:orderId` routes in `apps/web/src/App.tsx`
- add `Orders` entry to authenticated `AccountMenu` and `AccountPage`; keep anonymous menu unchanged
- cancellation uses backend `canCancel`; disable repeated submission; 409 refreshes detail and explains changed state
- route changes abort or ignore stale completion; no order state in browser storage
- accessibility: headings, lists, labelled statuses, focus after cancellation, `aria-live` mutation result, keyboard-operable pagination and confirmation
- responsive: single-column mobile; detail plus shipment summary at desktop widths; no fixed-width timeline

### Seed, Help, and Operator Guidance

- proposed `apps/api/src/db/orderSeedScenarios.ts` owns canonical order scenario data and SQL helpers
- use `orders.demo_seed_key` for idempotent scenario identity; preserve user-created orders and prior user mutation during normal `npm run seed`
- Alice scenarios:
  - cancellable processing order
  - packed order
  - split order with delivered plus shipped parcels and tracking events
  - delivery-failed order
- Bob scenario: delivered order used for ownership-denial coverage
- snapshots use current canonical product facts only at initial seed insertion; later catalog seed changes never rewrite existing seeded order line snapshots
- seed IDs need not be fixed; `demo_seed_key` is test/tooling authority
- update `apps/web/src/features/help/content/serviceArticles.ts`: simulated tracking exists locally; no real carrier, parcel, ETA, refund, or fulfilment claim
- update `README.md`: seeded credentials, order-history route, cancellation boundary, admin-only lifecycle endpoint payload examples, simulated/no-refund warning

## Execution Graph

`G0 -> P1 -> P2 -> P3 -> G1 -> {P4 || P5} -> G2 -> P6 -> G3`

- `G0`: validate three assumptions; reserve migration `014`; freeze status/event enums, aggregate precedence, route shapes, cookie policy, and ownership rules
- `G1`: contracts, migration, domain, persistence, secured routes, checkout hydration, and focused backend evidence accepted
- `G2`: customer UI and seed/help lanes merged without shared-path conflicts; focused evidence valid
- `G3`: review findings closed, migration/reset/seed/manual journey verified, broad suite passes once

## Work Packets

### P1: Contract and Schema Foundation

- mode: sequential after `G0`
- depends on: `G0`
- owns:
  - `packages/contracts/src/orders.ts`
  - `packages/contracts/test/order-contracts.test.ts` proposed
  - `packages/contracts/test/transport-contracts.test.ts`
  - `apps/api/src/db/migrations/014_order_lifecycle.ts` proposed
  - `apps/api/src/db/migrations/index.ts`
  - `apps/api/test/db/migrations.integration.test.ts`
  - `apps/api/src/db/reset.ts`
  - `apps/api/test/db/seed.integration.test.ts` only reset-table assertion section
- reads:
  - `packages/contracts/src/common.ts`
  - `packages/contracts/src/powderizer.ts`
  - migrations `001`, `004`, `008`, `011`, `013`
  - `apps/api/src/features/checkout/orderRepository.ts`
- changes:
  - define strict lifecycle, shipment, event, pagination, and mutation schemas
  - expose ordinary and mix order line IDs without changing persisted Powderizer snapshot JSON versions
  - add migration tables, columns, checks, indexes, update-blocking event trigger, and prior-order event backfill
  - register migration `014`; update exact ordered-version test
  - update reset order for grants -> events -> shipment items -> shipments -> existing order children
  - prove legacy customer, totals, product lines, and mix snapshot rows survive migration
  - prove invalid statuses, XOR shipment line references, non-positive quantities, and event updates fail
- invariants: no migration rewrite of existing snapshot JSON; no generated access token during migration; no catalog schema/count edits
- test duty:
  - `T1`: `npm exec -w @shop/contracts -- tsx --test test/order-contracts.test.ts test/transport-contracts.test.ts`
  - `T2`: `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts`
- verification: migration list ends `014`; migrated legacy order has processing status and exactly one created event; reset succeeds with foreign keys enabled
- handoff: frozen TypeBox exports, migration schema, line identity model, evidence `E-P1-CONTRACTS`, `E-P1-MIGRATION`

### P2: Order Domain, Persistence, and Checkout Hydration

- mode: sequential after `P1`
- depends on: `P1`
- owns:
  - `apps/api/src/features/orders/**` proposed
  - `apps/api/src/features/checkout/checkoutTypes.ts`
  - `apps/api/src/features/checkout/checkoutFinalizer.ts`
  - `apps/api/src/features/checkout/checkoutService.ts`
  - `apps/api/src/features/checkout/orderRepository.ts` removal
  - `apps/api/src/features/checkout/orderService.ts` removal
  - `apps/api/src/features/audit/auditEvent.ts`
  - `apps/api/src/features/audit/auditEvent.test.ts`
  - `apps/api/test/orders/orderLifecycle.integration.test.ts` proposed
  - `apps/api/test/checkout/payment.integration.test.ts`
  - `apps/api/test/powderizer/powderizerCheckout.integration.test.ts`
  - `apps/api/package.json`
- reads:
  - P1 contracts and schema
  - `apps/api/src/db/unitOfWork.ts`
  - `apps/api/src/features/payments/paymentRepository.ts`
  - `apps/api/src/features/audit/auditService.ts`
- changes:
  - move current order repository/service responsibilities into order domain; update all checkout/test imports
  - implement pure allocation, transition, aggregate, cancellation, and fingerprint rules
  - implement explicit row mapping for product lines, normalized mix lines, shipments, allocations, events, summaries
  - implement owner-predicate count/list with stable pagination
  - implement optimistic guarded writes and same-key fingerprint replay semantics
  - extend allowlisted lifecycle audit actions and shipment entity mapping; keep metadata limited to IDs, status, and counts
  - create processing order plus initial lifecycle event inside checkout finalization transaction
  - rehydrate order after create and on succeeded payment replay
  - implement capability grant digest/expiry repository and service using injected clock/token source
  - add API integration glob `test/orders/*.integration.test.ts`; add lifecycle pure test to API unit script if separate file used
  - cover exact split allocation, overallocation rollback, stale versions, legal/illegal transitions, failure precedence, cancellation rollback, event order, snapshot immutability, and same-key replay
- invariants: one transaction owns each lifecycle state plus event plus audit callback; no route/auth logic; no plaintext guest token persistence
- test duty:
  - `T3`: `npm exec -w @shop/api -- tsx --test src/features/orders/orderLifecycle.test.ts src/features/audit/auditEvent.test.ts test/orders/orderLifecycle.integration.test.ts`
  - `T4`: `npm exec -w @shop/api -- tsx --test test/checkout/payment.integration.test.ts test/powderizer/powderizerCheckout.integration.test.ts`
- verification: rollback trigger on lifecycle event or audit insert leaves status, version, shipments, and allocations unchanged; successful replay returns freshly hydrated lifecycle fields
- handoff: order service/repository interfaces, lifecycle error codes, capability issue/validate interface, evidence `E-P2-LIFECYCLE`, `E-P2-CHECKOUT`

### P3: Secured Customer and Admin APIs

- mode: sequential after `P2`
- depends on: `P2`
- owns:
  - `apps/api/src/routes/orders.ts`
  - `apps/api/src/routes/adminOrders.ts` proposed
  - `apps/api/src/routes/payments.ts`
  - `apps/api/src/app.ts`
  - `apps/api/test/orders/orderRoutes.integration.test.ts` proposed
  - `apps/api/test/http/app.integration.test.ts`
- reads:
  - P1 contracts
  - P2 services
  - `apps/api/src/plugins/auth.ts`
  - `apps/api/src/features/audit/auditEvent.ts`
  - review and audit route patterns
- changes:
  - wire order repository/service/access dependencies once in composition root
  - implement customer list, secured detail, and cancel handlers with exact response schemas
  - implement admin pack, shipment transition, and tracking handlers with `requireAdmin`
  - issue/rotate exact-path capability cookie on anonymous successful payment
  - map domain errors to stable 400/404/409 and keep foreign-order behavior indistinguishable from missing
  - test anonymous list/cancel 401, customer/admin role boundaries, owner vs foreign 404, guest capability success/expiry/wrong-order denial, cookie flags/path, malformed payloads, stale version, idempotency conflict, and checkout regression
- invariants: raw capability absent from body, logs, payment JSON, lifecycle event, and audit metadata; admin detail allowed but customer list remains customer-owned only
- test duty:
  - `T5`: `npm exec -w @shop/api -- tsx --test test/orders/orderRoutes.integration.test.ts`
  - `T6`: `npm exec -w @shop/api -- tsx --test test/http/app.integration.test.ts`
- verification: guessed adjacent ID fails; exact capability cookie reaches only its scoped detail; audit metadata contains IDs/status/counts only
- handoff: stable HTTP contract, cookie behavior, route evidence `E-P3-ROUTES`, checkout smoke evidence `E-P3-APP`

### P4: Customer Order History and Detail UI

- mode: parallel with `P5` after `G1`
- depends on: `P3`, `G1`
- owns:
  - `apps/web/src/features/orders/**` proposed
  - `apps/web/src/api/orders.ts`
  - `apps/web/src/features/checkout/OrderConfirmationPage.tsx`
  - `apps/web/src/features/checkout/PowderMixPurchaseRendering.test.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/components/AccountMenu.tsx`
  - `apps/web/src/features/account/AccountPage.tsx`
- reads:
  - P1 contracts
  - `apps/web/src/api/client.ts`
  - existing product/mix purchase renderers and protected-route patterns
- changes:
  - implement validated paginated history request and state
  - implement shared detail rendering for confirmation and account detail
  - render aggregate status, immutable purchase lines, shipments, line allocations, tracking reference, and ordered timeline
  - implement customer cancellation with stable idempotency key reuse, two-step confirmation, 409 refresh, and status announcement
  - register protected account routes and authenticated navigation entries
  - preserve guest confirmation loading/error/retry and existing ordinary/Powderizer rendering
  - add focused tests for list loading/empty/error/page, detail split shipments, failed delivery, cancellation success/conflict, stale response suppression, guest confirmation, keyboard/semantic labels
- invariants: URL owns page/order identity; server owns `canCancel`; no lifecycle mutation optimism before response; no browser-persisted order or token data
- test duty:
  - `T7`: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/orders src/features/checkout/PowderMixPurchaseRendering.test.tsx`
- verification: routes survive direct load; foreign/expired access shows safe not-found error; status communicated in text; narrow layout has no horizontal overflow
- handoff: complete customer journey and focused UI evidence `E-P4-WEB`

### P5: Deterministic Lifecycle Scenarios, Help, and Guidance

- mode: parallel with `P4` after `G1`
- depends on: `P3`, `G1`
- owns:
  - `apps/api/src/db/orderSeedScenarios.ts` proposed
  - `apps/api/src/db/seed.ts`
  - `apps/api/test/db/seed.integration.test.ts` seed-scenario sections; P1 must release file after reset edits
  - `apps/web/src/features/help/content/serviceArticles.ts`
  - `apps/web/src/features/help/HelpPages.test.tsx`
  - `README.md`
- reads:
  - migration schema, contracts, lifecycle invariants
  - canonical product and user seed data
- changes:
  - add insert-once Alice/Bob order snapshots, shipments, allocations, events, and succeeded payment facts keyed by `demo_seed_key`
  - preserve changed lifecycle state on normal reseed; reset then seed restores canonical scenarios
  - assert exact scenario keys, ownership, statuses, split allocations, event ordering, payment link, and no duplicate rows after repeated seed
  - update help claims from no tracking number to simulated-only tracking
  - document routes, credentials, cancellation/no-refund boundary, and admin API simulation payloads
- invariants: no catalog rewrite; no personal/live data; seed scenarios use deterministic timestamps and tracking references; normal seed preserves user orders and customer mutation
- test duty:
  - `T8`: `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts`
  - `T9`: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/help/HelpPages.test.tsx`
- verification: two consecutive seeds do not duplicate scenarios/events; reset plus seed restores all named states; copy retains local-demo disclaimer
- handoff: reproducible manual fixtures, operator guidance, evidence `E-P5-SEED`, `E-P5-HELP`

### P6: Convergence, Review Fixes, and Journey Verification

- mode: sequential after `G2`
- depends on: `P4`, `P5`, `G2`
- owns:
  - shared integration fixes after orchestrator assigns exact paths
  - verification ledger
  - no feature expansion
- reads: all changed paths and evidence `E-P1-*` through `E-P5-*`
- changes:
  - inspect merged diff for status drift, contract/schema mismatch, ownership leaks, stale imports, duplicate SQL, and user-owned change overlap
  - run reviewer finding flow once per issue: finding -> responsible worker fix -> worker targeted test -> orchestrator closure
  - perform clean reset/seed and manual journeys using Alice, Bob, admin, and guest checkout
  - verify processing cancellation, split parcel visibility, delivered state, failure state, cross-account denial, guest cookie reload, and admin transition
  - update source plan status only with explicit user authorization; otherwise leave high-level plan untouched
- invariants: no duplicate valid test run; no reviewer-worker-reviewer loop; final broad suite runs after all fixes settle
- test duty:
  - `T10`: `npm run reset`
  - `T11`: `npm run verify`
- verification: final ledger records command, revision/change set, result, runner, and invalidating paths; manual results include route and account used without secrets
- handoff: `G3` completion evidence and remaining non-blocking risks

## Ownership and Collision Rules

- `packages/contracts/src/orders.ts`: P1 only; later packets read only. Contract change after `G1` returns to P1 and invalidates downstream contract evidence
- migration version `014`: reserved to P1; no parallel migration creation
- `apps/api/src/features/orders/**` and audit action registry: P2 only until `G1`; P3 consumes service interfaces without repository edits
- `apps/api/src/app.ts` and order/payment/admin routes: P3 only
- `apps/web/src/App.tsx`, `AccountMenu.tsx`, `AccountPage.tsx`, `api/orders.ts`, order feature: P4 only
- `apps/api/src/db/seed.ts`, order seed helper, help content, README: P5 only
- `apps/api/test/db/seed.integration.test.ts`: P1 edits reset assertion first and releases file before P5 starts; no concurrent edits
- checkout files: P2 only; P3 may edit `routes/payments.ts` but not checkout service/repository files
- source `plans/demo_project_high_level_plan.md`: read-only unless user separately authorizes status update
- composition conflicts: P6 resolves only after assigning one owner per path

## Test Execution Schedule

- `T1` after P1 contracts settle -> owner P1 -> focused contract files
- `T2` after P1 migration/reset settle -> owner P1 -> migration integration file
- `T3` after P2 domain/repository settle -> owner P2 -> lifecycle unit plus SQLite integration
- `T4` after P2 checkout hydration settles -> owner P2 -> payment plus Powderizer checkout regression
- `T5` after P3 routes settle -> owner P3 -> order route integration
- `T6` after P3 composition/audit settles -> owner P3 -> app integration plus audit unit
- `T7` after P4 UI settles -> owner P4 -> order and confirmation Vitest files
- `T8` after P5 seed settles -> owner P5 -> seed integration
- `T9` after P5 help copy settles -> owner P5 -> help page test
- `T10` after P6 fixes settle -> owner P6 -> reset and seed once
- `T11` after `T10` and manual checks -> owner P6 -> `npm run verify` once
- reuse: orchestrator records evidence ID, exact command, change set, result, runner, and invalidating paths; pass remains valid across sessions when inputs unchanged
- reviewer rule: inspect diff, invariants, contracts, and ledger first; run no command already covered by valid evidence
- invalidation:
  - `packages/contracts/src/orders.ts` -> `T1`, `T3`, `T5`, `T7`, `T11`
  - migration/order schema/reset -> `T2`, `T3`, `T8`, `T10`, `T11`
  - order domain/repository/checkout -> `T3`, `T4`, `T5`, `T8`, `T11`
  - auth/cookie/routes/audit/composition -> `T5`, `T6`, manual security checks, `T11`
  - order web/API client/routes -> `T7`, manual customer journeys, `T11`
  - seed/help/README -> `T8` or `T9`; README-only wording does not invalidate code tests

## Orchestrator Run Order

1. Validate `G0` assumptions and freeze shared vocabulary.
2. Launch P1. Record `T1` and `T2`; inspect migration and contract compatibility.
3. Launch P2 after P1 acceptance. Record `T3` and `T4`; confirm old checkout order files removed.
4. Launch P3 after P2 acceptance. Record `T5` and `T6`; validate `G1` through security-focused diff review.
5. Launch `P4 || P5`. Enforce disjoint ownership and P1 release of seed test before P5.
6. Record `T7`, `T8`, `T9`; inspect UI and seed handoffs; validate `G2`.
7. Route findings to responsible worker once. Worker runs smallest affected test; orchestrator closes without reviewer return loop.
8. Launch P6. Run `T10`, manual journeys, then `T11` once after fixes settle.
9. Validate `G3`; report implementation state without editing source-plan status unless authorized.

## Risks and Open Questions

- risk: public numeric detail endpoint leaks order data -> mitigation: owner/admin/capability authorization plus adjacent-ID route tests
- risk: legacy anonymous orders lose direct anonymous access -> mitigation: preserve rows, retain admin access, document reset; `G0` must accept compatibility tradeoff
- risk: guest token lost between successful order commit and cookie response -> mitigation: idempotent payment replay issues fresh grant; raw token never stored in replay JSON
- risk: split allocation duplicates or omits quantities -> mitigation: exact per-line sum validation plus one transaction and rollback tests
- risk: aggregate order status drifts from shipment rows -> mitigation: one pure projection used after every shipment write; repository integration asserts persisted projection
- risk: cancellation implies refund to customer -> mitigation: UI/help state simulated fulfilment cancellation only; totals and payment immutable; refunds explicitly deferred
- risk: existing successful replay JSON lacks new required fields -> mitigation: always rehydrate succeeded order by `payment.order_id`
- risk: seeded lifecycle rows overwrite learner/user changes -> mitigation: insert named scenarios once; normal seed verifies presence without resetting mutable state
- risk: tracking detail leaks sensitive customer input into audit -> mitigation: bounded customer-facing event columns; audit stores only allowlisted IDs/status/counts
- risk: P4 and P5 both need seed-driven UI expectations -> mitigation: P4 uses contract fixtures; P5 owns live seed facts; P6 owns merged journey
- question: accept security cutoff for pre-migration anonymous orders? -> owner: user/product decision at `G0`
- question: accept admin-only lifecycle endpoints before broader secondary-admin slice? -> owner: user/product decision at `G0`
- question: accept cancellation without refund record until returns/refunds expansion? -> owner: user/product decision at `G0`

## Done Criteria

- signed-in Alice sees only Alice orders in stable newest-first history; Bob order absent
- Alice opens owned order detail with immutable ordinary and Powderizer lines, current status, shipments, and ordered events
- Bob and anonymous guessed-ID requests cannot read Alice order; admin can inspect for lifecycle operations
- new guest checkout confirmation reloads through exact-order HttpOnly capability; capability cannot read adjacent order
- new order starts `processing` with one created lifecycle event and fresh line IDs
- admin packs complete single or split shipment plan; invalid allocation changes nothing
- shipment legal transitions update shipment, aggregate order, lifecycle event, version, and audit atomically
- delivery failure and split shipment display accurately without live-carrier claims
- eligible owner cancellation succeeds once; post-shipment, stale-version, foreign-owner, and changed-idempotency requests fail safely
- cancellation preserves payment, totals, promo, snapshots, and stock facts
- migration preserves existing order data and backfills lifecycle foundation
- repeated seed preserves user state and avoids duplicate scenarios; reset restores named lifecycle fixtures
- help and README describe simulated behavior, trigger path, and no-refund boundary accurately
- focused evidence valid; `npm run reset` and final `npm run verify` pass after all fixes settle
