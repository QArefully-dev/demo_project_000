# AGENTS.md — apps/web/src/features/customBlend

Custom-blend ordering UI (see root AGENTS.md for repository-wide architecture and dependency rules).

## Local scope

- CustomBlendPage.tsx is the container: parses URL params (baseVariantId, editConfigKey), composes BasePicker, IngredientPicker, RatioEditor, MixVisualization, BlendSummaryAside, SuccessRecap.
- customBlendState.ts owns state via `customBlendReducer()` (events: target-changed, edit-loaded, ingredient-toggled, percentage-changed) plus derived helpers (`ingredientTotalPercentage`, `balanceEvenlyPercentages`, `snapshotToDraftIngredients`).
- Ingredient bounds (MIN/MAX_INGREDIENTS, MIN/MAX_INGREDIENT_PERCENTAGE, MAX_INGREDIENT_TOTAL) come from `@shop/contracts/custom-blends` — never hardcode locally. They mirror server rules in apps/api/src/features/customBlend/customBlendRules.ts for UX only; the server always re-validates.
- useCustomBlendEvaluation.ts wraps API calls (`getCustomBlendOptions`, `getCustomBlendEvaluation`) and surfaces `ApiError(code, meta)`; CustomBlendPage handles `optionsErrorState()` for 400 responses.

## Pitfalls

- The ingredient/base compatibility matrix is deliberately server-private (apps/api/src/features/customBlend/customBlendRules.ts `INGREDIENT_GROUPS_BY_BASE`) — never duplicate or infer it here; render only the server's verdict.
