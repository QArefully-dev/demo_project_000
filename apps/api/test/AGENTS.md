# apps/api/test

## Testing

- Integration -> `test/**/*.integration.test.ts`, run by `test/support/run-integration-tests.ts`: builds one seeded template DB, each file in own process (`--experimental-test-isolation=process`, required).
- Unit -> `src/**/*.test.ts` auto-discovered + explicit `test/*.test.ts` paths listed in `apps/api/package.json` `test:unit`.
- Per-test DB: `test/support/seededDatabase.ts` -> `openSeededDatabase(t)` (db only) or `createSeededAppFixture(t)` (db + Fastify app). Each call clones template; cleanup auto-registered via `t`. Tests sharing one fixture within file share state.
- HTTP -> `app.inject()`, no real port. Auth -> call `/signup` or `/login`, read `set-cookie` (see `test/http/app.integration.test.ts`).
- Time -> inject `clock` with fixed `Date`; no fake timers.
- Shared domain fixtures -> non-test modules, e.g. `test/checkout/checkoutDepthFixtures.ts`.
- Env: `SHOP_TEST_CONCURRENCY` -> `--test-concurrency`; `SHOP_TEST_TEMPLATE_PATH` set by runner.
- Exemplars: `test/cart/cart.integration.test.ts`, `src/features/auth/sessionService.test.ts`.

## Commands

```bash
npm run test:integration -w @shop/api -- test/cart/cart.integration.test.ts
npm run test:integration -w @shop/api -- --test-name-pattern "cart service"
npx tsx --test src/features/cart/cartBulkAddRules.test.ts   # from apps/api
```

## Pitfalls

- New non-integration `test/*.test.ts` never runs unless added to `test:unit` list.
- New migration -> several `test/db/*.integration.test.ts` assert migration head version (`expectedVersions` in `migrations.integration.test.ts`, plus per-schema tests). Grep `test/db` for previous head version, update all.
- Seed/fixture changes breaking FK integrity fail at template build, before any test body.
- Runner treats bare non-flag token as test path; new value-taking flag needs entry in `OPTIONS_WITH_VALUES` (`test/support/run-integration-tests-args.ts`).
