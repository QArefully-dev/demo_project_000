# Powderizer Expansion Plan: Builder Experience

Status: pending; starts after domain Phase 6 gate

Audience: orchestrator agent, implementation agents

Dependency: `plans/powderizer_expansion_domain_plan.md`

## Outcome

Build replayable visual configurator over frozen domain API: category browsing, valid generation, restrained visualization, inspectable bag, daily recipe, deterministic copy, local history, storefront entry points.

Interaction:

`browse/filter -> select or generate -> adjust -> visualize -> inspect -> quote -> save -> revisit -> requote`

## Scope

- Paginated category picker.
- `Randomize` and constrained `Chaos Mix` actions.
- Five server-defined Powderizer bag schemes.
- Ingredient-driven mix visualization separate from bag preview.
- Click/keyboard zoom with pointer pan.
- Deterministic `Good for:` result from 20 locked options.
- Deterministic slug-based ingredient reactions.
- Server daily-recipe loader.
- Versioned browser-local history.
- Home banner and exclusive navigation treatment.
- Responsive, accessible, reduced-motion behavior.

Non-scope:

- Randomized mixing-status copy.
- Audio, achievements, share codes, chaos meter, secret combinations, generated names, receipt parody.
- Account-synced history.
- Continuous particles or high-motion effects.
- Canvas/WebGL dependency.
- Changes to standard bag colour controls.
- LOC padding or generic design-system expansion.

## Architecture Rules

- Dependency direction: `contracts/API DTO -> pure builder model/selectors -> controller/adapters -> presentational components`.
- Shared contracts remain source of truth for scheme values, config, quote, daily recipe, safety label. No local wire-type copies.
- `BuilderConfig` contains editable server inputs only. Price, usage label, product metadata, validation status, reaction, and `Good for` remain derived.
- Reducer owns atomic state transitions. Components dispatch intent; components never coordinate multi-step mutation.
- Pure helpers own random selection, ratio partition, canonical hash, reaction matching, pagination. Inject entropy; no DOM, storage, network, or time access.
- Controller owns config fetch, debounced quote, stale-response guard, create/update, history notification. One transport conversion path.
- Presentational components receive typed props and emit callbacks. No direct API or `localStorage` access.
- History adapter owns storage parsing and failures. Stored data never becomes price authority.
- Keep server safety label prominent and verbatim. Client warnings may add context, never replace server classification.
- Treat URL/edit target, server config, quote, and local history as distinct state sources. Define hydration precedence explicitly in controller tests.
- Prefer feature-local components/helpers. Extract shared primitive only when semantics apply outside Powderizer.
- Avoid boolean-prop sprawl. Use focused props or tagged state for loading/error/ready paths.
- Preserve canonical component ordering for quote keys and hashes. UI display order must not change identity.
- Use stable keys and `useId()` for generated SVG definitions. No array-index identity for products/history.
- Effects perform external synchronization only. Derived values use selectors/memoization when computation warrants it; never mirror props into state without lifecycle need.
- Accessibility built into components: semantic controls, names, focus visibility, `aria-current`/`aria-pressed`, keyboard parity, textual legends, live status only for meaningful async updates.
- Motion uses CSS and feature tokens. `prefers-reduced-motion` disables continuous motion and transition-dependent comprehension.
- Tests favor behavior through roles/labels. Snapshot only stable SVG regression surface. Avoid implementation-detail assertions.
- No unrelated refactors. Preserve existing commerce and user worktree changes.

## Orchestrator Execution

Required graph:

`domain Phase 6 -> (Phase 7 || Phase 12) -> (Phase 8 || Phase 9) -> (Phase 10 || Phase 11) -> Phase 13`

Phase `12` intentionally runs early; number reflects feature grouping, not execution order.

Parallel rules:

- Wave 1: Phase 7 and Phase 12 in parallel. File sets disjoint. Phase 12 finishes `index.css` work before Phase 9 starts.
- Wave 2: Phase 8 and Phase 9 in parallel after Phase 7 gate. Phase 8 owns page/controller/picker/actions. Phase 9 owns option/summary/visualization components and `index.css`.
- Wave 3: Phase 10 and Phase 11 in parallel after Phases 8 and 9 gates. Phase 10 owns bag/cart/checkout rendering. Phase 11 owns history adapter/hook/shelf/page integration.
- Phase 13: sequence-only final integration after Phases 10, 11, 12 gates.
- No phase starts before domain Phase 6. No other parallel pairing approved without dependency and file-conflict review.

Agent rules:

- Assign one owner per file per wave. Shared barrel/test setup/CSS file -> one integration owner.
- Parallel agents stay inside assigned file set. Cross-file need -> message orchestrator; do not create competing edits.
- Before each wave: freeze props, exports, reducer events, test fixtures needed across tracks.
- After each wave: merge, inspect diff, remove duplicate transforms/constants, run combined typecheck and focused tests, then advance.
- Phase gate failure blocks dependants. Baseline exemptions require domain Phase 0 evidence.
- Prefer one phase-sized commit after gate; do not require commits when repository workflow says otherwise.

## Locked UX Decisions

### Layout

Desktop:

`intro/actions -> daily recipe -> picker/ratios/options -> visualization -> sticky bag/quote -> history`

Mobile:

`intro/actions -> daily recipe -> picker -> ratios -> options -> visualization -> bag -> quote -> history`

- Quote summary stays next to submit action.
- Ingredient visualization stays separate from bag preview.

### Category Browsing

- Categories: derive from config products.
- Active filter: one category or `All powders`.
- Initial filter: first category containing current selection; fallback `Pantry Staples`.
- Page size: eight.
- Filter change -> page 1.
- `All powders`: paginated; never render 50 cards together.
- Hidden selected products remain in ratio editor.
- Show active category, result count, page count, selected count.
- Filters use buttons/radios with accessible selected state.
- Filter/pagination changes make no server request.

### Randomize

- Pool: active category; `All powders` -> full catalog.
- Fewer than two candidates -> disabled with explanation.
- Count: random integer in `2..min(5, pool size)`.
- Products: unique, unbiased Fisher-Yates selection.

### Chaos Mix

- Pool: full catalog; ignore active category.
- Select exactly five unique products.
- Require one `Questionable` or `Impossible` product.
- Require at least three categories.
- Require one top-price-quartile product when eligible pool permits.
- Ratios: uneven.
- Use bounded retries plus deterministic fallback; no unbounded loop.
- Label: `Chaos Mix`; helper copy explains broad-catalog selection.

### Entropy and Validation

- Both actions generate positive integer ratios totaling 100.
- Both actions randomize bag size, fineness, scheme.
- Both actions preserve custom label and edit target.
- Both actions replace config through one reducer event -> one debounced quote sequence.
- Production entropy adapter: `crypto.getRandomValues`.
- Pure generation helpers: injected `random(): number`.
- Never seed from render time.
- Validate generated config with `validateBuilderConfig()` before reducer commit.
- Invalid generated result -> programming error in tests; UI never commits partial config.

### Bag Schemes

- Consume exact domain enum/default; do not redefine values.
- Render five labelled swatches with visible selected state.
- Scheme affects bag art only. Ingredient visualization uses ingredient colours.
- `ultraviolet-cyan`: optional slow gradient shift, minimum 12-second cycle.
- Other schemes: static except short selection transition.
- Reduced motion: freeze gradients and transitions.

### Mix Visualization

- Use SVG or CSS layered vessel/powder cross-section.
- Segment size -> component ratio.
- Segment colour -> `product.packaging.powderColor`.
- Missing colour -> stable product-ID-derived hue.
- Canonical reorder must not change product colour.
- Ratio changes -> short size transition only.
- No perpetual particles, smoke, sparks, shaking, bubbling.
- Text legend repeats names and percentages; colour never sole signal.
- Empty/one-component states -> calm placeholder.

### Ingredient Reactions

Presentation copy only. Match selected slug set. Return first match in listed priority order.

- `powdered-house` + `powdered-campfire` -> `Housewarming achieved. Keep away from actual flames.`
- `macbook-pro` + `powdered-wifi` -> `Remote work ingredients detected.`
- `boat` + `powdered-water` -> `Returning ingredients to their natural habitat.`
- `plane` + `moon-rock` -> `Flight plan exceeds current airspace.`
- `diamond` + `powdered-gravity` -> `Heavy investment detected.`
- `powdered-wifi` + `powdered-silence` -> `Connection established. Notifications absent.`
- `powdered-house` + `diamond` -> `Aggressive property appreciation.`
- `powdered-campfire` + `powdered-moonlight` -> `Night shift ready.`

Selected product set controls reaction. Ratio-only change keeps reaction.

### Good For

Label: `Good for:`

Options, fixed order:

1. Sleep
2. House-warming parties
3. Negotiating raises
4. Absolutely nothing
5. Long life
6. Hairy legs
7. Tax avoidance
8. Sunday recovery
9. Difficult decisions
10. Courage before dentist appointments
11. Restoring Wi-Fi
12. Ambitious baking
13. Awkward silences
14. First dates
15. Avoiding small talk
16. Garden morale
17. Monday mornings
18. Moving house
19. Remembering passwords
20. Emergency confidence

Selection:

- Hash canonical component IDs/ratios, bag size, fineness, scheme.
- Map unsigned stable hash modulo 20.
- Same normalized config -> same result across render and history reload.
- Present as playful store copy, never health/legal advice.

### Interactive Bag Preview

- Default scale: `1x`; activated scale: `2x`.
- Click or keyboard activation toggles zoom.
- Zoomed pointer movement controls transform origin.
- Pointer leave preserves zoom and recenters.
- `Escape`, `Reset zoom`, or second activation -> `1x`.
- Fixed-aspect clipped wrapper; short instruction beneath.
- Touch activation -> centered toggle; no hover dependency.
- Expose `aria-pressed`, visible focus, keyboard support.
- Reduced motion removes zoom interpolation.

### History

- Key: `powderizer:history:v1`.
- Record after successful create/update only.
- Max eight; newest first.
- Dedupe by canonical builder quote key; newest duplicate replaces old entry.
- Fields: storage version, timestamp, config, resolved component names, `Good for` text.
- Never store reusable authoritative price.
- Parse defensively; drop malformed entries and missing-product configs.
- `Use again` -> leave edit mode, hydrate config, fresh quote.
- Support per-entry remove and `Clear history`.
- Explain local-only empty state.
- Storage failure never blocks cart success/navigation.

### Landing Banner and Navigation

- Home position: after hero, before store assurances.
- Copy: unrestricted mixing plus daily recipe; no consumability promise.
- Banner: Powderizer gradient, daily-recipe teaser, `/powderizer` CTA.
- Powderizer nav link: exclusive iridescent treatment.
- Animation: background-position cycle >= 8 seconds.
- Active state remains distinct.
- Light/dark contrast: WCAG AA; focus ring visible.
- Reduced motion -> static gradient.

## Phase 7 - State Model and Pure Helpers

Goal: establish stable client model before UI composition.

Files:

- `apps/web/src/features/powderizer/powderizerState.ts`
- `apps/web/src/features/powderizer/powderizerRandom.ts`
- `apps/web/src/features/powderizer/powderizerCopy.ts`
- `apps/web/src/features/powderizer/powderizerState.test.ts`
- focused helper tests

Tasks:

- Add `bagColourScheme` to `BuilderConfig` and initial state.
- Add atomic events: `bag-colour-changed`, `config-replaced`, `history-config-loaded`.
- Keep one normalization path for edit, recipe, generation, history hydration.
- Include scheme in transport conversion and canonical quote key.
- Default legacy edit config without scheme.
- Implement injected-RNG Fisher-Yates and positive integer partition.
- Implement Randomize and Chaos constraints as pure functions.
- Implement canonical stable hash, `Good for` selector, reaction selector.
- Preserve quote request-sequence/stale-response guard.

Tests:

- Atomic replacement invalidates stale quote once.
- Randomize pool/count/uniqueness constraints.
- Chaos count/category/weird/top-quartile constraints and deterministic fallback.
- Ratios always positive integers totaling 100.
- Fixed RNG -> fixed config.
- Custom label/edit target preserved.
- Canonically equivalent config -> same quote key and `Good for`.
- Reaction priority deterministic; ratio-only change unchanged.

Gate: pure helper suite passes without DOM; shared model/export surface frozen.

## Phase 8 - Picker, Daily Recipe, and Actions

Goal: expose all products without 50-card render.

Files:

- `apps/web/src/features/powderizer/ComponentPicker.tsx`
- `apps/web/src/features/powderizer/PowderizerActions.tsx`
- `apps/web/src/features/powderizer/DailyRecipeCard.tsx`
- `apps/web/src/features/powderizer/PowderizerPage.tsx`
- `apps/web/src/features/powderizer/usePowderizerController.ts`
- builder/page tests

Tasks:

- Implement category/page state in picker-focused hook or picker.
- Render accessible filters, counts, pagination, empty state.
- Keep selection synchronized across hidden pages/categories.
- Add `Randomize`, `Chaos Mix`, daily recipe load near intro.
- Route all full-config loads through Phase 7 atomic event.
- Request fresh quote once per generated/loaded config.
- Replace consumable-only copy with all-category explanation and safety note.
- Keep page as composition root. Extract controller orchestration when authored-size policy requires it.

Tests:

- Initial render shows eight products.
- Category change filters and resets page.
- All filter paginates; selection survives filter.
- Randomize uses active pool; Chaos ignores it.
- Daily recipe loads exact normalized server config.
- Each action starts one debounced quote sequence.
- Edit route hydration and submit remain functional.

Gate: every product reachable; every generation/load path reaches valid fresh quote.

## Phase 9 - Scheme Picker, Visualization, and Copy

Goal: make mix legible without excessive motion.

Files:

- `apps/web/src/features/powderizer/BagColourSchemePicker.tsx`
- `apps/web/src/features/powderizer/PowderMixVisualization.tsx`
- `apps/web/src/features/powderizer/IngredientReaction.tsx`
- `apps/web/src/features/powderizer/MixOptions.tsx`
- `apps/web/src/features/powderizer/PowderizerSummary.tsx`
- `apps/web/src/index.css`
- component tests

Tasks:

- Add scheme step before custom label; renumber visible steps.
- Render labelled swatches from typed scheme metadata.
- Build ratio-weighted visualization and textual legend.
- Render one reaction below visualization.
- Render stable `Good for:` for configs with >= 2 components.
- Show server usage label prominently; retain ingredient warnings.
- Add short scoped transitions and reduced-motion overrides.
- Namespace Powderizer CSS; reuse tokens from completed Phase 12 without redefining them.

Tests:

- Scheme selection changes config/quote key.
- Segment dimensions/colours follow ratios/products.
- Missing colour fallback stable.
- Legend exposes name and ratio text.
- Reaction and `Good for` selectors rendered correctly.
- Unsafe quote label visible.
- Reduced-motion styles stop transitions/animation.

Gate: visualization and bag preview remain distinct; no perpetual visualization motion.

## Phase 10 - Interactive Bag and Purchase Rendering

Goal: add accessible inspection and display persisted bag identity.

Files:

- `apps/web/src/components/BagArtwork.tsx`
- `apps/web/src/features/powderizer/PowderMixBagPreview.tsx`
- `apps/web/src/features/cart/PowderMixCartLineItem.tsx`
- `apps/web/src/features/checkout/CheckoutSummary.tsx`
- `apps/web/src/features/checkout/OrderConfirmationPage.tsx`
- bag/cart/checkout tests

Tasks:

- Extend `BagArtwork` through optional typed paint definition; preserve solid-colour callers.
- Generate unique SVG IDs with `useId()`.
- Centralize scheme-to-palette mapping; no component copies.
- Implement zoom state, keyboard controls, pointer-origin calculation as focused hook/helper.
- Reset only when bag identity requires it; preserve focus.
- Render scheme name and server usage label in cart, checkout, confirmation.
- Render matching mix art where layout supports it.

Tests:

- Standard `BagArtwork` behavior/snapshot stable.
- Multiple mix bags produce unique gradient IDs.
- Click/Enter/Space toggle; pointer updates only while zoomed; Escape/reset returns `1x`.
- Touch-safe centered behavior.
- Cart and confirmation show persisted scheme/safety label.

Gate: mouse, keyboard, touch fallback work; standard bags unchanged.

## Phase 11 - History Shelf

Goal: revisit successful mixes without server persistence or stale authority.

Files:

- `apps/web/src/features/powderizer/powderizerHistory.ts`
- `apps/web/src/features/powderizer/usePowderizerHistory.ts`
- `apps/web/src/features/powderizer/PowderizerHistoryShelf.tsx`
- `apps/web/src/features/powderizer/PowderizerPage.tsx`
- history tests

Tasks:

- Implement versioned schema guard, safe JSON parser, storage adapter.
- Implement immutable add/dedupe/cap/remove/clear helpers.
- Record once after successful create/update.
- Isolate storage exceptions from submit/navigation result.
- Resolve stored IDs against current config before display/load.
- Render scheme swatch, names, timestamp, stored `Good for` copy.
- `Use again` exits edit mode, atomically hydrates config, focuses builder, requests fresh quote.
- Add empty and storage-unavailable states.

Tests:

- Malformed JSON/unknown version -> empty history.
- Duplicate moves front; ninth unique evicts oldest.
- Missing product invalidates entry.
- Successful submit records once; failure records none.
- Storage exception does not block cart navigation.
- `Use again` never restores price/edit target and always requotes.

Gate: reload persistence works; history cannot bypass server quote.

## Phase 12 - Landing Banner and Navigation

Goal: expose Powderizer from storefront entry points.

Files:

- `apps/web/src/components/home/PowderizerBanner.tsx`
- `apps/web/src/features/home/HomePage.tsx`
- `apps/web/src/features/home/HomePage.test.tsx`
- `apps/web/src/components/CategoryNav.tsx`
- `apps/web/src/components/nav/navItems.ts`
- `apps/web/src/index.css`
- navigation tests

Tasks:

- Add banner after hero with `/powderizer` CTA.
- Use Powderizer visual tokens and safety-neutral copy.
- Add dedicated nav state/class without branching unrelated links.
- Add slow iridescent animation and static reduced-motion fallback.
- Preserve horizontal overflow, active-page semantics, focus visibility.
- Define reusable Powderizer gradient/motion CSS tokens for Phase 9.

Tests:

- Banner and CTA render in required position.
- Builder nav link retains `aria-current`.
- Special style affects no category/deals link.
- Reduced-motion query freezes animation.

Gate: entry points accessible/responsive; `index.css` token contract frozen for Phase 9.

## Phase 13 - Integration, Accessibility, and Regression QA

Goal: verify complete experience and unchanged commerce paths.

Automated:

- `npm run format`
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build --workspaces --if-present`

Browser QA: serve workspace through loopback HTTP; never use `file://`.

- Desktop and narrow mobile layouts.
- Seven category filters plus All pagination.
- Repeated Randomize and Chaos constraint checks.
- Daily recipe load and one requote.
- Scheme selection, ratio visualization, reaction, `Good for`.
- Bag click/keyboard zoom, pointer pan, reset, touch fallback.
- Unsafe usage label and ingredient warnings.
- Add/edit mix; history reload/use/remove/clear.
- Home banner and nav active state.
- Normal motion and reduced motion.
- Moon Rock price formatting and checkout.
- Light/dark contrast when theme exists.
- Focus order, visible focus, screen-reader names, no keyboard trap.

Regression:

- Standard catalog filter/pagination and bag art.
- Standard/anonymous cart and checkout.
- Promo rules and requote conflict.
- Payment replay/idempotency.
- Order confirmation and legacy snapshot rendering.

Final review:

- Inspect diff for duplicate constants/transforms, layer violations, unsafe casts, oversized components, unstable keys, unrelated changes.
- Verify no console error, stale quote submit, layout overflow, focus trap, unsafe consumability label.
- Record commands, browser sizes, reduced-motion setting, failures, evidence.

Gate:

- Full verification passes or unrelated failures match recorded domain baseline.
- Every phase gate satisfied.
- Existing commerce behavior unchanged.
