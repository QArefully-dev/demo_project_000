# Workshop Expansion 1 Custom Blend Rules Coding Plan

Status: proposed
Source: `plans/workshop_expansion_handoff.md` -> `Expansion 1: custom blend rules (priority)`
Repository baseline: branch `workshop_expansion_and_tasks`, revision `a974b33b1292e2301ed557bbc006386a26631834`, inspected 2026-09-01

## Runtime Worktree

- source checkout: `C:\Users\iwano\Desktop\repos\demo_project_000`
- source baseline: runtime current named branch + recorded `HEAD`; detached `HEAD` blocks execution
- source changes: implementation-relevant code/config changes absent from recorded `HEAD` block execution; saved plan remains allowed read-only planning artifact
- worktree root: unique `C:\wt\demo_project_000-expansion-1-<run-id>` descendant; verify writable before delegation
- branch: unique `codex/workshop-expansion-1-<run-id>` from recorded source branch `HEAD`
- create: `git worktree add -b codex/workshop-expansion-1-<run-id> C:\wt\demo_project_000-expansion-1-<run-id> <source-branch>`
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree
- source checkout: read-only after worktree creation except saved plan and run-scoped orchestration state
- integration: no automatic merge, rebase, cherry-pick, copy-back, branch deletion, or worktree cleanup
- completion reply: absolute worktree path + implementation branch + source branch + base revision; user owns merge

## Objective

Replace same-group Custom Blend placeholder with backend-owned compatibility, dosage, safety, and component-pricing rules. Keep configurator simple. Make server sole authority for base eligibility, ingredient compatibility, pigment cap, resulting consumption classification, clearance, tier selection, integer-pence totals, and checkout revalidation.

Completion boundary: eligible base discovery -> compatible ingredient discovery -> server draft evaluation -> configured cart -> checkout quote -> immutable order -> cart/checkout/order safety and price rendering.

## Scope

### In

- approved directional base-to-ingredient matrix
- pigment and absorbent base exclusion
- absorbent ingredient exclusion
- combined pigment cap: 10% finished blend weight
- result classification: all components `food` -> `food`; any `caution` or `non-food` component -> `non-food`
- component-weight pricing with independent tier resolution
- active clearance before component tier discount
- one non-discountable `CUSTOM_BLEND_FEE_CENTS` charge per configured line
- server-driven base list and draft evaluation endpoints
- exact public errors for incompatibility and pigment-cap breach
- current cart rehydration, bulk add/reorder, checkout, persisted quote, order, export compatibility
- localised cart, configurator, checkout, and order rendering
- automated unit, contract, Fastify/SQLite integration, React integration, localisation, reset, and full verification

### Out

- expansion 2 trade credit/invoicing
- `docs/ai` corpus
- workshop demo tasks or scripted demo-task fixtures
- stale `AGENTS.md` plan-pointer repair
- additive catalog expansion
- component inventory reservation or depletion; made-to-order blend keeps base-variant inventory behavior
- persisted RFQ/quote object
- auctions, bidding, live trading
- storefront rewrite
- responsive/mobile work
- Playwright, browser-driving, screenshot, or manual-agent verification
- migration `035`; current SQL shape already stores strict JSON object snapshots

## Repository Findings

- existing: `packages/catalog/src/model.ts` -> `MIXING_GROUPS` defines eight groups; catalog currently contains no `theatrical-effects` rows
- existing: `packages/contracts/src/pricing.ts` -> `CUSTOM_BLEND_FEE_CENTS`, sack/pallet weights, MOQ, tier ladder
- existing: `packages/contracts/src/customBlends.ts` -> strict input, config-key, option, and snapshot schemas
- existing: `apps/api/src/features/customBlend/customBlendRules.ts` -> canonical ratio validation and SHA-256 config identity
- existing: `apps/api/src/features/customBlend/customBlendRepository.ts` -> active sort-order-1 25 kg lot query; current ingredient query enforces same group in SQL
- existing: `apps/api/src/features/customBlend/customBlendService.ts` -> current facts resolved at mutation; current snapshot freezes base/ingredient presentation only
- existing: `apps/api/src/features/cart/cartService.ts` -> configured-line hydration, bulk-add/reorder revalidation, base-only tier price, flat fee
- existing: `apps/api/src/features/checkout/checkoutService.ts` -> checkout transaction rechecks same-group eligibility before reservation/gateway
- existing: `apps/api/src/features/checkout/checkoutQuote.ts` -> quote freezes cart line money and custom snapshot
- existing: `packages/contracts/src/payments.ts` -> current persisted quote version `8`; parser accepts only V8
- existing: `apps/api/src/features/checkout/checkoutFinalizer.ts` -> authorized quote becomes order inside unit of work
- existing: `apps/api/src/features/orders/orderRepository.ts` -> `custom_blend_json` frozen on order line; unreadable JSON fails order read closed
- existing: `apps/api/src/db/migrations/022_custom_blends.ts` -> cart/order JSON constraints already accept strict object payload; no column change required
- existing: `apps/web/src/features/customBlend/BasePicker.tsx` -> lists general catalog, including groups now approved as base-ineligible
- existing: `apps/web/src/features/customBlend/customBlendState.ts` -> duplicates structural ratio constants and performs client structural validation
- existing: `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> cancellable option reads but no server draft verdict
- existing: `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> safety rendering follows base presentation, not whole-blend result
- gap: ingredient material prices never contribute to cart/order money
- gap: aggregate base line weight currently selects tier; component weights never select independent tiers
- gap: same-group SQL predicate owns compatibility; no explicit domain matrix
- gap: base classification leaks into configured line even when ingredient makes result non-food
- gap: pigment cap and exact error identity absent
- gap: cart `nextTierProgress` falsely represents one aggregate ladder for configured blends
- constraint: config identity remains base variant + canonical ingredient IDs/percentages; derived prices/classification never enter hash
- constraint: ordinary cart/order lines retain byte-compatible transport behavior
- constraint: promotion discount base remains complete blend material subtotal; blending fee remains excluded
- constraint: result settlement uses integer GBP pence; country conversion remains render-only
- constraint: seeded integration assertions use test-owned identifiers, never global counts
- reuse: `resolveClearance()` -> active component source price
- reuse: pricing half-up and highest-qualifying-tier rules -> component calculations
- reuse: `CustomBlendReachability.integration.test.tsx` -> customer route integration
- reuse: route `sendPublicError()` -> safe country-localised errors

## Decisions and Invariants

- matrix direction: base group -> allowed ingredient groups
- `food-grade` -> `food-grade`
- `cleaning` -> `cleaning`, `pigments`
- `garden-treatment` -> `garden-treatment`
- `cementitious-materials` -> `cementitious-materials`
- `casting-materials` -> `casting-materials`, `pigments`
- `theatrical-effects` -> `theatrical-effects`, `pigments`
- `pigments`, `absorbents` -> never bases
- `absorbents` -> never ingredients
- pigment limit: sum percentages for every `pigments` ingredient <= `10`
- classification: every component `food` -> `food`; otherwise `non-food`; resulting blend never returns `caution`
- constants: structural ratio limits, rule version, pigment cap, fee live in `packages/contracts`; compatibility evaluation lives in API domain code
- frontend: may use shared structural input bounds; must not import, restate, or infer compatibility matrix, pigment-group identity, cap arithmetic, classification propagation, tier selection, or component money
- base and ingredient eligibility: active product + active variant + sort order `1` + exact `SACK_WEIGHT_GRAMS` + supported catalog group
- stock: sold-out ingredients remain selectable; current made-to-order behavior preserved
- country blocking: base and every ingredient rechecked at mutation, bulk add, and checkout
- config key: SHA-256 of canonical ingredient IDs/percentages only; base variant remains line identity; price, quantity, rule version, clearance, classification excluded
- line total weight: `quantity * SACK_WEIGHT_GRAMS`
- component total weight: `line total weight * component percentage / 100`; current integer percentage and 25 kg sack make gram result integral
- component source price: active clearance pack price when valid, otherwise list pack price
- component tier: highest tier whose tonne floor <= component total weight; no aggregate blend tier; no compounding
- component unit contribution: half-up `sourceUnitPriceCents * percentage * (100 - tierDiscountPct) / 10_000`
- component subtotal: `componentUnitContributionCents * quantity`
- material unit price: sum component unit contributions
- material subtotal: sum component subtotals; must equal material unit price * quantity
- fee: `CUSTOM_BLEND_FEE_CENTS` once per configured line, never per sack, never discounted, never refunded as material
- line total: material subtotal + fee
- configured line `nextTierProgress`: omitted; resolved component entries carry component-specific next-tier data when another tier exists
- clearance metadata: freeze active component clearance facts in resolved outcome; expired/future/malformed windows use list price
- snapshot split: legacy specification snapshot remains readable; new resolved snapshot adds rule version, result classification, and quantity-specific component pricing
- cart persistence: stored custom JSON remains specification input; every read discards stored derived outcome and re-resolves live facts/current quantity
- checkout quote: writer advances to V9; parser/finalizer retain V8 support for already-prepared intents
- order: V9 resolved snapshot freezes component money, weights, discounts, source prices, clearance facts, and result classification inside existing `custom_blend_json`
- SQL: no schema change; migration head stays `034`
- checkout stale-rule failure: public `409 CUSTOM_BLEND_INVALID`; no inventory, promo, payment, or order mutation
- configurator mutation errors: `400 CUSTOM_BLEND_INCOMPATIBLE` or `400 CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED`; cap response carries safe `maxPercentage` + `actualPercentage`
- options/base unavailable errors: existing `CUSTOM_BLEND_INVALID`
- ordinary cart line, checkout quote, order line, reorder, return, saved-list behavior unchanged

## Target Design

### Contracts

- `packages/contracts/src/customBlends.ts`
  - export structural constants now duplicated by API/web
  - export `CUSTOM_BLEND_RULE_VERSION = 1` and `CUSTOM_BLEND_MAX_PIGMENT_PERCENTAGE = 10`
  - preserve exact legacy snapshot schema as `LegacyCustomBlendSnapshot`
  - add resolved component pricing schema: role, variant/product identity, group, percentage, component weight, source unit price, optional clearance, tier discount, optional next tier, unit contribution, subtotal
  - add `ResolvedCustomBlendSnapshot`: legacy spec fields + rule version + result classification + component pricing totals
  - export `CustomBlendSnapshot` union for historic order/reorder/export consumers
  - add base-list query/response and evaluation body/response schemas
- `packages/contracts/src/cart.ts`
  - configured current API lines accept resolved snapshot and enforce money equality through transport tests
  - ordinary line pairing unchanged
- `packages/contracts/src/orders.ts`
  - historic lines accept legacy snapshot; new lines accept resolved snapshot
- `packages/contracts/src/publicErrors.ts`
  - append `CUSTOM_BLEND_INCOMPATIBLE`, `CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED`
  - add percentage metadata fields and code-specific cap metadata schema
- `packages/contracts/src/payments.ts`
  - freeze historical V8 line against legacy snapshot
  - add V9 line requiring resolved snapshot for configured lines
  - writer constant -> `9`; parser union -> V8 + V9
  - reject unknown versions and malformed configured price/outcome pairs

### Domain Policy

- `apps/api/src/features/customBlend/customBlendRules.ts`
  - retain canonical structural validation/hash
  - add typed approved matrix using catalog `MixingGroup`
  - add `isCustomBlendBaseGroup()`, `isIngredientGroupAllowed()`, pigment-cap validation, result-classification reduction
  - add component pricing pure function using pricing primitives and resolved clearance inputs
  - return typed domain failures; never return exception prose to route
- pricing helpers: expose safe total-weight tier resolver and shared half-up integer helper from `pricingRules.ts`; existing ordinary-line functions delegate without behavior change

### Resolution Authority

- proposed `apps/api/src/features/customBlend/customBlendResolver.ts`
  - sole owner for fact resolution + policy + classification + pricing
  - `listBases(query)` filters candidate lots through domain base eligibility
  - `listOptions(baseVariantId)` filters candidate ingredients through domain matrix
  - `evaluate(baseVariantId, ingredients, quantity?)` resolves default MOQ quantity, canonical spec, live facts, country-neutral rule verdict, resolved snapshot
  - `rehydrate(baseVariantId, persistedSpec, quantity)` ignores persisted derived fields, re-resolves live facts, validates config key, returns current resolved snapshot
  - `toPersistedSpec(resolved)` strips quantity-specific outcome before cart write
  - injected clock selects clearances deterministically
- `customBlendRepository.ts`
  - query candidate facts only; remove same-group compatibility predicate
  - include clearance fields and closed fact typing
  - keep SQL ordering stable: group -> product name -> variant ID
- `cartRepository.ts`
  - remove duplicate blend-fact query after resolver adoption

### HTTP

- `GET /api/custom-blends/bases?q=<optional>&category=<optional>` -> server-authoritative eligible base lots
- `GET /api/custom-blends/options?baseVariantId=<id>` -> approved compatible ingredient lots only
- `POST /api/custom-blends/evaluate` -> current quantity + resolved snapshot; no cart mutation
- existing create/replace endpoints -> same resolver; exact rule errors
- base/options/evaluation successful responses validated by shared schemas
- evaluation requests remain public and side-effect free
- route error bodies use `sendPublicError()`; no domain exception message reflection

### Cart, Bulk Add, Reorder

- cart service receives resolver dependency
- configured cart read -> persisted spec + current facts + current quantity -> resolved snapshot + component totals
- ordinary lines retain current clearance/tier path
- configured lines skip aggregate `resolveUnitPriceCents()` and aggregate `nextTierProgress()`
- create/replace persist spec only; subsequent cart read returns resolved outcome
- bulk add/reorder accepts legacy or resolved source snapshot, re-resolves current policy/prices, writes current spec
- stale/incompatible/cap-breaching reordered blend -> existing `BLEND_UNAVAILABLE` outcome
- inventory demand remains base variant/quantity only

### Checkout and Order

- checkout revalidation calls resolver and compares exact config, classification, component breakdown, and line totals before reservation
- quote V9 freezes resolved snapshot and result classification on variant line
- V8 finalization remains supported without retroactive repricing
- V9 finalizer sets order variant classification from resolved blend result, not base catalog row
- order repository persists resolved snapshot in existing `custom_blend_json`
- order read rejects corrupt resolved totals/shape; legacy orders remain readable
- account export naturally includes frozen resolved snapshot through order allowlist
- promo math uses blend material subtotal; fee exclusion preserved

### Web

- base picker calls server base-list endpoint; no group allowlist in React
- options remain server-filtered; React never checks matrix
- shared structural constants replace web-local numeric copies
- proposed `useCustomBlendEvaluation` hook
  - waits until structural draft valid
  - debounces 150 ms
  - aborts superseded requests
  - keys result to exact base/ingredient/quantity request
  - clears old verdict synchronously when draft changes
  - exposes loading, resolved, coded-error states
- submit requires current structurally valid draft + matching successful server evaluation
- create sends evaluated default quantity; replace keeps locked cart quantity
- preview, summary, cart, checkout, order render result classification and component pricing from resolved snapshot
- any non-food result shows localised `Not for consumption` warning and safety treatment
- cart/checkout/order show material total + component breakdown + one blending fee without recomputing money
- legacy order without resolved outcome shows current neutral fallback; never infers safe food classification

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> {P3 -> R3 -> GR3 || P4 -> R4 -> GR4 || P5 -> R5 -> GR5} -> G2 -> P6 -> R6 -> GR6 -> P7 -> R7 -> GR7 -> P8 -> R8 -> GR8 -> P9 -> R9 -> GR9 -> G3 -> {P10 -> R10 -> GR10 -> P11 -> R11 -> GR11 || P12 -> R12 -> GR12} -> G4 -> S1 -> R13 -> GR13 -> G5`

- `G0`: worktree identity recorded; Node 22 selected; clean locked install and health checks pass; product matrix/cap recorded as decisions
- `GR1`-`GR12`: packet review passes or critical/high findings close through fresh-worker fix + targeted evidence
- `G1`: blend contract and pricing primitive producers reviewed
- `G2`: localisation, quote V9, domain policy reviewed; interfaces accepted
- `G3`: API route/composition behavior reviewed; web consumers may launch
- `G4`: both web lanes reviewed; cross-slice convergence may launch
- `GR13`: convergence review passes or findings close
- `G5`: reset + full verification pass on final change set

## Gates

### G0: Runtime Bootstrap

- record source branch + `HEAD` + source checkout absolute path
- reject detached `HEAD`
- inspect `git status --short`; block on implementation-relevant uncommitted code/config input absent from `HEAD`
- create one branch/worktree under `C:\wt`
- verify `git branch --show-current` and `git rev-parse HEAD` inside worktree
- run from worktree:
  - `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; node --version`
  - expected: `v22.x`; stop on Node 23+
  - `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm ci`
  - `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -- tsx --version`
  - `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm run typecheck -w @shop/api`
- checkpoint: source/worktree identities, product decisions, health evidence

### G1: Producer Acceptance

- require `GR1`, `GR2`
- accept resolved snapshot shape, error identities, pricing helper signatures
- reject downstream launch if ordinary pricing characterization changed

### G2: Policy Acceptance

- require `GR3`, `GR4`, `GR5`
- accept localisation keys, V8/V9 compatibility, matrix/cap/classification/pricing behavior
- reject resolver launch on contract/domain mismatch

### G3: API Acceptance

- require `GR6`, `GR7`, `GR8`, `GR9`
- accept base/options/evaluation/mutation contracts, cart outcome, checkout/order persistence
- reject web launch if successful responses fail shared schema validation or exact errors drift

### G4: Web Fan-In

- require `GR10`, `GR11`, `GR12`
- accept stale-request protection, server-verdict submit gate, safety/price rendering

### G5: Completion

- require `GR13`
- run final reset and `npm run verify` once after all fixes
- confirm no migration `035`, docs corpus, demo tasks, or expansion 2 changes

## Work Packets

### P1: Blend Transport and Error Contracts

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/customBlends.ts`, `packages/contracts/src/cart.ts`, `packages/contracts/src/orders.ts`, `packages/contracts/src/publicErrors.ts`, `packages/contracts/test/custom-blend-contracts.test.ts`, `packages/contracts/test/public-errors.test.ts`, `packages/contracts/test/order-contracts.test.ts`
- reads: `packages/contracts/src/pricing.ts` -> fee/weight/tier schemas -> resolved pricing fields
- reads: `apps/api/src/features/customBlend/customBlendRules.ts` -> current identity bounds -> legacy schema preservation
- acceptance: legacy snapshot validates unchanged; resolved snapshot validates exact component/result facts; base/evaluation contracts strict; public cap metadata strict; ordinary lines unchanged
- non-goals: payment quote versions, domain implementation, localisation
- upstream inputs: `G0` -> recorded decisions -> matrix groups, 10% cap, rule version 1
- changes:
  - export structural/rule constants and legacy/resolved schemas
  - define component price/outcome schemas with safe-integer bounds
  - define base-list + evaluation request/response
  - append exact public error codes + percentage metadata
  - extend cart/order snapshot unions while preserving plain-line pairing
  - add rejection tests for mismatched totals, unknown fields, invalid cap metadata, unsafe integers
- invariants: config-key shape unchanged; resolved derived fields excluded from identity; legacy orders remain representable
- relevant evidence: `E-G0-HEALTH` -> clean baseline toolchain
- test duty: `E-P1-CONTRACTS` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm test -w @shop/contracts`
- verification: all contract tests pass; new schemas reject incomplete/mismatched configured outcomes
- handoff: resolved snapshot schema, endpoint schemas, public error identities
- review: `R1` -> `GR1`; blocks `P3`, `P4`, `P5`

### P2: Weight-Based Pricing Primitives

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `apps/api/src/features/pricing/pricingRules.ts`, `apps/api/src/features/pricing/pricingRules.test.ts`
- reads: `packages/contracts/src/pricing.ts` -> `TIER_LADDER`, weights -> boundary rules
- acceptance: shared helper resolves tier from total grams; shared half-up helper guards unsafe arithmetic; existing ordinary quantity/weight functions remain behavior-identical
- non-goals: blend matrix, component composition, cart wiring
- upstream inputs: `G0` -> repository baseline -> existing pricing characterization
- changes:
  - expose total-weight tier resolver
  - expose non-negative integer half-up helper with overflow guards
  - delegate existing unit-price path through helpers
  - characterize 1t/5t/10t exact and minus-one-gram boundaries
  - preserve highest-only, non-compounding behavior
- invariants: integer pence only; ordinary line outputs unchanged
- relevant evidence: `E-G0-HEALTH`
- test duty: `E-P2-PRICING` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test src/features/pricing/pricingRules.test.ts`
- verification: focused pricing suite passes
- handoff: reviewed `resolveTierDiscountPctForWeight()` + half-up helper
- review: `R2` -> `GR2`; blocks `P5`

### P3: Localised Rule, Safety, and Price Copy

- mode: parallel with `P4`, `P5` after `G1`
- depends on: `P1`, `GR1`, `G1`
- owns: `packages/localisation/src/messages/apiErrors.ts`, `packages/localisation/src/messages/customBlend.ts`, `packages/localisation/src/messages/cart.ts`, `packages/localisation/src/messages/checkout.ts`, `packages/localisation/src/messages/orderLifecycle.ts`, `packages/localisation/test/api-errors.test.ts`, `packages/localisation/test/localisation.test.ts`
- reads: `packages/contracts/src/publicErrors.ts` -> exact new keys/meta
- reads: target-design web copy list -> loading, safety, component breakdown labels
- acceptance: every new user-facing string exists for UK/US/CN/PL/ES/DE/FR; interpolation shapes consistent; exact cap/incompatibility errors safe
- non-goals: UI rendering, API route mapping
- upstream inputs: `P1` -> reviewed error/schema change set -> message keys and metadata
- changes:
  - add incompatibility + cap public error copy
  - add evaluation loading/failure/current-price copy
  - add result safety warning and component pricing labels across four surfaces
  - avoid product/group names in static messages
  - extend localisation tests for metadata interpolation and catalog completeness
- invariants: no raw English in touched React/API paths; settlement/display split unchanged
- relevant evidence: `E-P1-CONTRACTS`
- test duty: `E-P3-LOCALISATION-GUARD` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm run check:localisation`
- test duty: `E-P3-LOCALISATION-TESTS` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm test -w @shop/localisation`
- verification: localisation guard + package tests pass
- handoff: reviewed message keys for `P9`, `P11`, `P12`
- review: `R3` -> `GR3`; blocks `P9`, `P11`, `P12`

### P4: Persisted Checkout Quote V9

- mode: parallel with `P3`, `P5` after `G1`
- depends on: `P1`, `GR1`, `G1`
- owns: `packages/contracts/src/payments.ts`, `packages/contracts/test/transport-contracts.test.ts`, `packages/contracts/test/powder-shop-contracts.test.ts`, payment-version cases in `packages/contracts/test/custom-blend-contracts.test.ts`
- reads: `packages/contracts/src/customBlends.ts` -> legacy/resolved snapshot schemas
- reads: `apps/api/src/features/checkout/checkoutQuote.ts` -> current V8 writer facts
- acceptance: V9 configured line requires resolved outcome; V8 remains readable; current writer constant is 9; malformed pairs/unknown versions fail closed
- non-goals: checkout service implementation, database migration
- upstream inputs: `P1` -> reviewed snapshot schema
- changes:
  - freeze V8 against legacy snapshot
  - add V9 variant line and quote schema
  - parse V8/V9 union
  - set current version 9
  - test plain V9, configured V9, legacy V8, corrupt result, unknown version
- invariants: already-prepared V8 intents remain finalizable; new plain quote semantics unchanged except version
- relevant evidence: `E-P1-CONTRACTS`
- test duty: `E-P4-QUOTE-CONTRACTS` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm test -w @shop/contracts`
- verification: contract suite passes after V9 update
- handoff: reviewed V8/V9 reader/writer contract
- review: `R4` -> `GR4`; blocks `P8`

### P5: Compatibility, Dosage, Classification, and Component Price Rules

- mode: parallel with `P3`, `P4` after `G1`
- depends on: `P1`, `P2`, `GR1`, `GR2`, `G1`
- owns: `apps/api/src/features/customBlend/customBlendRules.ts`, `apps/api/src/features/customBlend/customBlendRules.test.ts`
- reads: `packages/catalog/src/model.ts` -> closed `MixingGroup` type/list
- reads: `apps/api/src/features/pricing/clearanceRules.ts` -> resolved clearance input
- reads: `apps/api/src/features/pricing/pricingRules.ts` -> reviewed weight-tier/rounding helpers
- acceptance: approved matrix exact; pigment total cap exact; classification propagation exact; component pricing formula and totals exact; unsafe arithmetic rejected
- non-goals: SQL, transport mapping, cart writes
- upstream inputs: `P1` -> rule constants/resolved schemas; `P2` -> pricing helpers
- changes:
  - add typed matrix and base/ingredient eligibility functions
  - add typed domain failure codes
  - reduce result classification across base + ingredients
  - validate combined pigment percentage, not per-pigment percentage
  - calculate base + ingredient component weights and independent tiers
  - calculate single-round per-unit contributions then line subtotals
  - include component-specific next-tier progress
  - prove 10t aggregate does not grant 10% when component weights qualify only lower tiers
- invariants: canonical hash unchanged; matrix never exported to web; fee excluded from component/tier math
- relevant evidence: `E-P1-CONTRACTS`, `E-P2-PRICING`
- test duty: `E-P5-RULES` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test src/features/customBlend/customBlendRules.test.ts`
- verification: pure rule suite covers all eight groups, directional matrix, multiple pigments, classification combinations, tier boundaries, clearance inputs, overflow
- handoff: reviewed pure rule interface + error facts
- review: `R5` -> `GR5`; blocks `P6`

### P6: Custom Blend Repository and Resolver

- mode: sequential after `G2`
- depends on: `P5`, `GR5`, `G2`
- owns: `apps/api/src/features/customBlend/customBlendRepository.ts`, proposed `apps/api/src/features/customBlend/customBlendResolver.ts`, proposed `apps/api/src/features/customBlend/customBlendResolver.test.ts`, first sequential resolver adoption in `apps/api/src/features/customBlend/customBlendService.ts` and `apps/api/src/app.ts`
- reads: `apps/api/src/features/catalog/productRepository.ts` -> row/query conventions
- reads: `apps/api/src/features/customBlend/customBlendService.ts` -> current snapshot mapping
- reads: `apps/api/src/features/cart/cartRepository.ts` -> duplicate fact lookup to retire in `P7`
- acceptance: resolver is sole live-fact/rule/pricing authority; SQL contains no compatibility matrix; persisted derived facts never trusted
- non-goals: HTTP, cart repository cleanup, checkout wiring
- upstream inputs: `P5` -> reviewed policy/pricing functions
- changes:
  - query eligible candidate facts with clearance columns
  - add optional search/category base query using bound parameters
  - filter bases/options in resolver through domain policy
  - implement evaluate, rehydrate, persisted-spec projection
  - derive default quantity through existing MOQ helper
  - inject clock; no wall-clock reads
  - distinguish unavailable, incompatible, cap, and corrupt-snapshot failures
  - adapt existing custom blend service/composition to resolver while retaining existing route surface
- invariants: bound SQL only; stable ordering; active/sort-order/25kg gates retained; sold-out ingredient candidates retained
- relevant evidence: `E-P5-RULES`
- test duty: `E-P6-RESOLVER` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test src/features/customBlend/customBlendResolver.test.ts`
- verification: fake-repository resolver tests cover filtering, query normalization, stored-outcome distrust, default quantity, live clearance clock
- handoff: `CustomBlendResolver` interface + repository fact type
- review: `R6` -> `GR6`; blocks `P7`, `P8`, `P9`

### P7: Cart, Bulk Add, and Reorder Resolution

- mode: sequential after `GR6`
- depends on: `P6`, `GR6`
- owns: `apps/api/src/features/cart/cartRepository.ts`, `apps/api/src/features/cart/cartService.ts`, `apps/api/src/features/cart/cartBulkAddRules.ts`, `apps/api/src/features/cart/cartBulkAddRules.test.ts`, second sequential resolver adoption in `apps/api/src/app.ts`, `apps/api/test/cart/customBlendCart.integration.test.ts`, custom-blend cases in `apps/api/test/reorder/reorderRoutes.integration.test.ts`
- reads: `apps/api/src/features/reorder/reorderRules.ts` -> source snapshot pass-through
- reads: `apps/api/src/features/inventory/inventoryService.ts` -> base-only inventory invariant
- acceptance: cart returns current resolved outcome; quantity changes reprice every component; bulk/reorder revalidates legacy/current snapshots; ordinary lines unchanged
- non-goals: component inventory, checkout quote, HTTP endpoint additions
- upstream inputs: `P6` -> reviewed resolver
- changes:
  - inject resolver into cart service
  - stop cart use of duplicate blend-fact query and same-group checks; retain repository compatibility method until `P8` removes final checkout consumer
  - persist specification-only JSON on create/replace/bulk add
  - use resolver on cart hydration and bulk classification
  - replace base-only configured price with resolved component totals
  - omit aggregate next-tier progress for configured lines
  - expose result classification on configured cart product presentation
  - keep base-only availability/reservation demand
  - update arithmetic guards for component result totals
- invariants: cart mutation transaction/audit behavior unchanged; country blocking includes every component; fee once per line; config-key dedupe unchanged
- relevant evidence: `E-P6-RESOLVER`
- test duty: `E-P7-CART` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test test/cart/customBlendCart.integration.test.ts test/reorder/reorderRoutes.integration.test.ts`
- verification: tests cover mixed-group success, incompatible/cap failure, quantity repricing, independent tiers, clearance, legacy reorder, corrupt JSON, ordinary regression
- handoff: reviewed resolved cart behavior + persisted-spec boundary
- review: `R7` -> `GR7`; blocks `P8`, `P9`, `P12`

### P8: Checkout Quote, Revalidation, and Order Finalization

- mode: sequential after `GR7`
- depends on: `P4`, `P6`, `P7`, `GR4`, `GR6`, `GR7`
- owns: `apps/api/src/features/checkout/checkoutService.ts`, `apps/api/src/features/checkout/checkoutQuote.ts`, `apps/api/src/features/checkout/checkoutFinalizer.ts`, `apps/api/src/features/checkout/checkoutTypes.ts`, `apps/api/src/features/orders/orderTypes.ts`, `apps/api/src/features/orders/orderRepository.ts`, final duplicate-method removal in `apps/api/src/features/cart/cartRepository.ts`, third sequential resolver adoption in `apps/api/src/app.ts`, `apps/api/test/checkout/customBlendCheckout.integration.test.ts`, `apps/api/test/orders/customBlendOrder.integration.test.ts`, V8/V9 custom cases in `apps/api/test/checkout/paymentIntent.integration.test.ts`
- reads: `apps/api/src/features/payments/paymentRepository.ts` -> strict quote parsing
- reads: `apps/api/src/features/promos/promoService.ts` -> discountable subtotal boundary
- reads: `apps/api/src/features/accountExport/dataExportService.ts` -> order snapshot allowlist
- acceptance: new intents persist V9 resolved outcome; V8 intents finalize; stale rule/price fails before reservations/gateway; V9 order freezes outcome/result classification
- non-goals: trade credit, VAT, invoice, new SQL migration
- upstream inputs: `P4` -> V8/V9 contracts; `P6` -> resolver; `P7` -> resolved cart line
- changes:
  - replace checkout same-group loop with resolver re-evaluation + exact comparison
  - write V9 quote with resolved configured lines
  - keep plain lines semantically unchanged
  - finalize V8 through legacy path and V9 through resolved path
  - set V9 order variant classification from blend result
  - preserve resolved snapshot in `custom_blend_json`
  - validate hydrated resolved snapshot totals; legacy hydration unchanged
  - verify promo excludes fee and includes every component material penny
- invariants: full preparation/finalization transaction ownership; idempotency/replay unchanged; no gateway call on stale blend; GBP pence only
- relevant evidence: `E-P4-QUOTE-CONTRACTS`, `E-P6-RESOLVER`, `E-P7-CART`
- test duty: `E-P8-CHECKOUT-ORDER` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test test/checkout/customBlendCheckout.integration.test.ts test/orders/customBlendOrder.integration.test.ts test/checkout/paymentIntent.integration.test.ts`
- verification: focused SQLite/Fastify tests pass for V8 replay, V9 write/finalize, stale rollback, immutable order, export shape
- handoff: reviewed checkout/order resolved-snapshot path
- review: `R8` -> `GR8`; blocks `P9`, `P12`

### P9: Base, Options, Evaluation, and Mutation API Composition

- mode: sequential after `GR8`
- depends on: `P3`, `P6`, `P7`, `P8`, `GR3`, `GR6`, `GR7`, `GR8`
- owns: final sequential endpoint extension in `apps/api/src/features/customBlend/customBlendService.ts` and `apps/api/src/app.ts`, `apps/api/src/routes/customBlends.ts`, `apps/api/test/customBlend/customBlendOptions.integration.test.ts`, proposed `apps/api/test/customBlend/customBlendEvaluation.integration.test.ts`
- reads: `apps/api/src/utils/errors.ts` -> typed safe error mapping
- reads: `apps/api/src/routes/products.ts` -> public list query conventions
- acceptance: three read/evaluation paths and two mutations use one resolver; exact schemas/errors/locales; app shares resolver with cart/checkout
- non-goals: React, browser verification
- upstream inputs: `P3` -> messages; `P6` -> resolver; `P7` -> cart interface; `P8` -> checkout dependency
- changes:
  - build one resolver/repository instance in composition root
  - inject resolver into cart, checkout, custom blend service
  - add bases + evaluation route schemas/handlers
  - map domain failures to exact public codes and safe metadata
  - keep options current URL compatible
  - make create use evaluated/default quantity and replace re-resolve current spec
  - test country-localised errors without reflecting exception prose
- invariants: imports open no DB/listener; evaluation side-effect free; route validation strict; no matrix in route/SQL
- relevant evidence: `E-P3-LOCALISATION`, `E-P6-RESOLVER`, `E-P7-CART`, `E-P8-CHECKOUT-ORDER`
- test duty: `E-P9-API` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test test/customBlend/customBlendOptions.integration.test.ts test/customBlend/customBlendEvaluation.integration.test.ts`
- verification: route tests cover filters/order, matrix options, pigment cap metadata, classification, evaluation money, mutation parity, malformed input
- handoff: reviewed HTTP/client contract + composition
- review: `R9` -> `GR9`; blocks `P10`, `P12`, `G3`

### P10: Web API and Stale-Safe Evaluation State

- mode: parallel lane before `P11`; parallel with `P12` after `G3`
- depends on: `P9`, `GR9`, `G3`
- owns: `apps/web/src/api/customBlends.ts`, proposed `apps/web/src/features/customBlend/useCustomBlendEvaluation.ts`, proposed `apps/web/src/features/customBlend/useCustomBlendEvaluation.test.tsx`, `apps/web/src/features/customBlend/customBlendState.ts`, `apps/web/src/features/customBlend/customBlendState.test.ts`
- reads: `packages/contracts/src/customBlends.ts` -> shared constants and endpoint shapes
- reads: `apps/web/src/api/client.ts` -> cancellable request/error handling
- acceptance: no duplicated business rules; exact draft result never survives changed target; structurally invalid drafts cause no evaluation request
- non-goals: page layout, safety rendering, base picker
- upstream inputs: `P9` -> reviewed HTTP contract
- changes:
  - add base-list + evaluate API clients with response validation
  - replace local structural numeric constants with contract exports
  - keep generic reducer/input bounds only
  - implement 150 ms evaluation hook with abort/request identity
  - preserve public error code/meta for render; discard server prose
  - expose resolved quantity/snapshot only for exact active request
- invariants: no matrix/pigment/classification/price calculation in web; active-country/base/edit changes invalidate result
- relevant evidence: `E-P9-API`
- test duty: `E-P10-WEB-STATE` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend/customBlendState.test.ts src/features/customBlend/useCustomBlendEvaluation.test.tsx`
- verification: tests cover debounce, abort, late response, coded error, same-draft retry, target/country invalidation
- handoff: reviewed hook/client state interface
- review: `R10` -> `GR10`; blocks `P11`

### P11: Server-Driven Configurator

- mode: sequential after `GR10`; parallel lane with `P12`
- depends on: `P3`, `P10`, `GR3`, `GR10`
- owns: `apps/web/src/features/customBlend/BasePicker.tsx`, `apps/web/src/features/customBlend/BasePicker.test.tsx`, `apps/web/src/features/customBlend/CustomBlendPage.tsx`, `apps/web/src/features/customBlend/CustomBlendPage.test.tsx`, `apps/web/src/features/customBlend/BlendSummaryAside.tsx`, `apps/web/src/features/customBlend/CustomBlendPreview.tsx`, `apps/web/src/features/customBlend/CustomBlendPreview.test.tsx`, `apps/web/src/features/customBlend/IngredientPicker.tsx`, `apps/web/src/features/customBlend/RatioEditor.tsx`
- reads: `apps/web/src/features/customBlend/useCustomBlendEvaluation.ts` -> reviewed state interface
- reads: `packages/localisation/src/messages/customBlend.ts` -> reviewed message keys
- acceptance: only eligible bases shown; ingredients follow server list; current successful evaluation gates submit; preview shows server result safety/current component price
- non-goals: cart/checkout/order components, CSS redesign
- upstream inputs: `P3` -> messages; `P10` -> client/hook
- changes:
  - replace general-product base loading with server base endpoint
  - preserve search/category, stale-request, loading/empty/error accessibility
  - request evaluation for structurally valid draft/current quantity
  - invalidate submit immediately on edit; show evaluation progress/error
  - pass resolved result to preview/summary
  - show result classification, component lines, current material total, one fee, total
  - submit evaluated quantity for create; preserve locked quantity for edit
  - find authoritative returned config key without trusting draft key
- invariants: no matrix/cap/tier/money recomputation; no stale verdict submission; sold-out ingredients remain selectable
- relevant evidence: `E-P3-LOCALISATION`, `E-P10-WEB-STATE`
- test duty: `E-P11-CONFIGURATOR` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend/BasePicker.test.tsx src/features/customBlend/CustomBlendPage.test.tsx src/features/customBlend/CustomBlendPreview.test.tsx`
- verification: React tests cover base exclusion, cross-group options, cap error, non-food result, loading gate, exact evaluated quantity, stale response
- handoff: reviewed configurator behavior
- review: `R11` -> `GR11`; blocks `G4`

### P12: Cart, Checkout, Order, and Packaging Disclosure

- mode: parallel with `P10 -> P11` after `G3`
- depends on: `P3`, `P7`, `P8`, `P9`, `GR3`, `GR7`, `GR8`, `GR9`, `G3`
- owns: `apps/web/src/features/customBlend/CustomBlendPackaging.tsx`, `apps/web/src/features/customBlend/CustomBlendPackaging.test.tsx`, `apps/web/src/components/CartLineItem.tsx`, `apps/web/src/components/CartLineItem.test.tsx`, `apps/web/src/features/checkout/CheckoutSummary.tsx`, `apps/web/src/features/checkout/CheckoutPage.summaryPromo.test.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/features/orders/OrderPages.test.tsx`, `apps/web/src/features/checkout/checkoutLocalisation.test.ts`
- reads: `packages/contracts/src/customBlends.ts` -> resolved/legacy narrowing
- reads: `packages/localisation/src/messages/{customBlend,cart,checkout,orderLifecycle}.ts` -> reviewed keys
- acceptance: every current resolved blend shows server result classification and exact component/fee totals; legacy order stays neutral and readable
- non-goals: order workflow, promo calculation, generic product packaging redesign
- upstream inputs: `P3` -> messages; `P7` -> cart outcome; `P8` -> order outcome
- changes:
  - drive packaging safety treatment from result classification
  - show localised `Not for consumption` on non-food resolved blends
  - render server component weights, tier discounts, contribution totals, fee
  - omit misleading aggregate tier progress
  - preserve dual display/GBP settlement rendering
  - add safe legacy fallback without inferring food safety or current prices
- invariants: render-only money; no conversion at settlement; no component price/classification calculation
- relevant evidence: `E-P3-LOCALISATION`, `E-P7-CART`, `E-P8-CHECKOUT-ORDER`
- test duty: `E-P12-DISCLOSURE` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/web -- vitest run --configLoader runner src/components/CartLineItem.test.tsx src/features/customBlend/CustomBlendPackaging.test.tsx src/features/checkout/CheckoutPage.summaryPromo.test.tsx src/features/orders/OrderPages.test.tsx`
- verification: React tests cover safety warning, component breakdown, fee once, dual money, legacy fallback, accessible labels
- handoff: reviewed downstream disclosure lane
- review: `R12` -> `GR12`; blocks `G4`

### S1: Cross-Slice Convergence and Regression

- mode: sequential after `G4`
- depends on: `P11`, `P12`, `GR11`, `GR12`, `G4`
- owns: `apps/web/src/features/customBlend/CustomBlendReachability.integration.test.tsx`, proposed `apps/api/test/customBlend/customBlendRulesJourney.integration.test.ts`, convergence-only fixes to shared composition paths after orchestrator ownership directive
- reads: `apps/api/src/app.ts` -> shared resolver identity/composition
- reads: cart/checkout/order/web reviewed change sets -> end-to-end invariant fan-in
- acceptance: one seeded journey proves mixed-group evaluation -> cart -> V9 checkout -> immutable order; legacy/reorder/export regressions pass; no forbidden scope
- non-goals: browser session, screenshot, manual click-through, expansion 2, docs/demo tasks
- upstream inputs: accepted handoffs from `P1`-`P12`; only reviewed change sets
- changes:
  - add API journey with test-owned cart/email/idempotency key
  - extend React reachability for server bases/evaluation/non-food/current totals
  - reconcile only cross-lane type/fixture mismatches
  - verify no frontend matrix/cap/pricing implementation through focused source assertion where useful
  - inspect migration index remains head `034`
- invariants: no global seeded count assumptions; no live browser; source checkout untouched
- relevant evidence: all valid packet evidence IDs at accepted change sets
- test duty: `E-S1-API-JOURNEY` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/api -- tsx --test test/customBlend/customBlendRulesJourney.integration.test.ts`
- test duty: `E-S1-WEB-JOURNEY` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/customBlend/CustomBlendReachability.integration.test.tsx`
- verification: both integration commands pass; cross-lane fixture contracts validated
- handoff: final converged change set + evidence ledger
- review: `R13` -> `GR13`; blocks `G5`

## Review Assignments

Common fields for every `R1`-`R13`:

- method: set `review_skill=code-reviewer`; explicitly invoke `.claude/skills/code-reviewer`; apply critical/high severity gate and verification-before-reporting duty
- consolidation reason: none; one reviewer targets one implementation packet
- write policy: inspect-only; allowed writes `[]`
- test policy: assess supplied relevant evidence; do not rerun valid commands; run assigned command only when stale/missing evidence blocks verdict
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment
- target state: exact settled packet change set recorded in checkpoint; never moving worktree state

### R1: Review P1 Contracts

- target: `P1` exact settled change set
- timing: after `P1`; before `P3`, `P4`, `P5`
- blocks: `GR1`
- reads: P1 owned paths + `packages/contracts/src/pricing.ts`
- acceptance: strict legacy/resolved unions, safe bounds, exact pairing, append-only errors
- invariants: legacy orders/config key/plain lines unchanged
- risk focus: permissive unions, unsafe numbers, mismatched money accepted
- non-goals: domain behavior
- relevant evidence: `E-P1-CONTRACTS`

### R2: Review P2 Pricing Primitives

- target: `P2` exact settled change set
- timing: after `P2`; before `P5`
- blocks: `GR2`
- reads: P2 owned paths
- acceptance: ordinary characterization stable; gram tiers and half-up safe
- invariants: highest-only tiers, no compounding, integer pence
- risk focus: boundary/overflow/regression
- non-goals: blend policy
- relevant evidence: `E-P2-PRICING`

### R3: Review P3 Localisation

- target: `P3` exact settled change set
- timing: after `P3`; before API/web consumers
- blocks: `GR3`
- reads: P3 owned paths + new public errors
- acceptance: seven-country completeness, safe interpolation, no raw business copy gaps
- invariants: message parameter parity
- risk focus: missing locale, wrong metadata key
- non-goals: translation style polish below high severity
- relevant evidence: `E-P3-LOCALISATION`

### R4: Review P4 Quote V9

- target: `P4` exact settled change set
- timing: after `P4`; before `P8`
- blocks: `GR4`
- reads: P4 owned paths + resolved snapshot schema
- acceptance: V8 read support, V9 strict write shape, unknown versions rejected
- invariants: prepared V8 intent compatibility
- risk focus: replay loss, permissive configured pair
- non-goals: checkout implementation
- relevant evidence: `E-P4-QUOTE-CONTRACTS`

### R5: Review P5 Domain Rules

- target: `P5` exact settled change set
- timing: after `P5`; before `P6`
- blocks: `GR5`
- reads: P5 owned paths + approved decision section
- acceptance: matrix/cap/classification/formula exact
- invariants: no aggregate tier, no float money, config hash unchanged
- risk focus: directional-pair inversion, per-pigment cap, double rounding/discount
- non-goals: repository/HTTP
- relevant evidence: `E-P5-RULES`

### R6: Review P6 Resolver

- target: `P6` exact settled change set
- timing: after `P6`; before cart/checkout/API consumers
- blocks: `GR6`
- reads: P6 owned paths + domain rules + clearance rules
- acceptance: one authority, live re-resolution, bound SQL, deterministic clock
- invariants: persisted outcome distrusted, stable ordering, stock-neutral ingredients
- risk focus: SQL rule duplication, stale price/classification trust
- non-goals: cart transaction behavior
- relevant evidence: `E-P6-RESOLVER`

### R7: Review P7 Cart/Reorder

- target: `P7` exact settled change set
- timing: after `P7`; before checkout/web
- blocks: `GR7`
- reads: P7 owned paths + resolver interface
- acceptance: exact totals, quantity repricing, legacy reorder, ordinary regression
- invariants: transaction/audit/config identity/base inventory
- risk focus: aggregate tier leak, stale derived persistence, fee multiplication
- non-goals: UI
- relevant evidence: `E-P7-CART`

### R8: Review P8 Checkout/Order

- target: `P8` exact settled change set
- timing: after `P8`; before API/web consumers
- blocks: `GR8`
- reads: P8 owned paths + V8/V9 contracts + payment repository
- acceptance: pre-gateway revalidation, V8 compatibility, V9 immutable result
- invariants: idempotency, rollback, fee/promo boundary, GBP pence
- risk focus: charge before validation, replay break, base classification leak
- non-goals: trade credit/invoice
- relevant evidence: `E-P8-CHECKOUT-ORDER`

### R9: Review P9 API Composition

- target: `P9` exact settled change set
- timing: after `P9`; before web launch
- blocks: `GR9`, `G3`
- reads: P9 owned paths + public errors + resolver/cart/checkout interfaces
- acceptance: shared instance wiring, strict endpoints, safe errors, no side effects in evaluation
- invariants: no exception prose, no duplicate matrix
- risk focus: divergent resolver instances, route/schema mismatch, unsafe metadata
- non-goals: React
- relevant evidence: `E-P9-API`

### R10: Review P10 Web Evaluation State

- target: `P10` exact settled change set
- timing: after `P10`; before `P11`
- blocks: `GR10`
- reads: P10 owned paths + endpoint contracts
- acceptance: stale/abort/debounce correctness; business rules absent from web
- invariants: verdict keyed to exact request
- risk focus: stale valid verdict enabling submit, server prose rendering
- non-goals: layout
- relevant evidence: `E-P10-WEB-STATE`

### R11: Review P11 Configurator

- target: `P11` exact settled change set
- timing: after `P11`; before `G4`
- blocks: `GR11`
- reads: P11 owned paths + reviewed hook/messages
- acceptance: eligible bases, server verdict gate, evaluation rendering, accessible async states
- invariants: no client matrix/cap/money
- risk focus: submit during stale/loading/error state, wrong edit quantity
- non-goals: downstream order/cart views
- relevant evidence: `E-P11-CONFIGURATOR`

### R12: Review P12 Disclosure

- target: `P12` exact settled change set
- timing: after `P12`; before `G4`
- blocks: `GR12`
- reads: P12 owned paths + resolved/legacy schemas
- acceptance: server result rendered consistently; legacy fallback safe
- invariants: display conversion only; no local money/classification derivation
- risk focus: food-safe presentation for contaminated blend, fee/component double display
- non-goals: checkout calculation
- relevant evidence: `E-P12-DISCLOSURE`

### R13: Review S1 Convergence

- target: `S1` exact settled change set
- timing: after `S1`; before final verification
- blocks: `GR13`, `G5`
- reads: exact S1 change set + accepted interface summaries + journey tests
- acceptance: cross-slice invariants hold; no unreviewed shared-source drift; evidence current
- invariants: matrix/cap authority API-only; V9/order immutable; head `034`
- risk focus: integration bypass, fixture-only pass, forbidden-scope changes
- non-goals: medium/low findings, human browser smoke
- relevant evidence: `E-S1-API-JOURNEY`, `E-S1-WEB-JOURNEY`, accepted packet evidence

## Review Finding Flow

- reviewer finding -> stable ID + critical/high only
- orchestrator -> fresh worker full `worker_assignment_v1` at incremented revision
- orchestrator -> `orchestrator_directive_v1` action `fix`, exact finding IDs/facts/paths/current change set/verification delta
- fix worker -> smallest affected automated command
- orchestrator -> close finding from targeted evidence; no reviewer loop
- downstream launch waits until every blocking review gate closes

## Ownership and Collision Rules

- `packages/contracts/src/customBlends.ts`, `cart.ts`, `orders.ts`, `publicErrors.ts`: `P1` only
- `packages/contracts/src/payments.ts`: `P4` only after reviewed P1 input
- `apps/api/src/features/pricing/pricingRules.ts`: `P2` only
- `apps/api/src/features/customBlend/customBlendRules.ts`: `P5` only
- custom resolver/repository: `P6` only
- custom service: `P6` initial resolver adoption -> `P9` endpoint extension; strict sequence after `GR6`
- cart repository: `P7` stops cart consumption -> `P8` removes checkout-obsolete method; strict sequence after `GR7`
- cart service/bulk paths: `P7` only
- checkout/order paths: `P8` only
- route paths: `P9` only
- composition: `P6` creates resolver/custom service -> `P7` injects cart -> `P8` injects checkout -> `P9` registers final endpoint surface; strict reviewed sequence, never parallel
- localisation catalogs: `P3` only; web lanes read only
- web state/client: `P10` only
- configurator components: `P11` only
- downstream disclosure components: `P12` only
- integration paths: `S1` only; earlier packets use their focused files
- sequential revisits: only orchestrator-issued finding fix or S1 convergence ownership directive
- migration versions: none reserved; migration index must remain head `034`
- final composition authority: `P9`; preceding sequential edits limited to packet dependency wiring required for focused evidence
- parallel web lanes: disjoint writes; `P11` waits for reviewed `P10`

## Harness Role Binding

- Codex: globally configured `worker` agent for packets/fixes/worker verification; globally configured `reviewer` agent for reviews
- model/reasoning: resolve from global Codex settings; plan/assignments never override
- non-Codex: use harness-native worker/reviewer roles with same duties/contracts
- reviewer: assignment sets `review_skill=code-reviewer`; reviewer explicitly invokes skill

## Test Execution Schedule

- `T0`: `G0` -> Node 22, `npm ci`, tsx health, API typecheck
- `T1`: `P1` -> full contracts
- `T2`: `P2` -> pricing unit
- `T3`: `P3` -> localisation guard/package
- `T4`: `P4` -> full contracts after V9
- `T5`: `P5` -> blend rules unit
- `T6`: `P6` -> resolver unit
- `T7`: `P7` -> cart/reorder integration
- `T8`: `P8` -> checkout/order/payment-intent integration
- `T9`: `P9` -> base/options/evaluation route integration
- `T10`: `P10` -> web state/hook unit
- `T11`: `P11` -> configurator React unit
- `T12`: `P12` -> disclosure React unit
- `T13`: `S1` -> API + React integration journeys
- `T14`: `G5` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm run reset`
- `T15`: `G5` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH; npm run verify`
- policy: automated commands only; no browser, screenshot, click-through, console/network inspection
- reuse: valid evidence reused when exact change set covered and no invalidator changed
- reviewer: assess supplied evidence; no duplicate run unless stale/missing evidence blocks verdict
- invalidation: contract changes -> dependent API/web evidence; pricing/rules/resolver changes -> cart/checkout/API evidence; localisation changes -> web + guard; cart outcome changes -> checkout/order/UI; checkout quote/finalizer changes -> payment/order; React state changes -> configurator integration; dependency/config changes -> all relevant evidence

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every orchestrator/subagent message and JSON string value
- transport: one inline canonical JSON object; no free-text wrapper
- runtime boundary: saved plan -> fresh orchestrator -> fresh/minimal subagent context
- assignment projection: packet objective, acceptance, owned paths, focused reads, invariants, accepted inputs, relevant evidence, non-goals, worktree identity
- exclude: full plan, source handoff, prior reports, transcript, global ledger, closed findings, unrelated state
- worker assignment: `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json` -> `worker_assignment_v1`
- reviewer assignment: `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-assignment.json` -> `reviewer_assignment_v1`
- directive: `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-directive.json` -> `orchestrator_directive_v1`
- worker report: `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-report.json` -> `worker_report_v1`
- reviewer report: `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-report.json` -> `reviewer_report_v1`
- recovery: `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-run-state.json` -> `orchestrator_run_state_v1`
- non-empty records: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- state path: run-scoped `C:\wt\orchestrator\<run-id>\state.json` or approved platform temp descendant; atomic replace; never repository
- checkpoint updates: accepted report, directive, finding transition, decision, handoff, evidence invalidation
- artifacts: bulky logs only; include summary/path/format/SHA-256 in inline report

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh runtime orchestrator; load plan, source/worktree repository instructions, canonical communication contracts.
3. Record source branch/HEAD; validate source status; create one worktree under `C:\wt`.
4. Run `G0`; persist worktree + source identities.
5. Launch `P1 || P2` with fresh minimal contexts.
6. Review each settled producer; close findings; validate `G1`.
7. Launch `P3 || P4 || P5`; review each; close findings; validate `G2`.
8. Run/review `P6 -> P7 -> P8 -> P9`; never launch consumer before preceding review gate.
9. Validate `G3`.
10. Launch `P10 || P12`; after `GR10`, launch `P11` while P12 may continue.
11. Review both web lanes; validate `G4`.
12. Run/review `S1`; close findings.
13. Run `G5` reset + full verify once on final settled change set.
14. Leave worktree/branch intact; report identities and user-owned merge.

## Risks and Open Questions

- risk: catalog descriptions mention pigment use with concrete, but approved matrix forbids `cementitious-materials` + `pigments` -> mitigation: encode approved decision verbatim; pure test prevents inference from catalog copy
- risk: catalog contains no `theatrical-effects` products -> mitigation: pure matrix tests cover dormant group; no seed padding
- risk: V8 prepared intent exists during upgrade -> mitigation: retain V8 parser/finalizer; new writer only V9
- risk: cart stored outcome becomes stale after quantity/price/classification change -> mitigation: persist spec only; resolver ignores stored derived facts
- risk: component subtotal rounding drift -> mitigation: single half-up unit-contribution formula + `subtotal = unitContribution * quantity`; schema/tests enforce sums
- risk: evaluation response races slider/base/country edits -> mitigation: synchronous invalidation + request identity + abort + stale response tests
- risk: customer sees no result during evaluation -> mitigation: explicit localised pending state; submit disabled
- risk: base-only inventory under-represents physical ingredients -> accepted non-goal for made-to-order placeholder; revisit only under separate inventory scope
- risk: human visual nuance not covered -> optional user-owned 1080p smoke after implementation; never gate/evidence duty
- assumption: active clearance applies independently to every component before tier discount -> orchestrator validates against approved target design at `G0`
- assumption: promo category remains base product category while material discount base includes all component contributions -> orchestrator validates at `G0`

## Done Criteria

- approved matrix controls base list, option list, evaluation, mutation, cart rehydrate, reorder, checkout
- combined pigment >10% returns exact coded error; <=10% succeeds
- non-food/caution component yields whole-blend `non-food` and visible localised warning
- component weights independently select highest qualifying tier; aggregate blend never re-enters ladder
- active clearance + tier + fee totals use safe integer pence and freeze in V9/order
- current carts reprice/reclassify live; historic V8 intent and legacy order remain readable/finalizable
- ordinary cart/payment/order behavior unchanged
- no SQL migration; head remains `034`; foreign-key/schema behavior unchanged
- frontend contains no compatibility matrix, pigment-cap arithmetic, classification propagation, or component pricing formula
- base/configurator/cart/checkout/order automated tests pass
- `npm run reset` passes
- `npm run verify` passes
- expansion 2, docs corpus, demo tasks, stale-pointer repair absent
- implementation branch/worktree retained; user receives merge ownership
