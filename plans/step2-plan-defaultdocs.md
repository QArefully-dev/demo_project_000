# QME-418 Custom Blend configurator — E2E test plan

Scope: browser-level coverage only. The feature is already built and heavily tested
below the browser (see **Existing coverage**), so this plan deliberately proposes few
scenarios and says why each one cannot be bought more cheaply underneath.

## Scenarios

### 1. A signed-out customer builds a blend and it reaches the cart (AC1)

**Behaviour.** The whole money-earning journey: land on the configurator, pick a base,
tick an ingredient, set a ratio, add to cart, and find the blend as one cart line.

**Starting state.** Signed out, empty cart. Navigate to `/custom-blend` via the
"Custom Blend" link in the `Product categories` nav (verified present in the rendered
nav, `href="/custom-blend"`). Choose base **All-Purpose Cleaner material**
(`variantId 115`, `cleaning`, stock 50, `moqSacks 4` — seeded, confirmed live via
`GET /api/custom-blends/bases`). Tick ingredient **Glass Cleaner material**
(`variantId 123`) — a `checkbox` whose accessible name is the product name.

**Observable outcome.** After `Add blend to cart` the page becomes the success recap
headed **"Custom blend added to your cart"**, listing `Blend recap` with the base and
ingredient percentages. Following **View cart** shows exactly **one** cart line for the
blend. Assert the line count is 1 — a duplicate-line regression is precisely what AC5
depends on not happening.

**Deliberately not covered.** Exact pence arithmetic (proven in
`customBlendRules.test.ts` and `customBlendCart.integration.test.ts`).

**Why first.** It is the only scenario that proves the real browser → Vite proxy → API →
SQLite path works end to end for a blend at all. Everything else assumes it.

---

### 2. The server rejects a blend the screen let the customer build (AC4)

**Behaviour.** A rejection reaches the user as readable copy, the cart stays unchanged,
and the configuration is still on screen to correct.

**Starting state.** Configurator on base **All-Purpose Cleaner material** (`115`). Tick
**two** pigment ingredients — `Dry Pigment - Iron Oxide Red` (`179`) and
`Dry Pigment - Titanium White` (`177`) — and set each to 10%.

This combination is reachable *only* through the UI's own affordances: the options
endpoint genuinely offers all four pigments for a cleaning base, and the minimum
ingredient share is 5%, so any two pigments already breach the 10% pigment cap. I
confirmed the server verdict directly:

    POST /api/custom-blends/evaluate {base:115, [179@10, 177@10]}
    -> 400 CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED
       "Pigment content cannot exceed 10% (selected: 20%)."

**Observable outcome.** The summary aside shows that message in its `alert` region, the
`Add blend to cart` button stays disabled, and — the part only a browser proves — both
pigment checkboxes remain ticked at 10% so the customer can lower one rather than start
again. Then reduce one pigment to 5% and assert the alert clears and submit enables.

**One reason to fail.** This scenario proves *rejection surfaces and is recoverable*. It
does not sweep the rule matrix.

**Why second.** AC4 is the acceptance criterion most likely to be wrong in the browser,
because it is the only one where the screen and the server can legitimately disagree.
The rule itself is unit-tested; the round trip and recovery is not.

---

### 3. Editing a blend in the cart replaces the line instead of adding a second (AC5)

**Behaviour.** Round-tripping persisted state back into the configurator and out again.

**Starting state.** Depends on nothing from scenario 1 — this test builds its own blend
first (same base/ingredient as above), then goes to `/cart`.

**Observable outcome.** The blend line exposes an **Edit blend** link pointing at
`/custom-blend?baseVariantId=<base>&editConfigKey=<key>`. Following it, the heading reads
**"Edit your custom blend"** (not "Build a custom blend"), the previously chosen
ingredient checkbox is already ticked at its saved percentage, and the submit button reads
**Update blend**. Change the ratio, submit, and assert the recap says **"Custom blend
updated"** and the cart still holds exactly **one** blend line with the new percentage.

**Why third.** This is a classic E2E-only risk — state persisted, re-read, re-entered for
editing, and written back under a different (replace, not create) mutation. The count
assertion is the whole point.

---

### 4. The blend's price is presented consistently from summary to cart (AC2, AC6-partial)

**Behaviour.** The money the summary promises is the money the cart shows.

**Starting state.** Configurator with base `115` and one non-pigment ingredient.

**Observable outcome.** Read the rendered **Blend total: …** from the summary aside
(alongside **Material total: …** and **Blending fee: …** — the fee is flat,
`CUSTOM_BLEND_FEE_CENTS = 2500`). Add to cart, open `/cart`, and assert the blend line's
total is that same string. Also assert that changing a ratio *before* adding updates the
displayed **Blend total** without a navigation — that is AC2's "no page reload" clause.

**Deliberately not covered.** Whether the number is arithmetically correct. That is
`calculateCustomBlendPricing`'s job and is unit-tested. This asserts *consistency across a
boundary*, which unit tests structurally cannot.

---

### 5. Safety classification is stated on the configured blend (AC3)

**Behaviour.** The summary states **Food-grade blend** or **Non-food blend**, and the
non-food case carries handling guidance.

**Starting state.** Two configurations, as separate tests in one spec file: base `115`
(cleaning) plus a cleaning ingredient → expect **Non-food blend** and the
not-for-consumption guidance; and an all-food configuration (base **All-Purpose Flour**,
`variantId 1`, `food-grade`, plus another food-grade ingredient from that base's options)
→ expect **Food-grade blend** and *no* handling warning.

**Why last, and a caveat.** `CustomBlendPage.test.tsx` already asserts "shows non-food
classification from the server result without inferring from the base" at unit level. The
E2E value here is thin — it is a rendered-string check. I would write it only after 1–4,
and I would accept dropping it. If kept, it is the cheapest of the five.

---

**AC6 (checkout) — no dedicated scenario, deliberately.** Payment through the simulated
gateway, promo proration excluding the blending fee, and the immutable order snapshot are
covered thoroughly in `customBlendCheckout.integration.test.ts` and
`customBlendOrder.integration.test.ts`, including the stale-line 409 path. Driving a full
card checkout in a browser adds a long, fragile scenario that would re-prove server logic.
Scenario 4 already carries the "consistent price across a boundary" risk one screen
further than the summary. **If** AC6 must have browser coverage, extend scenario 1 to
complete checkout with a seeded test card and assert only that the order confirmation
names the blend — one assertion, not a pricing sweep.

## Existing coverage

I searched `apps/api/test/**`, `apps/api/src/**/*.test.ts`, `apps/web/src/**`, and `e2e/`.
Coverage below the browser is unusually strong, and it changed this plan substantially.

- **E2E: none.** `e2e/` contains only `catalog.spec.ts` (search) with page objects
  `home-page.ts` and `catalog-page.ts`. There is **no Custom Blend spec and no
  configurator or cart page object.** This is a genuine gap — hence a new
  `e2e/custom-blend.spec.ts` rather than extending an existing file.
- **API integration** — `customBlendEvaluation`, `customBlendOptions`,
  `customBlendRulesJourney`, `cart/customBlendCart`, `checkout/customBlendCheckout`,
  `orders/customBlendOrder`. Between them these already prove: pigment-cap metadata,
  incompatibility, below-MOQ guidance, clearance applying to material only, config-key
  dedup and edit-merge, reserved-cart rejection, checkout revalidation, the stale-line 409,
  promo proration excluding the fee, and order snapshot immutability.
- **Web unit/integration** — `CustomBlendPage.test.tsx` (9 tests) and
  `CustomBlendReachability.integration.test.tsx` (6 tests) cover submit gating, stale
  evaluation dropping, sold-out ingredients staying selectable, the coded pigment-cap
  verdict rendering, edit-quantity preservation, and nav reachability. Plus per-component
  tests for `BasePicker`, `IngredientPicker`, `RatioEditor`, `MixVisualization`,
  `SuccessRecap`, `customBlendState`, and `useCustomBlendEvaluation`.

**Scenarios dropped because they are already proven cheaper:** a validation sweep of
percentage bounds; ingredient-limit enforcement; sold-out ingredient selectability;
stale-evaluation races; nav reachability; MOQ messages; every pricing calculation.

## Files to read

- `apps/web/src/features/customBlend/CustomBlendPage.tsx` — the URL owns the target
  (`baseVariantId`, `editConfigKey`); read this before writing the edit scenario.
- `apps/web/src/features/customBlend/BlendSummaryAside.tsx` — every string scenarios 2, 4
  and 5 assert on, and the `submitDisabled` condition.
- `apps/web/src/components/CartLineItem.tsx` — `editBlendHref` (line 44) builds the edit
  link the cart exposes.
- `packages/localisation/src/messages/customBlend.ts` and `cart.ts` — authoritative copy.
  Never hard-code English guessed from a screenshot; read the `UK`/`US` entry.
- `packages/localisation/src/messages/apiErrors.ts` — `CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED`
  copy for scenario 2.
- `packages/contracts/src/customBlends.ts` — the constants (min 5%, max 50%, ingredient
  total <= 50%, pigment cap 10%) that make scenario 2's setup reachable.
- `e2e/README.md`, `e2e/pages/home-page.ts` — the page-object conventions to match.

## Risks

- **Ticket vs app: "three labelled steps" is accurate but the first is not a step.** The
  ticket describes "1. Base, 2. Ingredients, 3. Ratios". The rendered page confirms groups
  `2. Ingredients` and `3. Ratios`, but base selection is not a discrete screen — it is a
  *URL parameter*, and picking a base re-navigates to `?baseVariantId=N`. Treat the
  configurator as URL-driven, not wizard-driven.
- **Ticket vs app: quantity is invisible to the customer.** The ticket never mentions
  quantity, but every blend is priced at a quantity and the API applies the base MOQ
  (4 sacks) when none is sent. On edit, quantity is *locked* and shown read-only. A plan
  that assumes the customer picks a quantity will not implement.
- **Ticket vs app: AC4's "the screen allowed me to build it" is only reachable via
  pigments.** For most base groups the ingredient list is already filtered to compatible
  materials, so the UI cannot construct an incompatible blend. The pigment cap is the one
  genuine screen-allows/server-rejects path. If pigment seeding changes, scenario 2 loses
  its trigger — pin `179`/`177` and the 10% cap to named constants with a comment.
- **Default country is US, not UK.** The rendered country combobox showed
  **United States** selected. Copy assertions must use the `US` message variant (identical
  to `UK` for this feature, but money formatting differs). Do not switch country mid-spec.
- **Cart state must not be shared across scenarios.** The cart is created per browser
  context via `POST /api/cart`, so parallel workers get separate carts — but each scenario
  must build its own blend rather than inherit one. Scenario 3 explicitly does this.
- **The suite mutates seeded stock.** Adding blends consumes base-lot stock (only the base
  is allocated — confirmed in `customBlendOrder.integration.test.ts`). Repeated local runs
  drift `stockCount`. Scenarios must not assert on stock numbers; `npm run reset` restores
  a known state. This is the main "passes twice in a row" hazard.
- **Evaluation is debounced and asynchronous.** The submit button stays disabled until an
  *exact* server verdict matches the current draft. Use web-first
  `expect(button).toBeEnabled()` rather than clicking straight after a ratio change; never
  `waitForTimeout`.
- **Locator ambiguity.** `find "Dry Pigment - Iron Oxide Red"` returned **2 matches** (the
  checkbox and its label text). Scope by `getByRole('checkbox', { name })`, and heed the
  README's rule against `.first()`.
- **Unverified.** I did not drive a full add-to-cart, edit, or checkout in the browser. I
  confirmed the configurator's rendered structure, the exact control names
  (`Add blend to cart`, ingredient checkboxes, `2. Ingredients` / `3. Ratios`), and the
  server's rejection payload, then stopped. The cart-line and success-recap accessible
  names come from source, not from a rendered page. Treat the cart assertions in scenarios
  1, 3 and 4 as needing confirmation on first implementation.

## Approach

Build the page objects first, because there are none and all five scenarios share them:
`e2e/pages/custom-blend-page.ts` (base selection via URL, ingredient checkboxes, ratio
controls, the summary aside's total/classification/alert locators, the submit button) and
`e2e/pages/cart-page.ts` (blend lines, their totals, the `Edit blend` link). Both expose
`Locator`s only — no assertions — matching `home-page.ts`.

Then write scenario 1 alone and get it green. It exercises every locator the others need,
so it flushes out the unverified cart-side names cheaply. Pin the seeded facts
(`BASE_VARIANT_ID = 115`, ingredient IDs, `PIGMENT_CAP = 10`) as named constants at the top
of the spec with a comment pointing at `README.md`, exactly as `catalog.spec.ts` does.

Add scenarios 2 and 3 next — they carry the real risk. Scenario 4 follows, and scenario 5
last, or not at all if the unit coverage is judged sufficient. Everything lives in a single
`e2e/custom-blend.spec.ts`; the feature has no e2e home yet and does not need two files.

Stop before checkout. If AC6 coverage is demanded later, add the single-assertion extension
described above rather than a full payment scenario.
