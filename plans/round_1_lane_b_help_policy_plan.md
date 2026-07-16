# Round 1 Lane B: Help And Policy Content Plan

Status: implementation-ready plan; code implementation not authorized by this planning task.

Authority: `plans/powder_shop_catalog_expansion_plan.md` Round 1 Lane B.

Goal: API-independent help center covering FAQ, shipping, returns, powder safety, storage, pack sizes, privacy, terms. Typed static registry -> shared accessible renderers -> routable pages -> global footer discovery -> focused tests.

## Orchestration Contract

- Planning turn: do not create worktree; do not implement code.
- Implementation start: capture `poweder_shop_expansion` base commit before edits.
- Create dedicated Lane B branch and git worktree from `poweder_shop_expansion`. Suggested branch: `codex/round-1-lane-b-help-policy`. Suggested worktree name: `round-1-lane-b-help-policy`.
- Perform every Lane B edit, command, and verification inside dedicated worktree. Never implement Lane B in primary worktree or Lane A worktree.
- Preserve user changes. Do not copy, discard, reset, or overwrite uncommitted primary-worktree changes.
- User owns merging. Implementation agent and orchestrator must not merge Lane B into `poweder_shop_expansion`, Lane A, or any integration branch.
- Final orchestrator summary must report: Lane B branch, worktree name, absolute worktree path, base branch (`poweder_shop_expansion`), base commit, verification results, deferred work. Explicitly state `Merge not performed; user will merge.`

## Scope

Included:

- Typed static content model and registry
- `/help` index
- `/help/faq`
- `/help/shipping`
- `/help/returns`
- `/help/powder-safety`
- `/help/storage`
- `/help/pack-sizes`
- `/policies/privacy`
- `/policies/terms`
- Shared article shell and typed block renderer
- Native `details` + `summary` FAQ
- Global footer containing discoverable link for every listed route
- Semantic accessibility, registry, routing, and navigation tests
- Responsive and keyboard QA

Excluded:

- API routes, contracts, database tables, migrations, CMS, remote content loading
- Catalog metadata, filtering, sorting, Lane A files
- Legal, medical, certification, fulfilment, performance, or safety promises unsupported by runtime
- `ProductPage` and product-context help links; defer all such edits until Round 4
- Existing `ProductPurchasePanel` delivery/returns copy changes; treat product context as Round 4 ownership
- Dependency additions unless existing test stack cannot express required assertion. Expected result: no dependency or manifest change.

## Current-State Audit

- `apps/web/src/App.tsx` -> `App()` owns all React Router route declarations under one `Layout`; wildcard `*` renders `NotFoundPage`. No help or policy routes.
- `apps/web/src/components/Layout.tsx` -> `Layout()` renders `Header`, content-shell `main`, `Outlet`; no footer. `AuthProvider` and `CartProvider` wrap every route.
- `apps/web/src/components/Header.tsx` -> storefront identity, search, category navigation, simulated-checkout message. No help links.
- `apps/web/src/features/notFound/NotFoundPage.tsx` -> shared unknown-route presentation suitable for unknown help/policy slugs.
- `apps/web/src/index.css` -> global tokens, `.content-shell`, heading/link utilities, global focus-visible treatment. No article/footer-specific CSS required; prefer utility classes. Native `summary` needs explicit focus-visible classes because global selector omits `summary`.
- `apps/web/src/test/setup.ts` -> `jest-dom`, Testing Library cleanup, Vitest globals already configured.
- `apps/web/vite.config.ts` -> jsdom unit-test environment. `apps/web/vitest.integration.config.ts` -> `*.integration.test.ts(x)` suite.
- `apps/web/package.json` -> React Router 6.30, Testing Library, user-event, Vitest available. No automated accessibility package. Semantic role/name/tag assertions fit current stack.
- Existing route tests use `MemoryRouter`, `Routes`, `Route`; examples: `CatalogPage.test.tsx`, `ProductPage.test.tsx`, `CatalogProductJourney.integration.test.tsx`.
- `apps/web/src/features/product/ProductPage.tsx` -> current product composition owner. Must remain untouched during Round 1 Lane B.
- `apps/web/src/features/product/ProductPurchasePanel.tsx` -> `ProductPurchasePanel()` already says payment simulation and no real fulfilment/returns. Do not turn this copy into help links before Round 4.
- `packages/catalog/src/model.ts` -> packaging quantity and product-specific `consumptionLabel` already exist. Help copy must not redefine product facts or override displayed warnings.
- `apps/web/src/lib/cartStorage.ts` -> browser stores cart identifier in local storage.
- `apps/web/src/features/powderizer/powderizerHistory.ts` -> browser stores bounded Powderizer history in local storage.
- `apps/web/src/api/client.ts` -> API requests include session cookie credentials.
- `apps/api/src/config.ts` plus ordered migrations -> local SQLite owns account, cart, order, session, mailbox, simulated payment data. Privacy copy must describe local demo behavior without promising complete browser-data removal from database reset.
- `plans/demo_project_high_level_plan.md` includes help, policy, FAQ, shipping, returns, size-guide pages. Lane plan remains additive Powder-shop content.
- Repository currently contains user changes in `CLAUDE.md`, source plan, and historical plan moves. Assigned implementation must avoid unrelated files.

## Decisions And Invariants

### Route Contract

- Stable canonical paths: exact paths listed in Scope.
- `/help` -> index. `/help/:slug` -> help article lookup. `/policies/:slug` -> policy article lookup.
- Unknown slug -> `NotFoundPage`; no silent fallback, redirect, or first-article substitution.
- Add dynamic routes before wildcard in `App()`.
- Registry owns slug, full path, title, summary, group, footer order. Registry also exports one typed Help-index link constant. Pages and footer consume these exports; no duplicate route-label arrays.

### Content Contract

- `HelpArticle` fields: stable `id`, `group: 'help' | 'policy'`, literal `slug`, literal `path`, `title`, `summary`, readonly `blocks`.
- `HelpContentBlock` discriminated union: paragraph, headed section, list, notice, FAQ.
- FAQ entries: stable `id`, `question`, readonly answer paragraphs. Render only FAQ block through native disclosure component.
- Content modules export readonly values using `satisfies`; registry exposes readonly arrays plus lookup helper. No mutable content state.
- Plain strings only inside content data. No JSX, HTML strings, markdown parser, `dangerouslySetInnerHTML`, or fetch calls.
- Deterministic keys/IDs derive from stable content IDs, not array indexes or displayed copy.
- Registry validation tests enforce required paths, unique IDs/slugs/paths, nonempty titles/summaries/blocks, valid group/path pairing.

### Copy Truth

- Help index: explain local QA/demo purpose; expose all topics.
- FAQ: answer whether shop, payment, shipping, account data, cart, and Powderizer behavior are real. Keep route discovery in Help index and footer; do not embed untyped links in answer strings.
- Shipping: simulated order state only; no carrier, dispatch, tracking, delivery estimate, or real fulfilment.
- Returns: no real purchase, return, refund, return window, postage, or customer-service workflow in current demo.
- Powder safety: fictional catalog content; product-specific warning remains authority for displayed item; no medical, emergency, ingestion, handling, or certification claim.
- Storage: general demo guidance only; do not invent product storage facts. Direct readers to product-specific displayed facts when available.
- Pack sizes: distinguish display quantity from real weighed/fulfilled stock; do not duplicate canonical packaging values into static help data.
- Privacy: local SQLite plus browser local storage; session cookie; locally supplied account/checkout/order data; no claim that backend reset clears browser storage; advise fake data only.
- Terms: educational local demo, simulated commerce, fictional content, no contract of sale, shipment, charge, refund, warranty, certification, or service promise.
- Keep tone consistent with QArefully Powder Co.; disclaimers direct and unambiguous.
- Re-audit named runtime files at implementation start. Copy follows current code if behavior changed after plan creation.

### Rendering And Accessibility

- One visible `h1` per page. Article blocks start at `h2`; never skip heading levels.
- `HelpArticleLayout` renders semantic `article`, labelled header, summary, content region, and Help-index return link.
- `FaqList` renders each question as direct `summary` child of `details`; no custom button, click handler, ARIA-expanded state, or JavaScript disclosure state.
- Give `summary` clear hover, pointer, and focus-visible styles. Preserve native keyboard interaction.
- Footer uses semantic `footer` plus named navigation. Link text must describe destination without surrounding context.
- Help index uses real `Link` elements and semantic sections/lists; no clickable `div` cards.
- Text remains readable at narrow width, zoom, long copy, dark theme. No fixed-height content containers.
- Automated accessibility scope: landmarks, accessible names, heading levels, native disclosure structure, keyboard-focusable links, current route rendering. Do not claim full WCAG conformance from unit tests.

### API Independence

- Help content, registry, pages, and footer import no `src/api`, hooks, contracts, catalog package, or API source.
- No help-specific network request, loading state, error state, CMS adapter, or environment configuration.
- Existing global `AuthProvider` and `CartProvider` may retain shell-level behavior. Help content must render without successful API responses and must not add provider coupling.

## Target File Map

New content files:

- `apps/web/src/features/help/content/helpContentTypes.ts` -> discriminated content types, route/group types
- `apps/web/src/features/help/content/faqArticle.ts` -> FAQ article
- `apps/web/src/features/help/content/serviceArticles.ts` -> shipping, returns, pack-size articles
- `apps/web/src/features/help/content/powderGuidanceArticles.ts` -> safety, storage articles
- `apps/web/src/features/help/content/policyArticles.ts` -> privacy, terms articles
- `apps/web/src/features/help/content/helpContentRegistry.ts` -> Help-index link constant, canonical ordered article registry, public selectors, lookup helper

New UI files:

- `apps/web/src/features/help/FaqList.tsx` -> native disclosure renderer
- `apps/web/src/features/help/HelpContentBlocks.tsx` -> exhaustive block renderer
- `apps/web/src/features/help/HelpArticleLayout.tsx` -> shared article frame
- `apps/web/src/features/help/HelpIndexPage.tsx` -> registry-driven index
- `apps/web/src/features/help/HelpArticlePage.tsx` -> group-aware slug lookup and not-found behavior
- `apps/web/src/components/Footer.tsx` -> global registry-driven footer

New test files:

- `apps/web/src/features/help/content/helpContentRegistry.test.ts`
- `apps/web/src/features/help/HelpPages.test.tsx`
- `apps/web/src/features/help/HelpJourney.integration.test.tsx`
- `apps/web/src/components/Footer.test.tsx`

Modified files:

- `apps/web/src/App.tsx` -> help/policy route registration
- `apps/web/src/components/Layout.tsx` -> footer composition after `main`

Expected untouched files:

- `apps/web/src/features/product/ProductPage.tsx`
- `apps/web/src/features/product/ProductPurchasePanel.tsx`
- `apps/web/src/index.css`
- All API, contract, catalog, migration, package-manifest files

## Implementation Phases

### Phase 0: Worktree Isolation

Parallelism: required sequence; blocks every code task.

1. Record `poweder_shop_expansion` commit at implementation start.
2. Confirm primary-worktree status; treat all existing changes as user-owned.
3. Create dedicated Lane B branch/worktree from recorded `poweder_shop_expansion` commit.
4. Confirm worktree branch, absolute path, clean status before edits.
5. Run baseline `npm run typecheck -w @shop/web` and relevant web tests. Record pre-existing failures; do not fix unrelated failures.

Exit: Lane B work occurs only in recorded dedicated worktree.

### Phase 1: Typed Boundary

Parallelism: required sequence; establishes imports for all parallel packets.

1. Add `helpContentTypes.ts`.
2. Encode literal route/group relationship so policy slug cannot declare `/help/...` and help slug cannot declare `/policies/...`.
3. Define exhaustive readonly block union and FAQ entry IDs.
4. Keep renderer-neutral data contract.
5. Add initial type-level compile coverage through consumers; avoid runtime schema library for authored TypeScript constants.

Exit: content authors and UI authors can compile against stable types without sharing files.

### Phase 2: Independent Content And Renderer Packets

Parallelism: safe parallel group after Phase 1.

Packet 2A -> `faqArticle.ts`:

- Author required demo FAQ.
- Use stable FAQ IDs.
- Keep disclosure content as typed strings, not markup.

Packet 2B -> `serviceArticles.ts`:

- Author shipping, returns, pack-size content.
- Preserve simulated-commerce limits.

Packet 2C -> `powderGuidanceArticles.ts`:

- Author powder-safety and storage content.
- Avoid replacing product warnings or inventing specifications.

Packet 2D -> `policyArticles.ts`:

- Author privacy and terms content after current runtime fact check.
- Avoid production/legal guarantees.

Packet 2E -> `FaqList.tsx`, `HelpContentBlocks.tsx`, `HelpArticleLayout.tsx`:

- Build exhaustive typed rendering.
- Throw or compile-fail on unknown block kind; never silently omit.
- Add semantic headings, landmarks, list markup, notice naming, native disclosure structure.

Ownership rule: one packet per listed file. Content packets must not edit registry, routes, footer, layout, product pages, or renderer files.

Exit: eight typed articles plus shared renderer compile independently.

### Phase 3: Registry And Page Composition

Parallelism: required sequence inside phase; registry first -> pages second.

1. Build `helpContentRegistry.ts` from packet exports.
2. Export Help-index link first; fix article ordering: FAQ, shipping, returns, powder safety, storage, pack sizes, privacy, terms.
3. Export group-filtered selectors and exact `(group, slug)` lookup. Return `undefined` for unknown values.
4. Add `helpContentRegistry.test.ts`: exact required path set, uniqueness, nonempty content, group/path consistency, FAQ IDs/questions unique.
5. Build `HelpIndexPage.tsx` from registry. Group help and policy links under labelled sections.
6. Build `HelpArticlePage.tsx` with required group prop and router slug. Found -> shared layout; unknown -> `NotFoundPage`.
7. Add `HelpPages.test.tsx`: index landmarks/headings/links, article heading hierarchy, list/notice semantics, native `details > summary`, unknown help/policy slug 404.

Exit: static pages render from one registry without API imports.

### Phase 4: Route And Footer Integration

Parallelism: two safe packets after Phase 3. Distinct file ownership.

Packet 4A -> routes and journey:

- Edit `App.tsx`: register `/help`, `/help/:slug`, `/policies/:slug` before wildcard.
- Add `HelpJourney.integration.test.tsx`: render app routing with pass-through/mocked global providers as needed; navigate from `/help` to FAQ; verify direct policy deep link; verify unknown slug 404; assert no help API mock or request needed.

Packet 4B -> footer and shell:

- Add `Footer.tsx` from registry selectors. Include `/help` plus every article path. Use named footer navigation and semantic grouped lists.
- Add `Footer.test.tsx`: exact registry link coverage, accessible footer/nav names, stable hrefs, no product-context dependency.
- After Footer test passes, edit `Layout.tsx` to render Footer after `main` inside flex column.

Sequence constraints:

- `Footer.tsx` -> `Layout.tsx`; shell must not import unfinished footer.
- Help pages -> `App.tsx`; routes must not point to scaffolds.
- `App.tsx` and `Layout.tsx` edits may proceed concurrently because file ownership differs.
- Lane A remains parallel-safe: Lane B owns static web feature, `App.tsx`, `Layout.tsx`, new `Footer`; Lane A owns catalog/schema/contracts/query/URL work.

Exit: every route reachable from footer or Help index; footer appears across routed storefront.

### Phase 5: Verification And Handoff

Parallelism: focused test files may run concurrently; final aggregate checks run in sequence after all edits settle.

Focused checks:

- `npm exec -w @shop/web -- vitest run --configLoader runner src/features/help/content/helpContentRegistry.test.ts`
- `npm exec -w @shop/web -- vitest run --configLoader runner src/features/help/HelpPages.test.tsx src/components/Footer.test.tsx`
- `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/help/HelpJourney.integration.test.tsx`

Aggregate checks, required order:

1. `npm run format`
2. `npm run typecheck -w @shop/web`
3. `npm run test:unit -w @shop/web`
4. `npm run test:integration -w @shop/web`
5. `npm run build -w @shop/web`
6. `npm run lint`
7. `npm run verify`

Manual QA through loopback HTTP server:

- Open every canonical path directly; verify refresh/deep-link behavior.
- Check unknown slugs show 404.
- Navigate footer using keyboard only.
- Toggle every FAQ using Enter and Space; visible focus remains clear.
- Check 320px-class viewport, desktop viewport, 200% zoom, dark theme, reduced motion.
- Confirm long policy text wraps; footer does not force horizontal page scroll.
- Run with API unavailable or failed provider calls; confirm static help body remains readable.
- Confirm no product page or purchase-panel change appears in diff.

Handoff sequence:

1. Review `git diff --check` and worktree status.
2. Confirm only Target File Map files changed.
3. Commit only if implementation assignment requests commit.
4. Do not merge.
5. Send required worktree/branch/base/verification summary to orchestrator.

## Risks And Compatibility

- Runtime-copy drift -> re-audit persistence, browser storage, session, payment, fulfilment behavior before authoring; avoid claims beyond code.
- Route shadowing -> keep two constrained dynamic prefixes and wildcard last; test unknown slugs.
- Registry/navigation drift -> derive Help index and footer from registry; enforce exact required path set in unit test.
- False accessibility confidence -> use semantic HTML plus keyboard/manual QA; report automated scope accurately.
- Global-provider network noise -> keep content imports pure; integration test provider failure tolerance; avoid shell refactor.
- Oversized declarative module -> split content by topic as mapped. Registry remains aggregation only.
- Duplicate source of product facts -> keep weights, warnings, storage facts out of general registry; Round 4 may link context without copying product data.
- Lane A integration conflict -> separate worktrees/branches; avoid Lane A files and dependency manifests. User resolves any later shared-shell conflict during merge.
- Existing user changes -> never reset, stash, overwrite, or fold them into Lane B commit.
- Terms/privacy interpretation -> label pages as local demo information, not production policy template or legal advice.

## Exit Criteria

- Dedicated Lane B worktree created from `poweder_shop_expansion`.
- Nine canonical routes render through shared shell: Help index plus eight articles.
- Registry is typed, readonly, renderer-neutral, uniquely keyed, sole route-label/order source.
- FAQ uses native `details` and `summary` with keyboard-visible focus.
- Footer exposes link to every canonical route.
- Invalid help/policy slugs render shared 404.
- Help feature adds no API, CMS, persistence, contract, catalog, migration, dependency, or product-page change.
- Copy truthfully describes local simulated commerce and avoids unsupported claims.
- Focused, web aggregate, root verification, and manual accessibility checks pass or pre-existing failures are documented.
- Final orchestrator summary includes worktree name and absolute path, branch, base branch/commit, checks, deferrals.
- No merge performed; user handles merging.
