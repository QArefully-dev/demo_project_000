# Secondary Admin Coding Plan

Status: in progress -> checkpoint `GR8` closed
Source: `plans/demo_project_high_level_plan.md` -> `9. Secondary admin`
Repository baseline: `expansion_002` @ `8285c62`

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD`
- create: dedicated implementation branch + worktree before any implementation write
- execution root: all worker/reviewer/test/fix/convergence work inside worktree
- integration: no auto merge/rebase/cherry-pick/copy-back/cleanup; user handles merge
- completion reply: absolute worktree path + implementation branch + source branch + base revision

## Runtime Checkpoint (2026-07-29)

- resume: `P9` -> `R9` -> `GR9`
- closed: `G0`, `GR1`, `G1`, `GR8`
- worktree: `C:\Users\iwano\Desktop\repos\demo_project_000-worktrees\secondary-admin-g0-20260729`
- implementation branch: `codex/secondary-admin-g0-20260729`
- source: `expansion_002` @ `0bd0fc10bcf14b5239c0439aec390e781410a9e5`
- branch `HEAD`: `6fbf913e2b9b32841151a2a6502d42feb4a3cf25`; later packet artifacts uncommitted
- preserve: all worktree changes; no reset, clean, rebase, merge, cherry-pick, copy-back, or new worktree; user owns merge + commit consolidation
- completed corrections:
  - P3: migration `028_retired_variant_sort_order.ts` -> retired `sort_order=0` supports multiple rows; default variant promoted atomically
  - P5: suspension/session creation race closed; suspended-session lookup rejected
  - P6: return + admin refunds share payment-level cap
  - P8: contract subpath exports added; no `@shop/catalog` runtime import; category/mixing-group literals exact
- evidence: P1-P8 focused checks pass; `npm run reset` pass after P3; P8 contract subpath imports, contracts typecheck, root typecheck pass
- execution note: `npm exec -w @shop/api -- tsx --test` requires package-relative paths (`src/...`); `@shop/contracts` has no Vitest config -> P8 uses allowed typecheck substitute
- review note: `code-reviewer` unavailable in configured skill roots during R1-R8; reviewers ran equivalent critical/high checks; route later critical/high findings to fresh workers; no re-review fixes

## Objective

Deliver admin-only surface covering product, lot (variant), clearance, promo, user, order, refund, feature-flag management + optional feature-flag runtime resolver. Extend existing admin foundation (review moderation UI, audit read API, admin inventory/orders/returns commands). Every write reuses server-authoritative rules (`apps/api/src/features/pricing/`, migration `024` constraints, migration `020` retire-not-delete). Audit ledger records every mutation.

## Scope

### In

- product admin: list/search/create/update/retire (`active=0`) products; category/consumption/mixingGroup edits
- lot (variant) admin: list/create/update/retire variants; sort_order + moq_sacks + weight + price + delivery_class; retire-not-delete via `active=0` (migration `020`); never physical delete when referenced by orders
- clearance admin: set/update/clear per-variant clearance window; enforce migration `024` CHECK constraints through domain service before write
- promo admin: list/create/update/deactivate promo_codes; category scope + kind + amount + limits + windows; enforce migration `024` CHECK constraints
- user admin: list/search users; edit displayName; assign role between `customer` and `admin`; suspend/reactivate with reason; suspension invalidates all active sessions
- order admin: cross-user paginated list + filters (status, buyer, date, promo); read detail; reuse existing pack/transition/tracking/cancel routes
- refund admin: standalone refund on captured payment outside returns flow, idempotent, capped by remaining refundable balance; new `admin_refunds` table (separate from existing `refunds`, which stays anchored to `return_requests`); reuse `RefundGateway`
- feature-flag admin: new `feature_flags` table + admin CRUD + runtime resolver helper (`isFlagEnabled(key)`) with in-memory cache invalidated on write; admin-only endpoints in this baseline (no public bootstrap route; consumers wire in later)
- admin web shell: `/admin` layout + nav grouping all admin pages behind `AdminRoute`
- admin web pages: catalog (products, lots, clearance, promos), users, orders, feature flags
- audit: extend `AUDIT_ACTIONS` for each admin mutation; every command writes via `AuditWriter`

### Out

- customer-facing account deletion, session list/revoke, preferences, data export, company accounts, approver roles (item 7)
- moderation UI/API (already landed)
- audit read API (already landed)
- admin operations against custom blends beyond retiring source variant
- multi-currency, localisation, back-office reporting dashboards
- soft-delete of order/refund history
- automatic promo/category offers, RFQ, trade-account net pricing
- new async/job-queue infrastructure (item 8)
- courier/warehouse integrations
- promo stacking

## Repository Findings

- existing: `apps/api/src/plugins/auth.ts` -> `requireAdmin` -> reuse for every new admin route
- existing: `apps/api/src/routes/audit.ts` -> paginated read; do not touch
- existing: `apps/api/src/routes/reviews.ts` -> `AdminReview*` moderation endpoints (pattern for admin GET + POST + audit context)
- existing: `apps/api/src/routes/adminInventory.ts`, `adminOrders.ts`, `adminReturns.ts` -> admin route pattern (schema + `preHandler: [requireAdmin]` + `contextFor(userId, request.id)` + domain-error to HTTP mapper)
- existing: `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS` literal array + `AuditEntityType` + `AuditContext` -> extend, single owner
- existing: `apps/api/src/features/audit/auditQuery.ts` -> `entityTypeSet` -> extend with new entity types (`variant`, `product`, `promo`, `feature_flag`) alongside `AuditEntityType`
- existing: `apps/api/src/features/pricing/clearanceRules.ts`, `pricingRules.ts` -> pure resolver; write path missing -> new admin service must call resolver on the resulting row to prove validity before commit
- existing: `apps/api/src/features/promos/promoRepository.ts` -> read-only `findByCode`, reservation model; no write CRUD -> new admin repo needed
- existing: `apps/api/src/features/catalog/productRepository.ts` -> read-only (list/find); no write CRUD for products or variants -> new admin repos needed
- existing: `apps/api/src/features/auth/userRepository.ts` -> only `create`, `findCredentials*`, `updatePassword` -> new admin repo needed for list/role/suspension; `users` table has `role TEXT NOT NULL DEFAULT 'customer'` (migration `001`) with no suspension columns
- existing: `apps/api/src/features/orders/orderRepository.ts` -> `listOwned` per user; no cross-user admin list -> new admin repo method or new repo
- existing: `apps/api/src/features/returns/refundGateway.ts` -> deterministic simulated refund; reuse for standalone admin refund
- existing: `apps/api/src/features/returns/returnService.ts` -> `refundReturn` idempotency + cumulative delta pattern -> mirror for standalone refund
- existing: `apps/api/src/db/migrations/024_pricing_promotions.ts` -> variant clearance window CHECK constraints + promo category_scope check + additive column pattern via `addColumnIfMissing` + `assertForeignKeysClean` -> template for new migration
- existing: `apps/api/src/db/migrations/020_retire_legacy_variants.ts` -> retire-not-delete rule (`sort_order < 1` = retired); admin variant write must obey
- existing: `apps/api/src/db/migrations/index.ts` -> registered migration list; append new entry
- existing: `apps/api/src/app.ts` -> composition root; all services + routes registered here; single owner for new registrations
- existing: `apps/web/src/App.tsx` -> `<AdminRoute><AdminReviewModerationPage/></AdminRoute>` at `/admin/reviews` -> extend routes list; single owner
- existing: `apps/web/src/components/AdminRoute.tsx` (referenced from `App.tsx`) -> role gate; reuse unchanged
- existing: `apps/web/src/features/admin/reviews/AdminReviewModerationPage.tsx` -> admin page pattern (react-router search params + typed API client + shadcn primitives)
- existing: `apps/web/src/api/adminReviews.ts` -> admin API client pattern
- existing: `packages/contracts/src/*.ts` -> TypeBox schemas + `Static` types; admin schemas exist for reviews/returns/orders/inventory; product/variant/user/promo/feature-flag admin schemas absent
- existing: `packages/contracts/src/index.ts` -> subpath exports; single owner
- existing: `packages/catalog/src/model.ts` -> `CATALOG_CATEGORIES`, `MIXING_GROUPS`, `ConsumptionClassification`, `DeliveryClass` -> reuse enums in contracts
- gap: no feature-flag domain, table, service, resolver, contract, route, or UI
- gap: no user suspension column, admin user service, admin user API, or session-revoke-on-suspend hook
- gap: no cross-user admin order list route or contract
- gap: no standalone admin refund service outside returns; existing `refunds` table `NOT NULL UNIQUE REFERENCES return_requests(id)` + immutability triggers prevent reuse for admin path -> new `admin_refunds` table
- gap: no product/variant/promo/clearance write repositories or admin routes
- gap: no `/admin` index nav page; only `/admin/reviews` exists
- constraint: migration append-only, forward-only; item 7 (parallel worktree) reserves `025` + `026`; this plan reserves `027` (resolved pre-runtime)
- constraint: retire-not-delete for catalog rows referenced by orders (variants, products)
- constraint: money integer minor units; backend authoritative
- constraint: `PRAGMA foreign_key_check` clean after migration
- constraint: `apps/api/src/db/seed.ts` idempotent seed; new admin fixtures use upsert
- reuse: `apps/api/src/routes/adminOrders.ts` transport/error pattern -> every new admin route
- reuse: `apps/api/src/features/returns/refundGateway.ts` -> standalone admin refund
- reuse: `apps/api/src/features/pricing/clearanceRules.ts::resolveClearance` -> admin clearance write validation
- reuse: `apps/api/src/features/promos/promoService.ts` gates -> admin promo write validation of category_scope + kind + amount

## Decisions and Invariants

- migration `027_admin_surface.ts` adds: `users.suspended_at TEXT`, `users.suspension_reason TEXT`, `users.suspended_by_user_id INTEGER REFERENCES users(id)`; new `feature_flags` table; new `admin_refunds` table (immutable, references payments + users); index on `orders.user_id + created_at` for admin listing if absent
- retire-not-delete: variant retire = `active=0` + `sort_order=0`; product retire = `active=0`; never `DELETE FROM product_variants` / `products` when order/cart references exist; check via `SELECT COUNT(*) FROM order_line_items WHERE variant_id=?` before physical delete attempt (reject with domain error)
- user role vocabulary stays `'customer' | 'admin'`; item 7 owns future role expansion (approver, buyer)
- suspending user = write `suspended_at` + immediately delete all rows in `sessions` where `user_id=?` + audit `user.suspended`; reactivate = clear `suspended_at`/`reason` + audit `user.reactivated`; suspended user login blocked via `authService.login` check before session issue
- role change never demotes last remaining admin: reject with `LAST_ADMIN` domain error
- feature-flag key = `[a-z][a-z0-9_.]{1,63}`; value = boolean only in this baseline; `updated_by_user_id` recorded; runtime resolver caches by key with in-process `Map` invalidated on write
- clearance write: caller sends `{priceCents, startsAt, endsAt}` or clears all three atomically; service validates `0 < priceCents < variant.priceCents`, `startsAt < endsAt`, ISO strings, then runs `resolveClearance` with a probe `now = startsAt` to prove downstream pricing accepts the row before commit
- promo write: category_scope must be `null` or one of `CATALOG_CATEGORIES`; `kind='percent'` requires `discountPercent 1..100`; `kind='fixed'` requires `amountCents >= 1`; `startAt < endAt` when both set; `perUserLimit >= 1` when set; `maxRedemptions >= redemptionCount` on update
- product write: `slug` unique per category; `mixingGroup` must be `null` or in `MIXING_GROUPS`; retire cascades nothing (variants stay independently retired)
- admin refund: idempotent by `idempotencyKey`; total refunded across all refunds (returns `refunds` sum + `admin_refunds` sum) never exceeds captured payment amount; separate `admin_refunds` table (does not touch existing `refunds` immutability triggers or return_request FK); new audit action `payment.admin_refunded`
- admin order list: allowlist filter/sort keys server-side; page 1..10_000; pageSize 1..100
- audit entity types extended: `product | variant | promo | user | feature_flag` alongside existing set
- resolved (pre-runtime): item 7 owns migrations `025` (self-service) + `026` (company + approvals); this plan owns `027`; item 7 does NOT add columns to `users` in either of its migrations (item 7 P6 deletion path only UPDATEs existing user columns for PII redact); merge-time note -> item 7 deletion may need to null the `suspended_*` columns added here (additive at merge, not a runtime conflict inside either worktree)
- resolved (pre-runtime): feature flags are admin-only in this baseline -> no public `GET /api/feature-flags` endpoint; `featureFlagResolver` exposed via `AppServices.featureFlags` for server-side consumers only; add public bootstrap route only when a first UI consumer arrives in a later plan
- assumption (validate at G0): no separate admin RBAC gradation needed beyond `role='admin'`; every admin can perform every admin action

## Target Design

### Schema

- migration file (proposed): `apps/api/src/db/migrations/027_admin_surface.ts`
- register in `apps/api/src/db/migrations/index.ts` -> append entry after item 7's `026`
- statements: `ALTER TABLE users ADD COLUMN suspended_at TEXT`; `ALTER TABLE users ADD COLUMN suspension_reason TEXT`; `ALTER TABLE users ADD COLUMN suspended_by_user_id INTEGER REFERENCES users(id)`; `CREATE TABLE IF NOT EXISTS feature_flags (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)), updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by_user_id INTEGER REFERENCES users(id))`; `CREATE TABLE IF NOT EXISTS admin_refunds (id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id INTEGER NOT NULL REFERENCES payments(id), order_id INTEGER NOT NULL REFERENCES orders(id), actor_user_id INTEGER NOT NULL REFERENCES users(id), amount_cents INTEGER NOT NULL CHECK (typeof(amount_cents)='integer' AND amount_cents > 0), reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500), idempotency_key TEXT NOT NULL UNIQUE, processor TEXT NOT NULL DEFAULT 'simulated' CHECK (processor='simulated'), simulated_reference TEXT NOT NULL CHECK (length(simulated_reference) >= 1), created_at TEXT NOT NULL)`; immutability triggers on `admin_refunds` matching pattern in migration `017` (`refunds_no_update`, `refunds_no_delete`); `CREATE INDEX admin_refunds_payment_idx ON admin_refunds(payment_id)`; `CREATE INDEX IF NOT EXISTS idx_orders_admin ON orders(created_at DESC, user_id)`
- follow `024` pattern: `hasColumn`, `addColumnIfMissing`, `assertForeignKeysClean(db)`
- extend `AuditAction` union with new literals (see Audit); update `entityTypeSet` in `auditQuery.ts`

### Catalog admin domain

- new files (proposed): `apps/api/src/features/catalog/productAdminRepository.ts`, `productAdminService.ts`, `variantAdminRepository.ts`, `variantAdminService.ts`
- product admin service commands: `listAdmin(query)`, `getAdmin(id)`, `create(input, ctx)`, `update(id, patch, ctx)`, `retire(id, ctx)`
- variant admin service commands: `listAdmin(productId)`, `create(input, ctx)`, `update(id, patch, ctx)`, `retire(id, ctx)`, `setClearance(id, window|null, ctx)`
- validation delegates to existing pure rules in `catalogSpecifications.ts`, `pricing.ts`, `clearanceRules.ts`
- writes run inside `UnitOfWork` + emit audit event through `AuditWriter`
- retire path rejects physical delete when `SELECT COUNT(*) FROM order_line_items WHERE variant_id=?` > 0 (variant) or any active variant references product (product)

### Promo admin domain

- new files (proposed): `apps/api/src/features/promos/promoAdminRepository.ts`, `promoAdminService.ts`
- commands: `listAdmin(query)`, `get(code)`, `create(input, ctx)`, `update(code, patch, ctx)`, `deactivate(code, ctx)`
- reject deactivate when active reservations remain (`activeReservationCount(code) > 0`) unless `force=true`; force still audits
- CHECK constraint mirror server-side to return clear domain errors before SQLite raises

### User admin domain

- new files (proposed): `apps/api/src/features/auth/userAdminRepository.ts`, `userAdminService.ts`
- commands: `list(query)`, `get(id)`, `updateDisplayName(id, name, ctx)`, `setRole(id, role, ctx)`, `suspend(id, reason, actorId, ctx)`, `reactivate(id, actorId, ctx)`
- suspend invokes `sessionRepository.deleteByUserId(userId)` -> add method to `apps/api/src/features/auth/sessionRepository.ts` (single owner during P5)
- `authService.login` reads `users.suspended_at` and rejects with `AUTH_SUSPENDED`; add gate inside `authService.ts` (worker P5 also owns this narrow edit)
- guard `LAST_ADMIN`: `setRole` demote to `'customer'` counts remaining admins with role='admin' and `suspended_at IS NULL`; must remain >=1

### Order + refund admin domain

- new files (proposed): `apps/api/src/features/orders/orderAdminRepository.ts`, `orderAdminService.ts`, `apps/api/src/features/payments/adminRefundService.ts`
- order admin: `listAdmin({status?, userEmail?, promoCode?, occurredFrom?, occurredTo?, page, pageSize})`; reads orders + joins users + promos; server allowlist filters/order columns
- admin refund: `refund({paymentId, orderId, amountCents, reason, idempotencyKey, ctx})`; idempotent through `admin_refunds.idempotency_key UNIQUE`; reuse `RefundGateway.refund(idempotencyKey)`; cap `SUM(refunds.net_refund_cents WHERE payment_id=?) + SUM(admin_refunds.amount_cents WHERE payment_id=?) + amountCents <= payments.amount_cents`
- audit action `payment.admin_refunded` with `entityType='payment'`

### Feature flags

- new files (proposed): `apps/api/src/features/featureFlags/featureFlagRepository.ts`, `featureFlagService.ts`, `featureFlagResolver.ts`
- repository: `list()`, `get(key)`, `create(input, ctx)`, `update(key, patch, ctx)`, `delete(key, ctx)`
- resolver: in-process `Map<key, boolean>` populated lazily on first call; write commands call `resolver.invalidate(key)` after commit
- no consumer wired in this baseline; resolver exposed via `AppServices.featureFlags`; downstream consumers land later
- audit actions `feature_flag.created | feature_flag.updated | feature_flag.deleted`

### Contracts

- new files (proposed): `packages/contracts/src/adminProducts.ts`, `adminVariants.ts`, `adminPromos.ts`, `adminUsers.ts`, `adminOrdersList.ts`, `adminRefunds.ts`, `featureFlags.ts`
- extend `packages/contracts/src/auth.ts` -> `PublicUser` `role` union unchanged; add `AdminUserView` with `suspendedAt`, `suspensionReason`, `suspendedByUserId`
- extend `packages/contracts/src/orders.ts` -> `AdminOrderListQuery`, `AdminOrderListResponse` (new schemas beside existing shipment types)
- extend `packages/contracts/src/index.ts` -> subpath exports for new files

### Routes

- new files (proposed): `apps/api/src/routes/adminProducts.ts`, `adminVariants.ts`, `adminPromos.ts`, `adminUsers.ts`, `adminOrdersList.ts` (list-only; keeps existing `adminOrders.ts` for shipment commands), `adminRefunds.ts`, `adminFeatureFlags.ts`
- every route: `preHandler: [requireAdmin(services.sessions)]` + TypeBox schema + `contextFor(userId, request.id)` + domain-error mapper
- register in `apps/api/src/app.ts` (S1 single owner)

### Web

- new files (proposed): `apps/web/src/features/admin/AdminLayout.tsx`, `AdminNav.tsx`, `AdminIndexPage.tsx`; `apps/web/src/features/admin/products/*`, `lots/*`, `promos/*`, `users/*`, `orders/*`, `featureFlags/*`
- new API clients (proposed): `apps/web/src/api/adminProducts.ts`, `adminVariants.ts`, `adminPromos.ts`, `adminUsers.ts`, `adminOrders.ts`, `adminRefunds.ts`, `adminFeatureFlags.ts`
- routes wired in `apps/web/src/App.tsx` (S1) under `/admin/*` inside `<AdminRoute>`
- reuse shadcn primitives (`components/ui/*`); no new UI framework
- forms use controlled state + typed API clients; server validates authoritatively
- pages surface loading/empty/error states; retire actions confirm intent inline (no modal-only)

### Audit

- extend `AUDIT_ACTIONS` (single owner P1): `product.created | product.updated | product.retired`, `variant.created | variant.updated | variant.retired | variant.clearance_set | variant.clearance_cleared`, `promo.created | promo.updated | promo.deactivated`, `user.role_changed | user.suspended | user.reactivated | user.display_name_updated`, `feature_flag.created | feature_flag.updated | feature_flag.deleted`, `payment.admin_refunded`
- extend `AuditEntityType`: `product | variant | promo | feature_flag`; update `auditQuery.ts::entityTypeSet` accordingly
- every admin command writes exactly one audit event per commit through `AuditWriter`

## Execution Graph

`G0 -> P1 -> R1 -> GR1 -> {P2 || P3 || P4 || P5 || P6 || P7} -> {R2 || R3 || R4 || R5 || R6 || R7} -> G1 -> P8 -> R8 -> GR8 -> P9 -> R9 -> GR9 -> P10 -> R10 -> GR10 -> {P11 || P12} -> {R11 || R12} -> G2 -> S1 -> R-S1 -> GR-S1 -> G3`

- `G0`: worktree created; Node 22 verified; `npm ci` + `npm run reset` pass
- `GR1`: schema + audit vocabulary review gate; blocks every domain packet
- `G1`: all six domain packets reviewed + closed; blocks contracts
- `GR8`: contracts review gate; blocks routes
- `GR9`: routes review gate; blocks web shell
- `GR10`: web shell review gate; blocks page packets
- `G2`: both page packets reviewed + closed; blocks convergence
- `GR-S1`: convergence review gate; blocks final broad suite
- `G3`: `npm run verify` passes once after S1 fixes settle

## Work Packets

### P1: Schema + audit vocabulary

- mode: sequential; first work
- depends on: `G0`
- owns: `apps/api/src/db/migrations/027_admin_surface.ts` (new), `apps/api/src/db/migrations/index.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditQuery.ts`, colocated tests `apps/api/src/features/audit/auditEvent.test.ts`
- reads: `apps/api/src/db/migrations/024_pricing_promotions.ts` -> `hasColumn`, `addColumnIfMissing`, `assertForeignKeysClean` -> pattern; `apps/api/src/db/migrate.ts` -> runner FK behavior; `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEntityType`; `apps/api/src/features/audit/auditQuery.ts` -> `entityTypeSet`
- acceptance: `npm run reset` succeeds; migration idempotent when rerun; `PRAGMA foreign_key_check` clean; `AUDIT_ACTIONS` includes every new literal listed under Target Design/Audit; `entityTypeSet` extended to match
- non-goals: any repository/service/route/UI change; feature-flag seed
- upstream inputs: `G0` -> `[HEAD baseline]` -> reserved migration number `027` (item 7 owns `025`+`026`)
- changes:
  - add migration file matching `024` structure; ALTER TABLE + CREATE TABLE + CREATE INDEX as designed
  - append entry to `migrations/index.ts`
  - extend `AUDIT_ACTIONS` literal array + `AuditEntityType` union
  - extend `entityTypeSet` in `auditQuery.ts`
  - add focused unit test asserting each new action + entity type parses through `normalizeAuditEventQuery`
- invariants: append-only migrations; forward-only; local SQLite disposable but migration correct; foreign_key_check clean; audit vocabulary additive
- relevant evidence: none
- test duty: `E1` -> `npm run typecheck` scoped to root; `E2` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/audit/auditEvent.test.ts`; `E3` -> `npm run reset`
- verification: `E1`, `E2`, `E3` all pass
- handoff: `H1` -> migration + audit vocabulary at commit `[change_set]` -> consumed by P2..P7 (audit actions), P5 + P7 (columns/tables)
- review: `R1` -> blocks every downstream packet

### P2: Product admin domain

- mode: parallel with P3..P7 after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/catalog/productAdminRepository.ts` (new), `productAdminService.ts` (new), colocated tests
- reads: `apps/api/src/features/catalog/productRepository.ts` -> row types + `ProductRow` -> reuse; `catalogSpecifications.ts` -> spec definitions; `apps/api/src/features/audit/auditService.ts` -> `AuditWriter`; `apps/api/src/db/unitOfWork.ts` -> `UnitOfWork`; `packages/catalog/src/model.ts` -> enums
- acceptance: service exposes `listAdmin`, `getAdmin`, `create`, `update`, `retire`; retire enforces retire-not-delete when references exist; SQLite integration tests cover create/update/retire happy path + retire-with-references rejection + audit event emission
- non-goals: contracts, routes, UI, variant edits, clearance
- upstream inputs: `H1` -> migration + audit -> `product.*` audit actions
- changes:
  - implement repository CRUD (INSERT/UPDATE with allowlisted columns; retire via `UPDATE products SET active=0`)
  - implement service commands wrapping repo inside `unitOfWork.run(...)` + writing exactly one audit event per command
  - unit test category/mixingGroup validation; integration test each command + audit emission
- invariants: money integer minor units; retire-not-delete; audit exactly-once per command; no physical delete when references exist
- relevant evidence: `H1` handoff summary
- test duty: `E-P2-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/catalog/productAdminService.test.ts`
- verification: `E-P2-1` pass; no cross-domain runs
- handoff: `H2` -> product admin service interface at commit `[change_set]` -> consumed by contracts (P8) + routes (P9)
- review: `R2` -> blocks contracts fan-in

### P3: Variant (lot) admin domain incl. clearance

- mode: parallel with P2, P4..P7 after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/catalog/variantAdminRepository.ts` (new), `variantAdminService.ts` (new), colocated tests
- reads: `apps/api/src/features/catalog/productRepository.ts` -> `VariantRow`; `apps/api/src/features/pricing/clearanceRules.ts` -> `resolveClearance`; `apps/api/src/db/migrations/020_retire_legacy_variants.ts` -> retire semantics; `apps/api/src/db/migrations/024_pricing_promotions.ts` -> CHECK constraints; `packages/contracts/src/pricing.ts` -> constants; `packages/catalog/src/model.ts` -> `DeliveryClass`
- acceptance: service supports `listAdmin`, `create`, `update`, `retire`, `setClearance`; retire = `active=0` + `sort_order=0`; setClearance validated with `resolveClearance` before write; rejects window collisions with existing pricing constraints; SQLite integration tests cover clearance boundary + retire + audit emission
- non-goals: product edits, promo edits, contracts, routes, UI
- upstream inputs: `H1` -> `variant.*` audit actions
- changes:
  - implement repository CRUD respecting migration `024` CHECK columns
  - implement service enforcing retire-not-delete on order references
  - clearance path: normalize `startsAt`/`endsAt` to ISO, run `resolveClearance({...next, now: new Date(startsAt)})`, reject if `clearance` still null
  - unit tests for validation; integration tests for setClearance + retire behaviors
- invariants: retire-not-delete; `sort_order` contract-floor 1 for active variants; clearance CHECK invariants; audit exactly-once
- relevant evidence: `H1` handoff summary
- test duty: `E-P3-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/catalog/variantAdminService.test.ts`
- verification: `E-P3-1` pass
- handoff: `H3` -> variant admin + clearance service interface at commit `[change_set]`
- review: `R3` -> blocks contracts fan-in

### P4: Promo admin domain

- mode: parallel after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/promos/promoAdminRepository.ts` (new), `promoAdminService.ts` (new), colocated tests
- reads: `apps/api/src/features/promos/promoRepository.ts` -> read patterns + reservation counters; `apps/api/src/features/promos/promoService.ts` -> validation gates; `apps/api/src/db/migrations/024_pricing_promotions.ts` -> `category_scope` CHECK; `packages/catalog/src/model.ts` -> `CATALOG_CATEGORIES`
- acceptance: service supports `listAdmin`, `get`, `create`, `update`, `deactivate`; deactivate rejects when `activeReservationCount(code) > 0` unless `force=true`; validates category_scope + kind + amount + limits + windows before write; integration tests for create/update/deactivate + audit
- non-goals: promo runtime evaluation, redemption logic
- upstream inputs: `H1` -> `promo.*` audit actions
- changes:
  - repository CRUD respecting existing schema + adding write statements
  - service enforcing all invariants in Decisions
  - unit tests for validation; integration tests for CRUD + audit
- invariants: audit exactly-once; forbid changing `redemption_count` externally; category_scope always literal enum or null
- relevant evidence: `H1` handoff summary
- test duty: `E-P4-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/promos/promoAdminService.test.ts`
- verification: `E-P4-1` pass
- handoff: `H4` -> promo admin service interface at commit `[change_set]`
- review: `R4` -> blocks contracts fan-in

### P5: User admin domain + suspension gate

- mode: parallel after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/auth/userAdminRepository.ts` (new), `userAdminService.ts` (new), `apps/api/src/features/auth/sessionRepository.ts` (extend with `deleteByUserId`), `apps/api/src/features/auth/authService.ts` (narrow edit: block login when `suspended_at IS NOT NULL`), colocated tests
- reads: `apps/api/src/features/auth/userRepository.ts` -> patterns + `UserRecord`; `apps/api/src/features/auth/sessionRepository.ts` -> existing session methods; `apps/api/src/features/auth/authService.ts` -> login flow + `AuthError`; `apps/api/src/features/audit/auditService.ts` -> `AuditWriter`
- acceptance: service supports `list`, `get`, `updateDisplayName`, `setRole`, `suspend`, `reactivate`; suspending user deletes all rows in `sessions.user_id=?` inside same UoW + writes `user.suspended` audit; reactivate clears columns + writes `user.reactivated`; login rejects suspended user with `AUTH_SUSPENDED`; `setRole` rejects last-admin demotion with `LAST_ADMIN`; SQLite integration tests cover each command + login block + audit
- non-goals: customer-facing account deletion, session-list-and-revoke by owner, preferences, data export, company accounts, approver roles (all item 7)
- upstream inputs: `H1` -> `user.*` audit actions + suspension columns
- changes:
  - add repository methods (`list`, `get`, `updateDisplayName`, `setRole`, `suspend`, `reactivate`, `countActiveAdmins`)
  - add `sessionRepository.deleteByUserId(userId)`
  - add `authService.login` suspension gate reading `suspended_at`
  - service commands wrap in UoW + audit
  - unit test `LAST_ADMIN`; integration tests suspend->sessions-cleared, reactivate, role change, login-blocked-when-suspended
- invariants: no customer-account-domain edit; single-owner shared file: `authService.ts` (worker must add narrow gate; do not restructure); audit exactly-once; suspension actor recorded in `suspended_by_user_id`
- relevant evidence: `H1` handoff summary
- test duty: `E-P5-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/auth/userAdminService.test.ts`; `E-P5-2` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/auth/authService.test.ts` (targeted new suspension test)
- verification: `E-P5-1`, `E-P5-2` pass
- handoff: `H5` -> user admin service + login gate + session-delete-by-user at commit `[change_set]`
- review: `R5` -> blocks contracts fan-in

### P6: Order admin list + admin refund domain

- mode: parallel after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/orders/orderAdminRepository.ts` (new), `orderAdminService.ts` (new), `apps/api/src/features/payments/adminRefundService.ts` (new), colocated tests
- reads: `apps/api/src/features/orders/orderRepository.ts` -> row types + `listOwned` pattern; `apps/api/src/features/returns/returnService.ts::refundReturn` -> idempotency + cumulative delta; `apps/api/src/features/returns/refundGateway.ts` -> `RefundGateway`; `apps/api/src/features/payments/paymentRepository.ts` -> captured payments; `apps/api/src/db/migrations/017_returns_refunds.ts` -> existing `refunds` schema + immutability triggers (do not touch; parallel `admin_refunds` table lives in `027`)
- acceptance: `orderAdminService.listAdmin` returns paginated + filtered cross-user list; `adminRefundService.refund` idempotent by `admin_refunds.idempotency_key`, capped by `payments.amount_cents - SUM(refunds.net_refund_cents) - SUM(admin_refunds.amount_cents)`, reuses `RefundGateway`, writes `payment.admin_refunded` audit; SQLite integration tests cover list filters, refund cap (including cap tightened by prior returns-flow refund), idempotent replay
- non-goals: order state transitions (already served by `adminOrders.ts`); returns flow refunds (already served); edits to existing `refunds` table or its triggers
- upstream inputs: `H1` -> `payment.admin_refunded` audit action + `admin_refunds` table + orders index
- changes:
  - repository list with allowlisted filters + safe ORDER BY + LIMIT/OFFSET
  - service list wrapper
  - admin refund service wrapping refund inside UoW + writing single audit event per successful refund
  - insert to `admin_refunds` table (owned by migration `027`); no edit to existing `refunds` schema or triggers
  - unit + integration tests
- invariants: refund total across return + standalone <= captured payment; idempotency preserved; audit exactly-once
- relevant evidence: `H1` handoff summary
- test duty: `E-P6-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/orders/orderAdminService.test.ts`; `E-P6-2` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/payments/adminRefundService.test.ts`
- verification: `E-P6-1`, `E-P6-2` pass
- handoff: `H6` -> order admin + admin refund service interfaces at commit `[change_set]`
- review: `R6` -> blocks contracts fan-in

### P7: Feature-flag domain + resolver

- mode: parallel after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/featureFlags/featureFlagRepository.ts` (new), `featureFlagService.ts` (new), `featureFlagResolver.ts` (new), colocated tests
- reads: `apps/api/src/db/migrations/027_admin_surface.ts` -> `feature_flags` schema; `apps/api/src/features/audit/auditService.ts` -> `AuditWriter`
- acceptance: repository CRUD; service `list`, `get`, `create`, `update`, `delete` in UoW + audit; resolver `isEnabled(key)` populates in-process cache; every service write invalidates cache; SQLite integration tests cover CRUD + cache invalidation + audit
- non-goals: consumer wiring inside checkout/orders/inventory; percentage rollouts; targeting rules
- upstream inputs: `H1` -> `feature_flags` table + `feature_flag.*` audit actions
- changes:
  - repository CRUD
  - service commands
  - resolver with lazy load + invalidate hook injected into service
  - unit tests for key validation; integration tests for CRUD + resolver cache
- invariants: key regex `[a-z][a-z0-9_.]{1,63}`; unique key; boolean value; audit exactly-once
- relevant evidence: `H1` handoff summary
- test duty: `E-P7-1` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/featureFlags/featureFlagService.test.ts`
- verification: `E-P7-1` pass
- handoff: `H7` -> feature-flag service + resolver at commit `[change_set]`
- review: `R7` -> blocks contracts fan-in

### P8: Admin contracts

- mode: sequential after `G1` (all domain packets reviewed)
- depends on: `G1`
- owns: `packages/contracts/src/adminProducts.ts` (new), `adminVariants.ts` (new), `adminPromos.ts` (new), `adminUsers.ts` (new), `adminOrdersList.ts` (new), `adminRefunds.ts` (new), `featureFlags.ts` (new), `packages/contracts/src/index.ts`, `packages/contracts/src/auth.ts` (add `AdminUserView`), `packages/contracts/src/orders.ts` (add `AdminOrderListQuery/Response`)
- reads: `packages/contracts/src/reviews.ts` -> `AdminReview*` schema pattern; `packages/contracts/src/returns.ts` -> `AdminReturn*` pattern; `packages/contracts/src/common.ts` -> `MoneyCents`, `EmailAddress`, `ErrorResponse`; `packages/catalog/src/model.ts` -> enums; handoffs `H2..H7`
- acceptance: TypeBox schemas exist for every admin route planned in P9; `Static<>` types exported; `packages/contracts/src/index.ts` updated with subpath exports; `npm run typecheck` clean at workspace root; contracts consume only pure enums from `@shop/catalog` and existing contracts
- non-goals: implementation (routes, UI); adding runtime code to contracts package
- upstream inputs: `H2..H7` -> service interfaces -> schema shapes
- changes:
  - author schemas + Static types per new file
  - single owner of `index.ts` add subpath exports
- invariants: schemas match domain interfaces; no `additionalProperties: true`; unions match backend enums; `role` union stays `'customer' | 'admin'`
- relevant evidence: `H2..H7` handoff summaries
- test duty: `E-P8-1` -> `npm exec -w @shop/contracts -- vitest run --configLoader runner` (skip if no vitest configured; substitute `npm run typecheck -w @shop/contracts` if applicable)
- verification: `E-P8-1` + `npm run typecheck` pass
- handoff: `H8` -> admin contracts published at commit `[change_set]`
- review: `R8` -> blocks routes

### P9: Admin routes

- mode: sequential after `GR8`
- depends on: `GR8`
- owns: `apps/api/src/routes/adminProducts.ts` (new), `adminVariants.ts` (new), `adminPromos.ts` (new), `adminUsers.ts` (new), `adminOrdersList.ts` (new), `adminRefunds.ts` (new), `adminFeatureFlags.ts` (new), colocated integration tests (`apps/api/test/adminProducts.integration.test.ts`, etc.)
- reads: `apps/api/src/routes/adminOrders.ts` -> route pattern; `apps/api/src/routes/adminReturns.ts` -> transport + error mapper; `apps/api/src/routes/reviews.ts` -> admin GET/POST + audit context; `apps/api/src/plugins/auth.ts` -> `requireAdmin`; contracts from `H8`; services from `H2..H7`
- acceptance: every service command reachable through Fastify route; each route guarded by `requireAdmin`; error-to-HTTP mapper deterministic; Fastify `app.inject()` integration tests cover 200/400/401/403/404/409 as applicable per route
- non-goals: composition-root registration (S1)
- upstream inputs: `H2..H8`
- changes:
  - author route files following `adminOrders.ts` structure
  - author `app.inject()` tests per route
- invariants: admin gate before schema validation; audit context includes `authenticatedUser.id` + `request.id`
- relevant evidence: none from earlier packets except handoff summaries
- test duty: `E-P9-1` -> `npm exec -w @shop/api -- tsx --test apps/api/test/adminProducts.integration.test.ts` (plus one command per other new route file, executed as separate evidence IDs `E-P9-2..E-P9-7`)
- verification: all `E-P9-*` pass
- handoff: `H9` -> admin routes published at commit `[change_set]`
- review: `R9` -> blocks web shell

### P10: Admin web shell

- mode: sequential after `GR9`
- depends on: `GR9`
- owns: `apps/web/src/features/admin/AdminLayout.tsx` (new), `AdminNav.tsx` (new), `AdminIndexPage.tsx` (new), `apps/web/src/api/adminProducts.ts` (new), `adminVariants.ts` (new), `adminPromos.ts` (new), `adminUsers.ts` (new), `adminOrders.ts` (new), `adminRefunds.ts` (new), `adminFeatureFlags.ts` (new), colocated tests
- reads: `apps/web/src/features/admin/reviews/AdminReviewModerationPage.tsx` -> admin page pattern; `apps/web/src/api/adminReviews.ts` -> API client pattern; `apps/web/src/components/AdminRoute.tsx` -> role gate; `apps/web/src/components/Layout.tsx` + `ui/*` -> primitives
- acceptance: `AdminLayout` renders nav + outlet; `AdminIndexPage` links to every admin section; typed API client functions call each admin route with `credentials: 'include'`; React integration test asserts nav renders links + `AdminIndexPage` mounts under `<AdminRoute>`
- non-goals: page implementations (P11/P12); App.tsx wiring (S1)
- upstream inputs: `H8`, `H9`
- changes:
  - layout + nav components
  - API client functions
  - index page listing sections
  - integration tests
- invariants: fetch calls typed against `@shop/contracts`; no direct SQL; no shared mutable state across pages
- relevant evidence: none
- test duty: `E-P10-1` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/admin/AdminLayout.test.tsx`
- verification: `E-P10-1` pass
- handoff: `H10` -> admin shell + API clients at commit `[change_set]`
- review: `R10` -> blocks page packets

### P11: Admin web pages -- catalog group (products, lots, clearance, promos)

- mode: parallel with P12 after `GR10`
- depends on: `GR10`
- owns: `apps/web/src/features/admin/products/*` (new), `apps/web/src/features/admin/lots/*` (new), `apps/web/src/features/admin/promos/*` (new), colocated tests
- reads: `AdminReviewModerationPage.tsx` -> page pattern; contracts from `H8`; API clients from `H10`
- acceptance: pages render list + detail/edit; forms submit through typed clients; loading/empty/error states present; retire actions confirmed inline; React integration tests cover happy path per page + one failure (e.g. retire-with-references rejection surfaced to user)
- non-goals: user/order/refund/flag pages; App.tsx wiring
- upstream inputs: `H8`, `H9`, `H10`
- changes:
  - implement pages, forms, and integration tests
- invariants: server authoritative on validation; UI never bypasses money rules; no route wiring here
- relevant evidence: none
- test duty: `E-P11-1..E-P11-3` -> per-page `vitest run --configLoader runner` files
- verification: all `E-P11-*` pass
- handoff: `H11` -> catalog admin pages at commit `[change_set]`
- review: `R11` -> blocks convergence fan-in

### P12: Admin web pages -- users, orders, feature flags

- mode: parallel with P11 after `GR10`
- depends on: `GR10`
- owns: `apps/web/src/features/admin/users/*` (new), `apps/web/src/features/admin/orders/*` (new), `apps/web/src/features/admin/featureFlags/*` (new), colocated tests
- reads: same as P11
- acceptance: pages render list + detail/edit; suspension form gathers reason; order list filters (status, buyer email, date, promo); admin refund form validates cap client-side + surfaces server error; feature-flag toggle + delete; React integration tests cover happy path per page + last-admin demotion rejection surfaced
- non-goals: catalog pages; App.tsx wiring
- upstream inputs: `H8`, `H9`, `H10`
- changes:
  - implement pages, forms, and integration tests
- invariants: no customer-account-page edits; suspension UI clearly admin-only
- relevant evidence: none
- test duty: `E-P12-1..E-P12-3` -> per-page vitest files
- verification: all `E-P12-*` pass
- handoff: `H12` -> user/order/flag admin pages at commit `[change_set]`
- review: `R12` -> blocks convergence fan-in

### S1: Convergence -- composition + wiring + seed + cross-lane tests

- mode: sequential after `G2`
- depends on: `P1..P12`, `G2`
- owns: `apps/api/src/app.ts`, `apps/web/src/App.tsx`, `apps/api/src/db/seed.ts`, cross-lane test `apps/api/test/adminSurface.integration.test.ts` (new)
- reads: every produced service + route + page module; `H1..H12`
- acceptance: composition root instantiates + registers every new service and route; web Router wires every admin page under `<AdminRoute>`; seed adds a small set of feature flags (`admin.example_flag`) + one suspended user + one clearance window + one deactivated promo without breaking existing counts; cross-lane integration test exercises admin login -> suspend user -> user's session gone -> user login blocked -> reactivate -> login succeeds
- non-goals: further UI polish; new domain behavior
- upstream inputs: `H1..H12`
- changes:
  - wire services + routes in `app.ts`
  - wire admin routes in `App.tsx`
  - extend `seed.ts` idempotently (upsert)
  - author cross-lane integration test
- invariants: idempotent seed; deterministic reset; no mutable module-global state; existing seed counts + demo journey remain valid
- relevant evidence: prior packet evidence IDs `E-P2-1..E-P12-*`
- test duty: `E-S1-1` -> `npm exec -w @shop/api -- tsx --test apps/api/test/adminSurface.integration.test.ts`; `E-S1-2` -> `npm run reset`; `E-S1-3` -> `npm run smoke`
- verification: `E-S1-1..E-S1-3` pass
- handoff: `H-S1` -> integrated admin surface at commit `[change_set]` -> consumed by `G3`
- review: `R-S1` -> blocks `G3`

### Final gate G3

- owner: convergence agent post `GR-S1`
- test duty: `E-G3-1` -> `npm run verify` once after `R-S1` fixes settle
- acceptance: `E-G3-1` pass

## Review Assignments

### R1: Review P1 (schema + audit vocabulary)

- method: invoke `code-reviewer` skill; apply severity gate (critical + high only) + verification-before-reporting; map surviving findings into `reviewer_report_v1`
- target: `P1` -> `[change_set at P1 completion]`
- timing: immediately after P1 report + `E1`/`E2`/`E3` evidence; before any of P2..P7 launches
- blocks: `P2, P3, P4, P5, P6, P7`
- consolidation reason: none
- reads: `apps/api/src/db/migrations/027_admin_surface.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditQuery.ts`
- acceptance: migration ordered + additive; FK-clean; index correct; audit vocabulary matches Target Design
- invariants: append-only; forward-only; audit vocabulary additive
- risk focus: FK collateral on `users` ALTER; feature_flags CHECK clauses; audit vocabulary drift
- non-goals: reviewing domain packets
- write policy: inspect-only
- test policy: assess `E1..E3`; rerun only if stale
- relevant evidence: `E1, E2, E3`
- return: `reviewer_report_v1`

### R2..R7: Review domain packets

- method: invoke `code-reviewer` skill; severity gate + verification-before-reporting
- target (per review): P2..P7 respectively -> `[change_set at packet completion]`
- timing: immediately after each packet report; before contracts (P8)
- blocks: contracts fan-in gate `G1`
- consolidation reason: none (six independent domains, six independent reviews)
- reads (per review, minimum):
  - R2 -> `apps/api/src/features/catalog/productAdminRepository.ts`, `productAdminService.ts`, tests, `productRepository.ts`
  - R3 -> `variantAdminRepository.ts`, `variantAdminService.ts`, tests, `pricing/clearanceRules.ts`, migrations `020`, `024`
  - R4 -> `promoAdminRepository.ts`, `promoAdminService.ts`, tests, `promoRepository.ts`, migration `024`
  - R5 -> `userAdminRepository.ts`, `userAdminService.ts`, `sessionRepository.ts` diff, `authService.ts` diff, tests
  - R6 -> `orderAdminRepository.ts`, `orderAdminService.ts`, `adminRefundService.ts`, tests, `returnService.ts`, `refundGateway.ts`
  - R7 -> `featureFlagRepository.ts`, `featureFlagService.ts`, `featureFlagResolver.ts`, tests, migration `027`
- acceptance: exact service interfaces + audit exactly-once + validation logic + transaction ownership + retire-not-delete respected
- invariants: money integer minor units; retire-not-delete; last-admin protection; audit exactly-once; idempotency preserved; UoW ownership at service layer
- risk focus: silent physical delete; audit misses; validation bypasses; login-suspension gate omissions; refund cap bypass; cache stale on flag write
- non-goals: reviewing sibling packets
- write policy: inspect-only
- test policy: assess `E-Px-*`; rerun only if stale
- relevant evidence: per-packet evidence IDs
- return: `reviewer_report_v1` per review

### R8: Review P8 (contracts)

- method: invoke `code-reviewer` skill
- target: P8 -> `[change_set]`
- timing: after P8 report + `E-P8-1`
- blocks: `P9`
- consolidation reason: single owner of contracts
- reads: every new contract file + `packages/contracts/src/index.ts`, `auth.ts`, `orders.ts`; service handoffs `H2..H7`
- acceptance: schemas cover every admin route; unions match backend enums; index exports include new subpaths
- invariants: no `additionalProperties: true`; no runtime imports; `role` union unchanged
- risk focus: schema drift from service interfaces; missing exports
- non-goals: implementation review
- write policy: inspect-only
- test policy: assess `E-P8-1`
- relevant evidence: `E-P8-1`
- return: `reviewer_report_v1`

### R9: Review P9 (routes)

- method: invoke `code-reviewer` skill
- target: P9 -> `[change_set]`
- timing: after P9 report + `E-P9-*`
- blocks: `P10`
- consolidation reason: single producer of route surface
- reads: every new admin route file + tests; `adminOrders.ts`, `adminReturns.ts`, `reviews.ts` for pattern; `plugins/auth.ts`
- acceptance: `requireAdmin` on every route; TypeBox schemas attached; error mapper covers every domain error; audit context wired
- invariants: admin gate before validation; deterministic error responses
- risk focus: missing admin gate; leaking internal error text; unmapped error codes
- non-goals: composition (S1)
- write policy: inspect-only
- test policy: assess `E-P9-*`
- relevant evidence: `E-P9-1..E-P9-7`
- return: `reviewer_report_v1`

### R10: Review P10 (web shell)

- method: invoke `code-reviewer` skill
- target: P10 -> `[change_set]`
- timing: after P10 report + `E-P10-1`
- blocks: `P11, P12`
- consolidation reason: single owner of shared shell + clients
- reads: shell + API client files + integration test; `AdminReviewModerationPage.tsx`; `AdminRoute.tsx`
- acceptance: clients typed against contracts; shell renders links + protects itself via `AdminRoute`
- invariants: typed clients; no ad-hoc `fetch` bypassing contract types; `credentials: 'include'`
- risk focus: untyped requests; missing `AdminRoute` wrap; navigation leaks
- non-goals: page implementations
- write policy: inspect-only
- test policy: assess `E-P10-1`
- relevant evidence: `E-P10-1`
- return: `reviewer_report_v1`

### R11, R12: Review web page packets

- method: invoke `code-reviewer` skill
- targets: P11, P12 -> `[change_sets]`
- timing: after each page packet report + evidence
- blocks: `S1`
- consolidation reason: none
- reads: each page packet's files + tests; shell + API clients + contracts
- acceptance: happy-path integration tests exist; loading/empty/error states rendered; retire/suspend actions server-authoritative
- invariants: server-authoritative validation; no client-only invariants
- risk focus: silent form failures; missing loading state; role bypass attempts
- non-goals: composition (S1)
- write policy: inspect-only
- test policy: assess `E-P11-*`, `E-P12-*`
- relevant evidence: per-page evidence IDs
- return: `reviewer_report_v1` per review

### R-S1: Review S1 (convergence)

- method: invoke `code-reviewer` skill
- target: S1 -> `[change_set]`
- timing: after S1 report + `E-S1-*`
- blocks: `G3`
- consolidation reason: single integration
- reads: `apps/api/src/app.ts` diff, `apps/web/src/App.tsx` diff, `apps/api/src/db/seed.ts` diff, `apps/api/test/adminSurface.integration.test.ts`
- acceptance: every service + route wired; every page routed; seed idempotent; cross-lane test asserts suspend->session-cleared->login-blocked->reactivate flow
- invariants: idempotent seed; deterministic reset; no mutable module-global state
- risk focus: missing route registration; broken existing customer journey; seed count drift
- non-goals: further packet review
- write policy: inspect-only
- test policy: assess `E-S1-*`; rerun only if stale
- relevant evidence: `E-S1-1..E-S1-3`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/api/src/db/migrations/027_admin_surface.ts`: P1 sole owner
- `apps/api/src/db/migrations/index.ts`: P1 sole edit (append entry)
- `apps/api/src/features/audit/auditEvent.ts`, `auditQuery.ts`: P1 sole owner (all new actions land here; downstream packets only read)
- `apps/api/src/features/auth/authService.ts`: P5 sole editor (narrow suspension gate); other packets read only
- `apps/api/src/features/auth/sessionRepository.ts`: P5 sole editor (add `deleteByUserId`)
- `packages/contracts/src/index.ts`, `packages/contracts/src/auth.ts`, `packages/contracts/src/orders.ts`: P8 sole editor
- `apps/api/src/app.ts`, `apps/web/src/App.tsx`, `apps/api/src/db/seed.ts`: S1 sole editor
- migration reservation: `027` reserved by P1 (item 7 owns `025` + `026` in parallel worktree); numbering resolved pre-runtime
- contract producer -> consumer: P8 produces -> P9 + P10 + P11 + P12 consume
- schema producer -> consumer: P1 produces -> P5 (user columns) + P7 (feature_flags) consume; P2/P3/P4/P6 consume audit vocabulary only

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch globally configured `reviewer` agent for review assignments; resolve model + reasoning + developer instructions from global Codex settings; never override in plan or assignment
- non-Codex harnesses: ignore Codex binding; use harness-native worker/reviewer wiring while preserving responsibilities + communication contracts
- all harnesses: reviewer agent runs `code-reviewer` skill; assignment sets `review_skill=code-reviewer`; reviewer invokes it explicitly by name via Skill tool

## Test Execution Schedule

- `E1..E3`: after P1 changes settle -> owner P1 -> `npm run typecheck`, `npm exec -w @shop/api -- tsx --test apps/api/src/features/audit/auditEvent.test.ts`, `npm run reset`
- `E-P2-1..E-P7-1..E-P7-1`: after each domain packet -> owner respective packet -> targeted focused `tsx --test <path>` command
- `E-P8-1`: after P8 -> owner P8 -> `npm run typecheck -w @shop/contracts`
- `E-P9-1..E-P9-7`: after P9 -> owner P9 -> per-file `tsx --test apps/api/test/admin*.integration.test.ts`
- `E-P10-1`: after P10 -> owner P10 -> `vitest run --configLoader runner apps/web/src/features/admin/AdminLayout.test.tsx`
- `E-P11-*`, `E-P12-*`: after each page packet -> owner respective packet -> per-page `vitest run`
- `E-S1-1..E-S1-3`: after S1 -> owner S1 -> cross-lane integration + `npm run reset` + `npm run smoke`
- `E-G3-1`: after `R-S1` closes -> owner convergence -> `npm run verify` once
- policy: automated repository commands only; no browser session, screenshot, or manual UI verification in any entry
- reuse: valid evidence carries forward across sessions; new session alone never invalidates
- invalidation: touching `apps/api/src/db/migrations/**` -> invalidate `E3`, `E-S1-*`, `E-G3-1`; touching `apps/api/src/features/audit/**` -> invalidate `E2`, `E-P*` for any packet using audit actions; touching `packages/contracts/src/**` -> invalidate `E-P8-1`, `E-P9-*`, `E-P10-1`, `E-P11-*`, `E-P12-*`; touching `apps/api/src/app.ts` or `apps/web/src/App.tsx` or `seed.ts` -> invalidate `E-S1-*`, `E-G3-1`

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages + JSON string values
- transport: inline canonical JSON; temp artifact references only under skill protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`)
- reviewer assignment: `reviewer_assignment_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-assignment.json`)
- follow-up: `orchestrator_directive_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-directive.json`)
- worker return: `worker_report_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-report.json`)
- reviewer return: `reviewer_report_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-report.json`)
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1` (template `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-run-state.json`)
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- worktree context: every assignment includes absolute path + implementation branch + base revision; every repository-relative path resolves under worktree root

## Orchestrator Run Order

1. End planning context after saving plan
2. Start fresh runtime orchestrator; load source-checkout repository instructions, plan, canonical contracts, current checkpoint
3. Record current source branch + `HEAD`; handle detached `HEAD` or uncommitted-input blocker under worktree contract
4. Create dedicated implementation branch + worktree from recorded source branch `HEAD`; persist worktree identity
5. Switch runtime execution root to worktree; load applicable repository instructions from worktree
6. Validate `G0`: Node 22 present, `npm ci` clean, `npm run reset` passes
7. Launch P1 worker; on report accept run R1; close `GR1`
8. Launch P2 || P3 || P4 || P5 || P6 || P7 workers inside worktree with role-minimum context
9. Accept each report; update checkpoint/evidence; launch respective reviewer per packet before any downstream consumption
10. Route stable findings to fresh workers; close after targeted evidence. Do not re-review fixes. Validate `G1` fan-in
11. Launch P8; run R8; close `GR8`. Launch P9; run R9; close `GR9`. Launch P10; run R10; close `GR10`
12. Launch P11 || P12; run R11 || R12; close `G2` fan-in
13. Launch S1; run R-S1; close `GR-S1`
14. Validate `G3` via `npm run verify` (single run after all fixes settle)
15. Leave implementation branch + worktree intact. Reply with absolute worktree path, implementation branch, source branch, base revision. State user owns merge.

## Risks and Open Questions

- risk: `authService.login` narrow edit in P5 conflicts with item 7's session/login work -> mitigation: P5 restricts edit to a single guarded early-return; user reviews merged diff
- risk: `packages/contracts/src/index.ts` collision with concurrent contract additions -> mitigation: P8 sole owner in this plan; if conflict, user hand-merges
- risk: `apps/api/src/features/audit/auditEvent.ts` `AUDIT_ACTIONS` array collision with item 7's additive audit actions -> mitigation: additive edits at end of literal array; user hand-merges (both plans preserve full existing union)
- risk: audit ledger insert-only growth from admin churn -> mitigation: no eviction here; deferred to future retention task
- risk: `role` enum expansion pressure from item 7 (approver/buyer) -> mitigation: this plan freezes union to `'customer' | 'admin'`; item 7 owns any expansion
- question: user-facing operational README for admin credentials + how to launch admin flow -> owner: convergence S1; add short human-facing note to top-level README
- question: whether feature flags should be exposed to web bootstrap (`GET /api/feature-flags`) for client-side rendering -> owner: user before P7; assumption baseline = admin-only, no public read

## Done Criteria

- every admin capability in Scope In reachable via `/admin/*` under `<AdminRoute>` for `role='admin'` users; blocked for others
- every admin mutation writes exactly one audit event with actor + requestId
- retire-not-delete honored for products + variants referenced by orders
- suspending a user clears their sessions + blocks future logins
- last remaining admin cannot be demoted or suspended
- admin refund never exceeds captured payment balance
- clearance write validated against `resolveClearance` before commit
- promo write validated against migration `024` CHECK constraints server-side
- feature-flag resolver serves current values with cache invalidated on write
- `npm run verify` passes after S1 fixes settle
- migration `027` idempotent; `npm run reset` succeeds; FK-clean
- customer-facing journey unchanged; existing seed counts stable
- README updated with admin credentials + admin nav entry point
- worktree remains intact for user merge
