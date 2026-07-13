# QArefully Powder Co. Rebrand Implementation Plan

Status: ready for implementation

Audience: implementation agent

## Outcome

Convert current electronics department store into `QArefully Powder Co.` without rebuilding commerce engine.

Target journey:

`home -> powder catalog -> powder detail -> cart -> checkout -> payment -> confirmation`

Working brand:

- name: `QArefully Powder Co.`
- tagline: `Anything. Finely considered.`
- promise: `We will powder anything.`
- voice: dry, confident, precise, mildly absurd
- visual direction: industrial apothecary + cheerful commodity packaging
- catalog progression: credible -> questionable -> impossible

Required delivery: Phases 0-6.

Follow-up delivery: Phases 7-8. Keep separate from core rebrand. Do not block rebrand completion on Powderizer.

## Constraints

- preserve React, Vite, Fastify, SQLite, TypeBox, npm workspace architecture
- preserve routes and existing customer journeys unless powder domain requires additive change
- preserve integer minor-unit money handling
- preserve deterministic local behavior and reset
- preserve `SAVE10`: 10% discount, minimum five cart items
- preserve remaining promo, auth, payment, order, favourite, mailbox behavior
- preserve no-Docker, no-account, no-API-key, no-runtime-network requirements
- preserve Windows and macOS support
- preserve unrelated user changes; inspect `git status` before edits
- current dirty file: `plans/catalog_reviews_audit_seed_content_implementation_plan.md`; do not overwrite or reformat
- use loopback HTTP server for browser QA; never use `file://`
- avoid external stock-photo dependency
- avoid real medical, nutritional, or safety claims
- mark household, conceptual, and impossible powders `Not for consumption`
- no broad architecture rewrite

## Keep / Replace Boundary

Keep:

- auth and account flows
- catalog query, filtering, sorting, pagination
- cart state and quantity behavior
- promotions and checkout validation
- simulated payments and idempotency
- orders and confirmation email
- favourites and mailbox
- shared contract validation pattern
- SQLite connection, reset, migration, seed infrastructure
- reusable UI primitives
- current unit and integration test setup

Replace:

- canonical electronics products
- electronics categories and slugs
- product media and hardcoded media maps
- electronics-specific fixtures and assertions
- department-store language
- generic technology-focused brand styling
- hero, category presentation, promotional copy
- README seed summary and product direction plans

Defer until Phase 7:

- custom powder mixes
- weight and fineness variants
- component ratios
- compatibility rules
- custom labels
- custom mix order snapshots

## Phase 0 - Baseline and Change Audit

Goal: establish safe starting point.

Tasks:

- read `README.md`, `CLAUDE.md`, current files under `plans/`
- inspect `git status --short` and `git diff`
- preserve all unrelated edits
- run baseline checks:
  - `npm run assets:check`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run lint`
- record pre-existing failures before changing code
- inspect current storefront through `http://127.0.0.1:5173`
- capture affected-file list before implementation
- search electronics coupling:
  - product names
  - category names
  - hardcoded image-set IDs
  - alt text
  - fixture data
  - README and plan language

Exit criteria:

- baseline state known
- unrelated dirty changes identified
- rebrand file boundary confirmed
- no code changed during audit

## Phase 1 - Brand System and Canonical Catalog

Goal: define one deterministic source for powder identity and content.

Create catalog source separate from seed orchestration. Recommended location:

`apps/api/src/db/powderCatalog.ts`

Each canonical product needs:

- stable numeric ID
- unique slug
- name
- short product-card-friendly description
- price in cents
- compare-at price when on sale
- category
- stock count
- sales count
- image-set ID equal to stable art ID
- package size stated in name or description during pre-variant rebrand
- consumption warning when non-food
- visual tokens used by asset generator:
  - label color
  - powder color
  - icon or short mark
  - batch code

Catalog target:

- 45 products
- 7 categories
- minimum 5 products per category
- mix of credible, playful, and impossible products
- 14 sale products retained unless tests require different exact count
- deterministic bestseller and newest ordering
- no duplicate names, slugs, IDs, image-set IDs

Categories:

- `Pantry Staples`
- `Performance`
- `Drinks`
- `Household`
- `Outdoors`
- `Questionable`
- `Impossible`

Required anchor products:

- protein powder
- powdered oats
- matcha powder
- coffee powder
- cocoa powder
- electrolyte powder
- powdered peanut butter
- powdered campfire
- powdered beach
- powdered house
- powdered Wi-Fi
- powdered five more minutes
- powdered gravity
- powdered water

Content rules:

- credible products anchor trust
- absurdity increases through category order
- descriptions explain use, pack size, and joke within 1-2 sentences
- no repetitive `premium`, `elevate`, `seamless`, `curated`, `revolutionary` filler
- no fabricated health benefits
- no unsafe preparation instructions
- impossible products remain clearly fictional
- humor stays deadpan; no joke-explaining copy
- `Powdered Water` serves as hero bestseller

Add catalog validation near source or seed tests:

- exact canonical count
- unique identifiers
- valid prices and stock
- category allowlist
- sale price greater than current price
- required warnings for non-consumable categories
- image-set ID exists in generated asset manifest

Exit criteria:

- catalog source reviewed as coherent collection
- 45 valid products defined
- anchor products present
- no seed or UI integration yet

## Phase 2 - Deterministic Powder Asset System

Goal: replace external/manual product photography with reproducible bag artwork.

Visual recipe:

- square canvas
- warm neutral background
- resealable standing bag
- large high-contrast label
- product name readable at card size
- category color band
- small `QArefully Powder Co.` mark
- net weight or `conceptual quantity`
- batch code
- powder pile, dust, scoop, or texture cue
- controlled variation in bag material, label position, powder color, and icon
- shared composition without identical-looking catalog grid

Implementation direction:

- generate source artwork locally from catalog visual tokens
- use deterministic SVG composition rendered through Sharp
- keep existing rendition roles: `thumbnail` 320, `card` 720, `detail` 1200
- keep WebP output, content hashing, byte validation, bundle-size validation
- require no ignored local source-photo file
- make `npm run assets:build` fully reproducible from checked-in source
- make `npm run assets:check` validate all generated files
- generate media registry from one manifest
- remove hand-maintained API/web path duplication
- API returns authoritative image metadata
- web consumes contract images; local fallback only handles corrupt or unknown records
- preserve useful alt text: `{product name} powder bag`, not label keyword dump

Likely affected files:

- `scripts/build-product-images.mjs`
- `scripts/product-image-sources.json`
- `media-sources.example.json`
- `apps/web/public/images/products/*`
- `apps/web/src/data/productImageSets.ts`
- `apps/api/src/domains/productMedia.ts`
- asset-related tests

Delete obsolete electronics images only after powder manifest passes checks and no references remain.

Exit criteria:

- 45 image sets generated
- 135 renditions generated
- `npm run assets:build` succeeds without private inputs
- `npm run assets:check` succeeds
- API and web share one authoritative registry path
- catalog grid shows distinct, coherent bags
- no electronics asset references remain

## Phase 3 - Seed and Backend Migration

Goal: serve powder catalog through existing backend without changing commerce behavior.

Tasks:

- import canonical catalog into `apps/api/src/db/seed.ts`
- replace canonical product rows IDs 1-45 in place where safe
- retain users, favourites, promotions, password flows, mailbox seed behavior
- update seeded favourites to named powder products
- retain promo rules and counts
- update seed comments and validation messages
- update product-media resolver for generated powder manifest
- keep category endpoint data-driven
- confirm related products use powder categories
- confirm search matches powder names and descriptions
- verify repeated `npm run seed` remains idempotent
- verify `npm run reset` produces clean powder-only canonical state
- decide old local order handling explicitly:
  - reset path clears electronics snapshots
  - idempotent seed path must not silently corrupt user-created rows
  - canonical row replacement must not delete non-seed products
- add or update seed integration assertions

Backend acceptance scenarios:

- search `water` -> `Powdered Water`
- category `Impossible` -> impossible products only
- bestselling -> deterministic order
- sale filter -> expected sale products
- unknown image-set ID -> safe fallback
- repeated seed -> same canonical counts and IDs
- reset -> no electronics canonical products

Exit criteria:

- API serves powder-only canonical catalog
- seed and reset deterministic
- non-catalog domains unchanged
- backend tests pass

## Phase 4 - Storefront Brand Shell

Goal: make first viewport unmistakably QArefully Powder Co.

Brand changes:

- wordmark: `QArefully Powder Co.` with `QA` visibly intentional
- hero headline: `We will powder anything.`
- hero support: credible powders through impossible powders; concise deadpan copy
- hero CTA: `Shop powders`
- secondary CTA: `Browse impossible powders`
- tagline placement: `Anything. Finely considered.`
- search placeholder: `Search protein, campfire, water...`
- navigation wording: `All powders`, not `All departments`

Visual system:

- replace technology blue with warm paper, dark ink, and one vivid accent
- suggested base: oat/cream background, charcoal text, vermilion or acid-lime accent
- preserve accessible contrast
- use label borders, stamps, batch marks, and measurement ticks as restrained motifs
- avoid generic gradients, glass panels, floating blobs, excessive sparkle icons
- keep layout responsive and familiar as ecommerce
- keep interaction controls visually obvious
- preserve reduced-motion support

Homepage content:

- hero using `Powdered Water` plus 1-2 contrasting bags
- assurance strip rewritten:
  - powdered to order
  - finely packed
  - simulated checkout
- category section renamed `Shop by powder type`
- bestseller shelf renamed `Frequently powdered`
- newest shelf renamed `Fresh from the mill`
- promo banner uses bag-count promotion without changing underlying `SAVE10` rule
- one deadpan process strip allowed: `Choose it -> Powder it -> Bag it`

Likely affected files:

- `apps/web/src/index.css`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/components/CategoryNav.tsx`
- `apps/web/src/components/SearchBar.tsx`
- `apps/web/src/components/home/HeroSection.tsx`
- `apps/web/src/components/home/CategoryTiles.tsx`
- `apps/web/src/components/home/PromoBanner.tsx`
- `apps/web/src/features/home/HomePage.tsx`
- layout/footer metadata files found during audit

Exit criteria:

- brand readable within first viewport
- no technology-store visual cues
- homepage remains usable without joke context
- mobile, 1920x1080, 1920x1200, 3840x2160 layouts remain sound
- homepage component tests updated and passing

## Phase 5 - Catalog, Product, Cart, and Checkout Copy

Goal: carry powder identity through full purchase journey.

Catalog:

- update headings and empty states
- use category colors without relying on color alone
- retain search, category, sale, sort, page-size, pagination behavior
- retain sale and bestseller badges
- add small pack-size cue only when backed by canonical content

Product detail:

- make bag art primary
- retain gallery behavior
- show category, stock, price, sale price, quantity, related products
- add lightweight powder facts from existing description/specification capability
- show `Not for consumption` prominently for non-food categories
- avoid introducing variant schema during this phase
- rename related shelf to `Powders well with` when meaning remains clear

Cart and checkout:

- retain all calculations and API behavior
- rewrite generic item language only where brand value exists
- keep payment simulation disclosure explicit
- keep validation messages direct and accessible
- keep promo requirement exactly five items, not five distinct products or five bags by weight
- update order confirmation and mailbox copy where store name appears

Cross-flow acceptance journey:

`Powdered Water -> favourite -> add 5 bags -> SAVE10 -> checkout -> 4242 4242 4242 4242 -> confirmation -> mailbox receipt`

Failure journeys:

- out-of-stock powder
- expired promo
- minimum-item promo failure
- declined card
- gateway timeout
- unknown product route
- empty search result

Exit criteria:

- full purchase journey uses powder identity
- existing success and failure behavior preserved
- no schema expansion required
- relevant tests pass

## Phase 6 - Cleanup, Documentation, and Rebrand Verification

Goal: finish required rebrand milestone with no electronics residue.

Tests:

- replace electronics fixtures with powder fixtures
- update accessible-name assertions
- retain behavioral intent of existing tests
- add catalog validation tests
- add deterministic asset tests where practical
- do not weaken assertions to make rename pass

Documentation:

- update `README.md` in normal human-oriented prose
- update product name, purpose, category count, seed summary, screenshots if present
- update `plans/demo_project_high_level_plan.md` product direction
- reconcile powder direction with `plans/catalog_reviews_audit_seed_content_implementation_plan.md`
- preserve unrelated uncommitted edits in active plan
- label Powderizer as next additive vertical slice

Residue search:

- search product and UI sources for electronics names
- search alt text and tests
- search generated manifest and asset names
- allow technical `storage`, `power`, or similar words only when powder content requires them
- remove obsolete source-photo setup when deterministic generator replaces it

Verification commands:

- `npm run reset`
- `npm run assets:check`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run lint`
- `npm run format`
- `npm run smoke`

Browser QA:

- start existing dev server through `npm run dev`
- open `http://127.0.0.1:5173`
- inspect home, catalog, product, wishlist, cart, checkout, payment, confirmation, mailbox
- test narrow mobile viewport
- test 1920x1080
- test 3840x2160
- verify focus, keyboard use, loading, empty, error, sale, out-of-stock states
- verify console has no uncaught errors
- stop only server started during implementation

Required milestone exit criteria:

- all checks pass or pre-existing failures documented with evidence
- powder catalog fully replaces electronics catalog
- deterministic powder assets require no local private source files
- first viewport and full checkout journey express QArefully brand
- preserved commerce behavior verified
- unrelated worktree changes preserved

## Phase 7 - Powderizer Domain Slice

Goal: add custom mix capability after stable rebrand.

V1 scope:

- mix 2-5 eligible consumable powders
- choose bag size: 250g, 500g, 1000g
- choose fineness: coarse, standard, fine
- assign integer percentages totaling 100
- optional custom label, maximum 40 visible characters
- server-authoritative price and validation
- anonymous cart support
- immutable order snapshot

V1 exclusions:

- arbitrary user-submitted objects
- generated product imagery per mix
- medical personalization
- subscription billing
- mixing household or impossible powders with consumables
- free-form ingredient creation

Domain rules:

- only products marked mixable may become components
- component percentage: positive integer
- total percentage: exactly 100
- duplicate component IDs rejected or normalized before pricing
- bag grams allocated deterministically; rounding remainder assigned by stable component order
- component stock checked from allocated grams or defined bag-equivalent rule
- price calculated server-side from component proportions + packaging fee
- cart stores configuration and quoted price version
- checkout revalidates price, eligibility, and stock
- order line snapshots component names, percentages, size, fineness, label, unit price
- HTML and control characters rejected from custom label
- idempotent payment preserves one custom order line

Suggested persistence:

- `powder_mixes`
- `powder_mix_components`
- cart-line reference to saved mix or typed purchasable item
- order-line JSON snapshot or normalized snapshot rows, chosen after current order schema audit

Required implementation order:

`migration -> contracts -> pure validation/pricing -> repositories -> cart integration -> checkout revalidation -> API -> focused tests`

Exit criteria:

- backend owns all mix rules and price
- malformed ratios cannot enter cart
- changed product price or stock detected at checkout
- reset and seed support mix schema
- unit and SQLite integration tests pass

## Phase 8 - Powderizer UI Slice

Goal: expose understandable mix builder without weakening standard catalog.

Route:

`/powderizer`

Flow:

`choose powders -> set ratios -> choose bag -> choose fineness -> label -> review price -> add to cart`

UI requirements:

- live ratio total
- add/remove component controls
- accessible numeric inputs
- equal-split helper
- clear incompatible-product explanation
- server quote loading and error states
- summary bag preview using existing label system
- cart line lists mix components and options
- edit action returns saved configuration to builder
- checkout price-change message supports requote
- keyboard-complete flow
- narrow viewport support

Tests:

- valid two-component mix
- 99% and 101% rejection
- duplicate product handling
- incompatible category rejection
- label length and unsafe-character rejection
- price quote failure
- stock change before checkout
- edit existing cart mix
- payment retry with same idempotency key

Exit criteria:

- custom mix completes full purchase journey
- standard products remain unaffected
- accessibility and responsive QA pass
- full verification suite passes

## Final Handoff Format

Implementation agent reports:

- completed phases
- files changed by phase
- schema or seed migration decisions
- asset generation command and output count
- verification commands with results
- browser QA routes and viewports
- remaining electronics residue, if any
- preserved pre-existing changes
- Phase 7-8 status kept separate from required rebrand status

