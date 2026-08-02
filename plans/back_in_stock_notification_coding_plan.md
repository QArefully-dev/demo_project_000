# Back-in-Stock Notification Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `15. Back-in-stock notification: unblocked`
Repository baseline: branch `expansion_002` @ `22de151`, inspected 2026-08-02

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD` before any write
- named branch required: detached `HEAD` -> stop and ask user to select branch
- input gate: relevant uncommitted or untracked source-checkout changes absent from branch `HEAD` -> stop and ask user to commit them or choose baseline; never copy, stash, discard, or import them without explicit approval
- create: dedicated implementation branch + worktree from recorded `HEAD` before first implementation write -> `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree; source checkout stays read-only after creation except saved plan and run-scoped temp state
- integration: no merge, rebase, cherry-pick, copy-back, branch deletion, or worktree cleanup; user handles merge into source branch
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state worktree remains intact and user handles merge

## Objective

Buyer subscribes to a sold-out lot -> stock returns through any restore path -> local job queue fans out one in-app notification plus preference-gated mailbox delivery -> subscription closes. First product consumer of landed async subsystem (item 8). Complete when buyer can subscribe from lot detail, manage subscriptions from account, and receive exactly one notification per subscription after restock, proven by automated tests.

## Scope

### In

- one-shot per-variant subscription owned by authenticated buyer; states `pending` -> `notified` | `cancelled`
- `Notify me when available` control on out-of-stock variant in lot detail purchase panel
- account section listing pending subscriptions with cancel
- restock detection on every availability-restoring path: admin goods receipt, return received, order cancellation, admin variant stock write
- new job kind `back_in_stock.notify` + handler; notification kind `back_in_stock.available`
- MOQ-aware notify threshold: notify only when available-to-sell reaches variant minimum orderable quantity
- new fault flag `async.back_in_stock_failure` for deterministic retry demo
- migration `031`, deterministic seed fixture producing one sold-out lot plus one pending subscription
- audit events for subscribe, cancel, notify

### Out

- standalone polling, cron, or availability sweep; queue is sole delivery mechanism
- anonymous subscriptions; control routes logged-out buyer to `/login`
- subscriptions on backorderable lots (already orderable; control never renders)
- new `user_preferences` column or new notification preference key
- admin UI for buyer subscriptions; existing `/admin/jobs` diagnostics suffice
- substitution offers, digest batching, quantity-aware subscriptions, price-drop alerts
- new navigation entry; entry points stay lot detail + account
- any agent browser session, screenshot, dev-server click-through, `browser-qa` invocation

## Repository Findings

Async foundation, all landed and reusable:

- existing: `apps/api/src/features/jobs/jobService.ts` -> `JobService.enqueue({kind, dedupeKey, payload, runAt, maxAttempts})` inside `unitOfWork.run`; `dedupe_key TEXT UNIQUE` + `ON CONFLICT DO NOTHING` -> `{created, job}`
- existing: `apps/api/src/features/jobs/jobHandlerRegistry.ts` -> `JobHandlerRegistry.register(kind, handler)`; `JobHandler = (ctx: JobHandlerContext) => JobHandlerResult`; registration block `apps/api/src/app.ts:401-425`
- existing: `apps/api/src/features/jobs/jobRules.ts` -> `nextBackoffMs`, `classifyAttemptOutcome`; constants in `packages/contracts/src/jobs.ts` (`JOB_MAX_ATTEMPTS 5`, `JOB_LEASE_MS 30000`)
- existing: `apps/api/src/features/notifications/notificationService.ts` -> `notify({userId, kind, title, body, entityType, entityId, context})` writes row, enqueues `notification.deliver`, appends `notification.created`
- existing: `apps/api/src/features/notifications/notificationRules.ts` -> `notificationDedupeKey(userId, kind, entityType, entityId)`; `NOTIFICATION_EMAIL_PREFERENCE` typed `Record<NotificationKind, ...>` -> omitting new kind is compile error
- existing: `apps/api/src/features/standingOrders/standingOrderService.ts` -> closest template for feature owning job kind + handler + own tables + system audit context `{actor:{type:'system',userId:null}, requestId:null}`
- existing: `apps/api/src/features/jobs/faultSwitch.ts` -> `FAULT_KEYS`, `FaultSwitch`, `noFaults`; implementation is `featureFlagResolver` with per-key cache
- constraint: `notifications.dedupe_key` is globally `UNIQUE` and derived from `(userId, kind, entityType, entityId)` -> reusing `entityType='variant'` would permanently suppress every later notification for same buyer + lot

Inventory truth:

- existing: `apps/api/src/features/inventory/inventoryRepository.ts` -> `availableToSell(variantIds, now)` = `MAX(0, stock_count - open reservations)`; `incrementStock`, `decrementStock`
- existing: `apps/api/src/features/inventory/inventoryService.ts` -> three increment paths: `receiveStock` (then `fulfillBackorders`), `restoreReturnInventory`, `cancelOrderInventory`. Service deps are `{repository}` only; no clock, no audit, no jobs
- existing: `apps/api/src/features/catalog/variantAdminService.ts` -> `update(id, input, context)` inside `unitOfWork.run` writes absolute `stock_count` through `variantAdminRepository.update`; pre-image and post-image both in scope beside `audit.append({action:'variant.updated'})`. Bypasses `InventoryService` entirely; writes no stock movement
- constraint: retired variants (`active = 0`) reject `variantAdminService.update` with `VARIANT_RETIRED`, but `incrementStock` does not check `active` -> return and cancellation can restock a retired lot
- constraint: MOQ is independent of stock. `apps/api/src/features/pricing/pricingRules.ts` -> `validateMoq(quantity, weightGrams, moqSacks)` judges requested quantity only; `cartBulkAddRules.ts` evaluates `INSUFFICIENT_STOCK` before `BELOW_MOQ`. Lot with 1 sack against 4-sack MOQ renders in stock but rejects every add
- gap: minimum orderable quantity exists only as private `minimumMoqQuantity(weightGrams, moqSacks)` inside `apps/api/src/features/cart/cartService.ts`; no shared export

Web truth:

- existing: `apps/web/src/features/product/ProductPurchasePanel.tsx` -> `variantIsPurchasable(v) = v.active && (v.stockCount > 0 || v.backorderable)`; out-of-stock branch `v.active && v.stockCount === 0 && !v.backorderable` renders `Sold out`; action row holds `Add to order` + `AddToListMenu`
- existing: `apps/web/src/components/SaveToListButton.tsx` -> canonical per-variant buyer action: `useAuth()` gate -> `navigate('/login', {state:{from: pathname+search}})`, local `pending` state, `sr-only role="alert"` feedback
- existing: `apps/web/src/hooks/NotificationsContext.tsx` -> canonical async context: `stateVersionRef` + `sessionVersionRef`, `AbortController` per refresh, `mutationQueueRef` serialization, logged-out reset. Public entry `apps/web/src/hooks/useNotifications.ts`
- existing: `apps/web/src/components/Layout.tsx` -> provider nesting `AuthProvider > NotificationsProvider > CartProvider > SavedListsProvider > ...`
- existing: `apps/web/src/features/notifications/notificationsPresentation.ts` -> `Record<NotificationKind, {label, icon}>`, exhaustive
- existing: `apps/web/src/features/account/AccountPage.tsx` -> section stack ending `DataExportSection`, `DeleteAccountSection`, then link stack
- reuse: `apps/web/src/api/client.ts` -> `apiFetch(schema, path, options)` with `credentials:'include'`, `ApiError`, `ApiContractError`

Seed and verification truth:

- gap: zero seeded variants have `stockCount: 0`, zero are `backorderable` -> feature is unreachable after `npm run reset` without new seed fixture
- reuse: `apps/api/src/db/savedListSeed.ts` mutates `product_variants` after canonical upsert inside same transaction (retires `SPN-0009-002`) -> precedent for deterministic post-upsert stock write
- evidence: `TCM-0034-003` (`25 kg Bag`, sortOrder 3, stock 15, product `TCM-0034`) has zero references outside `packages/catalog/src/categories/tradeCreative.ts` -> safe sold-out fixture that leaves its product's default variant purchasable
- constraint: `npm run verify` never runs web integration tier. `verify` -> `npm test` -> `@shop/web test` -> `test:unit` only. Web integration requires explicit `npm run test:integration -w @shop/web`
- constraint: `apps/api/src/db/reset.ts` deletes feature tables explicitly in FK-safe order; new table needs its own `DELETE`
- constraint: migration head is `030_async_behavior.ts`; `apps/api/test/db/asyncSchema.integration.test.ts` asserts `migrations.at(-1)?.version === '030'` and must move to `'031'`
- constraint: `packages/contracts` consumers read `dist/`; new subpath unusable until `npm run build -w @shop/contracts`

## Decisions and Invariants

- trigger scope: every availability-restoring path fires detection -> `receiveStock`, `restoreReturnInventory`, `cancelOrderInventory`, `variantAdminService.update`/`create`. Buyer promise is cause-independent
- notify threshold: `availableToSell >= minimumOrderQuantity(weightGrams, moqSacks)`. Prevents notification that leads straight to `BELOW_MOQ`
- shared rule: extract `minimumOrderQuantity` into `apps/api/src/features/pricing/pricingRules.ts`; `cartService.minimumMoqQuantity` delegates to it. No parallel implementation
- detection is enqueue-only: transactional write path checks `hasPendingSubscriptions(variantId)` and enqueues one job; all availability evaluation and fan-out happens in handler. Write paths never read availability, never write notifications
- job dedupe key `back-in-stock:${variantId}:${occurredAt}` -> repeat restocks at distinct instants enqueue distinct jobs; same-instant duplicates collapse
- notification identity: `entityType='back_in_stock_subscription'`, `entityId=String(subscriptionId)`. Subscription is one-shot, so each re-subscription mints a fresh id and escapes the permanent `notifications.dedupe_key` uniqueness
- one active subscription per `(user, variant)` enforced by partial unique index on `status='pending'`, not by service check alone
- handler idempotency: selects only `status='pending'` rows, marks `notified` inside same unit of work as its `notify` call. Retry after partial progress notifies only remaining rows
- retired lot (`active = 0`) with pending subscriptions -> handler closes them as `cancelled` with no notification. Buyer never receives a notification for an unpurchasable lot
- backorderable lot is never subscribable: control does not render and `subscribe` rejects with `VARIANT_AVAILABLE`
- preference gating reuses `orderUpdatesEmail` through `NOTIFICATION_EMAIL_PREFERENCE`; in-app row always written, mailbox delivery gated
- observer port is optional on `InventoryService` and `VariantAdminService` -> existing hand-composed tests keep compiling and behaviour is unchanged when absent
- detection runs inside caller transaction via nested `unitOfWork.run` savepoint -> rolled-back stock write rolls back its job
- account deletion and variant deletion cascade through FKs; `reset.ts` clears table explicitly
- money, availability, MOQ stay backend-authoritative; web renders server-resolved fields only
- assumption (validate at `G0`): `TCM-0034-003` remains unreferenced outside `packages/catalog`. Worker greps before zeroing; unreferenced alternative in same category if not
- assumption (validate at `G0`): one `apps/web` admin integration test is already failing on `expansion_002`. Baseline evidence `T0` records it so final gate does not misattribute it

## Target Design

### Schema

- `back_in_stock_subscriptions` -> `id INTEGER PRIMARY KEY AUTOINCREMENT`, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE`, `status TEXT NOT NULL CHECK (status IN ('pending','notified','cancelled'))`, `requested_at TEXT NOT NULL`, `notified_at TEXT`, `cancelled_at TEXT`, `notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`
- `CREATE UNIQUE INDEX back_in_stock_pending_idx ON back_in_stock_subscriptions(user_id, variant_id) WHERE status = 'pending'`
- `CREATE INDEX back_in_stock_variant_status_idx ON back_in_stock_subscriptions(variant_id, status)`
- `CREATE INDEX back_in_stock_user_requested_idx ON back_in_stock_subscriptions(user_id, requested_at DESC)`

### Contracts

- proposed `packages/contracts/src/backInStock.ts` -> `BackInStockStatus`, `BackInStockSubscription` (`subscriptionId`, `variantId`, `productId`, `sku`, `productName`, `variantLabel`, `status`, `requestedAt`, `notifiedAt`, `minimumOrderQuantity`), `CreateBackInStockSubscriptionBody`, `BackInStockSubscriptionListResponse`, `BackInStockSubscriptionIdParam`
- extend `packages/contracts/src/notifications.ts` `NotificationKind` with `back_in_stock.available`
- extend `packages/contracts/src/jobs.ts` `JobKind` with `back_in_stock.notify`
- subpath `./back-in-stock` -> `dist/backInStock.js`

### API domain

Proposed `apps/api/src/features/backInStock/`:

- `backInStockErrors.ts` -> `BackInStockErrorCode = 'VARIANT_NOT_FOUND' | 'VARIANT_RETIRED' | 'VARIANT_AVAILABLE' | 'ALREADY_SUBSCRIBED' | 'SUBSCRIPTION_LIMIT_REACHED' | 'SUBSCRIPTION_NOT_FOUND'`, `BackInStockResult<T>`, `backInStockOk`, `backInStockError`
- `backInStockRules.ts` -> `BACK_IN_STOCK_SUBSCRIPTION_LIMIT`, `isNotifiable(availableToSell, minimumOrderQuantity)`, `backInStockJobDedupeKey(variantId, occurredAt)`, `backInStockNotificationCopy(productName, variantLabel)`
- `backInStockRepository.ts` -> rows + SQL: `insert`, `findPending(userId, variantId)`, `findOwned(subscriptionId, userId)`, `listOwned(userId, status?)`, `countPending(userId)`, `hasPendingForVariant(variantId)`, `listPendingForVariant(variantId)`, `markNotified(id, notificationId, at)`, `markCancelled(id, at)`, `variantFacts(variantId)`
- `backInStockTrigger.ts` -> `createBackInStockTrigger({repository, jobs, unitOfWork, clock}): StockChangeObserver`. Deliberately excludes inventory so it constructs before `InventoryService` and closes the dependency cycle
- `backInStockService.ts` -> `subscribe`, `listOwned`, `cancel`; deps `{repository, inventory: Pick<InventoryService,'availableToSell'>, variants, unitOfWork, audit, clock}`
- `backInStockNotifyHandler.ts` -> `createBackInStockNotifyHandler({repository, inventory, notifications, audit, clock, faults}): JobHandler`

Proposed port `apps/api/src/features/inventory/stockObserver.ts` -> `interface StockChangeObserver { stockChanged(variantId: number, occurredAt: string): void }`.

Flow: stock write -> `stockObserver.stockChanged` -> pending check -> `jobs.enqueue('back_in_stock.notify')` -> queue drain -> handler reads `availableToSell` + variant facts -> threshold check -> per pending subscription `notifications.notify` + `markNotified` -> `notification.deliver` job -> preference-gated mailbox row.

### Routes

Proposed `apps/api/src/routes/backInStock.ts`, all `requireAuth(services.sessions)`:

- `POST /api/back-in-stock` -> 201 `BackInStockSubscription`; 404 `VARIANT_NOT_FOUND`; 409 `VARIANT_RETIRED` | `VARIANT_AVAILABLE` | `ALREADY_SUBSCRIBED` | `SUBSCRIPTION_LIMIT_REACHED`
- `GET /api/back-in-stock` -> 200 `BackInStockSubscriptionListResponse`
- `DELETE /api/back-in-stock/:subscriptionId` -> 200 `SuccessResponse`; 404 `SUBSCRIPTION_NOT_FOUND`

Route-local `BACK_IN_STOCK_ERROR_MESSAGES` + `BACK_IN_STOCK_ERROR_STATUS` + `sendBackInStockError`, matching `apps/api/src/routes/savedLists.ts`.

### Web

- proposed `apps/web/src/api/backInStock.ts` -> `getBackInStockSubscriptions`, `createBackInStockSubscription`, `cancelBackInStockSubscription`
- proposed `apps/web/src/hooks/BackInStockContext.tsx` + `apps/web/src/hooks/useBackInStock.ts` -> `{subscriptions, pendingVariantIds, loading, error, refresh, subscribe, cancel}`
- proposed `apps/web/src/components/NotifyWhenAvailableButton.tsx` -> renders inside purchase-panel action row only when selected variant is `active && stockCount === 0 && !backorderable`; logged-out click navigates to `/login` with `from`
- proposed `apps/web/src/features/backInStock/BackInStockSection.tsx` -> account section listing pending subscriptions with cancel

### Audit

`apps/api/src/features/audit/auditEvent.ts` gains actions `back_in_stock.subscribed`, `back_in_stock.cancelled`, `back_in_stock.notified`, entity type `back_in_stock_subscription`, one `AuditEventInput` union arm carrying `subscriptionId`, one `buildAuditEvent` case; `auditQuery.ts` `entityTypeSet` gains the entity type.

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> {P3 -> R3 -> GR3 || P7 -> R7 -> GR7} -> G2 -> {P4 -> R4 -> GR4 || P5 -> R5 -> GR5 || P6 -> R6 -> GR6 || P8 -> R8 -> GR8} -> G3 -> S1 -> R9 -> GR9 -> G4 -> S2 -> R10 -> GR10 -> G5`

- `G0`: worktree created and recorded; Node 22 selected; `npm ci` health confirmed; baseline evidence `T0` captured; `TCM-0034-003` reference assumption checked
- `GR1`, `GR2`: schema and contract producer gates. Both are high-risk producers -> no consumer starts before pass or closed findings
- `G1`: migration head `031` applied cleanly and contracts `dist` rebuilt
- `GR3`: domain gate; blocks every API consumer
- `GR7`: web state gate; blocks `P8`
- `G2`: reviewed domain + reviewed web state
- `GR4`, `GR5`, `GR6`, `GR8`: lane gates; all four pass before composition
- `G3`: reviewed fan-in; handler, trigger, seed, web UI all settled
- `GR9`: composition review; covers route surface, wiring, end-to-end behaviour not covered by lane reviews
- `G4`: composition accepted
- `GR10`: documentation and final-verification review
- `G5`: completion gate; full suite plus web integration tier green against baseline

## Work Packets

### P1: Migration `031` and reset coverage

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/031_back_in_stock.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/reset.ts`, `apps/api/test/db/backInStockSchema.integration.test.ts`, `apps/api/test/db/asyncSchema.integration.test.ts`
- reads: `apps/api/src/db/migrations/030_async_behavior.ts` -> `asyncBehaviorMigration`, `assertForeignKeysClean`, `hasTable` -> migration file shape and closing FK assertion; `apps/api/src/db/migrations/029_saved_lists.ts` -> partial-index and CHECK style; `apps/api/src/db/migrate.ts` -> `Migration`, `migrateDatabase` -> ordering and ledger rules; `apps/api/src/db/reset.ts` -> FK-safe delete ordering
- acceptance: fresh database migrates to head `031`; `back_in_stock_subscriptions` exists with stated columns, CHECK, three indexes; `PRAGMA foreign_key_check` clean; `resetDatabase` empties table; `asyncSchema.integration.test.ts` head assertion updated to `'031'`
- non-goals: no repository, service, contract, route, or seed row
- upstream inputs: none
- changes:
  - add `031_back_in_stock.ts` exporting `backInStockMigration: Migration` with `version: '031'`, name `back in stock`, `CREATE TABLE IF NOT EXISTS` + three `CREATE ... INDEX IF NOT EXISTS`, closing `assertForeignKeysClean(db)`
  - append import and array entry in `migrations/index.ts`
  - add `DELETE FROM back_in_stock_subscriptions` to `resetDatabase` before `product_variants` and user deletes
  - add `apps/api/test/db/backInStockSchema.integration.test.ts` asserting columns, CHECK rejection of unknown status, partial-index rejection of second `pending` row for same `(user, variant)`, acceptance of second row once first is `notified`, cascade on user delete, FK check clean
  - update head assertion in `asyncSchema.integration.test.ts`
- invariants: append-only forward-only migrations; never edit or renumber landed migration; never toggle `foreign_keys` inside migration transaction; table rebuilds go through runner
- relevant evidence: `T0`
- test duty: run `T1`
- verification: `T1` passes; `npm run typecheck -w @shop/api` clean
- handoff: table name, column names, status vocabulary, partial-index guarantee
- review: `R1` -> `GR1` blocks `P3`, `P6`, `S1`

### P2: Contracts for subscriptions, notification kind, job kind

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/backInStock.ts`, `packages/contracts/src/notifications.ts`, `packages/contracts/src/jobs.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/backInStock.test.ts`
- reads: `packages/contracts/src/savedLists.ts` -> `SavedListSummary`, local `UtcIsoInstant`, `additionalProperties:false` style -> schema conventions; `packages/contracts/src/notifications.ts` -> `NotificationKind`, `Notification` -> union extension point; `packages/contracts/src/jobs.ts` -> `JobKind` -> union extension point; `packages/contracts/package.json` -> `exports` -> kebab subpath to camel dist mapping; `packages/contracts/test/savedLists.test.ts` -> `Value.Parse` plus `@ts-expect-error` pattern
- acceptance: `@shop/contracts/back-in-stock` resolves after build; `NotificationKind` accepts `back_in_stock.available`; `JobKind` accepts `back_in_stock.notify`; contracts suite green; `dist` rebuilt so consumers compile
- non-goals: no route error-code schema (route-local by convention); no API or web code
- upstream inputs: none
- changes:
  - add `backInStock.ts` with stated schemas, each `Type.Object(..., {additionalProperties:false})`, ids as `PositiveIntegerString`, timestamps as local 24-char `UtcIsoInstant`
  - add literals to `NotificationKind` and `JobKind`
  - append `export * from './backInStock.js';` in `index.ts`
  - add `"./back-in-stock": {"types":"./dist/backInStock.d.ts","import":"./dist/backInStock.js"}` to `exports`
  - add `packages/contracts/test/backInStock.test.ts` covering parse round-trip, rejection of unknown status, rejection of extra property, root-vs-subpath type identity
- invariants: transport types owned by contracts only; no persistence or domain concept leaks into schemas; existing schema members unchanged
- relevant evidence: `T0`
- test duty: run `T2`
- verification: `T2` passes; `npm run build -w @shop/contracts` succeeds and is required before any consumer packet compiles
- handoff: exported schema and type names; subpath specifier; new kind literals
- review: `R2` -> `GR2` blocks `P3`, `P4`, `P7`, `S1`

### P3: Back-in-stock domain, persistence, trigger, shared MOQ rule

- mode: parallel with `P7` after `G1`
- depends on: `P1`, `P2`, `G1`
- owns: `apps/api/src/features/backInStock/backInStockErrors.ts`, `apps/api/src/features/backInStock/backInStockRules.ts`, `apps/api/src/features/backInStock/backInStockRules.test.ts`, `apps/api/src/features/backInStock/backInStockRepository.ts`, `apps/api/src/features/backInStock/backInStockTrigger.ts`, `apps/api/src/features/backInStock/backInStockService.ts`, `apps/api/src/features/inventory/stockObserver.ts`, `apps/api/src/features/pricing/pricingRules.ts`, `apps/api/src/features/pricing/pricingRules.test.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditQuery.ts`, `apps/api/test/backInStock/backInStockService.integration.test.ts`
- reads: `apps/api/src/features/savedLists/savedListService.ts` -> `createSavedListService`, `SavedListDependencies`, `summary`, `item` -> dependency-object, `unitOfWork.run`, mapper placement; `apps/api/src/features/savedLists/savedListRepository.ts` -> column constants, owner-scoped SQL, row types; `apps/api/src/features/savedLists/savedListErrors.ts` -> closed result shape; `apps/api/src/features/standingOrders/standingOrderService.ts` -> `runNow` -> enqueue-inside-transaction pattern and dedupe-key usage; `apps/api/src/features/jobs/jobService.ts` -> `enqueue` signature; `apps/api/src/features/inventory/inventoryService.ts` -> `availableToSell` -> read port shape; `apps/api/src/features/cart/cartService.ts` -> `minimumMoqQuantity` -> exact formula to extract; `apps/api/src/features/pricing/pricingRules.ts` -> `validateMoq`, `moqShortfallSacks` -> module conventions; `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEntityType`, `AuditEventInput`, `buildAuditEvent`, `savedListEntity` -> four extension points
- acceptance: buyer can subscribe, list, cancel through service against real SQLite; duplicate subscribe returns `ALREADY_SUBSCRIBED`; subscribe on available lot returns `VARIANT_AVAILABLE`; subscribe on retired lot returns `VARIANT_RETIRED`; limit enforced; trigger enqueues exactly one job when pending subscriptions exist and none otherwise; all three audit actions accepted by `buildAuditEvent`
- non-goals: no job handler, no route, no inventory or variant-admin call-site edit, no seed, no composition-root edit
- upstream inputs: `P1` -> `031` change set -> table, status vocabulary, partial unique index; `P2` -> contracts change set -> `BackInStockSubscription`, `back_in_stock.notify` literal
- changes:
  - export `minimumOrderQuantity(weightGrams, moqSacks)` from `pricingRules.ts`; replace private `minimumMoqQuantity` body in `cartService.ts` with delegation; extend `pricingRules.test.ts` with boundary cases including one-sack weight and non-round weight
  - add `stockObserver.ts` declaring `StockChangeObserver`
  - add `backInStockErrors.ts`, `backInStockRules.ts` + colocated unit test covering `isNotifiable` boundary at exactly minimum, dedupe-key determinism, copy builder
  - add `backInStockRepository.ts` with hoisted column constants, owner-scoped `AND user_id = ?` predicates, deterministic `ORDER BY requested_at DESC, id DESC`, `variantFacts` join across `product_variants` + `products`
  - add `backInStockTrigger.ts` -> `stockChanged` runs `unitOfWork.run`, short-circuits when `hasPendingForVariant` is false, otherwise enqueues with `backInStockJobDedupeKey`
  - add `backInStockService.ts` -> `subscribe`/`listOwned`/`cancel`, each mutation in `unitOfWork.run` with `audit.append`, `AuditContext` as final positional parameter
  - extend `auditEvent.ts` with three actions, entity type, union arm, `buildAuditEvent` case, `UserEventAction` exclusion; extend `auditQuery.ts` `entityTypeSet`
  - add service integration test with hand-composed graph, frozen clock, temp SQLite per file, covering every error code, trigger enqueue and no-enqueue, audit rows written
- invariants: service owns transaction boundary, repository stays transaction-agnostic; ownership enforced in SQL not only in service; `cartService` behaviour unchanged by extraction; trigger never reads availability
- relevant evidence: `T1`, `T2`
- test duty: run `T3`
- verification: `T3` passes; `npm run typecheck -w @shop/api` clean; existing cart suites unaffected
- handoff: `BackInStockRepository` interface, `StockChangeObserver` port, `createBackInStockTrigger`, `createBackInStockService`, audit action names, `minimumOrderQuantity` export
- review: `R3` -> `GR3` blocks `P4`, `P5`, `P6`, `S1`

### P4: Notify job handler and notification kind wiring

- mode: parallel with `P5`, `P6`, `P8` after `G2`
- depends on: `P3`, `G2`
- owns: `apps/api/src/features/backInStock/backInStockNotifyHandler.ts`, `apps/api/src/features/notifications/notificationRules.ts`, `apps/api/src/features/notifications/notificationRules.test.ts`, `apps/api/src/features/jobs/faultSwitch.ts`, `apps/api/src/features/jobs/jobService.ts`, `apps/api/test/backInStock/backInStockNotifyHandler.integration.test.ts`
- reads: `apps/api/src/features/notifications/notificationDeliveryHandler.ts` -> `createNotificationDeliveryHandler` -> handler factory shape, fault check placement, payload validation; `apps/api/src/features/standingOrders/standingOrderService.ts` -> `runJob` -> system audit context and idempotent-completion branches; `apps/api/src/features/notifications/notificationService.ts` -> `notify` signature and dedupe derivation; `apps/api/src/features/backInStock/backInStockRepository.ts` -> `listPendingForVariant`, `markNotified`, `markCancelled`, `variantFacts`; `apps/api/src/features/jobs/jobService.ts` -> `jobKinds` set and fault gate
- acceptance: handler notifies exactly one pending subscriber per subscription and marks it `notified`; below-threshold restock returns `{ok:true}` with zero notifications and subscriptions still `pending`; retired variant closes subscriptions as `cancelled` with zero notifications; repeat handler run after success is a no-op; fault flag forces `{ok:false}` and retry then succeeds after flag clears
- non-goals: no route, no composition-root registration, no seed row for the flag, no web change
- upstream inputs: `P3` -> domain change set -> repository interface, rules, audit actions; `P2` -> contracts change set -> `back_in_stock.available`, `back_in_stock.notify`
- changes:
  - add `back_in_stock.available` to `NOTIFICATION_EMAIL_PREFERENCE` mapped to `orderUpdatesEmail`; extend `notificationRules.test.ts`
  - add `async.back_in_stock_failure` to `FAULT_KEYS`
  - add `back_in_stock.notify` to `jobKinds` set in `jobService.ts`
  - add `backInStockNotifyHandler.ts` -> validate payload `variantId`; fault check; load `variantFacts`; inactive variant -> cancel pending rows + audit; compute `availableToSell`; `isNotifiable` false -> `{ok:true}`; otherwise per pending subscription run `unitOfWork.run` performing `notifications.notify` with `entityType='back_in_stock_subscription'` and `entityId=String(subscriptionId)`, then `markNotified`, then `audit.append('back_in_stock.notified')`
  - add handler integration test with hand-composed graph and frozen clock covering every branch plus partial-progress retry
- invariants: handler never widens a notification beyond its own subscription; per-subscription transaction so retry resumes; system audit context `{actor:{type:'system',userId:null}, requestId:null}`; job result never throws for expected domain states
- relevant evidence: `T2`, `T3`
- test duty: run `T4`
- verification: `T4` passes; `npm run typecheck -w @shop/api` clean
- handoff: `createBackInStockNotifyHandler` factory signature; fault key name
- review: `R4` -> `GR4` blocks `S1`

### P5: Restock detection at every availability-restoring call site

- mode: parallel with `P4`, `P6`, `P8` after `G2`
- depends on: `P3`, `G2`
- owns: `apps/api/src/features/inventory/inventoryService.ts`, `apps/api/src/features/catalog/variantAdminService.ts`, `apps/api/src/features/catalog/variantAdminService.test.ts`, `apps/api/test/backInStock/stockObserver.integration.test.ts`
- reads: `apps/api/src/features/inventory/stockObserver.ts` -> `StockChangeObserver`; `apps/api/src/features/inventory/inventoryService.ts` -> `receiveStock`, `restoreReturnInventory`, `cancelOrderInventory`, private `fulfillBackorders` -> exact points after net availability settles; `apps/api/src/features/catalog/variantAdminService.ts` -> `update`, `create` -> `unitOfWork.run` block and audit adjacency; `apps/api/test/inventory/inventoryRepository.integration.test.ts` -> fixture composition style
- acceptance: observer invoked once per restored variant on goods receipt after backorder fulfilment, once per restored line on return receipt, once per restored allocation on cancellation, and once on admin variant stock write; not invoked when `stockCount` absent from an admin patch; absent observer leaves every existing behaviour and test unchanged; invocation happens inside caller transaction so rollback discards it
- non-goals: no availability computation at call sites; no notification or job logic; no composition-root edit; no new stock-movement rows
- upstream inputs: `P3` -> domain change set -> `StockChangeObserver` port
- changes:
  - add optional `stockObserver?: StockChangeObserver` to `InventoryService` dependencies; invoke at end of `receiveStock` after `fulfillBackorders`, per line in `restoreReturnInventory`, per restored allocation in `cancelOrderInventory`, passing `occurredAt` already threaded through those signatures
  - add optional `stockObserver?: StockChangeObserver` to `VariantAdminService` dependencies; invoke inside existing `unitOfWork.run` in `update` when `input.stockCount !== undefined`, and in `create` when initial stock is positive, using `dependencies.clock.now().toISOString()`
  - add `stockObserver.integration.test.ts` driving each path against real SQLite with a recording stub observer, including a rollback case asserting no recorded call survives
  - extend `variantAdminService.test.ts` with stock-write invocation and absent-`stockCount` non-invocation
- invariants: observer failures must not corrupt inventory invariants; call sites stay synchronous; retired-variant restock through return or cancellation still notifies observer, handler decides outcome; no change to reservation, allocation, or movement semantics
- relevant evidence: `T3`
- test duty: run `T5`
- verification: `T5` passes; `npm exec -w @shop/api -- tsx --test test/inventory/inventoryRepository.integration.test.ts` still passes
- handoff: dependency-name and invocation contract needed by composition root
- review: `R5` -> `GR5` blocks `S1`

### P6: Sold-out seed fixture and fault flag row

- mode: parallel with `P4`, `P5`, `P8` after `G2`
- depends on: `P1`, `P3`, `G2`
- owns: `apps/api/src/db/backInStockSeed.ts`, `apps/api/src/db/seed.ts`, `apps/api/src/db/seedAsyncScenarios.ts`, `apps/api/test/db/backInStockSeed.integration.test.ts`
- reads: `apps/api/src/db/savedListSeed.ts` -> `SEED_INSTANT`, `findUserId`, post-upsert `UPDATE product_variants` retirement -> deterministic post-upsert mutation precedent; `apps/api/src/db/seedAsyncScenarios.ts` -> `ASYNC_SEED_INSTANT`, `FEATURE_FLAGS`, `requiredId` -> idempotent-insert conventions; `apps/api/src/db/seed.ts` -> transaction body and existing seed-module invocation order; `apps/api/test/db/asyncSeed.integration.test.ts` -> re-seed stability assertions
- acceptance: after `npm run reset` exactly one active non-backorderable variant has `stock_count = 0` and Alice holds one `pending` subscription against it; re-running seed twice changes nothing; `async.back_in_stock_failure` flag row exists disabled; buyer-created subscriptions are never clobbered by re-seed
- non-goals: no change to `packages/catalog` canonical data; no change to other seed fixtures; no README text
- upstream inputs: `P1` -> `031` change set -> table shape; `P3` -> domain change set -> status vocabulary
- changes:
  - grep `TCM-0034-003` across repository first; if referenced by another fixture or test, pick another active non-default variant from `packages/catalog/src/categories/tradeCreative.ts` with no outside reference and record choice in report
  - add `backInStockSeed.ts` exporting `seedBackInStock(db)` with own frozen seed instant, `UPDATE product_variants SET stock_count = 0, updated_at = ? WHERE sku = ?`, early return when Alice or variant absent, `INSERT ... WHERE NOT EXISTS` for the pending subscription
  - invoke `seedBackInStock(db)` inside the `seed.ts` transaction immediately after `seedAsyncScenarios(db)`
  - add `async.back_in_stock_failure` disabled row to `FEATURE_FLAGS` in `seedAsyncScenarios.ts`
  - add seed integration test asserting sold-out lot, pending subscription, double-seed idempotency, and that reset then seed reproduces identical rows
- invariants: no wall clock, no generated ids, fixtures keyed by SKU and email; deterministic reset and seed; chosen variant must not be its product's default so the product stays purchasable
- relevant evidence: `T1`, `T3`
- test duty: run `T6`
- verification: `T6` passes; `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts` and `test/db/asyncSeed.integration.test.ts` pass
- handoff: chosen sold-out SKU; seeded subscription identity for downstream tests and docs
- review: `R6` -> `GR6` blocks `S1`

### P7: Web API client and subscription context

- mode: parallel with `P3` after `G1`
- depends on: `P2`, `G1`
- owns: `apps/web/src/api/backInStock.ts`, `apps/web/src/api/backInStock.test.ts`, `apps/web/src/hooks/BackInStockContext.tsx`, `apps/web/src/hooks/useBackInStock.ts`, `apps/web/src/hooks/BackInStockContext.test.tsx`
- reads: `apps/web/src/api/notifications.ts` -> `getNotifications` -> signal threading and `apiFetch` usage; `apps/web/src/api/savedLists.ts` -> `addSavedListItem` -> body `satisfies` and path-builder style; `apps/web/src/api/client.ts` -> `apiFetch`, `ApiError`, `ApiContractError`; `apps/web/src/hooks/NotificationsContext.tsx` -> `stateVersionRef`, `sessionVersionRef`, `isCurrentSession`, `enqueueMutation`, logged-out reset -> full staleness model; `apps/web/src/hooks/SavedListsContext.tsx` -> server-code-to-message map
- acceptance: context exposes subscriptions, derived `pendingVariantIds`, loading, error, `refresh`, `subscribe`, `cancel`; logged-out state clears data and aborts in-flight requests; stale list response after a mutation never overwrites newer state; rejected mutation restores confirmed state and surfaces mapped message; server error codes `VARIANT_AVAILABLE`, `ALREADY_SUBSCRIBED`, `SUBSCRIPTION_LIMIT_REACHED` map to buyer-readable strings
- non-goals: no button, no page, no account section, no `Layout.tsx` mount, no navigation change
- upstream inputs: `P2` -> contracts change set -> `@shop/contracts/back-in-stock` schemas
- changes:
  - add `backInStock.ts` client with three functions validating responses against contract schemas
  - add `BackInStockContext.tsx` implementing the notifications-context staleness model with `AbortController` per refresh, session and state generation counters, serialized mutation queue, optimistic subscribe reconciled against server object
  - add `useBackInStock.ts` one-line re-export
  - add colocated tests: client shape and error mapping; context covering stale-response ordering with deferred promises, post-logout completion, mutation serialization, failed-mutation rollback
- invariants: web never re-derives availability or MOQ; server response is source of truth after every write; no browser storage of buyer identity; abort-induced rejections never surface as errors
- relevant evidence: `T2`
- test duty: run `T7`
- verification: `T7` passes; `npm run typecheck -w @shop/web` clean
- handoff: context value shape and hook name for `P8`
- review: `R7` -> `GR7` blocks `P8`

### P8: Lot-detail control, account section, provider mount

- mode: parallel with `P4`, `P5`, `P6` after `G2`
- depends on: `P7`, `G2`
- owns: `apps/web/src/components/NotifyWhenAvailableButton.tsx`, `apps/web/src/components/NotifyWhenAvailableButton.test.tsx`, `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/product/ProductPurchasePanel.test.tsx`, `apps/web/src/features/backInStock/BackInStockSection.tsx`, `apps/web/src/features/backInStock/BackInStockSection.test.tsx`, `apps/web/src/features/backInStock/BackInStockJourney.integration.test.tsx`, `apps/web/src/features/account/AccountPage.tsx`, `apps/web/src/features/notifications/notificationsPresentation.ts`, `apps/web/src/features/notifications/notificationsPresentation.test.ts`, `apps/web/src/components/Layout.tsx`
- reads: `apps/web/src/components/SaveToListButton.tsx` -> auth gate, local pending state, `sr-only role="alert"` feedback -> control template; `apps/web/src/features/product/ProductPurchasePanel.tsx` -> `variantIsPurchasable`, `isOutOfStock`, action row, alert paragraphs -> insertion point; `apps/web/src/features/account/PreferencesSection.tsx` -> section heading and optimistic-write shape; `apps/web/src/features/account/AccountPage.tsx` -> section stack order; `apps/web/src/components/Layout.tsx` -> provider nesting order; `apps/web/src/features/savedLists/SavedListsJourney.integration.test.tsx` -> journey test composition and role-based assertions
- acceptance: control renders only for `active && stockCount === 0 && !backorderable` selected variant and never for backorder or purchasable variants; logged-out click navigates to `/login` carrying return path and issues no request; logged-in click subscribes and control switches to subscribed state; account section lists pending subscriptions and cancels one; notification inbox renders the new kind with a label; provider mounted inside `AuthProvider`
- non-goals: no navigation item; no admin surface; no new UI primitive; no availability or MOQ computation in the client
- upstream inputs: `P7` -> web state change set -> `useBackInStock` value shape; `P2` -> contracts change set -> `back_in_stock.available` kind
- changes:
  - add `NotifyWhenAvailableButton.tsx` using `useAuth` gate then `useBackInStock().subscribe`, with local `pending`, disabled while pending, `sr-only role="alert"` error region, accessible name distinguishing subscribe and subscribed states
  - render control in `ProductPurchasePanel` action row guarded by the existing out-of-stock predicate for the selected variant
  - add `BackInStockSection.tsx` listing pending subscriptions with product name, variant label, requested date, cancel button; mount in `AccountPage` after `PreferencesSection`
  - add `back_in_stock.available` entry to `notificationsPresentation.ts` and extend its test
  - mount `BackInStockProvider` in `Layout.tsx` inside `AuthProvider`, alongside `NotificationsProvider`
  - add colocated unit tests plus `BackInStockJourney.integration.test.tsx` covering logged-out redirect, subscribe on a sold-out variant, account-section cancel, and absence of the control on purchasable and backorder variants
- invariants: accessibility assertions use role and accessible name; no visual-only verification; existing purchase-panel behaviour for purchasable variants unchanged
- relevant evidence: `T7`
- test duty: run `T8`
- verification: `T8` passes; `npm run typecheck -w @shop/web` clean; `npm run test:unit -w @shop/web` passes
- handoff: rendered control contract for end-to-end expectations
- review: `R8` -> `GR8` blocks `G3`

### S1: Routes and composition root

- mode: sequential after `G3`
- depends on: `P3`, `P4`, `P5`, `P6`, `P8`, `G3`
- owns: `apps/api/src/routes/backInStock.ts`, `apps/api/src/app.ts`, `apps/api/test/backInStock/backInStockRoutes.integration.test.ts`, `apps/api/test/backInStock/backInStockFlow.integration.test.ts`
- reads: `apps/api/src/routes/savedLists.ts` -> `savedListRoutes`, `SAVED_LIST_ERROR_STATUS`, `sendSavedListError`, `auditContext`, transport mappers -> route file template; `apps/api/src/routes/standingOrders.ts` -> `transport` -> compact newer variant; `apps/api/src/plugins/auth.ts` -> `requireAuth`; `apps/api/src/app.ts` -> `AppServices`, `createAppServices` lines constructing `inventory`, `variantAdmin`, `notifications`, `jobs`, `registry.register` block, `buildApp` registration list -> exact wiring points; `apps/api/test/savedLists/savedListRoutes.integration.test.ts` -> `buildApp` fixture, `cookie`, `login`, `Value.Parse`; `apps/api/test/adminAsync.integration.test.ts` -> admin drain through `POST /api/admin/jobs/run`
- acceptance: three routes registered with full status maps and anonymous requests rejected 401; ownership isolation proven across two buyers; end-to-end path green — buyer subscribes to seeded sold-out lot, admin receipt restocks it above MOQ, admin drain runs the queue, buyer inbox shows exactly one `back_in_stock.available` notification, subscription is `notified`, dev mailbox holds one row, second drain adds nothing
- non-goals: no domain rule change; no web change; no documentation change
- upstream inputs: `P3` -> `createBackInStockService`, `createBackInStockTrigger`; `P4` -> `createBackInStockNotifyHandler`, fault key; `P5` -> `stockObserver` dependency names on inventory and variant admin; `P6` -> seeded sold-out SKU and pending subscription
- changes:
  - add `backInStock.ts` route plugin with contract schemas, `requireAuth` preHandler, route-local error message and status maps, transport mapper, `AuditContext` built from `request.authenticatedUser!.id` and `request.id`
  - in `createAppServices`, construct `backInStockTrigger` before `inventory` and `variantAdmin` and pass it as `stockObserver` to both; construct `backInStockService` after `inventory`; register `back_in_stock.notify` handler in the existing `registry.register` block with `faults: featureFlagResolver`; expose `backInStock` on `AppServices`
  - register route plugin in `buildApp` beside `savedListRoutes`
  - add route integration test covering auth matrix, every error code, ownership isolation, schema parse of every response
  - add flow integration test covering the full restock chain plus a below-MOQ restock that notifies nobody and a fault-flag retry that succeeds on a later drain
- invariants: composition root performs no listen, seed, or migration on import; trigger construction precedes inventory so no dependency cycle exists; nested `unitOfWork.run` remains a savepoint over the caller transaction; admin surfaces stay behind `requireAdmin`
- relevant evidence: `T1`, `T3`, `T4`, `T5`, `T6`
- test duty: run `T9`
- verification: `T9` passes including full `npm run test:integration -w @shop/api`
- handoff: registered route paths, service name on `AppServices`, end-to-end evidence
- review: `R9` -> `GR9` blocks `S2`

### S2: Documentation, plan status, final verification

- mode: sequential after `G4`
- depends on: `S1`, `G4`
- owns: `AGENTS.md`, `README.md`, `plans/demo_project_high_level_plan.md`
- reads: `AGENTS.md` -> Repository Map, Commands -> map entries to extend; `README.md` -> existing demo-trigger and credential sections -> where operator steps live; `plans/demo_project_high_level_plan.md` -> `Current Baseline`, item 15, `Future Expansion Order` -> completion-record conventions used by items 13 and 14
- acceptance: repository map names the new API feature directory, web feature directory, and migration head `031`; README documents how to reach the sold-out lot and how an operator triggers restock through admin goods receipt plus queue drain; plan item 15 records landed scope, migration, decisions, and QA surface; full verification green with web integration tier run explicitly and compared to baseline `T0`
- non-goals: no code change; no test change; no scope addition
- upstream inputs: `S1` -> composition change set -> route paths and end-to-end behaviour; `P6` -> seeded sold-out SKU
- changes:
  - extend `AGENTS.md` Repository Map with `backInStock/` API feature and `apps/web/src/features/backInStock/`, keeping entries general
  - add README operator section: seeded sold-out lot SKU, subscribe path, admin receipt endpoint, `POST /api/admin/jobs/run` drain, dev mailbox at `GET /api/dev/mailbox`, fault flag name
  - update plan `Current Baseline` implemented list and rewrite item 15 as completed with migration `031`, delivered paths, decisions, and QA surface
- relevant evidence: `T9`
- test duty: run `T10`
- verification: `npm run verify` green; `npm run test:integration -w @shop/web` compared against `T0` baseline with any pre-existing failure named explicitly and unchanged
- handoff: final completion evidence for `G5`
- review: `R10` -> `GR10` blocks `G5`

## Review Assignments

Method for every review below: assignment sets `review_skill=code-reviewer`; reviewer invokes `code-reviewer` skill by name and applies its severity gate (critical + high only) and verification-before-reporting duty; surviving findings map into `reviewer_report_v1`. Each assignment states its own target, timing, blocks, reads, acceptance, invariants, risk focus, non-goals, policies, evidence, and return contract.

### R1: Review `P1`

- target: `P1` settled change set
- timing: immediately after `P1` report and `T1`
- blocks: `P3`, `P6`, `S1`
- consolidation reason: none; schema producer always reviewed alone
- reads: `apps/api/src/db/migrations/031_back_in_stock.ts`; `apps/api/src/db/migrations/index.ts`; `apps/api/src/db/reset.ts`; `apps/api/test/db/backInStockSchema.integration.test.ts`; `apps/api/src/db/migrate.ts` -> `migrateDatabase` -> ordering rules
- acceptance: table, CHECK, three indexes, FK actions, ledger ordering, reset coverage, head assertion update
- invariants: append-only forward-only migration; no edit or renumber of landed migrations; FK-clean; partial unique index enforces one pending row per buyer and variant
- risk focus: index predicate correctness; cascade behaviour on user and variant delete; reset delete ordering; migration idempotency
- non-goals: domain, contract, route, seed review
- relevant evidence: `T1`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- target: `P2` settled change set
- timing: immediately after `P2` report and `T2`
- blocks: `P3`, `P4`, `P7`, `S1`
- consolidation reason: none; public contract producer
- reads: `packages/contracts/src/backInStock.ts`; `packages/contracts/src/notifications.ts`; `packages/contracts/src/jobs.ts`; `packages/contracts/package.json` -> `exports`; `packages/contracts/test/backInStock.test.ts`
- acceptance: schema shapes, closed objects, id and timestamp primitives, subpath mapping, union extensions, test coverage
- invariants: transport-only concepts; no breaking change to existing members; kebab subpath maps to camel dist file
- risk focus: accidental widening of existing unions; missing `additionalProperties:false`; subpath typo breaking every consumer
- non-goals: API or web review
- relevant evidence: `T2`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R3: Review `P3`

- target: `P3` settled change set
- timing: immediately after `P3` report and `T3`
- blocks: `P4`, `P5`, `P6`, `S1`
- consolidation reason: none; persistence, shared pricing rule, and audit vocabulary producer
- reads: `apps/api/src/features/backInStock/*`; `apps/api/src/features/inventory/stockObserver.ts`; `apps/api/src/features/pricing/pricingRules.ts`; `apps/api/src/features/cart/cartService.ts` -> `minimumMoqQuantity` delegation; `apps/api/src/features/audit/auditEvent.ts`; `apps/api/test/backInStock/backInStockService.integration.test.ts`
- acceptance: every error code reachable and correct; transaction ownership; owner-scoped SQL; trigger enqueue-only behaviour; audit extension complete across all four extension points
- invariants: repository transaction-agnostic; service owns boundary; MOQ extraction preserves cart behaviour exactly; trigger performs no availability read
- risk focus: MOQ formula drift during extraction; ownership bypass in any query; enqueue outside caller transaction; missing `UserEventAction` exclusion causing audit misclassification
- non-goals: handler, route, call-site, seed review
- relevant evidence: `T1`, `T2`, `T3`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R4: Review `P4`

- target: `P4` settled change set
- timing: immediately after `P4` report and `T4`
- blocks: `S1`
- consolidation reason: none; notification fan-out and job semantics
- reads: `apps/api/src/features/backInStock/backInStockNotifyHandler.ts`; `apps/api/src/features/notifications/notificationRules.ts`; `apps/api/src/features/jobs/faultSwitch.ts`; `apps/api/src/features/jobs/jobService.ts`; `apps/api/test/backInStock/backInStockNotifyHandler.integration.test.ts`
- acceptance: threshold branch, retired branch, idempotent repeat, partial-progress retry, fault branch
- invariants: one notification per subscription; unique `entityId` escapes permanent notification dedupe; per-subscription transaction; expected domain states return results not throws
- risk focus: cross-buyer notification leakage; dedupe collision suppressing later notifications; double-notify after retry; unbounded fan-out on a variant with many subscribers
- non-goals: route, composition, seed review
- relevant evidence: `T3`, `T4`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R5: Review `P5`

- target: `P5` settled change set
- timing: immediately after `P5` report and `T5`
- blocks: `S1`
- consolidation reason: none; edits landed inventory and catalog services
- reads: `apps/api/src/features/inventory/inventoryService.ts`; `apps/api/src/features/catalog/variantAdminService.ts`; `apps/api/test/backInStock/stockObserver.integration.test.ts`; `apps/api/src/features/inventory/inventoryRepository.ts` -> `incrementStock`, `availableToSell` -> call-site correctness
- acceptance: invocation at every restore path, correct placement relative to backorder fulfilment, non-invocation cases, transactional containment
- invariants: no change to reservation, allocation, movement, or backorder semantics; optional dependency keeps existing composition and tests valid
- risk focus: observer called before backorder fulfilment producing a false restock; missed cancellation or return path; observer exception escaping and aborting an inventory transaction
- non-goals: handler, route, web review
- relevant evidence: `T3`, `T5`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R6: Review `P6`

- target: `P6` settled change set
- timing: immediately after `P6` report and `T6`
- blocks: `S1`
- consolidation reason: none; seed determinism affects every later integration test
- reads: `apps/api/src/db/backInStockSeed.ts`; `apps/api/src/db/seed.ts` -> invocation point; `apps/api/src/db/seedAsyncScenarios.ts`; `apps/api/test/db/backInStockSeed.integration.test.ts`
- acceptance: idempotency, determinism, chosen SKU justified as unreferenced and non-default, buyer rows never clobbered
- invariants: no wall clock, no generated ids, fixtures keyed by SKU and email; canonical catalog unchanged
- risk focus: collision with saved-list, reorder, or review fixtures; re-seed resurrecting a cancelled subscription; zeroing a default variant and changing product availability elsewhere
- non-goals: domain or route review
- relevant evidence: `T6`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R7: Review `P7`

- target: `P7` settled change set
- timing: immediately after `P7` report and `T7`
- blocks: `P8`
- consolidation reason: none; shared client state consumed by every web surface
- reads: `apps/web/src/api/backInStock.ts`; `apps/web/src/hooks/BackInStockContext.tsx`; `apps/web/src/hooks/BackInStockContext.test.tsx`; `apps/web/src/hooks/NotificationsContext.tsx` -> staleness model reference
- acceptance: staleness, cancellation, logged-out reset, mutation serialization, rollback, error mapping
- invariants: stale completion never overwrites newer state; abort never surfaces as error; server response authoritative after write
- risk focus: leaked subscription data across user switch; optimistic state surviving a failed mutation; unserialized concurrent mutations
- non-goals: component or page review
- relevant evidence: `T2`, `T7`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R8: Review `P8`

- target: `P8` settled change set
- timing: immediately after `P8` report and `T8`
- blocks: `G3`
- consolidation reason: none; edits shared purchase panel, account page, and provider tree
- reads: `apps/web/src/components/NotifyWhenAvailableButton.tsx`; `apps/web/src/features/product/ProductPurchasePanel.tsx`; `apps/web/src/features/backInStock/*`; `apps/web/src/components/Layout.tsx`; `apps/web/src/features/account/AccountPage.tsx`
- acceptance: render predicate exactness, logged-out redirect with return path, subscribed state, cancel path, presentation entry, provider placement
- invariants: purchasable and backorder variants unchanged; accessibility assertions by role and accessible name; no client-side availability or MOQ derivation
- risk focus: control leaking onto backorder or retired variants; request fired before auth gate; provider nested outside `AuthProvider`; regression in existing purchase-panel tests
- non-goals: API review; visual or browser verification of any kind
- relevant evidence: `T7`, `T8`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R9: Review `S1`

- target: `S1` settled change set
- timing: after `S1` report and `T9`; separate integration target not covered by lane reviews
- blocks: `S2`
- consolidation reason: none; composition and public HTTP surface
- reads: `apps/api/src/routes/backInStock.ts`; `apps/api/src/app.ts` -> `createAppServices`, `registry.register` block, route registration; `apps/api/test/backInStock/backInStockRoutes.integration.test.ts`; `apps/api/test/backInStock/backInStockFlow.integration.test.ts`
- acceptance: auth gates, status mapping completeness, ownership isolation, wiring order, end-to-end chain, below-MOQ and fault branches
- invariants: no dependency cycle; observer reaches both inventory and variant admin; nested transaction stays a savepoint; response schemas match contracts exactly
- risk focus: missing status in a response schema causing serialization failure; handler registered for a kind absent from `jobKinds`; trigger wired after inventory leaving detection dead; buyer able to read or cancel another buyer's subscription
- non-goals: documentation review
- relevant evidence: `T4`, `T5`, `T6`, `T9`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

### R10: Review `S2`

- target: `S2` settled change set
- timing: after `S2` report and `T10`
- blocks: `G5`
- consolidation reason: none; final gate evidence assessment
- reads: `AGENTS.md`; `README.md`; `plans/demo_project_high_level_plan.md` -> item 15 and `Current Baseline`
- acceptance: claims match landed code; operator steps reproducible from repository scripts; no course spoiler beyond item 15; final evidence complete
- invariants: documentation states implemented behaviour only; repository map stays general
- risk focus: stale migration head or path claims; verification gap hidden by `verify` skipping web integration; misattributed pre-existing failure
- non-goals: code review already closed under `R1`-`R9`
- relevant evidence: `T0`, `T9`, `T10`
- write policy: inspect-only- test policy: assess supplied evidence; run a command only when named here or when stale or missing evidence blocks the verdict- return: reviewer_report_v1 with exact reviewed target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `apps/api/src/app.ts`: owned only by `S1`; every other packet reads it
- `apps/api/src/db/seed.ts`, `apps/api/src/db/seedAsyncScenarios.ts`: owned only by `P6`
- `apps/api/src/db/reset.ts`, `apps/api/src/db/migrations/index.ts`: owned only by `P1`
- `apps/api/src/features/audit/auditEvent.ts`, `auditQuery.ts`: owned only by `P3`, which lands all three actions up front so `P4` only consumes them
- `apps/api/src/features/inventory/stockObserver.ts`: created and owned by `P3`; `apps/api/src/features/inventory/inventoryService.ts` owned by `P5`. Disjoint files inside one directory
- `apps/api/src/features/pricing/pricingRules.ts`, `apps/api/src/features/cart/cartService.ts`: owned only by `P3` for the `minimumOrderQuantity` extraction
- `apps/api/src/features/jobs/jobService.ts`, `faultSwitch.ts`, `apps/api/src/features/notifications/notificationRules.ts`: owned only by `P4`
- `apps/web/src/components/Layout.tsx`, `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/account/AccountPage.tsx`, `apps/web/src/features/notifications/notificationsPresentation.ts`: owned only by `P8`
- `packages/contracts/**`: owned only by `P2`
- migration versions: `031` reserved by `P1`; no other packet adds a migration this run
- contract changes: producer `P2` -> consumers `P3`, `P4`, `P7`, `S1` after `GR2`
- composition: single integration owner `S1`; documentation owner `S2`

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, developer instructions from global Codex settings; never name or override them here
- non-Codex harnesses: ignore Codex binding; use harness-native subagent configuration preserving worker and reviewer responsibilities and communication contracts
- all harnesses: reviewer runs `code-reviewer` skill as review method; assignment sets `review_skill=code-reviewer`; reviewer invokes it explicitly by name because the skill carries `disable-model-invocation`
- every assignment prepends Node 22 selection in PowerShell before any node or npm command: `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`. Never select `v24.*`. Missing evidence is a blocker, never a pass

## Test Execution Schedule

- `T0`: at `G0` -> owner: orchestrator -> `npm run test:integration -w @shop/web` -> records pre-existing web integration failures on the base revision
- `T1`: after `P1` -> owner: `P1` -> `npm exec -w @shop/api -- tsx --test test/db/backInStockSchema.integration.test.ts test/db/migrations.integration.test.ts test/db/asyncSchema.integration.test.ts`
- `T2`: after `P2` -> owner: `P2` -> `npm run build -w @shop/contracts && npm test -w @shop/contracts`
- `T3`: after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test src/features/backInStock/backInStockRules.test.ts src/features/pricing/pricingRules.test.ts test/backInStock/backInStockService.integration.test.ts`
- `T4`: after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test src/features/notifications/notificationRules.test.ts test/backInStock/backInStockNotifyHandler.integration.test.ts`
- `T5`: after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test src/features/catalog/variantAdminService.test.ts test/backInStock/stockObserver.integration.test.ts test/inventory/inventoryRepository.integration.test.ts`
- `T6`: after `P6` -> owner: `P6` -> `npm exec -w @shop/api -- tsx --test test/db/backInStockSeed.integration.test.ts test/db/seed.integration.test.ts test/db/asyncSeed.integration.test.ts`
- `T7`: after `P7` -> owner: `P7` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/api/backInStock.test.ts src/hooks/BackInStockContext.test.tsx`
- `T8`: after `P8` -> owner: `P8` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/components/NotifyWhenAvailableButton.test.tsx src/features/backInStock/BackInStockSection.test.tsx src/features/backInStock/BackInStockJourney.integration.test.tsx src/features/product/ProductPurchasePanel.test.tsx src/features/notifications/notificationsPresentation.test.ts`
- `T9`: after `S1` fan-in -> owner: `S1` -> `npm exec -w @shop/api -- tsx --test test/backInStock/backInStockRoutes.integration.test.ts test/backInStock/backInStockFlow.integration.test.ts` then `npm run test:integration -w @shop/api`
- `T10`: final gate, after all fixes settle -> owner: `S2` -> `npm run verify` then `npm run test:integration -w @shop/web`, broad suite run once
- policy: automated repository commands only; no browser session, screenshot, dev-server click-through, or `browser-qa` invocation in any entry, gate, or review
- verify gap: `npm run verify` never executes the web integration tier, so `T10` must run `npm run test:integration -w @shop/web` explicitly and diff it against `T0`
- reuse: an entry stays valid while no owned or read path of its scope changed afterward. A new session alone never invalidates evidence. Give each agent only the ledger entries covering its packet
- invalidation: `packages/contracts/**` -> rerun `T2` and every consumer entry; `apps/api/src/db/migrations/**` or `reset.ts` -> rerun `T1`, `T6`, `T9`; `apps/api/src/features/backInStock/**` -> rerun `T3`, `T4`, `T9`; `apps/api/src/features/inventory/**` or `features/catalog/variantAdminService.ts` -> rerun `T5`, `T9`; `apps/api/src/app.ts` -> rerun `T9`; `apps/web/src/hooks/BackInStockContext.tsx` -> rerun `T7`, `T8`; any invalidation after `T10` -> rerun the affected focused entries then `T10` once

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every message and every JSON string value; preserve code, commands, paths, identifiers, errors exactly
- transport: one canonical JSON object inline, no free-text wrapper; temp artifacts only for bulky logs or large diffs under `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]` with inline summary, path, format, SHA-256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet plus repository instructions plus relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`, stored at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md` whenever an object array becomes non-empty
- reviewer method: assignment carries `review_skill=code-reviewer`
- worktree context: every assignment carries absolute worktree path, implementation branch, base revision; every repository-relative path resolves under worktree root; every command runs with worktree as working directory
- revision rule: narrow clarification, fix, continuation, or stop -> directive against active revision; objective, ownership, acceptance, review target, or verification-duty change -> reissue full assignment with incremented `assignment_revision`
- fix rule: every code-reviewer finding goes to a fresh worker through full assignment plus `action=fix` directive carrying stable `finding_ids`; closure needs targeted verification only; never re-review a fix; reviewer-targeted `fix` corrects report or protocol only

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh runtime orchestrator; load source-checkout repository instructions, this plan, canonical contracts, current checkpoint.
3. Record source checkout path, branch, `HEAD`. Detached `HEAD` or relevant uncommitted input -> stop and ask user.
4. Create implementation branch and worktree from recorded `HEAD`; persist worktree identity in checkpoint.
5. Switch execution root to worktree; load worktree repository instructions; select Node 22; confirm install health with `npm exec -- tsx --version` and `npm run typecheck -w @shop/api`.
6. Validate `G0`: capture `T0`, confirm the `TCM-0034-003` reference assumption, record any pre-existing web integration failure.
7. Launch `P1 || P2` with role-minimum context plus worktree context.
8. Accept reports; update checkpoint and ledger; launch `R1` and `R2` against exact settled change sets before any consumer starts.
9. Route findings to fresh workers; close through targeted evidence; validate `GR1`, `GR2`, then `G1`.
10. Launch `P3 || P7`; review each settled lane; validate `GR3`, `GR7`, then `G2`.
11. Launch `P4 || P5 || P6 || P8`; review each settled lane concurrently; validate `GR4`-`GR8`, then `G3`.
12. Launch `S1`; run `T9` once after wiring settles; review `S1` as a separate integration target; validate `GR9`, then `G4`.
13. Launch `S2`; run `T10` once after all fixes settle; review; validate `GR10`, then `G5`.
14. Leave implementation branch and worktree intact. Reply with absolute worktree path, implementation branch, source branch, base revision. State user owns merge.

## Risks and Open Questions

- risk: notification dedupe key is permanently unique -> a wrong `entityType`/`entityId` choice silently suppresses every later notification for a buyer and lot -> mitigation: subscription-scoped `entityId`, asserted by a `P4` test that subscribes, notifies, re-subscribes, and notifies again
- risk: observer invoked before `fulfillBackorders` reports a restock that backorders immediately consume -> mitigation: `P5` placement after fulfilment plus `P4` threshold re-read at handler time; `T5` asserts the ordering
- risk: retired lot restocked through return or cancellation notifies buyers who cannot purchase -> mitigation: handler cancels pending subscriptions for inactive variants; covered by `R4` risk focus and `T4`
- risk: seed choice collides with saved-list, reorder, or review fixtures -> mitigation: `P6` greps before choosing and reports the chosen SKU; `T6` asserts other fixtures unaffected
- risk: MOQ extraction changes cart behaviour -> mitigation: `P3` delegates rather than reimplements; existing cart suites rerun under `T3` scope and `R3` risk focus
- risk: dependency cycle if the trigger is given an inventory dependency -> mitigation: trigger deliberately excludes inventory and constructs first; `R9` checks wiring order
- risk: green `npm run verify` hides a red web integration tier -> mitigation: `T0` baseline plus mandatory `T10` web integration run and explicit diff
- risk: contracts `dist` not rebuilt leaves consumers failing to compile for reasons unrelated to their own code -> mitigation: `T2` includes the build; invalidation rule reruns consumers
- question: should a buyer receive a second notification if a lot sells out again while a `notified` subscription is recent -> resolved as no; re-subscription is explicit. Revisit only if user asks
- question: human smoke check of the buyer journey against a running dev server -> user-owned follow-up outside this plan; never a packet duty, gate condition, or acceptance criterion

## Done Criteria

- authenticated buyer subscribes from a sold-out lot detail variant, sees the subscription in account, and can cancel it
- restock through admin goods receipt, admin variant stock write, return receipt, or order cancellation enqueues exactly one job per variant per instant
- queue drain delivers exactly one `back_in_stock.available` notification per pending subscription once available-to-sell reaches the variant minimum order quantity, marks the subscription `notified`, and produces one preference-gated mailbox row
- below-threshold restock, retired lot, repeat drain, and fault-flag retry all behave as specified with no duplicate notification
- migration head is `031`, FK-clean, reset-covered, and `npm run reset` yields one sold-out lot plus one pending seeded subscription deterministically
- contracts expose `@shop/contracts/back-in-stock`; `NotificationKind` and `JobKind` carry the new literals; no existing contract member changed
- `T1`-`T9` pass; `T10` shows `npm run verify` green and `npm run test:integration -w @shop/web` no worse than `T0`
- `AGENTS.md` repository map, README operator steps, and plan item 15 record the landed feature
- worktree and implementation branch remain intact for user-owned merge
