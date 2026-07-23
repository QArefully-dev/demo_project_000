# Materials Exchange Gap Closure Coding Plan

Status: proposed
Source: user request 2026-07-23 -> residual gaps after `plans/b2b_materials_exchange_rebrand_coding_plan.md` (status complete) + reported runtime defect + approved non-food packaging directions `plans/heavy_duty_sack_prototypes.html`
Repository baseline: branch `materials_exchange_refactor` @ `e350ccf` (inspection 2026-07-23)

## Runtime Worktree

- source: current branch `materials_exchange_refactor` @ `e350ccf` -> re-record branch + `HEAD` at runtime before any write
- create: dedicated implementation branch + worktree before any implementation write -> `git worktree add -b <impl-branch> <abs-worktree-path> materials_exchange_refactor`
- execution root: all worker, reviewer, test, fix, convergence activity runs in worktree
- integration: no auto merge/rebase/cherry-pick/copy-back/cleanup; user owns merge
- completion reply: absolute worktree path + implementation branch + source branch + base revision
- blocker gate: detached `HEAD` -> stop, request branch. Relevant uncommitted source changes absent from `HEAD` -> confirm baseline with user; never stash/import without approval
- local runtime DB `apps/api/data/shop.db` is user-owned state outside worktree; never mutate it. Worker DB work uses worktree-local `SHOP_DB_PATH` or temp DBs

## Objective

Close four residual gaps left by the B2B rebrand: (1) legacy `sort_order = 0` variant rows break product detail responses against contract; (2) "powder" copy survives on catalog listing, product surfaces, order confirmation, home tiles; (3) Custom Powder builder must become "Custom Small Order" work-in-progress placeholder with builder UI removed; (4) non-edible materials still render the B2C food bag (in practice the "PACKAGING UNAVAILABLE" fallback) instead of the approved heavy-duty vessels A / B / F.

Completion boundary: every canonical product detail page loads without contract violation; no "powder" noun in customer-facing web chrome outside retained material facts; `/custom-powder` renders a WIP notice titled "Custom Small Order"; builder UI deleted; every non-food catalog product renders its category vessel from `plans/heavy_duty_sack_prototypes.html`; `npm run verify` green once.

## Scope

### In

- data defect: retire legacy `product_variants` rows with `sort_order < 1` created by migration `018` backfill -> new ordered migration + seed hardening + regression tests
- web copy sweep, UI chrome only: `features/catalog/**` listing/filters/toolbar, `components/ProductCard.tsx`, `features/product/**` residuals, `features/checkout/OrderConfirmationPage.tsx`; `components/home/CategoryTiles.tsx` copy travels with its artwork under the packaging lane
- apply unfinished mappings from prior plan's terminology map that remain unapplied in `ProductPurchasePanel.tsx`
- rename user-facing "Custom Powder" -> "Custom Small Order" in nav, page, help content, cart/order mix labels
- replace `/custom-powder` page with WIP placeholder; delete `apps/web/src/features/powderizer/**` + `apps/web/src/features/customPowder/**` + their tests
- remove web powderizer API client exports that lose all callers; delete provably dead `powderizer-*` CSS blocks and orphaned `PowderizerBanner.tsx`
- non-food packaging artwork: port approved directions `A` (stitched multi-wall kraft), `B` (woven PP knockout band), `F` (rigid HDPE keg, corrosive + softened tones) from `plans/heavy_duty_sack_prototypes.html` into web components; add web-side packaging spec resolver keyed on `category` + `mixingGroup` + `consumptionClassification`; route `ProductMedia` through it
- unify packaging brand string to `QAREFULLY MATERIALS EXCHANGE`, food bag included
- home category tiles render their category's vessel

### Out

- backend Custom Powder feature: `apps/api/src/features/powderizer/**`, routes `/api/powderizer/*` + `/api/custom-powder/*`, `apps/api/test/powderizer/**` -> UNTOUCHED
- contracts `@shop/contracts/powderizer`, powder-mix DB tables/columns, `demand_kind = 'powder_mix'` -> UNTOUCHED
- URL rename: route stays `/custom-powder`; help article slug/path/id stay `custom-powder` / `/help/custom-powder`; `HelpArticleId` + `faqEntryIds` unions unchanged
- internal identifiers: `powderizer-*` CSS class/variable names, `powderAccent` prop, `customPowderItem` symbol name, `PowderMixCartLineItem` component name -> unchanged (decision: UI copy only)
- catalog product data facts: `packages/catalog/src/categories/*.ts` `baseFacts`/`categoryFacts`/`ingredients`/`source` strings keep real-world material wording ("Cocoa powder" is a legitimate ingredient name) -> UNTOUCHED
- `packages/catalog/src/model.ts` `withoutPowder` name/description transform -> behavior unchanged this pass
- `apps/web/src/features/designs/BagDesignsPage.tsx` -> design-fixture page, not customer copy; UNTOUCHED (inherits the unified brand string through `BagArtwork`, no edit)
- pricing/MOQ/tier logic, delivery classification, contracts schema changes -> none
- food-grade vessel geometry (`BagArtwork` paths, label block, colours) -> unchanged except the single brand string
- mix-bag rendering (`CheckoutSummary.tsx`, `OrderDetailView.tsx`, `PowderMixCartLineItem.tsx`, `powderMixBagScheme.ts`) stays on `BagArtwork`; custom mixes get no heavy-duty vessel this pass
- contract field `ProductPackaging` (`packages/contracts/src/products.ts:19-30`) stays as-is and stays unpopulated by the API; packaging is resolved web-side -> no API/contract/DB change for artwork
- catalog data edits for artwork (new grade/hazard/dose fields in `packages/catalog/**`) -> none; artwork reads existing facts only
- live trading / auctions -> LATER separate plan
- Custom Small Order product design (mixed sub-pallet orders, pallet-fit rules) -> its own later plan; this pass ships placeholder only

## Repository Findings

### Legacy variant defect

- existing: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts:82-111` -> backfills one variant per pre-existing product with `sku = LEGACY-{id}-001`, `label = '{name} (Legacy)'`, `weight_grams 1000`, `delivery_class 'parcel'`, `active 1`, `sort_order 0`
- existing: `apps/api/src/db/seed.ts:200-204` `deactivateExtraVariants` -> `UPDATE product_variants SET active = 0 WHERE product_id = @product_id AND sort_order > @max_sort_order` -> never matches `sort_order 0`
- existing: `apps/api/src/features/catalog/productRepository.ts:330` -> `WHERE product_id = ? AND active = 1 ORDER BY sort_order ASC` -> retired-by-`active=0` rows disappear from read path
- existing: `apps/api/src/mappers/product.ts:80` -> `sortOrder: v.sort_order` passthrough; `:138` default-variant resolution prefers `sort_order === 1`
- existing: `packages/contracts/src/products.ts:367` -> `sortOrder: Type.Integer({ minimum: 1 })`
- evidence: live DB `apps/api/data/shop.db` -> 50 active rows with `sort_order 0`, one per product 1-50; product 31 rows = `LEGACY-31-001` (`sort_order 0`, active), `GDN-0031-001` (1), `GDN-0031-002` (2) -> reproduces reported `Response contract violation for /api/products/31: /variants/0/sortOrder`
- gap: no migration or seed path retires `sort_order < 1` rows; defect reproduces on any DB migrated across `018` from pre-`018` state; fresh `npm run reset` DB is clean, so suite never exercised it
- constraint: legacy variant ids are referenced by `cart_line_items.variant_id`, `inventory_reservations.variant_id`, `order_inventory_allocations.variant_id`, `inventory_stock_movements.variant_id` (018 rebuilds point them at `products.default_variant_id`) -> deactivate, never delete
- constraint: `inventory_stock_movements` carries ABORT triggers on UPDATE/DELETE -> migration must not touch that table
- reuse: `018` guard style (`addColumnIfMissing`, post-write count/FK validation) -> replicate in `020`
- reuse: `apps/api/test/db/migrations.integration.test.ts` -> temp-dir SQLite + `migrations` registry + `Value.Check(Product, ...)` at `:583` -> extend for `020`
- reuse: `apps/api/test/catalog/products.integration.test.ts` -> `app.inject()` route regression home

### Residual powder copy

- existing: `apps/web/src/features/catalog/CatalogPage.tsx:131` "No powders"/"powder"/"powders"; `:134-136` `powderTitle` + "Powder search results"; `:141` "The powder catalogue"; `:144` "From pantry staples to conceptual quantities. All powders are clearly labelled."; `:297` "No powders match those filters"; `:299` "Try another powder..."; `:304` "Browse all powders"; `:313` `aria-label="Loading powders"`
- existing: `apps/web/src/features/catalog/CatalogSidebarControls.tsx:53` legend "Powder type"; `:56` "All powders"
- existing: `apps/web/src/features/catalog/CatalogToolbar.tsx:28` `aria-label="Search powders"`
- existing: `apps/web/src/components/ProductCard.tsx:126` "Powder type: {category}"; `:176` "Add powder"
- existing: `apps/web/src/features/product/ProductPage.tsx:98` breadcrumb "All powders"
- existing: `apps/web/src/features/product/SimilarProductsSection.tsx:18,48,62,72,90,102,106` -> "Similar powders", "Finding similar powders...", "Could not load similar powders.", "No similar powders available right now.", "Browse all powders"
- existing: `apps/web/src/features/product/ProductDetails.tsx:86` eyebrow "Powder facts"; `:87-88` heading "What is in this bag"
- existing: `apps/web/src/features/product/ProductPurchasePanel.tsx:329` "Bag format"; `:331` fallback "Powder bag"; `:334` "Batch handling"; `:335` "Finely considered and clearly labelled."; `:353` "Powder bag linked to this browser cart"; `:357` "Adjust bag quantities before checkout"
- existing: `apps/web/src/features/checkout/OrderConfirmationPage.tsx:58` "Your powders are confirmed."; `:65` "Shop more powders"
- existing: `apps/web/src/components/home/CategoryTiles.tsx:8,18,28,38` tile artwork names "Protein Powder"/"Powdered Sugar"/"Matcha Powder"/"Laundry Powder"; retail quantities `1kg`/`500g`/`200g`/`500g`/`2kg` at `:11,21,31,41,51` inconsistent with sack/pallet model -> owned by `P4`, see Packaging artwork
- gap: prior plan assigned no owner to `features/catalog/**` or `components/ProductCard.tsx`; `ProductPurchasePanel`/`ProductPage`/`ProductDetails` were owned but mappings left unapplied
- constraint: prior plan's terminology map remains authoritative -> "Powder type: {category}" -> "Material · {category}" (already applied at `ProductPurchasePanel.tsx:215`), "Powder bag linked to this browser cart" -> "Lines held in your order for this session", "Adjust bag quantities before checkout" -> "Adjust pallet quantities before checkout", "Batch handling: Finely considered..." -> "Handling: palletised, shrink-wrapped, batch-labelled", "X in stock" -> pallets/tonnes wording
- constraint: consumption badges `Food` / `Not for consumption` / `Caution` unchanged (safety)

### Custom Powder surface

- existing: `apps/web/src/App.tsx:19` static import `PowderizerPage`; `:29-32` `PowderizerRedirect` -> `/custom-powder`; `:92` route `/custom-powder`; `:93` route `/powderizer`
- existing: sole external importer of the two feature dirs is `App.tsx:19`; the dirs cross-import each other
- existing: `apps/web/src/components/nav/navItems.ts:30-36` `customPowderItem` label `'Custom Powder'`, `className 'powderizer-nav-link'`; sole consumer `apps/web/src/components/CategoryNav.tsx:4,48-52`
- existing: `apps/web/src/api/powderizer.ts` -> only `requotePowderMix`, `updatePowderMixQuantity`, `removePowderMix` have callers outside the deleted dirs (`apps/web/src/hooks/useCart.ts:259,269,279`); `getPowderizerConfig`, `quotePowderMix`, `createPowderMix`, `updatePowderMix` lose all callers
- existing: `apps/web/src/api/customPowder.ts` -> every export called only from `apps/web/src/features/powderizer/usePowderizerController.ts:9-13` -> file loses all importers
- existing: `apps/web/src/components/home/PowderizerBanner.tsx` -> zero render sites repo-wide; already orphaned
- existing: surviving mix-rendering consumers `apps/web/src/features/cart/PowderMixCartLineItem.tsx` (imported by `components/CartSheet.tsx:8`, `features/cart/CartPage.tsx:7`), `apps/web/src/features/orders/OrderDetailView.tsx` (imported by `features/checkout/OrderConfirmationPage.tsx:9`, `features/orders/OrderDetailPage.tsx:9`), `apps/web/src/components/powderMixBagScheme.ts`, `apps/web/src/components/BagArtwork.tsx` -> none import the deleted dirs
- existing: mix-edit deep links into the builder -> `apps/web/src/features/cart/PowderMixCartLineItem.tsx:99`, `apps/web/src/features/checkout/CheckoutPage.tsx:89,112`
- existing: user-facing label `'Custom powder mix'` -> `apps/web/src/features/cart/PowderMixCartLineItem.tsx:19`, `apps/web/src/features/orders/OrderDetailView.tsx:41,103,115`
- existing: help content -> `features/help/content/serviceArticles.ts:110,208-266 (customPowderArticle),327,331`; `faqArticle.ts:15,73-78`; `policyArticles.ts:38,57`; registry `helpContentRegistry.ts:9,32,49`
- existing: `apps/web/src/index.css` -> `.powderizer-nav-link` (183-201) + `@keyframes powderizer-iridescence` (363-372) + gradient vars survive via `CategoryNav`; `.powderizer-banner` (179-181), `.powderizer-gradient-animated` (172-177), `.powderizer-scheme-option` (203-226), `.powderizer-scheme-swatch` (228-233), `.powderizer-mix-segment` (235-239), `.powderizer-legend-colour` (241-248), `.powderizer-reaction` (250-256), reduced-motion rule (390-393) become dead
- existing: tests asserting current strings -> `apps/web/src/components/CategoryNav.test.tsx:25,28,34` (`'Custom Powder'` link), `:30,42,45,60-63` (CSS class + `--powderizer-gradient-duration`), `apps/web/src/features/help/HelpPages.test.tsx:82`
- existing: `apps/web/src/features/help/HelpJourney.integration.test.tsx:5` imports `@/App` -> breaks on deletion unless `App.tsx` updated in same packet
- gap: no WIP placeholder page exists
- constraint: `apps/web/src/features/help/content/powderGuidanceArticles.ts` `powderSafetyArticle` is unregistered orphan pre-existing this work -> leave alone
- reuse: existing page/section primitives under `apps/web/src/components/ui/` for placeholder page

### Packaging artwork

- existing: `plans/heavy_duty_sack_prototypes.html` -> self-contained approved source; `sackA` (`:115-157`), `sackB` (`:160-215`), `sackF` (`:218-267`), ink table `INKS` (`:84-88`), helpers `cond`/`lab`/`ghs` (`:91-112`), sample content records (`:270-307`); all drawn on the same `720x720` viewBox as `BagArtwork` -> substitutes directly inside `ProductMedia`
- existing: `apps/web/src/components/BagArtwork.tsx` -> single food-bag renderer; `:70` prints `QAREFULLY POWDER CO.`; `:196` `useId`-scoped gradient id pattern -> reuse for `B` weave/hatch `pattern` ids and `clipPath` ids; `:202-204` `ariaLabel === ''` decorative escape hatch -> preserve in every new vessel; `:204` default label `${name} powder bag`
- existing: `apps/web/src/components/ProductMedia.tsx:18-33` -> renders `BagArtwork` only when `product.packaging` is set, else `genericArtworkDataUri` "PACKAGING UNAVAILABLE" placeholder; `:29` hardcodes `${product.name} powder bag`
- defect (pre-existing, unreported): `apps/api/src/mappers/product.ts:92-116,130-157` never emits `packaging`; `apps/api/test/catalog/products.integration.test.ts:35` and `apps/api/src/mappers/product.test.ts:115` assert `'packaging' in product === false` -> every catalog product currently renders the generic placeholder, not the locked bag; `apps/api/src/db/powderCatalog.ts:21-26` `visual` block is built but never persisted or mapped
- existing: contract fields already on the wire for every list and detail response -> `Product.category`, `Product.consumptionClassification`, `Product.mixingGroup`, `Product.name`, `Product.id`, `Product.slug` (`packages/contracts/src/products.ts:80-104`); `ProductWithVariants` adds `categoryFacts` + `variants[].label` + `variants[].weightGrams` (`:390-400`) -> sufficient input for vessel choice, net weight, grade, hazard without contract change
- existing: `packages/catalog/src/model.ts:1-21` -> six `CATALOG_CATEGORIES`, eight `MIXING_GROUPS`; `:36-79` per-category fact shapes -> `TradeFacts.composition`/`ppe`, `GardenFacts.npk`/`coverage`/`handling`, `CleaningFacts.dosage`/`hazardStatement`/`surfaces` -> grade, dose and hazard strings already exist per product
- existing: `industrializeProducts` + `makeVariant` (`packages/catalog/src/model.ts:240-306`) force every variant to `25 kg Sack` / `1,000 kg Pallet` -> the prototypes file's "trade pack sizes ahead of the catalog / 600 g tub" open item is already stale; artwork prints the resolved variant label, never a literal
- existing: non-food product inventory -> Trade & Creative Materials 15 products, groups `cementitious-materials` / `casting-materials` / `pigments` / `absorbents` (`packages/catalog/src/categories/tradeCreative.ts`); Garden & Outdoors 15 products, all `garden-treatment` (`gardenOutdoors.ts`); Household & Cleaning 15 products, 11 `caution` + 4 `non-food`, of which `1038` Carpet Cleaner and `1041` Shoe Deodorising are `absorbents`, `43` Scouring and `1040` Furniture Cleaner are `cleaning` (`householdCleaning.ts`)
- existing: `ProductMedia` consumers `components/ProductCard.tsx:97`, `features/product/ProductGallery.tsx:13`, `components/CartLineItem.tsx:53`, `features/comparison/ComparisonMatrix.tsx:107` -> all inherit new vessels with no edit
- existing: direct `BagArtwork` consumers that must NOT switch vessel -> `features/checkout/CheckoutSummary.tsx:81`, `features/orders/OrderDetailView.tsx:102`, `features/cart/PowderMixCartLineItem.tsx:48` (all custom-mix bags), `features/designs/BagDesignsPage.tsx:59` (locked design fixture), `features/powderizer/PowderMixBagPreview.tsx:100` (deleted by `P3`)
- existing: `apps/web/src/components/home/CategoryTiles.tsx:6-67` -> six hardcoded `BagArtworkProps` records; three non-food tiles carry powder names and retail quantities -> tile artwork and tile copy are the same records, single owner required
- existing tests asserting current artwork -> `apps/web/src/components/BagArtwork.test.tsx:21-27` (label rect fill, title split), `:29-56` (unique gradient ids), `apps/web/src/components/ProductMedia.test.tsx:39-60`, `apps/web/src/components/ProductMedia.packaging.test.tsx:41-48` (`data-accent` / `data-powder-accent` mapping)
- gap: no vessel selector, no `A`/`B`/`F` component, no packaging module; prototypes exist only as a browser-openable HTML fixture
- constraint: prototypes render one ink plate per direction; every colour is literal in the HTML -> port values verbatim, do not re-derive from design tokens
- constraint: `B` uses two `pattern` defs plus a `clipPath` per instance and the HTML dedupes them with a module-global `uid` counter -> React port must use `useId`, module-global mutable state is banned by repository rules
- constraint: hazard, dose, PPE and grade strings are safety copy -> render only what catalog facts or `consumptionClassification` supply; omit the element otherwise, never fabricate

## Decisions and Invariants

- decision: legacy variants are RETIRED by `active = 0`, never deleted -> preserves `cart_line_items` / reservation / allocation / stock-movement references and order history
- decision: retirement applies only when the product owns at least one active variant with `sort_order >= 1` -> a product whose only variant is legacy keeps it and stays purchasable
- decision: `products.default_variant_id` pointing at a retired variant is repointed to that product's lowest-`sort_order` active variant; unresolvable -> migration throws
- decision: seed becomes self-healing -> extra-variant deactivation predicate widens to `sort_order > @max_sort_order OR sort_order < 1`, so `npm run seed` alone repairs a legacy DB
- decision: rename is UI copy only -> routes, API paths, contract types, DB identifiers, CSS identifiers, symbol names unchanged
- decision: mix-edit deep links keep pointing at `/custom-powder`; that route now renders the WIP notice, and placeholder copy states editing is unavailable while the feature is rebuilt -> smallest diff, no dead-end without explanation
- decision: existing powder-mix cart/order lines stay renderable and removable; only builder entry disappears
- decision: catalog copy replaces "powder(s)" with "material(s)" and bag wording with sack/pallet wording per prior terminology map; consumption badges and safety copy unchanged
- decision: vessel is chosen by `category` first, then softened by `consumptionClassification` -> `Trade & Creative Materials` -> `A` kraft; `Garden & Outdoors` -> `B` woven; `Household & Cleaning` + `caution` -> `F` corrosive; `Household & Cleaning` + `non-food` -> `F` mild; `Sports Nutrition` / `Baking & Pantry` / `Drinks` -> existing `BagArtwork`; unknown category -> existing `BagArtwork`
- decision (user 2026-07-23): `F` mild keeps the keg and the full-height stripe but swaps the corrosion ink for the category ink, replaces the pictogram with the generic irritant mark, drops the vertical word `CORROSIVE` and drops the `DANGER` band -> closes the prototypes file's mild-cleaning open item without a fourth vessel and without overstating shoe-powder hazard
- decision (user 2026-07-23): brand string unifies to `QAREFULLY MATERIALS EXCHANGE` across every vessel including the food bag -> one string in `BagArtwork`; food bag geometry, colours and layout otherwise untouched
- decision: packaging is resolved web-side from fields already on the wire; no API mapper, contract, or catalog-data change -> artwork is a rendering concern, and the alternative (persist + map a `packaging` record per vessel) would expand `ProductPackaging` into a vessel-specific union for zero behavioural gain
- decision: `ProductMedia` keeps honouring `product.packaging` when present (food path only, colours + mark + batch) and derives everything else -> existing mapping tests stay meaningful, and a future API that populates the field still works
- decision: every printed string traces to product data -> lot from the resolved variant SKU (else `${categoryPrefix}-${id}`), net weight from the resolved variant label, grade from `categoryFacts` (`composition` / `npk` / `dosage` per shape) else the mixing-group label, hazard from `categoryFacts.hazardStatement` / `handling` / `ppe` else the consumption classification; missing source -> element omitted
- decision: prototypes file `plans/heavy_duty_sack_prototypes.html` stays the artwork source of truth; its `Open` section is rewritten to record these resolutions rather than a separate decision record
- invariant: vessel selection is a pure function of contract fields; no network call, no randomness, no clock read -> same product renders the same vessel everywhere
- invariant: every vessel supports `ariaLabel === ''` decorative rendering and otherwise announces name + vessel; no vessel announces a hazard the artwork does not print
- invariant: SVG `pattern`, `clipPath` and gradient ids are `useId`-scoped -> two instances on one page never collide
- invariant: migrations ordered/versioned, idempotent, data-preserving, unknown errors surfaced
- invariant: `inventory_stock_movements` never written by migration `020` (immutability triggers)
- invariant: contracts, contract tests, API routes, pricing/MOQ/tier behavior unchanged by every packet
- invariant: no client-side recomputation of authoritative money introduced
- invariant: a11y preserved -> every reworded `aria-label`, `legend`, `role`, heading level keeps its semantics
- invariant: web never imports API source
- assumption (validate at G1): all 50 affected products own canonical `sort_order 1` + `2` variants, so retirement leaves every product purchasable; verify by count query in `020` validation step
- assumption (non-blocking): stale `sort_order = 3` rows observed in the live DB are already `active = 0` via existing seed logic and need no migration action; `020` validation asserts no active variant with `sort_order` outside the canonical set for canonical products

## Target Design

### Migration and seed (P1)

- proposed `apps/api/src/db/migrations/020_retire_legacy_variants.ts`, registered after `019` in `apps/api/src/db/migrations/index.ts`
- steps: select products having >= 1 active variant with `sort_order >= 1` -> for those products set `active = 0, updated_at = <migration timestamp>` on variants with `sort_order < 1` -> repoint `products.default_variant_id` where it references a now-inactive variant -> validate
- validation: zero active variants with `sort_order < 1` for products owning canonical variants; zero products with `default_variant_id` referencing an inactive or missing variant; `PRAGMA foreign_key_check` clean; re-run is a no-op
- `apps/api/src/db/seed.ts` -> widen `deactivateExtraVariants` predicate to also cover `sort_order < 1`; keep statement name or rename to reflect meaning; no other seed behavior change

### Web copy (P2)

- catalog listing: result summary, page title/eyebrow/subcopy, empty state, skeleton label, search `aria-label`, sidebar legend + "all" option -> material/pallet wording; drop stale B2C line "From pantry staples to conceptual quantities"
- product card: eyebrow -> "Material · {category}" matching `ProductPurchasePanel.tsx:215`; CTA -> "Add to order"
- product page: breadcrumb -> "All materials"; details eyebrow -> "Material facts"; "What is in this bag" -> pallet/sack-neutral heading
- similar products: section heading + loading/error/empty/link copy -> "materials"
- purchase panel: apply remaining terminology-map entries (bag format fallback, batch handling, session line, adjust-quantities line)
- order confirmation: confirmation heading + CTA -> materials/order wording
- home tiles: owned by `P4` (artwork records and tile copy are the same objects); see Packaging artwork

### Custom Small Order placeholder (P3)

- proposed `apps/web/src/features/customSmallOrder/CustomSmallOrderPage.tsx` -> heading "Custom Small Order", WIP notice explaining the feature is being rebuilt and mix editing is unavailable, link back to `/catalog`; static, no API calls, no fake controls
- proposed colocated `apps/web/src/features/customSmallOrder/CustomSmallOrderPage.test.tsx`
- `App.tsx` -> import placeholder instead of `PowderizerPage`; `/custom-powder` renders placeholder; `/powderizer` redirect retained
- delete `apps/web/src/features/powderizer/**`, `apps/web/src/features/customPowder/**`, `apps/web/src/components/home/PowderizerBanner.tsx`, `apps/web/src/api/customPowder.ts`
- `apps/web/src/api/powderizer.ts` -> keep `requotePowderMix`, `updatePowderMixQuantity`, `removePowderMix`; drop config/quote/create/update exports
- `navItems.ts` label -> "Custom Small Order"; `CategoryNav.test.tsx` updated
- mix labels -> "Custom small order" in `PowderMixCartLineItem.tsx:19` and `OrderDetailView.tsx:41,103,115`
- help content -> `customPowderArticle` title/summary/body reduced to Custom Small Order WIP statement; returns/safety/FAQ/privacy mentions reworded; ids/slugs/paths/type unions unchanged
- `index.css` -> remove only the dead blocks enumerated in Repository Findings; keep `.powderizer-nav-link`, its vars, and the keyframes

### Packaging artwork (P4)

- proposed module `apps/web/src/components/packaging/`
  - `packagingSpec.ts` -> `Vessel = 'food-bag' | 'kraft-sack' | 'woven-sack' | 'keg'`; `KegTone = 'corrosive' | 'mild'`; `PackagingSpec = { vessel, tone?, ink: { ink, alert }, brand, title lines, sub, grade?, lot, netWeight, hazard?, dose?, never?, yield? }`; pure `resolvePackagingSpec({ product, variant? })`
  - `KraftSackArtwork.tsx` -> direction `A`, port of `sackA`
  - `WovenSackArtwork.tsx` -> direction `B`, port of `sackB`, `useId`-scoped `weave` / `hatch` / `body` ids
  - `KegArtwork.tsx` -> direction `F`, `tone` prop switching the corrosive stripe set vs the mild stripe set
  - `PackagingArtwork.tsx` -> dispatcher `spec.vessel` -> renderer; `food-bag` -> existing `BagArtwork`
  - shared `svgText.ts` -> `cond` (condensed `textLength` + `lengthAdjust`), `lab`, `ghs`/irritant marks, `NARROW` / `UI` / `MONO` font stacks, `INKS` table -> ported verbatim from the prototypes file
  - colocated `packagingSpec.test.ts`, `PackagingArtwork.test.tsx`
- title lines: reuse `BagArtwork`'s balanced two-line split so `A`/`B` headline behaviour matches the locked bag; single-word names render one line
- `ProductMedia.tsx` -> resolve spec -> `PackagingArtwork`; `ariaLabel` becomes vessel-accurate (`... stitched kraft sack` / `... woven sack` / `... keg` / `... bag`); generic `PACKAGING UNAVAILABLE` data-URI retained only for products whose category resolves to nothing
- `BagArtwork.tsx` -> brand string only; no other change
- `CategoryTiles.tsx` -> six tile records become `{ vessel-bearing sample product }` shaped inputs to `PackagingArtwork`; the three non-food tiles show `A` / `B` / `F`; names drop "powder"; quantities move to `25 kg` / `1,000 kg` scale
- prototypes file -> `Open` section rewritten to the three recorded resolutions (mild carve-out, stale pack-size note, unified brand string)

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2 || P3 -> R3 -> GR3 || P4 -> R4 -> GR4} -> G1 -> S1 -> R5 -> GR5 -> G2`

- `G0`: worktree created + verified from `materials_exchange_refactor` `HEAD`; `npm ci`; post-install health `npm exec -- tsx --version` + `npm run typecheck -w @shop/api` pass
- `GR1`: `R1` pass or findings closed -> high-risk data/migration gate
- `GR2`: `R2` pass or findings closed -> copy sweep gate
- `GR3`: `R3` pass or findings closed -> deletion/route gate
- `GR4`: `R4` pass or findings closed -> packaging artwork gate
- `G1`: all four lane review gates passed; no cross-lane file conflict
- `GR5`: `R5` convergence review pass or findings closed
- `G2`: completion gate -> `npm run verify` green once; done criteria met

## Work Packets

### P1: Retire legacy sort_order 0 variants

- mode: parallel with `P2`, `P3`, `P4` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/020_retire_legacy_variants.ts` (proposed), `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/seed.ts`, `apps/api/test/db/migrations.integration.test.ts`, `apps/api/test/catalog/products.integration.test.ts`
- reads: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts:82-111,671-689` -> legacy backfill shape + validation style -> replicate guard/validate pattern; `apps/api/src/db/migrations/019_variant_moq.ts` -> current latest ordered migration -> version after it; `apps/api/src/db/migrations/index.ts` -> append-only registry order; `apps/api/src/db/seed.ts:200-204,310-318` -> `deactivateExtraVariants` predicate + call site -> widen; `apps/api/src/features/catalog/productRepository.ts:325-355` -> active-variant read path -> confirm `active = 0` removes row from responses; `packages/contracts/src/products.ts:349-400` -> `CatalogVariant.sortOrder` minimum -> regression assertion target; `apps/api/test/db/migrations.integration.test.ts:1-30,570-600` -> temp-DB + `Value.Check(Product, ...)` pattern -> extend
- acceptance: migration `020` registered after `019`; running full migration chain over a DB containing an active `sort_order 0` legacy variant leaves that variant `active = 0`, leaves its row and all FK references intact, and repoints any `default_variant_id` that referenced it; second run is a no-op; product whose only variant is legacy keeps it active; `npm run seed` alone repairs the same state; `GET /api/products/:id` for such a product validates against the `Product` contract schema
- non-goals: no variant deletion; no contract change; no pricing/MOQ change; no writes to `inventory_stock_movements`; no web edits; no catalog package edits
- upstream inputs: none
- changes:
  - add `020_retire_legacy_variants.ts` following `018` guard + post-write validation style
  - register `020` in `migrations/index.ts` after `019`
  - widen seed deactivation predicate to `sort_order > @max_sort_order OR sort_order < 1`
  - extend `apps/api/test/db/migrations.integration.test.ts` -> legacy-variant fixture -> assert deactivation, row retention, `default_variant_id` repoint, idempotent re-run, legacy-only product untouched, `Value.Check(Product, ...)` on the mapped product
  - extend `apps/api/test/catalog/products.integration.test.ts` -> `app.inject()` GET product detail after seeding a legacy row -> assert 200 and every returned `variants[].sortOrder >= 1`
- invariants: ordered/versioned migration; idempotent; preserve rows; surface unknown errors; transaction owner covers the full retire+repoint invariant; seeded-DB assertions scoped to test-owned identifiers
- relevant evidence: none prior
- test duty: `npm exec -w @shop/api -- tsx --test apps/api/test/db/migrations.integration.test.ts` -> `EV-P1-migration`; `npm exec -w @shop/api -- tsx --test apps/api/test/catalog/products.integration.test.ts` -> `EV-P1-products`; `npm run reset` -> `EV-P1-reset`
- verification: focused suites green; `reset` exits 0; re-running migration chain twice produces identical variant state
- handoff: interface "legacy variants retired, seed self-heals" -> `S1`
- review: `R1` -> blocks `G1`

### P2: Web copy sweep to material and pallet wording

- mode: parallel with `P1`, `P3`, `P4` after `G0`
- depends on: `G0`
- owns: `apps/web/src/features/catalog/CatalogPage.tsx`, `apps/web/src/features/catalog/CatalogSidebarControls.tsx`, `apps/web/src/features/catalog/CatalogToolbar.tsx`, `apps/web/src/components/ProductCard.tsx`, `apps/web/src/features/product/ProductPage.tsx`, `apps/web/src/features/product/ProductDetails.tsx`, `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/product/SimilarProductsSection.tsx`, `apps/web/src/features/checkout/OrderConfirmationPage.tsx`, colocated tests for those files
- reads: `plans/b2b_materials_exchange_rebrand_coding_plan.md` "Copy and Terminology" -> authoritative mappings -> apply unapplied entries; `apps/web/src/features/product/ProductPurchasePanel.tsx:215` -> already-applied "Material · {category}" pattern -> match on `ProductCard`; `apps/web/src/features/catalog/CatalogPage.test.tsx:320,398` + `apps/web/src/components/ProductCard.test.tsx` + `apps/web/src/features/product/*.test.tsx` -> current string assertions -> update in lockstep
- acceptance: zero "powder"/"Powder" nouns in owned files' user-facing strings, `aria-label`s, and `legend`s; `ProductCard` eyebrow reads "Material · {category}" and CTA "Add to order"; purchase-panel terminology-map entries applied; catalog empty/loading/search/sidebar copy uses material + pallet wording; stale line "From pantry staples to conceptual quantities" removed; consumption badges and safety copy byte-identical; owned colocated tests updated and green
- non-goals: do NOT touch `features/powderizer/**`, `features/customPowder/**`, nav, help content, cart/checkout pages other than `OrderConfirmationPage.tsx`, `features/designs/BagDesignsPage.tsx`, `components/home/CategoryTiles.tsx`, `components/ProductMedia.tsx`, `components/BagArtwork.tsx`, `packages/catalog/**`, any API file; no layout or visual redesign; no new components; no pricing display logic change; `ProductCard` keeps rendering `ProductMedia` unchanged
- upstream inputs: none
- changes:
  - catalog listing: result summary, title/eyebrow/subcopy, empty state, skeleton `aria-label`, toolbar search label, sidebar legend + all-option
  - product card: eyebrow + CTA
  - product page/details/similar-products: breadcrumb, facts eyebrow, bag heading, similar-materials copy
  - purchase panel: bag-format fallback, batch handling, session line, adjust-quantities line per terminology map
  - order confirmation: heading + CTA
  - update every colocated test asserting a changed string
- invariants: a11y semantics preserved for each reworded label/legend/heading; loading/empty/error states preserved; server-authoritative money untouched; consumption badges unchanged
- relevant evidence: none prior
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/catalog apps/web/src/features/product apps/web/src/components/ProductCard.test.tsx apps/web/src/features/checkout/PowderMixPurchaseRendering.test.tsx` -> `EV-P2-copy`
- verification: focused vitest green; repository grep over owned files shows no residual "powder" noun in user-facing strings
- handoff: interface "catalog/product/confirmation chrome powder-free" -> `S1`
- review: `R2` -> blocks `G1`

### P3: Custom Small Order rename, WIP page, builder removal

- mode: parallel with `P1`, `P2`, `P4` after `G0`
- depends on: `G0`
- owns: `apps/web/src/features/customSmallOrder/**` (proposed), `apps/web/src/features/powderizer/**` (delete), `apps/web/src/features/customPowder/**` (delete), `apps/web/src/components/home/PowderizerBanner.tsx` (delete), `apps/web/src/api/customPowder.ts` (delete), `apps/web/src/api/powderizer.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/nav/navItems.ts`, `apps/web/src/components/CategoryNav.test.tsx`, `apps/web/src/features/cart/PowderMixCartLineItem.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, `apps/web/src/features/help/content/serviceArticles.ts`, `apps/web/src/features/help/content/faqArticle.ts`, `apps/web/src/features/help/content/policyArticles.ts`, `apps/web/src/features/help/HelpPages.test.tsx`, `apps/web/src/index.css`
- reads: `apps/web/src/App.tsx:19,29-32,88-95` -> import + route wiring -> repoint; `apps/web/src/components/nav/navItems.ts:30-36` + `apps/web/src/components/CategoryNav.tsx:44-53` -> label + class consumer -> rename label only; `apps/web/src/hooks/useCart.ts:255-282` -> surviving powderizer client calls -> keep those three exports; `apps/web/src/features/help/content/helpContentRegistry.ts:1-55` + `helpContentTypes.ts:10-30` -> registered ids/slugs/unions -> keep identifiers, change copy only; `apps/web/src/index.css:57-68,108-116,171-256,363-394` -> powderizer blocks -> delete only the ones with no surviving consumer; `apps/web/src/components/ui/` primitives -> placeholder page composition
- acceptance: `/custom-powder` renders a static Custom Small Order WIP page (heading, WIP explanation incl. mix editing unavailable, link to `/catalog`) with no API call and no simulated controls; `/powderizer` still redirects to it; both feature dirs plus `PowderizerBanner.tsx` and `api/customPowder.ts` deleted with zero dangling imports; `apps/web/src/api/powderizer.ts` retains exactly the three `useCart`-consumed exports; nav label reads "Custom Small Order"; cart/order mix label reads "Custom small order"; help/FAQ/privacy/returns/safety copy says Custom Small Order and the article body states the feature is being rebuilt; dead `powderizer-*` CSS blocks removed and `.powderizer-nav-link` chain intact; `apps/web` typecheck clean; owned tests updated and green
- non-goals: no API/contract/DB edits; no route path rename; no help id/slug/path/union change; no CSS class or variable renames; no changes to `PowderMixCartLineItem` rendering logic, `powderMixBagScheme.ts`, `BagArtwork.tsx`, `CheckoutSummary.tsx`; no removal of mix-edit deep links; do NOT touch files owned by `P2`
- upstream inputs: none
- changes:
  - add `CustomSmallOrderPage.tsx` + colocated test
  - repoint `App.tsx` import and `/custom-powder` route; keep `/powderizer` redirect
  - delete the two feature dirs (implementation + tests), `PowderizerBanner.tsx`, `api/customPowder.ts`
  - prune `api/powderizer.ts` to the three consumed exports
  - rename nav label; update `CategoryNav.test.tsx` label assertions only
  - rename mix fallback labels in cart line item and order detail view
  - rewrite Custom Powder help/FAQ/privacy/returns/safety copy to Custom Small Order WIP wording; update `HelpPages.test.tsx`
  - delete dead `powderizer-*` CSS blocks and the dead reduced-motion rule
- invariants: help routing and registry membership intact; existing powder-mix cart/order lines still render, requote, and remove; `useCart` behavior unchanged; a11y of nav and placeholder page preserved; no fabricated functionality on the placeholder
- relevant evidence: none prior
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customSmallOrder apps/web/src/components/CategoryNav.test.tsx apps/web/src/features/help apps/web/src/hooks/useCart.test.tsx` -> `EV-P3-customsmallorder`; `npm run typecheck -w @shop/web` -> `EV-P3-typecheck`
- verification: focused vitest + web typecheck green; repo-wide grep shows zero imports of the deleted paths
- handoff: interface "builder removed, `/custom-powder` = WIP placeholder, rename applied" -> `S1`
- review: `R3` -> blocks `G1`

### P4: Heavy-duty vessels for non-edible materials

- mode: parallel with `P1`, `P2`, `P3` after `G0`
- depends on: `G0`
- owns: `apps/web/src/components/packaging/**` (proposed), `apps/web/src/components/ProductMedia.tsx`, `apps/web/src/components/ProductMedia.test.tsx`, `apps/web/src/components/ProductMedia.packaging.test.tsx`, `apps/web/src/components/BagArtwork.tsx`, `apps/web/src/components/BagArtwork.test.tsx`, `apps/web/src/components/home/CategoryTiles.tsx` + its colocated test, `plans/heavy_duty_sack_prototypes.html`
- reads: `plans/heavy_duty_sack_prototypes.html:79-307` -> `cond`/`lab`/`ghs` helpers, `INKS`, `sackA`/`sackB`/`sackF`, sample records -> port geometry, colours and type sizes verbatim; `apps/web/src/components/BagArtwork.tsx:23-56` -> balanced title split -> reuse; `:196,209-216` -> `useId` id scoping -> reuse for patterns and clip paths; `:202-204` -> decorative `ariaLabel === ''` contract -> preserve; `packages/contracts/src/products.ts:80-104,349-400` -> fields available on `Product` vs `ProductWithVariants` -> spec input surface; `packages/catalog/src/model.ts:1-21,36-79` -> categories, mixing groups, per-category fact shapes -> selector table + grade/hazard sources; `packages/catalog/src/categories/{tradeCreative,gardenOutdoors,householdCleaning}.ts` -> real `mixingGroup` / `consumptionClassification` distribution -> selector fixtures; `apps/web/src/components/ProductMedia.packaging.test.tsx:41-48` -> `data-accent` mapping contract -> keep for the food path
- acceptance: `resolvePackagingSpec` is pure and total over the six catalog categories; Trade & Creative -> `A`, Garden & Outdoors -> `B`, Household & Cleaning `caution` -> `F` corrosive, Household & Cleaning `non-food` -> `F` mild, the three food categories and unknown categories -> `BagArtwork`; each vessel renders at `720x720` with no external asset and no network call; two instances of `B` on one page carry distinct `pattern` / `clipPath` ids; `ariaLabel=""` still renders `aria-hidden` decorative artwork, otherwise the label names the vessel; every vessel prints `QAREFULLY MATERIALS EXCHANGE`, food bag included; no hazard, dose, grade or PPE string is printed without a catalog-fact or classification source; home tiles show `A`/`B`/`F` for the three non-food categories with powder-free names and sack/pallet quantities; prototypes file `Open` section records the three resolutions; owned tests updated and green
- non-goals: no API, contract, catalog-package, or DB change; no new dependency and no raster asset; `BagArtwork` geometry/colour/layout untouched beyond the brand string; custom-mix bags keep `BagArtwork` (`CheckoutSummary.tsx`, `OrderDetailView.tsx`, `PowderMixCartLineItem.tsx` untouched); `BagDesignsPage.tsx` untouched; do NOT touch `P2`-owned copy files or `P3`-owned files; no design-token refactor of the ported ink values
- upstream inputs: none
- changes:
  - add `apps/web/src/components/packaging/svgText.ts` -> `NARROW`/`UI`/`MONO` stacks, `cond`, `lab`, hazard marks, `INKS`
  - add `packagingSpec.ts` -> vessel/tone/ink selection plus lot, net weight, grade, hazard, dose derivation with omit-on-missing behaviour
  - add `KraftSackArtwork.tsx` (`A`), `WovenSackArtwork.tsx` (`B`), `KegArtwork.tsx` (`F`, `tone: 'corrosive' | 'mild'`)
  - add `PackagingArtwork.tsx` dispatcher; `food-bag` delegates to `BagArtwork`
  - rewrite `ProductMedia.tsx` to resolve a spec and render `PackagingArtwork`; vessel-accurate `ariaLabel`; keep `product.packaging` as the food-path colour source; keep the generic data-URI only for unresolvable categories
  - `BagArtwork.tsx` -> brand string `QAREFULLY POWDER CO.` -> `QAREFULLY MATERIALS EXCHANGE`; default `ariaLabel` drops "powder"
  - `CategoryTiles.tsx` -> tile records feed `PackagingArtwork`; non-food tiles render their vessel; names powder-free; quantities `25 kg` / `1,000 kg`
  - add `packagingSpec.test.ts` (selector matrix over real catalog category/classification/mixing-group combinations, omit-on-missing cases) and `PackagingArtwork.test.tsx` (one render per vessel + tone, id uniqueness, decorative mode, brand string)
  - update `ProductMedia.test.tsx`, `ProductMedia.packaging.test.tsx`, `BagArtwork.test.tsx`, `CategoryTiles` test to the new dispatch and brand string
  - rewrite the prototypes file `Open` section to the recorded resolutions
- invariants: selection pure and deterministic; no module-global mutable id counter; `useId`-scoped SVG ids; no fabricated safety copy; a11y label matches the rendered vessel; web never imports API source; no client-side money computation introduced
- relevant evidence: none prior
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/components/packaging apps/web/src/components/ProductMedia.test.tsx apps/web/src/components/ProductMedia.packaging.test.tsx apps/web/src/components/BagArtwork.test.tsx apps/web/src/components/home` -> `EV-P4-packaging`; `npm run typecheck -w @shop/web` -> `EV-P4-typecheck`
- verification: focused vitest + web typecheck green; every catalog category resolves to a vessel in the selector matrix test
- handoff: interface "non-food materials render `A`/`B`/`F`; `ProductMedia` dispatches by spec; brand string unified" -> `S1`
- review: `R4` -> blocks `G1`

### S1: Convergence and full verification

- mode: sequential after `G1`
- depends on: `P1`, `P2`, `P3`, `P4`, `G1`
- owns: `apps/web/src/features/catalog/CatalogProductJourney.integration.test.tsx`, `apps/web/src/features/help/HelpJourney.integration.test.tsx`, any remaining cross-lane test needing reconciliation; no feature-logic edits
- reads: accepted lane handoffs -> interfaces only; evidence ledger `EV-P1-*`, `EV-P2-copy`, `EV-P3-*`, `EV-P4-*`
- acceptance: cross-lane journeys pass with new copy, routes and vessels; repo-wide grep over `apps/web/src` shows residual "powder"/"Powder" only in retained internal identifiers (CSS names, `powderAccent`, `PowderMix*` symbols, `/custom-powder` path, help ids/slugs), retained backend-facing client code, and `features/designs/BagDesignsPage.tsx`; `npm run verify` passes once
- non-goals: no new behavior; no scope expansion; no backend Custom Powder edits; no reopening of `P1`-`P4` design decisions
- upstream inputs: `P1` -> retired legacy variants + self-healing seed; `P2` -> powder-free chrome; `P3` -> placeholder route + rename; `P4` -> vessel dispatch in `ProductMedia` + unified brand string
- changes:
  - reconcile integration/journey tests to new copy, routes, placeholder page, and artwork dispatch
  - resolve any cross-file string conflict surfaced by the four lanes
- invariants: no packet invariant relaxed to make a test pass; failures fixed at source
- relevant evidence: `EV-P1-migration`, `EV-P1-products`, `EV-P1-reset`, `EV-P2-copy`, `EV-P3-customsmallorder`, `EV-P3-typecheck`, `EV-P4-packaging`, `EV-P4-typecheck`
- test duty: `npm run verify` once after fixes settle -> `EV-S1-verify`
- verification: full verify green; deterministic on re-run
- handoff: completion evidence -> `G2`
- review: `R5` -> blocks `G2`

## Review Assignments

### R1: Review P1 legacy variant retirement

- method: invoke `code-reviewer` skill (`review_skill=code-reviewer`); apply its severity gate (critical + high only) and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` change set -> `020_retire_legacy_variants.ts`, `migrations/index.ts`, `seed.ts`, two extended API test files
- timing: immediately after `P1` settles and `EV-P1-*` exist; before `G1`
- blocks: `G1`
- reads: `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` -> legacy backfill + validation pattern; `apps/api/src/db/migrations/020_retire_legacy_variants.ts` -> new logic; `apps/api/src/db/migrations/index.ts` -> ordering; `apps/api/src/db/seed.ts` -> widened predicate + call site; extended tests
- acceptance: ordering after `019`; idempotent; rows preserved; `default_variant_id` repoint correct and total; legacy-only product left purchasable; seed predicate repairs same state; regression asserts contract-valid product response
- invariants: no row deletion; no `inventory_stock_movements` write; transaction covers retire+repoint; FK check clean; unknown errors surfaced; contracts untouched
- risk focus: data loss, partial repoint leaving dangling or inactive default variant, non-idempotency, migration ordering, breaking a product with no canonical variants, hidden coupling to seed run order
- non-goals: web copy, Custom Powder surface, pricing logic
- write policy: inspect-only
- test policy: assess `EV-P1-migration`, `EV-P1-products`, `EV-P1-reset`; run a command only if evidence is stale or missing and blocks verdict
- relevant evidence: `EV-P1-migration`, `EV-P1-products`, `EV-P1-reset`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review P2 copy sweep

- method: invoke `code-reviewer` skill (`review_skill=code-reviewer`); same severity gate and verification duty
- target: `P2` change set -> catalog/product/card/confirmation/home-tile files + colocated tests
- timing: after `P2` settles and `EV-P2-copy` exists; before `G1`
- blocks: `G1`
- reads: changed files + their colocated tests; `plans/b2b_materials_exchange_rebrand_coding_plan.md` "Copy and Terminology" -> mapping fidelity
- acceptance: mappings applied faithfully; no residual powder noun in owned user-facing strings; a11y labels still describe their controls; tests updated rather than weakened
- invariants: consumption badges and safety copy unchanged; loading/empty/error states preserved; no pricing display or money logic change; no file outside `P2` ownership touched
- risk focus: a11y label regressions, accidental removal of a state branch while rewording, test assertions loosened to pass, edits leaking into `P3`-owned files
- non-goals: backend, Custom Powder surface, catalog package data
- write policy: inspect-only
- test policy: assess `EV-P2-copy`; run only if stale or missing and blocks verdict
- relevant evidence: `EV-P2-copy`
- return: `reviewer_report_v1`

### R3: Review P3 rename, placeholder, deletion

- method: invoke `code-reviewer` skill (`review_skill=code-reviewer`); same severity gate and verification duty
- target: `P3` change set -> placeholder feature dir, deletions, `App.tsx`, `api/powderizer.ts`, nav, cart/order labels, help content, `index.css`
- timing: after `P3` settles and `EV-P3-*` exist; before `G1`
- blocks: `G1`
- reads: `apps/web/src/App.tsx` -> route wiring; new placeholder page + test; `apps/web/src/api/powderizer.ts` + `apps/web/src/hooks/useCart.ts` -> surviving client surface; help content + registry; `apps/web/src/index.css` -> removed vs retained blocks
- acceptance: placeholder static and honest; deletions complete with no dangling import or dead export; retained client exports exactly those `useCart` consumes; rename applied to every user-facing occurrence in scope; help ids/slugs/unions unchanged; retained CSS chain intact
- invariants: no API/contract/DB change; route paths unchanged; existing mix cart/order lines still render and remove; a11y preserved; no fabricated functionality
- risk focus: over-deletion breaking surviving mix rendering, removal of a still-referenced CSS class or export, help registry/type-union breakage, placeholder implying working functionality, edits leaking into `P2`-owned files
- non-goals: backend powderizer feature, contracts, copy owned by `P2`
- write policy: inspect-only
- test policy: assess `EV-P3-customsmallorder`, `EV-P3-typecheck`; run only if stale or missing and blocks verdict
- relevant evidence: `EV-P3-customsmallorder`, `EV-P3-typecheck`
- return: `reviewer_report_v1`

### R4: Review P4 packaging artwork

- method: invoke `code-reviewer` skill (`review_skill=code-reviewer`); same severity gate and verification duty
- target: `P4` change set -> `components/packaging/**`, `ProductMedia.tsx`, `BagArtwork.tsx`, `CategoryTiles.tsx`, their tests, prototypes file `Open` section
- timing: after `P4` settles and `EV-P4-*` exist; before `G1`
- blocks: `G1`
- reads: `plans/heavy_duty_sack_prototypes.html` -> approved geometry, ink values, hazard treatment -> port fidelity; `packagingSpec.ts` -> selector totality and purity; each vessel component -> id scoping, a11y label, decorative mode; `ProductMedia.tsx` -> dispatch + fallback path; `BagArtwork.tsx` -> brand-string-only diff; `CategoryTiles.tsx` -> tile records
- acceptance: selector total over all six categories and both non-food classifications; `F` mild carries no corrosion pictogram, no vertical `CORROSIVE`, no `DANGER` band; printed hazard/dose/grade strings all trace to catalog facts or classification; `useId`-scoped ids; `BagArtwork` diff limited to the brand string and default label; mix bags and `BagDesignsPage` untouched
- invariants: no API/contract/catalog-data change; no module-global mutable state; a11y label matches rendered vessel; no fabricated safety copy; no new dependency or raster asset
- risk focus: hazard overstatement on mild lines, hazard understatement on `caution` lines, SVG id collisions across concurrent instances, selector falling through to the food bag for a non-food product, artwork silently regressing the decorative `ariaLabel=""` contract, edits leaking into `P2`/`P3` files
- non-goals: backend, Custom Powder surface, copy owned by `P2`
- write policy: inspect-only
- test policy: assess `EV-P4-packaging`, `EV-P4-typecheck`; run only if stale or missing and blocks verdict
- relevant evidence: `EV-P4-packaging`, `EV-P4-typecheck`
- return: `reviewer_report_v1`

### R5: Convergence review

- method: invoke `code-reviewer` skill (`review_skill=code-reviewer`); same severity gate and verification duty
- target: `S1` integrated result -> reconciled journey/integration tests over the merged four-lane state
- timing: after `S1` fixes settle and `EV-S1-verify` exists; before `G2`
- blocks: `G2`
- reads: reconciled integration tests; cross-lane interfaces from lane handoffs
- acceptance: end-to-end catalog and help journeys coherent under new copy, routes and vessels; residual powder occurrences limited to the documented retained set; verify green
- invariants: no integration test weakened to absorb a real defect; no lane invariant relaxed at convergence
- risk focus: cross-lane defects not covered by packet reviews, journey tests asserting stale copy, verify masking a skipped suite
- non-goals: re-review of already-closed packet findings
- write policy: inspect-only
- test policy: assess `EV-S1-verify`; run only if stale or missing and blocks verdict
- relevant evidence: `EV-S1-verify`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/api/**`: `P1` only; no other packet edits API source
- `apps/api/src/db/migrations/index.ts`: `P1` only; migration version `020` reserved by `P1`
- `apps/web/src/features/catalog/*.tsx` (non-integration), `features/product/**`, `components/ProductCard.tsx`, `features/checkout/OrderConfirmationPage.tsx`: `P2` only
- `apps/web/src/components/packaging/**`, `components/ProductMedia.tsx`, `components/BagArtwork.tsx`, `components/home/CategoryTiles.tsx`, `plans/heavy_duty_sack_prototypes.html`: `P4` only
- `components/home/CategoryTiles.tsx` moved from `P2` to `P4`: its tile artwork records and its tile copy are the same objects -> single owner; `P4` carries the powder-free naming and sack/pallet quantity duty for tiles
- `apps/web/src/features/powderizer/**`, `features/customPowder/**`, `features/customSmallOrder/**`, `App.tsx`, `api/powderizer.ts`, `api/customPowder.ts`, `components/nav/navItems.ts`, `components/home/PowderizerBanner.tsx`, `features/cart/PowderMixCartLineItem.tsx`, `features/orders/OrderDetailView.tsx`, `features/help/content/**`, `index.css`: `P3` only
- `features/checkout/OrderConfirmationPage.tsx` is `P2`-owned copy; its import of `OrderDetailView` is `P3`-owned -> `P2` edits strings only, `P3` edits labels only, no structural change either side
- `components/ProductCard.tsx` is `P2`-owned and renders `P4`-owned `ProductMedia` -> `P2` edits card copy only, `P4` keeps the `ProductMedia` props contract stable, no prop change either side
- `features/cart/PowderMixCartLineItem.tsx` and `features/orders/OrderDetailView.tsx` import `P4`-owned `BagArtwork` -> `P3` edits mix labels only; `P4` keeps `BagArtworkProps` unchanged
- `CatalogProductJourney.integration.test.tsx`, `HelpJourney.integration.test.tsx`, cross-lane string reconciliation: `S1` only
- backend Custom Powder (`apps/api/src/features/powderizer/**`, `apps/api/test/powderizer/**`), `packages/contracts/**`, `packages/catalog/**`: NO packet edits
- composition: `S1` sole integration owner

## Harness Role Binding

- Codex only: launch configured `worker` agent for implementation/fix/worker-verification; configured `reviewer` agent for reviews. Model/effort/instructions from global Codex settings; never override in plan or assignment.
- non-Codex: use harness-native role/subagent config; preserve worker/reviewer responsibilities and communication contracts.
- all harnesses: reviewer runs `code-reviewer` skill; assignment sets `review_skill=code-reviewer`; reviewer invokes it by name (skill carries `disable-model-invocation`).

## Test Execution Schedule

- prerequisite for every command: Node 22 on `PATH` -> `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`; run from worktree root
- `T-P1a`: after `P1` -> owner `P1` -> `npm exec -w @shop/api -- tsx --test apps/api/test/db/migrations.integration.test.ts` -> `EV-P1-migration`
- `T-P1b`: after `P1` -> owner `P1` -> `npm exec -w @shop/api -- tsx --test apps/api/test/catalog/products.integration.test.ts` -> `EV-P1-products`
- `T-P1c`: after `P1` -> owner `P1` -> `npm run reset` -> `EV-P1-reset`
- `T-P2`: after `P2` -> owner `P2` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/catalog apps/web/src/features/product apps/web/src/components/ProductCard.test.tsx apps/web/src/features/checkout/PowderMixPurchaseRendering.test.tsx` -> `EV-P2-copy`
- `T-P3a`: after `P3` -> owner `P3` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/customSmallOrder apps/web/src/components/CategoryNav.test.tsx apps/web/src/features/help apps/web/src/hooks/useCart.test.tsx` -> `EV-P3-customsmallorder`
- `T-P3b`: after `P3` -> owner `P3` -> `npm run typecheck -w @shop/web` -> `EV-P3-typecheck`
- `T-P4a`: after `P4` -> owner `P4` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/components/packaging apps/web/src/components/ProductMedia.test.tsx apps/web/src/components/ProductMedia.packaging.test.tsx apps/web/src/components/BagArtwork.test.tsx apps/web/src/components/home` -> `EV-P4-packaging`
- `T-P4b`: after `P4` -> owner `P4` -> `npm run typecheck -w @shop/web` -> `EV-P4-typecheck`
- `T-S1`: after all lane fixes settle -> owner `S1` -> `npm run verify` once -> `EV-S1-verify`
- reuse: valid evidence reused when no invalidating file, dependency, migration, contract, config, or fixture changed afterward; a new session alone never invalidates; each agent receives only its own ledger entries
- invalidation: `apps/api/src/db/**` change -> invalidate `EV-P1-*` + `EV-S1-verify`; owned `P2` file change -> invalidate `EV-P2-copy` + `EV-S1-verify`; owned `P3` file change -> invalidate `EV-P3-*` + `EV-S1-verify`; owned `P4` file change -> invalidate `EV-P4-*` + `EV-S1-verify`; rerun smallest affected command first, `verify` only when the final result is affected

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values
- transport: inline canonical JSON; temp artifacts only under protocol (bulky logs/diffs) at `[temp]/orchestrator/[run_id]/[packet_id]/[artifact]` with inline summary + path + sha256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment `worker_assignment_v1`; reviewer assignment `reviewer_assignment_v1`; follow-up `orchestrator_directive_v1`; worker return `worker_report_v1`; reviewer return `reviewer_report_v1`; recovery `orchestrator_run_state_v1`
- reviewer method: `code-reviewer` skill via `review_skill=code-reviewer`
- worktree context: every assignment carries absolute worktree path + implementation branch + base revision; all repository-relative paths resolve under worktree root; commands run with worktree cwd
- templates: canonical `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`; record shapes `references/communication-record-shapes.md` when object arrays are non-empty
- run-state: `[temp]/orchestrator/[run_id]/state.json`; atomic replace; update after accepted report, directive, finding transition, decision, handoff, invalidation

## Orchestrator Run Order

1. End planning context after saving plan.
2. Fresh runtime orchestrator; load source repository instructions, this plan, canonical contracts, checkpoint.
3. Record current branch `materials_exchange_refactor` + `HEAD`; handle detached-`HEAD` or relevant-uncommitted blocker.
4. Create implementation branch + worktree from recorded `HEAD`; persist worktree identity.
5. Switch execution root to worktree; `npm ci` + post-install health checks.
6. Validate `G0`; project role-minimum context plus worktree context into assignments.
7. Launch `P1 || P2 || P3 || P4` in fresh worker contexts.
8. Accept each report; update checkpoint and evidence ledger; launch `R1`, `R2`, `R3`, `R4` against the exact settled change sets.
9. Route findings through worker fix directives carrying stable finding IDs; close after targeted evidence; validate `GR1`, `GR2`, `GR3`, `GR4`.
10. Validate `G1`; launch `S1`; run `npm run verify` once after fixes settle.
11. Review `S1` as `R5`; close findings through worker fix plus targeted evidence; validate `GR5`.
12. Validate `G2`.
13. Leave implementation branch and worktree intact. Reply with absolute worktree path, implementation branch, source branch `materials_exchange_refactor`, and base revision. User owns merge.

## Risks and Open Questions

- risk: retiring a legacy variant that is the only variant of some product removes it from sale -> mitigation: retire only when a canonical `sort_order >= 1` active variant exists; explicit test case; `R1` focus
- risk: `default_variant_id` repoint misses a product and leaves a dangling or inactive default -> mitigation: migration validation step throws; regression asserts contract-valid response; `R1` focus
- risk: deleting the builder breaks surviving powder-mix cart/order rendering -> mitigation: audited importer map shows the surviving components do not import the deleted dirs; `EV-P3-typecheck` + `useCart`/`PowderMixPurchaseRendering` tests; `R3` focus
- risk: mix-edit deep links now land on a placeholder -> mitigation: placeholder copy states editing is unavailable during rebuild; recorded as accepted UX residual for this pass
- risk: copy sweep silently weakens a11y labels or drops a state branch -> mitigation: `R2` a11y focus; colocated tests updated rather than deleted
- risk: `P2` and `P3` both touch the checkout/order confirmation neighbourhood -> mitigation: strict file-level ownership split stated in Ownership and Collision Rules; `S1` resolves any conflict
- risk: vessel artwork prints a hazard the product does not carry, or drops one it does -> mitigation: strings sourced only from `categoryFacts` / `consumptionClassification`, omit-on-missing; selector matrix test over real catalog combinations; `R4` hazard focus
- risk: `F` mild still reads as a corrosive keg at thumbnail size -> mitigation: mild tone drops stripe alert ink, pictogram, vertical word and `DANGER` band; `R4` checks the mild render explicitly
- risk: ported `B` patterns collide across concurrent instances (prototype used a module-global counter) -> mitigation: `useId` scoping, multi-instance id-uniqueness test mirroring `BagArtwork.test.tsx:29-56`
- risk: `ProductMedia` rewrite regresses the food path or the decorative `ariaLabel=""` contract -> mitigation: existing `ProductMedia`/`ProductMedia.packaging` tests retained and extended rather than replaced; `R4` focus
- risk: pre-existing gap that the API never emits `packaging` means the food path is untested against real data -> mitigation: web-side derivation makes artwork independent of that field; the API gap is recorded, not fixed, in this pass
- risk: brand-string unification touches the locked food bag -> mitigation: diff limited to one string plus the default `ariaLabel`; `R4` verifies no geometry or colour change
- question: whether stale `sort_order = 3` rows require action beyond current seed deactivation -> owner/gate: `P1` validation query, confirmed at `GR1`
- question: final placeholder wording and whether the nav entry keeps its gradient treatment -> owner/gate: `P3` proposes, orchestrator confirms at `G1`
- question: whether Trade & Creative pigment and absorbent lines (`36`-`38`, `40`, `49`) deserve a distinct treatment inside `A` rather than the cement-class layout -> owner/gate: `P4` renders them on `A` this pass, orchestrator confirms at `G1`; deferred to a later packaging pass if rejected
- resolved (user 2026-07-23): mild cleaning carve-out -> softened `F`; brand string -> unified to `QAREFULLY MATERIALS EXCHANGE`
- resolved (repository evidence): prototypes file's "trade pack sizes ahead of the catalog" note is stale -> `industrializeProducts` already forces `25 kg` / `1,000 kg` variants; artwork prints the resolved variant label

## Done Criteria

- migration `020` registered and idempotent; legacy `sort_order < 1` variants retired via `active = 0` with rows preserved and `default_variant_id` repointed; `npm run seed` alone repairs the same state
- `GET /api/products/:id` returns contract-valid variants for every canonical product; the reported `/products/31` failure no longer reproduces on a legacy-migrated DB
- catalog listing, filters, toolbar, product card, product page/details/purchase panel, similar products, order confirmation, and home tiles carry no "powder" noun in user-facing strings or a11y labels
- outstanding entries of the prior plan's terminology map applied in `ProductPurchasePanel.tsx`
- `/custom-powder` renders a static Custom Small Order WIP page; `/powderizer` still redirects to it; nav, help, FAQ, privacy, returns, safety, and cart/order mix labels say Custom Small Order
- `apps/web/src/features/powderizer/**`, `features/customPowder/**`, `PowderizerBanner.tsx`, `api/customPowder.ts` deleted with no dangling imports; unused `api/powderizer.ts` exports and dead `powderizer-*` CSS removed
- every Trade & Creative product renders `A`, every Garden & Outdoors product renders `B`, every Household & Cleaning `caution` product renders `F` corrosive and every Household & Cleaning `non-food` product renders `F` mild, on cards, product pages, cart lines, comparison, and home tiles
- food categories keep the locked bag; every vessel prints `QAREFULLY MATERIALS EXCHANGE`
- no printed hazard, dose, grade or PPE string without a catalog-fact or classification source; no product falls back to the "PACKAGING UNAVAILABLE" placeholder
- backend Custom Powder feature, contracts, catalog package data, routes, and DB identifiers unchanged
- existing powder-mix cart and order lines still render, requote, and remove on `BagArtwork`
- `npm run verify` green once at `G2`; every packet evidence entry green; `npm run reset` clean
