# Custom Blend UI Uplift — High-Level Plan

Status: draft; direction agreed with user 2026-07-26; not yet decomposed into coding packets
Scope owner: `apps/web` primary; `packages/contracts` + `apps/api` read-path additions permitted where presentation genuinely needs server-owned facts (user widened scope 2026-07-26)
Source complaint: Custom Blend ships correct domain behaviour with placeholder-grade presentation
Predecessor reference: removed powderizer builder (`4577999^`, `5625b7b^`) — visual language to recover, not code to restore

## Direction (user decisions)

- scope -> web-led; contract + API read-path additions allowed where needed (see W0); still no schema change, no migration, no persisted new field, no change to blend identity/eligibility/fee rules
- tone -> premium industrial; iridescent gradient stays feature signature; no novelty (no Randomize / Chaos Mix / joke copy / reaction lines)
- livery -> stays fixed charcoal Custom Blend spec; no buyer-selectable scheme picker; invest in preview richness instead
- landing -> dedicated animated full-width banner block
- priority -> visual quality over simulation realism

## Current State (audited)

- `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> 539 LOC single file; header + `BasePicker` OR `<form>`; zero imagery
- base picker -> `<input type=search>` + `<select>` + `<ul>` of name + button rows; no artwork, price, category, availability; sack eligibility resolved only after click, can fail
- ingredient picker -> flat unfiltered `<ul>` of native checkboxes; no search/sort/group; cap enforced by disabling
- ratio input -> bare `<input type=number w-24>`; no slider, stepper, auto-balance, remaining-budget readout, proportion graphic
- summary -> one `role=status` sentence; no meter, no recap, no fee/price preview
- success screen -> heading + note + two links; no recap, no artwork
- `CustomBlendPackaging.tsx` exists and is correct, but renders only in a 16x16 cart tile; configurator imports it for a copy constant only
- `--custom-blend-*` tokens + `.custom-blend-nav-link` + `@keyframes custom-blend-iridescence` survive in `index.css` -> applied to nav pill only; destination page shares no visual language
- home (`features/home/HomePage.tsx`) -> no Custom Blend string, import, link, tile, or banner
- checkout + order detail -> blend spec as plain muted text; diverges from cart which shows artwork
- packaging system (`components/packaging/`) -> resolver + 4 vessel SVGs + per-category palettes; fully reusable, underused here

## Recoverable Powderizer Devices (keep / drop)

Keep:
- animated iridescent gradient identity shared banner <-> nav <-> page header
- live SVG mix visualization -> ratio-weighted stacked segments inside a vessel silhouette, `width`/`x` transitions at `--custom-blend-motion-duration`
- ratio-total gauge with valid/invalid colour flip and `aria-live` announcement
- zoomable / large generated packaging preview acting as product mockup
- numbered step legends in one scroll column (not paged wizard)
- radio-as-card / tile selection pattern (`has-[:checked]:` styling)
- sticky summary aside on `lg`, two-column shell
- focus choreography: add ingredient -> focus its ratio input; remove -> focus neighbour
- disabled-with-reason guard rails on ineligible options

Drop:
- `Randomize` / `Chaos Mix`, joke `Good for:` copy, ingredient reaction lines, daily-recipe novelty
- bag colour scheme picker + 5 gradient swatch presets
- localStorage history shelf
- debounced live server quote (out of web-only scope)

## Workstreams

### W0 — Contract/API read-path additions (prerequisite for W3/W5/W6)

Verified gap: `packages/contracts/src/customBlends.ts` -> `CustomBlendOption` carries `productId`, `productName`, `productDescription`, `mixingGroup`, `variant` only. `resolvePackagingSpec` (`apps/web/src/components/packaging/packagingSpec.ts:181`) reads `product.category` (vessel + ink + palette + `sub` line), `product.consumptionClassification` (keg tone, hazard), `product.categoryFacts` (grade, hazard, dose, never, yield), `product.name`, `product.id`. `resolveCatalogPackagingPalette` keys on `(category, numeric id)`. Without `category`, no option can render real livery or a real pigment.

- W0.1 required -> add `category` to `CustomBlendOption`; unblocks vessel selection, palette pigment, category badge, artwork thumbnails on base + ingredient tiles
- W0.2 recommended -> add `consumptionClassification` and `categoryFacts` so option artwork matches catalog artwork exactly rather than degrading to neutral/food-bag; omit and the tiles print a downgraded vessel
- W0.3 optional -> a read-only blend price preview (`materialSubtotalCents`, `blendingFeeCents`, resolved unit price, tier/MOQ state) for the configurator summary, so cost appears before add-to-cart without any client arithmetic. Reuse existing pricing rules; new route or extension of the options response, never a new pricing path
- rules: additive fields only; existing consumers unaffected; response still validated against shared schemas; no new persistence, no change to `CustomBlendSnapshot`, config key, or fee semantics
- API-side source is the same catalog record the options service already loads -> repository/mapper extension, not a new query path

### W1 — Feature visual identity

- extend `--custom-blend-*` token block: surface tint, border, gradient border, segment palette hooks; light + dark
- add configurator-scoped component classes to `index.css` mirroring removed `.powderizer-*` set: gradient surface, mix segment transition, legend dot, selectable tile, gauge states
- reduced-motion parity for every animated rule (existing block is the precedent)
- page header adopts gradient eyebrow/rule so nav pill -> page reads as one feature

### W2 — Page architecture

- split `CustomBlendPage.tsx` into feature components (page shell, base picker, ingredient list, ratio editor, mix visualization, packaging preview, summary aside, success recap)
- two-column shell `lg:grid-cols-[minmax(0,1fr)_22rem]`; sticky aside carries preview + gauge + submit
- numbered step legends: 1 base -> 2 ingredients -> 3 ratios -> 4 review
- shadcn primitives (`Card`, `Badge`, `Separator`) + `.content-shell` / `.section-heading` replace raw bordered divs
- skeleton loaders replace bare `Loading …` text lines

### W3 — Base selection

- product cards with packaging artwork thumbnail via `resolvePackagingSpec` + `PackagingArtwork`, category badge, mixing-group label
- grid of cards, not list rows; keep URL as sole target owner (`?baseVariantId=`)
- eliminate the click-then-fail path: mark or exclude products lacking an eligible 25 kg sack before selection where the loaded payload allows; otherwise keep failure inline on the card, not as a page-level alert
- selected base persists as a compact chip with artwork + "Change base material"

### W4 — Ingredient selection + ratio editing

- ingredient tiles with pigment swatch + artwork thumb, search box, category grouping, "n of 4 selected / n remaining" affordance
- ineligible/out-of-stock states rendered as labelled disabled tiles, not bare pills
- ratio row -> range slider + numeric input + stepper, clamped to 5-50, live remaining-budget readout
- "Balance evenly" action across selected ingredients (client-side only; base remainder derived as today)
- total gauge: bar + `aria-live` sentence, success/destructive flip, base share shown numerically and graphically

### W5 — Mix visualization (headline device)

- SVG vessel silhouette (reuse sack geometry language from `KraftSackArtwork` / `WovenSackArtwork`) with clip-path
- base segment + one segment per ingredient, width proportional to percentage, animated on change
- segment colour from `resolveCatalogPackagingPalette` pigment, enabled by W0.1; deterministic hash-hue only as a total-function fallback for unresolved palettes
- legend with colour dot, name, percentage; hover/focus links legend <-> segment
- respects reduced motion

### W6 — Packaging preview

- render `CustomBlendPackaging` large in the sticky aside, live-updating spec band, batch mark, composition label as the spec changes
- click-to-zoom with pointer-tracked transform origin, Escape to reset, `motion-reduce` guard (recover `PowderMixBagPreview` interaction, charcoal livery only)
- same preview repeated on the success screen beside a full blend recap

### W7 — Landing page banner

- new `apps/web/src/components/home/CustomBlendBanner.tsx`, rendered in `HomePage` above the bestsellers shelf
- full-width `rounded-2xl border-2`, animated iridescent background, eyebrow "Custom Blend", headline, one-line body, pill CTA with arrow + hover lift -> `/custom-blend`
- carries a static miniature of the mix visualization or the charcoal sack artwork so the banner previews the actual output
- no hero takeover, no category tile (explicitly out for this pass)

### W8 — Downstream consistency

- checkout `CheckoutSummary` and `OrderDetailView` gain the same small `CustomBlendPackaging` tile + badge the cart already shows
- composition label surfaces base percentage (currently never printed anywhere)
- replace hardcoded amber made-to-order utilities with a token-backed notice style used identically in cart, checkout, order

## Out of Scope

- migrations, schema change, seed change, new persisted field
- persisted buyer-chosen livery, saved blends, blend naming, history shelf
- client-side money arithmetic; any displayed money comes from a server response (W0.3 if a preview is wanted)
- pallet bases, buyer-selectable packaging, changes to eligibility/ratio/fee rules
- write-path API change; W0 is read-path only
- mobile/tablet layouts (1080p only per repo QA scope)

## Invariants To Hold

- money, eligibility, MOQ, tier, inventory stay server-authoritative; UI never computes prices
- URL remains sole owner of base + edit target (`R8-STATE-001` regression risk)
- config key / canonical spec unchanged; presentation must not touch identity hashing
- edit mode keeps base + quantity locked
- packaging artwork stays web-side; `ProductPackaging` contract stays unpopulated
- accessibility: every new control keyboard-operable, gauge announced via `aria-live`, disabled options carry a reason

## Risks

- R1 sprawl -> `CustomBlendPage.tsx` split is a prerequisite for every other workstream; sequence it first
- R2 contract surface -> W0 widens a shared transport type; every existing `CustomBlendOption` consumer, API route schema, and options test must move together, and contract tests (84) gate it. Land W0 as its own packet before any web workstream depends on it
- R3 test churn -> `CustomBlendPage.test.tsx` (554 LOC) + `CustomBlendPackaging.test.tsx` + reachability integration test are structure-coupled; treat as characterization suite, update alongside each split
- R4 motion -> three animated surfaces (nav, banner, mix segments) risk visual noise; single shared duration token and reduced-motion parity are mandatory
- R5 novelty creep -> earlier "crazy stuff" removal is precedent; any playful copy is a rejected direction

## Suggested Sequencing

1. W0 (contract/API fields) -> independent, land first; W0.3 preview can trail
2. W1 + W2 (identity + page split) -> unblocks every web workstream
3. W3 + W4 (selection + ratios) in parallel with W5 (visualization), after W0 + W2
4. W6 (preview) depends on W5 layout slot
5. W7 (banner) independent; can land any time after W1
6. W8 (downstream) last

Exit gate per web workstream: `npm run typecheck`, `npm run lint`, `npm test -w @shop/web`, plus a `browser-qa` 1080p screenshot of the affected surface.
Exit gate for W0: `npm test -w @shop/contracts`, `npm test -w @shop/api`, `npm run typecheck` across workspaces.
Final gate before handoff: `npm run reset` then `npm run verify`.
