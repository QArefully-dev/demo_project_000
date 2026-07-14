# Powderizer Expansion Plan: Domain and Data

Status: pending

Audience: orchestrator agent, implementation agents

Companion: `plans/powderizer_expansion_experience_plan.md`

## Outcome

Expand Powderizer from consumable-only mixer into all-catalog mixer. Preserve server-authoritative pricing, stock, cart, checkout, payment, order, and safety behavior.

Data flow:

`catalog -> shared contracts -> domain rules -> repository -> service -> HTTP route -> cart -> checkout revalidation -> immutable order snapshot`

## Scope

- Make all 50 canonical products mixable.
- Rename existing display names to `Campfire`, `House`, `Internet`; preserve IDs, slugs, artwork IDs.
- Add `Boat`, `Plane`, `MacBook Pro`, `Moon Rock`, `Diamond`.
- Return category-filter-ready Powderizer config.
- Add Powderizer-only bag colour scheme.
- Add server-provided daily recipe.
- Preserve stable-slug reaction inputs for companion plan.
- Derive non-consumption status from canonical product warnings.
- Preserve existing component count, ratio, allocation, stock, promo, checkout, payment, and idempotency rules.

Non-scope:

- Randomized mixing copy.
- User-created products.
- Medical, nutritional, legal, or performance claims.
- Browser-local history; owned by companion plan.
- New commerce subsystem.
- LOC padding or speculative framework work.

## Architecture Rules

- Dependency direction: `catalog/contracts -> pure domain -> repository -> service -> route`.
- Catalog package owns canonical product metadata and source-unit derivation.
- Contracts package owns transport schemas, enums, error unions, snapshot versions. Export one definition per concept; no copied string unions.
- Pure domain module owns normalization, validation, quote identity, price allocation, usage-label derivation. No database, HTTP, clock, or global state access.
- Repository owns SQL and row parsing only. Reject corrupt persisted enum/version data at boundary.
- Service owns use-case orchestration, canonical lookups, injected date source, transaction boundaries.
- Route owns request parsing and HTTP status mapping only. No pricing or safety logic.
- Client input never supplies derived `usageLabel`, price, allocation, stock requirement, or recipe validity.
- Validate untrusted input at HTTP, JSON snapshot, and database hydration boundaries. Keep strict parsers; no `as` casts replacing validation.
- Additive compatibility explicit through versioned parsers and normalization. Never weaken old parser to accept unknown fields silently.
- Keep names clear and feature-local. Extract shared helper only after repeated semantics, not repeated syntax.
- Keep functions small, deterministic where possible, and single-purpose. Inject clock. Avoid hidden mutation and module-level mutable state.
- Preserve integer cents, positive integer grams, positive integer ratios, safe-integer checks, transactional stock updates, payment idempotency.
- Migration forward-only, deterministic, transactional where supported, tested from fresh and migration `008` states.
- Tests follow ownership: pure rule tests near domain module; schema tests in contracts; SQL/migration tests at repository boundary; lifecycle tests through API.
- Each behavior gets one primary test level. Add cross-layer test only for boundary wiring or regression risk.
- No unrelated refactors. Preserve user worktree changes.

## Orchestrator Execution

Required graph:

`Phase 0 -> (Phase 1 || Phase 2) -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> companion plan`

Parallel rules:

- Phase 0: sequence-only audit. No implementation edits.
- Phases 1 and 2: only parallel domain phases. Phase 1 owns catalog and catalog tests. Phase 2 owns contracts, pure rules, and corresponding tests.
- Phase 3: starts after Phase 1 and Phase 2 gates. Requires settled catalog metadata and contract enum/schema.
- Phase 4: starts after Phase 3 gate. Service integration requires migrated repository surface.
- Phase 5: starts after Phase 4 gate. Purchase lifecycle consumes finalized quote/config behavior.
- Phase 6: starts after Phase 5 gate. No feature edits except verification fixes.
- Companion experience work: starts only after Phase 6 gate.

Agent rules:

- Assign one owner per file per wave. Shared test or barrel file -> one integration owner.
- Parallel agents must not edit outside assigned file set without orchestrator approval.
- Before parallel wave: freeze shared interfaces and expected exports.
- After parallel wave: merge both results, inspect diff, run combined typecheck plus focused tests, resolve duplication, then advance gate.
- Failed gate blocks dependants. Document unrelated baseline failure; never relabel new failure as baseline.
- Commit boundary recommendation: one commit per phase after gate passes. Do not require commits when repository workflow says otherwise.

## Baseline

- Canonical catalog: 45 products, IDs `1-45`, seven categories.
- Mixable set: 19 products from `Pantry Staples`, `Performance`, `Drinks`.
- Powderizer schema: migration `008`.
- Mix config: 2-5 unique products, integer ratios totaling 100, three bag sizes, three fineness values, optional label.
- Price: component prorating plus packaging fee under `powderizer-v1`.
- Stock: source-bag equivalents from `mix_unit_grams`.
- Cart/order transport: additive `mixItems` arrays.
- Bag preview: hardcoded consumable label and brown palette.
- Previous plan status: Phases 0-9 complete, Phase 10 pending. Verify; never assume clean baseline.

## Locked Domain Decisions

### Catalog

Existing renames:

- ID `27`: `Powdered Campfire` -> `Campfire`.
- ID `33`: `Powdered House` -> `House`.
- ID `34`: `Powdered Wi-Fi` -> `Internet`.

New products:

- ID `46`, `Boat`: category `Questionable`; price `89995`; stock `8`; slug/artwork `boat`; conceptual quantity; mark `BT`; batch `QUE-07`.
- ID `47`, `Plane`: category `Questionable`; price `249995`; stock `4`; slug/artwork `plane`; conceptual quantity; mark `PL`; batch `QUE-08`.
- ID `48`, `MacBook Pro`: category `Questionable`; price `199999`; stock `6`; slug/artwork `macbook-pro`; conceptual quantity; mark `MBP`; batch `QUE-09`.
- ID `49`, `Moon Rock`: category `Impossible`; price `2500000`; stock `1`; slug/artwork `moon-rock`; conceptual quantity; mark `MR`; batch `IMP-08`.
- ID `50`, `Diamond`: category `Questionable`; price `499999`; stock `3`; slug/artwork `diamond`; conceptual quantity; mark `D`; batch `QUE-10`.

Metadata rules:

- Prices: integer cents.
- Descriptions: original dry catalogue voice.
- New names: no `Powdered` prefix.
- `newest_rank`: unique `46-50`.
- `sales_count`: unique low non-zero values.
- `compare_at_price_cents`: `null`; preserve sale-count invariant.
- Packaging colours: unique enough for mix visualization.

### Eligibility and Source Units

- Canonical product -> `mixable: true`.
- `100g`-style package -> parsed positive integer grams.
- `1kg`-style package -> grams via exact `kg * 1000` conversion.
- `conceptual quantity` -> synthetic `1000g` source unit.
- Persisted `mixable` remains operational kill switch.
- Missing product, disabled row, null unit, non-positive unit -> `MIX_COMPONENT_INELIGIBLE`.
- No category allowlist or consumability coupling.
- Stock reservation retains source-bag-equivalent formula.
- Price formula and `powderizer-v1` remain unchanged.

### Safety

Mixability != consumability.

- All selected warnings null -> `Consumable powder`.
- Any selected warning `Not for consumption` -> `Not for consumption`.
- Server derives label from current canonical product data during quote and checkout.
- Quote, cart, checkout quote, new order snapshot, and API order item expose label.
- Client input cannot submit label.
- Legacy snapshot without label -> `Check ingredient labels`.

### Bag Colour Scheme

Contract enum:

- `ultraviolet-cyan`: default; ultraviolet/cyan gradient.
- `solar-flare`: orange/coral/gold.
- `deep-space`: navy/violet/cyan.
- `acid-lilac`: lime/lilac/charcoal.
- `monochrome-glitch`: black/silver/electric blue.

Rules:

- Scheme belongs to Powderizer only; standard product controls unchanged.
- Scheme changes quote identity, not price.
- Input field optional for backward compatibility; normalization defaults `ultraviolet-cyan`.
- Normalized config, quote, cart item, checkout quote, new snapshot require scheme.
- Unknown scheme -> `MIX_BAG_COLOUR_INVALID`.

### Daily Recipe

Endpoint: `GET /api/powderizer/config`.

Response:

- `effectiveDate`: UTC `YYYY-MM-DD`.
- `name`: fixed preset name.
- `config`: normalized valid mix config including scheme.

Rotation: UTC epoch-day modulo preset count. Resolve by stable slug, never name or database ID.

Presets:

- `Literal Housewarming`: `powdered-house` + `powdered-campfire`; `50/50`.
- `Working From Anywhere`: `macbook-pro` + `powdered-wifi` + `plane`; `34/33/33`.
- `Lunar Luxury`: `moon-rock` + `diamond`; `50/50`.
- `Open Water`: `boat` + `powdered-water`; `50/50`.
- `Heavy Landing`: `plane` + `powdered-gravity` + `moon-rock`; `34/33/33`.
- `Quiet Connection`: `powdered-wifi` + `powdered-silence`; `50/50`.
- `Weekend Project`: `powdered-house` + `powdered-weekend` + `diamond`; `34/33/33`.

Service rules:

- Inject UTC date provider.
- Validate selected preset through normal domain validator.
- Seed/config mismatch -> startup/test failure; never return broken recipe.
- Config request -> no cart mutation or database write.

### Snapshot Compatibility

- Migration `009`: add active-mix scheme with default.
- New order mix snapshot: version `2`; store scheme and usage label.
- Order parser: accept v1 and v2; output version `1 | 2`.
- V1 normalization: scheme `ultraviolet-cyan`; label `Check ingredient labels`.
- Checkout persisted quote: keep version `2` only when strict parser permits explicit optional additions. Otherwise add version `3`, accept `1 | 2 | 3`, write `3` only. Never loosen strict parsing.

## Phase 0 - Audit and Regression Baseline

Goal: establish reproducible start.

Tasks:

- Read `CLAUDE.md`, both plans, package scripts.
- Run `git status --short`; inspect overlapping diffs and migration list.
- Preserve unrelated changes. Known changes: `CLAUDE.md`, `apps/api/src/app.ts`.
- Run `npm run format`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`.
- Record command, exit code, failing test, and failure text for every baseline failure.
- Confirm catalog count, mixable count, migration state, seed state.
- Inspect current create, edit, cart, checkout, confirmation through loopback HTTP.

Gate:

- Baseline evidence recorded.
- Existing end-to-end path passes or failures classified with evidence.
- No implementation edits made.

## Phase 1 - Catalog Expansion and Eligibility

Goal: produce validated 50-product, all-mixable catalog.

Files:

- `packages/catalog/src/model.ts`
- `packages/catalog/src/categories/outdoors.ts`
- `packages/catalog/src/categories/questionable.ts`
- `packages/catalog/src/categories/impossible.ts`
- `packages/catalog/src/validateCatalog.ts`
- `packages/catalog/src/catalog.test.ts`
- `apps/api/src/db/powderCatalog.test.ts`
- seed-focused integration tests assigned by orchestrator

Tasks:

- Implement explicit quantity parser for grams, kilograms, conceptual quantity.
- Apply locked renames and new products.
- Mark 50 canonical products mixable.
- Remove category eligibility and non-consumable prohibition.
- Retain warning requirement for non-consumable categories.
- Require positive integer source grams for every mixable canonical product.
- Preserve seven categories, sale-product count, Powdered Water bestseller invariant.
- Ensure seed upsert refreshes canonical names and eligibility by stable ID.

Tests:

- Counts: 50 products, 50 mixable.
- Every category represented.
- `100g`, `1kg`, conceptual conversions exact; malformed units rejected.
- Existing IDs, slugs, artwork IDs stable.
- Premium prices safe integer cents; Moon Rock highest.
- Repeated seed stable; database has 50 eligible canonical rows.

Gate: catalog validation and focused tests pass; fresh/existing seed metadata match.

## Phase 2 - Contracts and Pure Rules

Goal: extend typed domain surface without trusting presentation data.

Files:

- `packages/contracts/src/powderizer.ts`
- `packages/contracts/src/cart.ts`
- `packages/contracts/src/orders.ts`
- `packages/contracts/src/payments.ts`
- `packages/contracts/test/transport-contracts.test.ts`
- `apps/api/src/features/powderizer/powderizerTypes.ts`
- `apps/api/src/features/powderizer/powderMixRules.ts`
- `apps/api/src/features/powderizer/powderMixRules.test.ts`

Tasks:

- Add shared `PowderMixBagColourScheme` definition and exported default.
- Accept optional input scheme; require normalized/output scheme.
- Add server-derived `usageLabel` to current quote/item schemas only.
- Add `MIX_BAG_COLOUR_INVALID` to error schemas.
- Add daily-recipe config schema.
- Add order snapshot version union and explicit v1/v2 parsers.
- Include scheme in canonical quote key.
- Keep scheme and usage label outside allocation/pricing inputs.

Tests:

- Missing scheme defaults; five values accepted; unknown value rejected.
- Scheme changes identity, never price.
- Warning sets derive both usage-label outcomes.
- Allocation, price, custom label, stock behavior unchanged.
- V1 and v2 snapshots validate and normalize explicitly.
- Input schema rejects client-supplied derived fields.

Gate: contracts build; pure tests cover each new branch; no duplicated enum or normalization logic.

## Phase 3 - Migration, Repository, and Seed

Goal: persist scheme without breaking migration `008` mixes.

Files:

- `apps/api/src/db/migrations/009_powderizer_expansion.ts`
- `apps/api/src/db/migrations/index.ts`
- `apps/api/src/db/reset.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/features/powderizer/powderMixRepository.ts`
- `apps/api/test/db/migrations.integration.test.ts`
- `apps/api/test/db/seed.integration.test.ts`

Tasks:

- Add `powder_mixes.bag_colour_scheme TEXT NOT NULL DEFAULT 'ultraviolet-cyan'`.
- Add check constraint when supported by safe SQLite additive migration; otherwise enforce enum in repository parser/write path.
- Avoid cart/order table rebuild unless required; any rebuild must run transactionally and preserve all rows/indexes/foreign keys.
- Register migration `009`; update reset expectations.
- Include scheme in insert, update, hydrate, and requote reads.
- Keep order data in versioned JSON; add no order column.
- Seed 50 canonical products and eligibility metadata.
- Preserve non-canonical rows and their `mixable` values.

Tests:

- Fresh database and `008 -> 009` upgrade.
- V1 active mix preserved with default scheme.
- Invalid persisted scheme rejected at repository boundary.
- Repeat reset/seed stable.
- Cart cascade and stock reservation unchanged.

Gate: migration, repository, seed tests pass; old active mixes remain editable.

## Phase 4 - Service Config, Quote, and Daily Recipe

Goal: expose complete config and deterministic safe quotes.

Files:

- `apps/api/src/features/catalog/productRepository.ts`
- `apps/api/src/features/powderizer/powderizerService.ts`
- `apps/api/src/features/powderizer/dailyRecipe.ts`
- `apps/api/src/routes/powderizer.ts`
- `apps/api/src/app.ts`
- `apps/api/test/powderizer/powderizer.integration.test.ts`

Tasks:

- Return 50 eligible products in deterministic category/name or stable-ID order.
- Include packaging colours, five schemes, default scheme, daily recipe.
- Derive usage label for every quote through pure domain rule.
- Inject UTC date provider through service factory.
- Resolve preset slugs against eligible repository rows.
- Keep config and quote read-only.
- Remove consumable-only route assumptions.
- Map `MIX_BAG_COLOUR_INVALID` to HTTP 400 through centralized error mapping.

Tests:

- Config shape, 50 products, seven categories, five schemes, default.
- Fixed dates select expected preset; each preset passes normal quote validation.
- House + Campfire returns non-consumption label.
- Moon Rock affects exact total without overflow.
- Disabled row stays ineligible.
- Config/quote make no writes.

Gate: API integration proves each category mixable; anonymous quote path remains valid.

## Phase 5 - Cart, Checkout, and Order Compatibility

Goal: carry scheme and safety through purchase lifecycle once.

Files:

- `apps/api/src/features/cart/cartService.ts`
- `apps/api/src/features/checkout/checkoutTypes.ts`
- `apps/api/src/features/checkout/checkoutQuote.ts`
- `apps/api/src/features/checkout/checkoutService.ts`
- `apps/api/src/features/checkout/checkoutFinalizer.ts`
- `apps/api/src/features/checkout/orderRepository.ts`
- `apps/api/src/features/powderizer/powderMixRepository.ts`
- cart, checkout, Powderizer integration tests assigned by orchestrator

Tasks:

- Return scheme and current usage label in cart mix items.
- Recompute usage label and quote during checkout from canonical products.
- Route scheme mismatch/missing normalized data through strict requote behavior.
- Persist v2 order snapshot with scheme and checkout-time usage label.
- Parse v1 through compatibility normalizer.
- Preserve stock aggregation, promo, payment idempotency, transaction boundaries.
- Assert premium totals remain SQLite-integer and JavaScript-safe integers.

Tests:

- Create/edit/requote round-trip scheme.
- Legacy active mix defaults scheme.
- Any unsafe ingredient yields non-consumption cart/checkout label.
- Premium checkout totals exact.
- Stale quote -> `MIX_REQUOTE_REQUIRED` before gateway call.
- V1 and v2 orders readable after later catalog metadata changes.
- Retry -> one order, one charge, one stock decrement.
- Product-only checkout unchanged.

Gate: server lifecycle preserves fields; no stale price, unsafe label, double charge, or double decrement.

## Phase 6 - Domain Verification and Handoff

Goal: freeze stable API surface for companion plan.

Tasks:

- Run focused catalog, contract, migration, Powderizer, cart, checkout tests.
- Run full repository verification command set.
- Review final diff for layer violations, duplicate constants, unsafe casts, unrelated refactors.
- Record config and quote response fixtures.
- Record checkout quote version decision.
- Confirm fixture exposes 50 eligible products, packaging colours, schemes, daily recipe, usage label.
- Update plan status only from test evidence.

Gate:

- `npm run verify` passes or unrelated failures retain Phase 0 evidence.
- Domain contract frozen; companion plan unblocked.
- Standard catalog, product cart, checkout, payment, order behavior unchanged.
