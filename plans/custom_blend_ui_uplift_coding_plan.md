# Custom Blend UI Uplift Coding Plan

Status: complete (G3 passed, 2026-07-26)
Source: `plans/custom_blend_ui_uplift_high_level_plan.md` -> whole plan, W0.1/W0.2 + W1-W8; W0.3 excluded by user decision 2026-07-26
Repository baseline: branch `materials_exchange_refactor` @ `bb6fef9b21eae99d4611b0cb61829a4310c8b890`

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD` before any write
- create: dedicated implementation branch + worktree from recorded `HEAD`; `git worktree add -b <impl-branch> <abs-worktree-path> <source-branch>`
- blockers: detached `HEAD` -> stop, ask branch. Relevant uncommitted/untracked source changes absent from `HEAD` (baseline shows untracked `plans/custom_blend_ui_uplift_high_level_plan.md`; saved plan file also untracked) -> stop, ask user to commit or name baseline; never stash/copy/discard
- execution root: every worker, reviewer, test, fix, convergence action runs in worktree; repository-relative paths resolve under worktree root
- integration: no merge, rebase, cherry-pick, copy-back, worktree removal, branch deletion
- completion reply: absolute worktree path + implementation branch + source branch + base revision; user owns merge

## Execution Checkpoint

- worktree: `C:\Users\iwano\Desktop\repos\demo_project_000-custom-blend-ui-uplift`
- implementation branch: `codex/custom-blend-ui-uplift`
- source branch: `materials_exchange_refactor`
- actual base revision: `6edc22e1b9ffeca064aee592008b98ffe999de04`
- G0: passed — Node 22.23.1, clean `npm ci`, `tsx`, API typecheck; resolver requires later minimal input widening plus option adapter, never a cast
- accepted through G1: P1/R1 with `R1-001` fixed; P2/R2 with `R2-001` fixed; P3/R3; P4/R4. G1 passed because GR2 and GR4 passed.
- accepted after G1: P5/R5/GR5; P6/R6/GR6 (W4 ingredient selection + ratio editing, including inactive-tile disablement, selectable sold-out advisory, ratio controls, balance-evenly, gauge, focus choreography, and focused `customBlendState`, `RatioEditor`, and `IngredientPicker` coverage); P7/R7/GR7. G2 passed after GR7.
- accepted after G2: P8/R8/GR8; P9 with `R9-F1`/`R9-F2` fixed; P10 and its focused evidence.
- R10: the approved `basePresentation` exception/remediation was applied and reviewed; `R10-F1` is no longer unresolved. Historic records without the optional snapshot use the neutral fallback.
- S1 convergence and R11 review completed. Final evidence: `E22` workspace typecheck, `E23` lint, `E24` web tests, and `E25` 1080p browser journey were collected. Historical pre-G3 evidence: a prior full `npm run reset` + `npm run verify` retry passed; its first run had an isolated Checkout test flake, recorded as a first-run flake rather than an unresolved product finding.
- GR11 recheck: passed; findings closed.
- G3: passed — post-GR11 `npm run reset` then `npm run verify` completed successfully in 211.3s. Nonfatal warnings were emitted during the run; they did not fail any check or invalidate the gate.

## Approved R10 Exception (2026-07-26)

- Optional frozen `basePresentation` snapshot metadata is approved solely to preserve historic Custom Blend artwork semantics. It changes no migration, config-key hashing, price, fee, eligibility, or write rule; when legacy records lack it, use the neutral fallback.

## Objective

Raise Custom Blend from placeholder presentation to premium-industrial feature surface: real packaging artwork on option tiles, animated mix visualization, large live packaging preview, two-column configurator shell, landing banner, consistent downstream blend treatment. Domain behaviour unchanged. Complete when configurator, landing banner, and downstream surfaces render new UI at 1080p with full suite green and blend rules untouched.

## Scope

### In

- `CustomBlendOption` gains read-only presentation fields `category`, `consumptionClassification`, `categoryFacts` (W0.1 + W0.2)
- API options repository/service/mapper widened to source those fields from same catalog row
- `--custom-blend-*` token block + configurator-scoped component classes in `index.css`, light + dark + reduced-motion (W1)
- `CustomBlendPage.tsx` split into feature components, two-column shell, numbered steps, shadcn primitives, skeletons (W2)
- base selection as artwork cards with category badge + inline eligibility failure (W3)
- ingredient tiles with artwork/pigment/search/grouping; slider + numeric + stepper ratios; balance-evenly; total gauge (W4; inventory is server-authoritative, so stock count is advisory and does not make a compatible ingredient client-ineligible)
- SVG mix visualization with palette-derived segments, legend, animation (W5)
- large `CustomBlendPackaging` preview in sticky aside + click-to-zoom + success recap (W6)
- `CustomBlendBanner` on `HomePage` above bestsellers shelf (W7)
- checkout + order-detail blend tile/badge parity with cart; base percentage in composition label; token-backed made-to-order notice (W8)

### Out

- W0.3 blend price preview; any money in configurator; any client money arithmetic
- migrations, schema change, seed change, new persisted field, write-path API change
- buyer-selectable livery/scheme picker, saved blends, blend naming, localStorage history
- novelty devices: Randomize, Chaos Mix, joke copy, reaction lines, daily recipe
- changes to eligibility, MOQ, tier, fee, config-key hashing, edit-mode locks
- mobile/tablet/responsive verification; 1080p only
- populating contract `ProductPackaging`; artwork stays web-side
- Playwright E2E suites; `browser-qa` screenshots are evidence only

## Repository Findings

- existing: `packages/contracts/src/customBlends.ts:55` -> `CustomBlendOption` = `productId`, `productName`, `productDescription`, `mixingGroup`, `variant` only
- existing: `apps/api/src/features/customBlend/customBlendRepository.ts:32` -> `factColumns` selects no `p.category`, `p.consumption_classification`, `p.details_json`
- existing: `apps/api/src/features/customBlend/customBlendService.ts:50` -> `toOption(row)` builds `CatalogVariant` + option; single mapping point
- existing: `apps/api/src/mappers/product.ts` -> `parseDetailsJson(row.details_json)` -> `CategoryFacts`; `consumption_classification` mapping precedent, including `'non-food'` default in `toProductWithVariantsContract`
- existing: `apps/web/src/components/packaging/packagingSpec.ts:181` -> `resolvePackagingSpec` reads `product.category`, `product.consumptionClassification`, `product.categoryFacts`, `product.name`, `product.id`; `hasCategoryFacts` narrows on `'categoryFacts' in product`
- existing: `apps/web/src/components/packaging/catalogPackagingPalettes.ts` -> `resolveCatalogPackagingPalette` keys `(category, numeric id)`; five schemes/category
- existing: `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> correct fixed-charcoal livery + `customBlendBatchMark` + `customBlendCompositionLabel`; consumed large nowhere
- existing: `apps/web/src/components/CartLineItem.tsx:82` -> only `CustomBlendPackaging` render site
- existing: `apps/web/src/features/checkout/CheckoutSummary.tsx:77,90` and `apps/web/src/features/orders/OrderDetailView.tsx:77,108` -> blend as muted text + hardcoded amber notice, no artwork
- existing: `apps/web/src/index.css:58-70,111-118,174-191,299,320` -> `--custom-blend-*` tokens, `.custom-blend-nav-link`, `@keyframes custom-blend-iridescence`, reduced-motion block; utility classes `.content-shell:194`, `.section-eyebrow:199`, `.section-heading:207`
- existing: `apps/web/src/features/home/HomePage.tsx` -> no Custom Blend reference; `apps/web/src/components/home/BundleBanner.tsx` = full-width banner precedent (`rounded-2xl border-2`, eyebrow, headline, CTA + `ArrowRight`, hover lift)
- existing: `apps/web/src/features/customBlend/CustomBlendPage.tsx` 539 LOC -> `CustomBlendPage` + `IngredientRow` + `BasePicker` in one file; URL-owned target via `activeTargetRef`/`hydratedTargetRef`; request-id + `AbortController` staleness guards
- existing: `apps/web/src/features/customBlend/customBlendState.ts` -> reducer + `MIN/MAX_INGREDIENT_PERCENTAGE` (5/50), `MAX_INGREDIENTS` 4, `derivedBasePercentage`, `customBlendValidation`
- existing: `CustomBlendOption` consumers -> `packages/contracts/src/customBlends.ts`, `apps/api/src/features/customBlend/customBlendService.ts`, `apps/api/src/routes/customBlends.ts`, `apps/web/src/api/customBlends.ts`, `apps/api/test/customBlend/customBlendOptions.integration.test.ts`, `apps/web/src/features/customBlend/CustomBlendPage.tsx`, `CustomBlendPage.test.tsx`, `CustomBlendReachability.integration.test.tsx`
- gap: no artwork, price, category, availability on base/ingredient tiles; ratio input bare number; summary one sentence; success screen bare; zero shared visual identity between nav pill and page
- gap: base eligibility resolved only after click (`BasePicker.selectBaseProduct` -> `getProduct` -> `findSackVariant`), can fail post-click
- constraint: catalog list response carries no variants -> pre-filtering bases on sack eligibility impossible from list payload; keep failure inline on card
- constraint: `additionalProperties: false` on `CustomBlendOption` -> API and schema must move together; response validated client-side by `apiFetch`
- constraint: web never imports `@shop/catalog`; category union stays locally declared in `catalogPackagingPalettes.ts`
- reuse: `resolvePackagingSpec` + `PackagingArtwork` + `resolveCatalogPackagingPalette` -> option tiles, mix segment colours, large preview
- reuse: `BundleBanner` structure -> `CustomBlendBanner`
- reuse: existing reduced-motion block in `index.css` -> parity precedent for every new animated rule

## Decisions and Invariants

- money, eligibility, MOQ, tier, inventory stay server-authoritative; configurator displays no money
- W0 is additive read-path only: no persistence, no change to `CustomBlendSnapshot`, config key, fee semantics, write routes
- `consumptionClassification` + `categoryFacts` on `CustomBlendOption` mirror `ProductWithVariants` shapes exactly so `resolvePackagingSpec` accepts an option-derived product shape without casts
- URL remains sole owner of base + edit target; no packet may move target state into reducer or component state
- edit mode keeps base + quantity locked
- fixed charcoal Custom Blend livery; no composition-derived colour may reach `CustomBlendPackaging`
- mix-visualization segment colour comes from `resolveCatalogPackagingPalette`; deterministic hash-hue only as total-function fallback
- every animated rule carries reduced-motion parity; single shared `--custom-blend-motion-duration`
- `index.css` has exactly one owner packet (`P3`); consumers use only classes `P3` published
- accessibility: every control keyboard-operable, gauge announced via `aria-live`, disabled option carries visible reason
- existing staleness guards (options request id, abort, hydration refs) preserved verbatim through the split
- assumption (validate at `G0`): option-derived product shape for `resolvePackagingSpec` can be built without a `ProductWithVariants` cast once `categoryFacts` is present; if the resolver needs widening, widen its input type, never cast at call sites

## Target Design

### Contracts

- `CustomBlendOption` += `category: Type.String()`, `consumptionClassification: ConsumptionClassification`, `categoryFacts: CategoryFacts`
- all three required, not optional: server always has the row; optionality would push branch handling into every tile
- reuse `ConsumptionClassification` and `CategoryFacts` exports from `./products.js`

### API read path

- `CustomBlendFactRow` += `category`, `consumption_classification`, `details_json`
- `factColumns` += `p.category`, `p.consumption_classification`, `p.details_json`; predicate and ordering unchanged
- `toOption` maps new columns; `details_json` parsed through the same shape `apps/api/src/mappers/product.ts:parseDetailsJson` uses, with the same defaulted `CategoryFacts` fallback and `'non-food'` classification default

### Web visual system

- `P3` publishes, in `index.css`: surface tint + border + gradient-border tokens, segment palette hooks, and classes `.custom-blend-surface`, `.custom-blend-eyebrow-rule`, `.custom-blend-tile`, `.custom-blend-segment`, `.custom-blend-legend-dot`, `.custom-blend-gauge`, `.custom-blend-gauge--invalid`, `.custom-blend-banner`, `.custom-blend-notice`; light + dark + `prefers-reduced-motion` parity
- selectable tiles use `has-[:checked]:` pattern; no JS-driven class toggling for selection state

### Configurator composition

- shell `lg:grid-cols-[minmax(0,1fr)_22rem]`; left column numbered steps 1 base -> 2 ingredients -> 3 ratios -> 4 review; right column sticky aside = preview + gauge + submit
- proposed files under `apps/web/src/features/customBlend/`: `BasePicker.tsx`, `IngredientPicker.tsx`, `RatioEditor.tsx`, `RatioGauge.tsx`, `MixVisualization.tsx`, `CustomBlendPreview.tsx`, `BlendSummaryAside.tsx`, `SuccessRecap.tsx`
- state authority unchanged: URL owns target, reducer owns draft, cart context owns mutation

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 -> P2 -> R2 -> GR2 || P3 -> R3 -> GR3 -> {P4 -> R4 -> GR4 || P9 -> R9 -> GR9 || P10 -> R10 -> GR10}} -> G1 -> {P5 -> R5 -> GR5 || P6 -> R6 -> GR6 || P7 -> R7 -> GR7} -> G2 -> P8 -> R8 -> GR8 -> S1 -> R11 -> GR11 -> G3`

- `G0`: worktree created and verified; Node 22 selected; `npm ci` clean; `npm exec -- tsx --version` and `npm run typecheck -w @shop/api` pass
- `GR1`: contract review passed -> `P2` may consume widened schema
- `GR2`: API review passed -> web packets may rely on new option fields
- `GR3`: `index.css` review passed -> every class consumer may launch
- `GR4`: page-split review passed (structural parity proven) -> component packets may own child files
- `GR9`, `GR10`: banner + downstream reviews passed
- `G1`: `GR2` and `GR4` both passed -> selection/ratio/visualization wave launches
- `GR5`, `GR6`, `GR7`: lane reviews passed
- `G2`: `GR7` passed -> `P8` may consume mix/aside slot
- `GR8`: preview review passed
- `S1`: convergence; `GR11` its review gate
- `G3`: completion; `npm run reset` then `npm run verify` green once, findings closed

## Work Packets

### P1: Widen `CustomBlendOption` transport schema

- mode: parallel with `P3` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/customBlends.ts`, `packages/contracts/test/custom-blend-contracts.test.ts`
- reads: `packages/contracts/src/products.ts` -> `ConsumptionClassification`, `CategoryFacts`, `ProductWithVariants` -> exact shapes to reuse; `packages/contracts/src/customBlends.ts` -> `CustomBlendOption`, `CustomBlendOptionsResponse` -> insertion point
- acceptance: `CustomBlendOption` carries `category`, `consumptionClassification`, `categoryFacts` as required fields reusing existing exports; contract tests assert accept-with-fields and reject-without; `additionalProperties: false` retained; `CustomBlendSnapshot`, `CustomBlendIngredientSnapshot`, request bodies, error shapes byte-identical
- non-goals: API mapping, web consumption, price preview fields, any snapshot or write-body change
- changes:
  - add three fields to `CustomBlendOption` reusing `ConsumptionClassification` and `CategoryFacts` from `./products.js`
  - extend contract tests: valid option with new fields passes; option missing any new field fails; unknown property still rejected
- invariants: additive only; no optionality that would let API omit a field; no new export surface
- relevant evidence: none
- test duty: `npm test -w @shop/contracts` -> `E1`
- verification: `npm run typecheck -w @shop/contracts` -> `E2`; expect `@shop/api` typecheck to fail until `P2` lands, do not repair it here
- handoff: widened `CustomBlendOption` type + schema, change set for `P2`
- review: `R1` -> `GR1` blocks `P2`

### P2: Source new option fields in API read path

- mode: sequential after `GR1`
- depends on: `P1`, `GR1`
- owns: `apps/api/src/features/customBlend/customBlendRepository.ts`, `apps/api/src/features/customBlend/customBlendService.ts`, `apps/api/test/customBlend/customBlendOptions.integration.test.ts`
- reads: `apps/api/src/mappers/product.ts` -> `parseDetailsJson`, `toProductWithVariantsContract` -> exact `CategoryFacts` fallback + classification default to mirror; `apps/api/src/features/catalog/productRepository.ts` -> `ProductRow` -> canonical column names; `apps/api/src/routes/customBlends.ts` -> options route -> response schema binding
- acceptance: `GET /api/custom-blends/options` returns `category`, `consumptionClassification`, `categoryFacts` for base and every ingredient; response still validates against `CustomBlendOptionsResponse`; eligibility predicate, ordering, and ingredient set unchanged; existing assertions in the options integration test still pass unmodified in meaning
- non-goals: new route, price preview, query-shape change, write-path change, filtering by new fields
- upstream inputs: `P1` -> accepted contract change set -> widened `CustomBlendOption`
- changes:
  - extend `CustomBlendFactRow` and `factColumns` with `p.category`, `p.consumption_classification`, `p.details_json`
  - map new columns in `toOption`, parsing `details_json` and applying the same defaults `apps/api/src/mappers/product.ts` applies
  - extend options integration test: base and ingredient carry a real category, a classification, and parsed facts; malformed/NULL `details_json` yields the default facts shape rather than throwing
- invariants: `eligibleLotPredicate` and `ORDER BY` untouched; no inventory-based filtering introduced; mapping stays the single `toOption` point; no new query path
- relevant evidence: `E1`, `E2` -> contract schema state consumed here
- test duty: `npm exec -w @shop/api -- tsx --test apps/api/test/customBlend/customBlendOptions.integration.test.ts` -> `E3`; then `npm test -w @shop/api` -> `E4`
- verification: `npm run typecheck` across workspaces -> `E5`
- handoff: populated option fields; web packets may resolve packaging specs from options
- review: `R2` -> `GR2` blocks `G1`

### P3: Custom Blend visual token and class system

- mode: parallel with `P1` after `G0`
- owns: `apps/web/src/index.css`
- reads: `apps/web/src/index.css` -> `--custom-blend-*` block, `.custom-blend-nav-link`, `@keyframes custom-blend-iridescence`, reduced-motion block, `.content-shell`, `.section-eyebrow`, `.section-heading` -> existing token contract and precedent; `apps/web/src/components/home/BundleBanner.tsx` -> banner surface treatment to harmonise with
- acceptance: token block extended with surface tint, border, gradient-border, and segment palette hooks in both light and dark roots; the nine published classes exist and are the sole styling contract for downstream packets; every new animated rule has a `prefers-reduced-motion` counterpart; existing nav-pill appearance unchanged
- non-goals: any `.tsx` edit, any component markup, deleting or repurposing existing tokens or `.custom-blend-nav-link`
- changes:
  - extend `:root` and dark-root `--custom-blend-*` blocks
  - add `.custom-blend-surface`, `.custom-blend-eyebrow-rule`, `.custom-blend-tile`, `.custom-blend-segment`, `.custom-blend-legend-dot`, `.custom-blend-gauge`, `.custom-blend-gauge--invalid`, `.custom-blend-banner`, `.custom-blend-notice`
  - extend the reduced-motion block to cover every added animation/transition
  - document the published class list in a comment as the downstream contract
- invariants: single shared `--custom-blend-motion-duration` for all feature motion; no composition-derived colour hooks; frozen nav-pill token contract respected
- relevant evidence: none
- test duty: `npm run lint -w @shop/web` -> `E6`
- verification: `npm run build -w @shop/web` -> `E7`; CSS compiles, no unresolved token
- handoff: published class + token list as styling contract for `P4`-`P10`
- review: `R3` -> `GR3` blocks `P4`, `P9`, `P10`

### P4: Split configurator into components and two-column shell

- mode: parallel with `P9`, `P10` after `GR3`
- depends on: `P3`, `GR3`
- owns: `apps/web/src/features/customBlend/CustomBlendPage.tsx`, `apps/web/src/features/customBlend/BasePicker.tsx`, `IngredientPicker.tsx`, `RatioEditor.tsx`, `RatioGauge.tsx`, `MixVisualization.tsx`, `CustomBlendPreview.tsx`, `BlendSummaryAside.tsx`, `SuccessRecap.tsx` (all proposed, this packet creates them), `apps/web/src/features/customBlend/CustomBlendPage.test.tsx`
- reads: `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> `CustomBlendPage`, `IngredientRow`, `BasePicker`, target/hydration effects -> behaviour to preserve exactly; `apps/web/src/features/customBlend/customBlendState.ts` -> reducer API -> props boundaries; `apps/web/src/components/ui/card.tsx`, `badge.tsx`, `separator.tsx` -> primitive APIs; `apps/web/src/index.css` -> class list published by `P3`
- acceptance: page renders as two-column shell at `lg` with sticky aside and numbered steps 1-4; child components exist with typed props and currently reproduce existing behaviour; `CustomBlendPage.test.tsx` passes as a characterization suite with assertions updated only for structure, never for behaviour; URL-owned target, staleness guards, hydration refs, edit locks unchanged; `Loading …` strings replaced by skeletons
- non-goals: new selection UX, artwork, slider, gauge internals, mix segments, zoom, downstream surfaces; any reducer rule change
- upstream inputs: `P3` -> published class contract -> shell and surface styling
- changes:
  - characterize first: confirm `CustomBlendPage.test.tsx` green pre-split, keep it green after
  - extract `BasePicker`, `IngredientPicker`, `RatioEditor`, `SuccessRecap` from current markup with props-only interfaces
  - create `RatioGauge`, `MixVisualization`, `CustomBlendPreview`, `BlendSummaryAside` as minimal typed placeholders wired into the shell, each rendering existing information only
  - build shell grid, numbered step legends, `Card`/`Badge`/`Separator` + `.content-shell`/`.section-heading` usage, skeleton loaders
  - keep every effect, ref, abort, and submit guard in `CustomBlendPage.tsx`
- invariants: no target state moved out of the URL; no reducer or validation change; every extracted piece stays presentational except the shell
- relevant evidence: `E6`, `E7` -> class contract state
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customBlend/CustomBlendPage.test.tsx` -> `E8`
- verification: `npm run typecheck -w @shop/web` -> `E9`
- handoff: component file boundaries + prop contracts for `P5`-`P8`; `S1` inherits shell
- review: `R4` -> `GR4` blocks `G1`

### P9: Landing page Custom Blend banner

- mode: parallel with `P4`, `P10` after `GR3`
- depends on: `P3`, `GR3`
- owns: `apps/web/src/components/home/CustomBlendBanner.tsx` (proposed), `apps/web/src/components/home/CustomBlendBanner.test.tsx` (proposed), `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/features/home/HomePage.test.tsx`
- reads: `apps/web/src/components/home/BundleBanner.tsx` -> full structure -> banner precedent to mirror; `apps/web/src/features/home/HomePage.tsx` -> shelf order -> insertion point above bestsellers; `apps/web/src/index.css` -> `.custom-blend-banner`, gradient tokens
- acceptance: full-width `rounded-2xl border-2` banner with animated iridescent background, eyebrow "Custom Blend", headline, one-line body, pill CTA with arrow + hover lift linking `/custom-blend`; renders above the bestsellers shelf; carries a static charcoal-sack or miniature-mix graphic; reduced motion stops the animation; `HomePage.test.tsx` asserts presence, link target, and order
- non-goals: hero takeover, category tile, live mix data, any configurator import, any money
- upstream inputs: `P3` -> `.custom-blend-banner` + gradient tokens
- changes:
  - build `CustomBlendBanner` on the `BundleBanner` shape, styling from published classes only
  - render it in `HomePage` above `ProductShelf` bestsellers
  - add banner test; extend `HomePage.test.tsx` for placement and link
- invariants: decorative graphic is static and composition-free; no novelty copy; single motion duration token
- relevant evidence: `E6`, `E7`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/components/home/CustomBlendBanner.test.tsx apps/web/src/features/home/HomePage.test.tsx` -> `E10`
- verification: `npm run typecheck -w @shop/web` -> `E11`
- handoff: banner entry point on home
- review: `R9` -> `GR9` blocks `S1`

### P10: Downstream blend consistency

- mode: parallel with `P4`, `P9` after `GR3`
- depends on: `P3`, `GR3`
- owns: `apps/web/src/features/checkout/CheckoutSummary.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/components/CartLineItem.tsx`, `apps/web/src/features/customBlend/CustomBlendPackaging.tsx`, `apps/web/src/features/customBlend/CustomBlendPackaging.test.tsx`, `apps/web/src/features/checkout/CheckoutPage.test.tsx`, `apps/web/src/features/orders/OrderPages.test.tsx`
- reads: `apps/web/src/components/CartLineItem.tsx:82-131` -> existing tile + badge + notice treatment -> pattern to replicate; `apps/web/src/features/checkout/CheckoutSummary.tsx:77,90` and `apps/web/src/features/orders/OrderDetailView.tsx:77,108` -> current muted-text + amber notice sites; `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> `customBlendCompositionLabel`, livery constants
- acceptance: checkout summary and order detail render the same small `CustomBlendPackaging` tile + blend badge the cart shows; `customBlendCompositionLabel` prints the base percentage; the amber hardcoded made-to-order utilities are replaced by `.custom-blend-notice` identically in cart, checkout, order; existing blend assertions in the three touched suites updated for markup, not meaning
- non-goals: configurator changes, checkout/order data-fetch changes, any pricing or lifecycle copy change, other amber usages in `ProductCard.tsx` / `ProductPurchasePanel.tsx`
- upstream inputs: `P3` -> `.custom-blend-notice`
- changes:
  - add base percentage to `customBlendCompositionLabel`; update its unit expectations
  - render tile + badge in `CheckoutSummary` and `OrderDetailView`
  - swap the three amber notice sites for the token-backed class
  - update the affected test assertions
- invariants: composition label stays the only place composition is disclosed as text; livery constants untouched; non-returnable/cancellable wording unchanged
- relevant evidence: `E6`, `E7`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customBlend/CustomBlendPackaging.test.tsx apps/web/src/features/checkout/CheckoutPage.test.tsx apps/web/src/features/orders/OrderPages.test.tsx` -> `E12`
- verification: `npm run typecheck -w @shop/web` -> `E13`
- handoff: shared notice + tile treatment for `S1` screenshots
- review: `R10` -> `GR10` blocks `S1`

### P5: Base selection as artwork cards

- mode: parallel with `P6`, `P7` after `G1`
- depends on: `P2`, `P4`, `G1`
- owns: `apps/web/src/features/customBlend/BasePicker.tsx`, `apps/web/src/features/customBlend/BasePicker.test.tsx` (proposed)
- reads: `apps/web/src/components/packaging/packagingSpec.ts` -> `resolvePackagingSpec` -> input requirements; `apps/web/src/components/packaging/PackagingArtwork.tsx` -> render props; `apps/web/src/components/ProductCard.tsx` -> card + badge composition precedent; `apps/web/src/hooks/useProducts.ts` -> list payload fields available; `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> `BasePicker` props contract from `P4`
- acceptance: bases render as a card grid with packaging artwork thumbnail, category badge, mixing-group label; search + category filter retained; selection still writes `?baseVariantId=`; a product with no eligible 25 kg sack reports the failure inline on its own card, never as a page-level alert; selected base shows as a compact chip with artwork and "Change base material"; request-id staleness guard preserved
- non-goals: ingredient tiles, ratio editing, visualization, prefetching variants for every listed product, any new API call pattern
- upstream inputs: `P2` -> option fields on the selected base; `P4` -> `BasePicker` prop contract and class usage
- changes:
  - replace list rows with card grid using `resolvePackagingSpec` + `PackagingArtwork` from list `Product` fields
  - move `NO_SACK_VARIANT_MESSAGE` and resolve failure to per-card state keyed by product id
  - render selected-base chip from the options payload
  - add tests: artwork present, badge present, inline failure on the failing card only, URL write on select, stale resolve dropped
- invariants: URL sole owner of base; catalog list carries no variants, so eligibility remains a post-click resolve; artwork gate follows the resolved-palette rule already used by `ProductMedia`
- relevant evidence: `E3`, `E4`, `E5`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customBlend/BasePicker.test.tsx` -> `E14`
- verification: `npm run typecheck -w @shop/web` -> `E15`
- handoff: base chip + card contract
- review: `R5` -> `GR5` blocks `S1`

### P6: Ingredient tiles, ratio controls, total gauge

- mode: parallel with `P5`, `P7` after `G1`
- depends on: `P2`, `P4`, `G1`
- owns: `apps/web/src/features/customBlend/IngredientPicker.tsx`, `RatioEditor.tsx`, `RatioGauge.tsx`, `apps/web/src/features/customBlend/customBlendState.ts`, `apps/web/src/features/customBlend/customBlendState.test.ts`, `apps/web/src/features/customBlend/RatioEditor.test.tsx` (proposed), `IngredientPicker.test.tsx` (proposed)
- reads: `apps/web/src/features/customBlend/customBlendState.ts` -> reducer, `customBlendValidation`, `derivedBasePercentage`, bounds -> rules to extend without altering; `apps/web/src/components/packaging/catalogPackagingPalettes.ts` -> `resolveCatalogPackagingPalette` -> pigment swatch source; `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> props contracts from `P4`
- acceptance: ingredient tiles carry pigment swatch + artwork thumb, search box, category grouping, "n of 4 selected / n remaining" affordance; inactive or limit-reached tiles render as labelled disabled tiles carrying a reason; stock-count-zero compatible ingredients remain selectable with a visible out-of-stock advisory badge, with inventory eligibility left to the server; each selected ingredient has range slider + numeric input + stepper clamped 5-50 with a live remaining-budget readout; "Balance evenly" distributes across selected ingredients client-side with base remainder derived as today; gauge shows bar + `aria-live` sentence, flips success/destructive, prints base share numerically and graphically; adding an ingredient focuses its ratio input, removing focuses a neighbour
- non-goals: mix segments, packaging preview, any money, any server call, any change to validation thresholds or config-key inputs
- upstream inputs: `P2` -> `category`/facts for swatch and grouping; `P4` -> component prop contracts
- changes:
  - build tiles with `has-[:checked]:` selection styling from published classes
  - add search + grouping as derived view state only
  - build ratio row controls sharing one clamped change handler
  - add a pure balance-evenly helper to `customBlendState.ts` with unit tests covering 1-4 ingredients, remainder distribution, and clamp bounds
  - build `RatioGauge` with `aria-live` sentence and state flip
  - implement focus choreography
- invariants: reducer stays the single draft authority; balance-evenly must not produce out-of-bounds or >50 total; disabled tiles always state why; stock count remains server-authoritative and advisory only in the client; percentages remain integers
- relevant evidence: `E3`, `E4`, `E5`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend/customBlendState.test.ts src/features/customBlend/RatioEditor.test.tsx src/features/customBlend/IngredientPicker.test.tsx` -> `E16`
- verification: `npm run typecheck -w @shop/web` -> `E17`
- handoff: percentage + selection view model consumed by `P7`
- review: `R6` -> `GR6` blocks `S1`

### P7: Mix visualization

- mode: parallel with `P5`, `P6` after `G1`
- depends on: `P2`, `P4`, `G1`
- owns: `apps/web/src/features/customBlend/MixVisualization.tsx`, `apps/web/src/features/customBlend/MixVisualization.test.tsx` (proposed)
- reads: `apps/web/src/components/packaging/KraftSackArtwork.tsx`, `WovenSackArtwork.tsx` -> silhouette geometry language to reuse; `apps/web/src/components/packaging/catalogPackagingPalettes.ts` -> `resolveCatalogPackagingPalette`, `CatalogPackagingPalette` -> segment colour source; `apps/web/src/index.css` -> `.custom-blend-segment`, `.custom-blend-legend-dot`, motion duration token; `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> `MixVisualization` prop contract from `P4`
- acceptance: SVG vessel silhouette with clip-path holds one base segment plus one segment per ingredient, widths proportional to percentage, animated on change at the shared duration; segment colour resolves from the catalog palette, falling back to a deterministic hash hue only when unresolved; legend lists colour dot, name, percentage; hover/focus links legend and segment both ways; reduced motion disables transitions; component is pure and total for 0-4 ingredients
- non-goals: packaging preview, zoom, ratio editing, any composition colour leaking into `CustomBlendPackaging`
- upstream inputs: `P2` -> `category` for palette resolution; `P4` -> prop contract and aside slot
- changes:
  - build silhouette + clip-path from existing sack geometry
  - map percentages to segment `x`/`width` with transitions
  - resolve colours, with hash-hue fallback isolated in one pure helper
  - build legend with linked hover/focus state
  - tests: proportional widths, deterministic fallback, legend/segment linkage, empty and full ingredient sets
- invariants: pure render from props, no clock/random; fallback deterministic for the same input; charcoal livery untouched
- relevant evidence: `E3`, `E4`, `E5`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customBlend/MixVisualization.test.tsx` -> `E18`
- verification: `npm run typecheck -w @shop/web` -> `E19`
- handoff: aside layout slot dimensions + segment colour helper for `P8`
- review: `R7` -> `GR7` blocks `G2`

### P8: Large packaging preview and success recap

- mode: sequential after `G2`
- depends on: `P7`, `GR7`
- owns: `apps/web/src/features/customBlend/CustomBlendPreview.tsx`, `apps/web/src/features/customBlend/SuccessRecap.tsx`, `apps/web/src/features/customBlend/CustomBlendPreview.test.tsx` (proposed), `SuccessRecap.test.tsx` (proposed)
- reads: `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> props, `customBlendBatchMark`, `customBlendCompositionLabel` -> render contract; `apps/web/src/features/customBlend/MixVisualization.tsx` -> aside slot sizing from `P7`; `apps/web/src/index.css` -> surface + motion classes
- acceptance: `CustomBlendPackaging` renders large in the sticky aside with spec band, batch mark, and composition label updating live as the draft changes; click-to-zoom uses a pointer-tracked transform origin, Escape resets, `motion-reduce` disables the transform; the same preview plus a full blend recap renders on the success screen; keyboard users can open and dismiss zoom
- non-goals: livery variation, scheme picker, any composition-derived colour, mix segment logic, any money
- upstream inputs: `P7` -> aside slot; `P4` -> `CustomBlendPreview`/`SuccessRecap` prop contracts
- changes:
  - build zoom container with pointer-origin transform, Escape handler, reduced-motion guard
  - feed a draft-derived snapshot-shaped value into `CustomBlendPackaging` without mutating snapshot semantics
  - build success recap: preview + base and ingredient percentages + made-to-order note + existing links
  - tests: zoom open/reset by pointer and keyboard, live spec update, recap contents
- invariants: preview reads a derived draft view, never invents a config key that could disagree with the server's; charcoal livery fixed
- relevant evidence: `E18`, `E19`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customBlend/CustomBlendPreview.test.tsx apps/web/src/features/customBlend/SuccessRecap.test.tsx` -> `E20`
- verification: `npm run typecheck -w @shop/web` -> `E21`
- handoff: complete aside + success surfaces for convergence
- review: `R8` -> `GR8` blocks `S1`

### S1: Convergence, integration, and 1080p verification

- mode: sequential after `GR5`, `GR6`, `GR7`, `GR8`, `GR9`, `GR10`
- depends on: `P4`-`P10`
- owns: `apps/web/src/features/customBlend/CustomBlendPage.tsx`, `apps/web/src/features/customBlend/BlendSummaryAside.tsx`, `apps/web/src/features/customBlend/CustomBlendPage.test.tsx`, `apps/web/src/features/customBlend/CustomBlendReachability.integration.test.tsx`
- reads: every packet-owned component file -> exported props -> final wiring; `.claude/skills/browser-qa` -> mandated browser procedure
- acceptance: shell wires base picker, ingredient picker, ratio editor, gauge, mix visualization, preview, and success recap into the two-column layout; every conflict between lane assumptions resolved; `CustomBlendPage.test.tsx` and the reachability integration test pass and cover create, edit, stale-response, error, and retry paths; 1080p screenshots captured for configurator (empty, base chosen, ratios set), success screen, home banner, checkout, order detail; zero console errors during the journey
- non-goals: new behaviour beyond wiring, further visual redesign, mobile checks, any packet-owned internal rewrite
- upstream inputs: `P4`-`P10` -> accepted change sets -> component prop contracts, class contract, option fields
- changes:
  - wire all components in the shell + aside
  - reconcile prop drift across lanes
  - update page and reachability suites for final structure, keeping behavioural assertions intact
  - run browser QA per `.claude/skills/browser-qa` at `1920x1080`, saving screenshots to the run temp directory
- relevant evidence: `E8`-`E21`
- test duty: `npm run typecheck` -> `E22`; `npm run lint` -> `E23`; `npm test -w @shop/web` -> `E24`; `browser-qa` 1080p journey -> `E25`
- verification: screenshots referenced as artifacts with path + sha256; no page-level horizontal overflow at 1080p
- handoff: integrated feature, screenshot artifacts, evidence set for `G3`
- review: `R11` -> `GR11` blocks `G3`

## Review Assignments

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its severity gate (critical + high only) and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set
- timing: immediately after `P1` report; before `P2`
- blocks: `P2`, `GR1`
- consolidation reason: none
- reads: `packages/contracts/src/customBlends.ts` -> `CustomBlendOption` -> added fields; `packages/contracts/src/products.ts` -> `ConsumptionClassification`, `CategoryFacts` -> reuse correctness; `packages/contracts/test/custom-blend-contracts.test.ts` -> new cases
- acceptance: fields additive and required; existing exports reused not redefined; `additionalProperties: false` retained; snapshot/write shapes untouched
- invariants: read-path only; no persistence implication; no optionality that lets the server omit a field
- risk focus: shared transport type widening; every consumer must move with it; schema/type divergence
- non-goals: API mapping, web usage
- write policy: inspect-only
- test policy: assess supplied evidence; run only if evidence stale or missing
- relevant evidence: `E1`, `E2`
- return: `reviewer_report_v1`

### R2: Review `P2`

- method: as `R1`
- target: `P2` -> settled change set
- timing: immediately after `P2` report; before `G1`
- blocks: `G1`
- reads: `apps/api/src/features/customBlend/customBlendRepository.ts` -> `factColumns`, `eligibleLotPredicate` -> SQL correctness; `apps/api/src/features/customBlend/customBlendService.ts` -> `toOption` -> mapping and defaults; `apps/api/src/mappers/product.ts` -> `parseDetailsJson` -> parity; `apps/api/test/customBlend/customBlendOptions.integration.test.ts` -> coverage
- acceptance: response matches widened schema for base and ingredients; eligibility/ordering unchanged; malformed `details_json` handled without throwing; defaults match existing mapper behaviour
- invariants: no new query path, no write-path change, no inventory filtering, single mapping point
- risk focus: public API response shape, SQL predicate drift, JSON parse failure, transport validation failure
- non-goals: web rendering, price preview
- write policy: inspect-only
- test policy: assess supplied evidence; run only if stale or missing
- relevant evidence: `E3`, `E4`, `E5`
- return: `reviewer_report_v1`

### R3: Review `P3`

- method: as `R1`
- target: `P3` -> settled change set
- timing: immediately after `P3` report; before `P4`, `P9`, `P10`
- blocks: `P4`, `P9`, `P10`, `GR3`
- reads: `apps/web/src/index.css` -> `--custom-blend-*` blocks, added classes, reduced-motion block -> completeness and parity
- acceptance: light and dark parity; every animated rule has reduced-motion counterpart; published class list complete and documented; nav-pill contract intact
- invariants: single shared motion duration; no composition-derived colour hook; existing tokens not repurposed
- risk focus: shared stylesheet is the only file every downstream packet depends on; missing class blocks a lane; motion noise across three animated surfaces
- non-goals: component markup
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E6`, `E7`
- return: `reviewer_report_v1`

### R4: Review `P4`

- method: as `R1`
- target: `P4` -> settled change set
- timing: immediately after `P4` report; before `G1`
- blocks: `G1`
- reads: `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> effects, refs, submit guard -> preserved behaviour; each new component file -> prop boundaries; `apps/web/src/features/customBlend/CustomBlendPage.test.tsx` -> characterization integrity
- acceptance: split is structural only; URL target ownership, abort/request-id guards, hydration refs, edit locks unchanged; test changes are structural, not behavioural relaxations
- invariants: `R8-STATE-001` URL-ownership regression risk; no reducer change; no mutable module-global state
- risk focus: silent loss of a staleness guard during extraction; characterization assertions weakened to make the split pass
- non-goals: visual quality of not-yet-implemented lanes
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E8`, `E9`
- return: `reviewer_report_v1`

### R5: Review `P5`

- method: as `R1`
- target: `P5` -> settled change set
- timing: immediately after `P5` report; before `S1`
- blocks: `S1`
- reads: `apps/web/src/features/customBlend/BasePicker.tsx` -> resolve path, per-card error state; `apps/web/src/features/customBlend/BasePicker.test.tsx` -> coverage
- acceptance: inline per-card failure, no page-level alert; URL still sole target owner; stale resolve dropped; artwork gated on resolved palette
- invariants: no client-side eligibility invention; no added API call pattern
- risk focus: async staleness, error state keyed to the wrong card, artwork fabricated for unresolved palettes
- non-goals: ingredient and ratio surfaces
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E14`, `E15`
- return: `reviewer_report_v1`

### R6: Review `P6`

- method: as `R1`
- target: `P6` -> settled change set
- timing: immediately after `P6` report; before `S1`
- blocks: `S1`
- reads: `apps/web/src/features/customBlend/customBlendState.ts` -> balance-evenly helper, bounds; `RatioEditor.tsx`, `IngredientPicker.tsx`, `RatioGauge.tsx` -> control and a11y behaviour; `customBlendState.test.ts` -> rule coverage
- acceptance: clamps hold at 5-50 and total 50; balance-evenly total-function across 1-4 ingredients; gauge announced via `aria-live`; disabled tiles carry a reason; focus choreography correct
- invariants: reducer remains sole draft authority; integer percentages; no threshold change; server stays authoritative
- risk focus: rounding/remainder bugs producing invalid drafts that the server would reject; keyboard traps; slider/number desync
- non-goals: visualization, preview
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E16`, `E17`
- return: `reviewer_report_v1`

### R7: Review `P7`

- method: as `R1`
- target: `P7` -> settled change set
- timing: immediately after `P7` report; before `G2`
- blocks: `G2`, `P8`
- reads: `apps/web/src/features/customBlend/MixVisualization.tsx` -> geometry, colour resolution, fallback helper; `MixVisualization.test.tsx` -> determinism coverage
- acceptance: widths proportional and total-covering; palette resolution correct; fallback deterministic; legend/segment linkage keyboard-reachable; reduced motion honoured
- invariants: pure render, no clock/random; no composition colour reaching the livery
- risk focus: non-determinism, zero/overflow width at edge ratios, motion without reduced-motion parity
- non-goals: preview and zoom
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E18`, `E19`
- return: `reviewer_report_v1`

### R8: Review `P8`

- method: as `R1`
- target: `P8` -> settled change set
- timing: immediately after `P8` report; before `S1`
- blocks: `S1`
- reads: `apps/web/src/features/customBlend/CustomBlendPreview.tsx`, `SuccessRecap.tsx` -> zoom lifecycle, derived draft value; `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> props contract
- acceptance: zoom opens/resets by pointer and keyboard; Escape resets; reduced motion guarded; live spec updates; recap complete
- invariants: fixed charcoal livery; derived draft view never asserts a server-owned config key as fact
- risk focus: listener leaks, focus loss on zoom, fabricated batch mark diverging from the server's
- non-goals: mix segment internals
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E20`, `E21`
- return: `reviewer_report_v1`

### R9: Review `P9`

- method: as `R1`
- target: `P9` -> settled change set
- timing: immediately after `P9` report; before `S1`
- blocks: `S1`
- reads: `apps/web/src/components/home/CustomBlendBanner.tsx` -> markup, motion; `apps/web/src/features/home/HomePage.tsx` -> placement
- acceptance: placement above bestsellers; correct link target; reduced-motion parity; no novelty copy; no money
- invariants: decorative graphic composition-free; published classes only
- risk focus: motion noise alongside nav pill and mix segments; accessibility of the whole-banner link
- non-goals: configurator surfaces
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E10`, `E11`
- return: `reviewer_report_v1`

### R10: Review `P10`

- method: as `R1`
- target: `P10` -> settled change set
- timing: immediately after `P10` report; before `S1`
- blocks: `S1`
- reads: `apps/web/src/features/checkout/CheckoutSummary.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/components/CartLineItem.tsx` -> tile/badge/notice parity; `apps/web/src/features/customBlend/CustomBlendPackaging.tsx` -> composition label change
- acceptance: identical notice treatment across cart, checkout, order; base percentage printed; test assertions updated for markup only
- invariants: disclosure copy unchanged in meaning; livery constants untouched
- risk focus: order-history regressions, label change breaking snapshot-shaped assertions, notice styling drift between the three surfaces
- non-goals: configurator, unrelated amber usages
- write policy: inspect-only
- test policy: assess supplied evidence
- relevant evidence: `E12`, `E13`
- return: `reviewer_report_v1`

### R11: Review `S1`

- method: as `R1`
- target: `S1` -> settled integration change set
- timing: after `S1` report and fan-in evidence; before `G3`
- blocks: `G3`
- consolidation reason: none; integration behaviour is new and uncovered by lane reviews
- reads: `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> final wiring; `BlendSummaryAside.tsx` -> composition; `CustomBlendPage.test.tsx`, `CustomBlendReachability.integration.test.tsx` -> journey coverage; screenshot artifacts
- acceptance: create, edit, stale-response, error, retry paths covered; URL ownership and edit locks intact after wiring; screenshots show every named surface at 1080p without console errors or horizontal overflow
- invariants: every plan invariant holds in the composed page; no money in the configurator; no novelty copy
- risk focus: cross-lane prop drift silently dropping a guard; integration-only regressions in edit mode; overflow at 1080p
- non-goals: packet-internal implementation already reviewed
- write policy: inspect-only
- test policy: assess supplied evidence; run no suite unless evidence stale or missing
- relevant evidence: `E22`, `E23`, `E24`, `E25`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/web/src/index.css`: owned only by `P3`; every other packet reads the published class list, never edits
- `packages/contracts/src/customBlends.ts`: owned only by `P1`; `P2` consumes after `GR1`
- `apps/web/src/features/customBlend/CustomBlendPage.tsx`: created/split by `P4`, then owned solely by `S1`; `P5`-`P8` own only their own component files
- `apps/web/src/features/customBlend/CustomBlendPackaging.tsx`: owned only by `P10`; `P8` imports, never edits
- `apps/web/src/features/customBlend/customBlendState.ts`: owned only by `P6`
- `apps/web/src/features/home/HomePage.tsx`: owned only by `P9`
- `CustomBlendPage.test.tsx`: `P4` then `S1`; no lane packet edits it
- migrations: none in scope; any packet proposing one stops and reports a blocker
- contract change: producer `P1` -> consumers `P2`, then all web packets after `GR2`

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings; never override here
- non-Codex harnesses: ignore Codex binding; use harness-native subagent configuration preserving worker/reviewer responsibilities and communication contracts
- all harnesses: reviewer runs `code-reviewer` skill; assignment sets `review_skill=code-reviewer`; reviewer invokes it explicitly by name

## Test Execution Schedule

- Node: prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` before any node/npm command; stop on Node 23+
- `G0`: owner gate -> `npm ci`, `npm exec -- tsx --version`, `npm run typecheck -w @shop/api`
- `E1`,`E2`: `P1` -> `npm test -w @shop/contracts`, `npm run typecheck -w @shop/contracts`
- `E3`,`E4`,`E5`: `P2` -> focused options integration test, `npm test -w @shop/api`, `npm run typecheck`
- `E6`,`E7`: `P3` -> `npm run lint -w @shop/web`, `npm run build -w @shop/web`
- `E8`,`E9`: `P4` -> focused `CustomBlendPage.test.tsx`, `npm run typecheck -w @shop/web`
- `E10`,`E11`: `P9`; `E12`,`E13`: `P10`; `E14`,`E15`: `P5`; `E16`,`E17`: `P6`; `E18`,`E19`: `P7`; `E20`,`E21`: `P8` -> focused vitest files + workspace typecheck
- `E22`-`E25`: `S1` -> `npm run typecheck`, `npm run lint`, `npm test -w @shop/web`, `browser-qa` 1080p journey; run once after fan-in
- `G3`: final owner -> `npm run reset` then `npm run verify`, once, after all fixes settle
- reuse: an evidence entry stays valid across sessions while no file, dependency, contract, config, or fixture in its scope changed; agents receive only entries covering their scope and must not rerun valid commands
- invalidation: `packages/contracts/src/customBlends.ts` -> `E1`-`E5` and all web entries; `apps/api/src/features/customBlend/**` -> `E3`-`E5`; `apps/web/src/index.css` -> `E6`-`E25`; any `apps/web/src/features/customBlend/**` -> `E8`, `E14`-`E25`; `apps/web/src/features/home/**` -> `E10`, `E11`, `E24`, `E25`

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values
- transport: inline canonical JSON; run-scoped temp artifacts only for screenshots and bulky logs, under `[platform temp root]/orchestrator/[run_id]/[packet_id]/`
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`; reviewer assignment: `reviewer_assignment_v1`; follow-up: `orchestrator_directive_v1`; worker return: `worker_report_v1`; reviewer return: `reviewer_report_v1`; recovery snapshot: `orchestrator_run_state_v1`
- reviewer method: `code-reviewer` skill; assignment carries `review_skill=code-reviewer`
- worktree context: every assignment carries absolute path, implementation branch, base revision; all repository-relative paths resolve under worktree root
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh runtime orchestrator; load source-checkout `CLAUDE.md`, this plan, canonical contracts, current checkpoint.
3. Record source branch + `HEAD`; handle detached `HEAD` or relevant uncommitted-input blocker per worktree contract.
4. Create implementation branch + worktree from recorded `HEAD`; persist worktree identity in checkpoint.
5. Switch execution root to worktree; load worktree `CLAUDE.md`.
6. Validate `G0` (Node 22, `npm ci`, `tsx --version`, API typecheck); validate the `resolvePackagingSpec` input-shape assumption.
7. Launch `P1` and `P3` as parallel workers.
8. Accept `P1` -> `R1` -> `GR1` -> `P2` -> `R2` -> `GR2`. Accept `P3` -> `R3` -> `GR3`.
9. After `GR3`, launch `P4`, `P9`, `P10` in parallel; review each on settle (`R4`, `R9`, `R10`).
10. Route findings to fresh workers with `action=fix` directives and stable finding IDs; close after targeted evidence; never re-review a fix.
11. Validate `G1` (`GR2` + `GR4`); launch `P5`, `P6`, `P7` in parallel; review each on settle.
12. Validate `G2` (`GR7`); run `P8`; review.
13. Launch `S1` after `GR5`, `GR6`, `GR8`, `GR9`, `GR10`; run fan-in tests and `browser-qa` once; review as `R11`.
14. Validate `GR11`; run `npm run reset` then `npm run verify` once after all fixes settle -> `G3`.
15. Leave branch and worktree intact. Reply with absolute worktree path, implementation branch, source branch, base revision. State user owns merge.

## Risks and Open Questions

- risk: `P3` publishes an incomplete class set, blocking a later lane -> mitigation: class list is `P3` acceptance and `R3` review criterion; a missing class is a blocker report, never a local `index.css` edit
- risk: page split silently drops a staleness guard -> mitigation: characterization suite must stay green with behavioural assertions unchanged; `R4` risk focus names it
- risk: contract widening breaks an unlisted consumer -> mitigation: eight known consumers enumerated in Repository Findings; `E5` workspace-wide typecheck gates `GR2`
- risk: cross-lane prop drift surfaces only at `S1` -> mitigation: `P4` fixes prop contracts before the wave launches; `S1` owns reconciliation and gets its own review
- risk: three animated surfaces read as noise -> mitigation: single duration token, mandatory reduced-motion parity, 1080p screenshots at `S1`
- risk: novelty creep in copy -> mitigation: explicit non-goal in every UI packet; reviewers check copy
- question: does `resolvePackagingSpec` accept an option-derived shape without a cast once `categoryFacts` lands -> owner/gate: `G0` assumption check; if not, widen the resolver input type inside `P5`, never cast

## Done Criteria

- configurator renders two-column shell with artwork base cards, ingredient tiles, slider/stepper ratios, live gauge, animated mix visualization, and large zoomable preview at 1080p
- home page shows the Custom Blend banner above bestsellers, linking `/custom-blend`
- checkout and order detail show the same blend tile, badge, and token-backed notice as the cart; composition label includes base percentage
- `CustomBlendOption` carries `category`, `consumptionClassification`, `categoryFacts`; options response validates; no schema, migration, seed, persisted field, or write-path change
- no money displayed in the configurator; eligibility, MOQ, tier, fee, config key, and edit locks unchanged
- URL remains sole owner of base and edit target; staleness guards intact
- every new animated rule has reduced-motion parity; every new control keyboard-operable; gauge announced via `aria-live`; disabled options carry a reason
- `npm run reset` then `npm run verify` pass once after all findings close; `browser-qa` 1080p screenshots captured for configurator, success screen, banner, checkout, order detail
- implementation branch and worktree retained; merge left to user
