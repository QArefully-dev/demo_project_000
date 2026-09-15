# QME-418 Custom Blend — E2E test plan

Scope: Playwright specs in `e2e/`. Ticket: `workshop/feature-ticket.md`.

The governing fact for this plan: Custom Blend is **already the most heavily tested feature in the
repo below the browser**. Five API integration files, twelve web component tests, and pure rule
tests cover policy, pricing, classification and error mapping. So this plan does not re-prove rules.
It proves the things only a real browser can: the Vite proxy path, the URL round trip that carries a
blend back into the configurator, and cart state surviving real navigation.

## Scenarios

Ordered by risk. If only the first three are ever written, the feature's real risk is covered.

### 1. Signed-out customer builds a blend and it reaches the basket as one line (AC1)

**Behaviour** — the revenue path: configure, confirm, and find the blend in the basket.

**Starting state** — no session, no cart. Navigate to `/custom-blend` from the nav link
`Custom Blend` (verified present in the category nav). Country stays at the `US` default; do not
touch the country selector.

**Steps** — click `Use Portland Cement as base`, check the first ingredient checkbox
(`Hydrated Lime`, which defaults the split to 50/50), then click `Add blend to cart`.

**Observable outcome** — the page shows `Custom blend added to your cart` and offers `View cart`
and `Keep shopping`. On `/cart` the blend renders as exactly **one** line carrying
`Custom blend`, the composition string `50% Portland Cement — 50% Hydrated Lime`, and a
`Blend total`. Assert the custom-blend line **count is 1**, not merely that one exists — a
duplicate-write bug is the failure this scenario exists to catch.

**Data** — `Portland Cement` and `Hydrated Lime` are seeded catalog products in
`Trade & Creative Materials`, both in the `Cementitious Materials` mixing group, so they are
compatible. Pin both names as named constants with a seed comment, per `e2e/CLAUDE.md`.

**Deliberately not covered** — pricing arithmetic. Money maths is settled in
`customBlendCart.integration.test.ts` in pence; asserting dollar strings here would duplicate it
and break on presentation changes.

### 2. A basket blend reopens for editing and replaces its line instead of adding a second (AC5)

**Behaviour** — the highest-value browser-only risk. The edit affordance is a real URL round trip:
`apps/web/src/components/CartLineItem.tsx:43` builds
`/custom-blend?baseVariantId=<id>&editConfigKey=<hash>`. The config key is a content hash, so an
edit that changes composition changes the key — and replace-not-append depends on the app carrying
the *old* key while submitting the *new* one. That coupling exists only across a real navigation.

**Starting state** — a blend in the cart, rebuilt by this spec's own setup (never inherited from
scenario 1).

**Steps** — on `/cart` click the edit-blend link. Confirm the configurator reopens under the
`Edit your custom blend` heading (`customBlend.title.edit`) with Portland Cement already chosen and
Hydrated Lime already ticked. Move the `Hydrated Lime percentage slider` (verified accessible name)
to a different valid value, then save.

**Observable outcome** — back on `/cart`, the custom-blend line count is still **1**, and its
composition text reflects the new percentages, not the old. That single count assertion is the
whole point.

**Data** — same seeded pair. The `editConfigKey` must be read from the live DOM, never hard-coded:
the hash derives from `CUSTOM_BLEND_RULE_VERSION` plus canonical JSON and changes whenever
normalisation changes.

### 3. A server rejection reaches the customer and preserves the configuration (AC4)

**Behaviour** — the screen lets you build a combination the server refuses; the refusal must land
as readable copy, add nothing to the basket, and leave the draft intact so it can be corrected.

**Starting state** — fresh configurator, empty cart.

**Steps** — assemble a combination the client allows but the resolver rejects. Two candidate
levers, both server-owned: an incompatible cross-mixing-group pairing
(`CUSTOM_BLEND_INCOMPATIBLE`) or pigment above `CUSTOM_BLEND_MAX_PIGMENT_PERCENTAGE` (10%,
`CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED`). Pigment is the better choice: it is a numeric cap reachable
by dragging one slider, whereas the compatibility matrix is deliberately private to
`customBlendRules.ts` and cannot be predicted from the client.

**Observable outcome** — the summary shows the localised message
`Pigment content cannot exceed 10% (selected: N%).`, `Add blend to cart` stays disabled, the cart
count stays at zero, and the base and ingredient selections are still on screen. Three assertions,
one reason to fail: *the server said no and the user can act on it*.

**Data** — requires a pigment-group product selectable as an ingredient alongside a compatible
base. `pigments` is a real `MIXING_GROUPS` member (`packages/catalog/src/model.ts:17`) and
`customBlendCart.integration.test.ts:123` exercises cleaning-plus-pigment, so such a pair exists;
**the exact seeded product names are an assumption** — confirm in the ingredient picker before
implementing.

**Deliberately not covered** — the rule sweep. Every boundary already has unit coverage in
`customBlendRules.test.ts`. This proves delivery, not policy.

### 4. The blend survives checkout to order confirmation (AC6)

**Behaviour** — a blend line stays intact through the real checkout, with the same composition
and total the summary promised, and appears on the confirmation.

**Starting state** — this spec builds its own blend, then proceeds through checkout as a guest
using the seeded test card from `README.md`.

**Observable outcome** — the blend line is present and correctly composed at the checkout summary,
and the confirmation page names it. Assert composition and presence; treat the total as a
consistency check between the checkout summary and the confirmation rather than a recomputed figure.

**Why fourth** — `customBlendCheckout.integration.test.ts` and `customBlendOrder.integration.test.ts`
already prove pricing, promotion interaction, snapshotting and stale-line 409s. The browser adds
only that the multi-screen flow wires up. Real value, but the cheapest tier already owns the maths.
It is also the longest and most fragile scenario, so it should not block the first three.

### AC2 and AC3 — covered cheaper, no E2E scenario

**AC2 (live price preview)** — a debounced, abortable re-evaluation with no page reload. Proven in
`useCustomBlendEvaluation.test.tsx`, `CustomBlendPage.test.tsx` ("drops a stale evaluation when the
percentage changes before the fresh verdict"), and `CustomBlendReachability.integration.test.tsx`. A
browser test adds nothing but a debounce race. Scenario 2 incidentally exercises the preview when it
moves a slider.

**AC3 (safety classification)** — verified rendering as
`Non-food blend / Not for consumption / This blend contains a non-food material...` and covered by
`CustomBlendPage.test.tsx` ("shows non-food classification from the server result without inferring
from the base") plus `MixVisualization.test.tsx`. Folded into scenario 1 as a single assertion on
the cart line rather than given its own spec.

## Existing coverage

I searched every tier. Findings that changed this plan:

- **E2E: nothing exists.** `e2e/` holds only `catalog.spec.ts` and `home-page.ts`/`catalog-page.ts`.
  `e2e/CLAUDE.md` states it outright: "No customBlend spec or page object exists yet." So there is
  **no spec to extend** — this is a genuine new-file case, and a new `pages/custom-blend-page.ts`
  plus `pages/cart-page.ts` must be built from scratch.
- **API integration (5 files)** — `customBlend/customBlendEvaluation`, `customBlendRulesJourney`,
  `cart/customBlendCart`, `checkout/customBlendCheckout`, `orders/customBlendOrder`. Between them:
  pigment cap metadata, incompatibility, MOQ guidance, clearance, dedup/rehydrate/merge-edit,
  promotion proration, cancellation restock, stale-line 409. **This is why scenarios 3 and 4 are
  thin** — the rules are settled; only delivery to the user is open.
- **API unit** — `customBlendRules.test.ts`, `customBlendResolver.test.ts` (pure policy/pricing).
- **Web unit (12 files)** — pickers, ratio editor/gauge, visualisation, preview, packaging,
  success recap, page orchestration, state reducer, evaluation hook.
- **Web integration** — `CustomBlendReachability.integration.test.tsx` already covers nav
  reachability, `baseVariantId` deep links, and submit gating with mocked HTTP. **A "can I reach
  the configurator" E2E scenario was dropped for this reason**; the only thing it adds is the real
  proxy, which scenario 1 exercises anyway.
- **Contracts** — `packages/contracts/test/custom-blend-contracts.test.ts`.

Net: four E2E scenarios, not ten. Everything droppable was dropped.

## Files to read

- `workshop/feature-ticket.md` — the six ACs.
- `e2e/CLAUDE.md` and `e2e/README.md` — the binding conventions: role/label locators, **never add
  `data-testid`**, web-first assertions, no `waitForTimeout`, no `.first()` on an identifying
  locator, assert counts, pin seeded data to constants.
- `e2e/pages/catalog-page.ts` — the page-object shape to copy (locators only, no assertions).
- `apps/web/src/features/customBlend/CustomBlendPage.tsx` and `BlendSummaryAside.tsx` — what
  renders and when submit unlocks.
- `apps/web/src/components/CartLineItem.tsx:43` — `editBlendHref`, the exact edit URL.
- `packages/localisation/src/messages/customBlend.ts` and `messages/apiErrors.ts` — every assertable
  string. Assert against these keys, never hand-typed prose.
- `packages/contracts/src/customBlends.ts` — `CUSTOM_BLEND_*` bounds; import, never redeclare.
- `apps/api/test/cart/customBlendCart.integration.test.ts` — the clearest map of what is already
  proven cheaply.

## Risks

**Ticket-vs-app contradictions (found while driving the running app):**

1. **The ticket says three steps; the app has four.** It describes "1. Base, 2. Ingredients,
   3. Ratios", but the rendered aside is headed **`4. Review`** with `Review your blend`. A spec
   written from the ticket's step names will not find them. Trust the app.
2. **The ticket calls the panel "Blend summary"; the app renders `Blend recap`** (plus
   `Mix profile` and `Live packaging preview`). No element is labelled "Blend summary".
3. **"Basket" is the ticket's word; the UI says cart** — `Add blend to cart`, `View cart`,
   `Open cart`, and the cart page is headed `Your pallet order`. Locators must use the app's nouns.
4. **The blending fee rendered as `$31.25`, but `CUSTOM_BLEND_FEE_CENTS` is `2500`.** The displayed
   figure is the country-rate conversion of the pence-authoritative fee for the default `US`
   country, not a bug — but it means **no spec may assert a money string without pinning country**,
   and it is a live instance of the GBP-vs-`$` documentation inconsistency the root `CLAUDE.md`
   already flags.

**Flakiness and cost:**

- **Cart state is per-session and mutable.** Every scenario must build its own blend and must not
  read a cart another scenario wrote. `playwright.config.ts` runs `fullyParallel`, so shared cart
  state is a real corruption risk, not a theoretical one. Use an isolated browser context per spec.
- **For the suite to pass twice on the same machine**, no scenario may leave state a later run
  trips over. Scenarios 1, 2 and 4 all add cart lines; each needs a fresh context so run two starts
  as empty as run one. Scenario 4 additionally places a real order, permanently mutating stock and
  order history — it is the one scenario that cannot be fully undone, and repeated runs will drift
  seeded quantities. `npm run reset` restores known state but is destructive and needs authorization.
- **Evaluation is debounced and abortable.** After any ratio change, wait on the rendered verdict
  with a web-first assertion. Never `waitForTimeout` — `e2e/CLAUDE.md` forbids it, and the
  stale-drop behaviour makes a fixed wait actively wrong.
- **Vite listens before Fastify.** `global-setup.ts` already gates on `/health`; without it these
  specs fail as empty pages that look like assertion bugs.
- **The config key is a content hash.** Never hard-code it. `CUSTOM_BLEND_RULE_VERSION` or a
  normalisation change invalidates it, and per the API `CLAUDE.md` that silently breaks existing
  cart and order lines.

**Unverified — assumptions to confirm before implementing:**

- The exact seeded pigment product names for scenario 3, and that one is selectable as an ingredient
  next to a compatible base.
- The checkout flow's guest steps and test card (`README.md` is authoritative) — I verified the
  blend through the cart, **not** through checkout.
- `@playwright/cli` is **not installed on this machine** (`playwright-cli: command not found`, and
  it is absent from the global npm list). I grounded the selectors and copy above by driving the
  repo's own installed Playwright from the scratchpad instead. The names quoted here are real
  rendered output, but anyone following `e2e/README.md` must
  `npm install -g @playwright/cli@latest` first.

## Approach

Build the page objects first — they are the reusable asset and do not exist yet.
`e2e/pages/custom-blend-page.ts` exposes the base buttons (`Use <name> as base`), ingredient
checkboxes, the `<name> percentage slider` inputs, the recap region and `Add blend to cart`;
`e2e/pages/cart-page.ts` exposes the custom-blend line, its composition text and the edit link.
Locators only, no assertions, returning page objects — matching `catalog-page.ts`.

Then write scenario 1 as `e2e/custom-blend.spec.ts` and get it green; it validates the page objects
and the seeded constants everything else depends on. Add scenario 2 next — it is the highest-value
browser-only proof and reuses scenario 1's setup as a helper. Scenario 3 follows once the pigment
seed data is confirmed. Scenario 4 goes last, in its own spec file, because it mutates order state
and will be the slowest and most brittle.

Throughout: import bounds from `@shop/contracts/custom-blends` and assert copy via the localisation
message keys, so a policy or wording change fails in one place instead of four.
