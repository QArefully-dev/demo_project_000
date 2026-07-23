# B2B Materials Exchange Rebrand Coding Plan

Status: complete — implementation, convergence review, and final verification complete (2026-07-23)
Source: grilling/decision session 2026-07-20 (handoff `b2b_materials_exchange_rebrand_handoff.md`, now superseded + deleted). This plan is self-contained; all locked decisions, terminology, and scope embedded below.
Repository baseline: `main` @ `5625b7b` (inspection date 2026-07-20)

## Execution Checkpoint — 2026-07-23

- execution worktree: `C:\Users\iwano\Desktop\repos\demo_project_000-worktrees\b2b-materials-exchange-rebrand`
- implementation branch: `codex/b2b-materials-exchange-rebrand`
- source branch / base: `main` @ `5625b7b`
- G1 accepted: P1/R1 migration + P2/R2 contracts complete. `npm run reset`, contracts tests/build, and pricing subpath export verified.
- G2 accepted: P3/R3 pricing rules + P6/R6 catalog/seed complete. Pricing boundary tests, catalog tests/build, reset/idempotence, and repeat-seed default-variant regression verified.
- G3 accepted: P4/R4 catalog read path + P5/R5 cart/checkout complete. API typecheck, catalog mapper tests, and cart/checkout integration verification passed.
- R5 remediation closed: unsafe and overflowing quantities return 400; cart mutations target exact `variantId`; ambiguous legacy product-only mutations reject rather than mutating the first line; checkout revalidates MOQ before reservation/payment.
- G4 accepted: P7/R7 and P10/R10 copy accepted; P8/R8 product UX accepted with local MOQ guard; P9/R9 cart/checkout accepted with variant mutations, server price fields, delivery preview, and promo freight total.
- S1 accepted: final `npm.cmd run verify` PASS — format, typecheck, lint, tests, build.
- R11/G5 accepted: convergence review PASS, including V2/V3 mixed-quote fix.
- source leak: preserved separately at `codex/recovery-materials-exchange-source-leak` @ `4966a5791fdf30ea7330d4a7828e23c52c17a25e`.
- semantic audit: all substantive source changes incorporated or deliberately superseded; this plan transferred as only missing artifact.
- completion: Done Criteria complete. No auto merge; user owns merge.

Pivot: B2C powder retail (`QArefully Powder Co.`) -> B2B bulk/wholesale pallet ordering + (later) live trading. Additive rebrand; reuse catalog/pricing/inventory/checkout/orders foundations. No storefront rewrite. Reason: grounded real-world commerce -> richer QA learning material (concurrency, bidding, bulk pricing, minimum-order rules).

## Runtime Worktree

- source: current branch `main` @ `5625b7b` -> record branch + HEAD before any write
- create: dedicated implementation branch + worktree before any implementation write -> `git worktree add -b <impl-branch> <abs-worktree-path> main`
- execution root: all worker, reviewer, test, fix, convergence activity runs in worktree
- integration: no auto merge/rebase/cherry-pick/copy-back/cleanup; user owns merge
- completion reply: absolute worktree path + implementation branch + source branch `main` + base revision `5625b7b`
- blocker gate: detached HEAD -> stop, request branch. Relevant uncommitted source changes absent from HEAD (`.claude/skills/*`, `CLAUDE.md`, `plans/*` per initial git status) -> confirm baseline with user before worktree create; never import/stash without approval

## Objective

Rebrand storefront to `QArefully Materials Exchange` trade portal: pack/pallet ordering, backend-authoritative MOQ + qty-break tier pricing, `$/tonne` + total-weight display everywhere, industrial voice, "powder"->"material" copy drop, freight-only delivery reframe, live-trading "coming next" teaser only.

Completion boundary: buyer browses lots (open), sees pack + pallet options with `$/tonne` + total weight + tier ladder, adds pallet/sack quantities respecting MOQ, checks out through existing cart/checkout mechanics with tier-resolved totals. No new quote object. No bidding engine.

## Scope

### In

- brand rename `QArefully Powder Co.` -> `QArefully Materials Exchange`; wordmark, `<title>`, meta, home, shell/header
- pack model: 25kg sack + 1000kg pallet variants uniform across catalog (40 sacks = 1 pallet = 1 tonne)
- pricing: MOQ (sacks, default 4) + qty-break tiers keyed on pallet-equivalent tonnes -> 1-4t=0% / 5-9t=5% / 10t+=10% off base unit price; backend authoritative
- display: total weight + `$/tonne` unit price alongside pack price everywhere (USD via existing `formatMoney`)
- MOQ enforcement: reject below-floor at cart add/update + checkout; surface error in UI
- delivery reframe: keep `deliveryClass 'parcel'|'freight'` enum; seed all `freight`; copy -> "pallet freight" + lead time
- copy drop: "powder"->"material(s)" across catalog/product/cart/checkout/brand/shell/help/nav (EXCEPT Custom Powder feature, see Out)
- terminology map applied (see "Copy and Terminology")
- live-trading surface labelled "coming next"; build nothing
- catalog seed reworked: sack+pallet variants, freight, per-material USD pricing, moq_sacks=4, powder-free industrial names/descriptions
- consumption badges `Food`/`Not for consumption`/`Caution` retained unchanged (safety)

### Out

- Custom Powder / Powderizer feature (routes, APIs, nav entry, pages, help articles, internal symbols) -> UNTOUCHED. Being redesigned separately as "Custom Small Order" (mixed sub-pallet orders + pallet-fit + food/industrial exclusion rules) in its own detailed plan. Accepted residual: word "powder" persists in that feature surface this pass
- live trading / auctions / bidding / reserve / increment / settlement / concurrency -> LATER separate plan
- order-by-weight input model -> rejected (fractional/rounding)
- real quote persistence -> rejected (cart-only)
- trade-account net-price tiering / login-to-see-price -> rejected; price gating unchanged (open browse, login only to add/checkout)
- `deliveryClass` enum change / removal -> rejected (avoid migration + type break)

## Repository Findings

- existing: `apps/web/src/components/Header.tsx:18` -> wordmark `QArefully Powder Co.` literal split across spans
- existing: `apps/web/index.html:6` -> `<title>Shop Qarefully</title>`
- existing: `apps/web/src/features/product/ProductPurchasePanel.tsx` -> variant selector "Bag options", price block, stock copy, "Add powder", "Powder type:", batch-handling/delivery copy; add flow calls `onAddToCart(variantId)` qty=1
- existing: `apps/web/src/features/product/ProductSpecifications.tsx` -> spec renderer (structure reusable; copy from data)
- existing: `apps/web/src/lib/formatMoney.ts:1` -> `Intl.NumberFormat('en-US', currency 'USD')`; currency stays USD ("keep dollars" decision supersedes any `£` framing)
- existing: `packages/contracts/src/products.ts:349` -> `CatalogVariant` (weightGrams, priceCents, deliveryClass, stockCount...); `:386` `ProductWithVariants` (priceRange, baseAvailability); flat price only
- existing: `apps/api/src/features/cart/cartService.ts:242,250` -> `lineTotalCents = price_cents * quantity`, `subtotalCents` sum; flat, no tier/MOQ
- existing: `apps/api/src/features/cart/cartRepository.ts:67` -> line price sourced `v.price_cents`; `addLine` increments qty+1; `addLineQuantity` exists (unused by service add)
- existing: `apps/api/src/features/checkout/checkoutQuote.ts:31` -> `unitPriceCents = item.product.priceCents`, consumes `item.lineTotalCents`; delivery via `quoteDelivery`
- existing: `apps/api/src/routes/cart.ts:107,150` -> add/update map service string codes to 404/409; no MOQ/400-domain path; `AddToCartBody` has no quantity
- existing: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` -> `product_variants` table (sku, weight_grams, price_cents, delivery_class, stock_count, sort_order...); pattern for ordered migration + `addColumnIfMissing` + FK-check validation
- existing: `apps/api/src/db/migrations/index.ts` -> migration registry (append-only ordered)
- existing: `apps/api/src/db/seed.ts:140` -> idempotent upsert of `CATALOG_PRODUCTS` into products + product_variants; `upsertVariant` fixed column set; seed assertion messages say "powder"
- existing: `packages/catalog/src/model.ts:239` -> `makeVariant(sku,label,weightGrams,priceCents,stockCount,sortOrder,opts)`; `deliveryClass` derived by `FREIGHT_WEIGHT_THRESHOLD_GRAMS` (100000); `:104` `CatalogProduct`
- existing: `packages/catalog/src/categories/*.ts` (6 files: sportsNutrition, bakingPantry, drinks, householdCleaning, gardenOutdoors, tradeCreative) -> per-product `makeVariant(...)` calls, varied weights/prices, "powder" in names/descriptions
- existing: `apps/web/src/components/nav/navItems.ts:30` -> `customPowderItem` label "Custom Powder" (OUT OF SCOPE -> leave)
- existing: `apps/api/src/features/catalog/productRepository.ts` + `apps/api/src/mappers/product.ts` -> variant row -> `CatalogVariant` transport mapping (surface point for new fields)
- gap: no pricing-tier domain module, no MOQ validation, no `$/tonne` derivation anywhere
- gap: no shared pack/pricing constants (sacks/pallet/tonne/MOQ/tier ladder)
- constraint: backend owns money (integer minor units); variant/SKU-scoped cart/inventory/order lines; web never imports api source; catalog has no contracts dependency currently
- constraint: seed idempotent, canonical IDs 1-50 + 1001-1050 upsert-in-place; preserve non-seed + user rows; `reset` = destructive path
- constraint: migrations ordered/versioned, preserve data, surface unknown errors
- reuse: `makeVariant` + category-file pattern -> extend for sack/pallet uniform variants; `018` migration pattern -> `019`; `quoteDelivery` freight path unchanged

## Decisions and Invariants

- currency: USD retained via `formatMoney`; `$/tonne` = `formatMoney(perTonneCents) + "/t"`, 2-dp cents precision
- pack constants (single source in contracts, P2): `SACK_WEIGHT_GRAMS=25000`, `PALLET_WEIGHT_GRAMS=1_000_000`, `SACKS_PER_PALLET=40`, `MOQ_DEFAULT_SACKS=4`, `TIER_LADDER=[{minTonnes:1,discountPct:0},{minTonnes:5,discountPct:5},{minTonnes:10,discountPct:10}]`
- assumption (validate G1): tier band resolved by line total pallet-equivalent tonnes `t = quantity*weightGrams/PALLET_WEIGHT_GRAMS`; discount = highest ladder entry with `minTonnes <= t`; unifies sack + pallet lines
- assumption (validate G1): MOQ is weight floor `quantity*weightGrams >= moqSacks*SACK_WEIGHT_GRAMS`; pallet lines (1000kg) always clear default 4-sack (100kg) floor
- assumption (validate G1): `perTonneCents = round(baseUnitPriceCents * PALLET_WEIGHT_GRAMS / weightGrams)`, round half-up, integer minor units; derived from BASE unit price (pre-tier), informational
- decision: `resolvedUnitPriceCents = round(baseUnitPriceCents * (100-discountPct)/100)`; `lineTotalCents = resolvedUnitPriceCents * quantity`; backend authoritative, web never recomputes authoritative money
- decision: `moq_sacks` stored per-variant (column, default 4) for future per-lot flex; tier ladder uniform domain constant this pass
- invariant: `deliveryClass` enum + DB values unchanged; only copy reframed; seed sets all variants `freight`
- invariant: consumption classification + badges unchanged; safety copy preserved
- invariant: Custom Powder feature files unmodified; every copy packet lists them non-goal
- invariant: seed idempotent, canonical-ID upsert, non-seed rows preserved; variant weights must equal pack model (25000 or 1_000_000)
- assumption (validate, non-blocking): tagline "Trade-grade materials, priced by the tonne. Sugar to cement." (proposed, industrial/unrestrained); per-material USD price ranges sugar-low -> cement/specialist-high set in P6, orchestrator spot-checks

## Copy and Terminology (authoritative for P7-P10)

Voice: industrial, unrestrained, confident trade tone (NOT restrained). Drop "powder"/"Powder" noun completely from user-facing copy -> "material"/"Material". Applies to page copy, brand, meta/titles, badges, labels, category descriptions. EXCEPTION: Custom Powder feature surface untouched this pass (see Scope/Out).

Current -> new mappings:

- "Bag options" -> "Pack & pallet options"
- "Add powder" / "Add to cart" CTA -> "Add to order"
- "Powder type: {category}" -> "Material · {category}"
- "Powder bag linked to this browser cart" -> "Lines held in your order for this session"
- "Adjust bag quantities before checkout" -> "Adjust pallet quantities before checkout"
- "X in stock" -> "X pallets available" / "X t on hand"
- "Batch handling: Finely considered..." -> "Handling: palletised, shrink-wrapped, batch-labelled"
- brand `QArefully Powder Co.` -> `QArefully Materials Exchange` (keeps QA pun; "Exchange" pre-signals live trading)
- `<title>` `Shop Qarefully` -> materials-exchange trade title
- any "powder"/"Powder" noun -> "material"/"Material"
- delivery copy -> "pallet freight" + lead time (enum/logic unchanged)
- consumption badges `Food` / `Not for consumption` / `Caution` -> UNCHANGED (safety)
- live trading -> "coming next" teaser label only; build nothing

## Target Design

### Data (P1)

- migration `019_variant_moq.ts` -> `addColumnIfMissing(product_variants,'moq_sacks',"INTEGER NOT NULL DEFAULT 4")`; FK-check + count validation per `018` pattern; register in `migrations/index.ts`
- no other schema change; tiers = domain constants

### Contracts (P2)

- `packages/contracts/src/pricing.ts` (proposed) -> export pack/pricing constants + types `PriceTier`, `TierLadder`
- extend `CatalogVariant` (`products.ts`) -> add `moqSacks:int>=1`, `perTonneCents:MoneyCents`, `priceTiers:PriceTier[]`
- `cart.ts` -> `AddToCartBody` add optional `quantity:int>=1`; add cart error surface for below-MOQ (400 `ErrorResponse`, no new enum needed if message-based) OR typed code `BELOW_MOQ`
- contract tests updated for new required fields

### Pricing domain (P3)

- `apps/api/src/features/pricing/pricingRules.ts` (proposed) -> pure: `resolveTierDiscountPct(quantity,weightGrams)`, `resolveUnitPriceCents(base,quantity,weightGrams)`, `perTonneCents(base,weightGrams)`, `validateMoq(quantity,weightGrams,moqSacks)->bool`
- colocated `pricingRules.test.ts` -> boundary cases (QA hotspot): t=4.99/5.0/9.99/10.0 band edges; MOQ at 3/4 sacks; pallet always clears; rounding half-up; zero/one quantity

### Catalog read path (P4)

- `productRepository` + `mappers/product.ts` -> map `moq_sacks` -> `moqSacks`; compute `perTonneCents` + `priceTiers` (from pricing consts + `perTonneCents(base,weight)`) onto each variant; `ProductWithVariants` unaffected structurally

### Cart + checkout pricing/MOQ (P5)

- `cartService.getCart` -> line total via `resolveUnitPriceCents`; subtotal from resolved totals
- `cartService.add/update` -> enforce `validateMoq`; return `BELOW_MOQ`; `add` accepts quantity (default MOQ floor)
- `routes/cart.ts` -> map `BELOW_MOQ` -> 400; thread `quantity` from `AddToCartBody`
- `checkoutQuote` -> consume resolved `unitPriceCents`/`lineTotalCents`; re-validate MOQ before quote; delivery unchanged

### Seed/data (P6)

- `model.ts` -> pack constants alignment; `makeVariant` retains derived freight (all >=100000 -> freight); optional `moqSacks` param default 4
- 6 category files -> each product: sack (25000) + pallet (1_000_000) variants, freight, per-material USD price, industrial powder-free name/description
- `seed.ts` -> `upsertVariant` add `moq_sacks`; assertion messages "powder"->"material"

### Web (P7 brand, P8 product, P9 cart/checkout, P10 content)

- server-provided `perTonneCents`/`priceTiers`/resolved totals rendered; `formatMoney` + "/t"; total weight from `weightGrams*quantity`
- MOQ quantity input + client hint + server-error surface; freight lead-time copy; terminology map; live-trading "coming next" teaser (P7)

## Execution Graph

`G0 -> {P1 -> R1 || P2 -> R2} -> G1 -> {P3 -> R3 || P6 -> R6} -> G2 -> {P4 -> R4 || P5 -> R5} -> G3 -> {P7 -> R7 || P8 -> R8 || P9 -> R9 || P10 -> R10} -> G4 -> S1 -> R11 -> G5`

- `G0`: worktree created + verified from `main`@`5625b7b`; `npm ci` + post-install health (`tsx --version`, `typecheck -w @shop/api`) pass
- `G1`: schema (`019` col) + contracts accepted (R1+R2 pass); pack/pricing constants + tier/MOQ assumptions validated
- `G2`: pricing domain accepted (R3 pass) + seed data accepted (R6 pass)
- `G3`: backend consumers accepted (R4 catalog read + R5 cart/checkout pass)
- `G4`: all web lane reviews pass (R7-R10)
- `R11`/`G5`: convergence review + completion gate (full `verify` once)
- review gates GR = each Rn: pass or findings closed via worker fix + targeted evidence before downstream consumes

## Work Packets

### P1: Migration 019 add variant moq_sacks

- mode: parallel with P2 after G0
- depends on: G0
- owns: `apps/api/src/db/migrations/019_variant_moq.ts` (proposed), `apps/api/src/db/migrations/index.ts`
- reads: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` -> `addColumnIfMissing`,FK-check pattern -> replicate ordered-migration + validation; `apps/api/src/db/migrations/index.ts` -> registry order
- acceptance: `019` adds `product_variants.moq_sacks INTEGER NOT NULL DEFAULT 4`, idempotent, preserves rows, FK-check clean; registered after `018`; `reset` + `seed` run clean
- non-goals: no tier columns; no other table; no contract/domain edits
- changes:
  - add migration module mirroring `018` guards (`addColumnIfMissing`, post-alter validation)
  - register in `index.ts` ordered list
- invariants: ordered/versioned; preserve data; surface unknown errors; existing rows default 4
- test duty: run `npm run reset` (worktree) -> expect clean migrate+seed; evidence `EV-P1-reset`
- verification: `PRAGMA table_info(product_variants)` shows `moq_sacks`; reset exits 0
- handoff: interface `product_variants.moq_sacks` col -> P4,P5,P6
- review: R1 (high-risk schema) blocks G1

### P2: Contracts pricing fields + constants

- mode: parallel with P1 after G0
- depends on: G0
- owns: `packages/contracts/src/pricing.ts` (proposed), `packages/contracts/src/products.ts`, `packages/contracts/src/cart.ts`, `packages/contracts/src/index.ts`, `packages/contracts/test/*` (affected)
- reads: `packages/contracts/src/products.ts` -> `CatalogVariant`,`ProductWithVariants` -> add fields; `packages/contracts/src/cart.ts` -> `AddToCartBody`,cart line shapes -> add quantity/error surface; `packages/contracts/src/common.ts` -> `MoneyCents`
- acceptance: `CatalogVariant` gains `moqSacks`,`perTonneCents`,`priceTiers`; pack/pricing constants + `PriceTier` type exported from `pricing.ts` + index; `AddToCartBody` optional `quantity`; below-MOQ error representable; `npm run build -w @shop/contracts` + contract tests pass
- non-goals: no resolution logic (P3); no api/web edits; no seed edits
- changes:
  - create `pricing.ts` consts (`SACK_WEIGHT_GRAMS`,`PALLET_WEIGHT_GRAMS`,`SACKS_PER_PALLET`,`MOQ_DEFAULT_SACKS`,`TIER_LADDER`) + `PriceTier` schema/type
  - extend `CatalogVariant` + regenerate dependent types; export via subpath
  - extend `AddToCartBody`; add `BELOW_MOQ` code/message shape
  - update contract tests + fixtures
- invariants: transport owns types; additive; `additionalProperties:false` preserved; catalog gains no contracts dep (constants consumed by api/web only)
- test duty: `npm test -w @shop/contracts`; evidence `EV-P2-contracts`
- verification: build + tests green; new fields typed
- handoff: interfaces `CatalogVariant+pricing fields`, `pricing consts/TIER_LADDER`, `AddToCartBody.quantity`, `BELOW_MOQ` -> P3,P4,P5,P8,P9
- review: R2 (high-risk contract producer) blocks G1

### P3: Pricing domain rules

- mode: parallel with P6 after G1
- depends on: G1 (P2 constants/types)
- owns: `apps/api/src/features/pricing/pricingRules.ts` (proposed), `apps/api/src/features/pricing/pricingRules.test.ts` (proposed)
- reads: `packages/contracts/src/pricing.ts` -> constants/`TIER_LADDER`/`PriceTier` -> resolution inputs; `apps/api/src/features/delivery/deliveryRules.ts` -> pure-rule module style -> match structure
- acceptance: pure functions `resolveTierDiscountPct`,`resolveUnitPriceCents`,`perTonneCents`,`validateMoq`; boundary + rounding unit tests pass; no IO/side effects
- non-goals: no cart/checkout wiring (P5); no repository/mapper (P4); no DB
- upstream inputs: P2 -> `pricing` constants + types
- changes:
  - implement resolution per Decisions (tonne-band discount, half-up rounding, MOQ weight floor, per-tonne derivation from base)
  - test edges: 4.99/5.0/9.99/10.0 tonnes; MOQ 3 vs 4 sacks; pallet clears floor; qty 0/1; rounding
- invariants: integer minor units; deterministic; base-price input (pre-tier) for per-tonne
- test duty: `npm exec -w @shop/api -- tsx --test src/features/pricing/pricingRules.test.ts`; evidence `EV-P3-pricing` (QA hotspot)
- verification: all boundary tests green
- handoff: interface pricing pure API -> P4 (perTonne/tiers), P5 (resolve/MOQ)
- review: R3 (high-risk money) blocks G2

### P6: Catalog seed rework to sack/pallet + copy drop

- mode: parallel with P3 after G1
- depends on: G1 (P1 `moq_sacks` col; P2 constants)
- owns: `packages/catalog/src/model.ts`, `packages/catalog/src/categories/*.ts` (6), `packages/catalog/src/catalog.test.ts`, `apps/api/src/db/seed.ts`
- reads: `packages/catalog/src/model.ts` -> `makeVariant`,`CatalogProduct`,freight threshold -> extend; `apps/api/src/db/seed.ts` -> `upsertVariant`,assertions -> add `moq_sacks`, reword; `packages/catalog/src/validateCatalog.ts` -> catalog invariants
- acceptance: every canonical product exposes uniform 25kg sack (25000) + 1 pallet (1_000_000) variants, all `freight`, per-material USD pricing (sugar-low->cement/specialist-high), `moqSacks=4`; names/descriptions powder-free industrial voice; `validateCatalog` + `npm run reset` + catalog tests pass
- non-goals: no pricing-resolution logic; no web; no Custom Powder catalog semantics beyond variant reshape; do not touch `bundles.ts` component SKUs unless variant SKU rename forces it (if so, update in-place)
- upstream inputs: P1 -> `moq_sacks` col; P2 -> pack constants (weights reference)
- changes:
  - `model.ts`: optional `moqSacks` on `makeVariant`/`CatalogVariant` (default 4); keep freight derivation
  - each category file: replace variant sets with sack+pallet pair per product; set USD prices; rewrite names/descriptions dropping "powder"->"material", industrial tone
  - `seed.ts`: `upsertVariant` writes `moq_sacks`; assertion strings reword
  - update catalog tests/fixtures for new variant shape
- invariants: idempotent seed; canonical-ID upsert; preserve non-seed rows; weights ∈ {25000,1_000_000}; SKU uniqueness; bundle component SKUs resolve
- test duty: `npm test -w @shop/catalog`; `npm run reset`; evidence `EV-P6-catalog`,`EV-P6-reset`
- verification: catalog validation + reset clean; no "powder" in canonical names/descriptions
- handoff: interface reshaped catalog + seed -> P4/P5 (data), web lanes (display data)
- review: R6 (data integrity + copy) blocks G2

### P4: Catalog read path surfaces pricing fields

- mode: parallel with P5 after G2
- depends on: G2 (P3 pricing helpers, P2 contract, P1 col)
- owns: `apps/api/src/features/catalog/productRepository.ts`, `apps/api/src/mappers/product.ts`, colocated catalog tests (`apps/api/src/features/catalog/*.test.ts` for mapping)
- reads: `apps/api/src/features/catalog/productRepository.ts` -> variant row select/shape -> add `moq_sacks`; `apps/api/src/mappers/product.ts` -> variant->`CatalogVariant` map -> emit `moqSacks`,`perTonneCents`,`priceTiers`; `apps/api/src/features/pricing/pricingRules.ts` -> `perTonneCents`,ladder
- acceptance: product GET responses include `moqSacks`,`perTonneCents`,`priceTiers` per variant; values match pricing rules; contract validation of responses passes
- non-goals: no cart/checkout (P5); no price mutation; no web
- upstream inputs: P1 col; P2 fields; P3 `perTonneCents`+`TIER_LADDER`
- changes:
  - repository variant select includes `moq_sacks`
  - mapper computes per-tonne + tiers, emits new fields
  - update/extend catalog mapping tests
- invariants: read-only; server-authoritative values; no web import of api
- test duty: `npm exec -w @shop/api -- tsx --test <catalog mapping test>`; evidence `EV-P4-readpath`
- verification: focused test green; response schema-valid
- handoff: interface variant transport w/ pricing fields -> P8
- review: R4 (contract-surface correctness) blocks G3

### P5: Cart + checkout tier pricing + MOQ enforcement

- mode: parallel with P4 after G2
- depends on: G2 (P3 rules, P2 contract)
- owns: `apps/api/src/features/cart/cartService.ts`, `apps/api/src/features/cart/cartRepository.ts` (if add-quantity path needed), `apps/api/src/features/checkout/checkoutQuote.ts`, `apps/api/src/routes/cart.ts`, checkout MOQ re-validation site, colocated + `apps/api/test/` cart/checkout integration
- reads: `apps/api/src/features/cart/cartService.ts` -> `getCart`,`addItem`,`updateItem` -> tier totals + MOQ; `apps/api/src/features/cart/cartRepository.ts` -> `addLine`/`addLineQuantity`,`listLines` -> quantity path + variant weight/moq; `apps/api/src/features/checkout/checkoutQuote.ts` -> `unitPriceCents`,`lineTotalCents` -> resolved values; `apps/api/src/routes/cart.ts` -> string-code mapping -> add `BELOW_MOQ`->400 + thread `quantity`; `apps/api/src/features/pricing/pricingRules.ts` -> resolve/validate
- acceptance: cart line totals + subtotal use tier-resolved unit price; add/update reject below-MOQ (`BELOW_MOQ`->400); `add` honors quantity (default MOQ floor); checkout re-validates MOQ + uses resolved totals; existing delivery/promo/inventory behavior intact; cart + checkout integration tests pass
- non-goals: no catalog read mapper (P4); no web; no schema; no new quote object; no promo redesign
- upstream inputs: P3 rules; P2 `AddToCartBody.quantity`+`BELOW_MOQ`
- changes:
  - `getCart`: resolve unit price per line via pricing rules; recompute line/subtotal
  - `addItem`/`updateItem`: MOQ validation -> `BELOW_MOQ`; add-with-quantity
  - `routes/cart.ts`: thread quantity, map `BELOW_MOQ`->400
  - `checkoutQuote`: consume resolved values; MOQ re-check
  - integration tests: tier boundaries, MOQ reject/accept, checkout total, pallet vs sack lines
- invariants: backend authoritative money; variant/SKU-scoped; transaction owner covers full invariant; integer minor units; no mutable module-global cart state; seeded-DB counts scoped to test-owned identifiers
- test duty: `npm test -w @shop/api` (cart+checkout scope) or focused `tsx --test` files; evidence `EV-P5-cartcheckout`
- verification: integration green; MOQ + tier + checkout totals correct
- handoff: interface resolved cart/checkout + `BELOW_MOQ` -> P9
- review: R5 (high-risk money/inventory/transaction/route) blocks G3

### P7: Brand + shell rebrand + live-trading teaser

- mode: parallel with P8,P9,P10 after G3
- depends on: G3 (backend stable) — actually copy-only, needs only P2 brand context; gated at G3 for single web fan-out
- owns: `apps/web/index.html`, `apps/web/src/components/Header.tsx`, `apps/web/src/features/home/*`, `apps/web/src/components/home/*`, `apps/web/src/components/CategoryNav.tsx`, `apps/web/src/components/nav/navItems.ts` (brand entries only, NOT customPowder), colocated tests
- reads: `apps/web/src/components/Header.tsx` -> wordmark + tagline slot; `apps/web/index.html` -> `<title>`/meta; `apps/web/src/components/home/HeroSection.tsx` -> hero copy; this plan "Copy and Terminology" + Decisions tagline
- acceptance: wordmark -> `QArefully Materials Exchange`; `<title>`/meta updated; hero/home industrial voice + tagline; live-trading "coming next" teaser present (non-functional); shell/home powder-free; colocated brand tests updated + pass
- non-goals: do NOT modify `customPowderItem` label/route; do NOT touch `features/powderizer`,`features/customPowder`; no pricing UI (P8/P9)
- upstream inputs: P2 brand constants (if any); "Copy and Terminology" section
- changes: replace brand strings, title/meta, hero/nav copy; add live-trading teaser block; update HeroSection/HomePage/Header tests
- invariants: visual token system unchanged; Custom Powder surface untouched; accessibility preserved
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner <affected shell/home tests>`; evidence `EV-P7-shell`
- verification: focused component tests green; no powder in shell/home strings
- handoff: brand shell -> S1
- review: R7 (may group w/ P10 low-risk copy, see Review Assignments) blocks G4

### P8: Product page pack/pallet + $/tonne + MOQ UX

- mode: parallel with P7,P9,P10 after G3
- depends on: G3 (P4 read-path fields)
- owns: `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/product/ProductSpecifications.tsx`, `apps/web/src/features/product/ProductPage.tsx` (copy only), colocated product tests
- reads: `apps/web/src/features/product/ProductPurchasePanel.tsx` -> variant selector,price/stock/CTA/handling copy,add flow -> rework; `packages/contracts/src/products.ts` -> `CatalogVariant.moqSacks/perTonneCents/priceTiers`; `apps/web/src/lib/formatMoney.ts` -> `$/tonne` format; this plan "Copy and Terminology"
- acceptance: "Pack & pallet options"; each option shows pack price + `$/tonne` + total weight + tier ladder; stock as "X pallets available"/"X t on hand"; MOQ quantity input w/ client hint; "Add to order"; freight ("pallet freight" + lead time) copy; "Material · {category}"; server `BELOW_MOQ` surfaced; consumption badges retained; product tests updated + pass
- non-goals: do NOT recompute authoritative price (use server `perTonneCents`/resolved); no cart/checkout page (P9); Custom Powder untouched
- upstream inputs: P4 variant fields; P2 `quantity`/`BELOW_MOQ`
- changes: rework `VariantSelector` labels/price/`$/tonne`/weight/stock/tiers; add quantity input honoring `moqSacks`; reword handling/delivery/CTA/eyebrow/detail list per map; retain badges; update tests
- invariants: server-authoritative money; a11y (labels, radio/inputs); loading/empty/error states preserved; badges unchanged
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/product/*.test.tsx`; evidence `EV-P8-product`
- verification: component + a11y tests green; `$/tonne`+weight+MOQ rendered
- handoff: product UI -> S1
- review: R8 (pricing display correctness) blocks G4

### P9: Cart + checkout web rebrand + $/tonne + MOQ surface

- mode: parallel with P7,P8,P10 after G3
- depends on: G3 (P5 resolved totals + `BELOW_MOQ`)
- owns: `apps/web/src/features/cart/CartPage.tsx`, `apps/web/src/components/CartSheet.tsx`, `apps/web/src/features/checkout/CheckoutSummary.tsx`, `apps/web/src/features/checkout/CheckoutPage.tsx`, `apps/web/src/hooks/useCart.ts` (error surface only if needed), colocated cart/checkout tests
- reads: `apps/web/src/features/cart/CartPage.tsx` + `CartSheet.tsx` -> line/qty/subtotal copy -> `$/tonne`+weight+pallet wording; `apps/web/src/features/checkout/CheckoutSummary.tsx`+`CheckoutPage.tsx` -> totals/copy; `apps/web/src/hooks/useCart.ts` -> add/update flow -> quantity + `BELOW_MOQ` error; this plan "Copy and Terminology"
- acceptance: cart/checkout show pack price + `$/tonne` + total weight; pallet-quantity wording ("Adjust pallet quantities before checkout", "Lines held in your order for this session"); MOQ error surfaced on add/update; totals from server resolved values; simulated-payment/freight copy reframed; tests updated + pass
- non-goals: no authoritative recompute; no checkout mechanic change; no new quote; Custom Powder cart items (`PowderMixCartLineItem`) copy left as-is (out-of-scope feature)
- upstream inputs: P5 resolved totals + `BELOW_MOQ`; P2 quantity
- changes: reword cart/checkout copy per map; render `$/tonne`+weight; thread quantity + MOQ error; update tests
- invariants: server-authoritative totals; stale-response/cancellation handling in async cart preserved; Custom Powder line component untouched
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/cart/*.test.tsx apps/web/src/features/checkout/*.test.tsx`; evidence `EV-P9-cartcheckout`
- verification: tests green; MOQ error path covered
- handoff: cart/checkout UI -> S1
- review: R9 (pricing display + error path) blocks G4

### P10: Content/help/nav terminology sweep

- mode: parallel with P7,P8,P9 after G3
- depends on: G3
- owns: `apps/web/src/features/help/content/*` (EXCEPT powder-guidance/Powderizer articles), `apps/web/src/features/help/HelpIndexPage.tsx` (non-Powderizer copy), category description strings surfaced in web, misc user-facing "powder" nouns outside P7-P9 + Custom Powder
- reads: grep `powder`/`Powder` across `apps/web` -> classify: in-scope copy vs Custom Powder feature (skip); this plan "Copy and Terminology"
- acceptance: user-facing "powder"->"material" in help/content/nav (excluding Custom Powder feature articles + `customPowderItem`); industrial voice; tests updated + pass
- non-goals: do NOT touch `features/powderizer`,`features/customPowder`,`powderMixBagScheme`, powder-guidance help articles, `customPowderItem`; no pricing/brand-shell (P7)
- upstream inputs: none beyond copy
- changes: reword eligible copy; update affected tests
- invariants: Custom Powder surface untouched; help routing intact
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner <affected help/content tests>`; evidence `EV-P10-content`
- verification: focused tests green; residual "powder" only in Custom Powder + intentional feature surface
- handoff: content -> S1
- review: R10 (may group w/ R7 low-risk copy) blocks G4

### S1: Convergence integration + full verification

- mode: sequential after G4
- depends on: P7,P8,P9,P10,P4,P5,P6, G4
- owns: `apps/web/src/features/catalog/CatalogProductJourney.integration.test.tsx` + any cross-lane/shared brand-string test needing reconciliation; no feature-logic edits
- reads: all lane handoffs (accepted change sets) -> interfaces only; run-state evidence ledger
- acceptance: cross-lane brand/pricing journey consistent; no residual out-of-scope "powder" (excl Custom Powder); `npm run verify` passes once; `npm run smoke` optional broad check
- non-goals: no new behavior; no scope expansion; no Custom Powder edits
- upstream inputs: P4,P5,P6 backend; P7-P10 web
- changes: reconcile integration/journey tests to B2B copy + pricing; resolve any cross-file brand-string conflicts
- test duty: `npm run verify` (broad, once after fixes settle); evidence `EV-S1-verify`
- verification: full verify green; deterministic
- handoff: completion evidence -> G5
- review: R11 convergence review (integration behavior not covered by earlier packet reviews) blocks G5

## Review Assignments

Each reviewer: invoke `code-reviewer` skill (`review_skill=code-reviewer`), apply its severity gate (critical+high only) + verification-before-reporting duty; map surviving findings into `reviewer_report_v1`; inspect-only; assess supplied evidence, run only if stale/missing blocks verdict.

### R1: Review P1 migration
- target: P1 change set (`019_variant_moq.ts`, `migrations/index.ts`)
- timing: immediately after P1 settles; blocks G1
- reads: `018` (pattern), `019` (new), `index.ts`
- acceptance/invariants: ordered, idempotent, data preserved, FK-check clean, default 4, registered post-018
- risk focus: data loss, migration ordering, non-idempotency
- supplied evidence: `EV-P1-reset`
- return: `reviewer_report_v1`

### R2: Review P2 contracts
- target: P2 change set (`pricing.ts`,`products.ts`,`cart.ts`,`index.ts`,tests)
- timing: after P2 settles; blocks G1
- reads: changed contract files + tests
- acceptance/invariants: additive, `additionalProperties:false` intact, subpath exports correct, no catalog->contracts cycle, types sound
- risk focus: breaking existing consumers, schema/type drift
- supplied evidence: `EV-P2-contracts`

### R3: Review P3 pricing domain
- target: P3 change set (`pricingRules.ts`+test)
- timing: after P3 settles; blocks G2
- reads: `pricingRules.ts`, test, `pricing.ts` consts
- acceptance/invariants: correct tonne-band edges, half-up rounding, MOQ weight floor, per-tonne from base, purity
- risk focus: money rounding, boundary off-by-one, sign/zero-qty
- supplied evidence: `EV-P3-pricing`

### R4: Review P4 read path
- target: P4 change set (`productRepository.ts`,`mappers/product.ts`,tests)
- timing: after P4 settles; blocks G3
- reads: repository select, mapper, `pricingRules` per-tonne/ladder
- acceptance/invariants: fields emitted, values match rules, response schema-valid, read-only
- risk focus: wrong per-tonne/tier derivation, missing fields
- supplied evidence: `EV-P4-readpath`

### R5: Review P5 cart/checkout
- target: P5 change set (cart service/repo, checkoutQuote, routes/cart.ts, tests)
- timing: after P5 settles; blocks G3
- reads: changed cart/checkout/route files, `pricingRules`
- acceptance/invariants: resolved totals authoritative, MOQ reject/accept correct, `BELOW_MOQ`->400, quantity threaded, checkout re-validates, transaction integrity, delivery/promo/inventory intact
- risk focus: money correctness, MOQ bypass, transaction boundary, error mapping, stale global state
- supplied evidence: `EV-P5-cartcheckout`

### R6: Review P6 seed/catalog
- target: P6 change set (`model.ts`, 6 category files, `seed.ts`, catalog tests)
- timing: after P6 settles; blocks G2
- reads: model, category files, seed upsert/assertions, validateCatalog
- acceptance/invariants: uniform sack+pallet, freight, USD pricing, moq 4, idempotent canonical upsert, non-seed preserved, SKU unique, bundle SKUs resolve, powder-free names/descriptions, weights ∈ {25000,1_000_000}
- risk focus: seed data integrity, non-idempotency, broken bundle refs, residual powder copy
- supplied evidence: `EV-P6-catalog`,`EV-P6-reset`

### R7: Review P7 brand/shell (+ R10 group)
- target: P7 change set (+ P10 if grouped)
- timing: after P7 (and P10) settle; blocks G4
- consolidation reason: P7+P10 both low-risk copy-only, disjoint files (shell/home/nav vs help/content), independently identifiable targets, no consumer before G4 — group permitted
- reads: changed shell/home/nav (+help/content) files + tests
- acceptance/invariants: brand correct, live-trading teaser non-functional, powder-free (excl Custom Powder), Custom Powder untouched, a11y intact
- risk focus: accidental Custom Powder edits, residual old brand, broken teaser routing
- supplied evidence: `EV-P7-shell` (+`EV-P10-content`)

### R8: Review P8 product page
- target: P8 change set (product panel/specs/page + tests)
- timing: after P8 settles; blocks G4
- reads: `ProductPurchasePanel.tsx`, contract variant fields, formatMoney
- acceptance/invariants: server-authoritative `$/tonne`/totals (no client recompute), MOQ input+error, weight/pallet copy, badges retained, a11y
- risk focus: client-side price recompute drift, MOQ UX bypass, a11y regressions
- supplied evidence: `EV-P8-product`

### R9: Review P9 cart/checkout web
- target: P9 change set (cart/checkout web + useCart + tests)
- timing: after P9 settles; blocks G4
- reads: cart/checkout web files, useCart flow
- acceptance/invariants: server-resolved totals, MOQ error surfaced, pallet wording, async stale/cancel handling preserved, Custom Powder line untouched
- risk focus: total drift, unhandled `BELOW_MOQ`, stale-response bugs
- supplied evidence: `EV-P9-cartcheckout`

### R10: Review P10 content sweep
- note: default grouped into R7 (see consolidation reason). If ownership/targets diverge at runtime, split to standalone R10 with same policy.

### R11: Convergence review
- target: S1 integrated result (journey/integration tests + reconciled brand strings)
- timing: after S1 fixes settle; blocks G5
- reads: integration test + cross-lane interfaces
- acceptance/invariants: end-to-end B2B journey coherent, no out-of-scope residual powder, verify green
- risk focus: cross-lane integration defects not covered by packet reviews
- supplied evidence: `EV-S1-verify`

## Ownership and Collision Rules

- `apps/api/src/db/migrations/index.ts`: P1 only
- `packages/contracts/**`: P2 only (producer); all others read
- `apps/api/src/features/pricing/**`: P3 only (create); P4/P5 read
- `apps/api/src/db/seed.ts` + `packages/catalog/**`: P6 only
- `apps/api/src/mappers/product.ts` + `productRepository.ts`: P4 only
- `apps/api/src/features/cart/**` + `checkout/**` + `routes/cart.ts`: P5 only
- web dirs disjoint: P7 shell/home/nav-brand; P8 features/product; P9 features/cart+checkout+useCart; P10 help/content
- `navItems.ts`: P7 only (brand entries); `customPowderItem` immutable
- `CatalogProductJourney.integration.test.tsx` + cross-lane brand strings: S1 only
- Custom Powder feature (`features/powderizer`,`features/customPowder`,`powderMixBagScheme`,powder-guidance help,`customPowderItem`,`PowderMixCartLineItem`): NO packet edits
- migration versions: single new `019`; reserved by P1
- contract changes: P2 producer -> P3,P4,P5,P8,P9 consumers after G1
- composition: S1 sole integration owner

## Harness Role Binding

- Codex only: launch configured `worker` agent for implementation/fix/worker-verification; configured `reviewer` agent for reviews. Model/effort/instructions from global Codex settings; never override in plan/assignment.
- non-Codex: use harness-native role/subagent config; preserve worker/reviewer responsibilities + communication contracts.
- all harnesses: reviewer runs `code-reviewer` skill; assignment sets `review_skill=code-reviewer`; reviewer invokes it by name (skill carries `disable-model-invocation`).

## Test Execution Schedule

- `T-P1`: after P1 -> owner P1 -> `npm run reset` -> `EV-P1-reset`
- `T-P2`: after P2 -> owner P2 -> `npm test -w @shop/contracts` -> `EV-P2-contracts`
- `T-P3`: after P3 -> owner P3 -> `npm exec -w @shop/api -- tsx --test src/features/pricing/pricingRules.test.ts` -> `EV-P3-pricing`
- `T-P6`: after P6 -> owner P6 -> `npm test -w @shop/catalog` + `npm run reset` -> `EV-P6-catalog`,`EV-P6-reset`
- `T-P4`: after P4 -> owner P4 -> focused catalog mapping `tsx --test` -> `EV-P4-readpath`
- `T-P5`: after P5 -> owner P5 -> `npm test -w @shop/api` (cart/checkout) -> `EV-P5-cartcheckout`
- `T-P7..P10`: after each -> owner packet -> focused `vitest run --configLoader runner <files>` -> `EV-P7..P10`
- `T-S1`: after all fixes settle -> owner S1 -> `npm run verify` once -> `EV-S1-verify`
- reuse: valid evidence reused if no invalidating file/dep/migration/contract/config/fixture changed; new session alone never invalidates; give each agent only its ledger entries
- invalidation: `packages/contracts/**` change -> invalidate P3/P4/P5/P8/P9 evidence; `pricingRules.ts` change -> invalidate P4/P5 + `EV-P3`; `seed.ts`/`catalog` change -> invalidate `EV-P6-reset`,integration; migration change -> invalidate reset + downstream integration; rerun smallest affected then `verify` only if final result affected

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages + JSON string values
- transport: inline canonical JSON; temp artifacts only under protocol (bulky logs/diffs) at `[temp]/orchestrator/[run_id]/[packet_id]/[artifact]` w/ inline summary+path+sha256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`; reviewer: `reviewer_assignment_v1`; follow-up: `orchestrator_directive_v1`; worker return: `worker_report_v1`; reviewer return: `reviewer_report_v1`; recovery: `orchestrator_run_state_v1`
- reviewer method: `code-reviewer` skill via `review_skill=code-reviewer`
- worktree context: every assignment carries absolute path + impl branch + base revision; all repo-relative paths resolve under worktree root; commands run with worktree cwd
- templates: canonical `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`; record shapes `references/communication-record-shapes.md` when object arrays non-empty
- run-state: `[temp]/orchestrator/[run_id]/state.json`; atomic replace; update after accepted report/directive/finding/decision/handoff/invalidation

## Orchestrator Run Order

1. End planning context after saving plan.
2. Fresh runtime orchestrator; load source repo instructions, plan, canonical contracts, checkpoint.
3. Record `main`@`5625b7b`; handle detached-HEAD / relevant-uncommitted blocker.
4. Create impl branch + worktree from `main`@`5625b7b`; persist worktree identity.
5. Switch execution root to worktree; `npm ci` + post-install health.
6. Validate G0; project role-minimum + worktree context.
7. Launch P1 || P2; review R1,R2; validate G1 (+ assumptions).
8. Launch P3 || P6; review R3,R6; validate G2.
9. Launch P4 || P5; review R4,R5; validate G3.
10. Launch P7 || P8 || P9 || P10; review R7(+R10),R8,R9; validate G4.
11. Launch S1; run `verify` once; review R11; validate G5.
12. Route findings via worker fix directives (finding IDs) + targeted evidence; close before downstream.
13. Leave impl branch + worktree intact. Reply: abs worktree path + impl branch + source `main` + base `5625b7b`; user owns merge.

## Risks and Open Questions

- risk: tier tonne-banding rule mis-set (sacks never discounting surprises buyers) -> mitigation: validate assumption at G1; P3 boundary tests; product-owner spot-check
- risk: client-side `$/tonne` recompute drifts from backend -> mitigation: server emits `perTonneCents`; web display-only; R8/R9 focus
- risk: MOQ bypass via direct add/update or checkout -> mitigation: enforce in service + re-check in checkout; R5 focus; integration reject tests
- risk: seed reshape breaks bundle component SKU refs -> mitigation: P6 keeps/updates SKUs in-place; R6 verifies bundle resolution; reset gate
- risk: accidental Custom Powder edits during copy sweep -> mitigation: explicit non-goals every copy packet; R7/R10 check residual scope
- risk: `deliveryClass` copy reframe drifts into enum/logic change -> mitigation: invariant enum untouched; freight derivation retained
- question: tagline final wording -> owner/gate: P7 worker uses proposed tagline (Decisions); orchestrator confirm at G4
- question: exact per-material USD price ranges -> owner/gate: P6 sets; R6 + orchestrator spot-check
- question: MOQ error transport (typed `BELOW_MOQ` code vs message) -> owner/gate: P2 decides; R2 gate

## Done Criteria

- brand `QArefully Materials Exchange` across wordmark/title/meta/home/shell
- uniform 25kg sack + 1000kg pallet variants, all freight, per-material USD pricing, moq 4
- backend-authoritative MOQ + tier pricing; below-MOQ rejected add/update/checkout; tier discounts at 5t/10t
- `$/tonne` + total weight shown on product/cart/checkout via `formatMoney`
- "powder"->"material" everywhere except Custom Powder feature (accepted residual)
- consumption badges + `deliveryClass` enum + DB values unchanged; data preserved through `019`
- live-trading "coming next" teaser present, non-functional
- Custom Powder feature untouched (separate plan)
- `npm run verify` green once at G5; focused packet evidence green; seed idempotent + reset clean
- no new quote object/state; cart+checkout mechanics reused
