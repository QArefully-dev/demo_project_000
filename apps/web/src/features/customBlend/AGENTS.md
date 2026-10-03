# Custom Blend (web)

Configurator at `/custom-blend` (`apps/web/src/App.tsx`, no route guard); reached from `components/CategoryNav.tsx` (`components/nav/navItems.ts`), `components/home/CustomBlendBanner.tsx`, and cart edit link. API calls in `apps/web/src/api/customBlends.ts`.

## Architecture

- `customBlendState.ts`: draft reducer (`target-changed`, `edit-loaded`, `ingredient-toggled`, `ingredient-removed`, `percentage-changed`). `customBlendValidation` returns localisation keys only.
- `useCustomBlendEvaluation.ts`: 150 ms debounce -> POST `/api/custom-blends/evaluate`. Request key = country + draft + quantity + edit key; superseded results hidden and aborted. Keeps only coded error (`code` + `meta`).
- Displayed totals, fee, food/non-food verdict, handling note come from evaluation response (`BlendSummaryAside.tsx`, `CustomBlendPackaging.tsx`).
- `CustomBlendPackaging.tsx` helpers also used by `components/CartLineItem.tsx`, `features/checkout/CheckoutSummary.tsx`, `features/orders/OrderDetailView.tsx`; they handle both resolved and legacy snapshots.
- Copy: `@shop/localisation/messages/customBlend` plus `cart.customBlend.*`, `checkout.customBlend.*`, `order.customBlend.*` keys.

## Flows

Configure and add; `CustomBlendPage.tsx` (URL params `baseVariantId`, `editConfigKey`)
- `BasePicker` -> GET `/api/custom-blends/bases` -> base chosen -> GET `/api/custom-blends/options?baseVariantId` (refetched on country or base change; request id + `AbortController`) -> draft edits -> live evaluation -> submit -> `useCart.addCustomBlend` (`apps/web/src/hooks/useCart.ts`) -> POST `/api/cart/:cartId/custom-blends` with server-evaluated quantity -> `SuccessRecap` uses returned line's `configKey`.
- `handleSubmit` returns early unless `hasExactEvaluation` (evaluated snapshot matches current draft exactly).
- Rejection: alert + retry in `BlendSummaryAside`, translated by code via `apiErrors`; reducer state untouched so draft is preserved.

Edit existing line; `components/CartLineItem.tsx` link `/custom-blend?baseVariantId=<base>&editConfigKey=<key>`
- Page finds cart line by base + `configKey` -> dispatches `edit-loaded` once per target (`hydratedTargetRef` blocks cart refresh overwriting edits); quantity locked to line quantity; base chip hidden.
- Submit -> `useCart.replaceCustomBlend` -> PUT `/api/cart/:cartId/custom-blends` with old `configKey`, no quantity; server replaces line.
- URL owns target: changing base or key dispatches `target-changed` and discards draft. Missing line -> `customBlend.missingLine`.

## Testing

- Colocated vitest tests per component; `CustomBlendReachability.integration.test.tsx` covers nav entry, deep links, evaluation-driven submit gating.

## Pitfalls

- `isDraftOnCurrentTarget` guard in `CustomBlendPage.tsx` must gate evaluation and submit: without it a replace keyed on stale `editConfigKey` overwrites a different line, or a recipe other than the priced one is submitted.
