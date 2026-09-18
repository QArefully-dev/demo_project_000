# Custom Blend API Integration Tests

## Test Shape

- Use `createSeededAppFixture(t)` from `apps/api/test/support/seededDatabase.ts` and exercise routes through `app.inject`.
- Select seeded lots by semantic facts such as mixing group, activity, default sort order, and 25 kg weight. Never depend on global row IDs or counts.
- Validate successful responses with shared TypeBox schemas before asserting domain details.
- Evaluation tests must prove side-effect freedom. Mutation/journey tests must inspect persisted cart, quote, order, inventory, and gateway effects where applicable.
- Inject fixed clock and fake gateway when asserting clearance, delivery, payment, or immutable-money outcomes.
- Full journey exemplar: `customBlendRulesJourney.integration.test.ts`.

## Commands

- All API integration tests: `npm run test:integration -w @shop/api`
- Focus one file: `npm run test:integration -w @shop/api -- test/customBlend/customBlendEvaluation.integration.test.ts`

## Coverage

- Cross-boundary Custom Blend behavior also lives in `apps/api/test/cart`, `apps/api/test/checkout`, and `apps/api/test/orders`; run full API integration suite after policy, persistence, or snapshot changes.
- Keep option-list, side-effect-free evaluation, cart mutation, stale-fact rejection, checkout, and immutable-order assertions aligned.

## Pitfalls

- Integration runner requires Node 22 and process isolation; do not bypass it for authoritative results.
- Register fixture cleanup through `TestContext`; fixtures created without `t` require `finally` cleanup.
- Never mutate shared template database. Each test mutates only its fixture clone.
- Build shared packages before running tests; stale ignored `dist` can fail module loading before test code runs.
