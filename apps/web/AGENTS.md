# apps/web

## Architecture

- API access: `src/api/client.ts` `apiFetch(schema, path, options)` only. Validates every response body against contract schema (`ApiContractError` on mismatch), sends `x-shop-country`, parses public errors into `ApiError { status, code, meta }`.
- Flow: `src/api/<domain>.ts` -> `src/hooks/use<X>.ts` or feature hook -> `src/features/<x>/*Page.tsx`. Features never call raw `fetch`.
- Routing: single tree in `src/App.tsx`. `components/ProtectedRoute.tsx` (login) and `components/AdminRoute.tsx` (admin) are presentation guards only.
- Auth state `src/hooks/AuthContext.tsx`; country state `src/hooks/CountryContext.tsx` -> buyers locked to account country, guests/admins choose (localStorage); pushes country into api client.
- Copy: `useLocalisation()` / message catalogs from `@shop/localisation/messages/<domain>`. Money via `formatMoney` from `useLocalisation()`; amounts stay `*Cents` ints. Error `code`+`meta` -> localised text per feature.
- Client validation (`features/checkout/cartValidation.ts`, `checkoutValidation.ts`) avoids round trips only; bounds mirror contracts; server re-validates.
- UI: shadcn (`components.json`, style `base-nova`, `@base-ui/react` primitives) + Tailwind v4 CSS-first. Tokens in `src/index.css` `@theme`; no tailwind config file. Primitives -> `src/components/ui/`; class merge `cn` from `src/lib/utils.ts`. Path alias `@/` -> `src/`.
- Admin: pages under `features/admin/<resource>/` render in `features/admin/AdminLayout.tsx` outlet; outlet remounts on country change to refetch.
- Vite dev proxy (`vite.config.ts`) forwards `/api` plus top-level auth paths (`/signup`, `/login`, `/me`, ...). New non-`/api` endpoint -> add proxy entry.
- Exemplar feature: `src/features/checkout/` (state/validation/hook split, fixtures, unit + integration tests).

## Testing

- Unit: colocated `*.test.tsx`; integration: `*.integration.test.tsx` via `vitest.integration.config.ts`. Setup `src/test/setup.ts` (jest-dom, cleanup).
- API mocked with `vi.mock('@/api/...')`; no MSW. Shared fixtures for state-heavy features: `features/checkout/CheckoutPage.test-fixtures.tsx`, `features/account/TradeProfileSections.test-fixtures.tsx`.
- Selectors: prefer `getByRole`/label; `data-testid` only for non-semantic containers.
- `features/checkout/cartValidation.node-test.ts` runs under `node:test` via exact path in `test:unit` script.

## Commands

- Every `vite`/`vitest` invocation needs `--configLoader runner` (all package scripts carry it). Ad-hoc: `npx vitest run --configLoader runner src/features/cart/CartPage.test.tsx`.

## Pitfalls

- New `*.node-test.ts` silently skipped unless added to `test:unit` script.
- `features/company/ThresholdSection.tsx` formats cents with `toFixed` for editable input value; not display pattern to copy.
- `check:localisation` allowlist is exact-file (`scripts/check-localisation-core.mjs` `ALLOWLIST`); help/design content and `api/client.ts` exempt by design.
