# Buy Again / Reorder Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `12. Buy Again / reorder`
Repository baseline: branch `expansion_002` @ `186039d`; inspection 2026-07-30

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD` before any implementation write
- detached `HEAD` -> stop and ask user to select a branch
- relevant uncommitted or untracked source-checkout changes absent from branch `HEAD` -> stop and ask user to commit them or choose a baseline; never copy, stash, discard, or import them without explicit approval
- create: dedicated implementation branch + worktree from recorded `HEAD`
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree
- integration: no merge, no rebase, no cherry-pick, no copy-back, no worktree cleanup; user handles merge
- completion reply: absolute worktree path + implementation branch + source branch + base revision

## Objective

Buyer triggers one `Buy again` action on any past order -> order lines re-added to active cart. Partial success is normal outcome, not error: each order line returns added-or-skipped with exact reason and server-resolved price drift. Delivers reusable multi-line cart-add path consumed later by Saved Lists (13) and Quick Order (14).

Completion boundary: cart is filled and outcomes disclosed. Checkout, approvals, delivery, payment untouched.

## Scope

### In

- `POST /api/orders/:orderId/reorder` -> owned past order -> multi-line cart add -> per-line outcome report
- generic multi-line add command on cart domain (`addMany`) preserving every single-add invariant
- per-line skip reasons: retired variant, unresolvable variant, insufficient stock, below MOQ, arithmetic overflow, blend unavailable
- price-drift disclosure per added line from server-resolved price, never from order snapshot
- custom blend lines re-added through configured-line path carrying `configKey` identity
- demand aggregation across duplicate order lines sharing `(variantId, configKey)` before stock/MOQ evaluation
- `Buy again` control on order history rows and order detail, plus outcome summary UI
- audit event for reorder cart mutation
- one seeded demo order scenario exercising mixed outcomes

### Out

- no schema change, no migration; migration head stays `028`
- no preview/dry-run endpoint; single POST action is the whole interaction
- no substitution, alternative-lot suggestion, or fallback variant for retired lines
- no auto-clamp of quantity to available stock; no auto-raise to MOQ floor
- no deep-link into checkout, no one-click repurchase bypassing cart
- no Saved Lists (13) or Quick Order (14) surfaces; `addMany` only stays generic enough for them
- no change to bundle add path (`bundleService.addToCart` stays all-or-nothing)
- no `config_key` column on `order_line_items`
- no admin surface, no feature-flag gate, no job queue, no notification
- no fix of latent retired-line pricing in `cartRepository.listLines`
- no `total` field added to `OrderListResponse`

## Repository Findings

- existing: `apps/api/src/features/cart/cartService.ts` -> `addItem` L445, `addConfiguredItem` L477, `runCartMutation` L243 -> single-line adds only, wrapped by `unitOfWork.run`
- existing: `apps/api/src/features/cart/cartService.ts` -> `minimumMoqQuantity` L515, `supportsCartLineArithmetic` L532, `hydrateCustomBlend` L381 -> reusable private guards
- existing: `apps/api/src/features/cart/cartRepository.ts` -> `addLineQuantity` L166 (UPSERT on `(cart_id, variant_id, config_key)`), `addConfiguredLineQuantity` L175, `lineQuantity(cartId, variantId, configKey?)`, `variantExists` L140 (`active = 1` filter), `getVariant` L300 (no active filter), `listEligibleCustomBlendFacts` L118
- existing: `apps/api/src/features/bundles/bundleService.ts` -> `addToCart` L205 -> only multi-line write today; bypasses `cartService` entirely, all-or-nothing, enforces stock but skips MOQ and overflow guards -> not reusable for 12
- gap: no partial-success multi-line add; no per-line outcome type anywhere in repo
- existing: `apps/api/src/features/pricing/pricingRules.ts` -> `resolveUnitPriceCents` L117, `validateMoq` L142, `moqShortfallSacks` L158 (exported, zero production callers), `nextTierProgress` L85, `perTonneCents` L132
- existing: `apps/api/src/features/pricing/clearanceRules.ts` -> `resolveClearance` L32 -> half-open `[startsAt, endsAt)` at injected clock
- constraint: no `resolvePricing(variantId, ...)` entry point exists; pricing is pure leaf functions composed per caller. Canonical composition order lives in `cartService.getCart` L320-359 -> clearance -> tier -> per-tonne. Reorder must reuse that order, not invent a second one
- existing: `apps/api/src/features/inventory/inventoryService.ts` -> `availableToSell(variantIds, nowIso)` L128 -> rows `{variantId, stockCount, availableToSell, backorderable, backorderLeadDays}`; no `active` filter
- existing: `apps/api/src/features/customBlend/customBlendRules.ts` -> `normalizeCustomBlendSpec` L105, `canonicalCustomBlendJson` L92, `hashCustomBlendCanonicalJson` L100 -> canonical ordering + sha256 `configKey`
- existing: `apps/api/src/features/orders/orderRepository.ts` -> `findOwnedDetail`, `mapOrder` L205; blend snapshot hydrated fail-closed by `hydrateOrderCustomBlend` L150
- constraint: `order_line_items` has no `config_key` column (rebuilt `apps/api/src/db/migrations/022_custom_blends.ts` L103-128). Blend identity survives only inside `custom_blend_json.configKey`
- constraint: `order_line_items.variant_id` is nullable, has no FK to `product_variants`, and hydration synthesises `sku ?? ''` / `weightGrams ?? 1000` fallbacks -> reorder must resolve variants live, never trust the snapshot
- existing: `apps/api/src/routes/orders.ts` -> `GET /api/orders` L40 uses `requireCustomer`; `GET /api/orders/:orderId` L62 has no preHandler and falls back to guest cookie; `ORDER_FORBIDDEN -> sendNotFound` L18
- existing: `apps/api/src/plugins/auth.ts` -> `requireCustomer(sessions)` L79; `apps/api/src/utils/errors.ts` -> `sendNotFound`, `sendConflict`, `sendBadRequest`
- constraint: `apps/api/src/app.ts` is composition root -> new service field on `AppServices`, construction in `createAppServices`, `await app.register(...)` line. Single owner required
- constraint: `packages/contracts/src/index.ts` re-export AND a `packages/contracts/package.json` `exports` subpath are both required for a new contract module; consumers must rebuild `@shop/contracts` before typecheck
- existing: `apps/web/src/hooks/useCart.ts` -> `CartAction` union L11, `applyMutationCart` L124, `mutationSequenceRef` L94, `runCartAction` L166 with `retryAfterRecovery`, `addBundle` L241 -> pattern to extend
- existing: `apps/web/src/features/orders/OrderHistoryPage.tsx` (row link only, no actions), `OrderDetailPage.tsx` L140 (cancel wiring), `OrderDetailView.tsx` L327 (cancel button placement)
- constraint: web has one stylesheet `apps/web/src/index.css`; styling is Tailwind utilities + `components/ui/` primitives; no CSS modules
- constraint: `apps/api/package.json` `test:unit` is an explicit file list and `test:integration` is an explicit per-directory glob list -> new api test paths must be registered there or they never run
- reuse: `apps/api/test/cart/cart.integration.test.ts` + `apps/api/test/cart/bundles.integration.test.ts` -> temp-dir SQLite + `buildApp` + `app.inject` pattern to copy
- reuse: `apps/api/src/db/orderSeedScenarios.ts` -> `DEMO_ORDER_SCENARIO_KEYS` tuple + `Scenario` literal list -> append pattern for new fixture
- obsolete plan claim: high-level plan L88-90 cites `plans/old/` and `plans/account_depth_coding_plan.md`; both deleted at `186039d`. Do not treat as readable evidence

## Decisions and Invariants

- backend is sole authority for eligibility, quantity, and price; web renders returned outcomes only
- one line outcome rule: a line is added at full ordered quantity or not added at all. No partial quantity, no clamping
- price drift never blocks an add. Drift is disclosure, computed from server-resolved price at the resulting cart line quantity (post-add cumulative), matching what the buyer will pay
- price resolution order fixed as clearance -> tier: `resolveClearance` -> `resolvedBasePriceCents` -> `resolveUnitPriceCents(resolvedBase, resultingQuantity, weightGrams)`. Clock injected, never `Date.now()`
- retired variant (`active = 0`) and missing variant collapse to one reason `VARIANT_RETIRED`; no substitution offered
- order line with `variant_id IS NULL` -> `VARIANT_UNRESOLVED`; never fall back to `findDefaultVariant`
- MOQ evaluated on post-add cumulative line quantity per `(variantId, configKey)`, identical to `addItem` L467
- stock evaluated as `availableToSell < existingLineQuantity + requestedQuantity` and only for `backorderable = 0` variants; backorderable variants always pass
- duplicate order lines sharing `(variantId, configKey)` aggregate into one demand before stock/MOQ evaluation; the group outcome fans back to every member line
- blend lines re-add through the configured-line path; spec is re-normalised from `custom_blend_json.ingredients` and re-hashed. Recomputed hash must equal stored `configKey`, else `BLEND_UNAVAILABLE`
- blending fee always uses current `CUSTOM_BLEND_FEE_CENTS`, never the order snapshot value
- whole request fails only on: cart missing (404), cart reserved for checkout (409), order not found or not owned (404, mirroring `ORDER_FORBIDDEN -> sendNotFound`)
- all-skipped is a success response: 200, cart unchanged, every outcome carries a reason
- one transaction per reorder request via `unitOfWork.run`; committed writes are the added lines only; one audit event `cart.reorder_added` per request carrying `orderId`, added count, skipped count
- no idempotency key: repeat POST increments quantities, identical to `addItem` and `bundleService.addToCart`. Web guards with a pending key
- `addMany` stays feature-agnostic: caller supplies `{key, variantId, quantity, customBlend?}` and receives outcomes echoing `key`. No order concept enters the cart feature
- domain returns domain-shaped outcomes; contract mapping happens in the route layer only
- assumption: reorder is offered for every order visible in history including `cancelled` and returned orders -> validate at `G0`
- assumption: reorder requires `requireCustomer` + ownership; the guest-cookie path used by `GET /api/orders/:orderId` is not extended to this write -> validate at `G0`
- assumption: `BELOW_MOQ` skips the line rather than raising quantity to the MOQ floor, because raising changes buyer intent silently -> validate at `G0`

## Target Design

### Contracts

- proposed `packages/contracts/src/reorder.ts`
- `ReorderRequestBody` -> `{cartId: string minLength 1}`, `additionalProperties: false`
- `ReorderSkipReason` -> union `VARIANT_RETIRED | VARIANT_UNRESOLVED | INSUFFICIENT_STOCK | BELOW_MOQ | INVALID_QUANTITY | BLEND_UNAVAILABLE`
- `ReorderLineOutcome` -> `{orderLineItemId, productId, productName, variantId | null, sku | null, configKey, quantity, status: 'added' | 'skipped', reason: ReorderSkipReason | null, orderedUnitPriceCents, currentUnitPriceCents: number | null, priceChanged: boolean}`
- `ReorderResponse` -> `{cart: Cart, addedLineCount, skippedLineCount, outcomes: ReorderLineOutcome[]}`; `Cart` imported from `./cart.js`
- schema pairing rule: `status = 'added'` -> `reason = null`; `status = 'skipped'` -> `reason` non-null. Encode with the same custom-format technique already used by `CartLineConfigPair` in `packages/contracts/src/cart.ts` L47
- exports: `export * from './reorder.js'` in `packages/contracts/src/index.ts` plus `"./reorder"` subpath in `packages/contracts/package.json`

### Cart domain: generic multi-line add

- proposed `apps/api/src/features/cart/cartBulkAddRules.ts` -> pure classification, no SQL, no clock reads
- `BulkAddRequest` -> `{key: string, variantId: number, quantity: number, customBlend?: CustomBlendSnapshot}`
- `BulkAddOutcome` -> `{key, status, reason?, resultingQuantity?, resolvedUnitPriceCents?}`
- `aggregateBulkAddDemand(requests)` -> group by `(variantId, configKey)` preserving caller keys per group
- `classifyBulkAddGroup({variantRow, existingQuantity, requestedQuantity, availability, blendValid, now})` -> `added | skipped(reason)`; reason precedence fixed: `VARIANT_RETIRED` -> `BLEND_UNAVAILABLE` -> `INVALID_QUANTITY` -> `INSUFFICIENT_STOCK` -> `BELOW_MOQ`
- extend `apps/api/src/features/cart/cartService.ts` -> `addMany(cartId, requests, context)` on `CartService`
- `addMany` flow: `exists` -> `isReserved` -> load variant rows via `getVariant` -> `variantExists` for active gate -> single `inventory.availableToSell(variantIds, now)` call -> blend validation reusing `hydrateCustomBlend` inputs and `customBlendRules` -> classify -> write added groups via `addLineQuantity` / `addConfiguredLineQuantity` -> `touch` -> audit -> re-`getCart`
- whole body inside `runCartMutation` -> rollback on any unexpected throw; classified skips do not roll back
- `addMany` requires both audit and availability dependencies; missing -> throw, mirroring `requireAuditContext` L247
- `addMany` returns `{cart, outcomes}` or the existing whole-request literals `CART_NOT_FOUND | CART_RESERVED`

### Reorder domain

- proposed `apps/api/src/features/reorder/reorderRules.ts` -> pure mapping
- `toBulkAddRequests(orderLines)` -> one request per order line, key = `String(orderLineItemId)`; `variant_id` null -> pre-skip `VARIANT_UNRESOLVED` without reaching cart
- `assembleReorderOutcomes(orderLines, bulkOutcomes, resolvedPrices)` -> fan group outcomes back to member lines; compute `priceChanged = currentUnitPriceCents !== null && currentUnitPriceCents !== orderedUnitPriceCents`
- proposed `apps/api/src/features/reorder/reorderService.ts` -> `reorder({orderId, userId, cartId, context})`
- flow: `orders.getOwned(orderId, userId)` -> not found -> `ORDER_NOT_FOUND` -> map lines -> `carts.addMany` -> assemble outcomes -> counts
- proposed `apps/api/src/features/reorder/reorderErrors.ts` -> `ReorderErrorCode = 'ORDER_NOT_FOUND' | 'CART_NOT_FOUND' | 'CART_RESERVED'` as a typed union, matching cart-feature style

### API route

- proposed `apps/api/src/routes/reorder.ts` -> `POST /api/orders/:orderId/reorder`
- `preHandler: [requireCustomer(services.sessions)]`; params `OrderIdParam` from `@shop/contracts/orders`; body `ReorderRequestBody`
- responses -> 200 `ReorderResponse`, 404 `ErrorResponse` (`ORDER_NOT_FOUND`, `CART_NOT_FOUND`), 409 `ErrorResponse` (`CART_RESERVED`), 400 `ErrorResponse` (validation)
- registration in `apps/api/src/app.ts`: `AppServices.reorder` field, construction in `createAppServices`, one `await app.register(reorderRoutes, context)` line
- transport mapping lives in the route file; domain types never leak to the wire

### Web

- proposed `apps/web/src/api/reorder.ts` -> `reorderFromOrder(cartId, orderId)` -> `apiFetch(ReorderResponse, ...)` through `apps/web/src/api/client.ts`
- extend `apps/web/src/hooks/useCart.ts` -> `CartAction` gains `'reorder'`; `reorder(orderId)` uses `runCartAction` with `retryAfterRecovery: true`, pending key `reorder:${orderId}`, applies returned cart through `applyMutationCart`, returns outcomes to caller
- proposed `apps/web/src/features/reorder/BuyAgainButton.tsx` -> pending state, disabled while pending, `aria-live` status
- proposed `apps/web/src/features/reorder/ReorderOutcomeList.tsx` -> grouped added/skipped rendering, one plain sentence per skip reason, price-drift line for changed prices, link to `/cart`
- proposed `apps/web/src/features/reorder/reorderPresentation.ts` -> reason -> copy, drift -> formatted money via `apps/web/src/lib/formatMoney.ts`
- placement: order history row action and order detail header action; outcome list renders in place beneath the triggering surface
- copy must be self-explanatory with no B2B jargon and no reference to internal codes

### Seed

- extend `apps/api/src/db/orderSeedScenarios.ts` -> append one key to `DEMO_ORDER_SCENARIO_KEYS` plus its `Scenario` literal
- scenario lines cover: lot with an active clearance window (price drift), zero-stock non-backorderable lot (`INSUFFICIENT_STOCK`), ordinary lot (`added`)
- timestamps use existing frozen seed clock constants; no `Date.now()`
- retired-variant coverage stays in route integration tests, which retire a variant in-test rather than depending on seed shape

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> {P3 -> R3 -> GR3 || P5 -> R5 -> GR5} -> G2 -> {P4 -> R4 -> GR4 || P6 -> R6 -> GR6} -> G3 -> S1 -> R7 -> GR7 -> G4`

- `G0`: worktree recorded and created; three assumptions in `Decisions and Invariants` confirmed or corrected; `npm ci` and post-install health pass
- `GR1`: contract producer review gate; blocks every consumer of `@shop/contracts/reorder`
- `GR2`: cart-domain producer review gate; blocks `P3`
- `G1`: both producer gates passed AND `npm run build -w @shop/contracts` succeeded, so `P3`/`P5` typecheck against the new module
- `GR3`, `GR5`: reorder-domain and web-client review gates
- `G2`: `GR3` + `GR5` closed
- `GR4`, `GR6`: route/composition-root and UI review gates
- `G3`: `GR4` + `GR6` closed; API and web lanes ready for convergence
- `GR7`: convergence review gate over seed, cross-lane test, and plan status update
- `G4`: completion gate; broad suite green once after all fixes settle

## Work Packets

### P1: Reorder transport contracts

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/reorder.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/reorder-contracts.test.ts`
- reads: `packages/contracts/src/cart.ts` -> `Cart`, `CartLineConfigPair`, `BelowMoqError` -> schema style, custom-format pairing technique, `additionalProperties: false` convention
- reads: `packages/contracts/src/orders.ts` -> `OrderIdParam`, `OrderLineItem` -> field naming and id-as-string conventions
- reads: `packages/contracts/src/customBlends.ts` -> `CustomBlendSnapshot` -> configKey shape
- reads: `packages/contracts/package.json` -> `exports` map -> kebab-case subpath convention
- reads: `packages/contracts/test/custom-blend-contracts.test.ts` -> node:test assertion style for schema validation
- acceptance: `@shop/contracts/reorder` resolves from a consumer import; `Value.Check` accepts a valid added outcome and a valid skipped outcome, and rejects `status='added'` with non-null `reason`, `status='skipped'` with null `reason`, unknown `reason` values, and unknown properties
- non-goals: no domain logic, no API or web code, no changes to existing contract modules beyond the `index.ts` re-export line
- upstream inputs: none
- changes:
  - add `packages/contracts/src/reorder.ts` with `ReorderRequestBody`, `ReorderSkipReason`, `ReorderLineOutcome`, `ReorderResponse`
  - encode the status/reason pairing constraint using the existing custom-format approach from `cart.ts`
  - re-export from `packages/contracts/src/index.ts`; add `"./reorder"` to `packages/contracts/package.json` `exports`
  - add `packages/contracts/test/reorder-contracts.test.ts` covering accept and reject cases above
- invariants: money stays integer minor units; ids follow the existing string-id convention used by `OrderLineItem`; contracts never import from `apps/**` or `@shop/catalog`
- relevant evidence: none
- test duty: run `E1` at packet completion
- verification: `E1` passes; `npm run build -w @shop/contracts` succeeds so the gate can publish `dist`
- handoff: `ReorderResponse` / `ReorderLineOutcome` / `ReorderRequestBody` shapes plus `@shop/contracts/reorder` subpath to `P3`, `P4`, `P5`, `P6`
- review: `R1` -> `GR1` blocks `G1`

### P2: Cart domain multi-line add with per-line outcomes

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `apps/api/src/features/cart/cartBulkAddRules.ts`, `apps/api/src/features/cart/cartBulkAddRules.test.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/test/cart/cartBulkAdd.integration.test.ts`, `apps/api/package.json`
- reads: `apps/api/src/features/cart/cartService.ts` -> `addItem` L445, `addConfiguredItem` L477, `runCartMutation` L243, `requireAuditContext` L247, `minimumMoqQuantity` L515, `supportsCartLineArithmetic` L532, `hydrateCustomBlend` L381, `getCart` L292 -> invariants and guards `addMany` must preserve
- reads: `apps/api/src/features/cart/cartRepository.ts` -> `addLineQuantity` L166, `addConfiguredLineQuantity` L175, `lineQuantity`, `variantExists` L140, `getVariant` L300, `listEligibleCustomBlendFacts` L118 -> available write and read primitives
- reads: `apps/api/src/features/bundles/bundleService.ts` -> `addToCart` L205, `collectUnavailableComponentVariantIds` L125 -> existing stock pre-flight shape and why its all-or-nothing semantics do not fit
- reads: `apps/api/src/features/inventory/inventoryService.ts` -> `availableToSell` L128; `apps/api/src/features/inventory/inventoryTypes.ts` -> `InventoryProduct` -> availability row fields
- reads: `apps/api/src/features/pricing/pricingRules.ts` -> `validateMoq` L142, `resolveUnitPriceCents` L117; `apps/api/src/features/pricing/clearanceRules.ts` -> `resolveClearance` L32 -> resolution order to reuse
- reads: `apps/api/src/features/customBlend/customBlendRules.ts` -> `normalizeCustomBlendSpec` L105, `canonicalCustomBlendJson` L92, `hashCustomBlendCanonicalJson` L100 -> blend re-validation and configKey re-derivation
- reads: `apps/api/test/cart/cart.integration.test.ts` -> temp-dir SQLite + `buildApp` fixture pattern; `apps/api/package.json` -> `test:unit` explicit list format
- acceptance: `CartService.addMany` adds every eligible group and skips ineligible ones in one committed transaction; outcomes echo caller keys; duplicate `(variantId, configKey)` requests aggregate before evaluation; reason precedence is deterministic; `addItem` and `addConfiguredItem` behavior unchanged
- non-goals: no order concept, no reorder naming, no HTTP route, no contract import, no change to `bundleService`, no repository schema change
- upstream inputs: none
- changes:
  - add `cartBulkAddRules.ts` with `aggregateBulkAddDemand` and `classifyBulkAddGroup`, pure and clock-free
  - add `addMany` to the `CartService` interface and factory, wrapped by `runCartMutation`, requiring audit and availability dependencies
  - batch availability with a single `inventory.availableToSell(variantIds, now)` call; resolve blend specs through `customBlendRules` and compare the recomputed hash to the supplied `configKey`
  - write added groups through `addLineQuantity` / `addConfiguredLineQuantity`, then `touch`, then one audit append
  - add unit tests for aggregation, reason precedence, and MOQ/stock boundary cases at exactly minimum and one below
  - add `apps/api/test/cart/cartBulkAdd.integration.test.ts` covering mixed outcomes, retired-variant skip, reserved-cart rejection, and rollback when the audit append throws
  - register the new unit test path in `apps/api/package.json` `test:unit`
- invariants: MOQ evaluated on post-add cumulative quantity per `(variantId, configKey)`; retired variants never added; skips never roll back committed adds; unexpected throw rolls back everything including `touch` and audit; no `Date.now()` — clock injected
- relevant evidence: none
- test duty: run `E2` and `E3` at packet completion
- verification: `E2` and `E3` pass; existing cart integration suite unaffected
- handoff: `addMany` signature, `BulkAddRequest` / `BulkAddOutcome` domain types, reason precedence order to `P3`
- review: `R2` -> `GR2` blocks `G1`

### P3: Reorder domain service

- mode: parallel with `P5` after `G1`
- depends on: `P2`, `G1`
- owns: `apps/api/src/features/reorder/reorderRules.ts`, `apps/api/src/features/reorder/reorderRules.test.ts`, `apps/api/src/features/reorder/reorderService.ts`, `apps/api/src/features/reorder/reorderErrors.ts`, `apps/api/package.json`
- reads: `apps/api/src/features/cart/cartBulkAddRules.ts` and `cartService.ts` -> `addMany` -> accepted upstream interface
- reads: `apps/api/src/features/orders/orderService.ts` -> `getOwned` L108; `apps/api/src/features/orders/orderRepository.ts` -> `mapOrder` L205, `hydrateOrderCustomBlend` L150 -> owned-order read shape and blend snapshot hydration
- reads: `packages/contracts/src/orders.ts` -> `OrderLineItem`, `OrderLineVariantSnapshot`; `packages/contracts/src/customBlends.ts` -> `CustomBlendSnapshot` -> order-line fields available for mapping
- reads: `apps/api/src/features/pricing/pricingRules.ts` -> `resolveUnitPriceCents`; `apps/api/src/features/pricing/clearanceRules.ts` -> `resolveClearance`; `apps/api/src/features/cart/cartService.ts` -> `getCart` L320-359 -> canonical clearance-then-tier composition to reuse for drift
- reads: `apps/api/src/features/tradeAccount/tradeAccountErrors.ts` -> typed-union error-code style
- acceptance: `reorderService.reorder` returns per-order-line outcomes for every line of an owned order, including lines pre-skipped as `VARIANT_UNRESOLVED`; group outcomes fan back to all member lines; `priceChanged` reflects server-resolved price at the resulting cart quantity; unowned or missing order yields `ORDER_NOT_FOUND`
- non-goals: no HTTP route, no `app.ts` edit, no contract schema construction, no cart-domain edit, no order-domain edit
- upstream inputs: `P2` -> accepted `addMany` interface and reason precedence
- changes:
  - add `reorderErrors.ts` with the typed error-code union
  - add `reorderRules.ts` with `toBulkAddRequests` and `assembleReorderOutcomes`, pure
  - add `reorderService.ts` composing owned-order read -> `carts.addMany` -> outcome assembly -> counts
  - compute `currentUnitPriceCents` through `resolveClearance` then `resolveUnitPriceCents` at the resulting quantity; null when the variant could not be resolved
  - add unit tests for null-variant pre-skip, duplicate-line fan-out, drift true/false at exact equality, and all-skipped counting
  - register the new unit test path in `apps/api/package.json` `test:unit`
- invariants: never trust order-line price or sku snapshots for eligibility; never fall back to a default variant; ownership failure and missing order are indistinguishable to the caller
- relevant evidence: `E2`, `E3` -> `P2` cart-domain coverage; do not rerun
- test duty: run `E4` at packet completion
- verification: `E4` passes
- handoff: `reorderService` interface, `ReorderErrorCode`, domain outcome shape to `P4`
- review: `R3` -> `GR3` blocks `G2`

### P4: Reorder route and composition root

- mode: parallel with `P6` after `G2`
- depends on: `P1`, `P3`, `G2`
- owns: `apps/api/src/routes/reorder.ts`, `apps/api/src/app.ts`, `apps/api/test/reorder/reorderRoutes.integration.test.ts`, `apps/api/package.json`
- reads: `apps/api/src/routes/cart.ts` -> error-to-status mapping L132-150, TypeBox route declaration style; `apps/api/src/routes/orders.ts` -> `requireCustomer` usage L43, `ORDER_FORBIDDEN -> sendNotFound` L18
- reads: `apps/api/src/app.ts` -> `AppServices`, `createAppServices`, `app.register` block -> the three edits a new route needs
- reads: `apps/api/src/plugins/auth.ts` -> `requireCustomer` L79; `apps/api/src/utils/errors.ts` -> `sendNotFound`, `sendConflict`
- reads: `packages/contracts/src/reorder.ts` -> `ReorderRequestBody`, `ReorderResponse` -> wire shapes to map onto
- reads: `apps/api/test/http/app.integration.test.ts` and `apps/api/test/cart/cart.integration.test.ts` -> `buildApp` + `app.inject` + cookie-auth fixture pattern; `apps/api/package.json` -> `test:integration` glob list format
- acceptance: `POST /api/orders/:orderId/reorder` returns 200 with cart and outcomes for an owned order; 404 for unowned, missing, or unknown cart; 409 for a reserved cart; 403 for a non-customer session; 401 unauthenticated; response validates against `ReorderResponse`
- non-goals: no domain rule changes, no contract changes, no web code, no seed change
- upstream inputs: `P1` -> accepted contract module and subpath; `P3` -> accepted `reorderService` interface
- changes:
  - add `apps/api/src/routes/reorder.ts` following the existing plugin signature and TypeBox schema block
  - map domain outcomes to `ReorderLineOutcome`; map `ORDER_NOT_FOUND`/`CART_NOT_FOUND` -> 404, `CART_RESERVED` -> 409
  - wire `reorder` into `AppServices`, `createAppServices`, and the register block in `app.ts`
  - add `apps/api/test/reorder/reorderRoutes.integration.test.ts` covering: mixed added/skipped payload, retired-variant skip after retiring a variant in-test, blend line re-added with matching `configKey`, all-skipped 200 with unchanged cart, reserved-cart 409, unowned-order 404, repeat POST incrementing quantities, and price drift surfaced after a clearance window activates
  - add `test/reorder/*.integration.test.ts` to `apps/api/package.json` `test:integration`
- invariants: routes stay thin; no business rule introduced in the route; response bodies validate against contracts; no guest-cookie access path
- relevant evidence: `E4` -> `P3` domain coverage; do not rerun
- test duty: run `E5` at packet completion
- verification: `E5` passes
- handoff: live endpoint and response payload to `S1`
- review: `R4` -> `GR4` blocks `G3`

### P5: Web reorder client and cart hook action

- mode: parallel with `P3` after `G1`
- depends on: `P1`, `G1`
- owns: `apps/web/src/api/reorder.ts`, `apps/web/src/api/reorder.test.ts`, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`
- reads: `apps/web/src/api/cart.ts` -> `addToCart` L17; `apps/web/src/api/bundles.ts` -> `addBundleToCart` L14; `apps/web/src/api/client.ts` -> `apiFetch`, `ApiError`, `ApiContractError` -> client module conventions and response validation
- reads: `apps/web/src/hooks/useCart.ts` -> `CartAction` L11, `runCartAction` L166, `applyMutationCart` L124, `mutationSequenceRef` L94, `addBundle` L241, pending-key helpers L72-78 -> extension points
- reads: `packages/contracts/src/reorder.ts` -> `ReorderResponse` -> response schema for `apiFetch`
- acceptance: `reorderFromOrder` posts `{cartId}` and validates the response; `useCart().reorder(orderId)` applies the returned cart through the mutation-sequence guard, exposes pending state under `reorder:${orderId}`, returns outcomes to the caller, recovers a missing cart and replays once, and surfaces 409 reserved-cart and 404 order-missing as distinct messages
- non-goals: no UI components, no page edits, no presentation copy, no changes to existing cart actions
- upstream inputs: `P1` -> accepted contract module and subpath
- changes:
  - add `apps/web/src/api/reorder.ts` with `reorderFromOrder(cartId, orderId)`
  - extend `CartAction` with `'reorder'`; add `reorder` to the hook using `runCartAction` with `retryAfterRecovery: true`
  - map error responses to buyer-readable messages alongside the existing `BELOW_MOQ` mapping
  - extend `useCart.test.tsx` with reorder cases: success applies cart, stale response dropped, reserved-cart error, missing-cart recovery replay
  - add `apps/web/src/api/reorder.test.ts` for request shape and contract-validation failure
- invariants: stale responses never overwrite newer cart state; no cart mutation performed client-side; outcomes are returned, not stored in cart state
- relevant evidence: `E1` -> `P1` contract coverage; do not rerun
- test duty: run `E6` at packet completion
- verification: `E6` passes
- handoff: `reorder(orderId)` hook signature and outcome return type to `P6`
- review: `R5` -> `GR5` blocks `G2`

### P6: Buy Again UI on order history and detail

- mode: parallel with `P4` after `G2`
- depends on: `P5`, `G2`
- owns: `apps/web/src/features/reorder/BuyAgainButton.tsx`, `apps/web/src/features/reorder/ReorderOutcomeList.tsx`, `apps/web/src/features/reorder/reorderPresentation.ts`, `apps/web/src/features/reorder/*.test.tsx`, `apps/web/src/features/reorder/BuyAgainJourney.integration.test.tsx`, `apps/web/src/features/orders/OrderHistoryPage.tsx`, `apps/web/src/features/orders/OrderDetailPage.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/features/orders/OrderPages.test.tsx`
- reads: `apps/web/src/features/orders/OrderHistoryPage.tsx` -> row rendering L88-93, request-sequence guard L28-45; `apps/web/src/features/orders/OrderDetailPage.tsx` -> cancel wiring L140-146, aria-live announcement pattern; `apps/web/src/features/orders/OrderDetailView.tsx` -> cancel button placement L327
- reads: `apps/web/src/hooks/useCart.ts` -> `reorder`, `isActionPending` -> accepted upstream interface
- reads: `apps/web/src/components/ui/button.tsx`, `apps/web/src/lib/formatMoney.ts`, `apps/web/src/index.css` -> primitives, money formatting, token usage
- reads: `apps/web/src/features/bundles/BundlesPage.test.tsx` and `apps/web/src/features/catalog/CatalogProductJourney.integration.test.tsx` -> role/name accessibility assertion style and `vi.mock` integration-test pattern
- acceptance: `Buy again` renders on every order-history row and on order detail; activating it disables the control while pending; the outcome list names every skipped line with plain-language cause and shows old-to-new price for changed lines; all-skipped renders an explanatory state rather than an error; every control and status region is reachable by accessible role and name
- non-goals: no new route, no nav entry, no changes to cancel or return surfaces, no `index.css` token additions unless an existing token cannot express the state
- upstream inputs: `P5` -> accepted `reorder(orderId)` hook interface and outcome type
- changes:
  - add `reorderPresentation.ts` mapping each `ReorderSkipReason` to buyer-facing copy with no internal codes and no trade jargon
  - add `BuyAgainButton.tsx` and `ReorderOutcomeList.tsx` with loading, empty, partial, and error states plus an `aria-live` status region
  - render both on order history rows and order detail; keep outcome display local to the triggering surface
  - extend `OrderPages.test.tsx` and add component tests for each state
  - add `BuyAgainJourney.integration.test.tsx` driving history -> `Buy again` -> mixed outcomes -> cart link, with api and hook modules mocked
- invariants: server outcomes rendered verbatim in meaning, never recomputed client-side; no price or eligibility logic in the UI; page must read without documentation
- relevant evidence: `E6` -> `P5` client and hook coverage; do not rerun
- test duty: run `E7` at packet completion
- verification: `E7` passes; UI behavior proven through React integration and component tests only
- handoff: rendered surfaces and their accessible names to `S1`
- review: `R6` -> `GR6` blocks `G3`

### S1: Convergence, seed scenario, and final verification

- mode: sequential after `G3`
- depends on: `P4`, `P6`, `G3`
- owns: `apps/api/src/db/orderSeedScenarios.ts`, `apps/api/test/reorder/reorderSeedScenario.integration.test.ts`, `plans/demo_project_high_level_plan.md`
- reads: `apps/api/src/db/orderSeedScenarios.ts` -> `DEMO_ORDER_SCENARIO_KEYS`, `Scenario` -> append-only fixture shape and frozen timestamps
- reads: `apps/api/src/db/seed.ts` -> `CLEARANCE_BY_SKU`, `PRICING_PROMOTIONS_SEED_CLOCK`, `atPricingPromotionsSeedOffset` -> deterministic clock anchors and clearance fixtures to target
- reads: `apps/api/test/db/*.integration.test.ts` -> seed count assertions that a new scenario may invalidate
- reads: `plans/demo_project_high_level_plan.md` -> item 12 block and `Sequencing Guidelines` -> status text to update
- acceptance: `npm run reset` seeds the new scenario deterministically; the seeded order reorders into a mixed added/skipped result; every existing seed-count assertion still passes; high-level plan item 12 records completion with schema note `no migration; head stays 028` and the constraints items 13 and 14 inherit from the landed `addMany` path
- non-goals: no new product or variant fixtures, no behavior change to any packet output, no README rewrite beyond a demo-fixture note if the seeded credentials or triggers changed
- upstream inputs: `P4` -> accepted endpoint and payload; `P6` -> accepted UI surfaces
- changes:
  - append one demo order scenario key and literal covering clearance-priced, zero-stock non-backorderable, and ordinary lots
  - add the seed-scenario integration test asserting the mixed outcome set against the seeded order
  - update `plans/demo_project_high_level_plan.md` item 12 to completed, note the reusable multi-line add path for 13 and 14, and correct the stale `plans/old/` references in `Current Baseline`
  - resolve any cross-lane conflict surfaced by the fan-in run
- relevant evidence: `E1`-`E7` -> packet-level coverage; rerun only entries invalidated by the seed change
- test duty: run `E8` after seed changes settle, then `E9` once at `G4` after every fix closes
- verification: `E8` and `E9` pass; no browser, screenshot, or manual UI step at this gate
- handoff: final evidence set, worktree path, implementation branch, source branch, base revision
- review: `R7` -> `GR7` blocks `G4`

## Review Assignments

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its severity gate (critical + high only) and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set on `packages/contracts/**`
- timing: immediately after `P1` reports; before `G1` and before any consumer imports the module
- blocks: `G1`, therefore `P3`, `P4`, `P5`, `P6`
- consolidation reason: none
- reads: `packages/contracts/src/reorder.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/reorder-contracts.test.ts` -> new schemas, exports, subpath, coverage; `packages/contracts/src/cart.ts` -> `CartLineConfigPair` -> pairing-constraint precedent
- acceptance: status/reason pairing is enforced by the schema, not by convention; subpath export and index re-export both present; money and id conventions match neighbouring modules; `additionalProperties: false` everywhere
- invariants: contracts import nothing from `apps/**` or `@shop/catalog`; transport-only, no domain logic; no breaking change to existing exported schemas
- risk focus: public contract surface consumed by four downstream packets; a wrong shape propagates into API, hook, and UI before detection
- non-goals: no assessment of domain rules, routes, or UI
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E1`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P2` -> settled change set on `apps/api/src/features/cart/**`, `apps/api/test/cart/cartBulkAdd.integration.test.ts`, `apps/api/package.json`
- timing: immediately after `P2` reports; before `G1` and before `P3` consumes `addMany`
- blocks: `G1`, therefore `P3`
- consolidation reason: none
- reads: `apps/api/src/features/cart/cartBulkAddRules.ts`, `cartService.ts`, `cartBulkAddRules.test.ts`, `apps/api/test/cart/cartBulkAdd.integration.test.ts` -> new rules, command, coverage; `apps/api/src/features/cart/cartRepository.ts` -> write primitives and the `(cart_id, variant_id, config_key)` UPSERT; `apps/api/src/features/pricing/pricingRules.ts` -> `validateMoq`; `apps/api/src/features/customBlend/customBlendRules.ts` -> hash derivation
- acceptance: `addMany` preserves every `addItem` invariant; aggregation happens before stock and MOQ evaluation; reason precedence is deterministic and tested at boundaries; skips commit while unexpected throws roll back; audit and availability dependencies are required, not optional
- invariants: transaction owner covers the full business invariant; retired variants never added; no `Date.now()`; no mutable module-global state; integer minor units preserved; `addItem`, `addConfiguredItem`, and `bundleService` behavior unchanged
- risk focus: transaction boundary and partial-commit semantics; MOQ cumulative arithmetic and safe-integer overflow; duplicate-key aggregation; blend hash re-derivation; single batched availability read versus per-line reads
- non-goals: no assessment of reorder mapping, route wiring, or UI
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E2`, `E3`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R3: Review `P3`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P3` -> settled change set on `apps/api/src/features/reorder/**`, `apps/api/package.json`
- timing: immediately after `P3` reports; before `G2` and before `P4` wires the service
- blocks: `G2`, therefore `P4`
- consolidation reason: none
- reads: `apps/api/src/features/reorder/reorderRules.ts`, `reorderService.ts`, `reorderErrors.ts`, `reorderRules.test.ts` -> mapping, composition, error codes, coverage; `apps/api/src/features/cart/cartService.ts` -> `addMany`, `getCart` L320-359 -> accepted interface and canonical price composition; `apps/api/src/features/orders/orderRepository.ts` -> `mapOrder`, `hydrateOrderCustomBlend` -> order-line read shape
- acceptance: price drift derives from server-resolved clearance-then-tier price at the resulting quantity; null-variant lines pre-skip without reaching cart; group outcomes fan back to every member line; ownership failure is indistinguishable from a missing order
- invariants: order-line price and sku snapshots never drive eligibility; no default-variant fallback; blending fee uses the current constant; domain types do not import transport schemas
- risk focus: price-drift correctness against the landed pricing rules; fan-out mapping when one variant appears on several order lines; ownership check placement
- non-goals: no assessment of cart-domain internals already covered by `R2`, no route or UI assessment
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E4`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R4: Review `P4`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P4` -> settled change set on `apps/api/src/routes/reorder.ts`, `apps/api/src/app.ts`, `apps/api/test/reorder/**`, `apps/api/package.json`
- timing: immediately after `P4` reports; before `G3` and before convergence
- blocks: `G3`, therefore `S1`
- consolidation reason: none
- reads: `apps/api/src/routes/reorder.ts`, `apps/api/src/app.ts`, `apps/api/test/reorder/reorderRoutes.integration.test.ts` -> route, wiring, coverage; `apps/api/src/routes/cart.ts` -> status mapping precedent; `apps/api/src/plugins/auth.ts` -> `requireCustomer`; `packages/contracts/src/reorder.ts` -> wire shapes
- acceptance: auth gate and ownership enforced; status mapping matches the plan; responses validate against `ReorderResponse`; the new integration glob is registered so the suite actually runs; composition-root edit follows the existing three-edit pattern
- invariants: routes stay thin with no business rules; no guest-cookie write path; unowned order yields 404 not 403; `additionalProperties: false` respected on the wire; no unrelated `app.ts` changes
- risk focus: authorization on a write that reads another aggregate; error-code to status fidelity; test registration in `apps/api/package.json`; response-schema drift against contracts
- non-goals: no re-assessment of cart or reorder domain rules covered by `R2` and `R3`
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E5`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R5: Review `P5`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P5` -> settled change set on `apps/web/src/api/reorder.ts`, `apps/web/src/api/reorder.test.ts`, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`
- timing: immediately after `P5` reports; before `G2` and before `P6` consumes the hook
- blocks: `G2`, therefore `P6`
- consolidation reason: none
- reads: `apps/web/src/api/reorder.ts`, `apps/web/src/hooks/useCart.ts`, and their tests -> client, hook action, coverage; `apps/web/src/api/client.ts` -> `apiFetch` validation behavior
- acceptance: stale reorder responses cannot overwrite newer cart state; pending key is unique per order; missing-cart recovery replays exactly once; error mapping distinguishes reserved cart from missing order
- invariants: web never imports API source; no client-side cart mutation; response validated against the shared schema; existing cart actions unchanged
- risk focus: mutation-sequence guard correctness under concurrent actions; recovery replay causing a duplicate add; unhandled contract-validation failure
- non-goals: no UI component or page assessment
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E6`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R6: Review `P6`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P6` -> settled change set on `apps/web/src/features/reorder/**` and `apps/web/src/features/orders/**`
- timing: immediately after `P6` reports; before `G3` and before convergence
- blocks: `G3`, therefore `S1`
- consolidation reason: none
- reads: `apps/web/src/features/reorder/*` and `apps/web/src/features/orders/OrderHistoryPage.tsx`, `OrderDetailPage.tsx`, `OrderDetailView.tsx`, `OrderPages.test.tsx` -> components, wiring, coverage
- acceptance: loading, partial, all-skipped, and error states all render; skip copy is plain language carrying no internal codes; controls and status regions expose accessible roles and names; existing cancel and return surfaces are untouched
- invariants: no eligibility or price logic client-side; server outcome meaning preserved; page comprehensible without documentation; no new nav entry
- risk focus: silent loss of skipped-line information; pending state leaking across orders; accessibility of the dynamic outcome region; regressions in order pages
- non-goals: no visual or aesthetic judgement, no re-assessment of the hook covered by `R5`
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E7`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R7: Review `S1`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `S1` -> settled change set on `apps/api/src/db/orderSeedScenarios.ts`, `apps/api/test/reorder/reorderSeedScenario.integration.test.ts`, `plans/demo_project_high_level_plan.md`
- timing: after convergence settles; before `G4`
- blocks: `G4`
- consolidation reason: none
- reads: `apps/api/src/db/orderSeedScenarios.ts` and the new seed-scenario test -> fixture and assertions; `apps/api/src/db/seed.ts` -> clock anchors and idempotency; `plans/demo_project_high_level_plan.md` -> item 12 status text
- acceptance: seed stays deterministic and idempotent across repeat `npm run seed`; existing seed-count assertions unaffected or correctly updated; plan status reflects what actually landed, including the no-migration fact
- invariants: no `Date.now()` in seed; append-only scenario keys; reset order stays FK-safe; no course-spoiler content added to seeded or UI-visible copy
- risk focus: seed determinism and idempotency; cross-lane integration behavior not covered by earlier packet reviews; plan claims not backed by code
- non-goals: no re-assessment of packet-level changes already gated
- write policy: inspect-only
- test policy: assess supplied evidence; run only assigned commands or when stale evidence blocks the verdict
- relevant evidence: `E8`, `E9`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `packages/contracts/**`: owned only by `P1`; every other packet reads
- `apps/api/src/features/cart/**`: owned only by `P2`
- `apps/api/src/features/reorder/**`: owned only by `P3`
- `apps/api/src/app.ts`: owned only by `P4`; single composition-root editor for the whole run
- `apps/api/package.json`: edited by `P2` -> `P3` -> `P4` in that order only; these packets are never concurrent, so no lock is needed. No web or contracts packet touches it
- `apps/web/src/hooks/useCart.ts`: owned only by `P5`; `P6` consumes the hook and must not edit it
- `apps/web/src/features/orders/**`: owned only by `P6`
- `apps/api/src/db/**` and `plans/demo_project_high_level_plan.md`: owned only by `S1`
- migration versions: none reserved; this plan adds no migration. Any packet that concludes a schema change is required must stop and raise a blocker rather than author `029`
- contract changes: producer `P1` -> consumers `P3`, `P4`, `P5`, `P6` only after `GR1`
- composition: `S1` is the sole integration owner and the only packet permitted to resolve cross-lane conflicts

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings; never name or override them here
- non-Codex harnesses: ignore the Codex binding; use harness-native roles while preserving worker and reviewer responsibilities and communication contracts
- all harnesses: reviewer agents run the `code-reviewer` skill as their review method; assignments set `review_skill=code-reviewer` and the reviewer invokes it explicitly by name

## Test Execution Schedule

- shell prerequisite for every entry: PowerShell must prepend Node 22 to `PATH` before any npm command -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`; never select `v24.18.0`
- `T1` / evidence `E1`: focused, after `P1` changes settle -> owner `P1` -> `npm exec -w @shop/contracts -- tsx --test test/reorder-contracts.test.ts`
- `T2` / evidence `E1b`: gate build, at `G1` -> owner `G1` -> `npm run build -w @shop/contracts` -> required before any consumer typecheck
- `T3` / evidence `E2`: focused, after `P2` -> owner `P2` -> `npm exec -w @shop/api -- tsx --test src/features/cart/cartBulkAddRules.test.ts`
- `T4` / evidence `E3`: focused regression, after `P2` -> owner `P2` -> `npm exec -w @shop/api -- tsx --test test/cart/cartBulkAdd.integration.test.ts test/cart/cart.integration.test.ts test/cart/bundles.integration.test.ts`
- `T5` / evidence `E4`: focused, after `P3` -> owner `P3` -> `npm exec -w @shop/api -- tsx --test src/features/reorder/reorderRules.test.ts`
- `T6` / evidence `E5`: focused, after `P4` -> owner `P4` -> `npm exec -w @shop/api -- tsx --test test/reorder/reorderRoutes.integration.test.ts`
- `T7` / evidence `E6`: focused, after `P5` -> owner `P5` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/hooks/useCart.test.tsx src/api/reorder.test.ts`
- `T8` / evidence `E7`: focused, after `P6` -> owner `P6` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/reorder src/features/orders` plus `npm run test:integration -w @shop/web`
- `T9` / evidence `E8`: fan-in, once after both lanes converge and `S1` seed changes settle -> owner `S1` -> `npm run reset -w @shop/api` then `npm exec -w @shop/api -- tsx --test test/reorder/reorderSeedScenario.integration.test.ts test/db/*.integration.test.ts`
- `T10` / evidence `E9`: final broad gate, at `G4` after all review fixes settle -> owner `S1` -> `npm run verify`, run once
- policy: automated repository commands only; no browser session, screenshot, dev-server click-through, or `browser-qa` invocation in any test duty, verification, gate, or review policy
- reuse: an evidence entry stays valid across sessions while its covered code is unchanged; a new session alone never invalidates it. Give each agent only the ledger entries covering its own scope and instruct it not to rerun valid commands
- invalidation: `packages/contracts/**` -> rerun `E1`, `E1b`, then `E5`, `E6`, `E7`; `apps/api/src/features/cart/**` -> rerun `E2`, `E3`, `E5`; `apps/api/src/features/reorder/**` -> rerun `E4`, `E5`; `apps/api/src/routes/**` or `apps/api/src/app.ts` -> rerun `E5`; `apps/web/src/hooks/useCart.ts` -> rerun `E6`, `E7`; `apps/web/src/features/**` -> rerun `E7`; `apps/api/src/db/**` -> rerun `E8`; any change after `E9` -> rerun the smallest affected entries, then `E9` once more

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every message and every JSON string value
- transport: inline canonical JSON; run-scoped temp artifacts only under protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1`
- worktree context: every assignment carries absolute path, implementation branch, and base revision; every repository-relative path resolves under the worktree root
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load `AGENTS.md`, this plan, canonical contracts, and the current checkpoint only.
3. Record the source branch and `HEAD`; handle detached `HEAD` or relevant uncommitted input under the worktree contract before any write.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity in the checkpoint.
5. Switch the execution root to the worktree; load repository instructions from there.
6. Validate `G0`: confirm or correct the three stated assumptions, run `npm ci`, and confirm post-install health.
7. Launch `P1 || P2` with role-minimum context plus worktree context.
8. Accept each report, update the checkpoint and ledger, then launch `R1` and `R2` against the exact settled change sets before any consumer starts.
9. Route stable findings to fresh workers with `action=fix` directives; close after targeted verification; never re-review a fix.
10. Validate `G1`, including `E1b`; then launch `P3 || P5`, review each, and validate `G2`.
11. Launch `P4 || P6`, review each, and validate `G3`.
12. Launch `S1`; run `E8`; review `S1` as a separate integration target; close findings through fresh-worker fixes.
13. Validate `GR7` and `G4`; run `E9` once after every fix settles.
14. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision, and state that the user owns the merge.

## Risks and Open Questions

- risk: `addMany` drifts from `addItem` invariants and creates a second, weaker add path — exactly the defect already present in `bundleService.addToCart`, which skips MOQ and overflow guards -> mitigation: `addMany` reuses the same guard helpers, `R2` targets parity explicitly, and `E3` reruns the existing cart and bundle suites
- risk: partial-commit semantics obscure a genuine failure, so a real error is reported as a routine skip -> mitigation: only classified reasons produce skips; any unexpected throw propagates and rolls back the transaction; covered by the audit-failure rollback case in `E3`
- risk: price drift computed at the wrong quantity misreports what the buyer will pay when the resulting line crosses a tier boundary -> mitigation: drift resolves at the resulting cart quantity, and `E4` covers a boundary-crossing case
- risk: duplicate order lines sharing a variant each pass stock individually but exceed it together -> mitigation: aggregation before evaluation, unit-tested in `E2` and asserted end-to-end in `E5`
- risk: stock passes at reorder and fails at checkout -> accepted product behavior and a named QA surface, not a defect; `E5` asserts the reorder side only
- risk: repeat POST silently doubles quantities -> accepted, matching existing add and bundle behavior; web guards with a pending key; `E5` asserts the increment explicitly
- risk: a blend line's ingredient lot was retired since the order, so the spec no longer normalises -> mitigation: `BLEND_UNAVAILABLE` skip with no substitution; asserted in `E5`
- risk: new contract subpath missing from `packages/contracts/package.json` breaks consumer typecheck late -> mitigation: `G1` gates on `E1b`, and `R1` treats the subpath as acceptance
- risk: a new seed scenario invalidates existing seed-count assertions -> mitigation: `E8` runs the db integration suite before `G4`
- question: should retired-line detection be added to `cartRepository.listLines`, which today keeps a retired line fully priced in the cart? -> owner: user, outside this plan; reorder must not add retired lines regardless
- question: human smoke check of the `Buy again` journey at `1920x1080` -> owner: user, after merge; not a packet duty, gate condition, or acceptance criterion

## Done Criteria

- `Buy again` on any owned past order re-adds every eligible line to the active cart in one action from both order history and order detail
- every ineligible line returns a distinct, buyer-readable reason: retired variant, unresolvable variant, insufficient stock, below MOQ, arithmetic limit, blend unavailable
- every added line discloses server-resolved current price and whether it moved since the order
- custom blend lines re-add through the configured-line path with a `configKey` recomputed and matched, or skip as `BLEND_UNAVAILABLE`
- `CartService.addMany` exists as a domain-generic multi-line add carrying blend identity, ready for Saved Lists (13) and Quick Order (14) without a second implementation
- no migration added; migration head stays `028`; no existing contract, route, or persisted shape breaks
- `E1`-`E9` all pass, with `E9` (`npm run verify`) green once after every review finding closes
- new api test paths registered in `apps/api/package.json`; new contract subpath registered in `packages/contracts/package.json`
- one audit event recorded per reorder mutation
- seed scenario deterministic and idempotent; high-level plan item 12 updated to completed with the no-migration note and the stale `plans/old/` references corrected
