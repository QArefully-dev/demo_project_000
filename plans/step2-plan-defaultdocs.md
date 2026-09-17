## Scenarios

### 1. Signed-out customer builds a blend and it lands in the basket as one line (AC1, AC2, reachability)
**Behaviour:** From the main category nav, a signed-out visitor opens Custom Blend, picks a base, adds one ingredient, adjusts its ratio, and adds the result to the basket.
**Starting state:** No session (fresh browser context, no login). Base material **All-Purpose Flour** (SKU `BKP-0001-001`, 25 kg Sack, `food-grade` group) located via the base picker's "Search materials" box. Ingredient **Whey Protein Isolate** (also `food-grade`, so compatible), selected via its checkbox in the "2. Ingredients" step.
**Observable outcome:** After clicking the "Custom Blend" nav link (not typing the URL), the configurator loads. Selecting the ingredient and moving its percentage slider changes the rendered "Blend total" / "Material total" / "Blending fee" figures in the review panel without a navigation event — assert the total *before* and *after* one ratio change differ, proving the live preview (AC2) rather than asserting a specific figure that could drift with catalog pricing. Submitting shows the "Custom blend added to your cart" confirmation, and the basket page shows exactly one line for this SKU carrying a "Custom blend" detail block with the same blend total shown in the confirmation.
**Does not cover:** every legal base/ingredient/ratio combination — that's the rule engine's job (see Existing coverage). One reason to fail: the configure→submit→single-basket-line path breaks.

### 2. A basket blend survives checkout to the order confirmation (AC6)
**Behaviour:** A blend already priced in the basket is paid for and the confirmation reflects the same composition and total.
**Starting state:** Signed in as `alice@example.com` / `Password123!` (UK), which carries default delivery site "Bakery yard" and default billing entity "Fournier Bakeries Ltd" — needed to keep checkout deterministic (no one-off address/postcode entry). The test builds the same All-Purpose Flour + Whey Protein Isolate blend itself (scenarios must not depend on each other) and adds it to the basket before starting checkout. Test card `4242 4242 4242 4242`.
**Observable outcome:** Checkout's summary (Delivery → Schedule and billing → Payment) shows the same blend composition and blend total as the basket. After payment, the order confirmation page shows a "Custom blend" line for the same base/ingredient composition and a total matching what checkout displayed — assert equality between the two screens' rendered totals rather than a hard-coded figure.
**Does not cover:** guest checkout with a one-off address, or freight/delivery-slot edge cases — orthogonal to whether the blend itself survives.

### 3. Editing a basket blend replaces the line instead of duplicating it (AC5)
**Behaviour:** From the basket, "Edit blend" reopens the configurator pre-filled with the existing choices; saving updates the same line.
**Starting state:** A basket already containing one configured blend (built by the test: All-Purpose Flour base + Whey Protein Isolate at 50%, confirmed by exploration to route to `/custom-blend?baseVariantId=<id>&editConfigKey=<key>`).
**Observable outcome:** Clicking "Edit blend" shows the ratio pre-filled at 50%, the submit button reads "Update blend" (not "Add blend to cart"), and the read-only locked quantity from the original line is shown. Changing the ratio and confirming returns to the basket with **still exactly one** blend line (assert count, not just presence), whose detail reflects the new ratio and total.
**Does not cover:** editing a blend whose base variant was retired/deactivated since it was added — that is a distinct failure path, not this scenario's concern.

### 4. The server rejects a screen-permitted combination and preserves the draft (AC4)
**Behaviour:** The web ingredient picker only filters by the base's compatible groups, not by the pigment dosage cap — that cap (`CUSTOM_BLEND_MAX_PIGMENT_PERCENTAGE = 10`, in [customBlendRules.ts](apps/api/src/features/customBlend/customBlendRules.ts)) is evaluated only server-side. Building a combination whose combined pigment-group percentage exceeds 10% must be rejected by the live evaluation call, not silently accepted.
**Starting state:** A base whose compatible-ingredient set includes a `pigments`-group item (per `INGREDIENT_GROUPS_BY_BASE`, bases in `cleaning`, `casting-materials`, or `theatrical-effects` groups allow one). **Concrete seeded product names for this pairing were not confirmed in the browser during planning — the implementer must first open Custom Blend, pick such a base, and read the ingredient picker's category groupings to find a real pigment-group product before writing the spec** (flagged in Risks).
**Observable outcome:** Selecting two such ingredients at percentages totalling over 10% renders an alert with a clear message (matching the unit-tested copy "Pigment content cannot exceed 10% (selected: N%)." from [CustomBlendPage.test.tsx](apps/web/src/features/customBlend/CustomBlendPage.test.tsx)), the "Add blend to cart" button is disabled, no basket line is created, and the selected ingredients/percentages remain visible on screen (not reset).
**Does not cover:** the compatibility-matrix rejection (`CUSTOM_BLEND_INCOMPATIBLE`) — the web's ingredient list is already filtered to compatible groups only, so that path isn't reachable through the UI and is proven at the API-integration level instead (see Existing coverage).

### 5. A non-food base carries handling guidance in the summary (AC3, second half)
**Behaviour:** Any base outside `food-grade` yields a "Non-food blend" classification with visible handling guidance, distinct from scenario 1's food-grade blend.
**Starting state:** A `garden-treatment` base (e.g. "Garden Lime") plus one compatible `garden-treatment` ingredient (e.g. "Bone Meal") — group pairing confirmed by rule, exact selector text to be confirmed when implemented.
**Observable outcome:** The review panel shows "Non-food blend" (not "Food-grade blend") and the "Not for consumption" handling text is present; the basket line for the same blend repeats both.
**Does not cover:** the specific PPE/handling copy per category — that's catalog content, not this feature.

## Existing coverage

No E2E spec exists for Custom Blend today — [e2e/](e2e) only has [catalog.spec.ts](e2e/catalog.spec.ts). Below the E2E layer, coverage is heavy but all against a **mocked** API:
- [CustomBlendPage.test.tsx](apps/web/src/features/customBlend/CustomBlendPage.test.tsx) already proves, with mocked network calls: submit-gating until an exact server verdict exists, the pigment-cap error message and disabled-submit behaviour, stale-evaluation discarding, non-food classification rendering, and edit-replace preserving quantity with a new authoritative key.
- [CustomBlendReachability.integration.test.tsx](apps/web/src/features/customBlend/CustomBlendReachability.integration.test.tsx) proves the nav → base list → options → evaluate → add-to-cart chain end-to-end at the React level, still with a mocked API.
- [customBlendRulesJourney.integration.test.ts](apps/api/test/customBlend/customBlendRulesJourney.integration.test.ts) proves the real API/DB round trip (create, evaluate, replace, stale-idempotency, pricing) via raw HTTP against a real database, but never through a browser.
- [CategoryNav.test.tsx](apps/web/src/components/CategoryNav.test.tsx) and [CustomBlendBanner.test.tsx](apps/web/src/components/home/CustomBlendBanner.test.tsx) already prove the nav/homepage links exist.

Net effect: rule permutations (pigment cap, incompatibility, classification logic, debouncing) are already proven cheaply. **Nothing proves the real browser → Vite proxy → API path, and nothing proves basket/checkout/order-confirmation persistence for a blend.** That's exactly where this plan puts its scenarios; scenario 4 deliberately narrows to "does the rejection reach the user correctly" rather than re-sweeping pigment-cap boundary values.

## Files to read

- [workshop/feature-ticket.md](workshop/feature-ticket.md) — the AC checklist this plan maps to.
- [e2e/README.md](e2e/README.md) and [e2e/catalog.spec.ts](e2e/catalog.spec.ts) with [e2e/pages/home-page.ts](e2e/pages/home-page.ts) — spec/page-object conventions to follow (locate by role/label, assertions only in specs, seeded-data constants).
- [apps/web/src/features/customBlend/CustomBlendPage.tsx](apps/web/src/features/customBlend/CustomBlendPage.tsx) — orchestrates base selection, edit hydration via URL, and the submit gate (`hasExactEvaluation`); explains why the button stays disabled until a fresh server verdict lands.
- [apps/web/src/features/customBlend/customBlendState.ts](apps/web/src/features/customBlend/customBlendState.ts) — documents which bounds are client-owned vs. server-only (pigment cap and compatibility are explicitly server-only).
- [apps/api/src/features/customBlend/customBlendRules.ts](apps/api/src/features/customBlend/customBlendRules.ts) — the private compatibility matrix and the pigment-cap constant, needed to pick a valid base/ingredient pairing for scenarios 4 and 5.
- [apps/web/src/components/CartLineItem.tsx](apps/web/src/components/CartLineItem.tsx) — builds the "Edit blend" href and renders blend detail in the basket.
- [apps/web/src/features/checkout/CheckoutSummary.tsx](apps/web/src/features/checkout/CheckoutSummary.tsx) and [apps/web/src/features/orders/OrderDetailView.tsx](apps/web/src/features/orders/OrderDetailView.tsx) — where the blend reappears at checkout and on the confirmation page, needed for scenario 2's assertions.
- The mocked-API tests named in Existing coverage — read before writing any spec, to avoid re-proving what they already prove.

## Risks

- **Guest-cart isolation between parallel test runs.** Exploration confirmed a fresh, signed-out browser context starts with an empty cart; each scenario must use its own isolated browser context/storage state so one test's basket additions can't leak into another's assertions.
- **Pigment-cap and non-food scenario data are unverified.** I confirmed the rule (`INGREDIENT_GROUPS_BY_BASE`, 10% pigment cap) in source but did not click through a real pigment-eligible base/ingredient pair or a `garden-treatment` pair in the browser during planning. The implementer must confirm concrete seeded product names before writing scenarios 4 and 5.
- **Live evaluation is asynchronous and debounced.** Assertions on the review-panel total after a ratio change must use web-first assertions (`await expect(...).toHaveText(...)`) and wait for the evaluation to resolve, not a fixed delay — the app already guards against stale evaluations, but a test that reads too early will see the loading state instead.
- **Checkout is a 3-step flow tied to current-date slot generation.** Scenario 2 deliberately signs in as a seeded account with a saved default delivery site/billing entity to skip one-off address entry and reduce exposure to slot-availability flakiness; a guest checkout of a blend is therefore not exercised and is a known gap if that path matters.
- **Ticket-vs-app gap:** the ticket doesn't mention that the basket quantity for a custom blend is silently forced to the base variant's minimum order quantity (observed: 4 sacks for a 25 kg Sack MOQ of 4) rather than defaulting to 1. Assertions should read whatever quantity the app actually renders rather than assuming 1.
- **Reset dependency:** all named seeded facts (SKUs, group memberships, account defaults) assume `npm run reset` state; note this the way [catalog.spec.ts](e2e/catalog.spec.ts) already does.

## Approach

Build the base-picker/ingredient/ratio locators as a single `custom-blend-page.ts` page object first, mirroring [catalog-page.ts](e2e/pages/catalog-page.ts)'s style (locators and navigation only). Implement scenario 1 first — it exercises every configurator control the other scenarios reuse (search-to-select base, toggle ingredient, adjust ratio, submit) and is the highest-value happy path. Scenario 3 (edit) follows directly, reusing the same page object plus a small basket page object for the "Edit blend" link and line count. Scenario 4 comes next once concrete pigment-eligible seed data is confirmed by hand in the browser. Scenario 2 (checkout) is the largest net-new investment — it likely needs a checkout page object that doesn't exist yet — so sequence it after the configurator-only scenarios are stable. Scenario 5 is smallest and last.
