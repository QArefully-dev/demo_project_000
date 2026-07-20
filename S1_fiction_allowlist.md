# S1 Fiction Sweep Allowlist

Generated 2026-07-20. Classification: compatibility-identifier (ALLOWED) vs customer-visible (REMOVED).

## ALLOWED — Compatibility Identifiers

| Pattern | Location | Reason |
|----------|----------|--------|
| `/api/powderizer/*` routes | `apps/api/src/routes/powderizer.ts`, `apps/api/src/routes/customPowder.ts` | Legacy API path; `/api/custom-powder/*` is canonical dual |
| `/powderizer` redirect | `apps/web/src/App.tsx` | Legacy URL preserved via `<PowderizerRedirect/>` preserving query params |
| `powderizer-nav-link` CSS class | `apps/web/src/index.css`, `navItems.ts`, `CategoryNav.tsx` | Frozen visual contract identifier; not customer copy |
| `powderizer-banner`, `powderizer-gradient-animated` CSS | `apps/web/src/index.css`, `PowderizerBanner.tsx` | Frozen visual contract identifier |
| `--powderizer-*` CSS custom properties | `apps/web/src/index.css` | Frozen contract; referenced by CSS classes |
| `powderizer-gradient-duration`, `powderizer-motion-duration` | `apps/web/src/index.css` | Frozen motion contract |
| `@shop/contracts/powderizer` imports | `apps/web/src/api/*`, `apps/web/src/features/**`, `apps/api/src/**` | Package name for shared transport types |
| `./powderizer.ts`, `../powderizer/` imports | `apps/web/src/features/customPowder/**`, `apps/api/src/routes/customPowder.ts` | Source module paths; not customer-visible |
| `powderizerState.ts`, `powderizerReducer` | `apps/web/src/features/powderizer/**` | Internal state management name |
| `priceVersion: 'powderizer-v1'` | test fixtures, `powderizerState.ts` | Internal version tracking string |
| `'powderizer:history:v1'` localStorage key | `apps/web/src/features/customPowder/PowderMixHistory.tsx` | Legacy local storage key for migration |
| `PowderizerPage`, `PowderizerBanner`, `PowderizerSummary` components | `apps/web/src/features/powderizer/**` | Internal component names; not rendered to customer |

## REMOVED — Customer-Visible Fiction

| Pattern | Location | Action |
|----------|----------|--------|
| `Impossible` category (hero CTA) | `HeroSection.tsx` | Replaced with "Custom blends" linking to `/custom-powder` |
| `Powdered Water` hero bag | `HeroSection.tsx` | Replaced with Protein Powder, Powdered Sugar, Cement Mix |
| `We will powder anything` headline | `HeroSection.tsx` | Replaced with "Powders for food, performance, home and trade." |
| `impossible powders` subcopy + CTA | `HeroSection.tsx` | Replaced with professional support message |
| `Powdered to order` / `Finely packed` | `HomePage.tsx` | Replaced with "Blended to order" / "Professionally packed" |
| `Powder process` (Choose it → Powder it → Bag it) | `HomePage.tsx` | Removed entirely |
| `Frequently powdered` / `Fresh from the mill` | `HomePage.tsx` | Replaced with "Bestsellers" / "Just in" |
| `Powder types` nav aria-label | `CategoryNav.tsx` | Replaced with "Product categories" |
| `All powders` link label | `CategoryNav.tsx` | Replaced with "All products" |
| `Anything. Finely considered.` tagline | `Header.tsx` | Replaced with "Food · Performance · Home · Trade · Simulated checkout" |
| `Questionable` / `Impossible` category bags | `CategoryTiles.tsx` | Replaced with Sports Nutrition, Baking & Pantry, Drinks, Household & Cleaning, Garden & Outdoors, Trade & Creative Materials |
| `Powderizer` menu/nav label | `navItems.ts`, `CategoryNav.tsx` | Replaced with "Custom Powder" |
| `/powderizer` nav/CTA links | `PowderizerBanner.tsx`, `CategoryNav.tsx`, `Header.tsx`, `HeroSection.tsx` | Replaced with `/custom-powder` |
| `/powderizer?edit=` links | `PowderMixCartLineItem.tsx`, `CheckoutPage.tsx` | Replaced with `/custom-powder?edit=` |
| `/powderizer` internal navigation | `PowderizerPage.tsx` | Replaced with `/custom-powder` |
| `Powdered Water` / `Impossible` display data | `BagDesignsPage.tsx` | Replaced with Protein Powder / Sports Nutrition |
| `Powdered Water` in README | `README.md` | Removed |
| `impossible`/`questionable`/`Powdered Water` catalog descriptions | `README.md` | Replaced with credible catalog description |
| `Reverse Process` section | `plans/demo_project_high_level_plan.md` | Removed entirely |
| `live trading and auctions` section | `plans/demo_project_high_level_plan.md` | Removed entirely |
| `7 categories`, `deliberate nonsense`, `comedic` copy | `README.md`, `high_level_plan.md` | Replaced with grounded professional copy |
| `Powderizer` mentions in FAQ | `faqArticle.ts` | Replaced with "Custom Powder" |
| `powderizer-history` FAQ entry ID | `helpContentTypes.ts`, `faqArticle.ts` | Replaced with `custom-powder-history` |
| `powdered-wifi`, `powdered-gravity`, `powdered-silence`, etc. | `dailyRecipe.ts` | Replaced with credible product slugs |
| `Powdered Water` / `Impossible` in test assertions | `HeroSection.test.tsx`, `HomePage.test.tsx`, `CategoryNav.test.tsx` | Updated to match new copy/routes |
| `/powderizer` paths in test routers | `PowderizerPage.test.tsx`, `PowderizerHistoryPage.test.tsx`, `usePowderizerController.test.tsx` | Updated to `/custom-powder` |
| `Good for` concept | `PowderMixHistory.tsx` (via migration), `powderizerCopy.ts` (deleted by P8) | P8 scope |

## NOT REMOVED — Test Fixture Data

Test files using `'Powdered Water'`, `'Impossible'`, `'Questionable'` as mock product/category names in test fixtures are not customer-visible and are out of S1 scope. These test fixtures are:

- `ProductPage.test.tsx`, `ProductGallery.test.tsx`, `ProductCard.test.tsx`, `ProductMedia.test.tsx`, `ProductMedia.packaging.test.tsx`, `ProductPurchasePanel.test.tsx`, `CatalogPage.test.tsx`, `CatalogProductJourney.integration.test.tsx`, `CheckoutPage.test.tsx`, `useProducts.test.tsx`, `AdminReviewModerationPage.test.tsx`, `CompareProductButton.test.tsx`

These will naturally update when the catalog data is migrated as part of the repurposing work (packets P2-P5).
