# Custom Blend — Planner Handoff

Status: product decisions agreed 2026-07-25 via grilling session. Not coding plan.
Next: planner agent investigates code, writes coding plan.
Owner decision: user. Decisions below are settled unless listed under `Open`.

Customer-facing name: `Custom Blend`. Internal/project name used during design: `Custom Ingredients`.

## Concept

Buyer picks base lot -> adds ingredients at ratios -> one configured cart line.
Ingredients displace base material; line weight fixed by sack count.
Value proposition: spec the material. NOT "order small" (that was retired item 11).

## Item 11 completion

Item 11 complete. Retired mixing code, transport, routes, help, persistence, and generated output are physically deleted by migration `021`.
No salvage. Mixing-group compatibility is greenfield against the new model.

- CSS: `.custom-blend-nav-link` tokens and keyframes are retained for Custom Blend.
- Nav slot: retired entry's slot is reserved for Custom Blend, not item 12 (Buy Again).

Custom Blend is a new high-level-plan item (suggest item 16).

## Settled decisions

Entry point:
- separate destination page, reached from nav. Replaces `Custom Small Order` nav button, inherits its colours
- page step 1 = searchable lot picker (same search + category filters as catalog); ingredients unlock after base chosen
- page must accept preselected base lot from URL -> enables later "customise this lot" entry from lot detail without reworking flow

Scope:
- all 6 categories eligible as base lots

Ingredient eligibility:
- ingredients may come from ANY category, gated by `mixingGroup` (food-grade with food-grade, cementitious with cementitious, never across)
- category is navigation only; `mixingGroup` is the rule
- ingredient picker sorts by mixing group, not category
- handoff's earlier "5 additives per category = 30" framing is DROPPED
- `mixingGroup` real distribution -> food-grade 54, garden-treatment 15, cleaning 13, cementitious-materials 7, pigments 4, casting-materials 3, absorbents 3. `theatrical-effects` has 0 lots -> unusable, drop from usable set

Ingredient identity:
- ingredients are references to REAL catalog lots (name, mixing group, description from catalog entry)
- no standalone ingredient entity, no invented ingredient vocabulary

Ratio rules:
- base stays majority: ingredients total <= 50%
- max 4 ingredients per spec
- each ingredient >= 5%
- whole percent steps
- base is the remainder, not an entered value
- smallest legal line 4 sacks = 100 kg -> 1% = 1 kg

Pricing:
- base material priced at base lot `£/tonne` for FULL line weight
- plus flat blending charge per configured line, independent of ingredient contents
- ingredient cost NOT passed through; charge never negative
- qty-break tier applies to base material weight; fee sits outside -> nothing compounds

Stock:
- ingredients do NOT touch inventory. Treated as always-available blending stock
- base lot draws stock normally as any variant line
- accepted consequence: lot can show sold out as a lot yet remain specifiable as an ingredient. Highest-risk tester-reported-defect surface in this feature

MOQ:
- blend line inherits base lot MOQ unchanged (default 4 sacks). No blend-specific minimum

Cart / checkout / order display:
- line title = base lot name; ingredient breakdown ALWAYS visible beneath -> `Portland Cement — 15% Silica Sand, 5% Iron Oxide Red`
- no buyer-supplied spec name field (revisit when item 13 Saved Lists lands)
- configured lines carry distinct colour treatment vs stock lines

Packaging artwork:
- single fixed custom-spec livery for every blend (industrial: charcoal ground, spec band, batch marking). Not buyer-chosen, not composition-derived
- vessel SHAPE still resolved by category as today (kraft sack, food bag, woven PP sack, HDPE keg)
- deliberate contrast with retired buyer-selected neon gradients -> same special-scheme idea, professional execution

Cart editing:
- blend spec IS editable after add -> edit action on line reopens configurator preloaded, save replaces line
- rationale: most common correction is one ratio; also required so item 12 Buy Again stays useful for blend lines

Returns:
- blends NON-RETURNABLE, made to order
- marked at configure time, at checkout, and on the order
- existing returns model already per-line with `eligibleLines` + 30-day window -> blend lines simply never become eligible

## Open — planner or user must resolve

- cancellation of blend lines: normal rules until dispatch VS non-cancellable once paid. Session ended before decision. Recommendation was normal rules (non-returnable already carries made-to-order meaning; second rule doubles explanation burden at worst moment)
- blending fee shape: flat per configured line VS per tonne
- blending fee vs promotions: does fee enter discountable subtotal. Precedent -> `checkoutQuote.ts:59` computes `subtotal - discount + freight`, freight sits OUTSIDE discountable subtotal
- promo item-count: blend line sacks count toward `SAVE10` five-item gate as normal sacks (assume yes; confirm — course behavior is protected)
- price staleness / requote behavior for a configured line held in cart across a price move
- internal feature/directory name: match customer-facing `Custom Blend`, or keep `Custom Ingredients`. Note: repo just deleted a feature whose internal name diverged from its customer name
- Custom Blend help article

## Deferred to planner — technical, user declined to decide

Line identity in cart. Suggestion only, planner may overrule:
- config on the variant-keyed `cart_line_items` row, widen unique key `(cart_id, variant_id)` -> `(cart_id, variant_id, config_key)`, `config_key = ''` for plain lines, deterministic hash of `{ingredientId, ratio}[]` for configured
- gives dedup for free (identical spec re-add merges quantities) and avoids a second line kind through checkout/orders/returns
- cost: migration rebuilds `cart_line_items`; every variant-keyed cart signature (repository, service, routes, web `useCart`) gains config key

Ingredient allowlist storage. Suggestion only:
- curated allowlist of catalog VARIANTS owned by `packages/catalog` static content, projected by seed onto a variant column, enforced by `validateCatalog`
- mirrors existing `mixingGroup` pattern (`packages/catalog/src/model.ts` -> `products.mixing_group` via `seed.ts`)
- ingredient must reference `variant_id` not `product_id` -> migration `018` moved purchasable/reservation identity to variant

## Code facts verified during session

- `cart_line_items` currently `UNIQUE (cart_id, variant_id)`; cart addresses lines by variant id, not line id
- latest migration is `021`; Custom Blend requires a new migration after it
- catalog already contains every named example ingredient -> `Silica Sand`, `Portland Cement`, `Hydrated Lime`, `Dry Pigment - Iron Oxide Red`, `Whey Protein Isolate`, `Pea Protein Isolate`
- Baking & Pantry lots are ingredient-shaped (`Powdered Sugar`, `Cocoa Powder`, `Vital Wheat Gluten`, `Cornstarch`, `Instant Yeast`)
- Drinks (15 finished mixes) and Household & Cleaning (15 finished cleaner powders) have NO same-category ingredients -> reason cross-category eligibility was required

## QA surface

- ingredient total exceeds 50% cap; exactly 50% passes
- ingredient below 5% floor; exactly 5% passes
- 5th ingredient rejected
- ingredient mixing group incompatible with base
- ingredient lot sold out but still specifiable (accepted asymmetry)
- MOQ floor on a blend line at exactly one sack below minimum
- blend line crosses qty-break tier boundary; fee must not compound with tier discount
- blend line excluded from returns while stock lines in same order remain eligible
- edit blend in cart -> spec replaced, quantity preserved
- base lot retired (`active = 0`) while blend held in cart
- fresh reset reaches migration `021` with no retired mixing persistence

## Constraints carried in

- backend owns money, stock, ratio validation. Money in integer minor units
- must read from UI alone, no explanatory copy -> rule that killed item 11
- persisted checkout quote remains V6; no legacy quote parser path
- deterministic seed/reset; no new dependency without justification
- use new, feature-specific identifiers; do not restore retired names

## Verification

`npm run format` -> `npm run typecheck` -> `npm run lint` -> `npm test` -> `npm run reset` -> `npm run verify`.
Customer journey: nav -> Custom Blend -> pick base -> add ingredients -> cart -> checkout -> order detail.
