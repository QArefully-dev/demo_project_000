# Powder Shop Repurposing Coding Plan

Status: proposed
Source: `plans/powder_shop_repurposing_decisions.md` -> `Powder Shop Repurposing Decisions`
Repository baseline: `remove_crazy_stuff` at `b84f7ac700e88c6e04bed0fbe94419f8314fe48c`, inspected 2026-07-19

## Runtime Worktree

- source: `C:\Users\iwano\Desktop\repos\demo_project_000` -> named runtime branch + recorded `HEAD`
- baseline blocker: updated coding plan must exist in selected branch `HEAD`; source decision file already exists at recorded baseline
- dirty-input gate: relevant uncommitted or untracked source changes absent from `HEAD` -> stop and ask user to commit them or choose baseline
- unrelated source-checkout changes: ignore unless user adds them to runtime scope
- create: dedicated `codex/powder-shop-repurposing-<run-id>` branch + worktree before implementation write
- execution root: all worker, reviewer, test, fix, convergence activity runs in worktree
- integration: no merge, rebase, cherry-pick, copy-back, worktree deletion, or branch deletion; user handles integration
- completion reply: absolute worktree path + implementation branch + source branch + base revision

## Objective

Replace absurd catalog and mixing fiction with credible own-label powder shop while preserving familiar commerce and QA exercise boundaries. Deliver 100 real-world base products across six flat categories, purchasable pack variants, deterministic parcel/freight delivery, professional Custom Powder compatibility controls, grounded bundles, restrained storefront copy, migration-safe existing data, deterministic reset, and passing repository gates.

Completion boundary: customer can browse credible products, select actual pack SKU, add ordinary or compatible custom powder lines, see delivery classification and charge, complete simulated checkout, inspect variant/delivery snapshots in order history, and use existing commerce without impossible or comedic content.

## Scope

### In

- six categories: Sports Nutrition, Baking & Pantry, Drinks, Household & Cleaning, Garden & Outdoors, Trade & Creative Materials
- 100 canonical base products; credible conversions reuse existing canonical IDs; new products use non-colliding reserved IDs
- shared core facts + typed category facts + explicit consumption classification + handling guidance
- true variants with SKU, pack label, weight, price, stock, backorder policy, delivery class
- variant selection across product, cart, bundle, inventory, checkout, order, cancellation, return restoration
- deterministic parcel/freight mode and charge; mixed carts remain supported; no quote workflow
- Custom Powder customer rename, same-group compatibility, 100% ratio, combined ingredients/allergens/use/safety facts, featured blend, saved history, cart and checkout
- professional curated bundles with separately packaged variants
- `en-US` and USD constants exposed through explicit formatting/config boundaries
- grounded home, catalog, product, help, seed, README, high-level plan, tests
- compatibility reads/redirects for existing carts, orders, saved Custom Powder history, `/powderizer`, `/api/powderizer/*`, and `powderizer-v1` snapshots

### Out

- translation, locale switcher, multi-currency, exchange rates, country-specific catalog behavior
- allergen or dietary catalog filters until separately approved
- toxic, explosive, controlled, prescription, or licensed products
- freight quote, carrier, warehouse, supplier, real payment, or external service
- formulation advice, medical claims, treatment claims, performance guarantees
- cross-group compatibility exceptions beyond initial equality rule
- admin catalog editor, variant editor, compatibility editor, or delivery-rule UI
- unique photo pipeline, remote assets, CDN, Docker, cloud dependency
- Reverse Process, object reconstruction, live trading, auctions, conceptual products
- broad new E2E/Playwright suite; focused browser QA only

## Repository Findings

- existing: `packages/catalog/src/model.ts` -> `CATALOG_CATEGORIES` contains seven old categories; `CONCEPTUAL_QUANTITY` converts fiction into blend stock; `createCatalogProducts()` marks every product mixable
- existing: `packages/catalog/src/catalog.ts` -> 50 canonical records; counts: Pantry Staples 7, Performance 6, Drinks 6, Household 7, Outdoors 6, Questionable 10, Impossible 8
- existing: `packages/catalog/src/categories/questionable.ts`, `packages/catalog/src/categories/impossible.ts` -> 18 conceptual products; additional novelty entries exist in household/outdoors
- existing: `packages/catalog/src/validateCatalog.ts` -> exact 50 products, 14 sale products, 50 mixable products, seven-category coverage, `Powdered Water` bestseller requirement
- existing: `packages/catalog/src/bundles.ts` -> product-only components; `outdoor-kit` and `questionable-assortment` retain novelty products
- existing: `apps/api/src/db/seed.ts` -> canonical range `1..50`; metadata deletion uses numeric range; IDs outside range remain local user data
- constraint: expanding canonical range to `1..100` would overwrite possible user-created IDs `51..100`; new canonical products require disjoint reserved IDs
- existing: `apps/api/src/db/migrations/001_initial.ts`, `002_catalog_columns.ts`, `015_inventory.ts` -> `products` row combines base merchandising, price, stock, pack identity; cart, reservations, allocations, receipts, movements reference product ID
- existing: `apps/api/src/features/catalog/productRepository.ts` -> `ProductRow` owns price/stock/backorder/mix fields; catalog queries return one purchasable row per product
- existing: `apps/api/src/mappers/product.ts` -> runtime packaging lookup depends on canonical `image_set_id`, not persisted row data
- existing: `packages/contracts/src/products.ts` -> `Product` exposes one price, stock state, pack, and optional mix unit; no variants, consumption enum, mixing group, or typed category facts
- existing: `apps/api/src/features/cart/cartService.ts` -> add/update/remove keys use product ID; line total uses `products.price_cents`
- existing: `apps/api/src/features/bundles/bundleService.ts` -> bundle price, availability, and atomic cart addition use product rows
- existing: `apps/api/src/features/inventory/inventoryTypes.ts` -> all demand, receipt, cancellation, return restoration keys use product ID
- existing: `packages/contracts/src/payments.ts` + `apps/api/src/features/checkout/checkoutQuote.ts` -> persisted quote versions 1-4; current total excludes delivery charge
- existing: `packages/contracts/src/orders.ts` + `apps/api/src/features/orders/orderRepository.ts` -> immutable product name/price snapshot exists; SKU, pack, delivery mode, and delivery charge absent
- existing: `packages/contracts/src/powderizer.ts` -> persisted v1/v2 snapshot compatibility, `PowderizerConfigResponse.dailyRecipe`, unrestricted eligible products, novelty colour schemes
- existing: `apps/api/src/features/powderizer/powderMixRules.ts` -> ratio and pricing rules strong; compatibility checks only `mixable`; usage label derives only `Not for consumption`
- existing: `apps/api/src/features/powderizer/powderizerService.ts` -> prices components from product row and canonical warning lookup; no explicit mixing group or combined facts
- existing: `apps/web/src/features/powderizer/PowderizerActions.tsx`, `powderizerRandom.ts`, `powderizerCopy.ts`, `IngredientReaction.tsx` -> Chaos Mix, arbitrary randomization, comedic Good for values, novelty reactions
- existing: `apps/web/src/App.tsx`, `components/CategoryNav.tsx`, `components/nav/navItems.ts` -> `/powderizer` and Powderizer customer label
- existing: `apps/web/src/components/home/HeroSection.tsx`, `CategoryTiles.tsx`, `HomePage.tsx` -> impossible hero, `We will powder anything`, novelty process/copy
- existing: `apps/web/src/features/product/ProductPurchasePanel.tsx` -> direct add using product ID; no variant authority
- existing: `apps/web/src/features/checkout/CheckoutSummary.tsx` -> merchandise subtotal/discount/total only; no delivery state
- existing: `README.md` and `plans/demo_project_high_level_plan.md` -> deliberate nonsense, impossible catalog, Reverse Process, trading, auctions conflict with selected direction
- reuse: TypeBox strict storage parsers in `packages/contracts/src/payments.ts` and `packages/contracts/src/powderizer.ts` -> add versioned reads without widening legacy shapes
- reuse: ordered idempotent migration pattern in `apps/api/src/db/migrations/`; SQLite transaction ownership in `apps/api/src/db/unitOfWork.ts`
- reuse: generic specification registry + persisted `product_specifications` -> retain filterable scalar facts; add strict typed details for non-scalar category facts
- reuse: `BagArtwork` generated local visuals -> 100 products need stable visual tokens, not 100 committed photos
- reuse: existing inventory reservation/finalization/cancellation/return transactions -> change key from product to variant without changing lifecycle semantics

## Decisions and Invariants

- product identity: `products` remains base merchandising/review/favourite/comparison authority
- variant identity: proposed `product_variants` owns purchasable SKU, pack, price, stock, backorder, weight, delivery class
- cart identity: line key becomes `variantId`; contract retains `productId` for navigation and audit context
- stable old URLs: `/products/:id` remains base-product route; existing canonical IDs `1..50` stay assigned and receive credible content
- new canonical IDs: use reserved `1001..1050`; never claim or rewrite possible local IDs `51..1000`
- canonical scoping: seed deletes/upserts metadata through explicit canonical ID and SKU sets; never `BETWEEN 1 AND 100`
- migration backfill: every existing product gets one default variant; current cart, inventory, order, return references map to that variant atomically
- legacy product commerce columns: retained only if SQLite compatibility requires them; no runtime write/read authority after fan-in; mark deprecated and test non-use
- reviews, favourites, comparison, similar products: base-product scoped
- bundles: each component selects exact variant; no implicit current default after canonical seed
- orders: snapshot product name, variant label, SKU, unit price, pack weight, consumption classification, delivery class; historical snapshots never remap to current catalog
- money: integer cents; backend owns prices, discount, freight charge, total
- delivery discount rule: promotion applies to merchandise subtotal only; delivery charge added after discount
- delivery classification: any freight-only variant -> freight; otherwise order weight threshold decides freight; custom mixes contribute bag weight
- delivery rules: pure deterministic config; no address, carrier, clock, or network dependence
- max canonical variant weight: `1_000_000` grams; only suitable trade products receive it
- Custom Powder ingredient authority: base product selection resolves server-owned `blendSourceVariantId`; ingredient pricing and stock consume that exact variant
- Custom Powder compatibility: all selected products require same non-null mixing group; null group is ineligible; no category-equality shortcut
- initial compatibility groups: `food-grade`, `cleaning`, `garden-treatment`, `cementitious-materials`, `casting-materials`, `pigments`, `theatrical-effects`, `absorbents`
- ratio: unique 2-5 ingredients, integer percentages, exact total 100; preserve current allocation and server price rules
- combined facts: union ingredients/allergens/safety statements in deterministic product-ID order; strongest consumption classification wins; no inferred claim
- Custom Powder compatibility: new writes use current contract/snapshot version; legacy `powderizer-v1` and snapshot v1/v2 remain strict readable inputs
- customer rename: canonical UI/API is `Custom Powder`; `/powderizer` redirects and `/api/powderizer/*` delegates during compatibility window; storage table names may remain to preserve migrations
- saved history: read old key once, validate, migrate to versioned Custom Powder key, remove invalid/fictional entries, never silently keep incompatible mixes
- specifications: shared core plus discriminated category detail; generic persisted filter rows remain only for approved filterable scalar fields
- filtering: preserve current search/category/sale/price/date/tag/approved specification filters; do not expose allergens/dietary attributes as filters
- locale: `en-US`; currency: USD; format through `Intl.NumberFormat`, not computation
- asset rule: reuse generated bag art; every canonical product gets unique stable `imageSetId`; variants reuse base art with pack label change
- safety: no highly hazardous products; every non-food product has explicit PPE/dust/application/storage facts as applicable
- course constraint: preserve frontend five-item promo gate, backend promotion rules, and `SAVE10`
- assumption for runtime validation: category target counts `20/20/15/15/15/15`; redistribution allowed only when credibility review records reason and total remains 100
- assumption for runtime validation: equality within mixing group is sufficient initial compatibility matrix
- open decision: freight weight threshold and parcel/freight charges must be approved at `G0`; architecture and tests use named config constants, not hidden literals
- open decision: exact product names, variant sets, prices, inventory, and presentation tokens may be authored by catalog worker under credibility/safety constraints and accepted at `G1`

## Target Design

### Catalog package

- `packages/catalog/src/model.ts` -> base `CatalogProduct`, `CatalogVariant`, `ConsumptionClassification`, `MixingGroup`, shared facts, discriminated category facts
- proposed category files: `categories/sportsNutrition.ts`, `bakingPantry.ts`, `drinks.ts`, `householdCleaning.ts`, `gardenOutdoors.ts`, `tradeCreative.ts`
- remove after consumer move: `categories/impossible.ts`, `questionable.ts`, old category modules with obsolete exports
- base facts: texture, colour, source, intended use, storage, consumption classification
- edible facts: ingredients, allergens, nutrition, serving size, dietary attributes; attributes display only
- sports facts: edible facts + source, flavour, servings, protein/carbohydrate facts where applicable
- garden facts: NPK, coverage, application, handling
- cleaning facts: surfaces, dosage, hazard/handling
- trade facts: composition, water ratio, coverage, setting time, PPE
- theatrical facts: approved application, cleanup, colour, particle appearance, PPE
- variant facts: stable SKU, label, weight grams, price cents, optional compare-at, stock, backorder, delivery class, active, sort order
- `validateCatalog()` -> exact base count, category target/redistribution record, explicit canonical IDs, unique slugs/art IDs/SKUs, real positive weights, allowed classifications/groups, required category facts, safe integer money/stock, valid default/blend-source variant, bundle variant integrity

### Persistence

- proposed migration: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts`
- `products` additions: `consumption_classification`, `mixing_group`, `details_json`, `default_variant_id`, `blend_source_variant_id`
- proposed `product_variants`: `id`, `product_id`, `sku`, `label`, `weight_grams`, `price_cents`, `compare_at_price_cents`, `stock_count`, `backorderable`, `backorder_lead_days`, `delivery_class`, `active`, `sort_order`, timestamps; unique SKU and product/sort constraints
- rebuild `cart_line_items` -> variant foreign key + `UNIQUE(cart_id, variant_id)`; keep derived product access through join
- rebuild inventory reservations, allocations, receipts, movements -> `variant_id`; preserve immutability triggers and idempotency
- extend bundle components -> exact `variant_id`; validate variant belongs to component product
- extend order lines -> nullable migration-time variant reference + immutable SKU/label/weight/classification/delivery-class snapshots
- extend orders -> `delivery_mode`, `delivery_charge_cents`, `delivery_weight_grams`
- migration copies current products into default variants, remaps current cart/inventory/order/return facts, validates row counts and foreign-key checks before dropping temporary tables
- seed upserts canonical base products by explicit ID and variants by stable SKU; updates backfilled default variant instead of orphaning existing carts
- persisted category details use strict JSON schema parse on read/write; invalid storage fails closed with exact integrity error

### Contracts and API

- `packages/contracts/src/products.ts` -> base product with variants, default variant, typed facts, classification, mixing group visibility, price range, base availability
- `packages/contracts/src/cart.ts` -> variant-scoped add/update/remove, line product + variant snapshot, delivery preview
- `packages/contracts/src/bundles.ts` -> exact variant per component
- proposed `packages/contracts/src/delivery.ts` -> `DeliveryMode`, `DeliveryClass`, `DeliverySummary`
- proposed `packages/contracts/src/customPowder.ts` -> professional names, compatibility error, combined facts, featured blend; legacy aliases remain in `powderizer.ts`
- `packages/contracts/src/payments.ts` -> strict `PersistedCheckoutQuoteV5`; v1-v4 remain unchanged and readable
- `packages/contracts/src/orders.ts` -> variant snapshots and delivery summary; old rows normalize to explicit legacy pack label
- product endpoints remain `/api/products`; detail returns all active purchasable variants
- cart body uses `variantId`; compatibility parsing of old `productId` accepted only when product has unambiguous default variant
- admin inventory receipt moves to `variantId`; old `productId` compatibility accepted only when one/default variant resolution is unambiguous
- canonical custom endpoints: `/api/custom-powder/config`, `/quote`, cart-scoped create/update/requote/remove
- compatibility custom endpoints: existing `/api/powderizer/*` delegate without divergent logic
- validation errors: `MIXING_GROUP_MISMATCH` includes selected product IDs and no safety-sensitive internal data

### Delivery and checkout

- proposed `apps/api/src/features/delivery/deliveryRules.ts` -> pure `quoteDelivery(lines, rules)`
- inputs: variant delivery class, unit weight, quantity; custom mix bag weight/quantity
- output: parcel/freight mode, charge cents, total weight, deterministic reason
- cart displays preview from current lines; checkout recomputes inside server-owned quote transaction
- persisted quote v5 freezes delivery facts before payment authorization
- payment, order, receipt, confirmation use same v5 total; replay uses saved quote
- order detail and history show parcel/freight and charge; historical v1-v4 quotes/orders normalize to parcel with stored total unchanged and zero separately recorded delivery charge
- cancellation and return refunds exclude original delivery charge unless separate future policy approves delivery refund

### Custom Powder

- retain package/API storage compatibility; customer naming becomes Custom Powder
- remove Chaos Mix, arbitrary randomizer, comedic reactions, Good for list
- featured blend replaces daily recipe; preset uses compatible real products and deterministic effective date
- intended use derives from canonical intended-use facts; component ingredients, allergens, and safety facts aggregate deterministically
- component picker groups/filters by mixing group and disables incompatible options with accessible explanation
- server rejects crafted cross-group requests at quote, create, update, requote, cart read, and checkout preparation boundaries
- existing saved incompatible cart mix becomes explicit requote/removal conflict; no checkout bypass
- Custom Powder remains non-returnable under current return policy; customer copy uses new name

### Web

- product cards show `From` price and aggregate availability; product page requires variant selection before cart add
- selected variant controls price, stock, backorder copy, pack facts, weight, delivery badge
- comparison remains base-product comparison; include default price range and category facts, not every SKU column
- cart line mutations use variant ID and render SKU/pack; bundle components retain individual pack labels
- checkout summary displays merchandise subtotal, discount, delivery mode/charge, total
- order pages render immutable variant and delivery snapshots
- canonical route `/custom-powder`; `/powderizer` redirects preserving supported `edit` query
- homepage uses core brand messages from source plan; six credible category visuals; no impossible CTA or novelty process
- help content explains food/non-food boundary, handling, delivery simulation, pack variants, Custom Powder compatibility

## Execution Graph

`G0 -> P1 -> R1 -> GR1 -> {P2 -> R2 -> GR2 || P3 -> R3 -> GR3} -> G1 -> P4 -> R4 -> GR4 -> P5 -> R5 -> GR5 -> P6 -> R6 -> GR6 -> P7 -> R7 -> GR7 -> G2 -> {P8 -> R8 -> GR8 || P9 -> R9 -> GR9 || P10 -> R10 -> GR10} -> G3 -> S1 -> {R11A || R11B} -> GR11 -> G4 -> G5`

- `G0`: branch/worktree/input and product-rule gate
- `GR1..GR10`: packet review gate; reviewer pass or all findings closed through fresh fix worker + targeted evidence before dependent launch
- `G1`: reviewed contracts + catalog + migration fan-in
- `G2`: reviewed backend API/commerce/custom/delivery gate
- `G3`: reviewed parallel web lane fan-in
- `GR11`: convergence review gate; both S1 reviewers pass or findings close
- `G4`: no open findings/blockers; evidence ledger current for final change set
- `G5`: reset, journey, broad verification, completion

## Work Packets

### P1: Freeze contracts and compatibility shapes

- mode: sequential after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/products.ts`, `cart.ts`, `bundles.ts`, `payments.ts`, `orders.ts`, `inventory.ts`, `returns.ts`, `powderizer.ts`, `index.ts`, proposed `delivery.ts`, proposed `customPowder.ts`, `packages/contracts/package.json`, `packages/contracts/test/**`
- reads: `packages/contracts/src/common.ts` -> shared money/ID types; current owned files -> strict legacy shapes; `apps/web/src/api/client.ts` -> successful-response validation
- acceptance: strict transport contracts describe base products, variants, delivery, Custom Powder; old checkout v1-v4 and mix snapshot v1/v2 parsers remain exact; package exports build
- non-goals: database, API route, UI implementation; compatibility alias removal
- upstream inputs: `G0` -> approved freight constant names, compatibility window, product/variant identity decisions
- changes:
  - add variant, delivery, consumption, mixing-group, structured-fact schemas
  - change cart/bundle/order current shapes to variant-aware contracts
  - add checkout quote v5; preserve v1-v4 definitions byte-for-behavior
  - add current Custom Powder names and compatibility aliases for existing PowderMix/Powderizer imports
  - define exact validation and error schemas for incompatible groups and legacy ambiguous variant resolution
- invariants: no widened legacy parser; integer money/weights; `additionalProperties: false`; no API source import
- relevant evidence: none
- test duty: `T1` -> `npm test -w @shop/contracts && npm run typecheck -w @shop/contracts`
- verification: exports resolve for current and new subpaths; storage parser tests cover v1-v5 and invalid cross-version data
- handoff: accepted TypeBox names/shapes consumed by P2-P10
- review: `R1` -> `GR1`

### P2: Author credible canonical catalog and bundles

- mode: parallel with `P3` after `GR1`
- depends on: `P1`, `R1`, `GR1`
- owns: `packages/catalog/src/**`, `packages/catalog/package.json`
- reads: `plans/powder_shop_repurposing_decisions.md` -> approved categories/families/safety/specifications; P1 contracts -> category/variant/group values; current category files -> reusable credible facts and stable IDs
- acceptance: 100 credible real powders/dry mixes across six categories; every product and variant passes validation; no conceptual quantity, impossible claim, novelty item, comedic copy, unsafe excluded product, or old bundle
- non-goals: persisted seed, API, UI, exact allergen/dietary filters, remote imagery
- upstream inputs: `GR1` -> reviewed contract change set; `G0` -> catalog authoring and freight constants
- changes:
  - replace seven-category registry with six categories
  - retain/convert IDs `1..50`; add new IDs `1001..1050`; record any category target redistribution reason
  - replace authoring model with base product + variants + typed details + explicit groups/classification
  - remove conceptual parser and universal `mixable=true`
  - extend stable created-at facts without assuming contiguous IDs
  - create professional bundles with exact component SKUs
  - rewrite validation around explicit canonical ID/SKU sets and required safety/category facts
  - replace fiction-coupled unit tests with credibility, counts, variants, max-weight, group, bundle, and deterministic-art tests
- invariants: no overwrite claim for IDs `51..1000`; unique slug/art/SKU; all weights physical; no product over 1 tonne; non-food warnings complete
- relevant evidence: `BASE-CATALOG-01` -> current 50/seven-category baseline at source revision
- test duty: `T2` -> `npm test -w @shop/catalog && npm run typecheck -w @shop/catalog`
- verification: repository `rg` over catalog finds no `Impossible|Questionable|conceptual quantity|Powdered Water|powdered-(wifi|gravity|moonlight)` except explicit negative test fixtures
- handoff: canonical products, variants, bundle definitions, approved ID/SKU sets, redistribution record
- review: `R2` -> `GR2`

### P3: Add migration-safe variant and delivery storage

- mode: parallel with `P2` after `GR1`
- depends on: `P1`, `R1`, `GR1`
- owns: proposed `apps/api/src/db/migrations/018_grounded_catalog_variants.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/test/db/migrations.integration.test.ts`
- reads: migrations `001`, `008`, `010`, `012`, `015`, `017` -> source columns/FKs/triggers; `apps/api/src/db/migrate.ts` -> ordering/error contract; P1 contracts -> snapshot fields
- acceptance: migration upgrades populated v17 DB without data loss, maps every live commerce reference to variant, passes FK check, remains idempotent through migration runner, rejects corrupt source state
- non-goals: canonical content upsert, repository/service changes, table-name cosmetic renames
- upstream inputs: `GR1` -> reviewed storage-facing fields; `G0` -> variant authority decision
- changes:
  - create product variants and product-level classification/detail/default/source references
  - backfill exactly one default variant per existing product
  - rebuild cart/inventory/bundle tables with variant keys and preserved constraints/triggers/indexes
  - extend order/order-line delivery and variant snapshot columns with safe historical defaults
  - copy and verify counts/identity before temporary-table removal
  - add populated legacy DB, user product IDs `51..1000`, carts, reservations, orders, returns, corrupt-row rollback tests
- invariants: transaction atomic; unknown migration errors surface; audit/order/payment facts unchanged; no ID-range deletion; old custom mix rows retained
- relevant evidence: `BASE-MIGRATION-01` -> migration list ends at `017`
- test duty: `T3` -> `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts`
- verification: `PRAGMA foreign_key_check` empty; before/after entity and ledger counts match; rollback fixture unchanged after forced failure
- handoff: schema v18 and backfill semantics for P4-P7
- review: `R3` -> `GR3`

### P4: Seed and expose base products with variants

- mode: sequential after reviewed fan-in `G1`
- depends on: `P2`, `R2`, `GR2`, `P3`, `R3`, `GR3`, `G1`
- owns: `apps/api/src/db/seed.ts`, `powderCatalog.ts`, seed scenario files, `apps/api/src/features/catalog/**`, `apps/api/src/mappers/product.ts`, `apps/api/src/routes/products.ts`, `apps/api/test/db/seed.integration.test.ts`, `apps/api/test/catalog/**`, `apps/api/src/db/powderCatalog.test.ts`, `apps/api/src/mappers/product.test.ts`
- reads: P2 catalog exports -> canonical facts/IDs/SKUs; P3 schema -> storage columns; `apps/api/src/features/reviews/**` and `favourites/**` -> base-product ownership
- acceptance: seed idempotently installs 100 canonical base products and variants, preserves local products/metadata, returns one base product with ordered variants, keeps reviews/favourites/comparison product-scoped
- non-goals: cart mutation, inventory reservation, Custom Powder, freight quote, web rendering
- upstream inputs: `GR2` -> reviewed catalog change set and explicit canonical sets; `GR3` -> reviewed schema change set
- changes:
  - replace numeric-range metadata operations with explicit canonical IDs
  - upsert products, variants, typed details, default/blend-source links, tags/specifications, bundle SKU links
  - update favourites/review/order fixtures to credible products and exact variants without rewriting existing mutable scenarios
  - add variant hydration and strict details parse to repository/mapper
  - remove canonical packaging lookup from mapper; persisted facts become transport authority
  - update list/filter/sort/bestseller/similarity behavior for base rows and variant price/availability aggregates
- invariants: seed preserves rows outside explicit canonical sets; normal seed never resets user stock/orders/reviews; base product URL identity stable
- relevant evidence: `T2`, `T3`
- test duty: `T4` -> `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts test/catalog/*.integration.test.ts src/db/powderCatalog.test.ts src/mappers/product.test.ts`
- verification: two consecutive seeds produce same canonical facts; local ID 51 fixture survives; API schema validation accepts all catalog responses
- handoff: product/variant repository interfaces and seeded variant IDs for P5-P10
- review: `R4` -> `GR4`

### P5: Move cart, bundles, and inventory to variant authority

- mode: sequential after `GR4`
- depends on: `P4`, `R4`, `GR4`
- owns: `apps/api/src/features/cart/**`, `inventory/**`, `bundles/**`, `apps/api/src/routes/cart.ts`, `bundles.ts`, `adminInventory.ts`, related `apps/api/test/cart/**`, `inventory/**`, `http/bundles.integration.test.ts`
- reads: P4 product repository -> variant lookup/aggregate; P3 schema -> variant FKs; `apps/api/src/features/returns/returnService.ts` -> restoration caller contract
- acceptance: ordinary cart, bundle atomic add, stock reservation, authorization, consumption, backorder, receipt, cancellation, and return restoration operate on exact variant
- non-goals: Custom Powder component rules, freight charge, web UI
- upstream inputs: `GR4` -> reviewed variant repository and seed change set
- changes:
  - change cart commands and audit facts to variant IDs while retaining product context
  - map line product + selected variant and use variant price/availability
  - make bundles resolve exact seeded component variants
  - change inventory domain/repository keys and error payloads to variants
  - preserve hard-demand-first, FIFO, expiry, idempotency, immutable movement semantics
  - add ambiguous legacy product-ID request rejection and unambiguous compatibility cases
- invariants: one transaction per cart/bundle/inventory invariant; no oversell; exact SKU receives/restores stock; return/cancellation never restores sibling variant
- relevant evidence: `T4`
- test duty: `T5` -> `npm exec -w @shop/api -- tsx --test test/cart/*.integration.test.ts test/inventory/*.integration.test.ts src/features/inventory/inventoryRules.test.ts`
- verification: concurrent final-stock test targets one variant; sibling SKU unchanged; bundle failure leaves cart untouched
- handoff: variant cart/inventory interfaces and evidence for P6/P7
- review: `R5` -> `GR5`

### P6: Enforce professional Custom Powder backend

- mode: sequential after `GR5`
- depends on: `P5`, `R5`, `GR5`
- owns: `apps/api/src/features/powderizer/**`, `apps/api/src/routes/powderizer.ts`, proposed `apps/api/src/routes/customPowder.ts`, `apps/api/test/powderizer/**`
- reads: P4 product/variant repository -> mixing facts/source variant; P5 inventory types -> variant demand; `apps/api/src/app.ts` -> composition read only; P1 Custom Powder contracts
- acceptance: quote/create/update/requote/config reject cross-group or missing-group components, derive combined facts, price/reserve designated source variants, expose featured blend, retain strict legacy read compatibility
- non-goals: checkout folder edits, customer UI, storage table cosmetic rename, formulation advice
- upstream inputs: `GR4` -> reviewed product facts/source variant; `GR5` -> reviewed variant inventory interface
- changes:
  - extend domain product with group, source variant, ingredients, allergens, use, safety
  - add group equality validation before allocation/pricing
  - change stock requirements from base product bags to source variant quantities
  - replace daily recipe naming/config with compatible featured blend
  - remove canonical static warning lookups; use persisted facts
  - write current Custom Powder snapshot/version while parsing old snapshots unchanged
  - register canonical route module; keep compatibility delegate in old route
- invariants: 100% and deterministic gram allocation unchanged; crafted API cannot bypass group rule; source price/stock server-owned; no health claims
- relevant evidence: `T4`, `T5`
- test duty: `T6` -> `npm exec -w @shop/api -- tsx --test src/features/powderizer/powderMixRules.test.ts test/powderizer/*.integration.test.ts`
- verification: same-group cross-category food mix passes; food+cleaning fails at quote/create/requote; inactive source variant fails closed; legacy order snapshot renders
- handoff: stable Custom Powder service/config/current snapshot for P7/P9
- review: `R6` -> `GR6`

### P7: Add delivery quote and integrate checkout, orders, returns

- mode: sequential after `GR6`
- depends on: `P5`, `R5`, `GR5`, `P6`, `R6`, `GR6`
- owns: proposed `apps/api/src/features/delivery/**`, `apps/api/src/features/checkout/**`, `apps/api/src/features/payments/**`, `apps/api/src/features/orders/**`, `apps/api/src/features/returns/**`, `apps/api/src/routes/payments.ts`, `orders.ts`, `returns.ts`, `adminOrders.ts`, `adminReturns.ts`, related `apps/api/test/checkout/**`, `orders/**`, `returns/**`
- reads: P5 variant cart/inventory -> line facts/allocations; P6 custom service -> mix weight/source requirements; P1 v5/order contracts; `apps/api/src/app.ts` -> composition read only
- acceptance: cart checkout freezes correct delivery mode/charge and exact variant snapshots; idempotent payment replay/order/return/cancellation preserve totals and variant inventory
- non-goals: real carriers, delivery quote workflow, delivery refund, web UI
- upstream inputs: `GR5` -> reviewed cart/inventory change set; `GR6` -> reviewed mix snapshot/weight interface; `G0` -> approved delivery constants
- changes:
  - implement pure delivery rule and boundary tests
  - create v5 checkout quote from merchandise, discount, delivery, variant lines, mix lines, inventory allocations
  - persist order delivery facts and variant snapshots; keep legacy normalization
  - update confirmation mailbox copy and audit facts without sensitive data
  - update cancellation/return restoration and refund calculations to exact variants; exclude delivery charge from merchandise proration
  - update seeded lifecycle/return scenarios with credible SKUs and parcel/freight examples
- invariants: saved quote controls authorized amount; promotion excludes delivery; replay never recalculates; order total equals subtotal-discount+delivery; old totals unchanged
- relevant evidence: `T5`, `T6`
- test duty: `T7` -> `npm exec -w @shop/api -- tsx --test test/checkout/*.integration.test.ts test/orders/*.integration.test.ts test/returns/*.integration.test.ts`
- verification: threshold-minus-one parcel, threshold freight, freight-only line, mixed cart, retry, cancellation, and returned sibling-SKU isolation cases pass
- handoff: backend-complete API and evidence for web lanes
- review: `R7` -> `GR7`

### P8: Build variant-aware catalog and product UI

- mode: parallel with `P9`, `P10` after reviewed backend gate `G2`
- depends on: `P7`, `R7`, `GR7`, `G2`
- owns: `apps/web/src/api/products.ts`, `hooks/useProducts.ts`, `useCategories.ts`, `useProductFilterOptions.ts`, `features/catalog/**`, `features/product/**`, `features/comparison/**`, `components/ProductCard.tsx`, `ProductMedia.tsx`, `ProductGrid.tsx`, related tests
- reads: P1 product contracts -> variant/fact shapes; P7 API -> accepted change set; `apps/web/src/lib/formatMoney.ts` -> current USD formatting
- acceptance: cards show grounded base products; product detail exposes accessible variant selection and adds exact variant; typed facts render; comparison remains usable
- non-goals: homepage/nav composition, Custom Powder, cart/checkout/order pages, global CSS
- upstream inputs: `GR7` -> reviewed backend contract/evidence; `GR2` -> reviewed category names/content
- changes:
  - update clients and hooks for new product contract
  - render price range/aggregate availability on cards
  - add required pack selector with price, SKU, stock/backorder, weight, delivery class
  - send selected `variantId`; handle stale/unavailable selection and retry
  - render grouped typed facts and explicit food/non-consumption label
  - update category/filter/comparison fixtures and accessibility tests
- invariants: no client price authority; no default add before valid variant; async stale response ignored; product ID remains URL identity
- relevant evidence: `T7`
- test duty: `T8` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/catalog src/features/product src/features/comparison src/components/ProductCard.test.tsx src/components/ProductMedia.test.tsx`
- verification: keyboard/radio selector, sold-out SKU, backorder SKU, freight badge, loading/empty/error states covered
- handoff: variant selection UI ready for S1 composition
- review: `R8` -> `GR8`

### P9: Repurpose Custom Powder web experience

- mode: parallel with `P8`, `P10` after reviewed backend gate `G2`
- depends on: `P7`, `R7`, `GR7`, `G2`
- owns: `apps/web/src/api/powderizer.ts`, proposed `apps/web/src/api/customPowder.ts`, `apps/web/src/features/powderizer/**`, proposed `apps/web/src/features/customPowder/**`, `apps/web/src/components/powderMixBagScheme.ts`, related tests
- reads: P1 Custom Powder contracts -> canonical/current aliases; P6 config/error behavior; `apps/web/src/hooks/CartContext.tsx` -> submit integration read only
- acceptance: customer sees professional Custom Powder builder, incompatible choices blocked/explained, server errors rendered, combined facts/featured blend/history work, novelty behavior absent
- non-goals: App/nav/home route wiring, cart line rendering, global CSS token cleanup
- upstream inputs: `GR6` -> reviewed Custom Powder service/config; `GR7` -> reviewed checkout-compatible snapshot
- changes:
  - create canonical client names while retaining old client compatibility wrapper
  - rename headings/actions/history labels to Custom Powder
  - remove `PowderizerActions`, `powderizerRandom`, `powderizerCopy`, `IngredientReaction`, `DailyRecipeCard` after replacements
  - add mixing-group-aware picker and accessible incompatible reason
  - render intended use, ingredients, allergens, handling/safety summary
  - replace daily recipe with featured blend
  - migrate versioned local history; discard incompatible/unknown product entries
  - keep percentage, bag, appearance, edit, retry, saved history behavior
- invariants: client guidance never substitutes server validation; no claim generation; history parser fail-closed; ratio UI exact
- relevant evidence: `T6`, `T7`
- test duty: `T9` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/powderizer src/features/customPowder`
- verification: compatible food blend, blocked food+cleaning, server-crafted mismatch, migrated history, invalid history, featured blend, reduced-motion/accessibility cases
- handoff: canonical Custom Powder page component and redirect requirements for S1
- review: `R9` -> `GR9`

### P10: Render variant, delivery, and Custom Powder purchase state

- mode: parallel with `P8`, `P9` after reviewed backend gate `G2`
- depends on: `P7`, `R7`, `GR7`, `G2`
- owns: `apps/web/src/api/cart.ts`, `payments.ts`, `orders.ts`, `returns.ts`, `bundles.ts`, `hooks/CartContext.tsx`, `useCart.ts`, `useBundles.ts`, `features/cart/**`, `features/checkout/**`, `features/orders/**`, `features/returns/**`, `features/bundles/**`, `components/CartLineItem.tsx`, `CartSheet.tsx`, related tests
- reads: P1 cart/order/delivery contracts; P7 API behavior; P9 current Custom Powder snapshot interface by accepted handoff only
- acceptance: cart/checkout/order/bundle/return views show exact pack SKU and delivery facts; mutations use variant; Custom Powder uses professional label; total math presentation matches backend
- non-goals: product selector, home/nav/help, global CSS, return-policy expansion
- upstream inputs: `GR7` -> reviewed backend purchase change set; `GR6` -> reviewed custom snapshot shape
- changes:
  - change ordinary cart actions/storage-facing state to variant ID
  - render product + pack/SKU/weight/delivery class on cart/bundle/order lines
  - display delivery preview and checkout frozen summary
  - format subtotal, discount, delivery, total with `en-US` USD formatter
  - update order/confirmation/return views for immutable snapshots and delivery-excluded refund language
  - preserve cart unavailable/reserved/requote/error flows
- invariants: UI never recomputes authoritative freight; line keys use variant; return selection remains order-line based; promo five-item frontend gate unchanged
- relevant evidence: `T7`
- test duty: `T10` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/cart src/features/checkout src/features/orders src/features/returns src/features/bundles src/hooks/useCart.test.tsx src/hooks/useBundles.test.tsx`
- verification: ordinary parcel, freight, mixed cart, backorder, failed payment retry, order snapshot, return rendering cases pass
- handoff: purchase UI ready for S1 composition
- review: `R10` -> `GR10`

### S1: Compose grounded storefront, compatibility routes, help, and docs

- mode: sequential convergence after reviewed web fan-in `G3`
- depends on: `P8`, `R8`, `GR8`, `P9`, `R9`, `GR9`, `P10`, `R10`, `GR10`, `G3`
- owns: `apps/api/src/app.ts`, `apps/web/src/App.tsx`, `components/CategoryNav.tsx`, `components/Header.tsx`, `components/Footer.tsx`, `components/nav/navItems.ts`, `components/home/**`, `features/home/**`, `features/help/**`, `apps/web/src/index.css`, `apps/web/src/lib/formatMoney.ts`, `README.md`, `plans/demo_project_high_level_plan.md`, cross-lane integration tests
- reads: accepted P8-P10 handoffs -> page/client names; source decisions -> brand/copy/non-goals; `CLAUDE.md` -> course/runtime constraints
- acceptance: one coherent grounded storefront and API composition; compatibility redirects/delegates work; docs and high-level direction no longer reintroduce impossible/trading fiction
- non-goals: new product behavior beyond accepted lanes; deleting legacy persisted snapshot readers; localization UI
- upstream inputs: `GR8`, `GR9`, `GR10` -> reviewed change sets/interfaces; `G3` -> reviewed web focused evidence
- changes:
  - register canonical and compatibility API routes once
  - wire `/custom-powder`; redirect `/powderizer` preserving query
  - update nav/home/hero/category tiles/store assurances with approved professional messages
  - remove impossible CTA, novelty process, Powderizer visual treatment/copy; keep restrained accessible design
  - update help/policy text for credible product facts, pack variants, Custom Powder safety, parcel/freight simulation
  - replace manual dollar formatter with `Intl.NumberFormat('en-US', { currency: 'USD' })`
  - update README seeded catalog, inventory receipt variant request, Custom Powder, delivery fixtures, credentials, reset behavior
  - revise high-level plan concept/current baseline/future order; remove Reverse Process, live trading, auctions, impossible examples; retain future localization only as grounded later scope
  - run repository fiction sweep and classify allowed compatibility identifiers versus customer-visible leftovers
- invariants: no customer-visible impossible/comedic copy; old URLs do not 404; course promo behavior preserved; no future feature promise contradicts source plan
- relevant evidence: `T8`, `T9`, `T10`
- test duty: `T11` -> `npm run test:integration -w @shop/web && npm run typecheck && npm run lint`
- verification: `rg` sweep has only compatibility code/migration/history references documented in allowlist; API/app composition starts without import side effects
- handoff: integrated change set, fiction sweep, compatibility allowlist, evidence for reviewers
- review: `R11A`; additional focus review `R11B` -> `GR11`

## Review Assignments

### R1: Review P1 contracts and compatibility

- target: `P1` -> exact worker base/head change set
- timing: immediately after P1 report + `T1`; before P2/P3 assignment
- blocks: `GR1`, P2, P3
- consolidation reason: none; one packet, one exact target
- reads: `packages/contracts/src/products.ts`, `cart.ts`, `payments.ts`, `orders.ts`, `inventory.ts`, `returns.ts`, `powderizer.ts`, proposed `delivery.ts`, proposed `customPowder.ts` -> public/storage shapes and exports
- acceptance: current schemas express variant/delivery/Custom Powder design; legacy checkout v1-v4 and mix v1/v2 parsers remain strict; consumers receive one coherent interface
- invariants: integer money/weights; `additionalProperties: false`; no widened legacy read; public export coverage
- risk focus: incompatible alias, optional field hiding authority, version parser accepting mixed shapes, package export omission
- non-goals: persistence or UI implementation; test rerun with valid `T1`
- write policy: inspect-only
- test policy: assess `T1`; run only when missing/stale evidence blocks verdict
- relevant evidence: `T1` -> P1 exact change set
- return: `reviewer_report_v1`; `GR1` blocks P2/P3 until pass or findings close through fresh fix worker + targeted evidence

### R2: Review P2 catalog credibility and validation

- target: `P2` -> exact worker base/head change set
- timing: immediately after P2 report + `T2`; parallel with R3; before `G1`
- blocks: `GR2`, `G1`, P4
- consolidation reason: none; one packet, one exact target
- reads: `packages/catalog/src/model.ts`, `catalog.ts`, `validateCatalog.ts`, category modules, `bundles.ts`, catalog tests -> content/model/validation
- acceptance: 100 real products, six categories, physical variants, typed facts, safe groups/classifications, professional bundles, no fiction
- invariants: IDs `1..50` retained; new IDs `1001..1050`; explicit canonical sets; unique SKU/slug/art; max 1 tonne
- risk focus: unsafe candidate, weak conversion, conceptual unit residue, missing handling fact, count/redistribution drift, invalid bundle SKU
- non-goals: persistence mapping, visual polish, allergen/dietary filters
- write policy: inspect-only
- test policy: assess `T2`; no rerun unless evidence blocks verdict
- relevant evidence: `T2` -> P2 exact change set
- return: `reviewer_report_v1`; `GR2` blocks `G1` until pass or findings close through fresh fix worker + targeted evidence

### R3: Review P3 migration integrity

- target: `P3` -> exact worker base/head change set
- timing: immediately after P3 report + `T3`; parallel with R2; before `G1`
- blocks: `GR3`, `G1`, P4
- consolidation reason: none; one packet, one exact target
- reads: proposed migration 018, migration index, migration integration tests, source migrations `001`, `008`, `010`, `012`, `015`, `017` -> copy/constraint/trigger/FK behavior
- acceptance: populated v17 upgrade preserves identities and facts, remaps live references, recreates constraints/indexes/triggers, rolls back corrupt input
- invariants: atomic migration; no user-ID overwrite; old orders/payments/audit/custom rows unchanged; `foreign_key_check` clean
- risk focus: table rebuild data loss, variant mismatch, missing trigger/index, default backfill ambiguity, temporary table cleanup before verification
- non-goals: canonical content seed, API repository behavior
- write policy: inspect-only
- test policy: assess `T3`; command only when missing/stale evidence prevents verdict
- relevant evidence: `T3` -> populated and rollback fixtures at P3 change set
- return: `reviewer_report_v1`; `GR3` blocks `G1` until pass or findings close through fresh fix worker + targeted evidence

### R4: Review P4 seed and catalog API authority

- target: `P4` -> exact worker base/head change set using reviewed P2/P3 inputs
- timing: immediately after P4 report + `T4`; before P5 assignment
- blocks: `GR4`, P5
- consolidation reason: none; one packet, one exact target
- reads: `apps/api/src/db/seed.ts`, seed scenarios, catalog repository/query, product mapper/routes, seed/catalog tests -> explicit-set seed and transport mapping
- acceptance: seed installs reviewed catalog idempotently, preserves local rows, exposes base products with ordered variants, keeps review/favourite/comparison product scope
- invariants: no range deletion; persisted facts map without canonical runtime lookup; base URL IDs stable; invalid details fail closed
- risk focus: local ID/metadata overwrite, duplicate variant after reseed, stock reset, static packaging authority, aggregate availability/price bug
- non-goals: cart/inventory mutations, web rendering
- write policy: inspect-only
- test policy: assess `T4` plus accepted `T2/T3`; rerun only stale/missing blocker
- relevant evidence: `T2`, `T3`, `T4` projected to P4 target
- return: `reviewer_report_v1`; `GR4` blocks P5 until pass or findings close through fresh fix worker + targeted evidence

### R5: Review P5 variant commerce and inventory

- target: `P5` -> exact worker base/head change set
- timing: immediately after P5 report + `T5`; before P6 assignment
- blocks: `GR5`, P6
- consolidation reason: none; one packet, one exact target
- reads: cart, inventory, bundle features/routes/tests; `apps/api/src/features/returns/returnService.ts` caller boundary -> variant key and transaction behavior
- acceptance: cart, bundle, reservation, consume, backorder, receipt, cancellation, return restoration affect exact SKU only
- invariants: atomic mutations; no oversell; hard-demand/FIFO/idempotency preserved; immutable movement ledger; sibling variants isolated
- risk focus: product/variant ID confusion, bundle partial write, backorder sibling leakage, receipt/cancellation restoring wrong SKU, ambiguous legacy request
- non-goals: Custom Powder grouping, delivery charge, customer UI
- write policy: inspect-only
- test policy: assess `T5`; use `T4` only as upstream interface evidence; no duplicate run
- relevant evidence: `T4`, `T5` projected to P5 target
- return: `reviewer_report_v1`; `GR5` blocks P6 until pass or findings close through fresh fix worker + targeted evidence

### R6: Review P6 Custom Powder safety and compatibility

- target: `P6` -> exact worker base/head change set
- timing: immediately after P6 report + `T6`; before P7 assignment
- blocks: `GR6`, P7
- consolidation reason: none; one packet, one exact target
- reads: powderizer/custom feature and routes, focused tests, reviewed product/source-variant interface -> grouping, pricing, combined facts, legacy reads
- acceptance: every quote/mutation/requote rejects invalid groups, source variant drives price/stock, combined facts deterministic, featured blend credible, legacy snapshots readable
- invariants: ratio 100%; 2-5 unique products; server authority; no claim inference; no checkout-compatible stale unsafe mix
- risk focus: route alias divergence, client-only restriction, inactive source variant, cross-category same-group false rejection, legacy parser widening
- non-goals: checkout integration and customer UI
- write policy: inspect-only
- test policy: assess `T6` and relevant `T4/T5`; run only evidence blocker
- relevant evidence: `T4`, `T5`, `T6` projected to P6 target
- return: `reviewer_report_v1`; `GR6` blocks P7 until pass or findings close through fresh fix worker + targeted evidence

### R7: Review P7 money, delivery, checkout, and lifecycle integration

- target: `P7` -> exact worker base/head change set
- timing: immediately after P7 report + `T7`; before `G2` and web assignments
- blocks: `GR7`, `G2`, P8, P9, P10
- consolidation reason: none; one packet, one exact target
- reads: delivery, checkout, payments, orders, returns features/routes/tests; checkout quote v5 contract -> total, replay, snapshots, restoration
- acceptance: deterministic delivery freezes before authorization; order/payment/replay totals match; exact variant snapshots and restoration survive lifecycle; old quotes normalize without total change
- invariants: `total=subtotal-discount+delivery`; promotion/refund excludes delivery; replay never recalculates; transactions/idempotency intact
- risk focus: threshold boundary, mixed/cart weight omission, stale custom mix, delivery double-charge, legacy quote mutation, return/cancellation wrong variant
- non-goals: web presentation, real carrier/quote behavior
- write policy: inspect-only
- test policy: assess `T7` plus relevant `T5/T6`; run only stale/missing blocker
- relevant evidence: `T5`, `T6`, `T7` projected to P7 target
- return: `reviewer_report_v1`; `GR7` blocks `G2` and P8-P10 until pass or findings close through fresh fix worker + targeted evidence

### R8: Review P8 catalog and variant UI

- target: `P8` -> exact worker base/head change set
- timing: immediately after P8 report + `T8`; parallel with R9/R10; before `G3`
- blocks: `GR8`, `G3`, S1
- consolidation reason: none; one packet, one exact target
- reads: product clients/hooks, catalog/product/comparison features, ProductCard/ProductMedia tests -> variant selection and typed facts
- acceptance: cards show aggregates; detail requires exact valid variant; accessible selector covers stock/backorder/freight; add sends variant ID
- invariants: no client price/availability authority; product ID stays route identity; stale async response ignored
- risk focus: hidden default add, sold-out selection, price mismatch, broken comparison, missing keyboard label/error state
- non-goals: home/nav composition, cart/checkout rendering, global CSS
- write policy: inspect-only
- test policy: assess `T8`; no rerun with valid evidence
- relevant evidence: `T8` -> P8 exact change set
- return: `reviewer_report_v1`; `GR8` blocks `G3` until pass or findings close through fresh fix worker + targeted evidence

### R9: Review P9 Custom Powder UI

- target: `P9` -> exact worker base/head change set
- timing: immediately after P9 report + `T9`; parallel with R8/R10; before `G3`
- blocks: `GR9`, `G3`, S1
- consolidation reason: none; one packet, one exact target
- reads: custom/powderizer clients/features/tests, history parser/migration, picker/summary -> safety guidance and novelty removal
- acceptance: professional naming/copy, incompatible selections disabled and explained, server mismatch rendered, featured blend/history/ratio workflows function, novelty code removed
- invariants: server remains authority; no health/performance claim; history fail-closed; old storage migration bounded
- risk focus: compatibility bypass, inaccessible disabled options, stale fictional history, alias loop, hidden comedic fixture/copy
- non-goals: App/nav/home wiring, cart line rendering, global CSS
- write policy: inspect-only
- test policy: assess `T9`; relevant `T6/T7` supplied as interface evidence only
- relevant evidence: `T6`, `T7`, `T9` projected to P9 target
- return: `reviewer_report_v1`; `GR9` blocks `G3` until pass or findings close through fresh fix worker + targeted evidence

### R10: Review P10 purchase UI

- target: `P10` -> exact worker base/head change set
- timing: immediately after P10 report + `T10`; parallel with R8/R9; before `G3`
- blocks: `GR10`, `G3`, S1
- consolidation reason: none; one packet, one exact target
- reads: cart/checkout/order/return/bundle clients/features/hooks/tests -> exact variant and delivery presentation
- acceptance: mutations use variant; line snapshots render SKU/pack; delivery subtotal/charge/total match server; order/return wording accurate
- invariants: no freight recomputation; return remains order-line scoped; promo five-item gate unchanged; Custom Powder customer label professional
- risk focus: mismatched line key, wrong total display, sibling variant mutation, delivery omitted on replay/order, return refund wording
- non-goals: product selector, home/nav/help, global CSS
- write policy: inspect-only
- test policy: assess `T10`; relevant `T7` supplied without rerun
- relevant evidence: `T7`, `T10` projected to P10 target
- return: `reviewer_report_v1`; `GR10` blocks `G3` until pass or findings close through fresh fix worker + targeted evidence

### R11A: Review S1 integration and compatibility composition

- target: `S1` -> exact convergence base/head change set after reviewed P8-P10 fan-in
- timing: immediately after S1 report + `T11`; parallel with R11B; before `GR11`
- blocks: `GR11`, `G4`, final verification
- consolidation reason: none; one convergence target, functional integration focus
- reads: API `app.ts`, web `App.tsx`, nav/home/help composition, accepted lane interfaces, cross-lane integration tests -> registration, routing, customer journey
- acceptance: canonical routes registered once; compatibility routes redirect/delegate; reviewed lanes compose without contract drift; core journey works across boundaries
- invariants: no duplicate route; old query preserved; import side effects absent; no client authority introduced during composition
- risk focus: route collision, wrong component/client import, compatibility recursion, integration-only total/history bug
- non-goals: copy tone audit beyond functional contradiction; broad visual redesign
- write policy: inspect-only
- test policy: assess `T11` plus still-valid `T8-T10`; run only evidence blocker
- relevant evidence: `T8`, `T9`, `T10`, `T11` projected to S1 target
- return: `reviewer_report_v1`; `GR11` waits for R11A and R11B

### R11B: Review S1 copy, accessibility, docs, and scope removal

- target: same exact `S1` change set as R11A
- timing: immediately after S1 report + `T11`; parallel with R11A; before `GR11`
- blocks: `GR11`, `G4`, final verification
- consolidation reason: none; one convergence target, copy/accessibility/scope focus
- reads: nav/home/help/CSS, `README.md`, `plans/demo_project_high_level_plan.md`, fiction sweep allowlist, customer-visible fixtures/alt text -> grounded direction
- acceptance: six categories and brand messages accurate; impossible/comedic content absent; variants/delivery/Custom Powder understandable; docs do not restore Reverse Process/trading/auction direction
- invariants: keyboard/responsive/error states retained; no allergen filter/localization scope leak; compatibility identifiers absent from primary copy
- risk focus: fiction in tests/alt text/help, disabled controls without explanation, stale seeded counts/instructions, future-plan contradiction
- non-goals: backend transaction review; design rebrand beyond restrained scope
- write policy: inspect-only
- test policy: assess `T11` and fiction sweep; no broad rerun for confidence
- relevant evidence: `T11` -> S1 exact change set and allowlist
- return: `reviewer_report_v1`; `GR11` passes only after both reviews pass or all findings close through fresh fix worker scoped to S1 or originating packet + targeted evidence

## Ownership and Collision Rules

- `packages/contracts/**`: P1 only; consumers request contract correction through P1 directive before editing
- `packages/catalog/**`: P2 only
- migration 018 + migration index/test: P3 only
- `apps/api/src/db/seed.ts` and seed scenarios: P4, then P7 only for delivery/order fixture delta through sequential ownership
- product repository/mapper/routes: P4 only after G1
- cart/inventory/bundle API: P5 only after P4
- powderizer/custom backend: P6 only after P5
- checkout/payment/order/return/delivery API: P7 only after P6
- parallel web lanes: P8 catalog/product; P9 Custom Powder; P10 purchase flows; no shared writes
- `apps/web/src/App.tsx`, API `app.ts`, global nav/home/help/CSS/docs: S1 only; parallel lanes read only
- contract change: P1 -> G1 acceptance -> consumers; no consumer changes schema privately
- schema change: P3 -> G1 acceptance -> P4-P7; no later migration edits without P3 fix directive or new migration owned by designated fix worker
- migrations: reserve `018` for P3; any review fix needing schema change stays sequential and updates same not-yet-released migration
- composition: S1 single owner after web fan-in
- findings: launch fresh fix worker per finding -> receives packet scope, finding detail, owned paths, acceptance criteria, targeted evidence requirements; never reuses originating worker session/context; cross-packet fix uses separate fresh worker with incremented assignment and explicit ownership

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, worker verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning, developer instructions from global Codex settings. Never override them in plan or assignment.
- non-Codex harnesses: use harness-native roles while preserving worker/reviewer responsibilities and contracts.

## Test Execution Schedule

- `T0`: `G0` -> Node 22 selection and dependency health: `node --version`, `npm exec -- tsx --version`, `npm run typecheck -w @shop/api`
- `T1`: P1 -> contracts test/typecheck
- `T2`: P2 -> catalog test/typecheck
- `T3`: P3 -> focused populated migration integration
- `T4`: P4 -> seed + catalog API/mapping
- `T5`: P5 -> cart/inventory/bundle variant integration
- `T6`: P6 -> Custom Powder domain/API
- `T7`: P7 -> checkout/order/return/delivery integration
- `T8`: P8 -> catalog/product/comparison web unit/integration
- `T9`: P9 -> Custom Powder web unit/integration
- `T10`: P10 -> purchase-flow web unit/integration
- `T11`: S1 -> web integration + repository typecheck/lint + fiction sweep
- `T12`: after all review fixes -> `npm run reset` -> owner `G5`
- `T13`: after reset -> `npm run smoke` -> owner `G5`
- `T14`: browser QA after server start -> home -> catalog -> variant -> cart -> Custom Powder compatible/rejected -> checkout parcel/freight -> confirmation -> order; owner `G5`
- `T15`: final settled change set -> `npm run verify` once -> owner `G5`
- reuse: checkpoint stores command, scope, change set, runner, invalidators, output; new agent session does not invalidate result
- invalidation: contract edits -> T1 + affected consumer tests; catalog edits -> T2/T4 + affected web; migration/seed edits -> T3/T4/T12; variant commerce edits -> T5/T7/T10; custom edits -> T6/T9/T14; delivery/checkout edits -> T7/T10/T14; composition/copy edits -> T11/T14
- packet review: `T1 -> R1 -> GR1`; `T2 -> R2 -> GR2`; `T3 -> R3 -> GR3`; `T4 -> R4 -> GR4`; `T5 -> R5 -> GR5`; `T6 -> R6 -> GR6`; `T7 -> R7 -> GR7`
- web review: `{T8 -> R8 -> GR8 || T9 -> R9 -> GR9 || T10 -> R10 -> GR10}`; `G3` waits for all three gates
- convergence review: `T11 -> {R11A || R11B} -> GR11`
- review execution: inspect supplied evidence; no broad rerun for confidence; finding fix runs smallest invalidated command before gate passes

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every message and JSON string value
- transport: inline canonical JSON; temp artifacts only for bulky logs under protocol path
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: packet objective + acceptance + owned/read paths + invariants + accepted inputs + relevant evidence + non-goals; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/orchestrator-run-state.json`
- object records: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- worktree context: every assignment includes absolute worktree path, branch, base revision; all paths resolve beneath worktree
- findings: stable reviewer ID -> fresh fix worker (never originating worker) -> targeted evidence -> closure in checkpoint; no reviewer implementation or automatic review loop
- dependency rule: downstream packet cannot consume producer output until producer review gate passes

## Orchestrator Run Order

1. End planning context after plan is saved.
2. Require user to commit updated coding plan, or explicitly choose different branch baseline. Preserve and ignore unrelated source-checkout changes.
3. Start fresh runtime orchestrator. Load `CLAUDE.md`, source decision, coding plan, canonical communication contracts, current checkpoint only.
4. Record source path, named branch, `HEAD`; stop on detached HEAD or relevant uncommitted inputs.
5. Create dedicated implementation branch/worktree from source branch `HEAD`; persist identity before `G0`.
6. Select Node 22 and validate dependency health under `T0` inside worktree.
7. Resolve `G0`: approve freight constants; confirm same-group equality; authorize catalog worker to finalize exact credible products/variants within source targets.
8. Launch P1. Accept report and `T1`; launch R1 against exact P1 change set. Route findings to fresh fix worker with P1 scope, record targeted evidence, pass `GR1` before consumers launch.
9. Launch P2 and P3 concurrently after `GR1`. Accept each report/evidence; launch R2 and R3 concurrently against separate exact targets. Close findings through fresh fix workers scoped to each packet. Pass `GR2` and `GR3`, then validate reviewed fan-in `G1`.
10. Launch P4 after `G1`; accept `T4`; launch R4; close findings through fresh fix worker; pass `GR4`.
11. Launch P5 after `GR4`; accept `T5`; launch R5; close findings through fresh fix worker; pass `GR5`.
12. Launch P6 after `GR5`; accept `T6`; launch R6; close findings through fresh fix worker; pass `GR6`.
13. Launch P7 after `GR6`; accept `T7`; launch R7; close findings through fresh fix worker; pass `GR7`, then validate reviewed backend gate `G2`.
14. Launch P8, P9, P10 concurrently after `G2`. Prevent edits to S1-owned composition files. Accept `T8-T10`; launch R8-R10 concurrently against separate targets. Close lane findings through fresh fix workers scoped to each lane. Pass `GR8-GR10`, then validate reviewed fan-in `G3`.
15. Launch S1 after `G3` for composition, copy, help, docs, compatibility routes, integration checks. Accept `T11`.
16. Launch R11A and R11B concurrently against same exact S1 convergence change set with separate functional and copy/accessibility focus. Route integration findings to fresh fix worker scoped to S1 or originating packet based on ownership. Pass `GR11` after both verdicts pass or all findings close through targeted evidence.
17. Validate `G4`: no open finding/blocker; fiction sweep allowlist contains compatibility identifiers only; evidence ledger covers current change set.
18. Run `T12`, `T13`, `T14`, `T15` once after all review gates settle. Stop only task-owned dev server.
19. Validate `G5`; leave implementation worktree and branch intact.
20. Reply with worktree path, implementation branch, source branch, base revision, major compatibility aliases retained, verification results, open follow-up decisions. State user owns merge.

## Risks and Open Questions

- risk: canonical expansion overwrites local IDs -> mitigation: retain `1..50`, allocate `1001..1050`, explicit-set seed operations, migration fixture with local IDs
- risk: variant migration creates dual inventory authority -> mitigation: variant tables become sole runtime authority; legacy product fields receive no consumers; repository search gate
- risk: SQLite table rebuild loses triggers/indexes/FKs -> mitigation: explicit recreation + count/identity assertions + `foreign_key_check` + rollback fixture
- risk: existing carts point to product only -> mitigation: default-variant backfill before cart rebuild; canonical seed updates backfilled row
- risk: old custom mixes become cross-group -> mitigation: readable history, explicit requote/removal conflict, checkout fail closed
- risk: delivery recalculated after authorization -> mitigation: quote v5 snapshot and replay tests
- risk: delivery charge accidentally discounted/refunded -> mitigation: separate fields and pure total/refund tests
- risk: 100-product authoring introduces unsafe or weak entries -> mitigation: typed required facts, excluded-product validation, G1 credibility review
- risk: frontend shows product availability while selected SKU unavailable -> mitigation: card aggregate only; detail/cart actions exact variant
- risk: rename breaks saved routes/history/orders -> mitigation: redirects, API delegates, localStorage migration, strict old snapshot parser
- risk: removing novelty changes seeded reviews/orders -> mitigation: convert stable product IDs in place and rewrite seed copy; immutable existing order names remain historical data
- risk: producer defect propagates into dependent packets -> mitigation: R1-R10 immediate inspect-only review gates; reviewed fan-in; separate S1 convergence reviews
- question: exact freight threshold and parcel/freight charges -> owner: user/product decision at `G0`; no implementation packet launches without values
- question: exact 100 products, variants, prices, stock, colour tokens -> owner: P2 proposes within decisions; orchestrator accepts at `G1`
- question: category redistribution -> owner: P2 records credibility reason; orchestrator checks total/category coverage at `G1`
- question: detailed within-group exceptions -> deferred; equality rule is initial scope
- question: allergen/dietary filters -> deferred; data may display but filters remain out

## Done Criteria

- 100 credible canonical base products across six approved flat categories
- no impossible, conceptual, object-powdering, comedic, Reverse Process, trading, or auction customer content
- every product has validated classification, shared facts, required category facts, unique local art token
- every purchasable pack is exact SKU with price, stock, weight, backorder, delivery class
- current cart, bundle, inventory, checkout, order, cancellation, and return workflows use variant authority
- historical data, local products, carts, orders, reviews, favourites, payments, returns, audit facts preserved through migration
- parcel/freight mode and deterministic charge visible from cart through order; payment replay uses frozen total
- Custom Powder naming, compatibility, combined facts, featured blend, history, cart, checkout work; crafted incompatible request rejected
- old Powderizer URL/API/history/snapshot compatibility paths behave as specified and remain absent from primary customer copy
- core home -> catalog -> product -> cart -> checkout -> confirmation -> order history journey remains simple
- `en-US` USD formatting boundary explicit; no localization or multi-currency UI
- README and high-level plan match grounded direction and deterministic fixtures
- every implementation packet receives exact-target review; every review gate passes or closes findings through fresh fix worker + targeted evidence before dependent launch
- `npm run reset`, `npm run smoke`, focused browser journey, `npm run verify` pass on final change set
- implementation worktree/branch retained; completion reply reports required identity and user-owned merge
