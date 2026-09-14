# customBlend (web)

Custom Blend configurator UI: base picker -> ingredient picker -> ratio editor, with a live summary aside, mix visualisation, and add/replace to cart. Reachable from category nav; no sign-in required. Requirements: `workshop/feature-ticket.md` (QME-418).

## Layout

- Components: `BasePicker.tsx`, `IngredientPicker.tsx`, `RatioEditor.tsx`, `RatioGauge.tsx`, `MixVisualization.tsx`, `BlendSummaryAside.tsx`, `CustomBlendPreview.tsx`, `CustomBlendPackaging.tsx`, `SuccessRecap.tsx`.
- `CustomBlendPage.tsx` — orchestration over `customBlendReducer`.
- `customBlendState.ts` — pure draft state, reducer, `customBlendValidation`, ratio derivations.
- `useCustomBlendEvaluation.ts` — debounced, abortable server evaluation.

Not here: HTTP calls (`apps/web/src/api/customBlends.ts`), copy (`packages/localisation/src/messages/customBlend.ts`), and any blend policy — compatibility matrix, pigment cap, classification, and pricing are API-owned.

## Required patterns

- Source every structural bound from `@shop/contracts/custom-blends` and re-export it; never redeclare a numeric limit. Client validation mirrors the server's `normalizeCustomBlendSpec` for responsiveness — the backend re-validates at mutation time and stays authoritative.
- Render errors from `code` plus safe `meta` mapped to a message key. API prose is intentionally not retained; only `string | number | bigint` meta values may become message params.
- Option reads pass an `AbortSignal` — a superseded request must never repopulate the ingredient picker.
- Copy comes from `@shop/localisation/messages/customBlend` and `messages/apiErrors` through `useLocalisation()`.

## Testing

Vitest + jsdom + Testing Library, colocated `*.test.tsx`. Config `apps/web/vite.config.ts`; setup `apps/web/src/test/setup.ts` registers jest-dom matchers and `cleanup()`.

- `vi.mock('@/api/customBlends', ...)` is the harness convention — the API module is always mocked. No network, no server, no built app.
- Components are wrapped in `MemoryRouter`.
- `*.integration.test.tsx` selects the integration tier (`apps/web/vitest.integration.config.ts`) and is excluded from `test:unit` by name. `CustomBlendReachability.integration.test.tsx` additionally mocks cart/product/category hooks and swaps `@/components/Layout` for a minimal shell over the real router.
- Run one file from `apps/web`: `npx vitest run --configLoader runner src/features/customBlend/RatioEditor.test.tsx`

## Pitfalls

- `MixVisualization.test.tsx` asserts exact SVG geometry (pixel `x`/`width` values). Any layout tweak to the visualisation breaks it deterministically — update the expected geometry deliberately, not by loosening the assertion.
