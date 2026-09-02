# Workshop Expansion Handoff

## Context

- Repo: `QArefully Materials Exchange`, ~148k LOC, B2B bulk-materials wholesale demo. Read `AGENTS.md` first — architecture, commands, change rules authoritative there.
- Purpose of expansion: repo hosts live workshop demo -> agent harness with `docs/ai` folder + cheap subagent loading only relevant doc sections into main agent context.
- Workshop thesis: docs win when knowledge NOT derivable from code (business rules, history, cross-file invariants). Expansion must create doc-or-fail domains + scripted demo tasks with predictable no-docs failure.
- `plans/` deleted at commit `8b88c50`; `AGENTS.md` still references `plans/demo_project_high_level_plan.md` -> stale pointer, kept deliberately as doc-rot exhibit. Do not "fix" without user instruction.

## Scope

- In: expansion 1 (custom blend rules), expansion 2 (trade credit/invoicing), demo task surface preservation.
- Out: `docs/ai` corpus creation -> separate later task, skip entirely.
- Out: LOC padding, storefront rewrite, new frameworks.

## Expansion 1: custom blend rules (priority)

Status: complete. Merged 2026-09-02 on `workshop_expansion_and_tasks` at `49c0a43171b7289d2629a9840bd777ef68c92960`. Coding plan: `plans/workshop_expansion_1_coding_plan.md`.

Implemented rules:

- directional matrix:
  - `food-grade` -> `food-grade`
  - `cleaning` -> `cleaning`, `pigments`
  - `garden-treatment` -> `garden-treatment`
  - `cementitious-materials` -> `cementitious-materials`
  - `casting-materials` -> `casting-materials`, `pigments`
  - `theatrical-effects` -> `theatrical-effects`, `pigments`
  - `pigments`, `absorbents` -> never bases
  - `absorbents` -> never ingredients
- combined pigment cap: `10%` finished blend weight; exact public error `CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED` with `maxPercentage` + `actualPercentage`
- incompatible pair error: `CUSTOM_BLEND_INCOMPATIBLE`
- classification: all components `food` -> `food`; any `caution` or `non-food` -> blend `non-food`; resolved blend never returns `caution`
- pricing: each component weight resolves active clearance, then independent highest qualifying weight tier; half-up integer-pence unit contribution; no aggregate blend tier
- fee: `CUSTOM_BLEND_FEE_CENTS = 2_500` exactly once per configured line; excluded from tier and promo discount math
- identity: base variant + canonical ingredient variant IDs/percentages; derived price/classification excluded from config hash
- inventory: base variant only; ingredient reservation/depletion remains out of scope

Implemented authority and transport:

- shared constants and strict legacy/resolved schemas: `packages/contracts/src/customBlends.ts`
- pure matrix, cap, classification, component pricing: `apps/api/src/features/customBlend/customBlendRules.ts`
- live fact/rule/pricing authority: `apps/api/src/features/customBlend/customBlendResolver.ts`
- repository SQL queries candidate facts only; no compatibility matrix in SQL
- country-aware `GET /api/custom-blends/bases`, existing options route, side-effect-free `POST /api/custom-blends/evaluate`
- create, replace, cart hydration, quantity change, bulk add, reorder, checkout revalidation use shared resolver instance
- stored cart JSON contains specification only; reads distrust derived state and re-resolve live facts
- configured cart lines expose resolved component totals/classification and omit aggregate next-tier progress
- checkout validates current resolved snapshot before inventory/gateway mutation
- persisted quote writer advanced to V9; V8 parser/finalizer compatibility retained
- V9 orders freeze component prices, weights, tiers, clearance facts, result classification, and fixed fee in existing `custom_blend_json`
- no migration; head remains `034`

Implemented web behavior:

- base picker loads all eligible server pages; search/category/stale/abort handling retained
- evaluation hook: 150 ms debounce, abort + request identity, active-country binding, synchronous stale-result invalidation, same-draft retry
- duplicate ingredient IDs and base-as-ingredient blocked as structural input errors before request
- only exact current server verdict enables submit; create uses evaluated quantity, edit preserves locked cart quantity
- configurator, cart, checkout, order render server classification, component pricing, material totals, one fee, final total
- non-food resolved blends show localised `Not for consumption`
- legacy orders remain readable with neutral packaging/safety fallback
- web contains no compatibility matrix, pigment-cap arithmetic, classification propagation, tier selection, or component-price formula

Compatibility and gate repairs included in merge:

- public-error metadata narrowing fixed in bundle/cart/custom-blend routes to restore baseline API typecheck
- approved-retry stale-blend rejection persisted atomically at `failed_pre_gateway`; restored facts cannot charge same idempotency key
- configured reorder skips retain resolver-derived current price when blend remains valid
- admin jobs URL-clamp test waits for second request before mock teardown
- stale V8 and country-blocked test expectations updated to V9/current outcome

Verification at merged change set:

- `npm run reset`: pass
- `npm run verify`: pass
- localisation scan: 896 files, 0 findings
- package tests: contracts 154, catalog 36, localisation 13
- web Vitest: 129 files, 878 tests
- API integration: 453/453
- all workspace typechecks, lint, format, unit tests, integration tests, and builds: pass
- no browser verification; excluded by coding plan

## Expansion 2: trade credit / invoicing

New domain. Goal: knowledge-heavy, interlocks checkout + payments + localisation -> demo tasks here need multiple docs.

Design direction (propose detailed plan before implementing):
- credit account per company (`companyAccounts` feature exists, 5 files, thin) -> credit limit integer pence, net-30 terms, states: active | on-hold | suspended
- checkout payment method "trade credit" alongside simulated card gateway -> reuses payment-intent workflow, idempotency key semantics identical (`apps/api/src/features/checkout/checkoutService.ts` replay pattern)
- invoice generated on credit order finalization -> immutable like quote; settlement GBP pence; local currency display-only at render (hard invariant, AGENTS.md)
- VAT: per-country rate applied at invoice level, computed in pence half-up via existing `roundHalfUp`; VAT rate lives with country profiles (`packages/contracts/src/countryProfiles/`) NOT in web
- credit hold -> orders blocked when exposure exceeds limit; existing `orderApprovals` (3 files, thin) natural integration point
- migrations: append-only, forward-only, head `034` -> new heads `035+`; FK-clean; runner conventions in `apps/api/src/db/migrate.ts`

Interlocks to preserve as traps:
- `Country` identity != postal `CountryCode` (`packages/contracts/src/country.ts:5-12`, `'GB'` postal-valid, identity-invalid)
- settlement/display currency split
- retire-not-delete for rows referenced by orders

## Demo tasks (design target — expansion must keep these viable)

Each task -> maps to 1-2 future docs, has predictable no-docs failure. Do not implement tasks; implement expansion so tasks stay sharp.

- add price tier 20t/15% -> no-docs failure: edits per-qty not weight, or compounds tiers. Truth: `packages/contracts/src/pricing.ts` + `apps/api/src/features/pricing/pricingRules.ts:54` (highest qualifying tier only)
- add country IT -> no-docs failure: misses message catalogs (19 in `packages/localisation/src/messages/`), postcode pattern, `npm run check:localisation` guard, GB/UK confusion
- write integration test -> no-docs failure: filename off glob `apps/api/test/**/*.integration.test.ts` never runs; unscoped count assertions break on seeded demo orders (scope to test-owned email/requestId/idempotencyKey)
- remove feature -> no-docs failure: hard-deletes order-referenced rows or edits landed migration. Truth: retire-not-delete default, destructive drop allowed only when plan says feature gone (contrast migrations `020` vs `021`)
- new after expansion 1: add additive to blend -> no-docs failure: web-side compatibility check, aggregate re-tiering, float money
- new after expansion 2: credit checkout change -> no-docs failure: VAT in web, conversion at settlement, idempotency bypass

## Constraints (delta beyond AGENTS.md — read AGENTS.md for rest)

- Node 22 path prepend mandatory before any npm command (AGENTS.md Commands section, exact PowerShell line there)
- keep customer path simple; credit/admin surfaces outside it
- no Playwright E2E; test pyramid per AGENTS.md Quality
- browser verification -> `.claude/skills/browser-qa` only, 1080p only
- every user-facing string through localisation; `npm run check:localisation` gates
- phased delivery: propose plan -> user approval -> implement expansion 1 -> verify -> expansion 2

## Verification

- `npm run verify` green; `npm run reset` -> journey click-through for touched flows
- new domain rules covered: pure rule -> unit; repo/transaction -> SQLite integration; route -> `app.inject()`
- migrations idempotent, `PRAGMA foreign_key_check` clean
