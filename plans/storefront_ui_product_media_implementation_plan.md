# Storefront UI, Product Detail, Media Implementation Plan

Status: Phases 1-2 complete; Phases 3-9 ready for implementation.

Audience: coding agents.

Source direction: `plans/demo_project_high_level_plan.md`.

## Objective

Upgrade current storefront into polished department-store experience. Fix broken product-detail journey. Add reusable image-set system. Keep app deterministic, local-first, Node.js-only, cross-platform.

Primary journey:

`home -> catalog -> product detail -> cart -> checkout`

## Current Findings

- `/products/:id` route exists in `apps/web/src/App.tsx`.
- Phase 1 resolved product-detail hook/state handling and restored card-to-detail navigation.
- `Product` contract exposes single `imageUrl`; no `imageSetId`, gallery, specs, variants, rating summary.
- Seed contains 48 products but only 8 JPEG files. Many unrelated products use wrong image.
- Existing JPEGs: 800x800, 28-146 KB. Resolution acceptable for cards; semantic mismatch causes poor result.
- Home hero has no visual asset. Neutral monochrome tokens and stock shadcn composition produce generic UI.
- Repeated 8-card sections create long page and duplicate products.
- Current `media-use --doctor` fails: `heygen`, `ffmpeg`, `ffprobe` missing.

## Constraints

- Preserve auth, cart, promotions, checkout, payment, orders, favourites.
- Preserve `SAVE10`: 10%, five-item minimum.
- Preserve deterministic reset and seed.
- No runtime network dependency.
- No required account, API key, cloud service after install.
- No Docker.
- Node.js 22 toolchain.
- Windows and macOS support.
- SQLite default database.
- Built-in asset budget: 5-15 MB.
- No Git LFS.
- No committed source-resolution originals.
- No new E2E, browser automation, visual-regression test suite.
- Manual browser QA allowed.

## Target Visual Direction

Style: modern general department store, editorial warmth, clear commerce hierarchy.

- palette: warm off-white canvas, ink foreground, deep blue primary, coral sale accent, restrained green success
- type: Geist body; stronger display sizing and weight contrast
- surfaces: soft borders, low shadows, 12-20px radii, tinted section backgrounds
- density: compact header and cards; generous hero and section spacing
- imagery: consistent clean product photography, neutral warm-gray backgrounds, centered objects, controlled shadows
- motion: 150-200ms hover/focus transitions; no decorative animation dependency
- accessibility: visible focus rings, semantic links/buttons, AA contrast, reduced-motion-safe transitions

## Architecture

Data path:

`SQLite product.image_set_id -> API Product.imageSetId -> web imageSets registry -> ProductMedia component -> local hashed assets`

Fallback path:

`missing image set -> category fallback -> deterministic product SVG -> stable layout`

Media build path:

`source/generate -> media-use ingest + ledger -> sharp conversion -> apps/web/public/images/products -> registry`

Runtime path contains no `media-use`, HeyGen, FFmpeg, remote URLs, or source originals.


## Phase 1: Restore Product Journey — Complete (2026-07-12)

### Files

- `apps/web/src/features/product/ProductPage.tsx`
- `apps/web/src/components/ProductCard.tsx`
- `apps/web/src/App.tsx`

### Tasks

- Move `actionError` hook beside existing top-level state hooks.
- Reset `imgError` and `actionError` when product ID changes.
- Keep loading, missing-product, API-error states stable.
- Wrap product image in link to `/products/${product.id}`.
- Wrap product name in same route link.
- Keep wishlist and add-to-cart controls outside nested links.
- Add visible hover and focus states to linked card content.
- Add `aria-label` only when visible text fails accessible naming.
- Prefer slug route only after API supports stable slug lookup; retain ID route during this plan.

### Exit Gate

- Complete: card image and title navigate to `/products/:id`; wishlist and add-to-cart remain separate controls.
- Complete: product ID transitions reset product/action state; missing-product and API-error states remain distinct.
- Complete: `/products/:id` route already supports direct navigation and SPA refresh through existing router/Vite setup.

### Verification Record

- Passed: web typecheck, lint, unit test, production build, targeted Prettier check, `git diff --check`.
- Note: repository-wide `npm run format` still reports unrelated pre-existing formatting issues.

## Phase 2: Design Tokens and Shared Shell — Complete (2026-07-12)

### Files

- `apps/web/src/index.css`
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/components/CategoryNav.tsx`
- `apps/web/src/components/SearchBar.tsx`
- `apps/web/src/components/ui/*` only when shared primitive change needed

### Tasks

- Replace grayscale-only tokens with target palette.
- Add commerce tokens: `--sale`, `--sale-foreground`, `--success`, `--surface-raised`, `--surface-soft`.
- Add max-width content shell near 1440px; preserve wide-screen breathing room.
- Build two-level desktop header:
  - top row -> logo, wide search, account, wishlist, cart
  - lower row -> category navigation, deals link, trust message
- Keep sticky behavior; avoid content jump.
- Add small mobile/tablet layout without blocking desktop target.
- Remove duplicate home hero search when header search remains prominent.
- Standardize heading, eyebrow, section-link, price, metadata classes through components or CSS utilities.
- Avoid page-specific hard-coded colors when semantic token exists.

### Exit Gate

- Header remains usable at 1280px and wider.
- Header search receives largest navigation emphasis.
- Focus states visible on every header control.
- Layout remains centered at 1920px and 3840px.

### Verification Record

- Passed: root typecheck, lint, web production build, `git diff --check`, targeted Phase 2 Prettier check.
- Manual local review passed: 1280px, 1920px, 3840px, narrow viewport smoke.
- Note: repository-wide format check still fails on 77 unrelated baseline files.

## Phase 3: Product Image Data Model

### Files

- `packages/contracts/src/schemas.ts`
- `apps/api/src/db/connection.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/domains/products.ts`
- `apps/api/src/routes/products.ts`
- new `apps/web/src/data/productImageSets.ts`
- new `apps/web/src/components/ProductMedia.tsx`

### Contract Shape

```ts
const ProductImage = Type.Object({
  src: Type.String(),
  alt: Type.String(),
  width: Type.Number({ minimum: 1, multipleOf: 1 }),
  height: Type.Number({ minimum: 1, multipleOf: 1 }),
});

const Product = Type.Object({
  // existing fields
  imageSetId: Type.String(),
  images: Type.Array(ProductImage, { minItems: 1 }),
});
```

### Tasks

- Add guarded SQLite migration for nullable `image_set_id`.
- Backfill existing rows using deterministic category/product mapping.
- Make `image_set_id` required for new seeded rows after backfill.
- Retain `imageUrl` for one compatibility migration window or replace atomically across all consumers.
- Prefer atomic replacement when repository has no external contract consumers.
- Create typed image-set registry with one to four images per set.
- Resolve API image list from `imageSetId`; avoid storing repeated path arrays in SQLite.
- Add category fallback registry entry.
- Add deterministic unknown fallback.
- Add explicit `width` and `height` to prevent layout shift.
- Add `loading="lazy"` for below-fold card images.
- Use eager/high-priority loading only for visible hero or first detail image.

### Exit Gate

- Every seeded product resolves valid local image set.
- Missing registry key renders fallback, never broken image.
- Catalog and detail use same registry.
- Seed reset remains deterministic.

## Phase 4: Media Sourcing and Conversion

### Scope

Pilot set: 12-20 prominent image sets.

- 1 home hero image
- 4-6 category/editorial images
- 8-12 bestseller or featured product sets
- 2-4 images for flagship detail product

Long tail continues shared generic sets plus deterministic SVG fallback.

### `media-use` Policy

- Use as development-only sourcing, reuse, ingest, provenance ledger.
- Run `--candidates` before fresh resolve.
- Use exact entity match for cross-project reuse.
- Run `--doctor` before resolve.
- Do not make app startup depend on doctor success.
- Do not commit credentials or auth state.
- Review provider usage rights before release.
- Opt out telemetry with `HYPERFRAMES_NO_TELEMETRY=1` when project policy requires.
- If Windows setup remains blocked, source/generate through another approved tool, then ingest with `resolve --from` when available.

### Asset Quality Rules

- square product assets: centered object, uncluttered background, no embedded text, no visible third-party logo
- editorial assets: composition leaves copy-safe area
- coherent lighting and background temperature across set
- no misleading color/variant detail
- no remote URL in seed or registry
- no upscaled low-resolution input
- useful crop at 1:1 and 4:5

### Conversion Tooling

Add `sharp` as root or web-workspace development dependency.

New files:

- `scripts/build-product-images.mjs`
- optional `media-sources.json` ignored from release assets when containing local source paths

Generated outputs:

- thumbnail -> 320x320 WebP, quality 78
- card -> 720x720 WebP, quality 82
- detail -> 1200x1200 WebP, quality 84
- optional detail AVIF -> 1200x1200, quality near 50

Filename pattern:

`{semantic-slug}.{content-hash}.{width}.webp`

### Tasks

- Make conversion script cross-platform; use Node APIs, no shell-specific paths.
- Normalize orientation and strip metadata.
- Use `fit: contain` with stable background when source crop would cut product.
- Generate manifest containing path, width, height, byte size, source ID.
- Fail build on duplicate output name, oversized detail asset, missing required rendition, unsupported source.
- Keep conversion explicit through `npm run assets:build`; do not run during normal `npm install`.
- Add `npm run assets:check` for manifest/file consistency without regeneration.
- Keep normal clone runnable from committed derived assets.

### Exit Gate

- Built-in committed media remains within 5-15 MB.
- No committed full-resolution sources.
- Every prominent product has semantically correct image.
- Every derived asset has stable dimensions and local path.
- Fresh clone runs without sourcing tools or network.

## Phase 5: Product Card Redesign

### Files

- `apps/web/src/components/ProductCard.tsx`
- `apps/web/src/components/ProductGrid.tsx`
- `apps/web/src/components/ProductMedia.tsx`

### Tasks

- Use 4:5 or square media surface consistently.
- Add image zoom or lift on hover; respect reduced motion.
- Clamp product name to two lines.
- Remove description from dense cards or clamp to one short line.
- Show category as quiet eyebrow, not large badge.
- Show sale badge only when discount exists.
- Keep bestseller badge only for curated/high-threshold products.
- Add rating summary placeholder only after real contract data exists.
- Emphasize current price; reduce compare-at-price weight.
- Move stock status near action only when low/out of stock.
- Preserve add-to-cart pending and error states.
- Keep card heights aligned without fixed text-specific heights.
- Tune grid:
  - small -> 2 columns when width permits
  - desktop -> 4 columns
  - wide desktop -> 5 columns only when cards remain at least 230px

### Exit Gate

- Product identity readable before metadata.
- Image, title, price, action hierarchy obvious.
- Repeated cards align across row.
- Interactive elements keyboard reachable and non-nested.

## Phase 6: Homepage Redesign

### Files

- `apps/web/src/features/home/HomePage.tsx`
- new `apps/web/src/components/home/HeroSection.tsx`
- new `apps/web/src/components/home/CategoryTiles.tsx`
- new `apps/web/src/components/home/ProductShelf.tsx`
- new `apps/web/src/components/home/PromoBanner.tsx`

### Target Order

`hero -> trust strip -> category tiles -> bestseller shelf -> promotional banner -> new arrivals shelf`

### Tasks

- Replace empty gradient hero with split editorial layout.
- Add one primary CTA to catalog and one secondary deals CTA.
- Use category tiles with local images and readable overlays.
- Limit initial product shelves to 4-5 items at desktop width.
- Avoid repeating same product across home shelves where practical.
- Add trust strip: local demo-safe messages for delivery, returns, secure simulated checkout.
- Keep truthful wording; do not imply real fulfilment or payment processing.
- Add shelf links to filtered catalog views.
- Preserve loading and error behavior per section.
- Avoid whole-page spinner when one shelf fails after shell loads.

### Exit Gate

- Hero communicates store category and primary action within first viewport.
- First viewport contains hero plus start of category/product content at 1920x1080.
- Home page avoids three identical 8-card grids.
- API failure in one shelf does not hide all successful content.

## Phase 7: Product Detail Redesign

### Files

- `apps/web/src/features/product/ProductPage.tsx`
- new `apps/web/src/features/product/ProductGallery.tsx`
- new `apps/web/src/features/product/ProductPurchasePanel.tsx`
- new `apps/web/src/features/product/ProductDetails.tsx`
- new `apps/web/src/features/product/ProductSpecifications.tsx`
- existing `apps/web/src/components/ProductMedia.tsx`

### Above-Fold Layout

`breadcrumbs -> gallery | purchase panel`

Gallery:

- primary 1:1 image
- thumbnail rail when image count > 1
- selected-image state
- keyboard-operable thumbnail buttons
- no modal zoom during initial pass

Purchase panel:

- category eyebrow
- product name
- rating summary only after backed by data
- price and savings
- concise benefit list
- stock state
- variant controls when contract supplies variants
- quantity selector
- add-to-cart primary action
- wishlist secondary action
- delivery and returns summary

Below fold:

`details -> specifications -> related products`

### Tasks

- Split fetch/state orchestration from presentation components.
- Keep hooks unconditional.
- Add quantity state; pass quantity through cart API only if cart contract supports it. Otherwise hide quantity control until contract slice lands.
- Add sticky purchase panel on tall desktop gallery; disable sticky where viewport height causes clipping.
- Add specifications contract only with real seeded values.
- Do not render fake ratings or reviews.
- Use semantic definition list for specifications.
- Keep related shelf capped at 4-5 products.
- Add breadcrumb category link.
- Add document title update if project has head-management pattern; otherwise defer.

### Exit Gate

- Product page loads from card and direct URL.
- Gallery selection works by mouse and keyboard.
- Add-to-cart works once per click and exposes pending state.
- Out-of-stock product disables purchase action.
- Missing secondary images do not leave empty gallery controls.
- Detail content remains readable at 1920x1080 and 3840x2160.

## Phase 8: Catalog Polish

### Files

- `apps/web/src/features/catalog/CatalogPage.tsx`
- `apps/web/src/components/ProductGrid.tsx`
- optional new `apps/web/src/features/catalog/CatalogSidebar.tsx`
- optional new `apps/web/src/features/catalog/CatalogToolbar.tsx`

### Tasks

- Add result title, count, sort into coherent toolbar.
- Move category and sale filters into desktop sidebar if content density supports it.
- Keep query parameters source of truth.
- Add clear-all action when filters active.
- Use skeleton cards during page/filter transition; preserve previous results when safe.
- Improve empty state with clear filters and catalog CTA.
- Keep page-size and pagination behavior.
- Do not add client-only filters absent from API.

### Exit Gate

- Filter, sort, search, pagination URL state remains shareable.
- Layout does not jump during loading.
- Product-detail navigation remains available from every card.

## Phase 9: Verification

### Static Checks

```powershell
npm run typecheck
npm run lint
npm run format
npm run assets:check
```

Run existing unit and SQLite integration scripts when present.

### Manual Browser Matrix

- 1920x1080 -> home, catalog, product detail, cart sheet
- 1920x1200 -> same routes
- 3840x2160 -> same routes; verify max-width and image sharpness
- narrow viewport smoke check -> header, grid, product purchase actions

### Manual Scenarios

- home -> bestseller card -> product -> add to cart
- catalog filter -> product -> browser back -> filter state preserved
- product with sale price
- product without sale price
- out-of-stock product
- missing image-set registry entry
- image request failure
- cart API failure and retry
- unauthenticated wishlist behavior
- keyboard-only card, gallery, purchase actions
- reduced-motion preference

### Performance Checks

- no remote image requests
- no layout shift from missing dimensions
- no eager loading for below-fold grids
- hero image responsive, not source-sized download
- initial home assets within reasonable local demo budget
- no duplicate large rendition download in same viewport

### Exit Gate

- Static checks pass or unrelated baseline failures documented.
- Browser console has no React hook errors.
- No broken image icon across seeded catalog.
- Core journey works at target desktop sizes.
- Asset budget passes.

## Delivery Slices

Implement as small vertical commits:

1. `fix(web): restore product detail navigation`
2. `feat(web): add storefront design tokens and header shell`
3. `feat(catalog): add shared product image-set contract`
4. `chore(media): add deterministic image conversion pipeline`
5. `feat(web): redesign product cards and home shelves`
6. `feat(web): build product gallery and purchase panel`
7. `feat(web): polish catalog and responsive states`
8. `test(web): verify UI flows and asset integrity`

Each slice must compile independently. Do not mix media binaries, database migration, and broad UI rewrite in one commit.

## Deferred Work

- full 80-150 image-set library
- product variants with SKU-level price and stock
- real ratings and reviews
- image zoom modal
- comparison feature
- recently viewed
- optional high-resolution asset pack
- automated E2E and visual regression coverage
- external CDN or image optimization service

## Completion Definition

- Product detail reachable and stable.
- Home, catalog, product detail share coherent visual system.
- Prominent products use semantically correct polished media.
- Image-set relation matches high-level plan.
- Runtime remains fully local and deterministic.
- Clone-to-running flow unchanged.
- Existing commerce behavior preserved.
- Typecheck, lint, format, asset check pass.
