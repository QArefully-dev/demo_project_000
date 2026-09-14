# QME-418 — Custom Blend configurator: E2E test plan

All UI copy, routes, and data below were observed in the running app at
`http://127.0.0.1:5173` via `playwright-cli`, or read in source. Anything unverified is
marked as an assumption.

## Scenarios

### 1. A signed-out customer builds a blend and it reaches the basket as one line (AC1, AC3)

**Behaviour.** The full journey the business loses money on: nav → configurator → base →
ingredient → ratio → add → basket line.

**Starting state.** Signed out, empty cart, default country **US**. Navigate to
`/custom-blend` via the "Custom Blend" link in the `navigation "Product categories"` landmark
(verified reachable; no sign-in required).

**Steps.** Click `button "Use Plaster of Paris as base"` (base picker is a
`list "Base material options"`). Check `checkbox "Dry Pigment - Iron Oxide Red"`. Set
`spinbutton "Dry Pigment - Iron Oxide Red percentage"` to `10`. Click `button "Add blend to cart"`.

**Observable outcome.** `heading "Custom blend added to your cart"` appears with the
paragraph "90% Plaster of Paris — 10% Dry Pigment - Iron Oxide Red", and both
`button "View cart"` and `button "Keep shopping"` are present. After View cart, the cart shows
**exactly one** line item (assert the count, not merely presence) whose blend total is
`$343.25`, and the summary aside stated the same `Blend total: $343.25` before submission.
Classification `Non-food blend` plus `Not for consumption` is visible on both the summary and
the cart line — this covers AC3 in the same pass because it is rendered copy on the journey,
not a separate interaction.

**Data.** Seeded: Plaster of Paris 25 kg (`TCM-0034-001`, base `variantId=173`, source
`$74.25/sack`), Dry Pigment Iron Oxide Red (`TCM-0037-001`, `$111.75/sack`). Pin these as named
constants with a comment, as `catalog.spec.ts` does. `$343.25` = material `$312.00` (4 sacks ×
`$78.00`) + blending fee `$31.25`. **Quantity defaults to 4 sacks (MOQ), not 1** — the ticket
never mentions this and a plan written from the ticket alone would assert the wrong total.

**Does not cover.** Which ingredient combinations are legal — that is `customBlendRules.test.ts`
territory. Food-grade classification (see Risks).

### 2. A server rejection is explained, blocks the basket, and preserves the configuration (AC4)

**Behaviour.** The highest-value failure path, and the only AC whose whole point is that screen
and server disagree. **The screen lets you build the illegal blend**: selecting a single pigment
defaults it to 50%, which exceeds the 10% pigment cap.

**Starting state.** Fresh configurator on base `variantId=173`, nothing else.

**Steps.** Select `checkbox "Dry Pigment - Iron Oxide Red"` and leave the ratio at its default 50%.

**Observable outcome.** An `alert` in the summary reads exactly
**"Pigment content cannot exceed 10% (selected: 50%)."** — verified live, including the injected
actual percentage. `button "Add blend to cart"` is **disabled**. The base chip still shows
Plaster of Paris and the pigment checkbox is still checked, so correcting the ratio to `10` (in the
same test, as recovery) turns the alert into the priced summary and enables the button. The cart
remains empty at the point of rejection.

**Data.** Same seeded pigment. The cap constant is `CUSTOM_BLEND_MAX_PIGMENT_PERCENTAGE`
(10) in `customBlendRules.ts`.

**Why E2E and not integration.** The API already proves the 400 (`customBlendCart.integration.test.ts`
— "cap and incompatibility failures do not write cart lines"). What only the browser proves is
that the coded error survives translation into that user-facing sentence with the right number,
and that the submit gate actually closes. Assert the message and the disabled button — do not
re-sweep the rule.

**Does not cover.** Incompatible-group rejection and below-MOQ rejection. Both are covered at
integration level; adding them here buys a second copy of the same plumbing.

### 3. Editing a basket blend replaces that line instead of adding a second (AC5)

**Behaviour.** The round trip — persisted state re-read into the configurator, then written back
onto the same line. Classic E2E-only risk: nothing below this level exercises URL → cart →
reducer → mutation end to end.

**Starting state.** A cart containing exactly one blend, created by this test (do not inherit
scenario 1's cart — see Risks).

**Steps.** From the cart line, click `link "Edit blend"` (href
`/custom-blend?baseVariantId=173&editConfigKey=<64-hex>`). Change the pigment percentage from
`10` to `8`. Click `button "Update blend"`.

**Observable outcome.** On reopening: `heading "Edit your custom blend"` (not "Build a custom
blend"), the summary already shows `Base 90% · ingredients 10% · 1 of 4 ingredients selected`,
and the paragraph "Quantity: 4 sacks. Base material and quantity stay fixed while editing a blend."
After update, the cart still has **exactly one** line item, its blend recap reads 92%/8%, and its
blend total differs from `$343.25`. Asserting the line *count* is the assertion that matters.

**Data.** Created by the test. The `configKey` is server-generated — read it from the edit link's
href, never hard-code it.

**Does not cover.** Editing while the base lot has been retired underneath you
(`customBlendCart.integration.test.ts` covers retired persisted facts).

### 4. The blend price survives checkout to order confirmation (AC6)

**Behaviour.** The last boundary crossing: cart snapshot → checkout quote → confirmed order.

**Starting state.** A cart containing one blend created by this test, then `/checkout`.

**Observable outcome.** The blend appears at checkout as a line whose total matches the cart's
blend total, and the order confirmation page (`/order-confirmation/:orderId`) shows the blend
with the same figure and the same non-food classification. One reason to fail: the money is
consistent across the two screens.

**Assumption — flagged.** I did not drive checkout in the browser. `/checkout` and
`/order-confirmation/:orderId` exist in `apps/web/src/App.tsx:62-65`, and the API path is proven in
`customBlendCheckout.integration.test.ts` and `customBlendOrder.integration.test.ts`, but the
checkout form's fields, the payment step, and the confirmation copy are unverified. **Implement
this scenario last and expect to spend the exploration budget on the checkout form.** If checkout
turns out to need addresses, payment simulation, and sign-in, consider whether the integration
tests already discharge AC6's real risk and reduce this to a smoke assertion that the blend line is
present and priced at checkout.

### AC2 — live price preview: deliberately not its own scenario

Scenario 2 already proves the summary re-renders without reload when a proportion changes
(50% alert → 10% priced summary showing `Material total`, `Blending fee`, `Blend total` as three
separate lines). `useCustomBlendEvaluation.test.tsx` covers the debounce, abort, and
stale-verdict behaviour underneath far more cheaply than a browser can. A dedicated E2E for AC2
would duplicate both. Note the coverage in the spec so it does not read as an omission.

## Existing coverage

**E2E: almost none.** `e2e/` contains exactly one spec — `catalog.spec.ts` (catalog search) —
plus page objects `pages/home-page.ts` and `pages/catalog-page.ts`. **There is no Custom Blend
E2E coverage at all.** That is the gap this plan fills.

**Below E2E: dense, and it changes the plan.** The API side is thoroughly covered:
`customBlendRules.test.ts` and `customBlendResolver.test.ts` (unit); and integration suites for
options (`customBlendOptions.integration.test.ts`), evaluation
(`customBlendEvaluation.integration.test.ts` — including pigment cap metadata), cart
(`customBlendCart.integration.test.ts` — dedupe, rehydrate, merge edits, cap failures writing no
line, below-MOQ, clearance, corrupt JSON), checkout (`customBlendCheckout.integration.test.ts`),
orders (`customBlendOrder.integration.test.ts`), and a full journey
(`customBlendRulesJourney.integration.test.ts`).

The web side is equally well covered at component level: `CustomBlendPage.test.tsx` (submit
gating, stale evaluation, non-food classification from the server, edit quantity preservation),
`CustomBlendReachability.integration.test.tsx` (nav reachability, deep links, submit gating),
`useCustomBlendEvaluation.test.tsx`, `customBlendState.test.ts`, `CartLineItem.test.tsx` (blend
disclosures and the edit link).

**Consequences applied above:** no E2E scenario sweeps validation rules; the rejection scenario
asserts only that a rejection *reaches the user* with the right sentence and gate; AC2 gets no
dedicated scenario; incompatible-group and below-MOQ rejections are dropped as already proven.

**Where to put the new work.** There is no blend spec to extend, so add
`e2e/custom-blend.spec.ts` plus a `pages/custom-blend-page.ts` page object — following the
existing convention (`pages/` holds locators and navigation, specs hold assertions). A
`pages/cart-page.ts` will also be needed and does not exist.

## Files to read

- `apps/web/src/features/customBlend/CustomBlendPage.tsx` — the configurator. Shows that the URL
  owns the target (`baseVariantId`, `editConfigKey`), which is what makes the edit scenario
  implementable.
- `apps/web/src/features/customBlend/BlendSummaryAside.tsx` — every summary assertion in
  scenarios 1, 2, and 4 renders here: classification section, the three money lines, the error
  `alert`, and the submit-disabled condition.
- `packages/localisation/src/messages/customBlend.ts` — the source of truth for expected strings.
  Copy is country-dependent; do not invent strings.
- `e2e/catalog.spec.ts` and `e2e/pages/home-page.ts` — the house style to imitate: pinned seeded
  constants with a comment, page objects free of assertions, no `data-testid`.
- `e2e/README.md` — the rules these specs are held to (role/label locators, web-first assertions,
  no `waitForTimeout`, assert counts not existence).
- `apps/api/src/features/customBlend/customBlendRules.ts` — the caps and constants
  (`CUSTOM_BLEND_MAX_PIGMENT_PERCENTAGE`, MOQ) the expected numbers derive from.
- `apps/api/test/cart/customBlendCart.integration.test.ts` — read before adding any rejection
  scenario, to avoid re-testing what it already proves.

## Risks

**The ticket disagrees with the app in three places.**

1. The ticket describes "Three labelled steps: 1. Base, 2. Ingredients, 3. Ratios". The app has
   **four**: the summary aside is labelled `4. Review`. A spec asserting a three-step structure
   would fail against correct code.
2. The ticket's AC1 says "set valid proportions" with no mention of quantity. The app **locks
   quantity to 4 sacks (MOQ)** and shows it as fixed while editing. Totals are MOQ-multiplied;
   a plan taken from the ticket at face value would expect a one-sack price.
3. AC4 says "the configuration is preserved so I can correct it". The app does preserve it, but
   the rejection surfaces **continuously during editing** with the submit button disabled — there
   is no submit-then-reject moment. A spec that clicks Add and waits for an error will hang.

**Currency conversion.** Default country is **US**, so the summary shows `$` amounts converted at
render time from GBP-authoritative values (`CUSTOM_BLEND_FEE_CENTS = 2500`, displayed as `$31.25`).
Every money assertion is country-coupled. Pin the country explicitly in the spec rather than
relying on the default, or a country-default change silently breaks four scenarios.

**Cart state is shared and persists across specs.** The cart survives between tests in the same
browser context, and `playwright.config.ts` sets `fullyParallel: true`. Two specs adding blends
concurrently will see each other's lines, so any "exactly one line" assertion is order-dependent
unless each scenario starts from an isolated context and creates its own blend. Do not let
scenario 3 or 4 reuse scenario 1's cart. For the suite to pass twice on the same machine, each
scenario must clear or isolate cart state at setup — an empty starting cart cannot be assumed
after a prior run.

**Seeded data drift.** Prices (`$74.25`, `$111.75`, `$78.00`) and `variantId=173` come from the
current seed. `npm run reset` is the documented remedy; if variant IDs are not stable across
reseeds, resolve the base by its accessible name rather than the URL parameter.

**Asynchrony.** Evaluation is debounced 150 ms and requests are aborted on change
(`useCustomBlendEvaluation.ts`). Assertions must be web-first on the *settled* summary. Asserting
on an intermediate value after a ratio change will flake. Note the `role="status"` "Checking your
blend and current price…" element: waiting for it to disappear is more robust than waiting for a
figure to change.

**Unverified.** The checkout and order-confirmation screens (scenario 4). Food-grade
classification: every base in the picker was Trade & Creative Materials and every blend I built
classified as non-food. **I did not find a base/ingredient pair that produces a `food-grade
blend`**, so the positive half of AC3 is unproven in the browser. Before writing an assertion for
it, find a food-category base in the picker (the category filter lists `Baking & Pantry`,
`Drinks`, `Sports Nutrition`) and confirm a food blend is actually buildable.

## Approach

Build the page object first — `e2e/pages/custom-blend-page.ts` exposing the base picker list, the
ingredient checkboxes, the percentage spinbuttons, the summary money lines, the classification
region, the error `alert`, and the submit button, all located by role and accessible name. Every
scenario depends on it, and the names are already confirmed above, so this is transcription
rather than discovery.

Then write scenarios 1 and 2 in `e2e/custom-blend.spec.ts`. Together they are the feature's real
risk: the journey that takes money, and the rejection that must not. If only these two are ever
written, QME-418 is meaningfully covered.

Add scenario 3 next; it needs `pages/cart-page.ts`, which scenario 1 will already have wanted for
its line-count assertion.

Leave scenario 4 last, and timebox the checkout exploration before committing to it. If checkout
demands sign-in and payment simulation, escalate rather than absorb it: the integration suite
already proves the blend's money survives checkout, and the E2E version may not be worth its
maintenance cost.

Before any of it, resolve the food-grade question and the cart-isolation mechanism. Both change
what gets written, and both are cheaper to answer now than to discover in a flaking suite.
