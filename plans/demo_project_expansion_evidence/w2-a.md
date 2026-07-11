# W2-a — Favourites Evidence

Section: w2-a
State: complete
Base SHA: `aeaa785`
Implementation SHA: `3dce1f7`
Merge SHA: `bfe411c`
Date: 2026-07-11

## Implementation Summary

Implemented favourites domain, API routes, web hook, UI components, and page as specified in the w2-a section of `demo_project_expansion_spec.md`.

### Changed Files

| File | Change Type | Description |
|---|---|---|
| `apps/api/src/domains/favourites.ts` | Modified | Full domain: `listFavourites`, `addFavourite` (INSERT OR IGNORE), `removeFavourite` |
| `apps/api/src/routes/favourites.ts` | Modified | Full routes: GET/POST/DELETE with `requireAuth`, validation, contract mapping |
| `apps/web/src/hooks/useFavourites.ts` | New | Hook: fetch list, optimistic toggle, error rollback, remove product |
| `apps/web/src/components/WishlistButton.tsx` | Modified | Dual-mode: heart toggle (with productId) + header link with count badge |
| `apps/web/src/components/ProductCard.tsx` | Modified | Wiring: WishlistButton integration in card top-right |
| `apps/web/src/features/product/ProductPage.tsx` | Modified | Wiring: WishlistButton with productId |
| `apps/web/src/features/wishlist/WishlistPage.tsx` | Modified | Full page: loading/empty/populated states, remove, add-to-cart, error banner |
| `apps/web/src/components/nav/navItems.ts` | Modified | Wishlist nav enabled (`true`) |

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Authenticated list | ✅ GET /api/favourites with requireAuth, joins favourites + products |
| Idempotent add | ✅ INSERT OR IGNORE; returns true even if already exists |
| Idempotent remove | ✅ DELETE with changes check; returns true or NOT_FOUND |
| Optimistic heart toggle | ✅ Immediate UI update, rollback on API failure |
| Anonymous redirect to login | ✅ WishlistButton navigates to /login preserving originating path |
| Wishlist: list/remove/add to cart | ✅ WishlistPage renders ProductGrid, remove overlay, add-to-cart with error handling |
| ProductCard wiring | ✅ WishlistButton in absolute-positioned top-right corner |
| ProductPage wiring | ✅ WishlistButton with productId prop |
| Toggle persists after reload | ✅ Backed by database favourites table |
| Anonymous user reaches login | ✅ Route guard + WishlistButton redirect |

### Verification

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Passed — all 3 workspaces |
| `npm run lint` | ✅ Passed — no errors |
| `npm run format` | ✅ Passed — all files match |
| `npm run reset` | ✅ Passed |
| `npm run seed` | ✅ Passed — exact counts: products 45, users 3, promos 7, favourites 3 |

### Review

- No blocking findings. Four non-blocking notes (minor interface duplication in domain, response schema declaration, useCallback dependency, optimistic race handling at scale).

### Ownership

- W2.A files owned: favourites domain, routes, hook, WishlistButton, WishlistPage
- Wiring-only touched: ProductCard (+4 lines), ProductPage (+2 lines), navItems (1 boolean)
- No edits under `reference/`, `.cursor/`, or other protected paths
- No later-course spoilers
