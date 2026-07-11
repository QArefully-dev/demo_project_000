# Wave 3 — Verification Evidence

- **Section**: wave3
- **Date**: 2026-07-11
- **Base SHA**: `5412e34ea3ef30d3df1ff91cddd15276a6a7c6c5` (w2-b merge)
- **Implementation SHA**: `334c60dff7e3f54e94359e26aad56b5dca80d5c2`
- **Merge SHA**: `30b36210413f179ec89afcf6a135708a9dad79c7`
- **Reviewer**: APPROVED

## Changes

- **Home page** (`features/home/HomePage.tsx`): hero section with SearchBar, category chips, bestsellers from API, sale row filtered by `onSale`, newest arrivals sorted by `newest`. Loading and error states.
- **Header WishlistButton** (`components/WishlistButton.tsx`): wave3 reimplementation conflicted with W2.A dual-purpose button; integration version (W2.A) already satisfies real-count requirement via `useFavourites` hook with `favouriteIds.size`.
- **ToastProvider** (`components/ToastProvider.tsx`): new Toast context with `useToast` hook, auto-dismiss after 4s, accessibility attributes.
- **404 page** (`features/notFound/NotFoundPage.tsx`): catch-all route with polished UI.
- **Layout** (`components/Layout.tsx`): ToastProvider wrapping.
- **Router** (`App.tsx`): NotFound catch-all route added.
- **README**: updated with full features, seeded data, user credentials, promo codes, test payment cards, dev mailbox.
- **High-level plan**: Phase-1 TLDR appended with comprehensive feature summary.

## Verification

| Check      | Result |
| ---------- | ------ |
| typecheck  | ✅ passed |
| lint       | ✅ passed |
| format     | ✅ passed |
| format:fix | ✅ applied (no changes to commit) |
| reset/seed | ✅ passed — all exact-count assertions satisfied |

## Merge Details

- Merged `codex/demo-expansion-wave3` into `codex/demo-project-expansion` with `--no-ff`
- Conflict in `WishlistButton.tsx` — resolved by keeping integration's W2.A dual-purpose implementation
- Post-merge verification all green
