# Facilitator handoff: Custom Blend (QME-418)

Keep this handoff and the grading template hidden from the planner. The planner's task is a **static-analysis E2E test plan**, not test implementation. Its permitted evidence is repository code and tests; it must not start the app or browser, install dependencies, run tests, or reset the database. The workshop scope is AC1–AC5 of `workshop/feature-ticket.md`, ending at the configurator and cart. AC1 includes both continue-shopping and checkout-navigation options; only the latter's availability and destination are in scope, not a checkout journey. This document is facilitator context, not extra acceptance criteria or a request to fix the app.

## Scenarios

Up to four prioritized scenarios are enough; these are useful coverage groupings, not a required script:

1. **Guest creation and price:** Enter from the category menu, select an eligible 25 kg food base and food ingredient, adjust valid proportions, observe food-compatible classification and live material cost, flat blending fee, and total, then add one cart line. Check cart total and the available continue-shopping and checkout-navigation options. The preview evaluates at the base MOQ when quantity is omitted; the common seeded MOQ is four sacks. Keep quantity consistent when comparing prices.
2. **Rejected combination and recovery:** The UI allows combinations that the server rejects after evaluation. Two pigments at 5% + 5% are valid; 6% + 5% exceeds the combined 10% pigment cap. Check a clear evaluation reason, no added line, preserved selections, and a corrected blend that can be added. Other server-only incompatibilities may serve the same purpose.
3. **Safety classification:** A blend is food-grade only when every component, including the base, has `food` handling classification. A `caution` component makes it non-food; the summary should provide the corresponding handling guidance. A food-grade mixing group alone does not establish food suitability.
4. **Single-line edit:** With one blend in a guest cart, edit its line, confirm the configuration is restored, change it, and save. Verify the existing line is replaced, with its revised price, rather than duplicated. Use a fresh guest cart for an independent scenario.

## Existing coverage

The following are static code/test pointers, not evidence that an E2E journey passes:

- Contract and server rules: `packages/contracts/src/customBlends.ts`, `apps/api/src/features/customBlend/customBlendRules.ts`, and `customBlendResolver.ts`. Structure limits are 1–4 ingredients, whole percentages 5–50, total ingredient percentage at most 50. The server checks compatibility and aggregate pigment cap. Base eligibility requires an active 25 kg variant with a mixing group and positive MOQ. `customBlendRules.test.ts` covers the compatibility matrix, pigment cap, pricing, and classification; `apps/api/test/customBlend/customBlendEvaluation.integration.test.ts` covers HTTP evaluation including the 6% + 5% rejection.
- Pricing and cart: component prices vary with component weight; the blending fee is a flat £25 per line, not per sack (`customBlendRules.ts`, `apps/api/test/cart/customBlendCart.integration.test.ts`). Evaluation without quantity uses base MOQ; add submits the evaluated quantity (`apps/web/src/features/customBlend/useCustomBlendEvaluation.test.tsx`, `CustomBlendPage.test.tsx`). `customBlendCart.integration.test.ts` covers creation, same-recipe merging, edit replacement, and repricing. For AC5, the one-line case avoids merge behavior with a second matching line.
- UI: `apps/web/src/features/customBlend/CustomBlendPage.tsx`, `customBlendState.ts`, and their nearby tests cover configuration, evaluation, and edit state with mocked API responses. Inspect `BlendSummaryAside.tsx` for safety-message behavior; it has no dedicated test file. Cart rendering/edit entry points are covered in `CartLineItem.test.tsx` and `CartPage.test.tsx`. `CustomBlendReachability.integration.test.tsx` covers navigation entry points. No existing E2E spec covers the full live configurator-to-cart journey; web tests mock the API.

## Risks

- The ticket's 25 kg product context and AC2's visible pricing wording need to be reconciled with implementation details such as MOQ, component weights, and the flat fee. These are subtleties for the planner to discover from code and reflect in the plan, not instructions to change the app.
- The UI mirrors structural limits, while compatibility and pigment rules are server-side and appear after debounced evaluation. A plan that checks only input validation can miss AC4. An add failure may show a generic cart error, so the rejection scenario should be grounded in evaluation behavior.
- Preview does not expose a new-blend quantity control; evaluation uses MOQ. The flat fee makes `unit price × quantity` differ from line total. A plan that compares these without accounting for MOQ and fee can misread correct behavior.
- Use independent guest carts across scenarios. Recipe identity can merge matching lines, which would obscure the AC5 replacement assertion if a second blend is already present.

## Approach

Run the three workshop conditions from the **same source revision, prompt, ticket, model, and model settings**, each in a fresh chat with no prior plan carried over. Vary documentation only: no agent instructions, some instructions, then nested `AGENTS.md` instructions. Keep this handoff and the hidden grading template inaccessible to the planner in all three runs. Record elapsed time and token use separately for each run, along with the resulting plan. Do not claim an empirical speedup from these instructions alone.

Facilitator scoring uses the hidden 17-check rubric: five points per check, 85 raw points normalized to 100. The first 12 checks are core. Keep the scoring reference hidden; do not turn its checks into planner instructions or add requirements beyond the ticket and stated workshop scope.
