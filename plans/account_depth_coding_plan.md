# Account Depth Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` item 7 "Account depth"
Repository baseline: branch `expansion_002` @ `8285c62`

## Runtime Worktree

- source -> current branch (`expansion_002`) + `HEAD` (`8285c62`) recorded before any implementation write
- create -> dedicated implementation branch + worktree from recorded `HEAD` before first write
- execution root -> every worker, reviewer, fix, test, convergence action runs in worktree
- integration -> no auto merge, rebase, cherry-pick, copy-back, or cleanup; user handles merge
- completion reply -> absolute worktree path + implementation branch + source branch + base revision
- parallel note -> item 9 (Secondary admin) plan runs in separate worktree from same source `HEAD`; item 7 must not touch item-9-owned files (see Ownership and Collision Rules)

## Objective

Close item 7 remaining scope -> ship 4 self-service account slices (session list + selective revocation, notification preferences, data export, account deletion) plus B2B addition (company accounts with buyer/approver membership + order-approval threshold gating checkout). Additive over existing auth + trade-account + checkout foundations; no rewrite of shipped surfaces.

## Scope

### In

- session list + selective revocation for authenticated buyer over own sessions
- notification preferences record (email opt-ins) with GET/PATCH self-service
- data export -> JSON snapshot of buyer's own profile, sites, billing entities, orders, favourites, blends, sessions summary, preferences; email-delivered via dev mailbox link
- account deletion -> password-confirmed self-request; retire buyer records (sites, billing entities, favourites, sessions, preferences, custom blends), redact PII on `users` row (email + display_name hashed placeholders), preserve orders/payments/returns for commerce integrity, audit trail
- company_accounts + company_memberships tables; buyer role + approver role; owner-invite/accept flow via existing dev mailbox
- per-company order-approval threshold (`approvalThresholdCents`); at checkout, if buyer is company `buyer` and cart total >= threshold, defer to `PENDING_APPROVAL` result (no order, no payment, no reservation); approver reviews snapshot -> approves/rejects; approved -> buyer re-submits same idempotency key -> checkout proceeds
- audit ledger entries for every new mutation (session revoked, preferences changed, export requested, deletion completed, company created, member added/removed/role-changed, threshold changed, approval requested/approved/rejected)
- React UI sections on `AccountPage`, new `/account/company` + `/account/approvals` routes
- automated tests: unit (rules), SQLite integration (repositories + services), Fastify `app.inject()` (routes), React integration (`vitest`) for new UI surfaces

### Out

- admin CRUD on users, admin role assignment, admin-forced user suspend/reactivate (owned by item 9)
- localisation, multi-currency (item 10)
- notification transport beyond dev mailbox (item 8 async)
- reorder / saved lists / quick order (items 12-14)
- back-in-stock notify (item 15)
- company-scoped catalog, per-company pricing, RFQ, quotes, login-to-see-price (rejected)
- SSO / OAuth / password-manager integration
- 2FA
- session live-refresh via websocket
- approver-completes-payment flow (buyer re-submits after approval)
- delete-orders / hard-delete rows (integrity preserved)

## Repository Findings

- existing: `apps/api/src/features/auth/sessionRepository.ts` -> `SessionRepository` has `create/findUser/delete/deleteForUser/deleteOtherForUser`; missing `listByUser`, `deleteByIdForUser`, `updateLastSeen`
- existing: `apps/api/src/features/auth/sessionService.ts` -> `SessionService.invalidateAllForUser/invalidateOtherForUser`; no per-id revocation
- existing: `apps/api/src/plugins/auth.ts` -> `requireAuth`, `requireAdmin`, `requireCustomer`; cookie name `sid`
- existing: `apps/api/src/routes/auth.ts` -> holds `/signup`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/me`, `/password`
- existing: `apps/api/src/features/tradeAccount/*` -> retire-not-delete pattern with `active = 0` + partial unique indexes; `MAX_DELIVERY_SITES_PER_USER = 25`; ownership-scope-on-`(userId, id)` returning `NOT_FOUND` for foreign records; reuse pattern for company memberships + audit-safe non-disclosure
- existing: `apps/api/src/db/migrations/023_trade_delivery_and_checkout_depth.ts` -> reference for partial unique index + FK-check ceremony + `ADDRESS_COLUMNS` reuse pattern
- existing: `apps/api/src/features/checkout/checkoutService.ts::resolveCommitments` -> server-side commitment resolution happens inside preparation transaction before reservation; approval gate slots in immediately after `resolveCommitments` returns
- existing: `apps/api/src/features/checkout/checkoutTypes.ts::CheckoutErrorCode` + `CheckoutResult` union -> discriminated union already accommodates specialized shapes; new `PENDING_APPROVAL` variant carrying `approvalRequestId` extends it without breaking payment path
- existing: `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS` const array + typed `AuditEventInput` discriminated union; new actions extend both arrays
- existing: `apps/api/src/db/migrations/index.ts` -> ordered migration registry; append versions `025` + `026` in order
- existing: `apps/api/src/app.ts` -> composition root; adds services in `createAppServices` and registers routes at bottom
- existing: `apps/api/src/db/seed.ts` -> `USERS` const seeds `alice`, `bob`, `admin`; `role: 'customer' | 'admin'`
- existing: `apps/web/src/features/account/AccountPage.tsx` -> section-list layout with delivery sites + billing entities; add new sections at bottom
- existing: `apps/web/src/App.tsx` -> `Routes` array; add new protected routes for company + approvals pages
- existing: `apps/web/src/hooks/AuthContext.tsx` -> `user`, `logout`; approver role is not a `PublicUser.role` (which stays `'customer' | 'admin'`); membership role lives on separate company-membership resource loaded per-page
- gap: no per-session metadata (user agent, ip hash, last seen) -> `sessions` table gains columns
- gap: no `user_preferences` table; no preferences service or route
- gap: no data export code path
- gap: no self-deletion path; only admin-directed cascade via `ON DELETE CASCADE` on `users.id`
- gap: no company / membership / approval domain
- gap: `checkoutService.prepare` has no threshold gate
- constraint: retire-not-delete for records referenced by historic orders (`delivery_sites`, `billing_entities`); apply same rule to company_accounts referenced by pending approvals or historic orders
- constraint: money in integer minor units (`packages/contracts/src/pricing.ts`)
- constraint: migrations forward-only, ordered, transactional, FK-clean (`023` template)
- constraint: `PublicUser.role` (`'customer' | 'admin'`) is stable transport contract; do not repurpose it for membership role — carry membership role as separate resource
- constraint: cookie serialization stays in `plugins/auth.ts::createSession`; new session endpoints must not duplicate cookie logic
- constraint: local SQLite is disposable -> destructive column additions on `sessions` OK; still transactional + FK-clean
- reuse: `tradeAccount` retire pattern -> apply verbatim to `company_accounts` + `company_memberships`
- reuse: `AUDIT_ACTIONS` typed discriminated union pattern -> extend for new domain events
- reuse: `checkoutService.resolveCommitments` transaction seam -> insert approval gate at same point
- reuse: `useTradeProfile` hook shape -> mirror for `useSessions`, `usePreferences`, `useCompany`, `useApprovals`
- reuse: `dev_mailbox` (`mailboxRepository`) for approver notification + export delivery
- reuse: existing `unitOfWork.run` transaction wrapper for every audited mutation

## Decisions and Invariants

- backend authoritative: session validity, preferences, deletion state, company membership + role, approval threshold, approval decisions; frontend never trusts a locally cached membership role for a gate
- transaction: session revoke = single-statement; preferences update = txn (upsert + audit); deletion = txn (retire dependents + PII redact + session purge + audit); company creation = txn (insert account + insert owner membership + audit); approval decision = txn (transition status + audit)
- non-disclosure: `SESSION_NOT_FOUND`, `COMPANY_NOT_FOUND`, `MEMBERSHIP_NOT_FOUND`, `APPROVAL_NOT_FOUND`, `PREFERENCES_UNKNOWN`, `EXPORT_UNKNOWN` all return `404` and do not distinguish absence from foreign ownership
- session revocation: cannot revoke current session via list endpoint (use `/logout`); attempt returns `400 CANNOT_REVOKE_CURRENT`
- preferences shape: `{ orderUpdatesEmail: boolean, marketingEmail: boolean, approvalRequestEmail: boolean }`; unknown keys rejected by TypeBox; approval-request bool applies only to approvers (silently ignored for non-approvers, still stored)
- data export: synchronous JSON payload delivered inline in response; also mailed to buyer's registered email via `dev_mailbox` with a subject line; snapshot excludes password hashes, payment fingerprints, salts, session tokens (session summaries only)
- account deletion: irreversible for the caller; PII fields on `users` row overwritten with deterministic tombstone (`deleted-<userId>@tombstone.local`, `Deleted User`); `role` unchanged; historic orders + payments + returns keep foreign key to `users.id` (no cascade); all live sessions purged; preferences row deleted; delivery sites + billing entities + company memberships owned by user retired (`active = 0`); custom blend cart items removed; favourites deleted; open company owner memberships block deletion unless ownership transferred first (`OWNS_COMPANY` -> 409)
- company account: exactly one owner per company at creation (creator user); owner is stored as membership row `role = 'owner'` (invariant: exactly one active `owner` per active company); owner has implicit approver + buyer privileges; explicit approver role does not have buyer privileges by default; add-member is invite-by-existing-user-id or invite-by-email (email path creates pending invite record + dev mailbox entry, buyer/approver accepts on next login to become member)
- membership roles: enum `('owner' | 'buyer' | 'approver')`; a user may hold at most one active membership per company; a user may be a member of at most one company (multi-company complexity not planned)
- threshold: single `approval_threshold_cents INTEGER` per company; `NULL` = never require approval; `0` = always require approval; positive integer = approval required when order total meets or exceeds threshold; only owner changes threshold; audit records old + new
- checkout approval gate: activates only when `params.userId` resolves to an active `buyer` (or `owner`) membership + threshold triggered by quote total; approval gate fires after `resolveCommitments` succeeds + before any reservation is taken; on gate hit, `checkoutService` releases any pre-gateway payment reservation, transitions payment row to `failed_pre_gateway` with reason `PENDING_APPROVAL`, creates an `order_approvals` row snapshotting the resolved commitments + cart id + idempotency key + quote total, appends `approval.requested` audit event, mails company approvers via `dev_mailbox`, returns `{ success: false, error: 'PENDING_APPROVAL', approvalRequestId }`; no cart mutation
- approval decision: `pending -> approved` or `pending -> rejected`; both are terminal; approver must have active `approver` or `owner` membership on same company as approval; approver id recorded; approved approval enables one same-idempotency-key retry within `APPROVAL_LEASE_MS` (24 h); rejected approval is terminal (retry returns `APPROVAL_REJECTED`)
- checkout retry after approval: buyer POSTs `/checkout` with same `idempotencyKey`; `resolveCommitments` re-runs against current live records; if approval row is `approved` + not expired + `approval_request_id` matches, gate passes; otherwise re-defer or reject
- assumption (validate at `G0`): no admin-forced session-termination endpoint required in item 7 scope; if item 9 needs it, item 9 adds a new route that calls `services.sessions.invalidateAllForUser` (already exists); interface unchanged
- resolved (pre-runtime): item 7 owns migrations `025` (self-service) + `026` (company + approvals); item 9 shifted to `027`; item 9 will NOT touch `sessions` schema, `checkoutService.ts`, or `contracts/payments.ts`; item 9 WILL add `suspended_at` + `suspension_reason` + `suspended_by_user_id` columns to `users` in its `027` migration -> item 7 deletion path (`P6`) must zero those columns during PII redact when present at merge time (additive at merge; not a runtime blocker in this worktree since column is absent here)
- resolved (pre-runtime): `PublicUser` transport shape stays `{ id, email, displayName, role }` where `role` remains `'customer' | 'admin'`; membership role stays out-of-band per-request; item 9 confirms same role union

## Target Design

### Schema (migration 025 self-service)

- `sessions` -> add columns via `ALTER TABLE ADD COLUMN`: `user_agent TEXT`, `ip_address_hash TEXT`, `last_seen_at TEXT`; backfill `last_seen_at = created_at` for existing rows; column additions nullable so no rebuild
- new `user_preferences` -> `(user_id INTEGER PK REFERENCES users(id) ON DELETE CASCADE, order_updates_email INTEGER NOT NULL DEFAULT 1 CHECK (order_updates_email IN (0,1)), marketing_email INTEGER NOT NULL DEFAULT 0 CHECK (marketing_email IN (0,1)), approval_request_email INTEGER NOT NULL DEFAULT 1 CHECK (approval_request_email IN (0,1)), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
- new `account_deletion_events` -> `(id PK, user_id INTEGER NOT NULL, requested_at TEXT NOT NULL, completed_at TEXT NOT NULL, tombstone_email TEXT NOT NULL, tombstone_display_name TEXT NOT NULL)` — historical trail; not FK-cascading; `users.id` stays valid post-redaction
- FK check + no `foreign_keys` toggle inside transaction (runner owns it)

### Schema (migration 026 company + approvals)

- new `company_accounts` -> `(id PK, name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160), created_by_user_id INTEGER NOT NULL REFERENCES users(id), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), approval_threshold_cents INTEGER CHECK (approval_threshold_cents IS NULL OR approval_threshold_cents >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- new `company_memberships` -> `(id PK, company_id INTEGER NOT NULL REFERENCES company_accounts(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner','buyer','approver')), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), created_at TEXT NOT NULL)`; partial unique index `(company_id, user_id) WHERE active = 1`; partial unique index `(company_id) WHERE role = 'owner' AND active = 1`; partial unique index `(user_id) WHERE active = 1` (one-active-company-per-user invariant)
- new `company_invites` -> `(id PK, company_id INTEGER NOT NULL REFERENCES company_accounts(id), email TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('buyer','approver')), token_digest TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')), expires_at TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT)`; partial unique `(company_id, email) WHERE status = 'pending'`
- new `order_approvals` -> `(id PK, company_id INTEGER NOT NULL REFERENCES company_accounts(id), requested_by_user_id INTEGER NOT NULL REFERENCES users(id), cart_id TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, quote_total_cents INTEGER NOT NULL, delivery_site_id INTEGER REFERENCES delivery_sites(id), delivery_address_json TEXT NOT NULL, billing_entity_json TEXT NOT NULL, delivery_slot_date TEXT NOT NULL, delivery_slot_window TEXT NOT NULL CHECK (delivery_slot_window IN ('am','pm')), purchase_order_reference TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')), approved_by_user_id INTEGER REFERENCES users(id), decision_reason TEXT, requested_at TEXT NOT NULL, resolved_at TEXT, lease_expires_at TEXT NOT NULL)`; index `(company_id, status)`; index `(idempotency_key)`
- no changes to `orders` table -> pending approval is not an order; snapshot lives on `order_approvals`

### Contracts (packages/contracts additions)

- new file `packages/contracts/src/accountDepth.ts` -> `SessionSummary`, `SessionListResponse`, `RevokeSessionParams`, `UserPreferences`, `UpdatePreferencesBody`, `DataExportResponse`, `DeleteAccountBody`
- new file `packages/contracts/src/companyAccounts.ts` -> `Company`, `CompanyMembershipRole`, `CompanyMembership`, `CompanyInvite`, `CreateCompanyBody`, `InviteMemberBody`, `AcceptInviteBody`, `UpdateThresholdBody`, `RevokeMembershipParams`, subpath export `@shop/contracts/company-accounts`
- new file `packages/contracts/src/orderApprovals.ts` -> `OrderApproval`, `OrderApprovalStatus`, `ApprovalListResponse`, `ApprovalDecisionBody`, `PendingApprovalResult` extension for checkout, subpath export `@shop/contracts/order-approvals`
- edit `packages/contracts/src/index.ts` -> re-export new modules (single append region); NOTE shared with item 9

### Backend (auth / preferences / export / deletion)

- `sessionRepository.listByUser(userId)` -> `SessionSummaryRow[]` (`token`, `created_at`, `expires_at`, `user_agent`, `ip_address_hash`, `last_seen_at`); ordered `last_seen_at DESC NULLS LAST, created_at DESC`
- `sessionRepository.deleteByIdForUser(userId, tokenHashPrefix)` -> `boolean`; identifies by short prefix (first 12 hex chars) to avoid exposing full token in URLs; scope by `userId`; rejects self-session by comparing full request cookie
- `sessionRepository.updateLastSeen(token, isoNow)` -> optional plugin hook in `authPlugin` on authenticated request; write throttled by `>= 60 s` since previous `last_seen_at`
- `preferencesRepository` -> `get(userId)`, `upsert(userId, patch)`; SQLite `INSERT ... ON CONFLICT(user_id) DO UPDATE`
- `preferencesService` -> `get`, `update`; returns defaults for absent row
- `dataExportService.build(userId)` -> assembles snapshot object from repositories (user, sites, billing entities, orders + line items + snapshots, favourites, custom blends configured, sessions summary, preferences, company memberships); mails buyer via `mailboxRepository.add` with subject `"QArefully Materials Exchange — data export"`; returns snapshot inline
- `accountDeletionService.execute(userId, currentPassword)` -> verifies password via `authService`, refuses if `OWNS_COMPANY` active, retires trade records + memberships, purges sessions + preferences + favourites + custom blend cart lines, redacts `users` row PII, writes `account_deletion_events` row, audits `auth.account_deleted`; single txn

### Backend (company accounts + memberships)

- `companyRepository` -> `create`, `findById`, `updateThreshold`, `retire`, `findActiveByUser(userId)` returning `{company, membership}` for auth-time enrichment
- `companyMembershipRepository` -> `create`, `listActiveByCompany`, `findActiveByCompanyUser`, `retire`, `changeRole`
- `companyInviteRepository` -> `create`, `findByTokenDigest`, `listPendingByCompany`, `markAccepted`, `markRevoked`, `expireStale(now)`
- `companyService` -> `createCompany(userId, name)` (blocks if user already has active membership), `inviteMember(userId, companyId, email, role)` (owner-only), `acceptInvite(userId, tokenPlain)` (matches by digest, creates membership row, marks invite accepted), `changeMemberRole` (owner-only, cannot demote sole owner), `revokeMember` (owner-only or self), `updateThreshold(userId, companyId, thresholdCents)` (owner-only, audit old + new)
- audit actions extended: `company.created`, `company.member_invited`, `company.member_joined`, `company.member_revoked`, `company.member_role_changed`, `company.threshold_changed`
- routes: `/api/company` (GET, POST), `/api/company/members` (GET), `/api/company/members/:membershipId` (PATCH role, DELETE), `/api/company/invites` (GET, POST, DELETE `/:inviteId`), `/api/company/invites/accept` (POST body `{token}`), `/api/company/threshold` (PATCH)

### Backend (order approvals + checkout gate)

- `approvalRepository` -> `create`, `findById`, `findByIdempotencyKey`, `listPendingByCompany`, `transition({id, expectedStatus, nextStatus, approvedByUserId, decisionReason, resolvedAt})`, `expireStale(now)`
- `approvalService` -> `evaluate({userId, cartId, quoteTotalCents, resolvedCommitments, idempotencyKey})` returns `{gate:'pass'}` | `{gate:'defer', approvalRequestId}` | `{gate:'pass', approvedApprovalRequestId}` (buyer retry path); `decide(userId, approvalId, 'approve'|'reject', reason?)`; audit `approval.requested`, `approval.approved`, `approval.rejected`
- checkout integration point: `checkoutService.prepare` -> after `resolveCommitments` succeeds + before `dependencies.carts.reserve`, call `approvalService.evaluate`; on `defer`, roll back preparation via same `failPreparation` seam using new `CheckoutErrorCode = 'PENDING_APPROVAL'`; result variant `{ success: false, error: 'PENDING_APPROVAL', approvalRequestId }`; on retry with matching `idempotencyKey`, `evaluate` returns `pass` when approval row exists + status `approved` + not expired + total unchanged; on total drift beyond a `1%` tolerance, force new approval (`APPROVAL_TOTAL_DRIFT`)
- rejected approval on retry -> `error: 'APPROVAL_REJECTED'`; expired -> `error: 'APPROVAL_EXPIRED'`
- checkout dependencies gain `approvals: ApprovalService` + `companies: CompanyService`
- routes: `/api/approvals` (GET list scoped to approver's company), `/api/approvals/:approvalId` (GET detail), `/api/approvals/:approvalId/decision` (POST body `{action: 'approve'|'reject', reason?: string}`), buyer-side `/api/approvals/mine` (GET pending + resolved for buyer's own requests)

### Frontend

- `apps/web/src/api/*` -> typed clients validating responses against contracts: `accountSessions.ts`, `accountPreferences.ts`, `accountExport.ts`, `accountDeletion.ts`, `companyAccounts.ts`, `orderApprovals.ts`
- `apps/web/src/features/account/` -> new sections mounted on `AccountPage`: `SessionsSection`, `PreferencesSection`, `DataExportSection`, `DeleteAccountSection`, `CompanyMembershipSection` (shows the buyer's active membership + role + company + threshold if visible)
- `apps/web/src/features/company/CompanyPage.tsx` -> route `/account/company` (protected); owner sees members + invites + threshold controls; non-owner member sees read-only
- `apps/web/src/features/approvals/ApprovalsPage.tsx` -> route `/account/approvals` (protected); approver sees pending list + decision UI; buyer sees own requests
- `apps/web/src/features/checkout/CheckoutPage.tsx` -> handle new `PENDING_APPROVAL` response: display "Awaiting approval from ${approverCount} approvers"; do not clear cart; provide link to `/account/approvals`; handle `APPROVAL_REJECTED`, `APPROVAL_EXPIRED`, `APPROVAL_TOTAL_DRIFT`
- `apps/web/src/App.tsx` -> add `<Route path="/account/company"...>` and `<Route path="/account/approvals"...>` under `<ProtectedRoute>`

## Execution Graph

`G0 -> P1 -> R1 -> GR1 -> P2 -> R2 -> GR2 -> {P3 -> R3 -> GR3 || P4 -> R4 -> GR4 || P5 -> R5 -> GR5 || P6 -> R6 -> GR6 || P7 -> R7 -> GR7} -> G1 -> P8 -> R8 -> GR8 -> G2 -> {P9 -> R9 -> GR9 || P10 -> R10 -> GR10} -> G3 -> S1 -> R11 -> GR11 -> G4`

- `G0`: worktree created; source branch + `HEAD` recorded; assumption checks confirmed with user
- `GR1`: migration 025 + 026 reviewed (high-risk producer; blocks every consumer)
- `GR2`: contracts additions reviewed (public transport surface)
- `GR3`-`GR7`: parallel backend slice reviews; each blocks its own downstream route/UI consumer
- `G1`: fan-in acceptance across P3..P7; all lane reviews closed
- `GR8`: checkout-integration review (high-risk producer -- edits `checkoutService.ts`, `checkoutTypes.ts`)
- `G2`: back-end complete + reviewed; unlock UI lanes
- `GR9`, `GR10`: parallel UI reviews
- `G3`: front-end fan-in accepted
- `GR11`: convergence review (app.ts wiring, seed additions, full flow test)
- `G4`: completion gate; final broad `npm run verify` once

## Work Packets

### P1: Schema migrations 025 + 026

- mode: sequential; first packet after `G0`
- depends on: `G0`
- owns:
  - `apps/api/src/db/migrations/025_account_self_service.ts` (proposed)
  - `apps/api/src/db/migrations/026_company_accounts_approvals.ts` (proposed)
  - `apps/api/src/db/migrations/index.ts` (append both entries)
- reads:
  - `apps/api/src/db/migrations/023_trade_delivery_and_checkout_depth.ts` -> `ADDRESS_COLUMNS`, `assertForeignKeysClean`, retire pattern -> reuse template + partial unique index style
  - `apps/api/src/db/migrations/020_retire_legacy_variants.ts` -> retire-not-delete precedent
  - `apps/api/src/db/migrate.ts` -> `Migration` type; runner FK-suspension contract
  - `apps/api/src/db/migrations/index.ts` -> ordered registry to extend
- acceptance:
  - `npm run reset -w @shop/api` succeeds; `PRAGMA foreign_key_check` clean after each migration
  - `sessions` gains `user_agent`, `ip_address_hash`, `last_seen_at`; existing rows backfilled `last_seen_at = created_at`
  - new tables created with declared CHECK constraints + partial unique indexes
  - migration index array lists `025` then `026` after `024`
- non-goals: seed data (S1 owns); repositories (later packets own)
- upstream inputs: none
- changes:
  - author `025_account_self_service.ts` (three `ALTER TABLE sessions ADD COLUMN` guarded by `hasColumn`, UPDATE backfill for `last_seen_at`, create `user_preferences`, create `account_deletion_events`, FK check per step)
  - author `026_company_accounts_approvals.ts` (create `company_accounts`, `company_memberships` + 3 partial unique indexes + `(user_id, active)` index, `company_invites` + partial unique + FK check, `order_approvals` + indexes, FK check per step)
  - register both migrations in `index.ts` after `024`
- invariants: append-only migration order; no edit to landed migrations; runner-owned FK suspension; single transaction per migration
- relevant evidence: none
- test duty: `E1` = `npm run reset -w @shop/api` (fresh DB, runs full migration ladder); `E2` = `npm exec -w @shop/api -- tsx --test apps/api/test/db/migrations.integration.test.ts` if such a file exists (worker discovers; otherwise adds targeted assertion via `sqlite_master` introspection in `apps/api/test/db/accountDepthSchema.integration.test.ts` proposed)
- verification: `E1` pass; introspection assertion on new tables + columns
- handoff: schema baseline for every downstream packet; interface = new tables + columns
- review: `R1` -> mandatory high-risk producer review before `P2` launches

### P2: Contracts additions

- mode: sequential after `GR1`
- depends on: `GR1`
- owns:
  - `packages/contracts/src/accountDepth.ts` (proposed)
  - `packages/contracts/src/companyAccounts.ts` (proposed)
  - `packages/contracts/src/orderApprovals.ts` (proposed)
  - `packages/contracts/src/index.ts` (append re-exports in single region)
  - `packages/contracts/package.json` (add subpath exports `./account-depth`, `./company-accounts`, `./order-approvals`)
- reads:
  - `packages/contracts/src/auth.ts` -> `PublicUser`, `SuccessResponse` reuse
  - `packages/contracts/src/address.ts` -> `PostalAddress` reuse
  - `packages/contracts/src/tradeAccount.ts` -> Trade schema conventions
  - `packages/contracts/src/orders.ts` -> `Order` shape for export payload
  - `packages/contracts/src/payments.ts` -> `CheckoutResult` extension seam
- acceptance:
  - new schemas compile (`npm run typecheck -w @shop/contracts`)
  - subpath imports resolve (`import {...} from '@shop/contracts/account-depth'`)
  - PENDING_APPROVAL variant added to checkout result union without breaking existing narrowing
- non-goals: server implementations; UI consumers
- upstream inputs: `P1` -> `026` -> approval columns dictate `OrderApproval` schema
- changes:
  - author each contract module using TypeBox `Type.Object`/`Type.Union` matching existing style
  - extend `CheckoutResult` union in `packages/contracts/src/payments.ts` (owned edit here) to include `{success:false, error:'PENDING_APPROVAL', approvalRequestId: string}`, `{success:false, error:'APPROVAL_REJECTED'}`, `{success:false, error:'APPROVAL_EXPIRED'}`, `{success:false, error:'APPROVAL_TOTAL_DRIFT'}`
  - re-export from `packages/contracts/src/index.ts`
  - add subpath exports in `packages/contracts/package.json`
- invariants: additive-only; no breaking edit to existing exports; TypeBox + `Static` derivation matches conventions
- relevant evidence: `E1` from `P1`
- test duty: `E3` = `npm run typecheck -w @shop/contracts`; `E4` = `npm run build --workspaces --if-present` (contracts consumers still typecheck)
- verification: both pass
- handoff: transport surface locked for every backend + UI consumer
- review: `R2` -> mandatory producer review before `P3..P7` fan out

### P3: Sessions self-service (list + selective revoke)

- mode: parallel with `P4..P7` after `GR2`
- depends on: `GR2`
- owns:
  - `apps/api/src/features/auth/sessionRepository.ts` (extend)
  - `apps/api/src/features/auth/sessionService.ts` (extend)
  - `apps/api/src/routes/accountSessions.ts` (proposed)
  - `apps/api/src/plugins/auth.ts` (add `last_seen_at` update hook; extend `AuthenticatedRequest` decorator only if needed)
  - `apps/api/test/auth/sessionManagement.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/auth/sessionRepository.ts` -> existing methods to extend
  - `apps/api/src/features/auth/sessionService.ts` -> existing invalidation methods
  - `packages/contracts/src/account-depth` -> `SessionSummary`, `SessionListResponse`, `RevokeSessionParams`
  - `apps/api/src/plugins/auth.ts` -> `requireAuth`, `authPlugin` hook seam
  - `apps/api/test/auth/auth.integration.test.ts` -> harness pattern
- acceptance:
  - `GET /api/account/sessions` returns caller's active sessions (short-prefix identifier, created_at, expires_at, last_seen_at, user_agent, ip_address_hash, `isCurrent: boolean`); ordered newest first
  - `DELETE /api/account/sessions/:sessionId` revokes matching session owned by caller; returns `200` on success, `400 CANNOT_REVOKE_CURRENT` on self-target, `404 SESSION_NOT_FOUND` on unknown or foreign
  - `authPlugin` writes `sessions.last_seen_at` when authenticated + previous write is `>= 60 s` ago
  - audit event `auth.session_revoked` recorded (extend `AUDIT_ACTIONS` + `AuditEventInput`)
- non-goals: preferences; export; deletion; company; approvals; UI
- upstream inputs: `P1` -> `sessions` columns; `P2` -> `SessionSummary`, `SessionListResponse`
- changes:
  - add `listByUser`, `findByShortId`, `deleteByIdForUser`, `updateLastSeen` to `sessionRepository`
  - add `listForUser(userId, currentToken)`, `revokeForUser(userId, sessionShortId, currentToken, auditContext)` to `sessionService` with `runAudited` wrapper
  - add `session-short-id` derivation (first 12 hex chars of token) as pure helper; enforce uniqueness by lookup at write time and re-roll if collision
  - author `accountSessions.ts` route file, register via `app.ts` (S1)
  - extend `authPlugin` hook to call `sessions.updateLastSeen(token, now)` with 60 s throttle (store last-seen cache per token in service memory or drop throttle if simpler)
  - extend `auditEvent.ts` `AUDIT_ACTIONS` + discriminated union with `auth.session_revoked`
  - write integration test covering: list returns only caller's rows; revoke removes row + audits; self-target rejected; foreign target returns 404 not 403
- invariants: retire-not-delete does not apply (sessions are ephemeral -> hard delete OK); ownership check by `(userId, sessionShortId)`; non-disclosure for foreign / unknown
- relevant evidence: `E1`, `E3`
- test duty: `T3` = `npm exec -w @shop/api -- tsx --test apps/api/test/auth/sessionManagement.integration.test.ts`
- verification: `T3` pass
- handoff: session domain closed; interface = new routes + audit action
- review: `R3` -> parallel review; blocks convergence use

### P4: Preferences self-service

- mode: parallel with `P3, P5..P7`
- depends on: `GR2`
- owns:
  - `apps/api/src/features/preferences/preferencesRepository.ts` (proposed)
  - `apps/api/src/features/preferences/preferencesService.ts` (proposed)
  - `apps/api/src/routes/accountPreferences.ts` (proposed)
  - `apps/api/test/preferences/preferences.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/tradeAccount/deliverySiteService.ts` -> service+repo pattern
  - `packages/contracts/src/account-depth` -> `UserPreferences`, `UpdatePreferencesBody`
  - `apps/api/src/db/unitOfWork.ts` -> `runAudited` wrapper style
- acceptance:
  - `GET /api/account/preferences` returns caller's preferences (defaults if row absent)
  - `PATCH /api/account/preferences` upserts + audits `auth.preferences_updated`; body validated by TypeBox; unknown keys rejected
  - both endpoints protected by `requireAuth`
- non-goals: consumer of preferences (mailer opt-outs -- future item 8)
- upstream inputs: `P1` -> `user_preferences`; `P2` -> contracts
- changes:
  - author repository (`get(userId)`, `upsert(userId, patch)` via `INSERT ON CONFLICT`)
  - author service (`get`, `update`) with `runAudited`
  - author route file
  - extend `AUDIT_ACTIONS` + input with `auth.preferences_updated`
- invariants: single row per user; column-per-boolean typed as `0|1`; TypeBox rejects unknown keys
- relevant evidence: `E1`, `E3`
- test duty: `T4` = `npm exec -w @shop/api -- tsx --test apps/api/test/preferences/preferences.integration.test.ts`
- verification: `T4` pass
- handoff: preferences service consumed by S1 (wiring) + P9 (UI)
- review: `R4` -> parallel review

### P5: Data export self-service

- mode: parallel with `P3, P4, P6, P7`
- depends on: `GR2`
- owns:
  - `apps/api/src/features/accountExport/dataExportService.ts` (proposed)
  - `apps/api/src/routes/accountExport.ts` (proposed)
  - `apps/api/test/accountExport/dataExport.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/orders/orderRepository.ts`, `favourites/favouritesRepository.ts`, `tradeAccount/deliverySiteRepository.ts`, `tradeAccount/billingEntityRepository.ts`, `customBlend/customBlendRepository.ts` -> read APIs to compose snapshot
  - `apps/api/src/features/auth/sessionRepository.ts` -> `listByUser` handoff from `P3`
  - `apps/api/src/features/preferences/preferencesRepository.ts` -> from `P4`
  - `apps/api/src/features/mailbox/mailboxRepository.ts` -> `add`
  - `packages/contracts/src/account-depth` -> `DataExportResponse`
- acceptance:
  - `GET /api/account/export` returns JSON snapshot matching `DataExportResponse`; response schema validated by TypeBox reply serializer
  - password hashes, salts, session tokens, payment fingerprints, admin metadata never appear
  - endpoint sends one `dev_mailbox` entry to buyer email with subject `"QArefully Materials Exchange — data export"`
  - audit event `auth.data_exported` recorded
- non-goals: async job queue delivery (item 8); scheduled auto-exports
- upstream inputs: `P1`, `P2`; loosely `P3` + `P4` interfaces (may synth defaults if run early -- worker chooses order)
- changes:
  - author service composing snapshot from repositories via read-only queries
  - author route protected by `requireAuth`
  - extend `AUDIT_ACTIONS` + input with `auth.data_exported`
  - write integration test: seed user, verify snapshot shape + PII redaction + mailbox side effect + audit row
- invariants: read-only; snapshot excludes all listed secrets; deterministic ordering (orders by id ASC, sites by id ASC, etc.)
- relevant evidence: `E1`, `E3`
- test duty: `T5` = `npm exec -w @shop/api -- tsx --test apps/api/test/accountExport/dataExport.integration.test.ts`
- verification: `T5` pass; property-level assertion that response contains no `passwordHash`, `password_hash`, `token`, `fingerprint` keys
- handoff: export service consumed by S1 + P9 UI
- review: `R5` -> parallel review

### P6: Account deletion self-service

- mode: parallel with `P3, P4, P5, P7`
- depends on: `GR2`
- owns:
  - `apps/api/src/features/accountDeletion/deletionService.ts` (proposed)
  - `apps/api/src/features/accountDeletion/deletionRepository.ts` (proposed)
  - `apps/api/src/routes/accountDeletion.ts` (proposed)
  - `apps/api/test/accountDeletion/deletion.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/auth/authService.ts` -> password verify; extend if needed
  - `apps/api/src/features/tradeAccount/*` -> retire calls
  - `apps/api/src/features/favourites/favouritesRepository.ts` -> delete-by-user
  - `apps/api/src/features/customBlend/customBlendRepository.ts` -> cart-line cleanup
  - `apps/api/src/features/auth/sessionRepository.ts` -> `deleteForUser`
  - `packages/contracts/src/account-depth` -> `DeleteAccountBody`
- acceptance:
  - `POST /api/account/delete` requires `currentPassword`; verifies via existing `passwords.verify`; on success runs single txn: retire memberships (owner blocked if company still has other members), retire sites/billing entities, delete favourites + preferences + custom blend cart lines + sessions, redact `users` row PII, write `account_deletion_events` row, audit `auth.account_deleted`
  - `INVALID_CURRENT` -> `400`; `OWNS_COMPANY` -> `409` (only fires when company has other members; sole-owner + no other members -> retire company)
  - historic orders + payments + returns retained + still queryable
- non-goals: reversal / undo flow
- upstream inputs: `P1`, `P2`; loosely `P7` interface for company checks (worker may bootstrap without `P7` handoff by hand-rolling a query against `company_memberships`); flag as dependency if `P7` review is not yet closed
- changes:
  - author repository (write helpers grouped: `redactUser`, `insertDeletionEvent`, `deleteCartLinesForUser`)
  - author service with `runAudited` outer txn; delegate to trade-account service retire calls, company retire if sole-owner + no other members
  - author route; extend `AUDIT_ACTIONS` + input with `auth.account_deleted`
  - integration test covering: deletion succeeds; wrong password rejected; retained orders queryable; blocked when owner + other members; sessions gone
- invariants: irreversible; PII overwrite deterministic; no cascade on orders; single txn
- relevant evidence: `E1`, `E3`
- test duty: `T6` = `npm exec -w @shop/api -- tsx --test apps/api/test/accountDeletion/deletion.integration.test.ts`
- verification: `T6` pass
- handoff: deletion service consumed by S1 + P9 UI
- review: `R6` -> mandatory high-risk producer review (auth + PII path); blocks P9

### P7: Company accounts + memberships + invites domain

- mode: parallel with `P3..P6`
- depends on: `GR2`
- owns:
  - `apps/api/src/features/companyAccounts/companyRepository.ts` (proposed)
  - `apps/api/src/features/companyAccounts/companyMembershipRepository.ts` (proposed)
  - `apps/api/src/features/companyAccounts/companyInviteRepository.ts` (proposed)
  - `apps/api/src/features/companyAccounts/companyService.ts` (proposed)
  - `apps/api/src/features/companyAccounts/companyErrors.ts` (proposed)
  - `apps/api/src/routes/companyAccounts.ts` (proposed)
  - `apps/api/test/companyAccounts/company.integration.test.ts` (proposed)
  - `apps/api/test/companyAccounts/invites.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/tradeAccount/deliverySiteService.ts` -> retire pattern + `TradeAccountResult` template
  - `apps/api/src/features/passwordReset/passwordResetService.ts` -> token digest + email link pattern
  - `apps/api/src/features/mailbox/mailboxRepository.ts` -> invite email dispatch
  - `packages/contracts/src/company-accounts` -> request/response schemas
- acceptance:
  - `POST /api/company` creates company + owner membership; caller must have no active membership
  - `GET /api/company` returns caller's company + membership role (or `null` if none)
  - `GET /api/company/members` returns active members (owner + non-owner alike)
  - `PATCH /api/company/members/:membershipId` changes role (owner-only; cannot demote sole owner; cannot promote to `owner`)
  - `DELETE /api/company/members/:membershipId` retires membership (owner or self); owner retiring self blocked while other members exist
  - `POST /api/company/invites` creates invite + mailbox entry; owner-only
  - `POST /api/company/invites/accept` body `{token}` -> creates active membership; expired / already-used -> `400`
  - `PATCH /api/company/threshold` (owner-only) updates threshold; audit records old + new
  - audit actions extended: `company.created`, `company.member_invited`, `company.member_joined`, `company.member_revoked`, `company.member_role_changed`, `company.threshold_changed`
- non-goals: checkout gate (P8 owns); UI
- upstream inputs: `P1`, `P2`
- changes:
  - author 3 repositories using `active = 1` retire pattern + partial-unique-index awareness
  - author service enforcing all invariants above with `runAudited`
  - author errors module (`CompanyErrorCode` union: `NO_ACTIVE_MEMBERSHIP`, `ALREADY_MEMBER`, `NOT_OWNER`, `SOLE_OWNER`, `MEMBERSHIP_NOT_FOUND`, `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_ALREADY_USED`, `COMPANY_NOT_FOUND`, `INVALID_ROLE`)
  - author route file with HTTP mapping table mirroring `tradeAccount.ts::TRADE_ACCOUNT_ERROR_RESPONSE`
  - extend audit event union
  - integration tests: happy paths + all error branches; retire-not-delete verified
- invariants: exactly-one-owner active per company; one-active-membership per user; partial unique index enforced at DB + guarded pre-check in service; non-disclosure for foreign / unknown IDs
- relevant evidence: `E1`, `E3`
- test duty: `T7` = `npm exec -w @shop/api -- tsx --test apps/api/test/companyAccounts/company.integration.test.ts apps/api/test/companyAccounts/invites.integration.test.ts`
- verification: `T7` pass
- handoff: `companyService` interface exposed for P8 + S1 + P10; `findActiveByUser(userId)` used by checkout gate
- review: `R7` -> mandatory review; blocks P8

### P8: Order approval domain + checkout integration

- mode: sequential after `G1`
- depends on: `P3, P4, P5, P6, P7`, `G1`
- owns:
  - `apps/api/src/features/orderApprovals/approvalRepository.ts` (proposed)
  - `apps/api/src/features/orderApprovals/approvalService.ts` (proposed)
  - `apps/api/src/features/orderApprovals/approvalErrors.ts` (proposed)
  - `apps/api/src/routes/orderApprovals.ts` (proposed)
  - `apps/api/src/features/checkout/checkoutService.ts` (edit -- insert gate after `resolveCommitments`)
  - `apps/api/src/features/checkout/checkoutTypes.ts` (edit -- extend `CheckoutErrorCode` + `CheckoutResult` + `CheckoutDependencies`)
  - `apps/api/test/orderApprovals/approvalWorkflow.integration.test.ts` (proposed)
  - `apps/api/test/checkout/checkoutApproval.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/features/checkout/checkoutService.ts` -> `resolveCommitments`, `failPreparation`, `prepare` flow -> exact seam
  - `apps/api/src/features/checkout/checkoutQuote.ts` -> quote shape for snapshotting
  - `apps/api/src/features/companyAccounts/companyService.ts` -> `findActiveByUser` interface (from `P7`)
  - `packages/contracts/src/order-approvals` -> schemas + result variants
- acceptance:
  - checkout with buyer under threshold -> unchanged path
  - checkout with buyer at/above threshold + `NULL` threshold -> unchanged path (threshold `NULL` = no gate)
  - checkout with buyer at/above threshold + numeric threshold -> `{success:false, error:'PENDING_APPROVAL', approvalRequestId}`; no order created; no inventory reservation persisted; no payment reservation persisted; cart untouched
  - approval decision routes: approver on same company can approve or reject; foreign approver -> `404 APPROVAL_NOT_FOUND`; non-approver membership -> `403 NOT_APPROVER`
  - approved + retry same `idempotencyKey` -> checkout proceeds normally; different quote total drift beyond 1% -> `APPROVAL_TOTAL_DRIFT`; expired -> `APPROVAL_EXPIRED`; rejected -> `APPROVAL_REJECTED`
  - mailbox entry sent to each active approver on `approval.requested`
  - audit `approval.requested`, `approval.approved`, `approval.rejected`, `approval.expired`
- non-goals: async retry queue; multi-approver quorum; approver-completes-payment
- upstream inputs: `P7` -> `companyService.findActiveByUser`; `P1` -> `order_approvals`; `P2` -> contracts
- changes:
  - author repository (`create`, `findByIdempotencyKey`, `transition({expectedStatus,...})`, `expireStale(now)`, `listPendingByCompany`, `listByRequester`)
  - author service with `evaluate({...})` returning `pass|defer|approved-retry`; `decide({...})`; `list*`
  - author error module
  - edit `checkoutService.prepare` -> insert gate right after `commitments` resolution succeeds + BEFORE `dependencies.carts.reserve`; on defer, use `failPreparation` seam with new failure code
  - edit `checkoutTypes.ts` -> extend `CheckoutErrorCode` + `CheckoutResult` + `CheckoutDependencies` interface
  - author route file with approver + buyer routes
  - integration tests covering: gate deferral + no state mutation; approval + retry succeeds; rejection blocks retry; drift blocks retry
- invariants: gate runs inside preparation txn before any reservation; deferral is idempotent for identical `(cartId, idempotencyKey)`; approval lease `APPROVAL_LEASE_MS = 24 * 60 * 60_000`; total-drift tolerance `1%`; non-disclosure across companies
- relevant evidence: `E1`, `E3`, plus P7 handoff evidence `T7`
- test duty: `T8` = `npm exec -w @shop/api -- tsx --test apps/api/test/orderApprovals/approvalWorkflow.integration.test.ts apps/api/test/checkout/checkoutApproval.integration.test.ts`
- verification: `T8` pass; existing checkout integration tests (`apps/api/test/checkout/*.integration.test.ts`) still pass -- rerun `npm exec -w @shop/api -- tsx --test apps/api/test/checkout/*.integration.test.ts`
- handoff: `PENDING_APPROVAL` result path + approvals routes ready for P10 UI
- review: `R8` -> mandatory high-risk review (checkout money path); blocks P10

### P9: Web self-service UI (sessions, preferences, export, deletion)

- mode: parallel with `P10` after `G2`
- depends on: `GR3, GR4, GR5, GR6`, `G2`
- owns:
  - `apps/web/src/api/accountSessions.ts` (proposed)
  - `apps/web/src/api/accountPreferences.ts` (proposed)
  - `apps/web/src/api/accountExport.ts` (proposed)
  - `apps/web/src/api/accountDeletion.ts` (proposed)
  - `apps/web/src/features/account/SessionsSection.tsx` (proposed)
  - `apps/web/src/features/account/PreferencesSection.tsx` (proposed)
  - `apps/web/src/features/account/DataExportSection.tsx` (proposed)
  - `apps/web/src/features/account/DeleteAccountSection.tsx` (proposed)
  - `apps/web/src/features/account/AccountPage.tsx` (edit -- mount new sections; item 7 owns this file in this worktree)
  - `apps/web/src/features/account/SelfServiceSections.test.tsx` (proposed)
- reads:
  - `apps/web/src/features/account/AccountPage.tsx` -> existing layout to extend
  - `apps/web/src/features/account/DeliverySitesSection.tsx`, `BillingEntitiesSection.tsx` -> section pattern
  - `apps/web/src/features/account/useTradeProfile.ts` -> hook shape
  - `apps/web/src/hooks/AuthContext.tsx` -> `useAuth`, `logout`
  - `packages/contracts/src/account-depth` -> schemas + `Static` types
- acceptance:
  - `SessionsSection` lists caller's sessions; each row has "Sign out this session" button disabled for current; revoke updates list optimistically then re-fetches; disabled state announced accessibly
  - `PreferencesSection` renders three checkboxes; toggling issues `PATCH`; error banner on failure
  - `DataExportSection` has "Download" button -> `GET /api/account/export` -> triggers browser download of JSON blob + shows toast about mailbox delivery
  - `DeleteAccountSection` requires password + typed confirmation ("delete my account"); on success logs out + navigates `/`; on `OWNS_COMPANY` error shows disambiguated banner
  - React integration test covers happy paths + one error path per section
- non-goals: company / approvals UI
- upstream inputs: `P3, P4, P5, P6` interfaces
- changes:
  - author typed API clients validating responses via TypeBox at runtime (existing `client.ts` convention)
  - author each section as isolated component with own state + error handling
  - extend `AccountPage.tsx` to render new sections between existing trade sections + action buttons
  - author vitest integration test using existing test utilities
- invariants: authoritative state on backend; optimistic UI reverts on failure; no local caching of session tokens; no membership-role gating (that lives in P10)
- relevant evidence: `E3`; `T3, T4, T5, T6`
- test duty: `T9` = `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/account/SelfServiceSections.test.tsx`
- verification: `T9` pass; `npm run typecheck -w @shop/web` pass
- handoff: complete self-service UI on `AccountPage`
- review: `R9` -> parallel review

### P10: Web company + approvals UI

- mode: parallel with `P9` after `G2`
- depends on: `GR7, GR8`, `G2`
- owns:
  - `apps/web/src/api/companyAccounts.ts` (proposed)
  - `apps/web/src/api/orderApprovals.ts` (proposed)
  - `apps/web/src/features/company/CompanyPage.tsx` (proposed)
  - `apps/web/src/features/company/MembersSection.tsx` (proposed)
  - `apps/web/src/features/company/InvitesSection.tsx` (proposed)
  - `apps/web/src/features/company/ThresholdSection.tsx` (proposed)
  - `apps/web/src/features/company/AcceptInvitePage.tsx` (proposed)
  - `apps/web/src/features/approvals/ApprovalsPage.tsx` (proposed)
  - `apps/web/src/features/approvals/ApproverInbox.tsx` (proposed)
  - `apps/web/src/features/approvals/BuyerRequestsList.tsx` (proposed)
  - `apps/web/src/features/account/CompanyMembershipSection.tsx` (proposed)
  - `apps/web/src/features/checkout/CheckoutPage.tsx` (edit -- handle new approval result variants)
  - `apps/web/src/App.tsx` (edit -- add `/account/company`, `/account/approvals`, `/invites/accept`; item 7 owns in this worktree)
  - `apps/web/src/features/company/CompanyPage.test.tsx` (proposed)
  - `apps/web/src/features/approvals/ApprovalsPage.test.tsx` (proposed)
  - `apps/web/src/features/checkout/CheckoutPage.pendingApproval.test.tsx` (proposed)
- reads:
  - `apps/web/src/App.tsx` -> `ProtectedRoute` pattern
  - `apps/web/src/features/checkout/CheckoutPage.tsx` -> existing checkout response handling; approval-pending branch replaces the payment-success confirmation navigation
  - `packages/contracts/src/company-accounts`, `packages/contracts/src/order-approvals`
- acceptance:
  - `/account/company`: non-member sees "Create company" form; member sees company details, role, threshold (owner-editable), members list; owner sees invite form + revoke buttons
  - `/invites/accept?token=…` accepts invite, shows result, links to `/account/company`
  - `/account/approvals`: approver sees pending list with buyer name + total + PO reference + delivery site summary + Approve/Reject buttons; buyer sees own requests with status
  - `CheckoutPage` handles `PENDING_APPROVAL` -> shows explanation + link to `/account/approvals`; handles `APPROVAL_REJECTED`, `APPROVAL_EXPIRED`, `APPROVAL_TOTAL_DRIFT` with distinct messages
  - React integration tests for each surface
- non-goals: server behavior; account page self-service surfaces (P9 owns)
- upstream inputs: `P7, P8` interfaces
- changes:
  - author typed API clients with TypeBox validation
  - author page + section components; use existing UI primitives
  - extend `CheckoutPage` result switch; add `useCheckoutApprovalResult` handling
  - extend `App.tsx` routes
  - author 3 vitest integration test files covering happy paths + one failure branch each
- invariants: role gating driven by fetched membership response, not local state; anti-forgery on decision buttons; ownership-scoped views
- relevant evidence: `E3`; `T7, T8`
- test duty: `T10` = `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/company/CompanyPage.test.tsx apps/web/src/features/approvals/ApprovalsPage.test.tsx apps/web/src/features/checkout/CheckoutPage.pendingApproval.test.tsx`
- verification: `T10` pass; `npm run typecheck -w @shop/web` pass
- handoff: full front-end complete
- review: `R10` -> parallel review

### S1: Convergence — composition, seed, cross-cutting integration

- mode: sequential after `G3`
- depends on: `P3..P10`, `G3`
- owns:
  - `apps/api/src/app.ts` (edit -- register every new service + route)
  - `apps/api/src/db/seed.ts` (append -- new seed users + company + memberships + preferences + thresholds; item 7 additions only, item 9 owns its own)
  - `apps/api/src/db/companyAccountsSeed.ts` (proposed helper)
  - `apps/api/test/integration/accountDepthEndToEnd.integration.test.ts` (proposed)
- reads:
  - `apps/api/src/app.ts` -> `createAppServices` + route registration pattern
  - `apps/api/src/db/seed.ts` -> `USERS` array + insertion ordering
  - every handoff interface from `P3..P10`
- acceptance:
  - `npm run reset` succeeds; seed idempotent
  - all newly registered routes reachable from `app.inject()`
  - end-to-end integration test walks: seed buyer + approver + owner; buyer checkout above threshold -> pending; approver approves -> buyer retry succeeds; buyer rejects flow; buyer requests export + preferences change + session revoke + account deletion
  - `npm run verify` passes
- non-goals: any new domain behavior
- upstream inputs: every packet interface
- changes:
  - wire `preferencesService`, `sessionService` extensions, `dataExportService`, `deletionService`, `companyService`, `approvalService` into `AppServices`; register new route modules
  - extend `checkoutService` dependency wiring with `approvals` + `companies`
  - add seed helper: create `acme@example.com` (owner), `buyer@example.com` (buyer), `approver@example.com` (approver), threshold `50000` cents, one accepted invite, one pending invite
  - author end-to-end integration test
  - update `apps/api/test/fixtures` if new helpers reused
- invariants: composition root remains the only place adding module-level services; no listen/seed at import time
- relevant evidence: every prior `T*` evidence entry
- test duty: `T11` = `npm run verify` (repo-wide once); `T12` = `npm exec -w @shop/api -- tsx --test apps/api/test/integration/accountDepthEndToEnd.integration.test.ts`
- verification: `T11` + `T12` pass
- handoff: shippable branch
- review: `R11` -> convergence review across `app.ts`, `seed.ts`, end-to-end test

## Review Assignments

### R1: Review `P1` (migrations 025 + 026)

- method: invoke `code-reviewer` skill; apply critical + high severity gate + verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled commit / diff introducing `025_account_self_service.ts`, `026_company_accounts_approvals.ts`, updated `migrations/index.ts`
- timing: immediately after `P1` settles; blocks `P2`
- blocks: `P2`, all downstream
- consolidation reason: none
- reads: `apps/api/src/db/migrations/023_trade_delivery_and_checkout_depth.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/migrations/index.ts`, new `025`/`026` files, `apps/api/src/db/openDatabase.ts`
- acceptance: correct FK check placement; partial unique indexes match one-active invariants; CHECK constraints on enums + amounts; retire-not-delete precedent applied where FK from historic rows possible; migration index ordered
- invariants: append-only migrations; forward-only; runner-owned FK suspension; transactional per migration
- risk focus: silent constraint gaps (e.g., missing partial unique on `(user_id) WHERE active = 1` in memberships), CHECK bypass, backfill correctness for `sessions.last_seen_at`
- non-goals: seed data, services
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence missing
- relevant evidence: `E1`, `E2`
- return: `reviewer_report_v1`

### R2: Review `P2` (contracts additions)

- method: `code-reviewer`
- target: `P2` -> settled diff on `packages/contracts/src/{accountDepth,companyAccounts,orderApprovals}.ts`, `packages/contracts/src/{index,payments}.ts`, `packages/contracts/package.json`
- timing: after `P2`; blocks `P3..P7`
- blocks: `P3..P7`
- consolidation reason: none
- reads: `packages/contracts/src/{auth,payments,orders,address,tradeAccount}.ts`, `packages/contracts/package.json`
- acceptance: TypeBox definitions correct + `Static` types resolve; `CheckoutResult` union extension does not break existing narrowing; subpath exports registered; re-exports non-duplicative
- invariants: additive-only; no breaking edits
- risk focus: `CheckoutResult` union break, unknown-key rejection defaults, subpath export path shape
- non-goals: server implementations
- write policy: inspect-only
- test policy: assess `E3, E4`
- relevant evidence: `E3, E4`
- return: `reviewer_report_v1`

### R3: Review `P3` (sessions)

- method: `code-reviewer`
- target: `P3` -> settled diff on `sessionRepository.ts`, `sessionService.ts`, `plugins/auth.ts`, `routes/accountSessions.ts`, `auditEvent.ts`, integration test
- timing: after `P3`; blocks its own consumers (P5 export snapshot, P9 UI, S1 wiring)
- blocks: P5 (export references sessions), P9, S1
- consolidation reason: none
- reads: `sessionRepository.ts`, `sessionService.ts`, `plugins/auth.ts`, `auditEvent.ts`, new route + test
- acceptance: ownership scope by `(userId, sessionId)`; self-revocation rejected; `last_seen_at` throttled write correct; audit action registered
- invariants: non-disclosure for foreign/unknown; single-transaction audited mutation
- risk focus: session-id short-prefix collision, cookie handling, `last_seen_at` race under concurrent hits
- non-goals: preferences, export, deletion, company
- write policy: inspect-only
- test policy: assess `T3`
- relevant evidence: `E1`, `E3`, `T3`
- return: `reviewer_report_v1`

### R4: Review `P4` (preferences)

- method: `code-reviewer`
- target: `P4` -> settled diff on `preferences/*`, `routes/accountPreferences.ts`, audit event union, integration test
- timing: after `P4`; blocks P9 + S1
- blocks: P9, S1
- reads: new files + `deliverySiteService.ts` for pattern comparison
- acceptance: upsert atomicity; TypeBox reject-unknown-keys; audit registered
- invariants: single row per user
- risk focus: race on concurrent upserts; SQL injection surface (parameterized)
- non-goals: consumer wiring
- write policy: inspect-only
- test policy: assess `T4`
- relevant evidence: `E1`, `E3`, `T4`
- return: `reviewer_report_v1`

### R5: Review `P5` (data export)

- method: `code-reviewer`
- target: `P5` -> settled diff on `accountExport/*`, `routes/accountExport.ts`, audit event union, integration test
- timing: after `P5`; blocks P9 + S1
- blocks: P9, S1
- reads: new files + repositories referenced (orders, favourites, sites, billing, customBlend, sessions, preferences)
- acceptance: no secret keys leak into snapshot; response reply schema enforced; audit + mailbox side effect present
- invariants: read-only
- risk focus: PII leak, oversized response (unbounded orders), N+1 queries
- non-goals: async delivery
- write policy: inspect-only
- test policy: assess `T5`
- relevant evidence: `E1`, `E3`, `T5`
- return: `reviewer_report_v1`

### R6: Review `P6` (account deletion)

- method: `code-reviewer`
- target: `P6` -> settled diff on `accountDeletion/*`, `routes/accountDeletion.ts`, audit event union, integration test
- timing: after `P6`; blocks P9 + S1
- blocks: P9, S1
- reads: new files + `authService.ts`, `sessionRepository.ts`, `tradeAccount/*`, `favouritesRepository.ts`, `customBlendRepository.ts`
- acceptance: password verification uses existing hasher; single txn; retire vs delete rules honored; orders preserved; `OWNS_COMPANY` blocks correctly
- invariants: irreversible; PII redaction deterministic; no FK cascade on orders
- risk focus: partial deletion mid-txn, sole-owner escape hatch, timing attacks on password verify
- non-goals: undo flow
- write policy: inspect-only
- test policy: assess `T6`
- relevant evidence: `E1`, `E3`, `T6`
- return: `reviewer_report_v1`

### R7: Review `P7` (company accounts + invites)

- method: `code-reviewer`
- target: `P7` -> settled diff on `companyAccounts/*`, `routes/companyAccounts.ts`, audit event union, integration tests
- timing: after `P7`; blocks P8 + P10 + S1
- blocks: P8, P10, S1
- reads: new files + `tradeAccount/deliverySiteService.ts`, `passwordResetService.ts`, `mailboxRepository.ts`
- acceptance: exactly-one-owner invariant enforced; role change guards; invite digest matches password-reset pattern; retire-not-delete
- invariants: one-active-membership per user; partial unique indexes never bypassed
- risk focus: invite token reuse, invite email disclosure, sole-owner demotion escape, membership id enumeration
- non-goals: checkout gate
- write policy: inspect-only
- test policy: assess `T7`
- relevant evidence: `E1`, `E3`, `T7`
- return: `reviewer_report_v1`

### R8: Review `P8` (checkout approval gate)

- method: `code-reviewer`
- target: `P8` -> settled diff on `orderApprovals/*`, `routes/orderApprovals.ts`, `checkout/checkoutService.ts`, `checkout/checkoutTypes.ts`, audit event union, integration tests
- timing: after `P8`; blocks P10 + S1
- blocks: P10, S1
- reads: `checkoutService.ts` (full file), `checkoutTypes.ts`, `paymentRepository.ts`, `orderApprovals/*`, `companyAccounts/companyService.ts`
- acceptance: gate placed after `resolveCommitments` + before any reservation; deferral leaves no cart / promo / inventory reservation; retry with approved lease succeeds; drift + expired + rejected paths correct; approver ownership check non-disclosing
- invariants: preparation atomicity; approval lease bound; total-drift tolerance; retire-not-delete
- risk focus: leaked inventory reservation on deferral, double-charge on retry, cross-company approval, cart mutation on defer, race between approval decision + retry
- non-goals: UI
- write policy: inspect-only
- test policy: assess `T8` + existing checkout tests
- relevant evidence: `E1`, `E3`, `T7`, `T8`
- return: `reviewer_report_v1`

### R9: Review `P9` (self-service UI)

- method: `code-reviewer`
- target: `P9` -> settled diff on `apps/web/src/api/{accountSessions,accountPreferences,accountExport,accountDeletion}.ts`, `features/account/{SessionsSection,PreferencesSection,DataExportSection,DeleteAccountSection,SelfServiceSections.test,AccountPage}.tsx`
- timing: after `P9`
- blocks: S1
- reads: `AccountPage.tsx`, `DeliverySitesSection.tsx`, `useTradeProfile.ts`, `hooks/AuthContext.tsx`, contracts
- acceptance: state authority on backend; TypeBox response validation; accessibility labels present; error branches rendered
- invariants: no session-token client storage; no optimistic delete on deletion form
- risk focus: destructive UI without confirmation, stale user context after deletion / self-session revoke
- non-goals: server behavior
- write policy: inspect-only
- test policy: assess `T9`
- relevant evidence: `T9`
- return: `reviewer_report_v1`

### R10: Review `P10` (company + approvals UI)

- method: `code-reviewer`
- target: `P10` -> settled diff on `apps/web/src/api/{companyAccounts,orderApprovals}.ts`, `features/company/*`, `features/approvals/*`, `features/checkout/CheckoutPage.tsx` (approval branch), `App.tsx` (routes)
- timing: after `P10`
- blocks: S1
- reads: existing App.tsx routes, CheckoutPage.tsx, contracts
- acceptance: role gating driven by fetched membership; approval action buttons confirm intent; checkout response switch handles all new variants; new routes protected
- invariants: no local role trust; no cart mutation on approval branches
- risk focus: approval action double-submit, missing `PENDING_APPROVAL` handling before user proceeds to payment retry
- non-goals: server
- write policy: inspect-only
- test policy: assess `T10`
- relevant evidence: `T10`
- return: `reviewer_report_v1`

### R11: Review `S1` (convergence)

- method: `code-reviewer`
- target: `S1` -> settled diff on `apps/api/src/app.ts`, `apps/api/src/db/seed.ts`, `apps/api/src/db/companyAccountsSeed.ts`, `apps/api/test/integration/accountDepthEndToEnd.integration.test.ts`
- timing: after `S1`
- blocks: `G4`
- reads: `app.ts`, `seed.ts`, all service constructors touched
- acceptance: composition root wires every new service exactly once; seed idempotent; end-to-end test walks pending -> approved -> retry path; no import-time side effects
- invariants: single composition root; deterministic seed; no listen at import
- risk focus: missing route registration, seed order dependency, orphaned service instance
- non-goals: new domain behavior
- write policy: inspect-only
- test policy: assess `T11`, `T12`
- relevant evidence: every prior `T*`, plus `T11`, `T12`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- migration versions: item 7 reserves `025`, `026`; item 9 must reserve `027`+; both files disjoint
- `apps/api/src/db/migrations/index.ts`: item 7 appends `025`, `026` entries after `024`; item 9 appends after `026`; user resolves ordering at merge
- `packages/contracts/src/index.ts`: additive re-exports only; item 7 adds three re-exports in one region; item 9 adds its own; merge is textual append
- `packages/contracts/src/payments.ts`: item 7 extends `CheckoutResult` union with approval variants; item 9 does not touch (no admin extension planned for payments); if item 9 needs it, escalate as blocker
- `packages/contracts/src/auth.ts`: item 7 does NOT touch; item 9 owns any admin additions there
- `apps/api/src/features/auth/sessionRepository.ts` + `sessionService.ts` + `plugins/auth.ts`: item 7 owns; item 9 must consume existing methods only (e.g., `invalidateAllForUser` already exposed) -- no method additions from item 9
- `apps/api/src/features/auth/authService.ts` + `userRepository.ts`: item 7 does NOT modify (uses existing password verify + user read); item 9 owns any admin user CRUD additions
- `apps/api/src/routes/auth.ts`: item 7 does NOT touch; new endpoints live in `accountSessions.ts`, `accountPreferences.ts`, `accountExport.ts`, `accountDeletion.ts`, `companyAccounts.ts`, `orderApprovals.ts`
- `apps/api/src/features/checkout/*`: owned only by `P8`; parallel P3..P7 read only
- `apps/api/src/features/audit/auditEvent.ts`: additive to `AUDIT_ACTIONS` array + discriminated union; owned only by S1 for the final consolidated add of every new action -- Alternative: each packet adds only its own action + input case, converging naturally. Choose per-packet-add to avoid S1 bottleneck; item 9 additions land in its worktree separately. State explicitly in every P*  packet: "extend `AUDIT_ACTIONS` + `AuditEventInput` with only your packet's actions". Merge with item 9 at user integration.
- `apps/api/src/app.ts`: shared composition root; item 7 owned in this worktree; item 9 owned in its worktree; merge additive
- `apps/api/src/db/seed.ts`: shared; item 7 owned in this worktree via new helper file `companyAccountsSeed.ts` + single append region for `seed(...)` invocation
- `apps/web/src/App.tsx`: shared; item 7 owned in this worktree; new route paths (`/account/company`, `/account/approvals`, `/invites/accept`) do not clash with item 9's admin paths (`/admin/*`)
- `apps/web/src/features/account/AccountPage.tsx`: item 7 owned end-to-end (item 9 does not extend the buyer's account page)
- integration owner: `S1` is single owner for `app.ts` service composition + `seed.ts` fixture insertion + end-to-end test

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for every worker packet, fix, worker-owned verification; launch globally configured `reviewer` agent for every review assignment. Model, reasoning effort, developer instructions resolved from global Codex settings. Never override in plan or assignment.
- non-Codex harnesses: ignore Codex binding. Use harness-native worker + reviewer roles while preserving assignment / report contracts.
- all harnesses: reviewer runs `code-reviewer` skill as review method. Assignment `review_skill=code-reviewer`. Reviewer invokes skill explicitly by name via Skill tool (skill carries `disable-model-invocation`).

## Test Execution Schedule

- `E1`: after `P1` settles -> owner `P1` -> `npm run reset -w @shop/api`
- `E2`: after `P1` settles -> owner `P1` -> introspection integration test on new schema (proposed `apps/api/test/db/accountDepthSchema.integration.test.ts`)
- `E3`: after `P2` settles -> owner `P2` -> `npm run typecheck -w @shop/contracts`
- `E4`: after `P2` settles -> owner `P2` -> `npm run build --workspaces --if-present`
- `T3`: after `P3` settles -> owner `P3` -> `npm exec -w @shop/api -- tsx --test apps/api/test/auth/sessionManagement.integration.test.ts`
- `T4`: after `P4` settles -> owner `P4` -> `npm exec -w @shop/api -- tsx --test apps/api/test/preferences/preferences.integration.test.ts`
- `T5`: after `P5` settles -> owner `P5` -> `npm exec -w @shop/api -- tsx --test apps/api/test/accountExport/dataExport.integration.test.ts`
- `T6`: after `P6` settles -> owner `P6` -> `npm exec -w @shop/api -- tsx --test apps/api/test/accountDeletion/deletion.integration.test.ts`
- `T7`: after `P7` settles -> owner `P7` -> `npm exec -w @shop/api -- tsx --test apps/api/test/companyAccounts/company.integration.test.ts apps/api/test/companyAccounts/invites.integration.test.ts`
- `T8`: after `P8` settles -> owner `P8` -> `npm exec -w @shop/api -- tsx --test apps/api/test/orderApprovals/approvalWorkflow.integration.test.ts apps/api/test/checkout/checkoutApproval.integration.test.ts`; plus rerun existing `apps/api/test/checkout/*.integration.test.ts`
- `T9`: after `P9` settles -> owner `P9` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/account/SelfServiceSections.test.tsx`
- `T10`: after `P10` settles -> owner `P10` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/company/CompanyPage.test.tsx apps/web/src/features/approvals/ApprovalsPage.test.tsx apps/web/src/features/checkout/CheckoutPage.pendingApproval.test.tsx`
- `T11`: after all fixes settle -> owner `S1` -> `npm run verify` (repo-wide, once)
- `T12`: after S1 wiring settles -> owner `S1` -> `npm exec -w @shop/api -- tsx --test apps/api/test/integration/accountDepthEndToEnd.integration.test.ts`
- policy: automated repository commands only; no browser, screenshot, manual UI verification in any entry
- reuse: passing evidence remains valid across sessions when relevant source, migrations, contracts, fixtures unchanged; ledger records `invalidators`
- invalidation: change to `apps/api/src/db/migrations/*` -> invalidate `E1, E2, T3..T12`; change to `packages/contracts/src/*` -> invalidate `E3, E4` + every downstream `T*`; change to `apps/api/src/features/checkout/*` -> invalidate `T8, T11, T12`; change to `apps/api/src/app.ts` or `seed.ts` -> invalidate `T11, T12`

## Agent Communication Contract

- style: `llm-oriented-markdowns` for every message + JSON string values
- transport: inline canonical JSON; temp artifact references only under Skill protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` (see `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`)
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1`
- worktree context: every assignment includes absolute path, implementation branch, base revision; every repository-relative path resolves under worktree root
- templates: reference canonical `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`; embed only when portability requires
- record shapes: reference canonical `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md` when object arrays become non-empty

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh runtime orchestrator; load source-checkout `CLAUDE.md`, this plan, canonical contracts, current checkpoint.
3. Record source branch (`expansion_002`) + `HEAD` (`8285c62`); resolve any relevant uncommitted-input blocker under worktree contract; refuse detached `HEAD`.
4. Create dedicated implementation branch + worktree from recorded `HEAD`; persist worktree identity in `orchestrator_run_state_v1`.
5. Switch execution root to worktree; load worktree `CLAUDE.md`; validate assumptions with user (see Decisions and Invariants) before `G0`.
6. Validate `G0`; project role-minimum + worktree context into assignments.
7. Launch `P1` inside worktree; on `worker_report_v1` acceptance, launch `R1`; validate `GR1`; then `P2` -> `R2` -> `GR2`.
8. Launch `P3 || P4 || P5 || P6 || P7` concurrently inside worktree; accept each report; launch each packet reviewer against exact settled change set before its consumer packet.
9. Route stable findings to fresh workers; close through targeted evidence; do not re-review fixes. Validate each `GR*`.
10. Validate `G1` (all P3..P7 reviewed); launch `P8` -> `R8` -> `GR8`.
11. Validate `G2`; launch `P9 || P10`; review each concurrently; validate `GR9`, `GR10`, `G3`.
12. Launch `S1`; run `T11` + `T12` once after S1 fixes settle; validate `GR11` and `G4`.
13. Leave implementation branch + worktree intact. Reply with absolute worktree path, implementation branch, source branch (`expansion_002`), base revision (`8285c62`). State user owns merge; note item 9 worktree will merge separately with additive collisions expected in `apps/api/src/db/migrations/index.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/app.ts`, `apps/api/src/db/seed.ts`, `apps/web/src/App.tsx`, `packages/contracts/src/index.ts`.

## Risks and Open Questions

- risk: destructive migration on `sessions` invalidates existing dev DB -> mitigation: `npm run reset` clears; documented in Constraints; verified through `E1`
- risk: checkout approval gate leaks reservation on defer -> mitigation: gate placed strictly before `carts.reserve` / `promos.reserve` / `inventory.reserveCheckout`; `R8` covers explicitly
- risk: total-drift retry allows quiet price change post-approval -> mitigation: `1%` drift tolerance + explicit `APPROVAL_TOTAL_DRIFT` code + audit
- risk: merge conflict with item 9 on `migrations/index.ts`, `auditEvent.ts`, `app.ts`, `seed.ts`, contracts `index.ts`, `App.tsx` -> mitigation: reserved additive-only regions per packet + item-9 boundary documented in Ownership; conflict remains textual, resolvable by user at merge
- risk: sole-owner deletion escape leaves company with no owner -> mitigation: block in `deletionService` (`OWNS_COMPANY`); block in `companyService.changeMemberRole` + `revokeMember`; `R6` + `R7` cover
- risk: invite token disclosure via error timing -> mitigation: constant-time compare on token digest; non-disclosing `INVITE_NOT_FOUND`
- question (blocking `G0`): confirm item 9 will not add columns to `sessions` or `users`, will not write migrations `025` or `026`, will not modify `checkoutService.ts` or `packages/contracts/src/payments.ts` -> owner: user
- question (blocking `G0`): confirm `PublicUser.role` stays `'customer' | 'admin'` in item 9 (membership role not folded into it) -> owner: user
- question (non-blocking): approval lease duration -- `24 h` chosen; owner: `S1` if user prefers different
- question (non-blocking): total-drift tolerance `1%` -- may need product review; owner: user at S1
- user-owned follow-up (not gating): manual visual spot-check of `AccountPage` + `/account/company` + `/account/approvals` at 1920x1080 after final merge; smoke-only, never a required gate

## Done Criteria

- session list + selective revocation observable through `/api/account/sessions` + `AccountPage`
- notification preferences persist + reload
- data export returns JSON snapshot + drops mailbox entry, excludes all listed secrets
- account deletion irreversible, retains historic orders, redacts PII, blocks sole-owner
- company creation + invites + role assignment + threshold updates work; approver notified via mailbox
- checkout above threshold defers to `PENDING_APPROVAL`; approver decision drives buyer retry; rejected + expired + drift branches return distinct error codes
- migrations `025` + `026` apply cleanly; `PRAGMA foreign_key_check` clean
- contracts additions exported via subpaths; no breaking change to existing consumers
- `npm run verify` passes
- `apps/api/test/integration/accountDepthEndToEnd.integration.test.ts` passes
- audit ledger carries every new action
- worktree remains intact; user owns merge back to `expansion_002` and integration with item 9 worktree
