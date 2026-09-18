# Custom Blend Web Feature

## Boundaries

- `customBlendState.ts`: draft state and immediate structural validation from shared contract constants only.
- `useCustomBlendEvaluation.ts`: debounced server evaluation and exact-request lifecycle.
- `CustomBlendPage.tsx`: URL target, edit hydration, submit gate, and mutation orchestration.
- `apps/web/src/api/customBlends.ts`: schema-validated transport boundary.
- Compatibility, pigment policy, classification, quantity, and pricing remain server-owned. Never reproduce them in reducer or components.
- User copy: `packages/localisation/src/messages/customBlend.ts`; public API error copy: `packages/localisation/src/messages/apiErrors.ts`.

## State And Requests

- URL owns `(baseVariantId, editConfigKey)`. Target changes discard incompatible draft state; edit mode derives from hydrated target, not a parallel flag.
- Edited line quantity is server-owned and read-only.
- Evaluation identity includes country, full ingredient draft, quantity, and edit key.
- Abort superseded requests and synchronously hide results whose identity differs from current draft.
- Submit only after exact current server evaluation succeeds. Mutation response owns final cart-line `configKey`.
- Keep API errors as stable public codes plus safe metadata; discard server/network prose and translate during render.
- Base and ingredient eligibility comes from server option endpoints; do not derive it from catalog data in browser.

## Presentation

- Draft previews are render-only and must not claim stale edit batch marks.
- Packaging uses server result classification for consumption safety. Never infer food safety from base or ingredient appearance.
- Fixed Custom Blend livery must not encode composition in colour. Preserve category-owned hazard treatment.

## Testing

- Unit suite: `npm run test:unit -w @shop/web`
- Integration suite: `npm run test:integration -w @shop/web`
- Keep tests colocated. `CustomBlendReachability.integration.test.tsx` belongs to integration config and is intentionally excluded from unit runs.
- Authority/staleness exemplar: `useCustomBlendEvaluation.test.tsx`. Edit/submit exemplar: `CustomBlendPage.test.tsx`. Safety/livery exemplar: `CustomBlendPackaging.test.tsx`.

## Pitfalls

- Never import `apps/api` source; use `@shop/contracts` and web API modules.
- Do not publish an old successful evaluation during debounce or after country, target, quantity, or ratio changes.
- Do not use a local structural-validity result as compatibility or pricing approval.
- Feature discovery/edit links also exist in `apps/web/src/App.tsx`, navigation/home components, and `CartLineItem.tsx`; update their tests when routes or entry points change.
