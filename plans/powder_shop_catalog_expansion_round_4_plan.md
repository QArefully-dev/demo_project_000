# Powder Shop Catalog Expansion Round 4 Coding Plan

Status: implemented; verification partially limited by an incomplete local dependency installation.

Implementation authorization: Round 4 frontend work completed.

Goal: connect completed catalog, comparison, bundle, review, similarity, help, policy work into one resilient customer journey. Frontend integration only unless baseline audit proves contract defect.

Delivery chain:

`comparison selection foundation -> catalog entry points -> product-detail composition -> journey verification`

#### Scope

- Add comparison toggle to catalog cards and product purchase panel.
- Add catalog comparison tray with selected count, clear action, ordered `/compare?ids=...` link.
- Render grouped specifications from existing `Product.specificationGroups`.
- Render product-scoped curated bundles through existing `GET /bundles?productId=...` client.
- Compose reviews and similar products already delivered in Rounds 2-3.
- Add contextual help and policy links from typed content registry.
- Preserve bundle component links to product routes.
- Preserve product purchase flow during every secondary-section state.

#### Non-Goals

- No schema migration, seed change, API route, shared contract, scoring, pricing, review-rule, audit-rule, or cart-transaction change.
- No comparison account persistence.
- No bundle discount, nested cart line, client price calculation, or partial bundle add.
- No review moderation UI.
- No fake specification fallback, rating, safety claim, storage claim, delivery claim, or policy copy.
- No broad catalog, cart, auth, or product-page rewrite.

#### Current Baseline

- `ComparisonPage.tsx`: direct URL parsing, ordered API request, unavailable-item reporting, valid local-storage restore, removal flow.
- `comparisonStorage.ts`: stores only complete valid 2-4 ID selection.
- `ProductCard.tsx`: product, wishlist, cart actions; no comparison slot.
- `CatalogPage.tsx`: URL-owned discovery state; no comparison state or CTA.
- `ProductPage.tsx`: breadcrumbs, gallery, purchase panel, description, isolated similar-products shelf.
- `ProductSpecifications.tsx`: unused flat specification renderer; contract supplies ordered groups.
- `useBundles(productId)`: product-filtered loading, abort, retry support.
- `BundleCard.tsx`: server total, availability, atomic add delegation, component product links.
- `ReviewsSection.tsx`: standalone public and owner states; login return path preserved.
- `SimilarProductsSection.tsx`: standalone load, retry, abort behavior; empty response currently hidden.
- `helpContentRegistry.ts`: canonical help and policy labels plus paths.

Baseline audit gate:

1. Run focused Round 2-3 web tests before edits.
2. Confirm numeric product IDs across catalog, product detail, bundle components, comparison helpers.
3. Confirm `GET /bundles?productId=...`, review clients, similarity client, grouped product metadata remain contract-compatible.
4. Record baseline failure before continuing. Fix unrelated failure outside Round 4 only through separate authorization.

#### Comparison State Rules

- `/compare?ids=...` remains comparison-page authority.
- Entry-point draft: ordered, unique, 0-4 IDs; React context mounted inside `Layout` for route continuity.
- Existing `COMPARISON_STORAGE_KEY`: latest complete valid 2-4 selection only.
- Draft with 0-1 IDs: never overwrite or clear latest valid stored selection.
- Provider initialization: latest valid stored selection or empty selection; storage failure returns empty selection without breaking page.
- Add at four IDs: reject mutation, keep order, expose accessible status.
- Remove: preserve remaining order.
- Compare CTA: enabled only for 2-4 IDs; URL generated through one serializer.
- Direct comparison URL: overrides provider and storage for request.
- Successful comparison response with 2-4 available products: sync provider and latest valid storage using API-returned order.
- Missing or inactive response item: report existing status; never create blank matrix column.
- Anonymous operation only; no auth dependency.

#### Orchestrator Execution Graph

Strict gates:

`Phase 0 baseline -> Phase 1 shared comparison foundation -> Lane A catalog comparison`

`Phase 0 baseline -> [Lane B specifications/help, Lane C bundles, Lane D review/similarity resilience]`

`[Lane A, Lane B, Lane C, Lane D] -> Phase 3 ProductPage integration -> Phase 4 verification`

Parallel rule:

- After Phase 0, run Phase 1 and Lanes B-D in parallel.
- Start Lane A only after Phase 1 API and tests stabilize.
- Run Lanes A-D in parallel where dependency permits; enforce file ownership below.
- Do not edit `ProductPage.tsx`, `ProductPurchasePanel.tsx`, or `ProductPage.test.tsx` in Lanes A-D.
- Assign one owner to Phase 3 composition files after all lane handoffs.
- Run Phase 4 after merged tree typechecks.

Conflict rule:

- Shared file needed by two lanes -> earlier lane owns change; later lane consumes exported API.
- Contract or backend change discovered -> stop affected lane, report mismatch, re-scope before edit.
- Cross-lane refactor -> defer to Phase 3 unless required for lane acceptance.

#### Phase 0: Baseline Audit

Mode: serial.

Owned files: none.

Work:

1. Inspect current implementations listed in baseline.
2. Run focused comparison, catalog, bundle, review, similar, product-page tests.
3. Confirm no pending migration or transport work.
4. Freeze file ownership before parallel dispatch.

Exit gate:

- Baseline results recorded.
- Round 4 remains frontend-only.
- Lane ownership has no overlap.

#### Phase 1: Shared Comparison Foundation

Mode: serial relative to Lane A; parallel with Lanes B-D.

Owned files:

- `apps/web/src/features/comparison/comparisonSelection.ts`
- `apps/web/src/features/comparison/comparisonSelection.test.ts`
- `apps/web/src/features/comparison/comparisonStorage.ts`
- `apps/web/src/features/comparison/comparisonStorage.test.ts`
- new `apps/web/src/features/comparison/ComparisonSelectionContext.tsx`
- new focused context test
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/features/comparison/ComparisonPage.tsx`
- `apps/web/src/features/comparison/ComparisonPage.test.tsx`

Work:

1. Add pure ordered draft helpers: add, remove, toggle, clear, max-four rejection, compare-path serialization.
2. Keep strict 2-4 URL parser unchanged for comparison requests.
3. Add provider API: `selectedIds`, `isSelected`, `toggle`, `clear`, `canCompare`, `comparePath`, capacity status, valid-selection sync.
4. Initialize provider from existing valid storage with exception-safe browser access.
5. Persist only 2-4 complete selections; never replace stored valid selection with incomplete draft.
6. Mount provider around routed content inside `Layout`.
7. Sync provider after successful comparison response; retain URL authority.
8. Keep direct links, storage restore, unavailable reporting, removal behavior compatible.

Required tests:

- Toggle preserves insertion order and uniqueness.
- Fifth add rejected without selection mutation.
- Remove then re-add moves ID to tail.
- 0-1 draft does not overwrite latest stored 2-4 selection.
- Storage get/set/remove failure does not break provider.
- Direct URL overrides stored and provider values.
- Successful response sync uses available response order.
- Invalid URL performs no API request.

Exit gate:

- Lane A consumes stable context API without touching context internals.
- Existing comparison links remain shareable and anonymous.

#### Lane A: Catalog Comparison Entry Points

Mode: serial after Phase 1; parallel with Lanes B-D.

Owned files:

- new `apps/web/src/features/comparison/CompareProductButton.tsx`
- new focused button test
- new `apps/web/src/features/comparison/ComparisonTray.tsx`
- new focused tray test
- `apps/web/src/components/ProductCard.tsx`
- `apps/web/src/components/ProductCard.test.tsx`
- `apps/web/src/features/catalog/CatalogPage.tsx`
- `apps/web/src/features/catalog/CatalogPage.test.tsx`
- `apps/web/src/features/catalog/CatalogProductJourney.integration.test.tsx`

Work:

1. Add optional comparison-control slot to `ProductCard`; keep home, wishlist, similar shelves unchanged when omitted.
2. Render pressed-state compare toggle on catalog cards.
3. Prevent compare click from triggering product navigation or cart mutation.
4. Render comparison tray near result summary; show selection count, ordered compare link, clear action, capacity message.
5. Keep catalog filter, sort, page, history state independent from comparison draft.
6. Keep selection through catalog pagination and product-route navigation via provider.
7. Preserve keyboard focus, `aria-pressed`, status announcement, visible labels.

Required tests:

- Card toggle exposes selected and unselected states.
- Two selections produce ordered `/compare?ids=id1,id2` link.
- Remove and clear update tray without changing catalog URL.
- Fifth selection blocked with accessible message.
- Filter, sort, page changes preserve selection.
- Compare action never calls `addItem`.
- Product cards outside catalog render without comparison control.

Exit gate:

- Customer can select 2-4 catalog products and open comparison page without editing URL.

#### Lane B: Grouped Specifications and Context Links

Mode: parallel after Phase 0.

Owned files:

- `apps/web/src/features/product/ProductSpecifications.tsx`
- new `apps/web/src/features/product/ProductSpecifications.test.tsx`
- new `apps/web/src/features/product/ProductContextLinks.tsx`
- new focused context-link test
- `apps/web/src/features/help/content/helpContentRegistry.ts`
- `apps/web/src/features/help/content/helpContentRegistry.test.ts`

Work:

1. Replace local flat specification shape with `Product['specificationGroups']` input.
2. Render groups by contract order; render specification order unchanged within group.
3. Use semantic section headings and `dl` pairs per group.
4. Omit absent groups and values; never derive facts from category, tag, description, or packaging copy.
5. Resolve contextual links through registry exports, never duplicate route strings or article copy.
6. Expose product-fact links: powder safety, storage, pack sizes when packaging quantity exists.
7. Expose demo-commerce links: shipping, returns, privacy, terms.
8. Keep context component static and API-independent.

Required tests:

- Group and row order match contract input.
- Same labels in separate groups retain valid keys and structure.
- Empty metadata renders no fake specification content.
- Pack-size link follows packaging presence rule.
- Every rendered link matches registry label and path.

Exit gate:

- Leaf components ready for Phase 3 without `ProductPage` edits.

#### Lane C: Product-Scoped Bundles

Mode: parallel after Phase 0.

Owned files:

- new `apps/web/src/features/product/ProductBundlesSection.tsx`
- new `apps/web/src/features/product/ProductBundlesSection.test.tsx`
- `apps/web/src/hooks/useBundles.ts` and test only if section exposes missing state defect
- `apps/web/src/features/bundles/BundleCard.tsx`
- `apps/web/src/features/bundles/BundleCard.test.tsx`

Work:

1. Call `useBundles(productId)`; never filter all-bundle response client-side.
2. Render section-local loading, empty, failure, retry, content states.
3. Reuse `BundleCard` server total, availability, component links, add action.
4. Use `CartContext.addBundle`; preserve atomic server mutation.
5. Scope pending and failure feedback to selected bundle where current cart API permits; avoid showing unrelated bundle error on every card.
6. Abort stale product request during route change.
7. Keep bundle failure below core product and purchase controls.

Required tests:

- Product ID passed to bundle API hook.
- Loading, empty, failure, retry states remain section-local.
- Route product change aborts or ignores stale response.
- Component links target `/products/:id`.
- Displayed total comes from `bundle.totalCents`.
- Unavailable bundle disables add.
- Add delegates bundle ID once; no client component-loop cart calls.

Exit gate:

- Product-scoped bundle section ready for Phase 3.

#### Lane D: Review and Similarity Resilience

Mode: parallel after Phase 0.

Owned files:

- `apps/web/src/features/product/ReviewsSection.tsx`
- `apps/web/src/features/product/ReviewsSection.test.tsx`
- `apps/web/src/features/product/ReviewList.tsx`
- `apps/web/src/hooks/useProductReviews.ts`
- `apps/web/src/hooks/useProductReviews.test.tsx`
- `apps/web/src/features/product/SimilarProductsSection.tsx`
- `apps/web/src/features/product/SimilarProductsSection.test.tsx`

Work:

1. Remove temporary Round 4 deferral comment from reviews.
2. Confirm reviews expose independent list loading, empty, failure, retry; owner failure never hides public list.
3. Reset review page to one and abort stale requests on product change.
4. Preserve full login return path.
5. Change empty similar response from hidden section to explicit empty state.
6. Preserve similar rank order, retry, abort, cart behavior.
7. Keep both sections usable without shared page-level loading or error state.

Required tests:

- Empty published review list remains explicit.
- Public-list failure and owner failure remain independent.
- Review route change rejects stale list and owner responses.
- Similar loading, empty, failure, retry states render inside section.
- Similar route change rejects stale response.
- Similar cart failure does not hide product page.

Exit gate:

- Both remote sections satisfy independent-state contract before composition.

#### Phase 3: Product-Detail Composition

Mode: serial after Lanes A-D. One owner only.

Owned files:

- `apps/web/src/features/product/ProductPage.tsx`
- `apps/web/src/features/product/ProductPage.test.tsx`
- `apps/web/src/features/product/ProductPurchasePanel.tsx`
- `apps/web/src/features/product/ProductPurchasePanel.test.tsx`
- optional new product-journey integration test

Composition order:

`breadcrumbs -> gallery + purchase panel -> description -> specifications -> context links -> bundles -> reviews -> similar products`

Work:

1. Add `CompareProductButton` as secondary purchase-panel action; cart remains primary action.
2. Compose lane components in declared order.
3. Pass canonical `product.id`, `product.specificationGroups`, packaging presence, cart state only.
4. Keep product request as sole page-level loading and failure gate.
5. Keep bundle, review, similar requests inside section boundaries.
6. Ensure secondary load or failure never disables product add, wishlist, compare, breadcrumbs, gallery, core facts.
7. Preserve bundle component navigation; route change resets every product-scoped section.
8. Preserve responsive layout and heading hierarchy: one page `h1`, ordered section `h2` headings.
9. Keep focus-visible controls, live pending text, local retry labels.

Required tests:

- Sections render in declared DOM order.
- Grouped specifications receive current product data.
- Product compare action shares selection with catalog and produces ordered compare path.
- Bundle, review, similar pending states coexist while purchase panel remains usable.
- Each secondary failure leaves add-to-cart action usable.
- Product route change shows no stale section data.
- Missing product still blocks all secondary requests and content.
- Anonymous review login preserves full product URL.

Exit gate:

- Full product journey works with any one secondary endpoint pending, empty, or failed.
- No backend or contract scope added.

#### Phase 4: Journey Verification

Mode: serial after Phase 3.

Work:

1. Run focused tests after each lane merge.
2. Run full workspace verification.
3. Manually verify catalog selection -> comparison -> product detail -> bundle component -> product detail route chain.
4. Manually verify narrow and wide layouts, keyboard-only controls, focus visibility, heading order, live status text.
5. Simulate bundle, review, similar failures independently; confirm cart and product content remain usable.
6. Review diff for accidental API, schema, contract, seed, pricing, safety-copy changes.

Verification:

```powershell
npm run test:unit -w @shop/web
npm run test:integration -w @shop/web
npm run typecheck
npm run lint
npm run format
npm run build -w @shop/web
git diff --check
```

Final exit gate:

- Catalog and product detail expose comparison entry points.
- Anonymous 2-4 selection preserves order and generates shareable URL.
- Latest complete valid selection restores without incomplete-draft corruption.
- Product detail renders grouped specifications, contextual links, bundles, reviews, similar products.
- Every remote secondary section owns loading, empty, failure, retry behavior.
- Core purchase path survives secondary failure.
- Bundle totals and cart mutations remain server-authoritative and atomic.
- Help and policy copy remains registry-authoritative.
- All executable verification passes; remaining commands require a repaired local dependency installation.

#### Phase 4 Results (2026-07-19)

- Merged-tree web verification passed: direct Vitest run passed 53 files / 230 tests; integration suite passed 2 files / 5 tests.
- `git diff --check` passed. Static audit confirmed the changed implementation remains frontend-only: no API, schema, contract, seed, pricing, safety-copy, or policy-copy changes outside the typed help registry.
- Static accessibility and journey audit passed for comparison pressed states and live capacity status, semantic product sections and heading order, bundle component product links, section-local remote loading/error/retry states, and preserved core purchase controls.
- Browser visual checks could not run: no loopback web server was active, and Phase 4 was directed not to start or mutate processes.
- The canonical `npm run test:unit -w @shop/web` is blocked before discovery because `node_modules/tsx/dist/cli.mjs` is absent. The direct Vitest substitute above therefore does not include the standalone `cartValidation.test.ts` node test.
- `npm run typecheck`, `npm run lint`, `npm run format`, and `npm run build -w @shop/web` are blocked by missing package payloads: `typescript/bin/tsc`, `eslint/bin/eslint.js`, and `prettier/bin/prettier.cjs`. No dependency repair was performed under the Phase 4 constraint.

Suggested commit split:

1. `feat(comparison): add shared product selection controls`
2. `feat(product): add detail journey sections`
3. `test(product): cover composed catalog journey`

### Parallelism Guardrails

- Same schema, contract, route, shared provider, or page owner -> serial delivery.
- Independent leaf component with exclusive files -> parallel delivery.
- `ProductPage` composition -> one final owner after all feature lanes complete.
- Integration tests touching shared render tree -> Phase 3 or Phase 4 owner.
- Verification -> merged tree only.
