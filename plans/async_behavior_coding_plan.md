# Async Behavior Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `8. Async behavior`
Repository baseline: branch `expansion_002` @ `ae14382`, inspected 2026-08-01. Migration head `029`. Next free migration version `030`.

## Runtime Worktree

- source: current branch at runtime -> record absolute source checkout path, branch, and `HEAD` before any implementation write. Detached `HEAD` -> stop and ask user to select a branch.
- uncommitted/untracked gate: relevant uncommitted or untracked source-checkout changes absent from branch `HEAD` -> stop and ask user to commit them or choose a baseline. Never copy, stash, discard, or import them without explicit approval. Present at planning time: `plans/saved_lists_coding_plan.md` is deleted in the source checkout but not committed.
- create: dedicated implementation branch + worktree from the recorded `HEAD` -> `git worktree add -b <implementation-branch> <absolute-worktree-path> expansion_002`
- execution root: every worker, reviewer, test, fix, and convergence action runs with the worktree as working directory; the source checkout stays read-only after creation except the saved plan and run-scoped temp state
- integration: no merge, rebase, cherry-pick, copy-back, branch deletion, or worktree removal at completion; user handles the merge into the source branch
- completion reply: absolute worktree path + implementation branch + source branch + base revision, stating the worktree remains intact and user handles integration

## Objective

Deliver local asynchronous execution as a real product capability: a persisted job queue with retry and dead-letter, a buyer notification domain that is the first consumer of `user_preferences`, idempotent capture of inbound simulated payment webhooks, operator-controlled failure injection wired through existing feature flags, and standing/repeat order scheduling that rebuilds a cart from a saved list or past order and notifies the buyer.

Complete when: queue persists and retries deterministically; notifications reach buyer inbox and dev mailbox under preference gating; duplicate and out-of-order webhooks are absorbed without state corruption; named fault flags force reproducible failures; standing orders run on cadence and report per-line outcomes; migration `030` applies FK-clean; `npm run verify` plus `npm run test:integration -w @shop/web` pass.

## Scope

### In

- persisted job queue: enqueue, dedupe key, claim with lease, complete, fail, retry with capped exponential backoff, dead-letter, stale-lease reclaim
- immutable job attempt ledger
- notification domain: persisted per-buyer notifications, in-app inbox, preference-gated mailbox delivery
- captured inbound webhooks: `POST /api/webhooks/payments`, signature check, idempotent capture by event id, out-of-order tolerance via existing payment CAS, admin inspector
- failure injection: named boolean `async.*` feature flags consumed by job handlers, webhook processing, and notification delivery; requires exporting the feature-flag resolver from composition root
- standing orders: buyer-owned schedule over a saved list or an owned past order -> cadence -> job run -> `CartService.addMany` -> notification with per-line outcomes
- admin surfaces: job queue list/detail/retry/drain, captured webhook list/detail
- migration `030`, seed fixtures, reset coverage, audit vocabulary for all new actions

### Out

- back-in-stock notification (high-level item 15). This plan lands the queue, notification domain, and handler-registry seam it depends on; it does not add the `notify me` surface or any inventory 0->positive hook.
- autonomous checkout from a schedule. `checkoutService.process` hard-requires card PAN/expiry/CVC and no stored-card model exists. Standing orders end at a populated cart plus notification; buyer completes checkout, so company approval threshold re-evaluates per run through the normal checkout gate.
- persisted quote/RFQ object of any kind
- outbound HTTP to any external host; webhook source is a local simulated processor only
- cron-expression scheduling, timezone-aware schedules, region config (belongs to item 10)
- parameterised fault config; injection is boolean-per-named-fault
- Custom Blend lines inside standing orders; schedules resolve ordinary stock variants and owned-order lines through the existing shared paths, inheriting their skip reasons unchanged

## Repository Findings

### Composition and lifecycle

- existing: `apps/api/src/app.ts` -> `AppDependencies { db, resetBaseUrl, clock?, resetTokenSource?, orderAccessTokenSource? }`, private `createAppServices`, flat `AppServices` (34 slots), `AppContext = { services }` passed as plugin options to 34 `app.register` calls
- existing: `apps/api/src/app.ts` -> `const clock = dependencies.clock ?? { now: () => new Date() }`; `Clock { now(): Date }` declared in `features/auth/authService.ts` and duplicated in `features/audit/auditService.ts`
- gap: `buildApp` registers no `onReady`/`onClose` hook. Only shutdown seam is the `close` closure in `apps/api/src/server.ts:12-18`
- constraint: every API integration test inlines `buildApp` + `t.after(app.close)`. A timer started inside `buildApp` hangs `node --test`. Runner must start only from `server.ts`.
- existing: `apps/api/src/config.ts` -> `loadConfig(env)` reads `SHOP_DB_PATH`, `SHOP_API_HOST`, `SHOP_API_PORT`, `SHOP_SEED`, `SHOP_RESET_BASE_URL`; throws on invalid port/URL

### Persistence

- existing: `apps/api/src/db/unitOfWork.ts` -> `UnitOfWork { run<T>(work: () => T): T }` over `db.transaction`. Synchronous only; a returned Promise is not awaited inside the transaction. Nests as SAVEPOINT (relied on at `app.ts:391`).
- constraint: `better-sqlite3` ^11.7.0, one connection, WAL, `foreign_keys = ON`, no `busy_timeout`. No in-process write concurrency; a drain pass blocks the event loop for its duration.
- constraint: job handlers that must await (payment gateway) cannot run inside `unitOfWork.run`. Handler pattern is transactional claim -> non-transactional effect -> transactional settle.
- existing: `apps/api/src/db/migrate.ts` -> `Migration { version, name, up(db) }`; runner suspends FKs around the loop, runs each migration in `db.transaction`, runs `PRAGMA foreign_key_check` per migration
- reuse: `apps/api/src/db/migrations/029_saved_lists.ts` file shape (local `hasTable`, `assertForeignKeysClean`, single `db.exec` DDL, `IF NOT EXISTS` everywhere)
- reuse: `apps/api/src/db/migrations/027_admin_surface.ts` -> immutability trigger pattern (`admin_refunds_no_update` -> `RAISE(ABORT, ...)`), `CHECK (typeof(x) = 'integer')`, `idempotency_key TEXT NOT NULL UNIQUE`

### Existing async-shaped machinery

- gap: no timer, interval, queue, worker, webhook, backoff, or retry loop exists anywhere in `apps/api`. Only production `setTimeout` is the 250 ms gateway sleep in `features/payments/paymentGateway.ts:24`.
- existing lazy-sweep precedent: `features/checkout/checkoutService.ts` -> `RESERVATION_LEASE_MS = 15 * 60_000`, `expirePreparedReservations` called only from `prepare()`
- existing lazy-sweep precedent: `features/orderApprovals/approvalService.ts` -> `APPROVAL_LEASE_MS`, `expire()` invoked at top of all five methods, emitting `approval.expired` with `{ actor: { type: 'system', userId: null }, requestId: null }`
- reuse: that system-actor audit context is the precedent for background writers. `features/audit/auditEvent.ts` -> `requireContext` requires `requestId` only for non-system actors.
- existing CAS: `features/payments/paymentRepository.ts` -> `transition({ idempotencyKey, expectedStatus, nextStatus, ... }): boolean` via `UPDATE ... WHERE idempotency_key = ? AND status = ?`. Out-of-order webhook delivery is already safe: a stale expectation returns `false` rather than corrupting state.
- reuse: `inventory_receipts` (`idempotency_key UNIQUE` + `request_fingerprint` + `response_json` replay) is the capture-and-replay table shape for `captured_webhooks`

### Notifications inputs

- existing: `user_preferences(order_updates_email, marketing_email, approval_request_email)` from migration `025`; `features/preferences/preferencesService.ts` -> `DEFAULT_PREFERENCES`, `get(userId)` returns defaults without writing
- gap: zero consumers. `checkoutFinalizer.ts:96` and `approvalService.ts:171` post to the dev mailbox unconditionally, including approver mail that `approvalRequestEmail` nominally governs.
- existing: `features/mailbox/mailboxRepository.ts` -> `add({ recipient, subject, body, kind, createdAt })`, `list()`. `kind` is free-form; new kinds need no contract change. Five existing callers.
- existing firing points already inside a UoW with an audit write: `checkoutFinalizer.ts:131` order created; `orders/orderService.ts:146,209,259,304` packed / transitioned / tracking / cancelled

### Standing-order inputs

- reuse: `features/cart/cartService.ts` -> `addMany(cartId, requests, context): BulkAddResult | 'CART_NOT_FOUND' | 'CART_RESERVED'`; rules in `features/cart/cartBulkAddRules.ts` own aggregation, fixed skip precedence, and fan-out
- reuse: `features/savedLists/savedListService.ts` -> `addToCart(userId, listId, cartId, context)` already raises saved quantities to current MOQ and returns per-line outcomes; plan builder `buildSavedListCartPlan` in `savedListRules.ts`
- reuse: `features/reorder/reorderService.ts` -> `reorder({ orderId, userId, cartId, context })` returns per-source-line outcomes with price drift
- constraint: both reject a reserved cart with `CART_RESERVED`. A scheduled run must own its target cart for the duration.
- constraint: `features/delivery/deliverySlotRules.ts` -> `isSlotBookable` / `listBookableSlots` are the only slot authority; horizon is 15 business days, so no schedule may pre-book a slot. Cart-only outcome sidesteps this entirely.

### Feature flags

- existing: `feature_flags(key, description, enabled, updated_at, updated_by_user_id)` from `027`; boolean-only column, contract, and record
- existing: `features/featureFlags/featureFlagResolver.ts` -> `FeatureFlagResolver { isEnabled(key), invalidate(key) }`, read-through `Map` cache, missing key caches `false`
- existing: `features/featureFlags/featureFlagService.ts` -> `invalidateAfterCommit(key, work)` invalidates after commit
- gap: resolver is constructed inline at `app.ts:474-479` and never exported. `AppServices` exposes only `featureFlags: FeatureFlagService`. No product code can consume a flag today.
- reuse: exporting the resolver closes high-level item 9's stated remainder ("wire a flag to real behavior when a named demo needs it")

### Web

- existing: `apps/web/src/App.tsx` -> `App()` owns the flat `<Routes>` table; `components/Layout.tsx` owns every provider; `components/Header.tsx` owns the customer-tools group; `features/admin/AdminNav.tsx` and `features/admin/AdminIndexPage.tsx` each carry a duplicated `sections` list that must both be edited; `features/account/AccountPage.tsx` renders hardcoded section JSX
- reuse: `apps/web/src/api/client.ts` -> `apiFetch` = `fetchWithResponseSchema(schema, path, options)`, `credentials: 'include'`, `ApiError`/`ApiContractError`, every success schema-validated
- reuse: `apps/web/src/hooks/SavedListsContext.tsx` -> provider + `use*Context` throw guard, server-code error message table, mutators returning `T | false`, `mountedRef` + serialized `mutationQueueRef`
- reuse stale-async idiom: monotonic request-version guard in `features/admin/orders/AdminOrdersPage.tsx` and `features/admin/featureFlags/AdminFeatureFlagsPage.tsx`
- reuse pagination idiom: `features/admin/reviews/AdminReviewModerationPage.tsx` (`useSearchParams` URL state, `PAGE_SIZE`, sanitizers, page clamp, focus restoration)
- reuse test idiom: `features/savedLists/SavedListsJourney.integration.test.tsx` -> module-level `vi.mock` of `@/api/*` and `@/hooks/AuthContext`, real providers, `MemoryRouter` with stub landing routes. Integration tests never mount `App.tsx`, so feature packets need no composition edit to be verifiable.

### Verification surface

- constraint: root `verify` = `format && typecheck && lint && npm test && build`; root `npm test` = per-workspace `test`; `@shop/web` `test` = `test:unit` only. Web integration tests are therefore NOT in `verify` and must be run explicitly.
- constraint: at least one `apps/web` admin integration test is reported red on `main`. `G0` captures a baseline result rather than asserting green.
- constraint: API test globs are `apps/api/src/**/*.test.ts` (unit) and `apps/api/test/**/*.integration.test.ts` (integration). A file off-convention never runs.
- constraint: no shared API test-app helper exists; each integration test inlines `mkdtempSync` -> `openDatabase` -> `seedDatabase` -> `buildApp` -> `t.after`.
- constraint: injectable `Clock` exists and is threaded everywhere, but no advanceable test clock helper and no fake timers exist in `apps/api`. Determinism comes from a mutable stub clock plus explicit drain calls, not timers.
- constraint (Windows): prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` before any node/npm command.

## Decisions and Invariants

- queue runtime: `buildApp` never starts a timer. `createJobRunner` exposes `runDue(now)` for deterministic drains and `start()`/`stop()` for the long-lived loop; only `apps/api/src/server.ts` calls `start()`, and its existing `close` closure calls `stop()` before `app.close()`.
- handler contract: `JobHandler { kind, handle(payload, ctx): Promise<JobHandlerResult> }`. Claim and settle each run inside their own `unitOfWork.run`; the effect between them runs outside any transaction. No handler opens a transaction that spans an `await`.
- retry: `attempts` increments per run; `runAt = now + min(JOB_BACKOFF_CAP_MS, JOB_BACKOFF_BASE_MS * 2^(attempts-1))`. No jitter — determinism outranks thundering-herd realism in a local demo. `attempts >= maxAttempts` -> `dead`, never silently dropped.
- lease: claim sets `status='running'` and `lease_expires_at = now + JOB_LEASE_MS`. A `running` job past its lease is reclaimable and counts the abandoned run as a failed attempt. Crash recovery needs no separate sweeper.
- dedupe: `jobs.dedupe_key` is `UNIQUE` and nullable. Enqueue with an existing key returns the existing job; it is a domain outcome, never an error.
- attempts ledger `job_attempts` is append-only, guarded by update and delete triggers, matching `admin_refunds` and `inventory_stock_movements`.
- notification authority: the in-app notification row is always written; only mailbox email delivery consults `user_preferences`. `order.*` kinds gate on `orderUpdatesEmail`, `standing_order.*` on `orderUpdatesEmail`, approval kinds on `approvalRequestEmail`. This makes preferences their first real consumer without hiding history from the buyer.
- notification ownership: every notification belongs to exactly one `user_id`. Anonymous checkout produces no notification. Deleted (tombstoned) accounts cascade their notifications; orders are retained as today.
- webhook capture: `POST /api/webhooks/payments` captures first, processes later. Capture is idempotent on `event_id UNIQUE`; a repeat delivery returns the captured record and enqueues nothing. Response is always `202` once captured, so processing failure never leaks to the caller.
- webhook ordering: processing never asserts current payment status. It calls the existing `paymentRepository.transition` CAS; a `false` return records outcome `ignored_stale` and completes the job successfully. Out-of-order is a normal outcome, not a failure.
- webhook auth: constant-time comparison against an HMAC-SHA256 signature header over the raw body, secret from `SHOP_WEBHOOK_SECRET` with a documented local default so the no-API-key constraint holds. Bad signature -> `401`, nothing captured, nothing enqueued.
- failure injection: boolean `async.*` feature flags only, consumed through an injected `FaultSwitch { isEnabled(key): boolean }`. Domains never import the resolver directly, so unit tests pass a literal stub. Named keys are fixed in `features/jobs/faultInjection.ts` and seeded disabled.
- standing orders end at a cart: a run creates or reuses a buyer-owned cart, drives `savedListService.addToCart` or `reorderService.reorder`, records per-line outcomes, and writes one notification. It never touches checkout, payment, delivery slots, or approvals.
- standing-order run isolation: a run whose target cart is reserved fails with `CART_RESERVED` and retries under the normal backoff. Partial line success is a domain outcome and is never rolled back, consistent with the landed `addMany` contract.
- audit: every new async mutation writes an audit event. Background writers use `{ actor: { type: 'system', userId: null }, requestId: null }`, the precedent set by `approvalService.expire`.
- money and inventory paths are untouched. No new pricing derivation; standing orders disclose server-resolved prices returned by `addMany`.
- migration `030` is additive only; it drops nothing and renumbers nothing. Head becomes `030`.
- assumption (validate at `G0`): the red `apps/web` admin integration test is pre-existing on `expansion_002` and unrelated to this scope. `G0` records its exact identity and result as the baseline; final gate compares against that baseline rather than demanding green.
- assumption (validate at `P2`): no existing contract subpath collides with `./jobs`, `./notifications`, `./webhooks`, `./standing-orders`.

## Target Design

### Schema (migration `030_async_behavior.ts`)

- `jobs`: `id INTEGER PK AUTOINCREMENT`, `kind TEXT NOT NULL`, `dedupe_key TEXT UNIQUE`, `payload_json TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed','dead'))`, `attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)`, `max_attempts INTEGER NOT NULL CHECK (max_attempts > 0)`, `run_at TEXT NOT NULL`, `lease_expires_at TEXT`, `last_error TEXT`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`. Index on `(status, run_at)`.
- `job_attempts`: `id`, `job_id REFERENCES jobs(id) ON DELETE CASCADE`, `attempt_number INTEGER NOT NULL`, `started_at`, `finished_at`, `outcome TEXT NOT NULL CHECK (outcome IN ('succeeded','failed','abandoned'))`, `error TEXT`. `UNIQUE(job_id, attempt_number)`. Update and delete triggers raise abort.
- `notifications`: `id`, `user_id REFERENCES users(id) ON DELETE CASCADE`, `kind TEXT NOT NULL`, `title`, `body`, `entity_type TEXT`, `entity_id TEXT`, `dedupe_key TEXT UNIQUE`, `created_at TEXT NOT NULL`, `read_at TEXT`. Index on `(user_id, created_at DESC)`.
- `captured_webhooks`: `id`, `source TEXT NOT NULL CHECK (source = 'simulated_payments')`, `event_id TEXT NOT NULL UNIQUE`, `event_type TEXT NOT NULL`, `payload_json TEXT NOT NULL`, `request_fingerprint TEXT NOT NULL`, `received_at TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('captured','processed','ignored_stale','rejected'))`, `processed_at TEXT`, `failure_reason TEXT`, `job_id REFERENCES jobs(id) ON DELETE SET NULL`.
- `standing_orders`: `id`, `user_id REFERENCES users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `source_kind TEXT NOT NULL CHECK (source_kind IN ('saved_list','order'))`, `source_list_id REFERENCES saved_lists(id) ON DELETE CASCADE`, `source_order_id REFERENCES orders(id) ON DELETE CASCADE`, `cadence TEXT NOT NULL CHECK (cadence IN ('weekly','fortnightly','monthly'))`, `next_run_at TEXT NOT NULL`, `last_run_at TEXT`, `active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))`, `created_at`, `updated_at`. `CHECK` enforcing exactly one populated source column. Index on `(active, next_run_at)`.
- `standing_order_runs`: `id`, `standing_order_id REFERENCES standing_orders(id) ON DELETE CASCADE`, `job_id REFERENCES jobs(id) ON DELETE SET NULL`, `cart_id TEXT`, `run_at TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('pending','completed','failed'))`, `added_line_count INTEGER NOT NULL DEFAULT 0`, `skipped_line_count INTEGER NOT NULL DEFAULT 0`, `outcomes_json TEXT`, `failure_reason TEXT`.

### Contracts (`packages/contracts/src/`)

- `jobs.ts` -> `JOB_MAX_ATTEMPTS`, `JOB_BACKOFF_BASE_MS`, `JOB_BACKOFF_CAP_MS`, `JOB_LEASE_MS`, `JobStatus`, `JobKind`, `AdminJob`, `AdminJobAttempt`, `AdminJobDetail`, `AdminJobListQuery`, `AdminJobPage`, `AdminJobRetryBody`, `AdminJobDrainResponse`
- `notifications.ts` -> `NotificationKind`, `Notification`, `NotificationListQuery`, `NotificationPage`, `MarkAllReadResponse`
- `webhooks.ts` -> `PaymentWebhookEventType`, `PaymentWebhookBody`, `PaymentWebhookAck`, `AdminCapturedWebhook`, `AdminCapturedWebhookListQuery`, `AdminCapturedWebhookPage`
- `standingOrders.ts` -> `StandingOrderCadence`, `StandingOrderSource`, `StandingOrder`, `StandingOrderRun`, `StandingOrderLineOutcome`, `CreateStandingOrderBody`, `UpdateStandingOrderBody`, `StandingOrderRunListResponse`
- each module: `export * from './<x>.js'` in `src/index.ts` + a `package.json` `exports` subpath (`./jobs`, `./notifications`, `./webhooks`, `./standing-orders`) + `test/<x>.test.ts` asserting root and subpath identity plus `Value.Check`

### Domains (`apps/api/src/features/`)

- `jobs/` -> `jobRepository.ts` (claim/settle SQL, `(status, run_at)` scan, stale-lease reclaim), `jobRules.ts` (pure `nextBackoffMs`, `classifyAttemptOutcome`, `isLeaseExpired`), `jobService.ts` (`enqueue`, `claimDue`, `settle`, `retryDead`, `list`, `get`), `jobHandlerRegistry.ts` (`JobHandler`, `registerHandler`, `resolveHandler`), `jobRunner.ts` (`runDue(now)`, `start()`, `stop()`), `faultInjection.ts` (`FaultSwitch`, `ASYNC_FAULT_KEYS`)
- `notifications/` -> `notificationRepository.ts`, `notificationRules.ts` (pure preference gate `shouldEmailNotification(kind, preferences)`), `notificationService.ts` (`notify`, `list`, `markRead`, `markAllRead`), `notificationDeliveryHandler.ts` (job handler `notification.deliver` -> mailbox)
- `webhooks/` -> `webhookRepository.ts`, `webhookRules.ts` (pure `verifySignature`, `webhookFingerprint`, `mapEventToTransition`), `webhookService.ts` (`capture` -> row + enqueue), `webhookProcessingHandler.ts` (job handler `webhook.process` -> payment CAS -> notification)
- `standingOrders/` -> `standingOrderRepository.ts`, `standingOrderRules.ts` (pure `nextRunAt(cadence, from)`, `validateCadence`, `summariseOutcomes`), `standingOrderService.ts` (CRUD + `runNow` + `enqueueDue`), `standingOrderRunHandler.ts` (job handler `standing_order.run`)

### API surface

- buyer: `GET /api/notifications`, `POST /api/notifications/:notificationId/read`, `POST /api/notifications/read-all`, `GET /api/standing-orders`, `POST /api/standing-orders`, `PATCH /api/standing-orders/:standingOrderId`, `DELETE /api/standing-orders/:standingOrderId`, `GET /api/standing-orders/:standingOrderId/runs`, `POST /api/standing-orders/:standingOrderId/run-now` — all `requireAuth`, all owner-scoped
- admin: `GET /api/admin/jobs`, `GET /api/admin/jobs/:jobId`, `POST /api/admin/jobs/:jobId/retry`, `POST /api/admin/jobs/run`, `GET /api/admin/webhooks`, `GET /api/admin/webhooks/:webhookId` — all `requireAdmin`, all mutations audited
- inbound: `POST /api/webhooks/payments` — unauthenticated, signature-gated, `202` on capture or replay, `401` on bad signature
- errors follow the newest repository pattern: `Result<T>` union in a `*Errors.ts` module per domain, plus frozen message and status tables in the route file, exactly as `routes/savedLists.ts:48-99` does

### Web surface

- `/notifications` (protected) -> inbox page + `NotificationsContext` + header bell with unread count
- `/account/standing-orders` (protected) -> list, create from saved list or past order, edit cadence, pause, run now, run history with per-line outcomes; entry link from `AccountPage`
- `/admin/jobs` and `/admin/webhooks` -> paginated inspectors following the `AdminReviewModerationPage` URL-state idiom; fault flags are administered through the existing `/admin/feature-flags` page with no new UI

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> {API: P3 -> R3 -> GR3 -> P4 -> R4 -> GR4 -> {P5 -> R5 -> GR5 || P6 -> R6 -> GR6} -> G2 -> P7 -> R7 -> GR7 -> P8 -> R8 -> GR8 -> P9 -> R9 -> GR9 || WEB: P10 -> R10 -> GR10 || P11 -> R11 -> GR11 || P12 -> R12 -> GR12} -> G3 -> S1 -> R13 -> GR13 -> G4`

- `G0`: worktree created and verified; uncommitted `plans/saved_lists_coding_plan.md` deletion resolved with user; `npm ci` health (`npm exec -- tsx --version`, `npm run typecheck -w @shop/api`) passes; baseline recorded for `npm run test:integration -w @shop/web` including the identity of any pre-existing failure
- `GR1`: migration `030` review gate. Blocks every API domain packet.
- `GR2`: contracts review gate. Blocks every consumer, API and web.
- `G1`: both producer gates passed -> API chain and web lanes launch
- `GR3`: job engine review gate. Blocks all handler packets.
- `GR4`: notifications review gate. Blocks `P5` and `P6`, which both emit notifications.
- `GR5`, `GR6`: webhook and standing-order domain gates. Both must pass before `G2`.
- `G2`: all four API domains reviewed -> runtime host may wire them
- `GR7`, `GR8`, `GR9`: runtime host, admin/webhook routes, seed gates. Strictly sequential; each blocks the next because all three touch `apps/api/src/app.ts` or `apps/api/src/db/seed.ts`.
- `GR10`, `GR11`, `GR12`: web lane gates. Disjoint feature directories; reviewed concurrently.
- `G3`: every lane gate passed -> convergence may edit shared composition files
- `GR13`: convergence review gate over composition, seed integration, and docs
- `G4`: completion gate. Broad suite plus explicit web integration run, compared against the `G0` baseline.

## Work Packets

### P1: Migration `030` for async schema

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/030_async_behavior.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/asyncSchema.integration.test.ts`
- reads: `apps/api/src/db/migrations/029_saved_lists.ts` -> `savedListsMigration`, `hasTable`, `assertForeignKeysClean` -> file shape and FK-check convention; `apps/api/src/db/migrations/027_admin_surface.ts` -> `admin_refunds` DDL and `admin_refunds_no_update` trigger -> immutability and CHECK idioms; `apps/api/src/db/migrate.ts` -> `Migration`, `migrateDatabase`, `validateMigrations` -> registration and ordering rules; `apps/api/src/db/migrations/015_inventory.ts` -> `inventory_stock_movements` triggers -> update+delete trigger pair
- acceptance: six tables plus indexes and the `job_attempts` immutability trigger pair exist after `migrateDatabase`; migration is idempotent on a second run; `PRAGMA foreign_key_check` clean; existing seeded database migrates without loss; version `030` registered last in `migrations/index.ts`
- non-goals: no repository, service, route, seed, or contract code; no change to any landed migration
- upstream inputs: none
- changes:
  - author `030_async_behavior.ts` following the `029` shape: local `hasTable`, local `assertForeignKeysClean`, one `db.exec` template holding all DDL with `IF NOT EXISTS`
  - create `jobs`, `job_attempts`, `notifications`, `captured_webhooks`, `standing_orders`, `standing_order_runs` per Target Design, including every `CHECK`, `UNIQUE`, and FK action
  - create indexes `jobs(status, run_at)`, `notifications(user_id, created_at DESC)`, `standing_orders(active, next_run_at)`, `standing_order_runs(standing_order_id, run_at DESC)`, `captured_webhooks(status, received_at DESC)`
  - create `job_attempts_no_update` and `job_attempts_no_delete` triggers raising abort
  - enforce the exactly-one-source rule on `standing_orders` with a table `CHECK`
  - register `asyncBehaviorMigration` last in `migrations/index.ts`
  - add `apps/api/test/db/asyncSchema.integration.test.ts`: fresh temp DB migrates clean; second `migrateDatabase` is a no-op; `PRAGMA foreign_key_check` returns no rows; an `UPDATE` and a `DELETE` on `job_attempts` each throw; a `standing_orders` row with both source columns set is rejected; a duplicate `jobs.dedupe_key` insert is rejected
- invariants: additive only; no landed migration edited or renumbered; no `foreign_keys` pragma toggled inside the migration transaction; local SQLite is disposable but the migration must still be transactional, idempotent, and FK-clean
- relevant evidence: none
- test duty: run `E-P1` at packet completion
- verification: `E-P1` passes; migration file contains no `DROP` of a pre-existing object
- handoff: table and column names, CHECK vocabularies, trigger names, index names -> `P3`, `P4`, `P5`, `P6`, `P9`
- review: `R1` -> `GR1` blocks `P3`, `P4`, `P5`, `P6`, `P9`

### P2: Async transport contracts

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/jobs.ts`, `packages/contracts/src/notifications.ts`, `packages/contracts/src/webhooks.ts`, `packages/contracts/src/standingOrders.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/jobs.test.ts`, `packages/contracts/test/notifications.test.ts`, `packages/contracts/test/webhooks.test.ts`, `packages/contracts/test/standingOrders.test.ts`
- reads: `packages/contracts/src/savedLists.ts` -> module shape, `Type.Object` with `additionalProperties: false`, page/query idioms -> pattern to copy; `packages/contracts/src/pricing.ts` -> exported numeric constants -> precedent for queue constants living in contracts; `packages/contracts/src/reorder.ts` -> `ReorderLineOutcome` -> per-line outcome shape reused by standing orders; `packages/contracts/package.json` -> `exports` map -> kebab subpath to camelCase dist mapping; `packages/contracts/test/savedLists.test.ts` -> assertion style
- acceptance: four modules build; each type is importable from both the package root and its subpath; `npm test -w @shop/contracts` passes; every request body sets `additionalProperties: false`; every list query carries `page`/`pageSize` bounds
- non-goals: no API or web code; no runtime logic beyond exported constants; no schema for back-in-stock or any item-15 concept
- upstream inputs: none
- changes:
  - author the four modules per Target Design; reuse `ReorderLineOutcome`-shaped fields for `StandingOrderLineOutcome` so the shared skip vocabulary is not forked
  - define `JobKind` as a closed union: `'notification.deliver' | 'webhook.process' | 'standing_order.run'`
  - define `NotificationKind` as a closed union covering order placed/shipped/cancelled, standing-order run completed/failed, and payment webhook settled
  - export `JOB_MAX_ATTEMPTS = 5`, `JOB_BACKOFF_BASE_MS`, `JOB_BACKOFF_CAP_MS`, `JOB_LEASE_MS` from `jobs.ts`
  - add four `export * from './<x>.js'` lines to `src/index.ts`
  - add four `exports` subpaths to `package.json`: `./jobs`, `./notifications`, `./webhooks`, `./standing-orders`
  - add four test files asserting root/subpath identity, `Value.Check` acceptance of a valid payload, and rejection of an unknown property
- invariants: contracts own transport only, never business rules; existing exported symbols unchanged; no breaking edit to any landed contract module
- relevant evidence: none
- test duty: run `E-P2` at packet completion
- verification: `E-P2` passes; `npm run build -w @shop/contracts` emits all four dist modules
- handoff: exported schema and type names, closed unions, queue constants -> `P3`-`P12`
- review: `R2` -> `GR2` blocks `P3`-`P12`

### P3: Job queue engine and fault-switch seam

- mode: sequential after `G1`, first in the API chain
- depends on: `P1`, `P2`, `G1`
- owns: `apps/api/src/features/jobs/**`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/test/jobs/jobService.integration.test.ts`
- reads: `apps/api/src/features/savedLists/savedListRepository.ts` -> repository construction and row mapping -> pattern to copy; `apps/api/src/db/unitOfWork.ts` -> `UnitOfWork.run` -> synchronous transaction semantics and SAVEPOINT nesting; `apps/api/src/features/payments/paymentRepository.ts` -> `transition`, `reservePreGateway` -> compare-and-swap and `ON CONFLICT DO NOTHING` idioms; `apps/api/src/features/orderApprovals/approvalService.ts` -> `expire`, system audit context -> background-actor precedent; `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEntityType`, `AuditEventInput`, `buildAuditEvent` -> the three places every new action must be added; `apps/api/src/features/featureFlags/featureFlagResolver.ts` -> `FeatureFlagResolver` -> shape `FaultSwitch` must structurally match
- acceptance: `enqueue` is idempotent on `dedupe_key`; `claimDue` returns only due, non-leased jobs and marks them running with a lease; `settle` records an attempt row and either succeeds, reschedules with computed backoff, or dead-letters at `maxAttempts`; a `running` job past its lease is reclaimed and its abandoned run recorded; `runDue(now)` drains synchronously and returns a processed/succeeded/failed count; `start()`/`stop()` are inert unless called; all new async audit actions build without a TypeScript error
- non-goals: no handler implementations; no route, composition-root, or web code; no timer started anywhere; no notification, webhook, or standing-order logic
- upstream inputs: `P1` -> `030` change set -> table/column/trigger names; `P2` -> contracts change set -> `JobStatus`, `JobKind`, queue constants
- changes:
  - `jobRules.ts`: pure `nextBackoffMs(attempts)`, `isLeaseExpired(leaseExpiresAt, now)`, `classifyAttemptOutcome({ attempts, maxAttempts, failed })` returning `'retry' | 'dead' | 'succeeded'`
  - `jobRepository.ts`: `insertOrGetByDedupeKey`, `selectDue(now, limit)`, `claim(jobId, now, leaseExpiresAt)` as a CAS `UPDATE ... WHERE id = ? AND status IN ('pending','running') AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`, `settleSucceeded`, `settleRetry`, `settleDead`, `appendAttempt`, `list(query)`, `get(jobId)`
  - `jobHandlerRegistry.ts`: `JobHandler { kind: JobKind; handle(payload: unknown, ctx: JobHandlerContext): Promise<JobHandlerResult> }`, `JobHandlerResult = { outcome: 'succeeded' } | { outcome: 'failed'; error: string }`, `createJobHandlerRegistry(handlers)` with duplicate-kind rejection and unknown-kind resolution failure
  - `faultInjection.ts`: `FaultSwitch { isEnabled(key: string): boolean }`, frozen `ASYNC_FAULT_KEYS` = `async.job_handler_failure`, `async.notification_delivery_failure`, `async.webhook_processing_failure`, `async.standing_order_run_failure`, and `noFaults` no-op switch for tests
  - `jobService.ts`: `enqueue`, `claimDue`, `settle`, `retryDead(jobId, idempotencyKey, context)`, `list`, `get`; each mutation inside `unitOfWork.run` with an audit append
  - `jobRunner.ts`: `createJobRunner({ jobs, registry, clock, intervalMs, batchSize })` -> `runDue(now)` claims a batch, awaits each handler outside any transaction, settles each inside one, and never throws out of the loop; `start()` schedules an `unref`ed interval; `stop()` clears it and is safe to call twice
  - `features/audit/auditEvent.ts`: add all async actions (`job.enqueued`, `job.succeeded`, `job.retry_scheduled`, `job.dead_lettered`, `job.reclaimed`, `job.retried_by_admin`, `notification.created`, `notification.delivered`, `notification.delivery_skipped`, `notification.read`, `webhook.captured`, `webhook.processed`, `webhook.ignored_stale`, `webhook.rejected`, `standing_order.created`, `standing_order.updated`, `standing_order.deleted`, `standing_order.run_started`, `standing_order.run_completed`, `standing_order.run_failed`) plus entity types `job`, `notification`, `webhook`, `standing_order`, wiring each through `AUDIT_ACTIONS`, the `AuditEventInput` union, and the `buildAuditEvent` switch
  - unit tests `apps/api/src/features/jobs/jobRules.test.ts` and `jobHandlerRegistry.test.ts`: backoff doubling, cap clamp, attempt classification at exactly `maxAttempts - 1` and `maxAttempts`, lease expiry at exactly `now`, duplicate-kind rejection
  - integration test `apps/api/test/jobs/jobService.integration.test.ts`: enqueue dedupe returns the same row; claim excludes future `run_at`; a failing handler reschedules with the expected `run_at` then dead-letters on the final attempt; a stale-lease job is reclaimed and records an `abandoned` attempt; `job_attempts` rows are immutable
- invariants: no handler effect runs inside a transaction; no `Date.now()` — time comes from the injected clock; audit vocabulary additions are additive; `job_attempts` never updated or deleted; an unknown job kind fails the job rather than throwing out of `runDue`
- relevant evidence: `E-P1`, `E-P2`
- test duty: run `E-P3a` and `E-P3b` at packet completion
- verification: both evidence entries pass; `npm run typecheck -w @shop/api` clean
- handoff: `JobHandler`, `JobHandlerContext`, `JobHandlerResult`, `createJobHandlerRegistry`, `JobService`, `createJobRunner`, `FaultSwitch`, `ASYNC_FAULT_KEYS`, async audit action names -> `P4`, `P5`, `P6`, `P7`, `P8`
- review: `R3` -> `GR3` blocks `P4`, `P5`, `P6`

### P4: Notification domain and preference-gated delivery

- mode: sequential after `GR3`
- depends on: `P1`, `P2`, `P3`, `GR3`
- owns: `apps/api/src/features/notifications/**`, `apps/api/test/notifications/notificationService.integration.test.ts`
- reads: `apps/api/src/features/preferences/preferencesService.ts` -> `PreferencesService.get`, `DEFAULT_PREFERENCES` -> gate input, including the no-row default path; `apps/api/src/features/mailbox/mailboxRepository.ts` -> `add` -> delivery sink signature; `apps/api/src/features/savedLists/savedListService.ts` -> owner checks and `SavedListResult` usage -> ownership and result-union pattern; `apps/api/src/features/savedLists/savedListErrors.ts` -> `SavedListResult`, `savedListOk`, `savedListError` -> error-module pattern to mirror; `apps/api/src/features/jobs/jobHandlerRegistry.ts` (from `P3`) -> `JobHandler` -> handler contract
- acceptance: `notify` writes exactly one notification row per unique `dedupe_key` and enqueues one `notification.deliver` job; the delivery handler writes a mailbox message only when the preference gate allows, and records `notification.delivery_skipped` otherwise; `list` is owner-scoped and paginated newest-first; `markRead` is idempotent; `markAllRead` returns the affected count; the `async.notification_delivery_failure` fault forces a handler failure that then retries under normal backoff
- non-goals: no route or web code; no change to existing mailbox callers in `checkoutFinalizer` or `approvalService`; no notification for anonymous checkout; no back-in-stock kind
- upstream inputs: `P1` -> `notifications` table; `P2` -> `Notification`, `NotificationKind`, `NotificationPage`; `P3` -> `JobHandler`, `JobService.enqueue`, `FaultSwitch`, audit actions
- changes:
  - `notificationErrors.ts`: `NotificationResult<T>` union with codes `NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`
  - `notificationRules.ts`: pure `shouldEmailNotification(kind, preferences)` mapping each `NotificationKind` to its governing preference key; pure `notificationDedupeKey(kind, entityType, entityId)`
  - `notificationRepository.ts`: `insertIfAbsent`, `list({ userId, status, page, pageSize })`, `count`, `get`, `markRead`, `markAllRead`, `countUnread`
  - `notificationService.ts`: `notify({ userId, kind, title, body, entityType, entityId, context })` -> insert + enqueue in one `unitOfWork.run`; `list`, `markRead`, `markAllRead`, `unreadCount`, all owner-scoped with audit appends
  - `notificationDeliveryHandler.ts`: `createNotificationDeliveryHandler({ notifications, preferences, mailbox, users, clock, faults })` -> loads the notification, resolves the recipient email, consults `shouldEmailNotification`, writes the mailbox row with `kind = 'notification'`, appends `notification.delivered` or `notification.delivery_skipped`; returns `failed` when `async.notification_delivery_failure` is enabled
  - unit test `notificationRules.test.ts`: every `NotificationKind` maps to a preference; defaults allow order kinds and suppress marketing; unknown kind is a type error, not a silent allow
  - integration test: duplicate `notify` with the same dedupe key inserts once and enqueues once; delivery with `orderUpdatesEmail = false` writes no mailbox row but records the skip; a user with no preferences row receives mail under defaults; `markRead` twice returns the same state; another user's notification is `FORBIDDEN`
- invariants: in-app row always written, only email gated; anonymous (`userId === null`) never produces a notification; delivery handler performs no cross-user read; mailbox body never contains payment or session secrets
- relevant evidence: `E-P1`, `E-P2`, `E-P3a`, `E-P3b`
- test duty: run `E-P4a` and `E-P4b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/api` clean
- handoff: `NotificationService.notify` signature, `NotificationKind` usage, delivery handler factory -> `P5`, `P6`, `P7`
- review: `R4` -> `GR4` blocks `P5`, `P6`

### P5: Captured payment webhooks

- mode: parallel with `P6` after `GR4`
- depends on: `P1`, `P2`, `P3`, `P4`, `GR4`
- owns: `apps/api/src/features/webhooks/**`, `apps/api/test/webhooks/webhookService.integration.test.ts`
- reads: `apps/api/src/features/payments/paymentRepository.ts` -> `transition`, `IntentPaymentStatus`, `load` -> CAS semantics and the status machine a webhook may advance; `apps/api/src/features/inventory/inventoryRepository.ts` -> `inventory_receipts` idempotency + fingerprint + replay columns -> capture-and-replay precedent; `apps/api/src/features/orders/orderService.ts` -> `OrderService.get` -> order lookup for the notification payload; `apps/api/src/features/jobs/jobHandlerRegistry.ts` (from `P3`) -> `JobHandler`; `apps/api/src/features/notifications/notificationService.ts` (from `P4`) -> `notify`
- acceptance: `capture` verifies the signature, stores the raw payload with a fingerprint, and enqueues one `webhook.process` job; a repeat delivery of the same `event_id` stores nothing new, enqueues nothing, and reports a replay; a webhook whose CAS expectation no longer holds records `ignored_stale` and the job succeeds; a bad signature is rejected without a stored row; the `async.webhook_processing_failure` fault forces a retry path
- non-goals: no route file (owned by `P8`); no outbound HTTP; no change to `checkoutService` or the payment status machine; no webhook source other than `simulated_payments`
- upstream inputs: `P1` -> `captured_webhooks` table; `P2` -> `PaymentWebhookBody`, `PaymentWebhookEventType`, admin webhook schemas; `P3` -> `JobHandler`, `JobService.enqueue`, `FaultSwitch`; `P4` -> `NotificationService.notify`
- changes:
  - `webhookRules.ts`: pure `verifySignature(rawBody, header, secret)` using HMAC-SHA256 and `crypto.timingSafeEqual` with a length guard; pure `webhookFingerprint(body)` over key-sorted JSON; pure `mapEventToTransition(eventType)` -> `{ expectedStatus, nextStatus, failureReason? } | null`
  - `webhookRepository.ts`: `captureIfAbsent(row)` via `INSERT ... ON CONFLICT(event_id) DO NOTHING`, `getByEventId`, `markProcessed`, `markIgnoredStale`, `markRejected`, `list(query)`, `get`
  - `webhookService.ts`: `capture({ rawBody, signatureHeader, body, context })` -> verify -> `captureIfAbsent` -> enqueue -> return `{ captured: true, webhook } | { captured: false, webhook }` or a `SIGNATURE_INVALID` result; `list`/`get` for admin
  - `webhookProcessingHandler.ts`: `createWebhookProcessingHandler({ webhooks, payments, orders, notifications, clock, faults })` -> resolve the payment by `idempotencyKey`, apply `mapEventToTransition` through `paymentRepository.transition`, record `processed` or `ignored_stale`, and on a settling event call `notifications.notify` with kind `payment.webhook_settled` scoped to the order owner
  - `webhookErrors.ts`: result union with `SIGNATURE_INVALID`, `UNKNOWN_EVENT_TYPE`, `PAYMENT_NOT_FOUND`
  - unit test `webhookRules.test.ts`: signature match and mismatch, wrong-length header rejected without throwing, fingerprint stable under key reordering, unknown event type maps to `null`
  - integration test: same `event_id` delivered twice captures once; two events delivered out of order leave the payment in the correct terminal state and mark the stale one `ignored_stale`; an unknown `idempotencyKey` records `rejected`; a settling event produces exactly one notification for the order owner and none for anyone else
- invariants: capture never depends on processing success; processing never asserts current payment status; no webhook path writes money amounts or inventory; secret never logged or echoed in a response; anonymous-order webhooks settle without a notification
- relevant evidence: `E-P1`, `E-P2`, `E-P3a`, `E-P3b`, `E-P4a`, `E-P4b`
- test duty: run `E-P5a` and `E-P5b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/api` clean
- handoff: `WebhookService.capture` signature, handler factory, `SHOP_WEBHOOK_SECRET` requirement -> `P7`, `P8`
- review: `R5` -> `GR5` blocks `G2`

### P6: Standing order domain and run handler

- mode: parallel with `P5` after `GR4`
- depends on: `P1`, `P2`, `P3`, `P4`, `GR4`
- owns: `apps/api/src/features/standingOrders/**`, `apps/api/test/standingOrders/standingOrderService.integration.test.ts`
- reads: `apps/api/src/features/savedLists/savedListService.ts` -> `addToCart(userId, listId, cartId, context)` and its outcome shape -> the exact call a saved-list-sourced run makes; `apps/api/src/features/reorder/reorderService.ts` -> `reorder({ orderId, userId, cartId, context })`, `ReorderReport` -> the exact call an order-sourced run makes; `apps/api/src/features/cart/cartService.ts` -> `CartService.create`, `BulkAddRejection` -> cart creation and the `CART_RESERVED` rejection; `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BULK_ADD_SKIP_REASONS` -> the shared skip vocabulary that must not be forked; `apps/api/src/features/savedLists/savedListErrors.ts` -> result-union pattern; `apps/api/src/features/jobs/jobHandlerRegistry.ts` (from `P3`); `apps/api/src/features/notifications/notificationService.ts` (from `P4`)
- acceptance: create/update/delete are owner-scoped and audited; `nextRunAt` advances deterministically per cadence from the injected clock; `enqueueDue(now)` enqueues one `standing_order.run` job per due active schedule with a dedupe key covering `(standingOrderId, scheduledRunAt)`; a run creates a cart, drives the source-appropriate service, persists a `standing_order_runs` row with per-line outcomes, advances `next_run_at`, and emits one notification; a reserved cart fails the run with `CART_RESERVED` and leaves `next_run_at` unchanged for retry; the `async.standing_order_run_failure` fault forces the failure path
- non-goals: no checkout, payment, delivery-slot, or approval interaction; no Custom Blend configuration in a schedule; no route file (owned by `P7`); no cron expressions or timezone handling
- upstream inputs: `P1` -> `standing_orders`, `standing_order_runs`; `P2` -> `StandingOrder`, `StandingOrderRun`, `StandingOrderCadence`, `StandingOrderLineOutcome`; `P3` -> `JobHandler`, `JobService.enqueue`, `FaultSwitch`; `P4` -> `NotificationService.notify`
- changes:
  - `standingOrderRules.ts`: pure `nextRunAt(cadence, from)` with weekly/fortnightly day arithmetic and month-end clamping for monthly; pure `validateStandingOrderInput`; pure `summariseOutcomes(outcomes)` -> `{ addedLineCount, skippedLineCount }`; pure `runDedupeKey(standingOrderId, scheduledRunAt)`
  - `standingOrderRepository.ts`: `create`, `listForUser`, `get`, `update`, `delete`, `selectDue(now, limit)`, `insertRun`, `completeRun`, `failRun`, `listRuns(standingOrderId, limit)`
  - `standingOrderService.ts`: owner-scoped CRUD returning a result union (`NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`, `SOURCE_NOT_FOUND`, `LIMIT_REACHED`), plus `runNow(userId, standingOrderId, context)` and `enqueueDue(now)`; source existence and ownership validated at create time against saved lists and owned orders
  - `standingOrderRunHandler.ts`: `createStandingOrderRunHandler({ standingOrders, savedLists, reorder, carts, notifications, clock, faults })` -> insert a pending run -> create a cart -> dispatch by `source_kind` -> map outcomes into `StandingOrderLineOutcome[]` -> complete or fail the run -> advance `next_run_at` only on completion -> notify with kind `standing_order.run_completed` or `standing_order.run_failed`
  - unit test `standingOrderRules.test.ts`: weekly/fortnightly advance across a month boundary; monthly clamp from the 31st into a 30-day and a February month; dedupe key stability; outcome summary counts on a mixed added/skipped set
  - integration test: a saved-list schedule run produces the same mixed outcomes the list itself produces; an order-sourced run reports price drift from `reorderService` unchanged; a reserved cart fails the run and leaves `next_run_at` untouched; a run for a deleted source is `SOURCE_NOT_FOUND` and fails cleanly; another user's schedule is `FORBIDDEN`; `enqueueDue` called twice for the same due schedule enqueues one job
- invariants: never forks `cartBulkAddRules` skip precedence or invents a parallel reason vocabulary; partial line success is a domain outcome, never rolled back; run history is per-schedule and owner-scoped; `next_run_at` advances only on a completed run so a transient failure cannot silently skip a cycle
- relevant evidence: `E-P1`, `E-P2`, `E-P3a`, `E-P3b`, `E-P4a`, `E-P4b`
- test duty: run `E-P6a` and `E-P6b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/api` clean
- handoff: `StandingOrderService` signature, run handler factory -> `P7`
- review: `R6` -> `GR6` blocks `G2`

### P7: Runtime host, buyer routes, queue lifecycle

- mode: sequential after `G2`
- depends on: `P3`, `P4`, `P5`, `P6`, `G2`
- owns: `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/config.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/routes/standingOrders.ts`, `apps/api/test/notifications/notificationRoutes.integration.test.ts`, `apps/api/test/standingOrders/standingOrderRoutes.integration.test.ts`
- reads: `apps/api/src/app.ts` -> `AppDependencies`, `AppServices`, `createAppServices`, `buildApp`, the `featureFlags` construction at the resolver site -> exact wiring points; `apps/api/src/server.ts` -> `startServer`, the `close` closure -> the only shutdown seam; `apps/api/src/routes/savedLists.ts` -> `SAVED_LIST_ERROR_MESSAGES`, `SAVED_LIST_ERROR_STATUS`, `sendSavedListError`, `requireAuth` usage -> route error-mapping pattern to mirror; `apps/api/src/config.ts` -> `loadConfig`, validation style -> where `SHOP_WEBHOOK_SECRET` is added; `apps/api/test/savedLists/savedListRoutes.integration.test.ts` -> temp-DB harness and `app.inject` idiom
- acceptance: the four domain services and the feature-flag resolver appear in `AppServices`; the handler registry is built once with all three handlers; `buildApp` starts no timer, so every existing integration test still exits; `startServer` starts the runner and its `close` closure stops it before `app.close()`; all nine buyer endpoints enforce auth and ownership and return the documented status codes; `loadConfig` exposes a validated `webhookSecret` with a documented local default
- non-goals: no webhook or admin route file (owned by `P8`); no web code; no seed change; no new domain rules
- upstream inputs: `P3` -> `JobService`, `createJobRunner`, `createJobHandlerRegistry`, `FaultSwitch`; `P4` -> `NotificationService`, delivery handler factory; `P5` -> `WebhookService`, processing handler factory; `P6` -> `StandingOrderService`, run handler factory
- changes:
  - extract the feature-flag resolver in `createAppServices` into a named local, pass it to `createFeatureFlagService` as today, and expose it on `AppServices` as `featureFlagResolver: FeatureFlagResolver`; pass it as the `faults` dependency to all three handlers
  - construct `notifications`, `webhooks`, `standingOrders`, `jobs` services and add them to `AppServices`; build the handler registry and the job runner, exposing `jobRunner` on `AppServices` for the admin drain route
  - add `webhookSecret` to `ApiConfig` and `loadConfig` (`SHOP_WEBHOOK_SECRET`, documented local default, non-empty validation), and thread it into `buildApp` through `AppDependencies`
  - `server.ts`: call `jobRunner.start()` after `buildApp`; call `jobRunner.stop()` first inside the existing `close` closure
  - `routes/notifications.ts`: `GET /api/notifications` (query validated, owner-scoped, paginated), `POST /api/notifications/:notificationId/read`, `POST /api/notifications/read-all`; frozen message/status tables per the `savedLists` route pattern
  - `routes/standingOrders.ts`: the six standing-order endpoints plus `run-now`, all `requireAuth`, all mapping the service result union to `400`/`403`/`404`/`409`
  - register both plugins in `buildApp` alongside the existing `app.register` calls
  - integration tests: unauthenticated request rejected on every endpoint; another user's notification and schedule both `404`/`403` per the mapping; pagination bounds clamped; `read-all` returns the affected count; `run-now` enqueues exactly one job and returns a pending run; creating a schedule over a saved list the caller does not own is rejected
- invariants: `buildApp` performs no listen, seed, migration, or timer start; no mutable module-global state; route layer stays thin — no business rule moves into it; existing 34 route registrations and service slots unchanged in behavior
- relevant evidence: `E-P3b`, `E-P4b`, `E-P5b`, `E-P6b`
- test duty: run `E-P7a`, `E-P7b`, and `E-P7c` at packet completion
- verification: all three pass; `E-P7c` (full `@shop/api` suite) confirms no existing integration test hangs or regresses
- handoff: `AppServices` additions, `jobRunner` slot, `config.webhookSecret` -> `P8`, `P9`, `S1`
- review: `R7` -> `GR7` blocks `P8`

### P8: Webhook intake and admin async routes

- mode: sequential after `GR7`
- depends on: `P5`, `P7`, `GR7`
- owns: `apps/api/src/routes/webhooks.ts`, `apps/api/src/routes/adminJobs.ts`, `apps/api/src/routes/adminWebhooks.ts`, `apps/api/test/webhooks/webhookRoutes.integration.test.ts`, `apps/api/test/adminAsync.integration.test.ts`
- reads: `apps/api/src/app.ts` (as left by `P7`) -> `AppServices`, the registration block -> where three more plugins attach; `apps/api/src/routes/adminFeatureFlags.ts` -> `requireAdmin` hook usage and error mapping -> admin route pattern to mirror; `apps/api/src/routes/adminOrdersList.ts` -> pagination and filter query handling -> admin list pattern; `apps/api/src/routes/adminRefunds.ts` -> idempotency-key body handling -> retry-route precedent; `apps/api/src/features/webhooks/webhookService.ts` (from `P5`) -> `capture` signature and raw-body need
- acceptance: `POST /api/webhooks/payments` returns `202` on first capture and on replay, `401` on bad signature, and `400` on a malformed body; raw body is available for signature verification without breaking JSON schema validation; all admin endpoints require the `admin` role; `POST /api/admin/jobs/:jobId/retry` is idempotency-keyed and audited; `POST /api/admin/jobs/run` drains synchronously and returns counts
- non-goals: no domain logic; no web code; no change to files owned by `P7` beyond the registration lines
- upstream inputs: `P5` -> `WebhookService`; `P7` -> `AppServices` slots including `jobRunner` and `config.webhookSecret`
- changes:
  - `routes/webhooks.ts`: register a scoped raw-body capture (content-type parser or `preValidation` buffer) limited to this route so no other route's parsing changes; verify the signature through `webhookService.capture`; always answer `202` with `PaymentWebhookAck` once captured
  - `routes/adminJobs.ts`: list with `status`/`kind` filters and pagination, detail with attempts, retry with `idempotencyKey`, drain trigger calling `jobRunner.runDue(clock.now())`
  - `routes/adminWebhooks.ts`: list with `status` filter and pagination, detail including the stored payload
  - register the three plugins in `buildApp`
  - integration tests: duplicate delivery returns `202` twice and captures once; tampered payload with a stale signature is `401` and stores nothing; a non-admin session gets `403` on every admin endpoint; a repeated retry with the same idempotency key does not double-enqueue; drain returns accurate counts and is safe when the queue is empty
- invariants: raw-body handling is route-scoped, never global; unauthenticated webhook route performs no user lookup and leaks no account existence; every admin mutation writes an audit event; `app.ts` edits are limited to import and registration lines, and `P8` is the only writer of `app.ts` in this window
- relevant evidence: `E-P5b`, `E-P7c`
- test duty: run `E-P8a` and `E-P8b` at packet completion
- verification: both pass
- handoff: endpoint paths and status mapping -> `P12`, `S1`
- review: `R8` -> `GR8` blocks `P9`

### P9: Seed fixtures and reset coverage

- mode: sequential after `GR8`
- depends on: `P1`, `P4`, `P5`, `P6`, `P7`, `GR8`
- owns: `apps/api/src/db/seedAsyncScenarios.ts`, `apps/api/src/db/seed.ts`, `apps/api/src/db/reset.ts`, `apps/api/test/db/asyncSeed.integration.test.ts`
- reads: `apps/api/src/db/savedListSeed.ts` -> `SEED_INSTANT`, `findRestockFixtureId`, deliberately mixed-outcome fixture authoring -> the convention to copy; `apps/api/src/db/orderSeedScenarios.ts` -> `DEMO_ORDER_SCENARIO_KEYS`, declarative `SCENARIOS` -> scenario-authoring convention; `apps/api/src/db/seed.ts` -> the tail of the transaction where domain seeds are called, and the feature-flag upsert block -> registration point and flag-seed idiom; `apps/api/src/db/reset.ts` -> `resetDatabase`, the documented FK-safe delete order and trigger drop/recreate block -> where new tables and the `job_attempts` triggers must be handled
- acceptance: `npm run seed` twice leaves identical row counts; `npm run reset` clears all six new tables and restores the `job_attempts` triggers; four `async.*` fault flags seed disabled; Alice owns one weekly standing order over `Monthly restock` whose next run is due and one unread notification; one captured webhook fixture exists in `processed` state and one in `ignored_stale`; one job fixture sits in `dead` for the admin retry demo
- non-goals: no domain, route, or web code; no new migration; no fixture that depends on wall-clock time
- upstream inputs: `P1` -> table names; `P4`/`P5`/`P6` -> row semantics; `P7` -> `AppServices` (unused here, but flag keys come from `ASYNC_FAULT_KEYS`)
- changes:
  - `seedAsyncScenarios.ts`: `export function seedAsyncScenarios(db): void` with a frozen `SEED_INSTANT`, natural-key fixture lookup so buyer-created rows are never mistaken for seed rows, and explicit inline comments naming each fixture's intended demo outcome
  - upsert the four `async.*` flags disabled in `seed.ts` beside the existing `admin.example_flag` block, with a fixed `updated_at`
  - call `seedAsyncScenarios(db)` from the tail of the `seed.ts` transaction, after `seedSavedLists` and `seedOrderScenarios` so both sources exist
  - extend `reset.ts`: drop and recreate the `job_attempts` triggers in the existing trigger block, and add the six tables to the documented FK-safe delete order (children before parents: `standing_order_runs`, `standing_orders`, `captured_webhooks`, `notifications`, `job_attempts`, `jobs`)
  - integration test: seed twice -> stable counts scoped to fixture-owned identifiers; reset -> all six tables empty and both triggers present; the seeded standing order is due against the seeded clock; the seeded dead job is retryable
- invariants: seed stays idempotent and preserves non-seed rows; no `Date.now()` or bare `new Date()`; assertions throw with a `Seed assertion failed:` prefix on missing prerequisites; reset continues to omit `audit_events`
- relevant evidence: `E-P7c`, `E-P8b`
- test duty: run `E-P9a` and `E-P9b` at packet completion
- verification: both pass
- handoff: fixture identities and flag keys -> `P12`, `S1`
- review: `R9` -> `GR9` blocks `G3`

### P10: Web notifications inbox

- mode: parallel with `P11`, `P12`, and the API chain after `G1`
- depends on: `P2`, `G1`
- owns: `apps/web/src/api/notifications.ts`, `apps/web/src/hooks/NotificationsContext.tsx`, `apps/web/src/hooks/useNotifications.ts`, `apps/web/src/features/notifications/**`
- reads: `apps/web/src/hooks/SavedListsContext.tsx` -> provider, `use*Context` throw guard, error-code message table, `mountedRef` and serialized mutation queue -> the state pattern to copy; `apps/web/src/api/savedLists.ts` -> one thin arrow export per endpoint, `body satisfies XBody` -> client pattern; `apps/web/src/api/client.ts` -> `apiFetch`, `ApiError`, `ApiContractError` -> transport contract; `apps/web/src/features/admin/orders/AdminOrdersPage.tsx` -> monotonic request-version guard -> stale-response idiom; `apps/web/src/features/savedLists/SavedListsJourney.integration.test.tsx` -> `vi.mock` of `@/api/*` and `@/hooks/AuthContext`, `MemoryRouter` harness -> test idiom
- acceptance: inbox renders loading, empty, error-with-retry, and populated states; unread count is derived from server data and refreshes after mark-read; mark-read and mark-all-read apply optimistically and roll back to the last confirmed server snapshot on failure; a stale in-flight list response never overwrites a newer one; the bell component exposes an accessible unread label; all state clears on logout
- non-goals: no edit to `App.tsx`, `Layout.tsx`, or `Header.tsx` (owned by `S1`); no polling loop; no push transport; no admin UI
- upstream inputs: `P2` -> `Notification`, `NotificationPage`, `NotificationListQuery`
- changes:
  - `api/notifications.ts`: `getNotifications(query, signal?)`, `markNotificationRead(id)`, `markAllNotificationsRead()`, each schema-validated through `apiFetch`
  - `hooks/NotificationsContext.tsx`: `NotificationsProvider` + `useNotificationsContext` with a throw guard; value exposes `notifications`, `unreadCount`, `loading`, `error`, `refresh`, `markRead`, `markAllRead`; mutators return `T | false` and never throw; gated on `useAuth()`
  - `hooks/useNotifications.ts`: re-export alias, mirroring `useSavedLists.ts`
  - `features/notifications/NotificationsPage.tsx`, `NotificationList.tsx`, `NotificationBell.tsx`, `notificationsPresentation.ts` (pure kind -> label/icon mapping)
  - tests: `notificationsPresentation.test.ts` (every `NotificationKind` maps to a label); `NotificationsPage.test.tsx` (loading, empty, error retry, mark-read); `NotificationsInboxJourney.integration.test.tsx` (mocked API, real provider, `MemoryRouter`, stale-response guard, mark-all-read, logout clears)
- invariants: server is the authority for read state and counts; no business rule duplicated client-side; async work ignores or aborts stale completion; no payment or session data enters browser storage
- relevant evidence: `E-P2`
- test duty: run `E-P10a` and `E-P10b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/web` clean
- handoff: `NotificationsProvider`, `NotificationBell`, `NotificationsPage` -> `S1`
- review: `R10` -> `GR10` blocks `G3`

### P11: Web standing orders

- mode: parallel with `P10`, `P12`, and the API chain after `G1`
- depends on: `P2`, `G1`
- owns: `apps/web/src/api/standingOrders.ts`, `apps/web/src/features/standingOrders/**`
- reads: `apps/web/src/features/savedLists/SavedListDetailPage.tsx` -> page composition, loading/empty/error convention, outcome rendering -> pattern to copy; `apps/web/src/features/savedLists/SavedListOutcomeList.tsx` -> per-line outcome presentation including skip reasons -> reuse the same vocabulary and phrasing; `apps/web/src/api/savedLists.ts` -> client pattern; `apps/web/src/features/admin/orders/AdminOrdersPage.tsx` -> request-version guard; `apps/web/src/features/savedLists/SavedListsJourney.integration.test.tsx` -> test idiom
- acceptance: page lists schedules with cadence, next run, and active state; create flow picks a saved list or an owned past order; edit changes cadence and pause state; run-now disables while in flight and surfaces the resulting run; run history renders per-line added and skipped outcomes using the shared skip-reason phrasing; every server error code maps to a specific message, never a generic failure
- non-goals: no edit to `App.tsx` or `AccountPage.tsx` (owned by `S1`); no cadence arithmetic client-side — `nextRunAt` is displayed as returned; no checkout entry from this page beyond a link to the cart
- upstream inputs: `P2` -> `StandingOrder`, `StandingOrderRun`, `StandingOrderLineOutcome`, `CreateStandingOrderBody`, `UpdateStandingOrderBody`
- changes:
  - `api/standingOrders.ts`: list, create, update, delete, listRuns, runNow — schema-validated
  - `features/standingOrders/StandingOrdersPage.tsx`, `StandingOrderForm.tsx`, `StandingOrderRunHistory.tsx`, `standingOrdersPresentation.ts` (pure cadence label, next-run formatting, outcome summary phrasing)
  - tests: `standingOrdersPresentation.test.ts` (every cadence and every skip reason maps to copy); `StandingOrdersPage.test.tsx` (loading, empty, error retry, pause toggle); `StandingOrdersJourney.integration.test.tsx` (mocked API, create from saved list, run-now producing a mixed added/skipped run, stale-response guard)
- invariants: no client-side scheduling maths; skip reasons reuse the shared vocabulary rather than a parallel one; server owns ownership and limits; async work ignores stale completion
- relevant evidence: `E-P2`
- test duty: run `E-P11a` and `E-P11b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/web` clean
- handoff: `StandingOrdersPage` -> `S1`
- review: `R11` -> `GR11` blocks `G3`

### P12: Web admin job and webhook inspectors

- mode: parallel with `P10`, `P11`, and the API chain after `G1`
- depends on: `P2`, `G1`
- owns: `apps/web/src/api/adminJobs.ts`, `apps/web/src/api/adminWebhooks.ts`, `apps/web/src/features/admin/jobs/**`, `apps/web/src/features/admin/webhooks/**`
- reads: `apps/web/src/features/admin/reviews/AdminReviewModerationPage.tsx` -> `useSearchParams` URL state, `PAGE_SIZE`, query sanitizers, page clamp, focus restoration, `AbortController` cleanup -> the pagination pattern to copy; `apps/web/src/features/admin/featureFlags/AdminFeatureFlagsPage.tsx` -> admin CRUD page and request-version guard -> pattern to copy; `apps/web/src/api/adminReviews.ts` -> `signal?` threading -> client pattern; `apps/web/src/features/admin/featureFlags/index.ts` -> barrel convention
- acceptance: job list filters by status and kind with URL-backed pagination; job detail shows the attempt ledger with error text; retry is idempotency-keyed and disabled while in flight; drain reports its counts; webhook list filters by status and detail shows the captured payload; both pages restore focus after reload exactly as the review queue does
- non-goals: no edit to `AdminNav.tsx`, `AdminIndexPage.tsx`, or `App.tsx` (owned by `S1`); no fault-flag UI — faults are toggled through the existing `/admin/feature-flags` page; no live polling
- upstream inputs: `P2` -> `AdminJob`, `AdminJobDetail`, `AdminJobPage`, `AdminJobRetryBody`, `AdminJobDrainResponse`, `AdminCapturedWebhook`, `AdminCapturedWebhookPage`
- changes:
  - `api/adminJobs.ts`, `api/adminWebhooks.ts`: one arrow export per endpoint with `signal?` threading
  - `features/admin/jobs/AdminJobsPage.tsx`, `AdminJobDetailPage.tsx`, `index.ts`; `features/admin/webhooks/AdminWebhooksPage.tsx`, `AdminWebhookDetailPage.tsx`, `index.ts`
  - tests: `AdminJobsPage.test.tsx` (filter, pagination clamp, retry disabled in flight, drain counts); `AdminWebhooksPage.test.tsx` (status filter, payload rendering); one `AdminAsyncJourney.integration.test.tsx` covering retry of a dead job and its list refresh
- invariants: read-only except retry and drain; both mutations confirm server response before refreshing; aborted requests never set state; no secret or raw signature rendered in the payload view
- relevant evidence: `E-P2`
- test duty: run `E-P12a` and `E-P12b` at packet completion
- verification: both pass; `npm run typecheck -w @shop/web` clean
- handoff: page components and their intended admin paths -> `S1`
- review: `R12` -> `GR12` blocks `G3`

### S1: Convergence — composition, docs, cross-lane verification

- mode: sequential after `G3`
- depends on: `P9`, `P10`, `P11`, `P12`, `G3`
- owns: `apps/web/src/App.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/features/admin/AdminNav.tsx`, `apps/web/src/features/admin/AdminIndexPage.tsx`, `apps/web/src/features/account/AccountPage.tsx`, `README.md`, `AGENTS.md`, `plans/demo_project_high_level_plan.md`, `apps/web/src/features/notifications/AsyncComposition.integration.test.tsx`
- reads: `apps/web/src/App.tsx` -> `App`, the `<Routes>` tree and the `/admin` nested block -> exact insertion points; `apps/web/src/components/Layout.tsx` -> the provider nesting order -> where `NotificationsProvider` sits (inside `AuthProvider`, beside `SavedListsProvider`); `apps/web/src/components/Header.tsx` -> the customer-tools `role="group"` -> where the bell attaches; `apps/web/src/features/admin/AdminNav.tsx` and `AdminIndexPage.tsx` -> the two duplicated `sections` lists -> both must be edited; `apps/web/src/features/account/AccountPage.tsx` -> the hardcoded section fragment -> where the standing-orders entry link attaches; `plans/demo_project_high_level_plan.md` -> item `8`, `Current Baseline`, `LOC Target` -> the sections to update
- acceptance: `/notifications`, `/account/standing-orders`, `/admin/jobs`, `/admin/jobs/:jobId`, `/admin/webhooks`, `/admin/webhooks/:webhookId` all resolve with the correct guard; the bell renders in the header for an authenticated buyer and is absent for a guest; both admin `sections` lists include the two new entries; `AccountPage` links to standing orders; README documents the webhook secret default, the `curl`-free way to trigger a simulated webhook, the four fault flags, and the admin drain control; `AGENTS.md` repository map names the four new domains; the high-level plan marks item `8` complete with migration `030` and refreshed LOC figures
- non-goals: no new domain, route, or feature behavior; no change to files owned by earlier packets except the named composition files; no browser or screenshot verification at this gate
- upstream inputs: `P9` -> seed fixtures and flag keys; `P10` -> `NotificationsProvider`, `NotificationBell`, `NotificationsPage`; `P11` -> `StandingOrdersPage`; `P12` -> four admin pages; `P7`/`P8` -> final endpoint paths and guards
- changes:
  - add `NotificationsProvider` to `Layout.tsx` inside `AuthProvider`
  - add the bell to the `Header.tsx` customer-tools group with an accessible label
  - add six `<Route>` entries to `App.tsx`: `/notifications` and `/account/standing-orders` under `ProtectedRoute`; four under the existing `/admin` block
  - add `Jobs` and `Webhooks` to both `AdminNav.tsx` and `AdminIndexPage.tsx` `sections`
  - add the standing-orders entry link to `AccountPage.tsx`
  - `AsyncComposition.integration.test.tsx`: render `App` under `MemoryRouter` with mocked `@/api/*` and auth, asserting guard behavior for guest, buyer, and admin across all six routes
  - update `README.md`, `AGENTS.md` repository map, and the high-level plan (item `8` status, `Current Baseline` implemented list, migration head `030`, `Future Expansion Order` note that item `15` is now unblocked)
  - re-measure and update the `LOC Target` figures using the documented counting rule
- relevant evidence: `E-P7c`, `E-P8b`, `E-P9b`, `E-P10b`, `E-P11b`, `E-P12b`
- test duty: run `E-S1a` (web integration suite) and `E-S1b` (API integration suite) once after composition settles
- verification: both pass; web integration result compared against the `G0` baseline so any pre-existing admin failure is identified rather than attributed to this work; no browser session, screenshot, or manual click-through at this or any gate
- handoff: composition change set and both integration results -> `R13`, `G4`
- review: `R13` -> `GR13` blocks `G4`

## Review Assignments

Every assignment below sets `review_skill=code-reviewer`, directs the reviewer to invoke the `code-reviewer` skill by name through the Skill tool (it carries `disable-model-invocation`), and applies that skill's severity gate (critical + high only) and verification-before-reporting duty. Every assignment is inspect-only. No assignment consolidates targets; each implementation packet gets its own review, because every packet here touches at least one of schema, contracts, transactions, auth, persistence, shared state, or route registration.

### R1: Review `P1`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set for migration `030` and `migrations/index.ts`
- timing: immediately after `P1` reports and `E-P1` lands; before any API domain packet
- blocks: `GR1` -> `P3`, `P4`, `P5`, `P6`, `P9`
- consolidation reason: none
- reads: `apps/api/src/db/migrations/030_async_behavior.ts` -> all DDL -> correctness of CHECK vocabularies, FK actions, indexes, triggers; `apps/api/src/db/migrations/029_saved_lists.ts` -> `assertForeignKeysClean` -> convention conformance; `apps/api/src/db/migrate.ts` -> `migrateDatabase`, `validateMigrations` -> ordering and transaction rules; `apps/api/test/db/asyncSchema.integration.test.ts` -> coverage adequacy
- acceptance: schema matches the plan's Target Design; idempotent; FK-clean; triggers present and effective; version registered last
- invariants: no landed migration edited or renumbered; no `foreign_keys` pragma toggled inside the migration transaction; additive only; `job_attempts` immutable
- risk focus: a CHECK constraint that rejects a legitimate future state; a missing `ON DELETE` action that leaves orphans after account deletion; the `standing_orders` exactly-one-source CHECK admitting both or neither; a missing index behind the `(status, run_at)` claim scan
- non-goals: domain, service, route, seed, or web code
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence is missing or stale and the verdict cannot be reached by inspection
- relevant evidence: `E-P1`
- return: `reviewer_report_v1`

### R2: Review `P2`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P2` -> settled contracts change set
- timing: immediately after `P2` reports and `E-P2` lands; before any consumer
- blocks: `GR2` -> `P3`-`P12`
- consolidation reason: none
- reads: the four new `packages/contracts/src/*.ts` modules -> exported schemas and unions; `packages/contracts/src/index.ts` -> re-export lines; `packages/contracts/package.json` -> `exports` map; `packages/contracts/src/reorder.ts` -> `ReorderLineOutcome` -> confirm the outcome vocabulary is reused, not forked; the four new test files -> coverage adequacy
- acceptance: root and subpath exports resolve; every request body sets `additionalProperties: false`; closed unions are genuinely closed; queue constants exported and consistent with the retry design
- invariants: contracts carry transport only; no landed contract module changed in a breaking way; kebab subpath maps to the correct camelCase dist file
- risk focus: an open-ended `Type.String()` where a closed union is required; a page schema whose `pageSize` is unbounded; a skip-reason vocabulary duplicated instead of reused; a subpath typo that only fails at consumer build time
- non-goals: API or web implementation
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P2`
- return: `reviewer_report_v1`

### R3: Review `P3`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P3` -> settled job engine and audit vocabulary change set
- timing: immediately after `P3` reports and `E-P3a`/`E-P3b` land; before any handler packet
- blocks: `GR3` -> `P4`, `P5`, `P6`
- consolidation reason: none
- reads: `apps/api/src/features/jobs/**` -> all symbols -> engine correctness; `apps/api/src/db/unitOfWork.ts` -> `run` -> confirm no `await` spans a transaction; `apps/api/src/features/payments/paymentRepository.ts` -> `transition` -> compare CAS technique; `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEventInput`, `buildAuditEvent` -> all three sites updated consistently; the two unit test files and the integration test -> coverage adequacy
- acceptance: claim is a genuine CAS; backoff is deterministic and capped; dead-lettering happens exactly at `maxAttempts`; stale leases are reclaimed and recorded; `runDue` never throws out; no timer starts on import or construction
- invariants: no handler effect inside a transaction; time from the injected clock only; `job_attempts` append-only; unknown kind fails the job rather than the loop
- risk focus: a lost update if two claims race the same row; an `await` inside `unitOfWork.run` silently committing early; an attempt row written outside the settle transaction; `stop()` not clearing the interval, leaking a handle into tests; an audit action added to the tuple but missing from the `buildAuditEvent` switch
- non-goals: handler implementations, routes, composition root, web
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P1`, `E-P2`, `E-P3a`, `E-P3b`
- return: `reviewer_report_v1`

### R4: Review `P4`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P4` -> settled notification domain change set
- timing: immediately after `P4` reports and `E-P4a`/`E-P4b` land; before `P5` and `P6`
- blocks: `GR4` -> `P5`, `P6`
- consolidation reason: none
- reads: `apps/api/src/features/notifications/**` -> all symbols; `apps/api/src/features/preferences/preferencesService.ts` -> `get`, `DEFAULT_PREFERENCES` -> gate correctness including the no-row path; `apps/api/src/features/mailbox/mailboxRepository.ts` -> `add` -> delivery correctness; the unit and integration tests -> coverage adequacy
- acceptance: in-app row always written; only email gated; dedupe honoured; owner scoping enforced on every read and mutation; fault flag forces a retryable failure
- invariants: anonymous users produce no notification; no cross-user read; no secret in a mailbox body; audit written per mutation
- risk focus: a preference lookup that writes a row as a side effect; a dedupe key colliding across users; an ownership check performed in the route rather than the service; a delivery failure that marks the notification delivered anyway
- non-goals: routes, web, existing mailbox callers
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P3b`, `E-P4a`, `E-P4b`
- return: `reviewer_report_v1`

### R5: Review `P5`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P5` -> settled webhook domain change set
- timing: immediately after `P5` reports and `E-P5a`/`E-P5b` land; before `G2`
- blocks: `GR5` -> `G2`
- consolidation reason: none
- reads: `apps/api/src/features/webhooks/**` -> all symbols; `apps/api/src/features/payments/paymentRepository.ts` -> `transition`, `IntentPaymentStatus` -> confirm the status machine is respected and never bypassed; the unit and integration tests -> coverage adequacy
- acceptance: capture idempotent on `event_id`; signature verification constant-time with a length guard; out-of-order recorded as `ignored_stale` with a successful job; unknown event and unknown payment handled distinctly
- invariants: capture independent of processing; no direct SQL against `payments` outside the existing repository; no secret logged or echoed; no money or inventory write
- risk focus: `timingSafeEqual` throwing on a length mismatch and turning a bad signature into a 500; a fingerprint that varies with key order and defeats replay detection; a transition applied twice because the CAS result is ignored; a notification emitted for an order the webhook does not own
- non-goals: route file, admin UI, outbound HTTP
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P3b`, `E-P4b`, `E-P5a`, `E-P5b`
- return: `reviewer_report_v1`

### R6: Review `P6`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P6` -> settled standing-order domain change set
- timing: immediately after `P6` reports and `E-P6a`/`E-P6b` land; before `G2`
- blocks: `GR6` -> `G2`
- consolidation reason: none
- reads: `apps/api/src/features/standingOrders/**` -> all symbols; `apps/api/src/features/savedLists/savedListService.ts` -> `addToCart` -> confirm reuse rather than reimplementation; `apps/api/src/features/reorder/reorderService.ts` -> `reorder` -> same; `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BULK_ADD_SKIP_REASONS` -> confirm the shared vocabulary is not forked; the unit and integration tests -> coverage adequacy
- acceptance: cadence arithmetic deterministic including month-end clamping; `enqueueDue` idempotent per due cycle; `next_run_at` advances only on completion; reserved cart fails cleanly; ownership enforced everywhere
- invariants: no checkout, payment, slot, or approval interaction; partial success never rolled back; MOQ and price resolution left entirely to the reused services
- risk focus: a monthly cadence that skips February or drifts earlier each cycle; a due-scan that re-enqueues on every drain because the dedupe key omits the scheduled instant; `next_run_at` advanced before the run completes, silently skipping a cycle; an order-sourced run reachable for an order the caller does not own
- non-goals: routes, web, checkout
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P3b`, `E-P4b`, `E-P6a`, `E-P6b`
- return: `reviewer_report_v1`

### R7: Review `P7`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P7` -> settled composition root, config, buyer routes change set
- timing: immediately after `P7` reports and `E-P7a`/`E-P7b`/`E-P7c` land; before `P8`
- blocks: `GR7` -> `P8`
- consolidation reason: none
- reads: `apps/api/src/app.ts` -> `createAppServices`, `AppServices`, `buildApp` -> wiring correctness and absence of any timer start; `apps/api/src/server.ts` -> `startServer`, `close` -> start/stop symmetry; `apps/api/src/config.ts` -> `loadConfig` -> secret validation and default; `apps/api/src/routes/notifications.ts` and `routes/standingOrders.ts` -> auth gates and error mapping; `apps/api/src/routes/savedLists.ts` -> error-mapping tables -> conformance baseline
- acceptance: resolver exported and injected as `faults`; registry built once with all three handlers; no timer in `buildApp`; runner stopped before `app.close()`; every buyer endpoint auth-gated and owner-scoped with the documented statuses
- invariants: `buildApp` performs no listen, seed, migration, or timer start; no mutable module-global state; routes stay thin; existing registrations unaffected
- risk focus: a runner started in `buildApp` hanging the 66 existing integration tests; a handler registry constructed per request; `stop()` omitted from the `close` closure leaving a live interval on SIGTERM; an ownership check pushed into the route; a `403`-vs-`404` mapping that leaks existence of another user's resource
- non-goals: webhook or admin routes, web, seed
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P7a`, `E-P7b`, `E-P7c`
- return: `reviewer_report_v1`

### R8: Review `P8`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P8` -> settled webhook intake and admin async routes change set
- timing: immediately after `P8` reports and `E-P8a`/`E-P8b` land; before `P9`
- blocks: `GR8` -> `P9`
- consolidation reason: none
- reads: `apps/api/src/routes/webhooks.ts` -> raw-body handling, signature gate, status mapping; `apps/api/src/routes/adminJobs.ts` and `adminWebhooks.ts` -> `requireAdmin` hooks, pagination, idempotency; `apps/api/src/routes/adminFeatureFlags.ts` -> admin route baseline; `apps/api/src/app.ts` -> the registration block -> confirm edits are limited to imports and registration
- acceptance: raw-body capture is route-scoped; `202` on capture and replay; `401` on bad signature with nothing stored; admin endpoints role-gated; retry idempotency-keyed and audited; drain returns accurate counts
- invariants: no global parser change; unauthenticated route leaks no account existence; every admin mutation audited
- risk focus: a content-type parser registered app-wide breaking existing JSON routes; a signature check performed after the body is already persisted; an admin drain that can be invoked concurrently and double-processes a job; pagination parameters passed unsanitised into SQL ordering
- non-goals: domain logic, web, seed
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P7c`, `E-P8a`, `E-P8b`
- return: `reviewer_report_v1`

### R9: Review `P9`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P9` -> settled seed and reset change set
- timing: immediately after `P9` reports and `E-P9a`/`E-P9b` land; before `G3`
- blocks: `GR9` -> `G3`
- consolidation reason: none
- reads: `apps/api/src/db/seedAsyncScenarios.ts` -> fixture construction and determinism; `apps/api/src/db/seed.ts` -> registration point and flag upsert; `apps/api/src/db/reset.ts` -> delete order and trigger block; `apps/api/src/db/savedListSeed.ts` -> `SEED_INSTANT` and natural-key lookup -> convention baseline
- acceptance: seed idempotent and order-correct; reset clears all six tables and restores both triggers; four fault flags seeded disabled; fixtures produce their documented demo outcomes
- invariants: no wall-clock time; non-seed rows preserved; `audit_events` still omitted from reset; assertions throw with the established prefix
- risk focus: a delete order that violates FK constraints on reset; triggers dropped but not recreated, silently making `job_attempts` mutable; a fixture matched by name alone so a buyer-created row is overwritten; a seeded standing order whose due state depends on the real clock
- non-goals: domain, route, or web code
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P9a`, `E-P9b`
- return: `reviewer_report_v1`

### R10: Review `P10`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P10` -> settled web notifications change set
- timing: immediately after `P10` reports and `E-P10a`/`E-P10b` land; before `G3`
- blocks: `GR10` -> `G3`
- consolidation reason: none
- reads: `apps/web/src/hooks/NotificationsContext.tsx` -> provider, mutators, stale handling; `apps/web/src/api/notifications.ts` -> schema validation; `apps/web/src/features/notifications/**` -> states and accessibility; `apps/web/src/hooks/SavedListsContext.tsx` -> baseline pattern; the three test files -> coverage adequacy
- acceptance: all four render states present; optimistic mutations roll back on failure; stale responses never win; unread label accessible; state clears on logout
- invariants: server is authority for read state and counts; no duplicated business rule; no secret in browser storage
- risk focus: an optimistic update that never reconciles after a failed request; a race where an older list response overwrites a newer one; unread count derived client-side and drifting from the server; a mutation firing without an auth guard
- non-goals: composition files, admin UI, API
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P2`, `E-P10a`, `E-P10b`
- return: `reviewer_report_v1`

### R11: Review `P11`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P11` -> settled web standing-orders change set
- timing: immediately after `P11` reports and `E-P11a`/`E-P11b` land; before `G3`
- blocks: `GR11` -> `G3`
- consolidation reason: none
- reads: `apps/web/src/features/standingOrders/**` -> all components and presentation helpers; `apps/web/src/api/standingOrders.ts` -> schema validation; `apps/web/src/features/savedLists/SavedListOutcomeList.tsx` -> shared outcome phrasing -> confirm reuse; the three test files -> coverage adequacy
- acceptance: every server error code maps to specific copy; run-now disabled in flight; run history renders added and skipped outcomes with shared phrasing; no client-side cadence arithmetic
- invariants: server owns scheduling, ownership, and limits; skip vocabulary reused; async work ignores stale completion
- risk focus: next-run recomputed client-side and disagreeing with the server; a generic error message swallowing a specific server code; run-now double-submitting; a skip reason rendered as a raw enum
- non-goals: composition files, API
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P2`, `E-P11a`, `E-P11b`
- return: `reviewer_report_v1`

### R12: Review `P12`

- method: invoke `code-reviewer`; map surviving findings into `reviewer_report_v1`
- target: `P12` -> settled web admin async change set
- timing: immediately after `P12` reports and `E-P12a`/`E-P12b` land; before `G3`
- blocks: `GR12` -> `G3`
- consolidation reason: none
- reads: `apps/web/src/features/admin/jobs/**` and `admin/webhooks/**` -> pagination, filters, mutations, focus handling; `apps/web/src/api/adminJobs.ts` and `adminWebhooks.ts` -> signal threading and schema validation; `apps/web/src/features/admin/reviews/AdminReviewModerationPage.tsx` -> baseline pagination pattern; the three test files -> coverage adequacy
- acceptance: URL-backed pagination with clamp; retry idempotency-keyed and single-flight; drain counts surfaced; payload view renders without exposing signature material; focus restored after reload
- invariants: read-only except retry and drain; aborted requests never set state; no fault-flag UI duplicated here
- risk focus: a retry generating a fresh idempotency key on every click and defeating the server guard; page clamp missing so an out-of-range page renders empty forever; an abort path that still sets an error; raw signature or secret rendered in the payload view
- non-goals: composition files, API
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E-P2`, `E-P12a`, `E-P12b`
- return: `reviewer_report_v1`

### R13: Review `S1`

- target: `S1` -> settled convergence change set (composition, docs, cross-lane tests)
- timing: immediately after `S1` reports and `E-S1a`/`E-S1b` land; before `G4`
- blocks: `GR13` -> `G4`
- consolidation reason: none — this is integration behavior not covered by any earlier packet review
- reads: `apps/web/src/App.tsx` -> the six new routes and their guards; `apps/web/src/components/Layout.tsx` -> provider nesting order; `apps/web/src/components/Header.tsx` -> bell placement and accessibility; `apps/web/src/features/admin/AdminNav.tsx` and `AdminIndexPage.tsx` -> both `sections` lists; `apps/web/src/features/account/AccountPage.tsx` -> entry link; `apps/web/src/features/notifications/AsyncComposition.integration.test.tsx` -> guard coverage; `plans/demo_project_high_level_plan.md` -> item `8`, `Current Baseline`, `LOC Target` -> accuracy of the status update
- acceptance: every new route carries the correct guard; provider order does not break existing context consumers; both admin lists updated; docs describe the webhook secret, fault flags, and drain control accurately; the plan update is truthful about what shipped and what did not
- invariants: no behavior change smuggled into composition; no new domain logic; integration evidence compared against the `G0` baseline
- risk focus: a protected route registered outside `ProtectedRoute`; an admin route missing `AdminRoute`; `NotificationsProvider` placed outside `AuthProvider` so it never sees the user; only one of the two duplicated admin `sections` lists updated; a plan update claiming standing orders place orders autonomously when they end at a cart
- non-goals: re-reviewing packet-internal implementation already gated
- write policy: inspect-only
- test policy: assess supplied evidence; run no command unless evidence is missing or stale
- relevant evidence: `E-S1a`, `E-S1b`, plus the `G0` baseline entry
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/api/src/db/migrations/index.ts`: owned only by `P1`; migration version `030` reserved for `P1` alone. No other packet adds a migration.
- `packages/contracts/**`: owned only by `P2`. All consumers read the built package.
- `apps/api/src/features/audit/auditEvent.ts`: owned only by `P3`, which declares the entire async audit vocabulary up front so `P4`-`P8` append events without editing the file. A packet needing an unforeseen action raises a blocker rather than editing.
- `apps/api/src/app.ts`: written by `P7` then `P8`, explicitly sequential and never concurrent. `P8` limits its edits to import and registration lines.
- `apps/api/src/server.ts` and `apps/api/src/config.ts`: owned only by `P7`.
- `apps/api/src/db/seed.ts` and `reset.ts`: owned only by `P9`.
- `apps/web/src/App.tsx`, `components/Layout.tsx`, `components/Header.tsx`, `features/admin/AdminNav.tsx`, `features/admin/AdminIndexPage.tsx`, `features/account/AccountPage.tsx`: owned only by `S1`. Web feature packets are verified through direct-render integration tests, matching the repository's existing test idiom, so none of them needs a composition edit.
- web feature directories `features/notifications/`, `features/standingOrders/`, `features/admin/jobs/`, `features/admin/webhooks/` and their matching `src/api/*.ts` clients: one owner each, fully disjoint.
- API feature directories `features/jobs/`, `features/notifications/`, `features/webhooks/`, `features/standingOrders/`: one owner each, fully disjoint.
- API integration test directories `test/jobs/`, `test/notifications/`, `test/webhooks/`, `test/standingOrders/`, `test/db/`: one owner per file as listed in each packet's `owns`.
- contract producer -> consumers: `P2` finishes and passes `GR2` before `P3`-`P12` launch. Schema producer -> consumers: `P1` passes `GR1` before `P3`-`P6` and `P9`.

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for implementation packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values here or in an assignment.
- non-Codex harnesses: ignore the Codex binding; use harness-native role configuration while preserving worker and reviewer responsibilities and the communication contracts below.
- all harnesses: the reviewer agent runs the `code-reviewer` skill as its review method. Every reviewer assignment sets `review_skill=code-reviewer`, and the reviewer invokes it explicitly by name through the Skill tool.

## Test Execution Schedule

All commands run from the worktree root. On Windows, prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` before any node/npm command. Automated repository commands only — no browser session, screenshot, dev-server click-through, or `browser-qa` invocation appears in any duty, gate, or review policy in this plan.

Schedule shape:

- `T1` focused: every `E-P*` entry -> owner: the producing packet -> smallest command covering that packet's changes, run once at packet completion
- `T2` fan-in: `E-S1a` and `E-S1b` -> owner: `S1` -> shared integration suites run once after all lanes converge
- `T3` final: `E-G4a`, `E-G4b`, `E-G4c` -> owner: `G4` -> broad suites run once after every review finding closes

Entries:

- `E-G0a`: at `G0` -> owner: `G0` -> `npm ci`
- `E-G0b`: at `G0` -> owner: `G0` -> `npm run typecheck -w @shop/api`
- `E-G0c`: at `G0`, baseline capture -> owner: `G0` -> `npm run test:integration -w @shop/web` -> record pass/fail and the exact identity of any failing test; this is the comparison baseline for `G4`, not a pass gate
- `E-P1`: after `P1` -> owner: `P1` -> `npm exec -w @shop/api -- tsx --test test/db/asyncSchema.integration.test.ts`
- `E-P2`: after `P2` -> owner: `P2` -> `npm test -w @shop/contracts`
- `E-P3a`: after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test src/features/jobs/jobRules.test.ts src/features/jobs/jobHandlerRegistry.test.ts`
- `E-P3b`: after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test test/jobs/jobService.integration.test.ts`
- `E-P4a`: after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test src/features/notifications/notificationRules.test.ts`
- `E-P4b`: after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test test/notifications/notificationService.integration.test.ts`
- `E-P5a`: after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test src/features/webhooks/webhookRules.test.ts`
- `E-P5b`: after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test test/webhooks/webhookService.integration.test.ts`
- `E-P6a`: after `P6` -> owner: `P6` -> `npm exec -w @shop/api -- tsx --test src/features/standingOrders/standingOrderRules.test.ts`
- `E-P6b`: after `P6` -> owner: `P6` -> `npm exec -w @shop/api -- tsx --test test/standingOrders/standingOrderService.integration.test.ts`
- `E-P7a`: after `P7` -> owner: `P7` -> `npm exec -w @shop/api -- tsx --test test/notifications/notificationRoutes.integration.test.ts`
- `E-P7b`: after `P7` -> owner: `P7` -> `npm exec -w @shop/api -- tsx --test test/standingOrders/standingOrderRoutes.integration.test.ts`
- `E-P7c`: after `P7` -> owner: `P7` -> `npm test -w @shop/api` -> proves no existing suite hangs on a leaked timer; required because `P7` is the first packet to touch the composition root
- `E-P8a`: after `P8` -> owner: `P8` -> `npm exec -w @shop/api -- tsx --test test/webhooks/webhookRoutes.integration.test.ts`
- `E-P8b`: after `P8` -> owner: `P8` -> `npm exec -w @shop/api -- tsx --test test/adminAsync.integration.test.ts`
- `E-P9a`: after `P9` -> owner: `P9` -> `npm exec -w @shop/api -- tsx --test test/db/asyncSeed.integration.test.ts`
- `E-P9b`: after `P9` -> owner: `P9` -> `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts`
- `E-P10a`: after `P10` -> owner: `P10` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/notifications`
- `E-P10b`: after `P10` -> owner: `P10` -> `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/notifications/NotificationsInboxJourney.integration.test.tsx`
- `E-P11a`: after `P11` -> owner: `P11` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/standingOrders`
- `E-P11b`: after `P11` -> owner: `P11` -> `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/standingOrders/StandingOrdersJourney.integration.test.tsx`
- `E-P12a`: after `P12` -> owner: `P12` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/admin/jobs src/features/admin/webhooks`
- `E-P12b`: after `P12` -> owner: `P12` -> `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/admin/jobs/AdminAsyncJourney.integration.test.tsx`
- `E-S1a`: after `S1` composition settles -> owner: `S1` -> `npm run test:integration -w @shop/web`
- `E-S1b`: after `S1` composition settles -> owner: `S1` -> `npm run test:integration -w @shop/api`
- `E-G4a`: at `G4`, once, after every fix settles -> owner: `G4` -> `npm run reset`
- `E-G4b`: at `G4`, once, after `E-G4a` -> owner: `G4` -> `npm run verify`
- `E-G4c`: at `G4`, once, after `E-G4b` -> owner: `G4` -> `npm run test:integration -w @shop/web` -> compare against the `E-G0c` baseline; a failure present in the baseline is reported as pre-existing, not as a regression, and any new failure blocks `G4`

Reuse: an evidence entry stays valid across sessions while its command still covers the current code and no invalidating path changed. A new subagent session alone never invalidates evidence. Each assignment receives only the ledger entries covering its own scope; the assignment instructs the agent not to rerun a valid command.

Invalidation:

- `packages/contracts/**` -> invalidates `E-P2` and every consumer entry `E-P3a` through `E-S1b`
- `apps/api/src/db/migrations/**` -> invalidates `E-P1`, `E-P9a`, `E-P9b`, `E-S1b`
- `apps/api/src/features/jobs/**` -> invalidates `E-P3a`, `E-P3b`, and every handler entry `E-P4b`, `E-P5b`, `E-P6b`, plus `E-P7c`
- `apps/api/src/app.ts`, `server.ts`, `config.ts` -> invalidates `E-P7a`, `E-P7b`, `E-P7c`, `E-P8a`, `E-P8b`, `E-S1b`
- `apps/api/src/db/seed.ts`, `reset.ts`, `seedAsyncScenarios.ts` -> invalidates `E-P9a`, `E-P9b`, `E-S1b`, `E-G4a`
- any `apps/web/src/features/<x>/**` or `apps/web/src/api/<x>.ts` -> invalidates that lane's two entries plus `E-S1a`
- `apps/web/src/App.tsx`, `Layout.tsx`, `Header.tsx`, `AdminNav.tsx`, `AdminIndexPage.tsx`, `AccountPage.tsx` -> invalidates `E-S1a`
- any change after `E-G4b` -> rerun the smallest affected focused command first; rerun `E-G4b` and `E-G4c` only when the change could alter the broad result

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every message and every JSON string value; code, commands, paths, identifiers, and errors preserved exactly
- transport: one canonical JSON object per message, inline, with no free-text wrapper; run-scoped temp artifacts only for bulky logs or diffs, under `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]` with an inline summary, path, format, and SHA-256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context per assignment
- projection: role packet + applicable repository instructions + worktree context + relevant artifact references; never the full source plan, this whole plan, prior reports, the global evidence ledger, closed findings, or unrelated packet state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`, stored at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes for non-empty object arrays: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- reviewer method: every reviewer assignment sets `review_skill=code-reviewer`
- worktree context: every assignment carries the absolute worktree path, implementation branch, and base revision; every repository-relative path resolves under the worktree root; every assigned command runs with the worktree as working directory

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load source-checkout `AGENTS.md` and `CLAUDE.md`, this plan, the canonical templates, and the current checkpoint.
3. Record the source branch and `HEAD`. Resolve the uncommitted `plans/saved_lists_coding_plan.md` deletion with the user before any implementation write; stop on a detached `HEAD`.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity in the checkpoint.
5. Switch the execution root to the worktree; load repository instructions from there.
6. Validate `G0`: run `E-G0a`, `E-G0b`, and the `E-G0c` baseline capture; record all three in the ledger.
7. Launch `P1 || P2` as fresh workers inside the worktree.
8. Accept each report, update the checkpoint and ledger, launch `R1` and `R2` against the exact settled change sets before any consumer starts.
9. Route findings to fresh workers with an `action=fix` directive carrying stable finding IDs; close after targeted evidence; never re-review a fix. Validate `GR1` and `GR2`, then `G1`.
10. Launch the API chain (`P3`) and the three web lanes (`P10 || P11 || P12`) concurrently. Review each lane as it settles.
11. Drive the API chain strictly in order through `GR3` -> `P4` -> `GR4` -> `{P5 || P6}` -> `G2` -> `P7` -> `GR7` -> `P8` -> `GR8` -> `P9` -> `GR9`, honouring the sequential ownership of `apps/api/src/app.ts`.
12. Validate `G3` once every lane gate has passed; only then launch `S1` and run `E-S1a` and `E-S1b` once.
13. Review `S1` as a separate integration target through `R13`; close findings through fresh-worker fixes plus targeted evidence.
14. Validate `GR13` and `G4`: run `E-G4a`, `E-G4b`, `E-G4c` once after all fixes settle, comparing `E-G4c` against the `E-G0c` baseline.
15. Clean up run-scoped temp artifacts. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision, and state that the user owns the merge.

## Risks and Open Questions

- risk: a background timer started inside `buildApp` hangs all 66 API integration tests -> mitigation: runner start confined to `server.ts` by design, enforced as a `P7` invariant, called out as `R7` risk focus, and proven by `E-P7c` running the full API suite
- risk: an `await` inside `unitOfWork.run` silently commits early because `db.transaction` is synchronous -> mitigation: claim/effect/settle split is a `P3` invariant and an explicit `R3` risk focus
- risk: the audit vocabulary is a single shared file that four domains need -> mitigation: `P3` owns it and declares every async action up front; later packets raise a blocker rather than editing it
- risk: `apps/api/src/app.ts` is a single composition file needed by two packets -> mitigation: `P7` then `P8`, explicitly sequential, with `P8` limited to import and registration lines
- risk: web integration tests sit outside `npm run verify`, so a green `verify` would hide a whole tier -> mitigation: `E-G0c` baseline plus `E-G4c` explicit run and comparison; a pre-existing red admin test is identified at `G0` rather than discovered at the final gate
- risk: monthly cadence arithmetic drifting or skipping short months -> mitigation: pure `nextRunAt` with month-end clamping, unit-tested at the 31st into 30-day and February months, named in `R6` risk focus
- risk: a standing-order run and a manual checkout contend for the same cart -> mitigation: `CART_RESERVED` fails the run and it retries under normal backoff; `next_run_at` advances only on completion so no cycle is silently lost
- risk: `timingSafeEqual` throwing on a length mismatch turns a bad signature into a 500 -> mitigation: length guard before comparison, unit-tested, named in `R5` risk focus
- risk: seeded fault flags left enabled would make the default demo look broken -> mitigation: all four seed disabled with a fixed `updated_at`, asserted in `E-P9a`
- question: should the existing unconditional mailbox sends in `checkoutFinalizer.ts:96` and `approvalService.ts:171` migrate onto the new preference-gated notification path? -> owner/gate: user decision at `G2`. Default if unanswered: leave them unchanged this run and record the inconsistency in the plan update at `S1`, since migrating them changes existing observable behavior beyond this item's scope.
- question: should item `15` back-in-stock be scheduled immediately after this lands, given the queue and notification seams will be live? -> owner/gate: user, after `G4`. No code in this plan presumes either answer.
- user-owned follow-up, outside every gate in this plan: a human smoke pass over `/notifications`, `/account/standing-orders`, `/admin/jobs`, and `/admin/webhooks` in a browser. This is not a packet test duty, verification, acceptance, or gate condition.

## Done Criteria

- a job enqueued with a dedupe key runs once, retries with deterministic capped backoff on failure, dead-letters at `JOB_MAX_ATTEMPTS`, and records every attempt in an immutable ledger
- a job abandoned mid-run is reclaimed after its lease and its abandoned attempt recorded
- a buyer sees every notification in `/notifications` and receives mail only when `user_preferences` allows, giving preferences their first real consumer
- the same webhook `event_id` delivered twice captures once; two events delivered out of order leave the payment in the correct terminal state with the stale one marked `ignored_stale`; a bad signature is rejected with nothing stored
- each of the four `async.*` flags forces its named failure, and the feature-flag resolver is reachable from product code, closing item `9`'s open remainder
- a standing order runs on cadence, populates a cart through the existing `CartService.addMany` path with unforked skip reasons, records per-line outcomes, notifies the buyer, and never touches checkout, payment, delivery slots, or approvals
- an admin can list, inspect, retry, and drain jobs and inspect captured webhooks; every mutation writes an audit event
- migration `030` applies FK-clean and idempotently over a seeded database; head is `030`; no landed migration edited
- `npm run reset` clears all six tables and restores the `job_attempts` triggers; `npm run seed` twice is stable
- `npm run verify` passes, and `npm run test:integration -w @shop/web` matches or improves on the `E-G0c` baseline
- `README.md` documents the webhook secret default, the simulated webhook trigger, the four fault flags, and the admin drain control; `AGENTS.md` repository map names the four new domains; `plans/demo_project_high_level_plan.md` marks item `8` complete with migration `030`, refreshed LOC figures, and an explicit note that standing orders end at a cart rather than an autonomous order, and that item `15` is now unblocked
