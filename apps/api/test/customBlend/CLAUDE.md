# customBlend integration tests

API-level integration tests for Custom Blend: base listing, options, and a full rules-to-order journey. One file per surface. Blend policy unit tests belong in `apps/api/src/features/customBlend/`, not here.

Tests exercise the assembled Fastify app in-process via `app.inject(...)` against a seeded SQLite clone. No running server and no built app required; packages must be built and Node must be 22.x.

## Harness

`createSeededAppFixture(t)` from `apps/api/test/support/seededDatabase.ts` returns `{ app, db, databasePath, directory }` and registers cleanup through `t.after`. Each test gets its own writable clone of a closed, WAL-checkpointed seeded template, so tests may mutate freely and must never depend on another test's state. Foreign-key integrity is asserted on both template and clone.

The runner (`apps/api/test/support/run-integration-tests.ts`) builds the template once, exports `SHOP_TEST_TEMPLATE_PATH`, and spawns a child with process isolation. Default glob `test/**/*.integration.test.ts`; an explicit path argument suppresses it. `SHOP_TEST_CONCURRENCY` overrides concurrency.

Run one file from `apps/api`: `npm run test:integration -- test/customBlend/customBlendOptions.integration.test.ts`

## Required patterns

- `void test('...', async (t) => { const { app, db } = await createSeededAppFixture(t); ... })`. Pass `t` so cleanup registers.
- Validate responses against the real contract schema with `Value.Parse`/`Value.Check` from `@sinclair/typebox/value` plus `@shop/contracts`. Assert the contract, not an ad-hoc shape.
- Select fixtures by SQL query against the seeded database (`eligibleLot`-style helpers), never by hard-coded row id, so the journey never relies on global ids or counts.
- Pass country as an explicit header constant (`{ 'x-shop-country': 'UK' }`).
- Assert the machine-readable error `code`, never the prose message.
- Pin clocks to dated constants.
- Cross-feature fixtures import from sibling test dirs with `.js` extensions (`../checkout/checkoutDepthFixtures.js`, `../support/seededDatabase.js`).

## Pitfalls

- Process isolation is mandatory; the runner throws on `--experimental-test-isolation=none|threads`.
- The runner deletes `NODE_TEST_CONTEXT` before spawning. Carrying it into a fresh runner makes Node treat execution as recursively nested and silently skip the requested files — a green run with zero tests.
- Files here are not covered by `npm run typecheck`; type errors surface only via `eslint .` or at runtime.
- A file under `apps/api/test/` not named `*.integration.test.ts` runs in no tier until added to the explicit `test:unit` list in `apps/api/package.json`.
- Fixtures must not mutate the shared template; each owns and removes only its own temp directory.
