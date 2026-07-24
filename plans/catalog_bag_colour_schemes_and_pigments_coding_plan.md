# Catalog Bag Colour Schemes and Pigments Coding Plan

Status: proposed

## Objective

Give every canonical catalog product a deterministic packaging colour scheme and visible pigment
accent. Define exactly five schemes for each of the six catalog categories and distribute all five
schemes across the products in each category.

This applies to every current packaging vessel:

- food bag: Sports Nutrition, Baking & Pantry, Drinks;
- HDPE keg: Household & Cleaning;
- woven sack: Garden & Outdoors;
- kraft sack: Trade & Creative Materials.

## Repository Findings

- Before commit `5625b7b` (`Remove crazy stuff (#6)`), every catalog record authored
  `packaging.labelColor` and `packaging.powderColor` with `createPackaging(...)`.
- That catalog replacement removed authored packaging from `packages/catalog`. The current
  `apps/api/src/mappers/product.ts` intentionally omits `packaging` from normal list/detail
  responses, and `apps/api/src/db/powderCatalog.ts` keeps the old colour columns only as legacy
  seed compatibility placeholders.
- `packages/contracts/src/products.ts` still exposes optional `ProductPackaging`; current
  `ProductMedia` correctly gives an explicit payload precedence when one is supplied.
- `BagArtwork` still contains the old pigment visual: two ellipses filled by `powderAccent`.
  However, current list products have no `powderColor`, and the in-progress food fallback assigns
  one static accent/powder pair to an entire category.
- The three heavy-duty renderers use one fixed ink pair per category from
  `apps/web/src/components/packaging/svgText.ts`. They do not currently receive or draw a pigment
  colour.
- Canonical product IDs are positive integer strings on the wire. Using
  `(Number(product.id) - 1) % 5` currently exercises all five indices in every category, including
  all 15-product categories.
- The working tree already contains active edits to `ProductMedia.tsx` and its tests from the
  catalog UI regression work. Implement this plan on top of those edits; do not replace or revert
  them.

## Decisions and Invariants

1. Keep this feature in the web presentation layer. Do not add a migration, seed columns, API
   fields, or a required transport property for decorative artwork colours.
2. Preserve `product.packaging` as the highest-priority compatibility override. Its
   `labelColor`/`powderColor` must render unchanged.
3. For normal canonical products, resolve a palette from `category` and numeric `id`. The same
   product must render the same scheme in cards, gallery, cart, comparison, and after reset.
4. Each category owns exactly five schemes. Do not share a single global five-colour table.
5. A scheme contains:
   - `key`: stable kebab-case identifier;
   - `ink`: dark primary colour used for the label/band/printed decoration;
   - `pigment`: secondary material colour used by the pigment sample.
6. Keep safety colours separate from decorative schemes. Existing `alert` colours and corrosive
   danger treatments must not vary with the selected scheme.
7. Unknown categories and invalid/non-numeric IDs remain unresolved and continue to the generic
   artwork fallback. Do not invent random colours.
8. Pigment artwork is decorative. It must be `aria-hidden` and must not change the accessible
   product/vessel label.
9. Do not alter vessel selection, geometry, product facts, pack sizes, prices, MOQ, routes, or the
   five user-selectable Powderizer schemes in `powderMixBagScheme.ts`.

## Palette Matrix

Create the following exact scheme records. `ink` values are deliberately dark enough for existing
white label text and light vessel surfaces.

| Category | Key | Ink | Pigment |
|---|---|---:|---:|
| Sports Nutrition | forest-mint | `#3f635b` | `#b8d8c0` |
| Sports Nutrition | navy-sky | `#304b6a` | `#a9cbe8` |
| Sports Nutrition | plum-berry | `#5c426d` | `#d6a6c9` |
| Sports Nutrition | burgundy-rose | `#6a3e46` | `#d8a7a9` |
| Sports Nutrition | bronze-oat | `#6b5538` | `#d8c59b` |
| Baking & Pantry | rust-flour | `#7a4a2d` | `#e8dcc1` |
| Baking & Pantry | cocoa-cacao | `#563b32` | `#8d654f` |
| Baking & Pantry | olive-pistachio | `#59613b` | `#c9d19c` |
| Baking & Pantry | plum-berry | `#684453` | `#d2a0af` |
| Baking & Pantry | navy-corn | `#3e536b` | `#e7cb77` |
| Drinks | teal-aqua | `#24606d` | `#a9d8db` |
| Drinks | espresso-latte | `#4a352f` | `#a67c62` |
| Drinks | berry-blush | `#6b3859` | `#d79ab8` |
| Drinks | citrus-leaf | `#4e6034` | `#d9d56e` |
| Drinks | indigo-ice | `#3d4674` | `#a7b8e3` |
| Household & Cleaning | navy-foam | `#1b4a68` | `#a9dce8` |
| Household & Cleaning | teal-mint | `#245c59` | `#a7d5cd` |
| Household & Cleaning | violet-lilac | `#4f4770` | `#c2b8df` |
| Household & Cleaning | charcoal-mist | `#3e4648` | `#c5cfd0` |
| Household & Cleaning | pine-sage | `#315846` | `#b3d1b6` |
| Garden & Outdoors | forest-leaf | `#2c5130` | `#9ebb72` |
| Garden & Outdoors | earth-straw | `#5a4530` | `#c7a46a` |
| Garden & Outdoors | moss-seed | `#475638` | `#a8b486` |
| Garden & Outdoors | clay-terracotta | `#6a4638` | `#c98565` |
| Garden & Outdoors | slate-eucalyptus | `#3e5550` | `#9bc2b4` |
| Trade & Creative Materials | charcoal-mineral | `#26292c` | `#e8e6df` |
| Trade & Creative Materials | oxide-red | `#623a30` | `#b5543c` |
| Trade & Creative Materials | ultramarine-blue | `#293f6b` | `#5878c5` |
| Trade & Creative Materials | yellow-ochre | `#624f28` | `#c89b3c` |
| Trade & Creative Materials | mineral-green | `#345448` | `#73a68e` |

The numeric assignment intentionally gives the known Trade pigment products useful samples:
Titanium White (`id=36`) -> charcoal-mineral, Iron Oxide Red (`37`) -> oxide-red, Ultramarine Blue
(`38`) -> ultramarine-blue, and Yellow Ochre (`49`) -> yellow-ochre.

## Implementation Plan

### 1. Add a pure category palette registry and resolver

Files:

- Add `apps/web/src/components/packaging/catalogPackagingPalettes.ts`.
- Add `apps/web/src/components/packaging/catalogPackagingPalettes.test.ts`.

Steps:

1. Define `CatalogPackagingPalette` with readonly `key`, `ink`, and `pigment`.
2. Define a local union for the six recognized catalog category names. Do not import
   `@shop/catalog` into the web app; that would violate the current dependency direction.
3. Export `CATALOG_PACKAGING_PALETTES` as a category-keyed record whose values are typed
   five-entry tuples. Enter the palette matrix above verbatim.
4. Export
   `resolveCatalogPackagingPalette(product: Pick<Product, 'id' | 'category'>)`.
5. Return `undefined` for an unknown category, an invalid positive-integer ID, or a missing palette.
   Otherwise select `palettes[(Number(id) - 1) % 5]`.
6. Keep the resolver pure: no randomness, clock, browser storage, module mutation, or array-order
   dependence from an API response.

Tests:

- Assert the registry has exactly six categories and exactly five entries per category.
- Assert keys and `(ink, pigment)` pairs are unique within each category.
- Assert repeated resolution of a product is identical.
- Assert five current canonical IDs per category cover all five indices:
  Baking `1-5`, Sports `8-12`, Drinks `14-18`, Household `20-24`, Garden `27-31`, and Trade
  `33-37`.
- Assert unknown categories and invalid IDs return `undefined`.
- Pin the four Trade pigment mappings listed above to prevent accidental reassignment.

### 2. Feed the selected scheme into food and heavy-duty packaging

Files:

- Modify `apps/web/src/components/ProductMedia.tsx`.
- Modify `apps/web/src/components/packaging/packagingSpec.ts`.
- Modify `apps/web/src/components/packaging/svgText.ts` only to retain category safety defaults;
  do not expand `INKS` into the 30 decorative schemes.
- Extend `apps/web/src/components/ProductMedia.packaging.test.tsx`.
- Extend `apps/web/src/components/packaging/packagingSpec.test.ts`.

Steps:

1. Add required `schemeKey` and `pigment` fields to `PackagingSpec`. Update all hand-authored test
   fixtures at compile time rather than making canonical rendering silently accept missing values.
2. In `resolvePackagingSpec`, resolve the product palette once. For recognized canonical products:
   - set `spec.schemeKey` from the palette;
   - set `spec.pigment` from the palette;
   - set `spec.ink.ink` from the palette;
   - keep `spec.ink.alert` from the existing category `INKS` entry.
3. Retain a neutral internal fallback only for the unresolved `food-bag` spec used before the
   generic image branch. Unknown products must still render the generic fallback in `ProductMedia`.
4. Refactor the in-progress `FOOD_BAG_DESIGNS` table so it contains only category metadata
   (`mark`, printed category, quantity). Move accent/pigment choice to the palette resolver.
5. Extend `resolveFoodBagArtwork` to accept `id`. For known food categories, return:
   - `accent = palette.ink`;
   - `powderAccent = palette.pigment`;
   - the resolved `schemeKey`;
   - the existing stable mark, category, quantity, and batch code.
6. Keep the branch order in `ProductMedia`: explicit `product.packaging` first, resolved non-food
   vessel second, derived food artwork third, generic fallback last.
7. Correct old test fixtures such as `id: 'powdered-water-1'` to valid positive integer strings
   where the new canonical resolver is exercised.

Tests:

- Five food products in one category resolve five distinct scheme/pigment pairs.
- The same ID in different categories resolves through that category's own palette.
- A supplied `product.packaging.labelColor` and `.powderColor` still win exactly.
- Non-food specs vary their decorative ink/pigment while retaining the same category alert colour.
- Existing unknown-category fallback and vessel-selection tests remain green.

### 3. Render pigment accents in every vessel

Files:

- Modify `apps/web/src/components/BagArtwork.tsx`.
- Modify `apps/web/src/components/packaging/PackagingArtwork.tsx`.
- Modify `apps/web/src/components/packaging/KraftSackArtwork.tsx`.
- Modify `apps/web/src/components/packaging/WovenSackArtwork.tsx`.
- Modify `apps/web/src/components/packaging/KegArtwork.tsx`.
- Extend `apps/web/src/components/packaging/PackagingArtwork.test.tsx`.

Steps:

1. Add optional `schemeKey` diagnostics to `BagArtwork` and expose
   `data-colour-scheme="<key>"` on the root SVG for deterministic tests and browser inspection.
   Do the same on each heavy-duty root SVG using `spec.schemeKey`.
2. Keep the food bag's existing powder ellipses and fill them from the resolved pigment. Add a
   `data-pigment="<hex>"` attribute to that decorative group; do not change its geometry.
3. Add one compact, non-text pigment sample to each heavy-duty vessel, filled by `spec.pigment`:
   - kraft sack: a small outlined circular material chip in the blank area between the header rule
     and product title;
   - woven sack: a small outlined chip beside the LOT/coverage panel without covering text;
   - keg: use a small outlined chip in the white label panel; do not recolour the danger stripe,
     hazard pictogram, or `DANGER` band.
4. Mark each sample `aria-hidden="true"` and `data-pigment="<hex>"`. It must not add a text label
   or new accessible node.
5. Keep backgrounds, vessel outlines, patterns, and all safety copy unchanged. The scheme's dark
   `ink` may replace existing decorative/category ink; `alert` remains safety-owned.
6. Pass `schemeKey` through `PackagingArtwork` to `BagArtwork`. Explicit legacy packaging may omit
   the diagnostic key because its colours did not come from this registry.

Tests:

- Every vessel root exposes the expected scheme key for a resolved canonical spec.
- Every vessel contains one pigment-marked group with the expected fill.
- Food bag tests still observe the existing powder ellipses.
- Decorative `ariaLabel=""` behavior remains unchanged.
- Corrosive and mild keg assertions remain unchanged; scheme selection never removes or recolours
  required hazard elements.
- Independently rendered SVG IDs remain unique.

### 4. Add catalog-surface regression coverage

Files:

- Extend `apps/web/src/components/ProductMedia.test.tsx`.
- Extend one existing catalog journey test, preferably
  `apps/web/src/features/catalog/CatalogProductJourney.integration.test.tsx`.

Steps:

1. Render representative products from all six categories and assert the correct vessel plus a
   non-empty `data-colour-scheme` and `data-pigment`.
2. Render five canonical IDs from one category together and assert five distinct scheme keys.
3. In the catalog journey, assert two products from the same category can visibly resolve to
   different scheme keys. Do not test colour by screenshot alone.
4. Retain a focused assertion that the same product card and product gallery use the same scheme.

## Verification

Use the repository-pinned Node 22 runtime before running commands:

```powershell
$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH
node --version
```

Run focused checks:

```powershell
npm exec -w @shop/web -- vitest run --configLoader runner src/components/packaging/catalogPackagingPalettes.test.ts
npm exec -w @shop/web -- vitest run --configLoader runner src/components/packaging/packagingSpec.test.ts
npm exec -w @shop/web -- vitest run --configLoader runner src/components/packaging/PackagingArtwork.test.tsx
npm exec -w @shop/web -- vitest run --configLoader runner src/components/ProductMedia.test.tsx src/components/ProductMedia.packaging.test.tsx
npm run typecheck -w @shop/web
npm run test:unit -w @shop/web
npm run lint
```

Then run the repository gate:

```powershell
npm run verify
```

Manual loopback verification:

1. Start the normal dev server and open `http://127.0.0.1:5173`; never use a `file://` preview.
2. Browse all six category pages and confirm five schemes recur deterministically within each.
3. Check catalog cards, comparison, cart, and product gallery for scheme consistency.
4. Confirm pigments are visible but do not cover product, quantity, hazard, lot, dose, or PPE text.
5. Confirm corrosive keg danger red remains unchanged across all five Household & Cleaning
   schemes.

## Acceptance Criteria

- All six categories define exactly five category-specific schemes.
- Every canonical product deterministically receives one scheme and a pigment accent.
- All five schemes appear in every current category.
- Food bags, kraft sacks, woven sacks, and kegs expose the selected scheme and pigment visually.
- Existing explicit `ProductPackaging` colours still take precedence.
- Safety alert colours and hazard semantics do not vary with decorative palettes.
- Unknown/legacy categories still use the generic artwork fallback.
- No database, API contract, seed, pricing, inventory, route, or Powderizer-scheme behavior changes.
