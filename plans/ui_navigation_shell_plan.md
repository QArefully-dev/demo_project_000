# UI Navigation Shell + Placeholders — Coding Plan

Status: draft for implementation. Scope: `apps/web` only. No backend changes required.

## Goal

Replace the bare header (logo + Cart button) with a polished top navigation bar for
Shop Qarefully: a category menu backed by real catalog data, plus visually complete
**placeholder** entry points (Search, Account/Login, Wishlist) that look production-grade
but are intentionally inert stubs. Leave clear, additive seams for future course modules.

Reference current state: [Layout.tsx](../apps/web/src/components/Layout.tsx),
[App.tsx](../apps/web/src/App.tsx), [CatalogPage.tsx](../apps/web/src/features/catalog/CatalogPage.tsx),
[CartSheet.tsx](../apps/web/src/components/CartSheet.tsx).

## Constraints (from CLAUDE.md + high-level plan)

- **No tests** of any kind. Not even test-ids added "for later".
- **No leaking future revelations.** Placeholders must be generic shop chrome (Login,
  Wishlist, Search). No copy, route name, filename, or comment that hints at later modules
  (promo internals, shipping/zip, race condition, RBAC, etc.).
- **Additive only.** No refactor of cart/catalog/checkout logic. Header is presentational.
- **Desktop-only polish.** Target `1366x768` and `3840x2160`. No mobile drawer required, but
  the bar must not break or overflow at these widths.
- **Self-documenting.** Component + prop names carry intent; TSDoc only where a stub's
  intentional inertness isn't obvious from the name.
- **First-run reliability.** Everything renders with zero new network calls; categories are
  derived from the products already fetched.

## Design direction

Invoke the `shop-frontend-ui` skill during implementation to lock tokens and pull shadcn
blocks — do not hand-roll primitives. Keep the existing Geist + neutral OKLCH token system
in [index.css](../apps/web/src/index.css); this plan does **not** introduce a new palette.

Header anatomy (single sticky bar, existing `sticky top-0 z-50` treatment kept):

```
[ Logo ]   [ Shop ▾ | Deals | New ]        [ Search… ]  [ ♡ Wishlist ]  [ Account ▾ ]  [ Cart (n) ]
  brand        category nav                    placeholder    placeholder    placeholder    real (existing)
```

- Category nav = the one **functional** new element (drives catalog filtering).
- Search / Wishlist / Account = placeholders: real-looking, keyboard-focusable, but wired to
  a no-op affordance (disabled control or a "Coming soon" popover), never a dead `href="#"`.

## Component inventory

New files under `apps/web/src/components/`:

| File | Role | Functional? |
| --- | --- | --- |
| `Header.tsx` | Composes the whole bar; replaces inline `<header>` in `Layout.tsx` | — |
| `CategoryNav.tsx` | Category links/dropdown; navigates to catalog filtered by category | yes |
| `SearchBar.tsx` | Styled search input, disabled + tooltip/"Coming soon" | placeholder |
| `AccountMenu.tsx` | Account/Login dropdown trigger; menu items inert | placeholder |
| `WishlistButton.tsx` | Heart icon + count badge (count 0), inert | placeholder |
| `nav/navItems.ts` | Single source of nav config (labels, routes, `enabled` flags) | data |

shadcn primitives to add via the skill (not present today — confirm against
[components.json](../apps/web/components.json)): `navigation-menu` **or** `dropdown-menu`,
`tooltip`. Reuse existing `button`, `badge`, `input`, `separator`, `sheet`.

## Category data — no backend work

`category` already ships on every product ([schemas.ts](../packages/contracts/src/schemas.ts),
seed values: Audio, Accessories, Peripherals, Displays). Derive the menu client-side:

1. Add `useCategories()` hook (or a memo inside `CatalogPage`) that reads the products list
   from the existing `useProducts()` and returns the distinct, sorted category set.
2. `CategoryNav` renders "All" + those categories. Selecting one sets a `?category=<name>`
   URL search param (via `useSearchParams`) — shareable, back-button friendly, no new route.
3. `CatalogPage` reads the param and filters the already-fetched products before rendering
   the grid. Empty-category state reuses the existing "No products available" affordance.

This keeps the 5-item promo / cart flow untouched and adds a real, explorable business-ish
rule (category filter) without a server round-trip.

## Placeholder contract (make "inert" explicit + safe)

Each placeholder must:
- Be reachable by keyboard and have an accessible label.
- Signal unavailability honestly: `disabled` state, or a click that opens a small
  "Coming soon" popover — **never** navigate to a broken/empty route.
- Carry a one-line TSDoc noting it is an intentional non-functional placeholder, so an agent
  exploring later doesn't mistake it for a bug.
- Live behind the `enabled` flag in `navItems.ts` so turning a stub into a real feature later
  is a config flip + a route, not a header rewrite.

Do **not** add `/login`, `/account`, `/wishlist`, or `/search` routes yet — a placeholder that
renders nothing is worse than a disabled control. Routes arrive with the real feature.

## Implementation steps

1. **Branch** off `main` (feature branch; do not commit to `main`).
2. **Invoke `shop-frontend-ui` skill**; confirm token system, add `navigation-menu`/
   `dropdown-menu` + `tooltip` shadcn components. Verify `components.json` aliases.
3. **`navItems.ts`** — declare nav config: category source, placeholder entries with
   `enabled: false`, labels, icons.
4. **`CategoryNav.tsx`** — build the functional category menu; wire `useSearchParams`.
5. **Catalog filtering** — add `useCategories()` + `?category=` filter in `CatalogPage`;
   preserve loading/error/empty states already there.
6. **Placeholders** — `SearchBar`, `AccountMenu`, `WishlistButton` as disabled/"Coming soon"
   controls with labels + TSDoc.
7. **`Header.tsx`** — compose brand + `CategoryNav` + placeholders + existing `CartSheet`;
   keep the sticky/backdrop treatment. Handle overflow at `1366` (condense category nav into
   a "Shop ▾" dropdown if links don't fit).
8. **`Layout.tsx`** — swap the inline `<header>` for `<Header />`. `CartProvider` /
   `<Outlet />` structure unchanged.
9. **Polish pass** — spacing, focus rings, hover states, badge alignment, active-category
   highlight; verify Cart badge still reflects count.

## Manual verification (no automated tests)

- `npm run dev`, exercise at `1366x768` and `3840x2160`: bar aligned, no horizontal overflow,
  no wrap.
- Category select filters the grid and updates the URL; "All" clears; back button restores;
  deep-link to `?category=Audio` loads filtered.
- Placeholders are focusable, labeled, and clearly non-functional (disabled / "Coming soon");
  no dead links, no console errors.
- Existing journey intact: add to cart → cart sheet → full cart → checkout → confirmation.
- `npm run lint`, `npm run typecheck`, `npm run format` clean.

## Future seams (documented, not built)

- `navItems.ts` `enabled` flags → flip to activate real Search / Account / Wishlist.
- `?category=` param → natural extension point for pagination / sort / multi-filter (Phase 3
  "boundary inputs").
- `AccountMenu` → drop-in home for auth/session state and RBAC role display later.
- Header composition → room for future promo/announcement bar above it without touching
  page content.
