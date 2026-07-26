# Custom Blend Coding Plan

Status: complete; G0-G4 accepted; feature code-complete in worktree; user owns merge
Source: `plans/custom_additives_handoff.md` -> `Custom Blend — Planner Handoff`
High-level source: `plans/demo_project_high_level_plan.md` -> `16. Custom Blend`
Repository baseline: `materials_exchange_refactor` at `1b34184b3388a9659071d42d52673b777b2e2711`, inspected 2026-07-25

## Runtime Worktree

- source: current branch at runtime -> record named branch and `HEAD`
- create: dedicated `codex/custom-blend-<run-suffix>` branch + sibling worktree before implementation write
- command: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- execution root: all worker, reviewer, test, fix, generated-file, convergence activity runs in worktree
- source checkout: read-only after plan load except run-scoped temp state
- blocker: detached `HEAD` -> stop for branch choice
- blocker: relevant uncommitted or untracked implementation inputs absent from source `HEAD` -> stop for commit or baseline choice
- integration: no merge, rebase, cherry-pick, copy-back, branch removal, or worktree cleanup
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state user owns merge

## Execution Checkpoint — 2026-07-26

- stop point: `G4` accepted; feature code-complete; all packets P1-P10 and reviews R1-R10 closed
- source checkout: `C:\Users\iwano\Desktop\repos\demo_project_000`
- source branch/revision: `materials_exchange_refactor` at `3c9034dc81838f22ca462e640552fb14a08781d3`
- implementation worktree: `C:\Users\iwano\Desktop\repos\demo_project_000-worktrees\custom-blend-20260725`
- implementation branch/base: `codex/custom-blend-20260725` at `3c9034dc81838f22ca462e640552fb14a08781d3`
- implementation commit: `c6bee704f42333e0013fc0a3ab95e56fdce20fbd` (P1-P5/G2 foundation); P6-P10 remain uncommitted in worktree working tree (47 modified + 12 new files)
- remote/upstream: `origin/codex/custom-blend-20260725` -> `https://github.com/QArefully/demo_project_000.git`; foundation push completed; P6-P10 not pushed
- G0: accepted; Node `v22.23.1`; source/worktree clean-input gates passed
- G1: accepted after P1-R1, P2-R2, P3-R3
- G2: accepted after P4-R4, P5-R5
- G3: accepted after P6-R6, P7-R7 (backend lane) and P8-R8, P9-R9 (web lane)
- G4: accepted after P10-R10; live browser journey accepted in lieu of persisted PNGs (tooling/network constraint, user-approved)
- evidence: `E-P1-CONTRACTS` 84 passed; `E-P2-MIGRATION` 19 passed; `E-P3-RULES` 6 passed; `E-P4-OPTIONS` 3 passed; `E-P5-CART` 12 passed; final `npm run verify` exit 0 (API 17 unit + 143 integration; web 435; contracts 84; catalog 36); web integration 11/11; `npm run reset` clean
- findings closed: G0-G2 high (money/cart identity, options serialization, corrupt-cart rollback); R8-STATE-001 critical (edit-mode unexitable -> URL sole target owner); R9 x3 high (missing cart disclosure, two-blends-one-variant coverage, tautological livery test); R10-COPY-001 high (success-screen cancellation clause); FIX-LINT-001 (5 pre-existing eslint errors incl. config-key hash `any`-erosion, fixed at source)
- advisory open: `R2-TEST-001` — direct migration coverage for configured-line uniqueness and JSON/config-key mismatch; web `*.integration.test.tsx` (e.g. `CustomBlendReachability`) runs under `npm run smoke` only, not `npm run verify`
- local-DB note: pre-branch `shop.db` requires `rm apps/api/data/shop.db` -> `npm run reset` (seed is `INSERT OR IGNORE`; won't repair zeroed `discountable_total_cents`)
- merge: user owns merge; branch/worktree retained intact; no merge/rebase/cherry-pick/copy-back/cleanup performed

## Objective

Deliver greenfield Custom Blend journey: choose eligible 25 kg base lot, choose 1-4 compatible real catalog ingredient lots at whole percentages, add one configured sack-count cart line, edit ratio spec, pay current server quote with one flat non-discountable blending fee, preserve spec on order, exclude configured line from returns.

Completion boundary: nav -> `/custom-blend` -> base search/category filter -> ingredient configuration -> cart -> checkout -> order detail, including preselected-base URL and cart-edit flow.

## Scope

### In

- all six customer categories as base-product sources
- active 25 kg sack variant (`sort_order = 1`, `weight_grams = 25000`) as base and ingredient identity
- same-`mixingGroup` ingredient candidates across categories
- sold-out ingredient variants remain selectable; inactive variants do not
- 1-4 distinct ingredients; each 5-50%; total 5-50%; integer percentages
- base percentage derived as `100 - ingredient total`
- base variant MOQ, tier pricing, stock reservation, delivery weight, cancellation behavior
- flat 2,500-minor-unit blending fee once per configured cart line, rendered through existing money formatter
- fee outside discountable subtotal; configured sacks count toward promo item-count gates
- current base price on cart reads and checkout preparation; persisted V6 quote freezes prepared payment
- deterministic configured-line identity and duplicate merge
- cart edit changes ingredient spec only; base lot and quantity stay fixed
- fixed custom-spec packaging livery with base category vessel
- made-to-order/non-returnable labels in configurator, checkout, order, help

### Out

- retired Powderizer or Custom Small Order code, contracts, names, schema, copy
- standalone ingredient entity, curated ingredient allowlist, ingredient inventory, ingredient price pass-through
- pallet base variants or buyer-selectable packaging
- buyer-supplied blend names, saved specs, Buy Again integration, product-detail “customise” button
- special cancellation rule
- admin blend management, blend production workflow, real manufacturing accuracy
- persisted quote version bump or legacy quote parser

## Repository Findings

- existing: `packages/catalog/src/model.ts` -> `CatalogProduct.mixingGroup`, `MIXING_GROUPS`; 100 products, 99 usable mixing groups, 200 active variants
- existing: catalog distribution -> `food-grade` 54, `garden-treatment` 15, `cleaning` 13, `cementitious-materials` 7, `pigments` 4, `casting-materials` 3, `absorbents` 3, null 1
- existing: every product has active 25 kg sack `sortOrder: 1` and 1,000 kg pallet `sortOrder: 2`
- existing: `packages/catalog/src/validateCatalog.ts` validates static catalog deterministically
- existing: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` rebuilt `cart_line_items` around variant identity; current unique key is `(cart_id, variant_id)`
- existing: `apps/api/src/db/migrations/021_remove_powderizer.ts` removed obsolete mixing persistence; latest migration registration is `021`
- existing: `apps/api/src/features/cart/cartService.ts` -> `getCart`, `addItem`, `updateItem`, `removeItem`; current pricing rehydrates from variant rows
- existing: `apps/api/src/features/inventory/inventoryService.ts` -> `aggregateInventoryDemand`, `reserveCheckout`, `commitReservation`; multiple lines for same base variant already aggregate and redistribute correctly
- existing: `apps/api/src/features/pricing/pricingRules.ts` -> `resolveUnitPriceCents`, `perTonneCents`, `validateMoq`
- existing: `apps/api/src/features/checkout/checkoutQuote.ts` -> `createCheckoutQuote`; current subtotal drives promo, persisted quote, order total
- existing: `packages/contracts/src/payments.ts` -> strict `PersistedCheckoutQuoteV6`; V6 is only reader/writer
- existing: `apps/api/src/features/orders/orderRepository.ts` snapshots variant fields into `order_line_items`
- existing: `apps/api/src/features/returns/returnRepository.ts` -> `loadEligibleLines`; every delivered ordinary order line currently enters return eligibility
- existing: `apps/api/src/features/returns/returnService.ts` allocates order discount by line gross total; blend fee requires separate discountable line total
- existing: `apps/web/src/features/catalog/CatalogPage.tsx`, `useCatalogParams`, `useProducts`, `useCategories` provide base search/category behavior
- existing: `apps/web/src/components/CategoryNav.tsx` owns customer category/service nav
- existing: `apps/web/src/index.css` retains `.custom-blend-nav-link` and Custom Blend tokens
- existing: `apps/web/src/components/packaging/packagingSpec.ts` -> `resolvePackagingSpec` resolves base-category vessel
- existing: `apps/web/src/features/help/content/serviceArticles.ts` contains stale “Custom Small Order blends” returns copy
- gap: no custom-blend contracts, rules, persistence, API, cart identity, UI, order snapshot, return exclusion, or help article
- constraint: `products.blend_source_variant_id` remains existing schema detail but is unused; Custom Blend must not adopt it
- constraint: cart line callers address variant, not row ID; config key must extend every line signature
- constraint: money, ratio eligibility, active-state validation, inventory, and MOQ stay server-authoritative

## Decisions and Invariants

- internal identifier: `customBlend`; customer text: `Custom Blend`
- fee: `CUSTOM_BLEND_FEE_CENTS = 2500`; once per configured line, independent of quantity and ingredients; no feature-local currency formatter
- cancellation: existing normal cancellation rules through dispatch; no blend-specific branch
- discount: `subtotalCents` includes fee; `discountableSubtotalCents` excludes fee; percent/fixed promos and minimum-subtotal checks use discountable subtotal
- promo count: `Cart.totalItems` remains sum of sacks; Custom Blend sacks count normally
- price freshness: cart GET and checkout preparation resolve current active base variant price; prepared V6 quote remains immutable for idempotent payment replay
- line identity: `(cart_id, variant_id, config_key)`; plain line `config_key = ''`; blend key = lowercase SHA-256 hex of canonical sorted `[{variantId, percentage}]`
- canonical spec: ingredients unique and sorted ascending by `variantId`; names/descriptions never enter identity hash
- dedup: re-adding identical base/spec increments quantity; edit collision merges preserved quantity into existing identical line and removes old row atomically
- edit: base variant locked; ingredient selection/ratios replace; quantity preserved
- base eligibility: public active product + active variant with `sort_order = 1`, `weight_grams = SACK_WEIGHT_GRAMS`, non-null supported `mixing_group`
- ingredient eligibility: same base rules, same `mixing_group`, not base variant; stock/backorder ignored
- retired-state behavior: inactive base or ingredient causes pre-gateway `CUSTOM_BLEND_INVALID`; no payment or inventory mutation
- input ratios: 1-4 entries; integer percentage 5-50 each; sum 5-50; base remainder 50-95
- server validation: input schema bounds are first gate; domain resolves catalog facts and enforces identity/group/activity constraints again on add, edit, cart hydration, checkout
- inventory: only base variant/quantity enters reservation and allocation; ingredient IDs never enter inventory demands
- pricing: `materialSubtotalCents = resolvedUnitPriceCents * quantity`; `lineTotalCents = materialSubtotalCents + blendingFeeCents`
- MOQ/tier: base sack quantity and base variant fields only; fee never compounds with tier
- order snapshot: base variant snapshot + canonical ingredient IDs, names, ratios, mixing group, base percentage, fixed fee, made-to-order flag
- returns: `order_line_items.custom_blend_json IS NOT NULL` excluded from `eligibleLines`; ordinary lines in same order remain eligible
- refund discount allocation: use persisted `discountable_total_cents`, not fee-inclusive `line_total_cents`
- quote compatibility: keep V6; new line fields optional at storage boundary so already-written plain V6 blobs remain readable; writers always emit them
- packaging: base category selects vessel; fixed charcoal/spec-band/batch-marking livery selects decoration; no composition-derived colours
- assumption for runtime validation: 2,500-minor-unit fee acceptable QA constant; product decision can change one exported constant before `G0`
- assumption for runtime validation: base preselection query key is `baseVariantId`; invalid/ineligible value shows recoverable picker error

## Target Design

### Shared contracts

- proposed `packages/contracts/src/customBlends.ts`
- `CustomBlendIngredientInput`: `variantId`, integer `percentage`
- `CustomBlendIngredientSnapshot`: variant/product IDs, name, description, mixing group, percentage
- `CustomBlendSnapshot`: `configKey`, base percentage, mixing group, ingredients, fee, `madeToOrder: true`, `returnable: false`
- `CustomBlendOption`, `CustomBlendOptionsResponse` containing resolved base + compatible ingredient list
- `CreateCustomBlendBody`, `ReplaceCustomBlendBody`, `CustomBlendErrorCode`, error response
- `CartLine`: required `configKey`, `materialSubtotalCents`, `blendingFeeCents`, `discountableTotalCents`; optional `customBlend`
- `Cart`: required `discountableSubtotalCents`, `blendingFeeTotalCents`
- update/remove cart bodies: optional `configKey`, default plain `''`
- order line: required `discountableTotalCents`, `blendingFeeCents`; optional `customBlend`
- V6 variant line: optional same monetary/spec snapshot fields for stored plain-quote compatibility

### Schema

- proposed `apps/api/src/db/migrations/022_custom_blends.ts`
- rebuild `cart_line_items` with `config_key TEXT NOT NULL DEFAULT ''`, `custom_blend_json TEXT`, unique `(cart_id, variant_id, config_key)`
- preserve IDs, cart/variant FKs, quantities, timestamps; backfill plain rows with empty key/null JSON
- cart checks: safe quantity, empty key iff JSON null, 64-char key + valid JSON when configured
- rebuild `order_line_items` with `discountable_total_cents`, `blending_fee_cents`, `custom_blend_json`
- backfill existing rows: discountable total = line total, fee = 0, custom JSON = null
- preserve IDs and every current snapshot column/FK; recreate `order_line_items_product_id_order_id_idx`
- runner already suspends FKs; migration performs count checks and `foreign_key_check`, never toggles pragma
- register after `021` in `apps/api/src/db/migrations/index.ts`

### Domain and catalog

- proposed `apps/api/src/features/customBlend/customBlendRules.ts`
- pure ratio normalization, safe-integer checks, hash canonicalization, pricing split helpers
- proposed `apps/api/src/features/customBlend/customBlendRepository.ts`
- SQL-owned resolution of 25 kg active base/ingredient facts; options sorted `mixing_group`, product name, variant ID
- proposed `apps/api/src/features/customBlend/customBlendService.ts`
- validates catalog facts, lists compatible options, creates/replaces configured cart rows inside caller-owned transaction
- proposed `apps/api/src/routes/customBlends.ts`
- `GET /api/custom-blends/options?baseVariantId=<id>`
- `POST /api/cart/:cartId/custom-blends`
- `PUT /api/cart/:cartId/custom-blends`

### Cart and checkout

- `cartRepository` reads/writes `config_key` and `custom_blend_json`; every variant-keyed mutation accepts config key
- `getCart` parses stored spec strictly, re-resolves ingredients, fails closed on corrupt/ineligible persisted config, computes material/fee totals
- plain add/update/remove default to empty config key
- custom create/edit run through Custom Blend service, not generic add body
- checkout revalidates active base/ingredients before cart reservation and gateway call
- inventory demand remains one base demand per cart line; existing aggregation handles same base across specs
- promo validation/calculation takes `discountableSubtotalCents`
- quote total remains `subtotalCents - discountCents + deliveryChargeCents`

### Order and returns

- V6 quote freezes ingredient names/ratios and fee
- finalizer writes custom snapshot, fee, discountable total into same `order_line_items` kind
- order repository parses JSON strictly and maps snapshot into transport
- lifecycle/shipment/cancellation/inventory use same order line and base allocation
- return eligibility query filters custom JSON rows
- refund proration allocates discount against `discountableTotalCents`; ordinary refund gross stays ordinary `lineTotalCents`

### Web

- proposed `apps/web/src/features/customBlend/CustomBlendPage.tsx`
- base mode: existing `useProducts` + `useCategories`, search/category controls, selects 25 kg variant
- preselection: `baseVariantId` URL query; resolve through product API/options validation
- ingredient mode: compatible options API, candidates visibly grouped/sorted by mixing group, sold-out badge informational only
- local reducer: stable selected ingredient rows, whole-percent controls, live derived base remainder, boundary errors, stale-request suppression
- add: default base MOQ quantity; quantity editing remains cart responsibility
- edit: `baseVariantId` + `editConfigKey` query loads matching cart line, locks base, preloads spec, replaces atomically
- proposed `apps/web/src/features/customBlend/CustomBlendPackaging.tsx`
- reuse `resolvePackagingSpec` vessel; replace scheme/title band/lot decoration with fixed livery and config-key batch mark
- cart, checkout, order show `Base — 15% Ingredient, 5% Ingredient`, fee, made-to-order/non-returnable callout, distinct line treatment
- nav link consumes retained `.custom-blend-nav-link`; route `/custom-blend`
- help article explains configuration, fee, ingredient stock asymmetry, cancellation, non-returnability

## Execution Graph

`G0 -> P1 -> R1 -> GR1 -> {P2 -> R2 -> GR2 || P3 -> R3 -> GR3} -> G1 -> P4 -> R4 -> GR4 -> P5 -> R5 -> GR5 -> G2 -> {P6 -> R6 -> GR6 -> P7 -> R7 -> GR7 || P8 -> R8 -> GR8 -> P9 -> R9 -> GR9} -> G3 -> P10 -> R10 -> GR10 -> G4`

- `G0`: runtime worktree identity recorded; Node 22 selected; source clean-input check passed; fee/base-variant assumptions accepted
- `GR1`-`GR10`: reviewer pass or critical/high findings closed through fresh-worker fix + targeted evidence
- `G1`: contract, migration, domain-rule change sets accepted; migration `022` reserved
- `G2`: reviewed options/cart API supports canonical configured lines
- `G3`: reviewed backend checkout/order/returns lane + reviewed web configurator/presentation lane accepted
- `G4`: reset, full verification, manual customer journey, retained-worktree handoff complete

## Work Packets

### P1: Define Custom Blend transport and persisted-quote extensions

- mode: sequential after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/customBlends.ts` (proposed), `packages/contracts/src/cart.ts`, `packages/contracts/src/orders.ts`, `packages/contracts/src/payments.ts`, `packages/contracts/src/pricing.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/*custom-blend*.test.ts` (proposed), affected transport fixture tests
- reads: `packages/contracts/src/products.ts` -> `MixingGroup`, `CatalogVariant`; model reuse
- reads: `packages/contracts/src/payments.ts` -> `PersistedCheckoutQuoteV6`, parser; V6 compatibility
- acceptance: TypeBox schemas reject malformed ratios/spec keys; plain V6 quote remains accepted; configured V6 round-trips; cart/order shapes expose fee and spec
- non-goals: API implementation, database migration, UI
- upstream inputs: `G0` -> accepted fee, base-variant, V6 decisions
- changes:
  - add canonical Custom Blend input/snapshot/options/error schemas and types
  - export `CUSTOM_BLEND_FEE_CENTS = 2500` from pricing contract
  - extend cart update/remove identity with optional `configKey`
  - extend cart/order monetary and snapshot fields
  - extend V6 variant lines with optional fields; keep version literal 6 and one strict parser
  - export root/subpath contracts
- invariants: integer minor units; no standalone ingredient entity; quote version stays 6; existing plain blobs parse
- relevant evidence: none
- test duty: `E-P1-CONTRACTS` -> `npm test -w @shop/contracts`
- verification: build declaration exports through package subpath; exact schema failure cases recorded
- handoff: accepted Custom Blend schemas, constants, V6 shape
- review: `R1` -> `GR1`; blocks all consumers

### P2: Add migration 022 for configured cart/order lines

- mode: parallel with `P3` after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/db/migrations/022_custom_blends.ts` (proposed), `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/migrations.integration.test.ts`
- reads: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` -> cart rebuild and order snapshot columns; preservation pattern
- reads: `apps/api/src/db/migrations/021_remove_powderizer.ts` -> FK-safe rebuild/count/index checks
- reads: `apps/api/src/db/migrate.ts` -> runner FK contract
- acceptance: fresh database reaches `022`; database at `021` preserves plain cart/order rows and dependent shipment/inventory/return references; new constraints reject invalid shapes
- non-goals: repository/service behavior, seed catalog edits
- upstream inputs: `P1` -> accepted config/spec/money persistence shape
- changes:
  - rebuild `cart_line_items`; preserve rows/IDs/timestamps; widen unique key
  - rebuild `order_line_items`; preserve rows/IDs/snapshots; backfill money split
  - recreate explicit index; assert counts and FK integrity
  - register `022`
  - add fresh/reset and populated-021 migration coverage
- invariants: append-only migration; no pragma toggle; no Powderizer schema/name; dependent row IDs stable
- relevant evidence: `E-P1-CONTRACTS`
- test duty: `E-P2-MIGRATION` -> `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts`
- verification: inspect `sqlite_master`, `PRAGMA table_info`, `PRAGMA index_list`, `PRAGMA foreign_key_check`
- handoff: accepted `022` schema and column/index names
- review: `R2` -> `GR2`; blocks persistence consumers

### P3: Implement pure Custom Blend rules

- mode: parallel with `P2` after `GR1`
- depends on: `GR1`
- owns: `apps/api/src/features/customBlend/customBlendRules.ts` (proposed), `apps/api/src/features/customBlend/customBlendRules.test.ts` (proposed)
- reads: `packages/contracts/src/customBlends.ts` (proposed) -> accepted inputs/snapshots
- reads: `apps/api/src/features/pricing/pricingRules.ts` -> integer/range style
- acceptance: rules canonicalize/hash valid specs and reject zero entries, duplicate IDs, fractions, <5, >50, sum >50, fifth ingredient, base-as-ingredient
- non-goals: SQL, catalog lookup, route mapping, cart writes
- upstream inputs: `P1` -> accepted input and config-key contract
- changes:
  - normalize/sort ingredient input without mutating caller data
  - derive base percentage and validate all bounds
  - compute deterministic SHA-256 config key from canonical JSON
  - split material subtotal, fee, discountable total with safe-integer checks
- invariants: order-independent identity; no names in hash; exact 50 passes; fee nonnegative and once per line
- relevant evidence: `E-P1-CONTRACTS`
- test duty: `E-P3-RULES` -> `npm exec -w @shop/api -- tsx --test src/features/customBlend/customBlendRules.test.ts`
- verification: repeated permutations produce same JSON/key; boundary matrix captured
- handoff: reviewed rule functions and canonical-spec interface
- review: `R3` -> `GR3`; blocks catalog/cart service

### P4: Expose compatible real-lot options

- mode: sequential after `G1`
- depends on: `GR2`, `GR3`, `G1`
- owns: `apps/api/src/features/customBlend/customBlendRepository.ts` (proposed), `apps/api/src/features/customBlend/customBlendService.ts` (proposed), `apps/api/src/routes/customBlends.ts` (proposed), `apps/api/src/app.ts`, `apps/api/test/customBlend/customBlendOptions.integration.test.ts` (proposed)
- reads: `apps/api/src/features/catalog/productRepository.ts` -> row types/variant lookups
- reads: `apps/api/src/routes/products.ts` -> Fastify schema/error mapping
- reads: `apps/api/src/app.ts` -> repository/service/route composition
- acceptance: eligible base returns every active compatible 25 kg lot across categories except itself; sold-out candidates remain; null/inactive/wrong-shape base rejects
- non-goals: cart mutation, pricing, UI
- upstream inputs: `P2` -> schema names; `P3` -> accepted eligibility/rule functions
- changes:
  - add SQL row mapping for base/ingredient facts
  - add compatible-options query sorted mixing group/name/variant ID, without stock predicate
  - add service validation and `GET /api/custom-blends/options`
  - compose repository/service/route once
- invariants: `mixing_group`, not category, decides compatibility; ingredient descriptions come from products; no allowlist or seed projection
- relevant evidence: `E-P2-MIGRATION`, `E-P3-RULES`
- test duty: `E-P4-OPTIONS` -> `npm exec -w @shop/api -- tsx --test test/customBlend/customBlendOptions.integration.test.ts`
- verification: food-grade cross-category fixture; sold-out included; mismatched/null group absent
- handoff: options endpoint and catalog fact resolver
- review: `R4` -> `GR4`; blocks cart mutation/UI

### P5: Persist, deduplicate, edit, and address configured cart lines

- mode: sequential after `GR4`
- depends on: `GR4`
- owns: `apps/api/src/features/cart/cartRepository.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/src/routes/cart.ts`, `apps/api/src/features/customBlend/customBlendService.ts`, `apps/api/src/routes/customBlends.ts`, `apps/api/test/cart/cart.integration.test.ts`, `apps/api/test/cart/customBlendCart.integration.test.ts` (proposed)
- reads: `apps/api/src/features/audit/auditEvent.ts` -> existing cart audit fields
- reads: `apps/api/src/db/unitOfWork.ts` -> mutation transaction ownership
- acceptance: create/duplicate/edit/update/remove work by base variant + config key; plain lines remain compatible; edit collision merges quantity atomically; cart totals split fee correctly
- non-goals: promo/checkout/order consumption, web UI
- upstream inputs: `P4` -> reviewed validator/options service; `P2` -> accepted configured-line schema
- changes:
  - widen cart row and repository methods with config key/spec JSON
  - add strict JSON parse/hydration and current ingredient fact resolution
  - add configured create/replace methods under same unit of work and audit boundary
  - default existing plain route/service calls to `configKey = ''`
  - compute line/cart material, fee, discountable, total fields
  - map domain failures to stable Custom Blend error codes
- invariants: base quantity preserves MOQ; fee once; ingredient stock never queried for eligibility; corrupt JSON fails closed; cart reservation blocks edit
- relevant evidence: `E-P2-MIGRATION`, `E-P3-RULES`, `E-P4-OPTIONS`
- test duty: `E-P5-CART` -> `npm exec -w @shop/api -- tsx --test test/cart/cart.integration.test.ts test/cart/customBlendCart.integration.test.ts`
- verification: same base with plain + two specs coexists; identical spec order permutations merge; edit preserves quantity
- handoff: reviewed cart endpoints and hydrated `Cart` behavior
- review: `R5` -> `GR5`; blocks checkout and web consumers

### P6: Requote, promote, and reserve Custom Blend at checkout

- mode: backend lane after `G2`; parallel with `P8`
- depends on: `GR5`, `G2`
- owns: `apps/api/src/features/promos/promoService.ts`, `apps/api/src/routes/promo.ts`, `apps/api/src/features/checkout/checkoutTypes.ts`, `apps/api/src/features/checkout/checkoutService.ts`, `apps/api/src/features/checkout/checkoutQuote.ts`, `apps/api/src/features/payments/paymentRepository.ts`, `apps/api/src/routes/payments.ts`, `apps/api/test/checkout/customBlendCheckout.integration.test.ts` (proposed), focused promo tests
- reads: `apps/api/src/features/inventory/inventoryService.ts` -> demand aggregation/reservation
- reads: `packages/contracts/src/payments.ts` -> accepted V6 fields
- acceptance: checkout revalidates base/ingredient activity, discounts material only, counts sacks normally, reserves only base stock, freezes configured snapshot in V6
- non-goals: order row creation, returns, web presentation
- upstream inputs: `P5` -> reviewed hydrated cart/config identity; `P1` -> V6 contract
- changes:
  - use `discountableSubtotalCents` for promo eligibility/calculation
  - retain fee-inclusive subtotal for quote/order total
  - add pre-gateway Custom Blend revalidation and stable failure mapping
  - serialize spec/money split into V6 lines
  - keep inventory demand on base variant and existing quantity
- invariants: no gateway call on invalid/retired spec; no ingredient inventory row; tier discount only material; persisted quote parser remains V6-only
- relevant evidence: `E-P1-CONTRACTS`, `E-P5-CART`
- test duty: `E-P6-CHECKOUT` -> `npm exec -w @shop/api -- tsx --test test/checkout/customBlendCheckout.integration.test.ts src/features/promos/promoService.test.ts`
- verification: 39/40/200/400-sack tier boundaries where applicable; fee exactly 2500 each line; SAVE10 five-sack gate passes; ingredient stock zero passes
- handoff: reviewed prepared V6 quote and inventory/promo behavior
- review: `R6` -> `GR6`; blocks order finalization

### P7: Snapshot orders and exclude blends from returns

- mode: backend lane after `GR6`; parallel with `P9`
- depends on: `GR6`
- owns: `apps/api/src/features/checkout/checkoutFinalizer.ts`, `apps/api/src/features/orders/orderTypes.ts`, `apps/api/src/features/orders/orderRepository.ts`, `apps/api/src/features/returns/returnRepository.ts`, `apps/api/src/features/returns/returnService.ts`, `apps/api/test/orders/customBlendOrder.integration.test.ts` (proposed), affected returns tests
- reads: `apps/api/src/features/inventory/inventoryService.ts` -> order-line allocation contract
- reads: `apps/api/src/features/returns/returnRules.ts` -> discount allocation/cumulative refund rules
- acceptance: order exposes immutable blend breakdown/fee/made-to-order state; base allocation and cancellation work normally; blend never appears in return eligibility; ordinary sibling refund remains correct
- non-goals: configurator UI, nav/help, special cancellation
- upstream inputs: `P6` -> accepted V6 snapshot/money fields; `P2` -> order columns
- changes:
  - map V6 custom fields into order create params
  - persist and strictly hydrate order Custom Blend snapshot
  - preserve base variant allocation in finalizer
  - filter configured rows in return eligibility SQL
  - allocate order discount using `discountableTotalCents`
- invariants: normal cancellation restores only base stock; custom fee never refunded; ordinary sibling return quantity and discount share remain valid
- relevant evidence: `E-P2-MIGRATION`, `E-P6-CHECKOUT`
- test duty: `E-P7-ORDER-RETURNS` -> `npm exec -w @shop/api -- tsx --test test/orders/customBlendOrder.integration.test.ts test/returns/customerReturns.integration.test.ts test/returns/refundProration.integration.test.ts`
- verification: order transport validates; mixed delivered order exposes ordinary line only; cancellation inventory movement references base variant
- handoff: reviewed order/returns transport behavior
- review: `R7` -> `GR7`; blocks convergence

### P8: Build configurator state, data client, and cart edit flow

- mode: web lane after `G2`; parallel with `P6`
- depends on: `GR5`, `G2`
- owns: `apps/web/src/api/customBlends.ts` (proposed), `apps/web/src/features/customBlend/customBlendState.ts` (proposed), `apps/web/src/features/customBlend/CustomBlendPage.tsx` (proposed), colocated tests, `apps/web/src/api/cart.ts`, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`
- reads: `apps/web/src/features/catalog/CatalogPage.tsx` -> search/category/load/error behavior
- reads: `apps/web/src/hooks/useProducts.ts`, `useCategories.ts` -> stale-safe existing data hooks
- reads: `apps/web/src/hooks/CartContext.tsx` -> cart authority
- acceptance: user can select/preselect base, configure legal ratios, add, reload edit from cart, save replacement, recover from stale/missing line
- non-goals: route/nav registration, cart/order visual treatment, help copy
- upstream inputs: `P5` -> reviewed endpoints and cart shape; `P4` -> options API
- changes:
  - add validated options/create/replace API calls
  - extend cart hook with config-key pending identity and Custom Blend mutations
  - implement reducer/selectors for ingredient/ratio boundaries and base remainder
  - implement responsive accessible base and ingredient steps
  - accept `baseVariantId`; edit accepts `editConfigKey`, locks base, preloads cart snapshot
  - ignore/abort stale option requests after base changes
- invariants: UI validation mirrors server but never replaces it; ingredient out-of-stock state never disables selection; error text identifies exact boundary
- relevant evidence: `E-P4-OPTIONS`, `E-P5-CART`
- test duty: `E-P8-CONFIGURATOR` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend/CustomBlendPage.test.tsx src/features/customBlend/customBlendState.test.ts src/hooks/useCart.test.tsx`
- verification: keyboard labels/live totals; invalid URL fallback; stale response ignored; edit quantity unchanged
- handoff: exported page, cart actions, edit-link query contract
- review: `R8` -> `GR8`; blocks web presentation

### P9: Render custom livery and commerce-line disclosures

- mode: web lane after `GR8`; parallel with `P7`
- depends on: `GR8`
- owns: `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` (proposed), colocated tests, `apps/web/src/components/CartLineItem.tsx`, `apps/web/src/components/CartSheet.tsx`, `apps/web/src/features/cart/CartPage.tsx`, `apps/web/src/features/checkout/CheckoutSummary.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, affected component/page tests
- reads: `apps/web/src/components/packaging/packagingSpec.ts` -> `resolvePackagingSpec`, vessel selection
- reads: `apps/web/src/components/packaging/PackagingArtwork.tsx` -> vessel render inputs
- acceptance: configured line stays visually distinct and always shows breakdown, fee, made-to-order/non-returnable status in cart/checkout/order; edit link reopens correct spec
- non-goals: backend changes, nav/app route, help registry
- upstream inputs: `P8` -> page/edit-link contract; `P1` -> cart/order snapshot shape
- changes:
  - add fixed charcoal/spec-band/batch livery across four existing vessel shapes
  - key list/pending state by variant + config key
  - render breakdown and fee separately from base material price
  - render edit action only for configured cart line
  - add made-to-order/non-returnable callouts at checkout and order
- invariants: base product remains line title; ingredient breakdown always visible; base category alone selects vessel; fixed decoration ignores composition
- relevant evidence: `E-P1-CONTRACTS`, `E-P8-CONFIGURATOR`
- test duty: `E-P9-WEB-PRESENTATION` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend/CustomBlendPackaging.test.tsx src/components/CartLineItem.test.tsx src/features/checkout/CheckoutPage.test.tsx src/features/orders/OrderPages.test.tsx`
- verification: snapshot/data attributes prove vessel + fixed scheme; reduced motion inherited; narrow/wide layouts avoid overflow
- handoff: reviewed commerce presentation and livery
- review: `R9` -> `GR9`; blocks convergence

### P10: Integrate route, nav, help, customer journey, and final gates

- mode: convergence after `G3`
- depends on: `GR7`, `GR9`, `G3`
- owns: `apps/web/src/App.tsx`, `apps/web/src/components/CategoryNav.tsx`, `apps/web/src/components/nav/navItems.ts`, `apps/web/src/features/help/content/serviceArticles.ts`, `apps/web/src/features/help/content/helpContentRegistry.ts`, affected nav/help/app integration tests, `CLAUDE.md` general repository map only if needed
- reads: accepted P7 order behavior and P9 presentation exports
- reads: `apps/web/src/features/help/content/helpContentTypes.ts` -> article structure
- acceptance: route/nav/help composition works; full reset/verify passes; manual journey covers create/edit/checkout/order; no retired identifier reintroduced
- non-goals: new domain behavior, broad storefront refactor
- upstream inputs: `P7` -> accepted order/returns behavior; `P9` -> accepted page/presentation/livery
- changes:
  - register `/custom-blend`
  - add reserved nav-slot link using `.custom-blend-nav-link`
  - add Custom Blend help article and replace stale returns copy
  - add route/nav/help and full customer journey integration coverage
  - resolve composition conflicts; run final commands once
- invariants: app route/nav single owner; help says normal cancellation + non-returnable; source checkout untouched
- relevant evidence: all accepted packet evidence, projected only by affected scope
- test duty: `E-P10-RESET` -> `npm run reset`; `E-P10-VERIFY` -> `npm run verify`
- verification: loopback browser journey at `http://127.0.0.1:<port>/custom-blend`; start hidden task-owned server, stop only that server
- handoff: final change set, evidence ledger, worktree identity
- review: `R10` -> `GR10`; blocks `G4`

## Review Assignments

### R1: Review P1 contracts

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high severity gate; verification-before-reporting; map findings into `reviewer_report_v1`
- target: P1 exact settled diff/change-set against worktree base
- timing: immediately after P1 report; before P2/P3
- blocks: `GR1`
- consolidation reason: none
- reads: P1 owned contract files -> schema compatibility and public exports
- acceptance: ratios/config identity/money fields bounded; V6 remains single compatible parser
- invariants: fee integer; old plain V6 accepted; no retired contract names
- risk focus: strict `additionalProperties`, optional V6 compatibility, package exports, unsafe integers
- non-goals: backend/UI behavior
- write policy: inspect-only
- test policy: assess `E-P1-CONTRACTS`; run only when stale/missing blocks verdict
- relevant evidence: `E-P1-CONTRACTS`
- return: `reviewer_report_v1` with exact target/verdict/stable finding IDs

### R2: Review P2 migration

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P2 exact migration diff/change-set
- timing: immediately after P2; before `G1`
- blocks: `GR2`, `G1`
- consolidation reason: none
- reads: migration 022, registry, migration tests, migrations 018/021
- acceptance: fresh + populated upgrade preserves IDs/FKs/indexes and backfills plain lines
- invariants: append-only; no pragma toggle; count/FK checks
- risk focus: dependent FK rows, auto-index recreation, config uniqueness, invalid JSON
- non-goals: service behavior
- write policy: inspect-only
- test policy: assess `E-P2-MIGRATION`
- relevant evidence: `E-P2-MIGRATION`
- return: `reviewer_report_v1`

### R3: Review P3 rules

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P3 exact rule diff/change-set
- timing: immediately after P3; before `G1`
- blocks: `GR3`, `G1`
- consolidation reason: none
- reads: rule source/tests, accepted input schemas
- acceptance: every boundary and deterministic-hash invariant holds
- invariants: exact 50 passes; fifth/duplicate/fraction rejects; safe arithmetic
- risk focus: canonical ordering, mutation, hash collisions from ambiguous serialization
- non-goals: SQL/catalog
- write policy: inspect-only
- test policy: assess `E-P3-RULES`
- relevant evidence: `E-P3-RULES`
- return: `reviewer_report_v1`

### R4: Review P4 options API

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P4 exact settled diff/change-set
- timing: immediately after P4; before P5
- blocks: `GR4`
- consolidation reason: none
- reads: Custom Blend repository/service/route, app composition, option integration tests
- acceptance: same-group cross-category options; stock ignored; activity/25 kg shape enforced
- invariants: SQL ordering allowlisted/static; no category compatibility rule
- risk focus: inactive/null group leakage, sold-out exclusion, route schema mismatch
- non-goals: cart mutation
- write policy: inspect-only
- test policy: assess `E-P4-OPTIONS`
- relevant evidence: `E-P4-OPTIONS`
- return: `reviewer_report_v1`

### R5: Review P5 cart persistence/mutations

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P5 exact settled diff/change-set
- timing: immediately after P5; before P6/P8
- blocks: `GR5`, `G2`
- consolidation reason: none
- reads: cart repository/service/routes, Custom Blend mutation service/routes, tests
- acceptance: plain compatibility, configured dedup/edit identity, fee totals, transaction/audit behavior
- invariants: variant+config addresses exact line; edit collision atomic; cart reservation blocks writes
- risk focus: wrong-line mutation, quantity loss/double count, corrupt JSON, duplicate audit, fee per sack
- non-goals: checkout/order
- write policy: inspect-only
- test policy: assess `E-P5-CART`
- relevant evidence: `E-P5-CART`
- return: `reviewer_report_v1`

### R6: Review P6 checkout money/inventory

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P6 exact settled diff/change-set
- timing: immediately after P6; before P7
- blocks: `GR6`
- consolidation reason: none
- reads: promo, checkout service/quote, payment parser, focused tests
- acceptance: current-state revalidation, fee exclusion, sack count, base-only inventory, V6 snapshot
- invariants: no gateway on invalid spec; quote total reconciles; fee never discounted/tiered
- risk focus: money rounding, stale price/spec, duplicate variant reservations, idempotent replay
- non-goals: finalizer/order rows
- write policy: inspect-only
- test policy: assess `E-P6-CHECKOUT`
- relevant evidence: `E-P6-CHECKOUT`
- return: `reviewer_report_v1`

### R7: Review P7 order/returns integration

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P7 exact settled diff/change-set
- timing: immediately after P7; before `G3`
- blocks: `GR7`, `G3`
- consolidation reason: none
- reads: finalizer, order repository/types, return repository/service, tests
- acceptance: snapshot survives catalog change; base allocation/cancellation works; mixed-order returns correct
- invariants: blend never returnable; fee never refund-discount weight; plain line behavior preserved
- risk focus: JSON corruption, discount proration, inventory restoration, missing order fields
- non-goals: UI
- write policy: inspect-only
- test policy: assess `E-P7-ORDER-RETURNS`
- relevant evidence: `E-P7-ORDER-RETURNS`
- return: `reviewer_report_v1`

### R8: Review P8 configurator

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P8 exact settled diff/change-set
- timing: immediately after P8; before P9
- blocks: `GR8`
- consolidation reason: none
- reads: page/state/API/hook changes and focused tests
- acceptance: legal create/edit flow, URL preselection, stale-request handling, accessible controls
- invariants: base locked in edit; quantity preserved; sold-out ingredient selectable
- risk focus: stale closures/responses, wrong config key, boundary mismatch, inaccessible ratio controls
- non-goals: checkout/order display
- write policy: inspect-only
- test policy: assess `E-P8-CONFIGURATOR`
- relevant evidence: `E-P8-CONFIGURATOR`
- return: `reviewer_report_v1`

### R9: Review P9 presentation/livery

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P9 exact settled diff/change-set
- timing: immediately after P9; before `G3`
- blocks: `GR9`, `G3`
- consolidation reason: one low-risk web presentation packet owns same snapshot-to-display behavior across customer surfaces; exact targets listed
- reads: packaging component, cart/checkout/order views, focused tests
- acceptance: breakdown always visible, fixed livery, correct vessel, edit link, fee/non-returnable disclosure
- invariants: base title; no composition colour; plain line visual behavior unchanged
- risk focus: React key collisions, wrong edit target, missing checkout/order disclosure, SVG overflow
- non-goals: backend/domain
- write policy: inspect-only
- test policy: assess `E-P9-WEB-PRESENTATION`
- relevant evidence: `E-P9-WEB-PRESENTATION`
- return: `reviewer_report_v1`

### R10: Review P10 convergence

- method: invoke `code-reviewer` skill; `review_skill=code-reviewer`; critical + high gate
- target: P10 exact convergence diff/change-set including accepted upstream heads
- timing: after integration/reset/verify/manual evidence; before `G4`
- blocks: `GR10`, `G4`
- consolidation reason: none
- reads: App/nav/help composition, customer journey tests, full relevant diff
- acceptance: complete scope composed; no route/copy regression; required evidence current
- invariants: no retired identifiers; one nav slot; normal cancellation/non-returnable distinction
- risk focus: integration gaps, stale fixtures, route reachability, full-suite failure, source-checkout writes
- non-goals: medium/low cleanup
- write policy: inspect-only
- test policy: assess `E-P10-RESET`, `E-P10-VERIFY`, manual journey; run only if evidence stale/missing blocks verdict
- relevant evidence: `E-P10-RESET`, `E-P10-VERIFY`, journey evidence
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `packages/contracts/**`: P1 only; consumers read after `GR1`
- migration version `022`: P2 reserved exclusively
- `apps/api/src/app.ts`: P4 owns composition; later packets request sequential amendment only if required
- `customBlendService.ts`, `customBlends.ts` route: P4 then P5 sequential; no concurrent edits
- cart repository/service/routes: P5 only
- checkout/promo/payment files: P6 only
- finalizer/order/returns files: P7 only
- web Custom Blend page/state/API/cart hook: P8 only
- cart/checkout/order presentation + livery: P9 only
- `App.tsx`, nav, help registry/content: P10 only
- shared composition: P10 resolves accepted exports; parallel lanes read each other’s owned paths
- finding fixes: fresh worker owns only finding paths until closure; no reviewer writes

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, worker verification; launch globally configured `reviewer` agent for review assignments
- Codex: resolve model, reasoning effort, developer instructions from global settings; never override in plan/assignment
- non-Codex harness: preserve worker/reviewer duties through native roles
- all harnesses: reviewer assignment sets `review_skill=code-reviewer`; reviewer invokes skill explicitly

## Test Execution Schedule

- environment: prepend `C:\Users\iwano\AppData\Local\nvm\v22.23.1` to `PATH`; verify `node --version` is `v22.x`
- dependency health before test evidence: `npm exec -- tsx --version` -> pass; `npm run typecheck -w @shop/api` -> pass
- `T1`: P1 -> `E-P1-CONTRACTS`
- `T2`: P2 || P3 -> `E-P2-MIGRATION` || `E-P3-RULES`
- `T3`: P4 -> `E-P4-OPTIONS`
- `T4`: P5 -> `E-P5-CART`
- `T5`: P6 || P8 -> `E-P6-CHECKOUT` || `E-P8-CONFIGURATOR`
- `T6`: P7 || P9 -> `E-P7-ORDER-RETURNS` || `E-P9-WEB-PRESENTATION`
- `T7`: P10 after convergence -> `npm run reset`
- `T8`: P10 after reset and all fixes -> `npm run verify` once
- `T9`: P10 -> browser journey: nav, base search/category, preselection, legal/illegal ratios, sold-out ingredient, cart edit, promo, checkout, order breakdown, return exclusion
- reuse: passing evidence remains valid for same change set unless listed invalidator changes
- invalidation: contracts -> all consumer evidence; migration/schema -> API integration/reset; cart/domain -> checkout + web cart; quote/money -> order/returns + checkout UI; presentation/router/help -> web integration; dependency/config/seed -> reset + final verify
- review fixes: fresh worker runs smallest affected command; orchestrator closes finding without re-review

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every agent message and JSON string
- transport: inline canonical JSON; temp artifact only for bulky logs/diffs
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent contexts
- projection: role packet + repository instructions + relevant artifact/evidence references; exclude full plan, source plan, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- reviewer method: `code-reviewer`; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1`
- worktree context: every assignment includes absolute path, implementation branch, base revision; repository paths resolve under worktree
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- temp root: `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]`; inline summary/path/format/SHA-256
- checkpoint: atomically replace `[platform temp root]/orchestrator/[run_id]/state.json` after accepted report, directive, finding transition, decision, handoff, evidence invalidation

## Orchestrator Run Order

1. End planning context after saved plan.
2. Start fresh runtime orchestrator; load `CLAUDE.md`, applicable `AGENTS.md`, saved plan, canonical message contracts.
3. Record source checkout path, named branch, `HEAD`; enforce clean relevant-input gate.
4. Create one dedicated implementation branch/worktree; verify branch and base revision; persist identity.
5. Switch execution root to worktree; select Node 22; load worktree instructions.
6. Validate `G0`; accept or revise only explicit assumptions.
7. Launch P1; accept report/evidence; launch R1 against exact settled change set; close findings through fresh worker.
8. After `GR1`, launch P2 || P3 with disjoint ownership; review each immediately; close findings; validate `G1`.
9. Launch P4 -> R4 -> `GR4`; then P5 -> R5 -> `GR5`; validate `G2`.
10. Launch P6 || P8. Review each immediately. After `GR6`, launch P7. After `GR8`, launch P9.
11. Review P7/P9 immediately; close findings; validate `G3`.
12. Launch P10 convergence; run reset, full verify, loopback browser journey once after fixes settle.
13. Launch R10 against exact convergence state; close findings through fresh worker + targeted evidence; rerun invalidated final commands only.
14. Validate `G4`; leave branch/worktree intact.
15. Reply with absolute worktree, implementation branch, source branch, base revision; state user owns merge.

## Risks and Open Questions

- risk: same base variant across plain/multiple configured lines mutates wrong row -> mitigation: config key in repository, API, hook, React keys, integration tests
- risk: one-time fee accidentally multiplied or discounted -> mitigation: explicit material/fee/discountable totals from cart through order; money review gate
- risk: old V6 plain quote rejected -> mitigation: optional storage fields + compatibility contract test
- risk: ingredient inventory accidentally reserved -> mitigation: V6/base demand tests assert no ingredient reservation/movement rows
- risk: blend discount proration reduces ordinary refund incorrectly -> mitigation: persist discountable line total; mixed-order refund test
- risk: table rebuild breaks shipment/return/inventory references -> mitigation: preserve order line IDs; populated-021 migration test; FK check
- risk: edit collision loses/doubles quantity -> mitigation: one unit-of-work replace/merge algorithm + exact integration test
- risk: sold-out ingredient filtered by generic availability query -> mitigation: dedicated options query without stock predicate
- risk: 1,000 kg pallet enters sack-based configurator -> mitigation: base/ingredient resolver requires sort order 1 and 25,000 g
- question: none blocking; runtime validates fee/base/edit assumptions at `G0`

## Done Criteria

- `/custom-blend` reachable from reserved styled nav slot
- base search/category and `baseVariantId` preselection work for all six categories
- 1-4 real compatible ingredients configure at legal boundaries; incompatible/fifth/fractional/below-floor/over-cap inputs fail server-side
- sold-out ingredient selectable; ingredient inventory unchanged
- identical spec deduplicates; distinct specs coexist; edit replaces spec and preserves quantity
- base MOQ, tier, stock, delivery, cancellation remain existing behavior
- 2,500-minor-unit fee charged once, shown through existing formatter, excluded from promos/tier; sacks count toward promo item gate
- V6 quote stays sole persisted format and supports existing plain blobs
- order snapshots and always displays breakdown/made-to-order/non-returnable state
- Custom Blend excluded from returns while ordinary sibling line remains eligible/refundable
- fixed custom livery uses base-category vessel
- help content covers configuration, stock asymmetry, fee, cancellation, non-returnability; stale Custom Small Order copy removed
- migration 022 fresh/populated paths pass with FK integrity
- `npm run reset`, `npm run verify`, focused suites, loopback customer journey pass
- no Powderizer/retired feature identifier restored
- implementation remains in dedicated worktree/branch for user merge
