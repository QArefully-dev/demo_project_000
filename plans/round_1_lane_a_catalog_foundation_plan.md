# Round 1 Lane A: Catalog Foundation Implementation Plan

Status: ready for implementation.

Scope: `structured specifications and tags -> advanced filtering and sorting`.

Authority: `plans/powder_shop_catalog_expansion_plan.md` Round 1 Lane A. Code, manifests, migrations remain implementation truth.

## Orchestration Contract

- Before implementation starts: create dedicated git worktree from branch current at that moment.
- Lane A worktree: separate from Lane B and orchestrator worktrees. Suggested identity: `round-1-lane-a-catalog-foundation`; actual branch/path may follow local convention.
- Do not create worktree during planning.
- Perform every Lane A code change and verification command inside Lane A worktree.
- Delivery order: metadata phase complete and verified -> filtering/sorting phase starts. Never implement both topics concurrently.
- Final orchestrator summary: report actual Lane A worktree name and absolute path.
- Merge owner: user. Agent/orchestrator must not merge, rebase into user branch, cherry-pick into user branch, or delete worktree.
- Preserve pre-existing user changes. Do not overwrite unrelated work.

## Current-State Audit

### Canonical catalog

- `packages/catalog/src/model.ts`
  - `CatalogProduct`: product facts, `newest_rank`, Powderizer fields, `packaging`; no `active`, persisted creation timestamp, tags, structured specifications.
  - `ProductPackaging.quantity`: existing pack-weight display authority.
  - `ProductPackaging.consumptionLabel`: existing customer warning display authority.
  - `CatalogProduct.consumption_warning`: transitional duplicate warning input.
  - `createCatalogProducts()`: derives `mixable` and `mixUnitGrams` from packaging quantity.
- `packages/catalog/src/catalog.ts`
  - `withPackagingConsumption()`: copies transitional `consumption_warning` into packaging.
  - `CATALOG_PRODUCTS`: 50 canonical products across seven category files.
- `packages/catalog/src/categories/*.ts`
  - Each record owns `newest_rank`, packaging, stock, sales, prices.
  - No explicit creation timestamp, active state, discovery tags, source/use/storage/texture facts.
- `packages/catalog/src/validateCatalog.ts`
  - Validates unique `newest_rank`, packaging, mix eligibility, warnings, stable identity.
  - No vocabulary, normalized-key, missing-value, timestamp, active-state, or metadata consistency checks.
- `packages/catalog/src/catalog.test.ts`, `apps/api/src/db/powderCatalog.test.ts`
  - Protect stable identities, mix-unit derivation, bestseller, premium price, category coverage.

### Persistence and seed

- `apps/api/src/db/migrations/001_initial.ts`
  - `products.created_at` exists with runtime `datetime('now')` default.
  - No `active` column or metadata tables.
- `apps/api/src/db/migrations/002_catalog_columns.ts`
  - Adds slug, sale, sales, artwork columns for legacy databases.
- `apps/api/src/db/migrations/008_powderizer.ts`, `009_powderizer_expansion.ts`
  - Latest migration version: `009`.
  - Product mix columns already shared with Powderizer.
- `apps/api/src/db/migrations/index.ts`
  - Ordered migration registry. Next Lane A migration must use `010` unless branch-current code already reserves it; inspect again when implementation starts.
- `apps/api/src/db/seed.ts::seedDatabase()`
  - Upserts product fields but omits `created_at`; seed time controls canonical product dates.
  - Reserves IDs 1-50; preserves rows outside range and foreign-key references.
  - No tag/specification synchronization.
- `apps/api/src/db/reset.ts::resetDatabase()`
  - Deletes products after dependent commerce rows.
  - Must include new metadata tables in foreign-key-safe order.
- `apps/api/test/db/migrations.integration.test.ts`
  - `expectedVersions` ends at `009`.
  - Legacy product fixture verifies additive preservation.
- `apps/api/test/db/seed.integration.test.ts`
  - Verifies idempotent canonical updates, noncanonical-row preservation, Powderizer fields, destructive reset.

### Contracts, mapping, API

- `packages/contracts/src/products.ts`
  - `Product`: packaging, stock, pricing, category, sales, Powderizer fields only.
  - `ProductSort`: `newest | price_asc | price_desc | bestselling`.
  - `ProductQuery`: `q`, `category`, `onSale`, sort, page, pageSize.
  - No metadata schemas, active-derived availability, creation date, advanced filters, filter-option response.
- `packages/contracts/test/transport-contracts.test.ts`
  - No product metadata/query boundary cases.
- `apps/api/src/mappers/product.ts::toProductContract()`
  - Resolves canonical packaging through `image_set_id -> CATALOG_PRODUCTS` map.
  - No metadata mapping; unknown artwork omits packaging.
- `apps/api/src/features/catalog/productRepository.ts`
  - `ProductRow`: no `active`/`created_at` declarations despite persisted `created_at`.
  - `list()`: inline predicate shared textually by result/count queries; filters q/category/onSale.
  - Default/newest behavior: `ORDER BY id DESC`, not persisted date.
  - Existing stable sorts use `id ASC` tie-breaker.
  - `findById()`, categories, bestsellers, related, Powderizer reads do not gate inactive products.
- `apps/api/src/features/catalog/productService.ts`
  - Thin repository pass-through. Suitable home for cross-field query normalization/validation only if repository input becomes normalized domain query.
- `apps/api/src/routes/products.ts`
  - `/api/products`, categories, bestsellers, detail, related.
  - Fastify TypeBox validation already owns transport boundary.
- `apps/api/src/app.ts`
  - Composition root wires one product repository/service. No new service required.
- `apps/api/test/catalog/productRepository.integration.test.ts`
  - Minimal list/category/sale/search checks; no count/result equivalence or stable full-sort checks.
- `apps/api/test/catalog/products.integration.test.ts`
  - Detail packaging check only.
- `apps/api/src/mappers/product.test.ts`
  - Protects artwork-based packaging mapping and unknown artwork behavior.

### Existing consumers affected by active/availability semantics

- `apps/api/src/features/powderizer/powderizerService.ts`
  - Uses `listEligibleMixProducts()`, `listMixProducts()`, `findById()` through checkout.
  - Metadata work must preserve quote inputs, stock reservations, saved mix compatibility.
- `apps/api/src/features/checkout/checkoutService.ts`
  - Uses `ProductRepository.findById()` for saved mix requotes and stock validation.
  - Internal lookup must remain capable of loading inactive historical components; selection paths must reject new inactive components.
- `apps/api/src/features/cart/cartRepository.ts`, `features/favourites/favouritesRepository.ts`
  - Existence checks currently treat every persisted row as customer-selectable.
  - New selection gates need active state without hiding retained historical/order data.

### Web catalog

- `apps/web/src/features/catalog/useCatalogParams.ts`
  - URL already owns q/category/onSale/sort/page/pageSize.
  - `setParam()` resets page for every non-page change.
  - `clearFilters()` retains sort and page size.
- `apps/web/src/features/catalog/CatalogPage.tsx`
  - URL state -> `useProducts()` -> sidebar/toolbar/pagination.
  - Search debounce: 300 ms.
- `apps/web/src/features/catalog/catalogOptions.ts`
  - Four current sort labels; default newest omitted from URL.
- `apps/web/src/features/catalog/CatalogSidebar.tsx`
  - Category and on-sale controls plus active chips.
- `apps/web/src/features/catalog/CatalogToolbar.tsx`
  - Search and sort controls.
- `apps/web/src/api/products.ts`, `hooks/useProducts.ts`
  - Manually repeat current query shape.
  - Hook aborts superseded request and ignores stale completion.
- `apps/web/src/features/product/ProductSpecifications.tsx`
  - Existing generic flat `<dl>` renderer; currently unused by `ProductPage`.
- `apps/web/src/features/product/ProductPage.tsx`
  - Renders details and related products; Round 4 owns final specification-section composition.
- `apps/web/src/features/catalog/CatalogPage.test.tsx`, `CatalogProductJourney.integration.test.tsx`
  - Protect direct URL parsing, pagination reset, history restoration, search debounce.
- `apps/web/src/hooks/useProducts.test.tsx`
  - Protects abort/stale-response behavior.

## Locked Decisions and Invariants

### Canonical metadata

- Canonical authoring owner: `@shop/catalog`.
- Product metadata shape:
  - `active: boolean`.
  - `created_at: string`: deterministic UTC ISO 8601 instant.
  - `tags: readonly CatalogTag[]`: `{ key, label }`; key uses lowercase kebab-case; label owns display copy.
  - `specifications`: nullable typed facts for `texture`, `colour`, `source`, `intendedUse`, `storageGuidance`.
- Derived facts:
  - Pack weight display -> `packaging.quantity` only.
  - Pack weight normalized grams -> `parseMixUnitGrams(packaging.quantity)` only; conceptual quantity -> `null` for filtering, while existing `mixUnitGrams` compatibility remains unchanged.
  - Warning class -> `packaging.consumptionLabel` only: `none | not-for-consumption`.
- Remove `CatalogProduct.consumption_warning` and `withPackagingConsumption()` after category records pass warning directly to `createPackaging()`.
- Missing fact -> `null` or absent persisted row. Never infer from category, description, colour hex, or product name.
- Group registry -> stable keys/labels/order:
  - `appearance`: texture, colour.
  - `origin-and-use`: source, intended use.
  - `pack-and-care`: pack weight, storage guidance, warning class.
- Fact registry owns transport label, group, order, filterability. Product records own values only.
- Tags remain separate from specifications in canonical model, persistence, contracts, query model.
- `created_at` replaces `newest_rank` as ordering authority. Derive fixed timestamps from existing rank during content conversion, then remove runtime `newest_rank` field. Preserve exact rank ordering.

### Persistence

- Migration `010_catalog_metadata` unless branch-current migration registry requires next free version.
- `products` additions:
  - `active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))`.
  - Keep existing `created_at`; migration preserves legacy values.
- New tables:
  - `catalog_tags(key TEXT PRIMARY KEY, label TEXT NOT NULL)`.
  - `product_tags(product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, tag_key TEXT NOT NULL REFERENCES catalog_tags(key), PRIMARY KEY(product_id, tag_key))`.
  - `product_specifications(product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, specification_key TEXT NOT NULL, value_key TEXT NOT NULL, display_value TEXT NOT NULL, numeric_value INTEGER, PRIMARY KEY(product_id, specification_key))`.
- Indexes:
  - `products(active, created_at, id)`.
  - `products(active, price_cents, id)`.
  - `product_tags(tag_key, product_id)`.
  - `product_specifications(specification_key, value_key, product_id)`.
  - Optional numeric index only after query-plan evidence shows need; 50-row catalog does not justify speculative index.
- `value_key`: normalized kebab-case filter token. `display_value`: customer copy. `numeric_value`: pack grams only; null elsewhere.
- Group/label/order registry stays in contracts/catalog code, not duplicated per DB row.
- Seed transaction owns product row plus derived tag/specification index synchronization.
- Canonical IDs 1-50: replace tag/spec rows atomically on every seed; upsert tag labels; preserve rows and metadata for product IDs outside canonical range.
- Normal seed updates canonical `active` and `created_at`; retains user/commerce rows and foreign keys.
- Migration does not fabricate metadata for legacy/noncanonical products. Defaults them active and preserves existing creation timestamps.

### Product visibility and availability

- Internal existence: persisted row exists, regardless of active state.
- Customer-visible product: `active = 1`.
- Available product: `active = 1 AND stock_count > 0`.
- Product transport: add `createdAt`, `available`, `tags`, `specificationGroups`; never expose raw `active`.
- Customer catalog/detail/categories/bestsellers/related/favourites reads: active only.
- New cart/favourite/Powderizer selections: active only. Cart purchase availability also requires stock through existing stock authority; do not weaken checkout transaction checks.
- Historical cart/order/saved-mix lookup: retain internal row access. Inactive saved component causes existing deterministic unavailable/requote outcome, not silent substitution.
- All current canonical products start active. Normal customer behavior remains unchanged.

### Query contract

- Preserve `q` as existing shareable name/description search key; this satisfies name discovery without breaking links.
- Add filters:
  - `minPriceCents`, `maxPriceCents`: inclusive nonnegative integers; reject min > max.
  - `addedFrom`, `addedTo`: `YYYY-MM-DD`, inclusive UTC calendar dates; reject invalid dates and from > to.
  - `tag`: repeated normalized tag keys, maximum 8, deduplicated; product must match every selected tag.
  - `spec`: repeated `<specification-key>:<value-key>` tokens, maximum 8; AND across distinct keys; reject duplicate keys and unsupported/nonfilterable keys.
  - `availability`: `available | out_of_stock`; inactive rows remain excluded before availability predicate.
- Existing `category`, `onSale`, page, pageSize behavior remains.
- Sort values:
  - `newest`: `created_at DESC, id ASC`.
  - `oldest`: `created_at ASC, id ASC`.
  - `name_asc`: `name COLLATE NOCASE ASC, id ASC`.
  - `price_asc`: `price_cents ASC, id ASC`.
  - `price_desc`: `price_cents DESC, id ASC`.
  - `bestselling`: `sales_count DESC, id ASC`.
- Default sort: `newest`; omit default from URL.
- Shared SQL predicate builder returns one allowlisted `WHERE` fragment plus ordered params. Result and count queries consume same object. No user-provided SQL identifiers/fragments.
- Out-of-range page after filtering: API returns requested page plus empty items; web resets page before request on local filter mutation. Direct links remain deterministic.
- Filter-option endpoint: `GET /api/products/filter-options`.
  - Returns active-catalog tag options and filterable specification values with keys/labels/group order.
  - Returns price and creation-date bounds only if UI controls require them; omit unused fields.
  - Stable ordering from registry label/order, never row discovery order.

### URL and UI

- URL remains sole catalog state authority.
- Repeated `tag` and `spec` params serialized in stable normalized order.
- Unknown/malformed local URL values ignored for rendering and omitted on next state mutation; API still rejects malformed direct requests.
- Every filter mutation, including tag/spec removal, dates, price, availability, search, category, sale, resets `page`.
- Sort and `pageSize` mutations also reset `page`, matching current helper.
- Browser back/forward and direct links restore full filter/sort/page state.
- Keep current stale-request abort behavior.
- Extend existing sidebar; do not rewrite catalog page.
- Advanced controls use native accessible inputs/fieldset/legend. Active chips expose specific remove labels, not generic repeated `Remove filter` names.
- Round 1 may render grouped specifications only in focused metadata renderer/test harness if needed. `ProductPage` composition remains Round 4 scope.

## Implementation Phases

### Phase 0: Worktree and branch-current re-audit

Required sequence:

1. Record current branch and HEAD.
2. Create dedicated Lane A branch/worktree from recorded HEAD.
3. Enter Lane A worktree; confirm clean scoped baseline.
4. Re-read migration registry, roadmap Round 1, `CLAUDE.md`, target files, user changes.
5. Reserve next migration version locally. If Lane B changed independent web files only, keep Lane A migration at next free value.

Parallel-safe work: none. Worktree must exist before implementation work.

Exit:

- Lane A worktree isolated.
- Actual worktree name/path recorded for final summary.
- No merge performed.

### Phase 1: Metadata model and canonical content

Required sequence, shared-owner packet:

1. `packages/catalog/src/model.ts`
  - Add tag/specification/active/timestamp types, registries, derivation helpers.
  - Define normalized-key validation and deterministic rank-to-timestamp conversion used only during content conversion.
  - Remove transitional warning field after consumers migrate.
2. `packages/catalog/src/catalog.ts`
  - Remove `withPackagingConsumption()` compatibility layer.
  - Export lookup/registry helpers needed by mapper/seed without import side effects.
3. `packages/catalog/src/validateCatalog.ts`
  - Validate ISO timestamps, unique preserved chronology, active boolean, tag uniqueness/key-label consistency, specification keys/value keys, missing-value handling, group registry coverage.
  - Assert derived pack weight/warning match packaging authorities.

Parallel-safe after model/registry freeze:

- Category content packets by distinct files:
  - `packages/catalog/src/categories/pantry.ts`, `performance.ts`.
  - `drinks.ts`, `household.ts`.
  - `outdoors.ts`, `questionable.ts`, `impossible.ts`.
- Each packet:
  - Convert `newest_rank` to fixed `created_at` preserving ordering.
  - Set `active: true`.
  - Add curated normalized tags and nullable typed facts.
  - Pass warning directly through packaging constructor.
  - Avoid unsupported safety/performance/source claims. Use null when source fact lacks truthful content basis.
- `packages/catalog/src/catalog.test.ts` expansion may proceed separately after exported types freeze.

Required integration sequence:

1. Combine category packets.
2. Run catalog validator/tests.
3. Resolve vocabulary collisions centrally; never create near-duplicate keys such as `fine` and `finely-ground` without explicit semantic difference.
4. Freeze canonical metadata shape before persistence/contracts begin.

Verification:

- `npm test -w @shop/catalog`
- `npm run typecheck -w @shop/catalog`
- Tests: missing facts preserved, duplicate tags rejected, invalid keys rejected, warning/weight authority mismatch rejected, rank chronology preserved exactly, all 50 products validate.

### Phase 2: Metadata persistence, seed, contracts, mapping

Prerequisite: Phase 1 complete.

Parallel-safe after canonical shape freeze:

- Persistence packet:
  - Add `apps/api/src/db/migrations/010_catalog_metadata.ts` using actual next free version.
  - Register migration in `apps/api/src/db/migrations/index.ts`.
  - Update `apps/api/src/db/seed.ts` to persist active/date and atomically rebuild canonical tag/spec rows from catalog derivations.
  - Update `apps/api/src/db/reset.ts` delete order.
  - Expand `apps/api/test/db/migrations.integration.test.ts`, `seed.integration.test.ts`.
- Contract packet:
  - Extend `packages/contracts/src/products.ts` with tag/specification group/product metadata schemas.
  - Add filter-option response schema now, before query fields arrive in Phase 4.
  - Expand `packages/contracts/test/transport-contracts.test.ts` for strict metadata shapes and no extra properties.

Required sequence within each packet:

- Migration -> seed/reset -> migration/seed tests.
- Schema definitions -> static types -> contract tests.

Required integration sequence after both packets:

1. Update `apps/api/src/features/catalog/productRepository.ts::ProductRow` with `active`, `created_at`.
2. Split internal lookup from customer-visible lookup:
  - Preserve `findById()` for internal checkout/history needs.
  - Add active-only read used by product route and related validation.
  - Gate categories, bestsellers, related, eligible mix list, new mix lookup appropriately.
3. Update `apps/api/src/mappers/product.ts::toProductContract()`:
  - Resolve canonical tags/grouped facts using same stable artwork lookup pattern as packaging.
  - Derive `available` from active plus stock.
  - Emit `createdAt` from row.
  - Return empty tag/spec groups for unknown legacy artwork; never invent facts.
4. Update `apps/api/src/features/catalog/productService.ts`, `routes/products.ts` to use active-only customer read.
5. Apply active selection rules in `cartRepository.ts`, `favouritesRepository.ts`, Powderizer read paths without changing historical lookup semantics.
6. Update mapper/API/Powderizer/cart/favourite tests and TypeScript fixtures impacted by required contract fields.

Parallel-safe after repository interface freeze:

- Mapper unit tests.
- Product API integration tests.
- Cart/favourite active-selection integration tests in distinct test files.
- Powderizer active-component regressions in existing Powderizer integration file with single owner.

Verification:

- `npm test -w @shop/contracts`
- `npm test -w @shop/catalog`
- `npm exec -w @shop/api -- tsx --test test/db/migrations.integration.test.ts`
- `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts`
- `npm exec -w @shop/api -- tsx --test test/catalog/productRepository.integration.test.ts`
- `npm exec -w @shop/api -- tsx --test test/catalog/products.integration.test.ts`
- `npm test -w @shop/api`

Metadata exit gate:

- Fresh and legacy databases migrate through new version.
- Canonical seed deterministic/idempotent; noncanonical rows preserved.
- Product detail/list expose grouped facts, tags, deterministic date, derived availability.
- Inactive rows absent from customer discovery and new selection; internal historical reads retained.
- Powderizer quote/checkout/snapshot tests unchanged except explicit inactive regressions.
- Only after this gate passes may filtering/sorting implementation start.

### Phase 3: Metadata checkpoint

Required sequence:

1. Run metadata-focused full workspace typecheck/test/build.
2. Inspect diff for duplicated pack weight, warning, display labels, or SQL vocabularies.
3. Confirm no `newest_rank` runtime dependency remains.
4. Confirm migration version/order against branch-current registry.
5. Record checkpoint commit in Lane A worktree if orchestrator workflow uses commits.

Parallel-safe work: none. Checkpoint prevents filtering work from masking metadata failures.

### Phase 4: Advanced query model and repository

Prerequisite: metadata checkpoint complete.

Required sequence, shared contract packet:

1. `packages/contracts/src/products.ts`
  - Extend `ProductSort`, `ProductQuery`, normalized tag/spec tokens, dates, price range, availability.
  - Bound repeated arrays and scalar lengths.
2. `packages/contracts/test/transport-contracts.test.ts`
  - Cover valid repeated filters, malformed dates/tokens, unsupported sort, bounds.
3. Add domain query normalization module under `apps/api/src/features/catalog/`, preferably `catalogQuery.ts`.
  - Validate cross-field ranges.
  - Deduplicate tags.
  - Parse spec tokens against filterable registry.
  - Produce normalized query independent of Fastify.
4. Add SQL builder module, preferably `catalogSql.ts`.
  - Build one active-first predicate and ordered parameter list.
  - Build allowlisted order clause separately.
  - Use `EXISTS` subqueries for tag/spec AND semantics; avoid joins that duplicate product rows.

Parallel-safe after ProductQuery freeze:

- Pure query-normalization unit tests.
- SQL-builder unit tests for fragment/parameter determinism.
- Repository integration-test fixture design in `apps/api/test/catalog/productRepository.integration.test.ts`.
- Filter-option contract/route tests if metadata endpoint implementation does not touch repository list code.

Required repository sequence:

1. Refactor `productRepository.ts::list()` to consume normalized query and shared predicate object.
2. Feed identical predicate SQL/params into `COUNT(*)` and result queries.
3. Add all stable sort mappings.
4. Add `listFilterOptions()` query using active products and stable registry ordering.
5. Expose through `productService.ts` and `routes/products.ts`.
6. Map cross-field domain errors to deterministic 400 response; TypeBox remains scalar/shape gate.

Repository verification cases:

- Each filter alone.
- Combined q/category/sale/price/date/tag/spec/availability.
- Multiple tags require all.
- Multiple specs require all; duplicate spec key rejected.
- Boundary prices/dates inclusive.
- Inactive rows excluded from every query and filter option.
- `available` excludes zero-stock; `out_of_stock` includes active zero-stock only.
- Count equals unpaginated predicate cardinality for representative combinations.
- Page slices concatenate to same ordered IDs as large-page query.
- Every sort stable under tied primary values.
- LIKE escaping still protects `%`, `_`, `\` literal searches.
- Query text contains only allowlisted sort/spec identifiers.

Verification:

- `npm test -w @shop/contracts`
- `npm exec -w @shop/api -- tsx --test test/catalog/productRepository.integration.test.ts`
- `npm exec -w @shop/api -- tsx --test test/catalog/products.integration.test.ts`
- `npm run typecheck -w @shop/api`

### Phase 5: URL state, API client, controls

Prerequisite: Phase 4 contract/repository behavior frozen.

Parallel-safe packets with explicit file ownership:

- URL/client packet:
  - `apps/web/src/features/catalog/useCatalogParams.ts`
  - `apps/web/src/api/products.ts`
  - `apps/web/src/hooks/useProducts.ts`
  - Add filter-options hook/client beside existing product API ownership.
  - Centralize query serialization/parsing; avoid repeating expanded field lists across three modules.
- Controls packet:
  - `apps/web/src/features/catalog/catalogOptions.ts`
  - `apps/web/src/features/catalog/CatalogSidebar.tsx`
  - Add accessible price/date/availability/tag/spec groups and removable chips.
  - Keep toolbar search; extend sort options in `CatalogToolbar.tsx` only after sort contract freeze.
- Test packet:
  - Add pure URL-state tests if helper extracted.
  - Extend `CatalogPage.test.tsx`, `CatalogProductJourney.integration.test.tsx`, `useProducts.test.tsx` after component props freeze.

Required integration sequence:

1. Merge URL/client packet into Lane A worktree.
2. Wire expanded parsed state through `CatalogPage.tsx -> useProducts()`.
3. Wire filter options/loading/error states into sidebar without blocking core results.
4. Merge controls packet; resolve prop changes in one owner pass.
5. Merge tests; update fixtures for required metadata fields through shared test factory where repeated.
6. Confirm search debounce, stale abort, pagination, empty/error states remain.

Web verification cases:

- Direct URL restores every filter, sort, page, pageSize.
- Every local filter change removes page before next product request.
- Repeated tag/spec values serialize stably and survive history navigation.
- Clear-all removes discovery filters, retains sort/pageSize, removes page.
- Unknown URL values do not crash or produce invalid controls.
- Back/forward restores controls and requests.
- Superseded expanded-filter request aborts; stale success/rejection cannot commit.
- Filter-option failure leaves search/results/pagination usable.
- Controls have labels, grouped semantics, keyboard operation, specific chip removal names.
- Narrow viewport sidebar remains usable without introducing modal state outside URL.

Verification:

- `npm exec -w @shop/web -- vitest run --configLoader runner src/features/catalog/CatalogPage.test.tsx`
- `npm exec -w @shop/web -- vitest run --configLoader runner src/features/catalog/CatalogProductJourney.integration.test.tsx`
- `npm exec -w @shop/web -- vitest run --configLoader runner src/hooks/useProducts.test.tsx`
- `npm test -w @shop/web`
- `npm run typecheck -w @shop/web`

### Phase 6: Lane integration and handoff

Required sequence:

1. Run formatting checks; Markdown remains manually reviewed.
2. Run focused tests from prior phases.
3. Run `npm run smoke`.
4. Run `npm run verify`.
5. Run `npm run seed`, then `npm run seed` again against same temporary/local test DB; confirm deterministic metadata and preserved noncanonical rows through integration tests, not manual production data edits.
6. Review catalog customer journey: direct filtered URL -> filter mutation -> page reset -> product -> back -> restored state.
7. Review inactive/zero-stock fixtures through API integration tests.
8. Inspect `git status`, scoped diff, migration ordering, authored-size report.
9. Final orchestrator summary reports:
  - completion and verification results;
  - actual Lane A worktree name and absolute path;
  - branch/commit identifiers if created;
  - known risks or failed checks;
  - explicit `Merging handled by user; no merge performed.`

Parallel-safe work: focused API and web verification may run concurrently if commands use isolated temporary DBs. `npm run verify`, seed/reset checks, final diff review run sequentially.

## Cross-Lane Ownership and Integration Order

- Lane A owns catalog schema, contracts, product mapper/repository/service/routes, catalog URL/client/hooks/controls/tests.
- Lane B may run concurrently only inside separate worktree and independent help/policy files.
- Shared likely Lane B files: `apps/web/src/App.tsx`, `components/Layout.tsx`, footer/navigation tests.
- Lane A should avoid `App.tsx`, `Layout.tsx`, footer/navigation unless required. Catalog work needs no route addition beyond API route registration already contained in `productsRoutes`.
- If both lanes require same file unexpectedly: stop parallel edits, assign one owner, sequence second change after first commit. Do not manually interleave conflicting edits.
- Round 4 owns `ProductPage` composition. Lane A must not add final rich-detail layout, bundle/review/similar sections, or help context links.

## Risks and Compatibility Controls

- Migration collision: choose next free version after worktree creation; never rename already-landed migration silently.
- Nondeterministic dates: canonical seed must write fixed UTC timestamps, never current clock.
- Metadata drift: derive pack weight/warning rows from packaging helpers; validator rejects mismatch.
- Query count drift: one predicate object feeds result/count; integration tests compare cardinality and pages.
- Row duplication: filter through `EXISTS`, not tag/spec joins in product select.
- URL explosion: bound tag/spec counts and normalized token lengths; stable dedupe before serialization.
- Existing links: retain q/category/onSale/sort/page/pageSize meanings; new default newest matches intended behavior but now uses dates preserving prior rank order.
- Legacy rows: active default preserves visibility; absent metadata stays absent; creation timestamps remain unchanged.
- Historical commerce: internal lookup remains ungated; only customer discovery/new selection uses active gate.
- Powderizer regression: do not change `mixUnitGrams`, pricing, allocations, warning derivation, snapshots, or reservation transactions.
- Unsupported claims: metadata copy uses factual existing content or null. No invented certifications, health effects, storage guarantees, origins, or performance claims.
- Frontend request races: preserve abort controller/request ID behavior while adding dependencies.
- Large shared files: extract registry/query/SQL helpers by ownership; do not grow `productRepository.ts` or `CatalogPage.tsx` into mixed-responsibility modules.

## Exit Criteria

- Dedicated Lane A worktree used from branch current at implementation start.
- Metadata implemented and verified before filtering starts.
- 50 canonical products carry deterministic active/date/tag/spec metadata with truthful missing values.
- Pack weight and warning each have one canonical source.
- Additive migration preserves legacy and noncanonical rows.
- Seed/reset remain deterministic, idempotent, foreign-key safe.
- Customer product contracts expose grouped specs, tags, date, active-plus-stock availability.
- Advanced filters and six stable sorts work through contracts -> API -> repository -> URL -> UI.
- Result/count queries share one predicate model.
- Pagination resets on every filter/sort/page-size change; direct links/history restore full state.
- Powderizer/cart/checkout/favourites compatibility tests pass.
- `npm run verify` passes, or final summary names exact failure with evidence.
- Final summary includes actual worktree name/path.
- No Lane A merge performed; user owns merging.
