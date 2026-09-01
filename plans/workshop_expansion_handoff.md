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

Current state: `apps/api/src/features/customBlend/` 4 files, explicit placeholder ("Custom Small Order placeholder" per AGENTS.md). Web side `apps/web/src/features/customBlend/` 22 files: base picker, additives, packaging preview.

Existing scaffolding to reuse, never rebuild:
- `packages/catalog/src/model.ts` -> `MIXING_GROUPS` (8): food-grade, cleaning, garden-treatment, cementitious-materials, casting-materials, pigments, theatrical-effects, absorbents
- `packages/catalog/src/model.ts` -> `ConsumptionClassification`: food | non-food | caution
- `packages/contracts/src/pricing.ts` -> `CUSTOM_BLEND_FEE_CENTS = 2_500`

Build blend business rules (backend-owned, doc-worthy, non-inferable from code):
- group compatibility matrix -> some `MIXING_GROUPS` pairs never mix (example direction: cementitious-materials + food-grade forbidden; pigments mix into casting/cleaning/theatrical only; absorbents mix with nothing). Exact matrix = product decision -> propose, get user sign-off before implementing.
- dosage caps -> pigments capped % of total blend weight; exceeding cap -> validation error with exact domain error code
- contamination rule -> any non-food component in blend -> whole blend `consumptionClassification` non-food, "Not for consumption" surfaces on web
- blend pricing -> component weights priced per component tier rules + `CUSTOM_BLEND_FEE_CENTS`; blend line NEVER re-enters `TIER_LADDER` as aggregate (no double discount). Integer pence only.
- blend identity -> blend = variant-scoped like everything else; cart/order lines key on variant

Rule ownership per AGENTS.md: constants -> `packages/contracts`, rules -> API domain service, web renders server verdicts only. Web must not duplicate compatibility matrix.

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
