# Review Depth Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `6. Review depth: partial`
Repository baseline: source checkout `C:\Users\iwano\Desktop\repos\demo_project_000`, branch `powder_expansion_2`, commit `3c3086d40d1b8d04cdcf8c821e0ec39425754e6b`, inspected 2026-07-19
Concurrent implementation: `plans/inventory_coding_plan.md` -> separate worktree `C:\Users\iwano\Desktop\repos\demo_project_000-worktrees\inventory-20260719-001`, branch `codex/inventory-20260719-001`, base `3c3086d40d1b8d04cdcf8c821e0ec39425754e6b`, observed head `6c79598cda3de8e15662e0476b54ded85006f295`; runtime revalidates moving identity and accepted state

## Runtime Worktree

- source: planning checkout = `C:\Users\iwano\Desktop\repos\demo_project_000`; runtime records absolute path, named branch, and `HEAD`
- preflight: detached `HEAD` -> stop for branch selection
- preflight: relevant uncommitted or untracked source changes absent from branch `HEAD`, excluding saved plan artifact -> stop for commit or explicit baseline choice; never copy, stash, discard, or import changes automatically
- create: unique `codex/review-depth-<run-id>` branch plus dedicated absolute sibling worktree from recorded source branch `HEAD`
- command: `git worktree add -b codex/review-depth-<run-id> <absolute-worktree-path> <source-branch>`
- verify: review worktree branch = implementation branch; review worktree `HEAD` = recorded source revision
- execution root: every review-depth implementation edit, generated write, worker test, reviewer inspection, fix, convergence step, and final verification runs inside review worktree
- internal parallelism: all review-depth packets share review worktree with disjoint ownership; no packet-specific worktrees
- source policy: source checkout read-only after worktree creation except saved plan and run-scoped temp state
- sibling policy: Inventory worktree and branch remain read-only to review-depth run; never edit, copy uncommitted state, merge, rebase, cherry-pick, or run commands there
- migration reservation: Inventory owns `015`; Review Depth owns `016`
- database isolation: never point review worktree at source checkout or Inventory database; use worktree-local ignored database or disposable test databases only
- ordinal safety: database with `016` but no `015` is disposable; never later insert `015` into that history. Preserved database migration waits for integrated branch containing ordered `015 -> 016`
- integration: no automatic cross-worktree merge, rebase, cherry-pick, copy-back, worktree deletion, or branch deletion
- completion reply: report retained absolute review worktree path, review branch, source branch, base revision, Inventory identity observed at `G0`, and unresolved cross-worktree union points; user owns merge and cleanup

## Objective

Complete review-depth slice: customers mark published reviews helpful, report abusive content, withdraw open reports, and see engagement state; admins use role-gated moderation queues to inspect reports, hide or restore reviews, and dismiss or action reports. Persist published rating aggregates transactionally without exposing hidden reviews or weakening existing ownership, verified-purchase, audit, and public-summary rules.

Completion boundary: product review section and `/admin/reviews` work against local API and SQLite. Moderation remains synchronous and local. Inventory implementation continues independently.

## Scope

### In

- authenticated-customer helpful toggle for published reviews
- authenticated-customer report create and withdraw for published reviews
- self-vote and self-report rejection
- one helpful vote and one report record per customer/review
- five-open-report per-customer cap
- report reasons: `spam|harassment|unsafe|off_topic|other`; bounded optional detail; `other` requires detail
- public helpful count, viewer engagement state, and `helpful` sort
- admin reported and hidden queues with stable pagination
- atomic admin decision: hide review plus action open reports, or dismiss open reports without visibility change
- existing admin hide/restore endpoint compatibility
- persisted published count, rating sum, and star counts with migration backfill
- review, vote, report, aggregate, moderation, audit, seed/reset, API, React, accessibility, and regression coverage
- deterministic review moderation seed scenarios reachable through `admin@example.com`

### Out

- comments, replies, images, review titles, reviewer badges beyond verified purchase
- unhelpful/down votes, vote weighting, ranking personalization, reputation
- automated takedown, text classification, profanity service, IP/device fingerprinting, CAPTCHA
- background moderation, notifications, email, webhook, retry queue
- admin product/order/refund/user/feature-flag UI
- user suspension, account strikes, legal hold, content export
- aggregate exposure in catalog/product transport outside review response
- Inventory files, stock behavior, backorders, checkout, payment, order allocation
- cross-worktree integration or migration of persistent database after branch merge

## Repository Findings

- existing: `apps/api/src/db/migrations/013_customer_reviews.ts` -> `reviews`; constrained rating/body/status, unique owner/product, published-list index
- existing: `apps/api/src/features/reviews/reviewRepository.ts` -> `listPublished()`, `summaryPublished()`, `findOwnedByProduct()`, `transitionStatus()`; summaries recomputed from `reviews`
- existing: `apps/api/src/features/reviews/reviewService.ts` -> customer CRUD, admin hide/restore, unit-of-work plus audit transaction
- existing: `apps/api/src/routes/reviews.ts` -> public list, owner read/write, admin hide/restore; strict TypeBox schemas and role gates
- existing: `packages/contracts/src/reviews.ts` -> strict public, owner, summary, list, and mutation schemas; `@shop/contracts/reviews` subpath already exported
- existing: `apps/api/src/plugins/auth.ts` -> global request-local optional user plus `requireCustomer()` and `requireAdmin()`
- existing: `apps/api/src/features/audit/auditEvent.ts` -> allowlisted body-free review mutation facts; review entity already supported
- existing: `apps/web/src/hooks/useProductReviews.ts` -> independent public/owner reads, abort on stale product request, mutation refresh
- existing: `apps/web/src/features/product/ReviewsSection.tsx` -> public summary/list plus customer-owned editor; secondary failure preserves product purchase flow
- existing: `apps/web/src/App.tsx`, `components/ProtectedRoute.tsx`, `components/AccountMenu.tsx` -> authenticated routes and account navigation; no admin route guard or admin page
- existing: `apps/api/src/db/seed.ts` -> deterministic users/products/orders; no seeded reviews
- existing: `apps/api/src/db/reset.ts` -> explicit FK-safe review deletion; new child and aggregate tables require ordered cleanup
- existing: `apps/api/test/reviews/**`, `packages/contracts/test/review-contracts.test.ts`, `apps/web/src/hooks/useProductReviews.test.tsx`, `apps/web/src/features/product/ReviewsSection.test.tsx` -> focused review coverage
- gap: helpful votes, reports, moderation queue reads, admin moderation UI, abuse caps, and persisted aggregates absent
- gap: public list cannot sort by helpful count or return viewer-specific engagement state
- constraint: Inventory worktree owns migration `015`, product/payment/order contracts, inventory schema, API composition, seed/reset integration, audit allowlist additions, README, and broad verification in sibling branch
- constraint: Inventory branch advances independently and already changes migration/index/reset/seed/contracts surfaces; review run cannot treat moving commits as upstream inputs unless user changes baseline
- constraint: migration validator rejects inserting `015` after database already recorded `016`
- reuse: existing review service unit-of-work -> atomic review/report/aggregate/audit mutations
- reuse: optional authenticated user set by `authPlugin()` -> personalized public response without requiring login
- reuse: existing admin hide/restore and admin account -> moderation navigation and compatibility
- reuse: allowlisted SQL sort map and bounded pagination -> public helpful sort and admin queues

## Decisions and Invariants

- decision: one review repository owns reviews, helpful votes, reports, moderation reads, and aggregate reads
- decision: database triggers own aggregate maintenance for every published review insert, rating/status update, and delete; service never duplicates aggregate arithmetic
- decision: `review_rating_aggregates` stores count, rating sum, five star counts; average derived as `rating_sum / published_count`
- decision: migration backfills aggregates from all existing published reviews before trigger activation
- decision: hidden reviews contribute zero public summary/list exposure while retaining votes and resolved-report history
- decision: public review item includes `helpfulCount`, `viewerCanEngage`, `viewerHasHelpfulVote`, `viewerHasOpenReport`; anonymous/admin/owner viewers cannot engage
- decision: `helpful` sort = helpful count descending, then creation time descending, then review ID descending
- decision: helpful `PUT` and `DELETE` are idempotent; audit fact emitted only when row changes
- decision: active report creation is conflict on duplicate; withdrawn/resolved/dismissed prior row can reopen with new reason/detail and timestamp
- decision: customer may hold at most five open reports across distinct reviews; sixth returns `429`
- decision: reports never hide review automatically; admin remains visibility authority
- decision: report detail excluded from public contracts and audit; admin-only queue receives bounded detail and reporter display name/ID
- decision: moderation decision handles all open reports for one review atomically: `hide_review` hides when needed and marks reports `actioned`; `dismiss_reports` preserves visibility and marks reports `dismissed`
- decision: existing `/hide` and `/restore` routes remain compatible and status-focused; reported queue uses new moderation decision command
- decision: owner edit of hidden review remains allowed; aggregate changes only when review is published
- decision: owner delete cascades votes/reports and decrements aggregate through trigger in same transaction
- decision: queue visibility and moderation routes require admin on backend; client route guard provides presentation only
- decision: review UI failure never blocks product details or purchase controls
- decision: no API composition change; existing review repository/service/route registration expands in place
- decision: Review Depth does not edit Inventory-owned contracts, catalog/cart/checkout/payment/order implementation, API `app.ts`, API package scripts, help content, or README
- baseline invariant requiring `G0` validation: branch contains accepted order-lifecycle and current review foundation through migration `014`
- external invariant requiring `G0` validation: Inventory still owns `015`; review owns `016`; both share recorded base or drift assessment is complete
- assumption requiring `G0` validation: Inventory does not change `reviews` table, review contracts, review service/repository/routes, or review UI paths
- assumption requiring `G0` validation: review-only databases remain disposable until user integrates `015` and `016`

## Target Design

### Contracts

- update `packages/contracts/src/reviews.ts`
- add `helpful` to `ReviewSort`
- extend public `Review`: `helpfulCount`, `viewerCanEngage`, `viewerHasHelpfulVote`, `viewerHasOpenReport`
- add `ReviewReportReason`, `CreateReviewReportBody`, `ReviewEngagementResponse`
- add `AdminReviewQueueQuery`: `queue=reported|hidden`, `sort=oldest|newest`, bounded page/pageSize
- add admin report item: report ID, reporter ID/display name, reason, nullable detail, created timestamp
- add admin queue item: owned review facts, product name/slug, open report count/list
- add `AdminReviewQueueResponse`
- add `AdminReviewModerationBody`: `decision=hide_review|dismiss_reports`
- add `AdminReviewModerationResponse`: review status, resolved report count, decision
- retain strict `additionalProperties: false`; retain public author email/user ID exclusion

### Data and migration

- proposed `apps/api/src/db/migrations/016_review_depth.ts`
- `review_rating_aggregates`
  - key: `product_id`; FK `products(id)` with cascade
  - fields: `published_count`, `rating_sum`, `stars_1..stars_5`, `updated_at`
  - constraints: nonnegative integers; count = star-count sum; rating sum = weighted star-count sum
- `review_helpful_votes`
  - key: `(review_id,user_id)`; FKs review/user with cascade
  - field: `created_at`
  - index: review count path
- `review_reports`
  - key: numeric ID; unique `(review_id,user_id)`
  - fields: reason, nullable detail, `open|withdrawn|dismissed|actioned`, created/updated/resolved timestamps, nullable resolving admin
  - constraints: reason/status allowlists, trim/length, resolution-field consistency
  - indexes: open queue order, review/status, user/status
- backfill: grouped published reviews -> exact aggregate rows
- triggers: published insert increment; published delete decrement; update subtract old published contribution then add new published contribution
- migration tests: preserved review backfill, hidden exclusion, direct write trigger behavior, constraints, cascade, rerun safety

### Domain and persistence

- extend `reviewRules.ts`: report normalization, queue normalization, helpful sort allowlist, open-report cap constant
- extend `ReviewRecord`: helpful/viewer flags only at query boundary; keep persistence row ownership internal
- `listPublished()` -> one SQL statement for helpful count and viewer vote/report state; no N+1
- `summaryPublished()` -> aggregate table only; missing row returns zero summary
- add engagement mutations, report cap/count, report reopen/withdraw, admin queue list/count, moderation decision persistence
- public mutation lookup requires published state before self/engagement checks
- queue SQL uses fixed predicates and allowlisted ordering only
- service wraps changed row, report status, audit append, and trigger-driven aggregate mutation in existing unit of work

### API

- extend `apps/api/src/routes/reviews.ts`; no new registration
- public list passes optional authenticated customer ID; anonymous/admin viewer ID = null
- `PUT /api/reviews/:reviewId/helpful` -> current engagement response
- `DELETE /api/reviews/:reviewId/helpful` -> current engagement response
- `POST /api/reviews/:reviewId/reports` -> created/reopened engagement response
- `DELETE /api/reviews/:reviewId/reports/me` -> withdrawn engagement response
- `GET /api/admin/reviews/moderation` -> filtered queue page
- `POST /api/admin/reviews/:reviewId/moderation` -> atomic decision response
- customer engagement/report routes use `requireCustomer()`; moderation queue/command use `requireAdmin()`
- mappings: invalid payload `400`; unauthenticated `401`; wrong role/self-action `403`; missing/hidden review `404`; duplicate/open-report transition `409`; report cap `429`

### Customer UI

- update review list with helpful count/toggle and report/withdraw controls
- show engagement controls only for eligible signed-in customer; preserve public counts for all viewers
- inline report disclosure with reason, conditional detail, cancel, submit, error alert, and focus return
- disable only active review mutation; announce helpful/report result through polite live region
- refetch viewer state when authenticated user changes; abort/ignore stale list and engagement completions
- retain public list and owner editor independence

### Admin UI

- proposed `/admin/reviews`
- admin-only route wrapper checks auth loading, authentication, and `role=admin`
- account menu shows `Review moderation` only for admin
- reported/hidden tabs use URL query state, stable pagination, loading/empty/error/retry states
- reported cards show product link, author, rating/body, helpful count, report reasons/details, timestamps
- actions: `Hide and action reports`, `Dismiss reports`, `Restore review`
- successful removal moves focus to next card or queue heading; mutation failure uses `role=alert`; queue count update uses polite live region
- backend remains sole permission and moderation authority

### Seed and reset

- proposed `apps/api/src/db/reviewSeedScenarios.ts` isolates deterministic review fixtures from Inventory seed edits
- seed published helpful example, published open-report example, hidden example, and matching aggregate/report/vote facts through normal constrained SQL
- `seed.ts` invokes helper after canonical users/products/order scenarios; normal seed remains idempotent and preserves noncanonical user content
- reset deletes reports and votes before reviews, then aggregate rows before products/users; audit remains retained

## Execution Graph

`W0 -> G0 -> F1 -> R1 -> G1 -> {P1 || P2 || P3} -> {R2 || R3 || R4} -> G2 -> C1 -> R5 -> fixes -> G3`

- `W0`: record source and sibling Inventory identities; create review worktree
- `G0`: validate baseline, migration reservation, dirty-input policy, external collision assumptions, disposable database rule
- `G1`: contracts/migration/audit foundation accepted; build artifacts current
- `G2`: backend and both UI lanes accepted; required findings closed; handoffs stable
- `G3`: seed/reset, route/navigation composition, manual checks, smoke, final verify current

## Work Packets

### F1: Contracts, migration, aggregate authority, and audit vocabulary

- mode: sequential after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/reviews.ts`, `packages/contracts/test/review-contracts.test.ts`, `apps/api/src/db/migrations/016_review_depth.ts` (proposed), `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/reset.ts`, `apps/api/test/db/migrations.integration.test.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditEvent.test.ts`
- reads: `apps/api/src/db/migrations/013_customer_reviews.ts` -> `reviews` constraints -> additive schema/backfill
- reads: `apps/api/src/db/migrate.ts` -> ordered-history validation -> `016` isolation rule
- reads: `apps/api/src/features/reviews/reviewRepository.ts` -> current record/query needs -> contract and schema fit
- reads: `plans/inventory_coding_plan.md` -> `F1`, ownership/collision rules -> protect `015` and sibling changes
- acceptance: strict contracts cover customer engagement/admin queues; `016` backfills and maintains exact aggregates; audit builder accepts only privacy-safe new facts; reset order valid
- non-goals: repository/service/routes/UI/seed scenario; Inventory schema or actions
- upstream inputs: `G0` -> recorded source/Inventory identities and migration decision
- changes: add schemas; add `016`; register after current baseline migration list while leaving `015` reserved; add aggregate triggers/backfill; extend reset; add audit actions and exact metadata validation; update focused tests
- invariants: no hidden aggregate contribution; no report detail in audit; no `015` file; no contracts index/package edit; no persistent shared DB
- relevant evidence: none before packet
- test duty: `npm run build -w @shop/contracts`; `npm test -w @shop/contracts`; `npm exec -w @shop/api -- tsx --test src/features/audit/auditEvent.test.ts test/db/migrations.integration.test.ts`
- verification: migration from `013/014` review fixtures preserves IDs/content/status and produces exact aggregate; direct write triggers stay consistent
- handoff: accepted review contracts, schema names/constraints, audit inputs, `EV-F1-CONTRACTS`, `EV-F1-MIGRATION`

### P1: Review engagement, moderation service, and API

- mode: parallel with `P2|P3` after `G1`
- depends on: `F1`, `R1`, `G1`
- owns: `apps/api/src/features/reviews/reviewRules.ts`, `apps/api/src/features/reviews/reviewRules.test.ts`, `apps/api/src/features/reviews/reviewRepository.ts`, `apps/api/src/features/reviews/reviewService.ts`, `apps/api/src/routes/reviews.ts`, `apps/api/test/reviews/reviews.integration.test.ts`, `apps/api/test/reviews/reviewRoutes.integration.test.ts`
- reads: `packages/contracts/src/reviews.ts` -> accepted schemas -> transport mapping
- reads: `apps/api/src/plugins/auth.ts` -> optional user and role gates -> viewer state/permissions
- reads: `apps/api/src/db/unitOfWork.ts` and `features/audit/auditService.ts` -> atomic mutation boundary
- acceptance: public helpful state/sort, idempotent votes, constrained reports, cap, queues, decisions, aggregate reads, roles, audit rollback, and existing review behavior pass SQLite/Fastify tests
- non-goals: UI, seed/reset, composition root, Inventory behavior
- upstream inputs: `F1` -> accepted contract/schema/audit change set
- changes: normalize reports/queues; extend repository SQL without N+1; add service commands/queries; map new errors; extend existing routes; preserve hide/restore compatibility; extend focused tests
- invariants: published-only public/engagement lookup; no self-action; no automatic hide; one UoW per mutation; body/detail absent from audit; verified-purchase query unchanged
- relevant evidence: `EV-F1-CONTRACTS`, `EV-F1-MIGRATION`
- test duty: `npm exec -w @shop/api -- tsx --test src/features/reviews/reviewRules.test.ts test/reviews/reviews.integration.test.ts test/reviews/reviewRoutes.integration.test.ts`
- verification: concurrent duplicate vote/report attempts cannot create duplicate rows; audit failure rolls back all domain rows and aggregate/status effects
- handoff: stable service/HTTP behavior, `EV-P1-BACKEND`

### P2: Customer helpful and report experience

- mode: parallel with `P1|P3` after `G1`
- depends on: `F1`, `R1`, `G1`
- owns: `apps/web/src/api/reviews.ts`, `apps/web/src/hooks/useProductReviews.ts`, `apps/web/src/hooks/useProductReviews.test.tsx`, `apps/web/src/features/product/ReviewList.tsx`, `apps/web/src/features/product/ReviewList.test.tsx` (proposed), `apps/web/src/features/product/ReviewsSection.tsx`, `apps/web/src/features/product/ReviewsSection.test.tsx`
- reads: `packages/contracts/src/reviews.ts` -> accepted viewer/report schemas -> typed API and state
- reads: `apps/web/src/api/client.ts` -> validated response/error behavior
- reads: `apps/web/src/hooks/AuthContext.tsx` -> viewer identity transitions
- acceptance: helpful toggle, report/withdraw, helpful sort, sign-in/owner eligibility, live announcements, focus, retry, and stale-response handling match contracts
- non-goals: owner review editor redesign, admin UI, backend implementation, product purchase UI
- upstream inputs: `F1` -> accepted public review and engagement contracts
- changes: add typed API calls; extend hook state/actions; refresh on viewer change; render accessible engagement/report controls; add focused tests
- invariants: server response owns counts/state; mutation failure preserves prior list; product purchase flow remains usable when reviews fail; report detail never logged/stored client-side
- relevant evidence: `EV-F1-CONTRACTS`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/hooks/useProductReviews.test.tsx src/features/product/ReviewList.test.tsx src/features/product/ReviewsSection.test.tsx`
- verification: keyboard-only report flow, per-row disabled state, `role=alert`, polite status, stale completion suppression
- handoff: customer review presentation, `EV-P2-CUSTOMER-WEB`

### P3: Admin moderation queues and page

- mode: parallel with `P1|P2` after `G1`
- depends on: `F1`, `R1`, `G1`
- owns: `apps/web/src/api/adminReviews.ts` (proposed), `apps/web/src/components/AdminRoute.tsx` (proposed), `apps/web/src/components/AdminRoute.test.tsx` (proposed), `apps/web/src/features/admin/reviews/**` (proposed)
- reads: `packages/contracts/src/reviews.ts` -> accepted admin schemas -> typed client/page
- reads: `apps/web/src/components/ProtectedRoute.tsx` and `hooks/AuthContext.tsx` -> route-guard patterns
- reads: `apps/web/src/features/orders/OrderHistoryPage.tsx` -> pagination/loading/error presentation
- acceptance: reported/hidden URL-backed queues, admin guard, typed decisions, restoration, loading/empty/error states, focus, and live announcements pass focused React tests
- non-goals: route registration/menu edit, customer review UI, generic admin shell, audit UI
- upstream inputs: `F1` -> accepted admin queue and moderation contracts
- changes: add typed admin client; add role guard; build moderation page/components/hook; cover stale queue loads and mutation failures
- invariants: client guard never substitutes backend auth; no customer email; detail rendered as text; queue request cancellation prevents stale overwrite
- relevant evidence: `EV-F1-CONTRACTS`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/components/AdminRoute.test.tsx src/features/admin/reviews/AdminReviewModerationPage.test.tsx`
- verification: customer cannot view page content; direct admin navigation works; successful action preserves deterministic focus
- handoff: admin route element/page/client, `EV-P3-ADMIN-WEB`

### C1: Seed, navigation, integration, and convergence

- mode: sequential after `G2`
- depends on: `P1`, `P2`, `P3`, `R2`, `R3`, `R4`, `G2`
- owns: `apps/api/src/db/reviewSeedScenarios.ts` (proposed), `apps/api/src/db/seed.ts`, `apps/api/test/db/seed.integration.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/AccountMenu.tsx`, `apps/web/src/components/AccountMenu.test.tsx` (proposed), integration-only test edits assigned after fan-in
- reads: accepted `P1|P2|P3` handoffs -> routes/components/contracts/evidence
- reads: `apps/api/src/db/orderSeedScenarios.ts` -> existing deterministic fixture ordering
- reads: `plans/inventory_coding_plan.md` -> sibling seed/reset ownership -> merge-ready isolation
- acceptance: deterministic moderation fixtures seed/reset; admin route/menu composed; focused cross-lane checks and browser journey pass; smoke and final verify current
- non-goals: API `app.ts`, API package scripts, README/help, cross-worktree merge, Inventory verification
- upstream inputs: `G2` -> accepted backend/customer/admin change sets and closed findings
- changes: add isolated seed helper; invoke after users/products/orders; compose `/admin/reviews`; expose admin-only menu item; resolve review-run integration issues only
- invariants: normal customer navigation remains simple; seed idempotent and preserves noncanonical reviews; no default/shared database use; no Inventory file import
- relevant evidence: `EV-P1-BACKEND`, `EV-P2-CUSTOMER-WEB`, `EV-P3-ADMIN-WEB`
- test duty: `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts test/reviews/reviewRoutes.integration.test.ts`; `npm exec -w @shop/web -- vitest run --configLoader runner src/components/AccountMenu.test.tsx src/features/admin/reviews/AdminReviewModerationPage.test.tsx src/features/product/ReviewsSection.test.tsx`; `npm run smoke`; after `R5` fixes, `npm run verify` once
- verification: use worktree-local loopback server and worktree-local disposable DB; sign in as admin; inspect reported/hidden queues; dismiss, hide, restore; sign in customer; toggle helpful, report, withdraw; confirm product purchase remains usable
- handoff: integrated review-depth change set, `EV-C1-SEED`, `EV-C1-WEB`, `EV-C1-SMOKE`, `EV-C1-VERIFY`, manual evidence

## Review Assignments

### R1: Review `F1` contracts, schema, aggregates, and audit

- target: accepted `F1` change set; base = exact `G0` revision; head = accepted `F1` head
- reads: `packages/contracts/src/reviews.ts`, migration `016`, audit builder, migration tests -> strict shape, preservation, trigger arithmetic, privacy
- acceptance: contracts match scope; existing review data survives; aggregate triggers cover every visibility/rating mutation; ordinal policy honored
- invariants: hidden exclusion; no negative/inconsistent aggregate; no `015`; no report detail in audit
- risk focus: trigger double-count, update status/rating edge, backfill drift, cascade ordering, future `015` insertion hazard
- non-goals: service/routes/UI
- write policy: inspect-only
- test policy: assess `EV-F1-CONTRACTS|EV-F1-MIGRATION`; run only when stale/missing evidence blocks verdict
- relevant evidence: exact `F1` evidence entries
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P1` backend behavior

- target: accepted `P1` change set; base/head from checkpoint
- reads: review rules/repository/service/routes -> queries, auth, transactions, errors, compatibility
- acceptance: votes/reports/queues/moderation behave atomically and existing public/owner/admin flows remain compatible
- invariants: published-only engagement; self-action rejection; report cap; no N+1; no auto-hide; audit rollback
- risk focus: duplicate concurrency, queue count/list mismatch, viewer leakage, hidden restore aggregate, partial report resolution
- non-goals: React presentation
- write policy: inspect-only
- test policy: assess `EV-P1-BACKEND`; no valid command rerun
- relevant evidence: `EV-P1-BACKEND`, `EV-F1-MIGRATION`
- return: `reviewer_report_v1`

### R3: Review `P2` customer behavior and accessibility

- target: accepted `P2` change set; base/head from checkpoint
- reads: customer review API/hook/list/section -> auth transitions, mutation state, focus, errors
- acceptance: eligibility, counts, report form, retry, and stale-state behavior match contract without blocking product flow
- invariants: backend authority; no hidden/admin data; no stale completion overwrite
- risk focus: optimistic count drift, duplicate submit, auth switch, inaccessible disclosure/live status
- non-goals: backend or admin page
- write policy: inspect-only
- test policy: assess `EV-P2-CUSTOMER-WEB`; no valid command rerun
- relevant evidence: `EV-P2-CUSTOMER-WEB`, `EV-F1-CONTRACTS`
- return: `reviewer_report_v1`

### R4: Review `P3` admin queues and accessibility

- target: accepted `P3` change set; base/head from checkpoint
- reads: admin client/guard/page -> role presentation, queue URL state, mutation recovery, report rendering
- acceptance: only admin sees content; queue actions are clear and accessible; stale requests cannot replace current queue
- invariants: backend auth remains authority; report content rendered inert; no generic admin-scope expansion
- risk focus: customer content flash, detail injection, focus loss after row removal, pagination under mutation
- non-goals: service correctness or customer list
- write policy: inspect-only
- test policy: assess `EV-P3-ADMIN-WEB`; no valid command rerun
- relevant evidence: `EV-P3-ADMIN-WEB`, `EV-F1-CONTRACTS`
- return: `reviewer_report_v1`

### R5: Review integrated review-depth slice

- target: exact `C1` integrated change set after all prior fixes; base/head from checkpoint
- reads: this plan -> done criteria; contracts/migration/backend/customer/admin/seed/navigation -> cross-lane consistency
- acceptance: full scope integrated; seed/reset deterministic; evidence current; no Inventory scope or future admin/async leakage
- invariants: clone-to-running constraints, one SQLite authority, strict auth, product-flow resilience, review-only worktree/database isolation
- risk focus: omitted route/menu wiring, seed collision, stale contract build, aggregate drift, unreviewed integration fix, shared-file merge ambiguity
- non-goals: Inventory implementation or cross-branch integration verdict
- write policy: inspect-only
- test policy: assess `EV-C1-SEED|EV-C1-WEB|EV-C1-SMOKE` and manual evidence; final `npm run verify` remains `C1` duty after fixes
- relevant evidence: all current review-slice evidence projected by orchestrator
- return: `reviewer_report_v1`; findings route once to responsible worker or `C1`

## Ownership and Collision Rules

- internal contracts/migration/audit foundation: `F1` only
- internal backend review paths: `P1` only
- internal customer review UI: `P2` only
- internal admin review UI: `P3` only
- internal seed/navigation composition: `C1` only
- `packages/contracts/src/index.ts`, `packages/contracts/package.json`: no Review Depth edits; existing reviews export reused
- `apps/api/src/app.ts`, `apps/api/package.json`: no Review Depth edits; existing review registration and test glob reused
- `README.md`, help content: no Review Depth edits during parallel run
- contract change after `G1` -> return to `F1`; invalidate affected `P1|P2|P3` evidence
- migration/trigger change after `G1` -> return to `F1`; invalidate `P1`, seed, smoke, verify evidence
- repository/service/route change -> invalidate `P1` plus smallest affected UI contract/integration evidence
- external shared files: Review branch may edit only its own logical entries; user merges union with Inventory later
  - `apps/api/src/db/migrations/index.ts`: retain Inventory `015` before Review `016`
  - `apps/api/test/db/migrations.integration.test.ts`: expected versions and assertions include both slices
  - `apps/api/src/db/reset.ts`: retain FK-safe deletes for both inventory and review tables
  - `apps/api/src/db/seed.ts` and seed tests: retain Inventory product/backorder fixtures plus Review helper invocation/assertions
  - `apps/api/src/features/audit/auditEvent.ts` and tests: retain union of inventory and review actions/entity types/switch cases
- external merge validation required after user integration: fresh DB `001 -> ... -> 015 -> 016`; preserved DB through `014 -> 015 -> 016`; union-focused tests; broad verify
- review runtime never resolves external conflicts inside Inventory worktree

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification inside review worktree; launch globally configured `reviewer` agent for review assignments inside review worktree. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment.
- non-Codex harnesses: ignore Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and communication contracts.

## Test Execution Schedule

- working directory: recorded review worktree path for every command
- prerequisite: `node --version` -> `v22.x`; dependency health per `CLAUDE.md`
- `T1`: after `F1` -> contracts build/tests, audit unit, migration integration -> `EV-F1-CONTRACTS`, `EV-F1-MIGRATION`
- `T2`: after `P1` -> review rules, SQLite service, Fastify routes -> `EV-P1-BACKEND`
- `T3`: after `P2` -> focused customer React tests -> `EV-P2-CUSTOMER-WEB`
- `T4`: after `P3` -> focused admin React tests -> `EV-P3-ADMIN-WEB`
- `T5`: after fan-in -> `C1` seed plus focused cross-lane API/web checks -> `EV-C1-SEED`, `EV-C1-WEB`
- `T6`: after integration fixes -> `C1` runs `npm run smoke` once -> `EV-C1-SMOKE`
- `T7`: after `R5` fixes settle -> `C1` runs `npm run verify` once -> `EV-C1-VERIFY`
- manual: loopback server only; worktree-local disposable DB; stop only server started by review run
- reuse: pass current evidence IDs plus exact change set; new session never reruns valid command
- invalidation: contract change -> `T1` and affected `T2|T3|T4|T5|T6|T7`
- invalidation: migration/reset/seed change -> `T1|T5|T6|T7`
- invalidation: backend review change -> `T2|T5|T6|T7`
- invalidation: customer/admin UI change -> smallest focused `T3|T4`, then broad entries only when suite/build scope affected
- reviewer commands: none by default; inspect exact target plus supplied current evidence

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values
- transport: inline canonical JSON; temp artifact references only under protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + `CLAUDE.md` + relevant artifact references + accepted upstream inputs; exclude full source plan, full generated plan, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- recovery snapshot: `orchestrator_run_state_v1`
- worktree context: every assignment includes review worktree absolute path, branch, and base revision; repository-relative paths resolve under review worktree root
- sibling context: assignments receive Inventory identity/collision rule only when packet owns shared logical integration point; never receive Inventory diff or uncommitted files
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- runtime state: platform temp root `/orchestrator/[run_id]/state.json`; atomic replacement; canonical source/review-worktree objects plus external Inventory observation recorded through fixed `decisions[]` shape before packet launch; no new checkpoint keys or repository runtime reports
- finding flow: stable reviewer finding ID -> originating worker fix directive -> smallest post-fix evidence -> orchestrator closure; no reviewer loop

## Orchestrator Run Order

1. End planning context after saving this file.
2. Start fresh runtime orchestrator; load source-checkout `CLAUDE.md`, this plan, canonical communication contracts, current checkpoint.
3. Record source checkout absolute path, named branch, and `HEAD`; permit saved plan artifact only; block other relevant dirty input.
4. Record Inventory worktree path, branch, base, head, status, and plan reservation without reading or importing uncommitted implementation.
5. Create unique review branch/worktree from source branch `HEAD`; verify and persist identities; switch execution root.
6. Validate `G0`: current review foundation, `015` Inventory reservation, `016` Review reservation, external path assumptions, database isolation.
7. Assign `F1`; accept contracts/schema/audit handoff and evidence; assign inspect-only `R1`; route findings; validate `G1`.
8. Launch `P1 || P2 || P3` inside review worktree with accepted `F1` inputs and disjoint ownership.
9. Accept reports and evidence; launch `R2|R3|R4` against exact targets as slots permit.
10. Route required findings once to owning workers; record fixes and targeted evidence; validate `G2`.
11. Assign `C1`; add seed/navigation composition; run focused fan-in checks, manual worktree-local journey, and `npm run smoke` once.
12. Assign `R5` against exact integrated review target; route findings once; invalidate smallest evidence set.
13. `C1` runs targeted fix checks, then `npm run verify` once; validate `G3`.
14. Record external collision manifest with paths and required union behavior. Do not inspect moving Inventory diff as review verdict input.
15. Leave review implementation branch/worktree intact. Report review identity, observed Inventory identity, verification, disposable DB warning, and user-owned merge/cleanup.

## Risks and Open Questions

- risk: `016` applied before future `015` in same database -> mitigation: review-only DB disposable; preserved DB waits for integrated ordered migration set
- risk: Inventory changes shared migration/reset/seed/audit files concurrently -> mitigation: logical-entry ownership, explicit union manifest, user-controlled integration, post-merge dual-slice verification
- risk: Inventory base or contracts drift from recorded baseline -> mitigation: `G0` identity check; stop only when drift touches review assumptions or migration ordering
- risk: aggregate triggers double-count rating/status update -> mitigation: subtract-old/add-new trigger tests across published/hidden/rating permutations
- risk: report spam across many reviews -> mitigation: one active report per review/customer plus five-open-report cap
- risk: malicious reports cause automatic censorship -> mitigation: no automatic visibility transition; admin decision required
- risk: public response leaks report detail or reporter identity -> mitigation: public schema exposes booleans only; admin schema owns report data
- risk: personalized list causes stale state after login/logout -> mitigation: user identity invalidates list request; abort/ignore prior completion
- risk: admin queue pagination skips after row removal -> mitigation: clamp/refetch current page and deterministic focus tests
- risk: owner deletes review with engagement/report rows -> mitigation: FK cascade plus aggregate trigger in one transaction
- question resolved: helpful model -> positive toggle only; no down vote
- question resolved: reports -> reason allowlist, optional bounded detail, customer withdrawal, admin resolution
- question resolved: moderation -> synchronous reported/hidden queues; no background or auto-hide
- question resolved: aggregate authority -> persisted trigger-maintained rating counts

## Done Criteria

- public review summary reads persisted aggregate and matches published rows after create, rating edit, hide, restore, and delete
- migration backfills existing published reviews exactly; hidden reviews excluded; direct constrained writes cannot drift aggregate
- customer can add/remove one helpful vote; duplicate same-state command is safe; count never negative or duplicated
- helpful sort stable under equal counts
- customer can report eligible review, withdraw open report, and reopen resolved/withdrawn record under cap
- customer cannot vote/report own or hidden review; admin cannot use customer engagement endpoints
- sixth open report returns `429`; report detail never appears publicly or in audit
- reported and hidden admin queues enforce auth, stable pagination, fixed sorting, and exact count/list predicates
- admin hide decision atomically hides review, actions all open reports, updates aggregate, and writes one safe audit fact
- admin dismiss decision resolves open reports without changing review visibility
- existing hide/restore, owner CRUD, verified-purchase, public sorting, and published-only behavior remain compatible
- customer helpful/report UI and admin moderation UI cover loading, empty, error, retry, stale response, keyboard, focus, alert, and live status states
- product purchase flow remains available when review reads or mutations fail
- seeded admin journey exposes reported and hidden examples; seed/reset repeat deterministically without overwriting noncanonical reviews
- all focused evidence current; `npm run smoke` and final `npm run verify` pass in review worktree
- review implementation touches no Inventory worktree and performs no cross-branch integration
- external collision manifest names exact union behavior for migration index/tests, reset, seed, and audit
- review worktree remains intact; completion reply reports review and Inventory identities, base revision, database isolation warning, and user-owned merge/cleanup
