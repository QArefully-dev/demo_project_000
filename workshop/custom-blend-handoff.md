# Handoff: Custom Blend (QME-418) — pitfalls + findings

Ticket: `workshop/feature-ticket.md` (AC1–AC6). Source: static code trace (4 parallel agents + spot checks) + static test-coverage scan (4 agents, see `## Test coverage`). Nothing executed. `[verified]` → re-checked by hand; rest → agent-traced with file:line, treat as high-confidence, re-check before asserting.

## Domain rules (server = source of truth)

- Base: exactly one. Must be `active` variant, `weight_grams = 25000`, `sort_order = 1`, on active product, known mixing group, positive `moq_sacks`. Else → 400 `CUSTOM_BLEND_INVALID`. `customBlendRepository.ts:77-82`
- Ingredients: 1–4, whole % 5–50 each, total ≤50. Base % = 100 − total → always 50–95 (base-range check unreachable). `packages/contracts/src/customBlends.ts:16-24`
- Compatibility matrix, directional, API-private (web never sees it). `customBlendRules.ts:42-51`
  - food-grade -> food-grade
  - cleaning -> cleaning, pigments
  - garden-treatment -> garden-treatment
  - cementitious-materials -> cementitious-materials
  - casting-materials -> casting-materials, pigments
  - theatrical-effects -> theatrical-effects, pigments (no seeded product has this group → unreachable via UI)
  - pigments, absorbents -> never base. absorbents -> never ingredient.
- Pigment cap: all pigment ingredients combined ≤10%. 5+5 ok, 6+5 → 400 `CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED` with `meta {maxPercentage, actualPercentage}`.
- Error precedence: unavailable/country-blocked → `CUSTOM_BLEND_INVALID` > incompatible → `CUSTOM_BLEND_INCOMPATIBLE` > pigment cap. One error shown even if several apply. `customBlendResolver.ts:589-624`
- Classification: food-grade only if every component (base incl.) is exactly `food`. Any `caution` → non-food. 3 Sports Nutrition products = food-grade group but `caution`; all pigments `caution`. `customBlendRules.ts:259-277`
- Baking Soda: `mixingGroup: null` → silently absent from base + ingredient lists. `bakingPantry.ts:173`

## Top pitfalls for E2E planning (logic complexity, not bugs)

1. Line identity + merge (AC1, AC5)
   - `configKey` = SHA-256 of ingredients sorted by variantId; excludes base + quantity. Line key = (cart, base variant, configKey). `customBlendRules.ts:637-651`
   - Same recipe added twice, any ingredient order → one line, quantities summed, repriced at combined qty.
   - Edit A into recipe identical to existing line B → A deleted, qty merged into B, B's configKey kept. "Replaces, not adds second line" holds only in single-blend case. `cartRepository.ts:186-215`; API-tested `customBlendCart.integration.test.ts:86-99`
   - After replace, edit URL (old `editConfigKey`) → `customBlend.missingLine` "That custom blend is no longer in your cart."
2. Pricing shape (AC2, AC6)
   - Volume tier per component, by component weight (`qty × 25 kg × pct`), not per blend. 200-sack plain line → 5%; 200-sack 75/25 blend → 0% (3.75 t + 1.25 t, both under 5 t). `customBlendRules.ts:442-453`
   - Rounding half-up per component per sack, then × qty → drift vs exact total grows with qty.
   - Blending fee `CUSTOM_BLEND_FEE_CENTS = 2500` flat per line, not per sack, never discounted. → `unitPrice × qty ≠ lineTotal` (gap = fee). `checkoutQuote.ts:614-635`
   - No tier aggregation across lines (blend component + plain line of same material never combine).
   - Clearance replaces source price, then tier applies on top.
3. Preview quantity hidden (AC2, AC6) `[verified]`
   - New blend: no quantity input. Evaluation omits qty → server uses base MOQ (seed: 4 sacks). Summary shows totals for MOQ, never says "4 sacks". Only hint: "Component weight: X kg" rows.
   - Add-to-cart submits evaluated qty → cart line = MOQ → prices match initially.
   - Edit mode: qty locked to line qty, shown under base name (`CustomBlendPage.tsx:399`).
   - Compare summary ↔ basket ↔ checkout only at same qty.
4. Server-only rules (AC4)
   - Web mirrors structure only (counts, 5–50, total ≤50, clamps input). Matrix + pigment cap only server-side → surfaced after debounced evaluate (150 ms) in summary aside.
   - Evaluate vs add disagree on codes: country-blocked → evaluate 400 `CUSTOM_BLEND_INVALID`, create/replace 404 `VARIANT_NOT_FOUND`. Below-MOQ qty → evaluate 200, create 400 `BELOW_MOQ`.
   - Structural failures (duplicate ingredient, ingredient == base, total >50) → `CUSTOM_BLEND_INCOMPATIBLE` "The selected materials cannot be combined." (misleading). Schema failures (4%, 51%, 5.5%, 5 ingredients) → `REQUEST_INVALID`.
   - Add/replace failure in UI → generic cart error "Could not update your cart. Please try again." (`cartErrorState` has no `CUSTOM_BLEND_*` keys, `useCart.ts:123-140`). Draft preserved.
5. Stock + promo keyed on base only
   - Checkout reserves full qty of base variant (10 blend sacks → 10 base sacks, not 7.5). Ingredient stock never checked/reserved/decremented. `checkoutService.ts:765-771`
   - Base stock pool shared with plain lines of same SKU → each line fits, combined fails only at checkout `INSUFFICIENT_STOCK`. Single add/update never checks stock.
   - Promo category = base product category. Cleaning base + pigment → whole line counts Household & Cleaning (`CLEANFIVE` applies). `promoService.ts:99-109`
   - Blend sacks count as items (`SAVE10` min 5). Fee excluded from discount base + `MIN_SUBTOTAL`, but cart subtotal displayed includes fee.
   - Freight + MOQ from base variant only. All seeded 25 kg variants = freight → parcel path untestable on seed.
   - Cart price live: re-resolved every cart read. Only checkout quote frozen. No "price changed" guard.

## UI behaviour worth knowing

- Ingredient pick: remaining budget ≥5% → new ingredient takes remaining (cap 50), existing % kept (manual tuning survives). Remaining <5% → even rebalance of all, overwrites manual %. From empty: 1st → 50, 2nd → 25/25, 3rd → 17/17/16, 4th → 13/13/12/12. `customBlendState.ts:97-114`, unit-tested `customBlendState.test.ts:70-130` `[verified]`
- Percentage number input clamps every keystroke (typing "2" → 5). Playwright `fill('20')` ok, `pressSequentially` breaks. Slider `max` hard-coded 50.
- Price verdict nulled while re-evaluating → wait for new total, not mere visibility.
- Refresh → draft lost (URL holds only `baseVariantId`, `editConfigKey`).
- Success recap shows no price; sticky — nav to Custom Blend again keeps recap until reload.
- "Change base" chip hidden in edit mode.
- Display currency: each figure converted + rounded separately → component rows can differ from total by 1 minor unit (US/EU rates). GBP pence authoritative. PL decimal comma.

## Post-checkout lifecycle

- Returns: blends excluded server-side (`returnRepository.ts:257`).
- Cancellation: whole order only, while `processing`/`packed`, no shipment left. Restocks base only.
- Saved lists + quick order silently drop blend lines. Reorder/standing-order-from-order carry blends, repriced today.
- Corrupt blend snapshot → order detail 500 (`orderRepository.ts:174-196`). Intended: test "fails the order read closed" `customBlendOrder.integration.test.ts:481`.

## Suspected real bugs (out of E2E-pitfall scope, report separately)

- "Balance evenly" `[verified]`: page dispatches `percentage-changed` per ingredient sequentially; reducer clamps against current others → `[5,17,28]` → `5,17,16` (38%) not `17,17,16`. Helper `balanceEvenlyPercentages` correct; wiring wrong. `CustomBlendPage.tsx:425-436`
- Poisoned cart `[verified, API half]`: one unresolvable blend line (ingredient/base deactivated) → `getCart` returns `undefined` → 404 on GET + every mutation incl. remove. Web then silently creates new empty cart → plain items lost. `cartService.ts:375-384`, `apps/web/src/hooks/cartClient.ts:21-36`
- `/api/promo/validate` prices blends via legacy path (base price only, no clearance, aggregate tier) → `MIN_SUBTOTAL` (`SAVE20`) can disagree with checkout. `app.ts:623`, `promoService.ts:153`
- "N sacks to next tier" hint counts component-material sacks, not blend sacks. `customBlendRules.ts:453`. Locked as expected: `customBlendRules.test.ts:271`, `customBlendResolver.test.ts:160`, web `CartLineItem.test.tsx:278` ("398 sacks to the 10-tonne tier"). Cart line-level `nextTierProgress` undefined for blends (`customBlendCart.integration.test.ts:187,244`) → hint per component row only → likely design, not bug; confirm with PO.
- README says `alice-split-shipped` has Custom Powder line; seed has plain lines only → no seeded blend order. `README.md:208`, `orderSeedScenarios.ts:90-100`

## Test data + environment

- Run `npm run reset` before suite. One shared SQLite, Playwright `fullyParallel` → use unique carts, fresh browser context per test (cart id in localStorage per country).
- MOQ 4 sacks typical. CN blocks Sports Nutrition (blend with such base/ingredient blocked).
- Seeded mixing groups: food-grade 54, cleaning 13, garden 15, cementitious 7, casting 3, pigments 4, absorbents 3, theatrical 0.
- Clearance fixtures (`GDN-1043-001`, `HCL-1038-001`, `TCM-1049-001`) not 25 kg → clearance-in-blend unreachable from seed (integration reaches it only via DB update + fixed clock, `customBlendCart.integration.test.ts:407`). Server clock real (`app.ts:313`), not fixture clock; GDN window already ended.
- Pin base/ingredient names + MOQ as named constants (per `e2e/README.md`).

## Locator notes

- Ingredient name appears in checkbox label, "X percentage", "X percentage slider", "Decrease/Increase X percentage", legend, packaging labels → `getByLabel(..., { exact: true })`.
- Two h2 "Blend recap" (`RatioGauge.tsx:19`, `BlendSummaryAside.tsx:123`) → scope by region.
- `role="alert"` list renders "Add at least 1 ingredient." on pristine form → scope alerts.
- App contains some `data-testid`/`data-*` attrs; `e2e/README.md` forbids relying on them.

## Test coverage (static scan, 2026-10-03)

Scope: API unit (`apps/api/src/**/*.test.ts`), packages (`packages/{contracts,localisation}/test`), API integration (`apps/api/test/**`, real SQLite), web unit + integration (`apps/web/src/**`). No E2E spec (`e2e/` catalog only). All web blend tests mock API → zero web test vs live API. Most checkout/promo blend integration tests call services directly, not HTTP; only stale-blend 409 + RulesJourney pay run go over HTTP.

Abbrev: RULES=`apps/api/src/features/customBlend/customBlendRules.test.ts`, RES=`…/customBlendResolver.test.ts`, EV/OPT/JRN=`apps/api/test/customBlend/customBlend{Evaluation,Options,RulesJourney}.integration.test.ts`, CART=`apps/api/test/cart/customBlendCart.integration.test.ts`, CHK=`apps/api/test/checkout/customBlendCheckout.integration.test.ts`, ORD=`apps/api/test/orders/customBlendOrder.integration.test.ts`, REO=`apps/api/test/reorder/reorderRoutes.integration.test.ts`, STATE=`apps/web/src/features/customBlend/customBlendState.test.ts`, PAGE=`…/CustomBlendPage.test.tsx`, EVH=`…/useCustomBlendEvaluation.test.tsx`.

### Covered → E2E can lean on lower layers, don't re-prove arithmetic

- Ingredient structure: 0/5 ingredients, % 0/4/51/5.5, dup, ingredient==base, total 55 rejected; boundaries 5% → base 95, 5+10+15+20 → base 50 → RULES:51,68 (unit only). Contracts: empty, 4%, 20.5%, strict 64-hex configKey → `packages/contracts/test/custom-blend-contracts.test.ts:132`.
- Matrix: full 8×8 directional grid incl. theatrical + absorbents → RULES:142. HTTP: cleaning→food-grade 400 `CUSTOM_BLEND_INCOMPATIBLE` (DE msg, no line written) → EV:154, CART:338; cleaning+pigment, casting+pigment, food+food ok → JRN, EV:273, CHK.
- Pigment cap: unit 5+5 ok, 5+5+1 → `{max 10, actual 11}` → RULES:204. HTTP 6+5 → 400 + meta on evaluate EV:284, create CART:311 (zero lines). Single pigment 10% accepted → JRN:206.
- Base validity on GET /options: nonexistent, inactive variant/product, null group, weight≠25000, sort_order≠1 → 400 → OPT:161-214 (schema only, code not asserted). Bases list excludes pigments/absorbents → EV:60, RES:80.
- Country: CN evaluate w/ blocked base or ingredient → 400 `CUSTOM_BLEND_INVALID`, no "Sports Nutrition" leak → EV:243; CN lists hide Sports Nutrition → EV:207. Unknown ingredient id → `CUSTOM_BLEND_INVALID` → EV:167.
- MOQ: evaluate/create w/o qty → base MOQ → RES:116, EV:312. Create below MOQ → 400 `BELOW_MOQ` meta `{minQuantity}` → CART:359.
- configKey: permutation-insensitive, 64-hex, canonical sorted JSON → RULES:27,99. Same recipe twice (same order) → one line, qty doubled → CART:61. Edit-merge into existing recipe → CART:86. DELETE by configKey keeps plain line → CART:107. Persisted JSON excludes components + qty → CART:194.
- Pricing: per-component tier 400 sacks 50/50 → 5% each → RULES:231, RES:160; 75/25 @400 → tiers [5,0] → CART:240; tier boundaries 1 t/10 t → RULES:271. Fee flat 2500, excluded from discountable → RULES:119, RES:116, CHK:192 (qty 39/40/200/400). Worked example cleaning 90 + pigment 10 @4 → 3600+800, unit 4400, total 20100 → JRN:248. Live reprice on PATCH after ingredient price change → CART:204. Clearance before tier → RULES:297; base-component clearance → CART:407.
- Checkout: ingredient stock 0 doesn't block; allocation/reservation base only → CHK:294, ORD:226. Stale blend (ingredient deactivated) → `/api/payments/pay` 409 `CUSTOM_BLEND_INVALID`, gateway not called, stock/cart untouched → CHK:541, JRN:500-617. Evaluate → cart → pay → quote → order snapshot convergence + idempotent replay → JRN:166-498.
- Promo: SAVE10 gate met by 5 blend sacks, fee outside discount base → CHK:228, ORD:380; `min_subtotal` incl. components, excl. fee → CHK:478. Promo unit arithmetic (fee excluded) → `promoService.test.ts:171,182,219` (synthetic, no blend line).
- Order lifecycle: snapshot freeze (fee, basePercentage, madeToOrder, returnable:false) → ORD:183. Returns: eligibility hides blend, selecting it → 422 `RETURN_NOT_ELIGIBLE`, refund ordinary only → ORD:277,295,310. Cancel (processing) restocks base only → ORD:436. Corrupt snapshot → 500 → ORD:481.
- Reorder: blend carried w/ configKey → REO:470; skips `INSUFFICIENT_STOCK`/`BELOW_MOQ`/`BLOCKED_IN_COUNTRY` w/ resolver price → REO:559,632; ingredient deactivated → `BLEND_UNAVAILABLE` → REO:694. Bulk-add precedence blocked > retired > BLEND_UNAVAILABLE > INVALID_QUANTITY > INSUFFICIENT_STOCK > BELOW_MOQ → `cartBulkAddRules.test.ts:97-187`.
- Account deletion/export w/ blends → `deletion.integration.test.ts`, `dataExport.integration.test.ts`.
- Web (all mocked):
  - Ingredient-pick rebalance → STATE:70-130. Clamp slider 53→50, typed "3"→5, steppers, never >50 total → `RatioEditor.test.tsx:47,72`.
  - Debounce 149 ms no call / 150 ms call; abort superseded; no request for invalid/dup/base-as-ingredient; country header + US→DE reset → EVH:67,95,107,127,207.
  - Evaluate omits qty, add submits evaluated qty → EVH:78, PAGE:340,351. Submit disabled until verdict + "Checking your blend and current price…" → PAGE:326. Pigment-cap alert keeps submit disabled → PAGE:408. Edit mode "Quantity: 7 sacks", replace w/o qty → PAGE:475.
  - Recap composition, no price → `SuccessRecap.test.tsx:43,70`.
  - Fee display US ($15.00 / $30.00 / fee $31.25 / $61.25), Material subtotal / Blending fees split → `CartLineItem.test.tsx:256,267`, `CartSheet.test.tsx:185`, `CheckoutPage.summaryPromo.test.tsx:111,179`. Order detail frozen totals + legacy snapshot copy → `OrderPages.test.tsx:439,508,558`.
  - Two blends same base → independent lines; edit link URL → `CartLineItem.test.tsx:297,306`, `CartPage.test.tsx:175`. Save-as-list disclosure "will not be included" → `SaveCartAsListButton.test.tsx:37`.
  - Entry points nav / deep link / bad baseVariantId → `CustomBlendReachability.integration.test.tsx:299,316,449`.

### Gaps confirmed → E2E/API candidates

- HTTP structural/schema: dup ingredient, ingredient==base, total >50 → `CUSTOM_BLEND_INCOMPATIBLE`; 4%/51%/5.5%/5 ingredients → `REQUEST_INVALID` (unit only, RULES:68).
- Error precedence w/ several errors at once (INVALID > INCOMPATIBLE > cap): no test any layer.
- Pigment cap 5+5 two-pigment split over HTTP.
- Matrix over HTTP beyond cleaning/casting/food: pigment/absorbent as base, absorbent as ingredient, reverse directions, garden/cementitious.
- Base validity on /evaluate, /create, /replace (only /options). Baking Soda null group (only generic null-group check).
- Country-blocked create/replace 404 `VARIANT_NOT_FOUND`: never hit (`cartCountryBlocking.integration.test.ts:156` posts CN header to US cart → 200, persisted cart country wins).
- Evaluate below MOQ → 200 vs create 400: evaluate side untested → code mismatch untested.
- configKey: ingredient-order independence over HTTP; key excludes base + qty.
- Stale edit URL → `customBlend.missingLine` "That custom blend is no longer in your cart.": zero tests API or web.
- Rounding half-up drift (all fixtures round numbers); per-component tier at exact 5 t/10 t over HTTP; clearance on ingredient component.
- Stock: blend + plain line same base at low stock; 10 blend sacks reserve 10 base sacks (only base-only allocation asserted); add/update never checking stock.
- Promo: CLEANFIVE, GARDEN10, SAVE20 w/ blends. `/api/promo/validate` amount w/ blend (ORD:391 asserts 200 only; CHK:507 named "promo validation" but never calls endpoint).
- Price change between cart read and pay quote; "no price changed guard" untested either way. Reorder added-path reprice/`priceChanged` not asserted (skips only).
- Poisoned cart: only GET 404 (CART:520) + adds 404 on corrupt JSON (CART:523-629); PATCH/DELETE/remove untested; web silent new cart only generic (`useCart.test.tsx:251,264`).
- Cancel after partial shipment: no "not cancellable after shipment" test, blend or plain.
- Saved lists drop blends (API), quick order drops blends (API + web), standing order from order w/ blend (only mock w/ `configKey:''`, `standingOrderService.integration.test.ts:89`; `standingOrderService.ts:122` hard-coded `''` is saved-list source path only `[verified]`).
- Invoice/credit w/ non-zero fee; admin orders/refunds/delivery w/ blend; order confirmation page w/ blend; order list rendering blend order.
- Web: page-level Balance evenly (RatioEditor test mocks callback); "Change base" chip hidden in edit mode; add/replace failure → generic cart error + draft preserved; sticky recap; refresh loses draft; preview hides qty (no negative assertion); slider `max=50` attr; 1-minor-unit row-vs-total mismatch; PL decimal comma; any blend rendered non-US (DE only plain lines + evaluation hook); `BlendSummaryAside` no test file.

### Suspected bugs vs tests

- Balance evenly: not locked, not caught (helper correct STATE:233; page wiring untested) → E2E fails until fixed.
- Poisoned cart: API 404 locked as intended (CART:516-629); web silent replacement locked generically (`useCart.test.tsx:251`).
- Tier hint component-sack semantics: locked by 3 tests (see Suspected real bugs).
- Corrupt snapshot 500: locked as intended (ORD:481) → not bug.
- `/api/promo/validate` legacy pricing, README seed mismatch: untouched by tests.
