# Test Execution Performance Coding Plan

Status: implementation complete; verification blocked
Created: 2026-08-07
Scope: test reliability, fixture cost, runner completeness, concurrency tuning
Baseline runtime: Windows, Node `v22.23.1`, npm `10.9.8`, 14 logical CPUs

## Objective

Cut full test wall time without weakening isolation, production boundaries, migration coverage, auth coverage, or customer-journey coverage. Make root `npm test` truthful: every intended unit and integration suite runs exactly once and returns non-zero on any failure.

## Baseline Evidence

- root `npm test`: `362.5s`; failed in web unit collection
- passing tests across all separately invoked suites: `1,787`
- test files: `309`
- API integration: `435` tests, `103` files, `199.0s`
- API unit: `236` tests, `7.1s`
- web unit: `862` passing tests plus one failed suite, `40.5s`
- web integration: `54` tests, `18` files, `9.4s`; omitted by root `npm test`
- contracts: `152` tests, `3.2s`
- catalog: `36` tests, `0.8s`
- localisation: `11` tests, `0.9s`
- API integration setup calls:
  - `openDatabase()`: `165`
  - `seedDatabase()`: `184` across `69` files
  - `resetDatabase()`: `28` across `12` files
  - `buildApp()`: `84`
  - temp directories: `196`
- API integration file shape:
  - median top-level tests per file: `2`
  - files with one top-level test: `30`
  - files with one or two top-level tests: `72`
- every fresh `openDatabase()` -> WAL enablement -> FK enablement -> all pending migrations
- every `seedDatabase()` -> catalog validation + canonical catalog writes + users/promos/orders/reviews/async fixtures
- every seed -> eight deterministic synchronous `scryptSync` derivations
- full integration static upper bound: `184 x 8 = 1,472` seed-password derivations
- root `npm test` gap: `apps/web/package.json` maps `test` to `test:unit`; web integration never runs
- web collection failure: `apps/web/src/i18n/translationSurface.test.ts` imports executable `scripts/check-localisation.mjs`; native Node import passes, Vitest transform fails with `SyntaxError: Invalid or unexpected token`
- warning debt: unresolved React state updates after test completion; React Router v7 future warnings
- current unrelated health blocker reported during analysis:
  - `apps/api/src/routes/bundles.ts:92`
  - `apps/api/src/routes/cart.ts:165,175`
  - `apps/api/src/routes/customBlends.ts:181`
  - API typecheck reports possibly-undefined payload arguments

## Performance Targets

Measure on same machine, same Node version, clean process state. Use three warm runs; compare medians. Do not enforce hardware-specific thresholds in ordinary CI scripts.

- API integration median: at least `40%` faster than `199.0s`
- truthful root `npm test` median: at least `30%` faster than `362.5s`, despite adding web integration
- web unit median: at least `20%` faster than `40.5s`
- `CheckoutPage.test.tsx`: at least `25%` faster than `32.6s`
- pass count: no unexplained decrease
- skipped/todo count: no increase
- warning count: zero React `act(...)` warnings; zero React Router future warnings
- reliability: three consecutive `npm test` passes after unrelated typecheck blocker resolution

Targets are exit gates, not permanent CI timeouts. Record machine, Node/npm versions, run count, median, min, max, pass count.

## Invariants

- Node `22.x`; stop on Node `23+`
- no Docker, network, service, account, or API key
- no checked-in SQLite snapshot
- production `hashPassword()` and `verifyPassword()` unchanged
- migration and seed semantic suites still exercise real fresh databases
- every writable integration fixture owns unique database file
- no writable database or Fastify instance shared across tests
- process isolation remains enabled
- foreign keys remain enabled outside migration runner suspension
- test speed never justified by disabled assertions, broader mocks, hidden warnings, or increased timeouts
- full user keyboard journey retained for each important form; setup-only repetition may use lower-cost input arrangement
- focused test commands work without prior full-suite preparation
- profiler writes no persistent benchmark artifact unless implementation handoff explicitly records evidence in this plan

## Target Runner Shape

`npm test` -> package tests -> app unit tests -> app integration tests

Each tier runs once. Initial orchestration stays sequential. Parallel root orchestration requires later benchmark proof.

API integration runner:

`create run temp dir -> migrate + seed one template DB -> checkpoint + close -> spawn isolated Node test runner with template path -> tests clone template into owned temp dirs -> cleanup in finally`

Focused API integration command without runner template:

`fixture helper detects missing template -> creates one process-local template -> clones it -> runs test -> removes owned files`

Fresh-schema/seed fidelity suites bypass template path.

## Execution Graph

`G0 -> P1 -> G1 -> P2 -> P3 -> P4 -> P5`

`G1 -> P6`

`P5 + P6 -> P7 -> G2`

- `G0`: baseline health and timing recorded
- `G1`: trustworthy root test graph; localisation suite collects and passes
- `G2`: full verification + performance targets pass

## P0: Baseline Gate

Files:

- `package.json`
- workspace `package.json` files
- new `scripts/profile-tests.mjs`

Work:

- verify Node/npm versions and dependency health
- run API typecheck; record current unrelated failures verbatim
- stop implementation if dependency health fails
- do not absorb unrelated type errors into this plan without user approval
- add cross-platform Node profiler using `child_process.spawn`, `performance.now()`, inherited output, exact exit-code propagation
- support named suites and repeated runs
- print JSON or compact text: suite, run, wall milliseconds, exit code, test count when runner exposes count
- no shell-specific environment assignment, command chaining, or output parsing dependency
- capture baseline three-run medians for API integration, web unit, web integration, root test after P1 correctness fix

Exit:

- profiler returns child failure code
- profiler leaves no temp processes/files
- baseline evidence contains machine + runtime versions

## P1: Restore Test Reliability and Completeness

Files:

- `scripts/check-localisation.mjs`
- new `scripts/check-localisation-core.mjs`
- `apps/web/src/i18n/translationSurface.test.ts`
- `apps/web/package.json`
- root `package.json`

Work:

- move reusable scanner, allowlist, fixture assertions, repository walking into import-safe core module
- keep executable file as thin shebang wrapper; wrapper owns console output and `process.exitCode`
- resolve localisation fixture paths from `import.meta.url`, not workspace `process.cwd()`
- make focused Vitest test import core module
- preserve `npm run check:localisation` output and exit behavior
- make root graph run packages, app units, web integration, API integration exactly once
- add explicit `test:packages` if needed; avoid root workspace command that re-enters API integration through `@shop/api test`
- keep root tiers sequential until P5 concurrency evidence exists
- ensure npm failure propagates through profiler and root command

Exit:

- focused localisation suite passes
- localisation guard passes
- `npm test` includes `18` web integration files / `54` tests
- injected focused failure makes `npm test` non-zero; revert injection immediately
- no suite executes twice

## P2: Remove Seed Password CPU Waste

Files:

- `apps/api/src/db/seed.ts`
- `apps/api/test/db/seed.integration.test.ts`
- seeded auth/country integration tests

Work:

- replace repeated runtime `scryptSync` calls for eight fixed demo identities with checked-in deterministic seeded hashes or one immutable precomputed map
- keep salts, demo passwords, stored format, production hasher, production verifier unchanged
- prevent hash recomputation before `INSERT OR IGNORE`
- add direct `verifyPassword()` assertions for every distinct seeded password
- prove UK and DE Alice identities remain separate and log in with existing credentials
- prove reset + seed produces stable credential values
- retain at least one seed contract assertion capable of detecting invalid hash constants

Exit:

- zero `scryptSync` invocation inside ordinary `seedDatabase()` execution
- production auth hashing tests unchanged and passing
- seed, auth, country-identity focused suites pass
- `npm run reset` succeeds

## P3: Add Generated Seed Template Runner

Files:

- new API test support runner under `apps/api/test/support/`
- new seeded DB fixture helper under `apps/api/test/support/`
- `apps/api/package.json`

Work:

- runner creates unique OS temp directory
- runner opens fresh DB through production `openDatabase()`
- runner calls production `seedDatabase()` once
- runner runs `PRAGMA foreign_key_check`
- runner checkpoints/truncates WAL before close
- runner closes template before any copy
- runner spawns Node 22 test process without shell; pass template path through test-only environment variable
- runner cleans only its owned resolved temp directory in `finally`
- fixture helper copies closed template into unique test-owned directory
- clone opens through production `openDatabase()`; migration-history validation, WAL, FKs still execute
- focused-test fallback builds one process-local template when environment variable absent
- helper registers cleanup only after resources exist; close Fastify before database; remove exact owned directory
- expose no template behavior through production composition root
- do not check in generated DB, WAL, or SHM files

Exit:

- two simultaneous fixtures receive distinct writable files
- mutation in clone A absent from clone B and template
- clone FK check passes
- forced child failure still removes runner temp directory
- focused integration file works both through package runner and direct documented command

## P4: Migrate Eligible API Integration Fixtures

First wave:

- `apps/api/test/cart/cart.integration.test.ts`
- `apps/api/test/catalog/products.integration.test.ts`
- `apps/api/test/checkout/payment.integration.test.ts`
- `apps/api/test/customBlend/customBlendOptions.integration.test.ts`
- `apps/api/test/cart/customBlendCart.integration.test.ts`
- `apps/api/test/cart/cartCountry.integration.test.ts`
- `apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts`
- slow route/app files identified by profiler

Second wave:

- remaining non-seed-behavior files calling `seedDatabase()`
- remaining route fixtures repeating `openDatabase()` + `buildApp()` setup

Work:

- characterize pass/test counts before each wave
- replace generic fresh-migrate/seed setup with clone helper
- replace generic `resetDatabase() -> seedDatabase()` between cases with fresh clone, not live-file overwrite
- keep one Fastify instance per writable fixture
- keep request/auth/domain assertions unchanged
- consolidate tiny files only when shared fixture lifecycle and domain ownership align
- do not consolidate unrelated domains to reduce process count
- use one shared app-fixture helper only if it preserves service override and cleanup patterns; avoid partial-app registrations

Explicit bypass:

- `apps/api/test/db/migrations.integration.test.ts`
- seed idempotency/fidelity cases in `apps/api/test/db/seed.integration.test.ts`
- schema seed suites asserting seed behavior
- reset tests asserting delete order or trigger restoration
- persistence/reopen tests requiring explicit close/reopen sequence

Exit per wave:

- identical test/pass/skip totals
- no leaked Node processes or temp directories
- first-wave focused files pass directly
- full API integration passes three times
- static `seedDatabase()` call count outside `apps/api/test/db/` materially reduced; document before/after counts

## P5: Tune API and Root Concurrency

Files:

- API integration runner
- `apps/api/package.json`
- root `package.json` only if evidence supports root parallelism

Work:

- benchmark API `--test-concurrency=4`, `7`, `13` after P2-P4
- run each value three warm times with identical tests and clean runner-owned temp state
- select lowest reliable median; pin explicit default only when gain is repeatable
- allow test-only environment override for local/CI diagnosis
- keep Node process isolation enabled
- reject `--experimental-test-isolation=none`
- benchmark root API/web overlap only after API tuning
- keep root sequential unless overlap improves full median by at least `10%` without suite slowdown, memory pressure, output ambiguity, or flakes

Exit:

- chosen concurrency evidence recorded
- three consecutive API integration passes
- no test count changes across concurrency values

## P6: Reduce Web Hotspots and Warning Debt

Files:

- `apps/web/src/features/checkout/CheckoutPage.test.tsx`
- `apps/web/src/features/account/TradeProfileSections.test.tsx`
- related existing hook/state tests
- shared test router/render helper if introduced

Work:

- split checkout tests by concern: summary/promo, delivery/navigation, payment/idempotency/conflicts
- split profile tests by delivery-site and billing-entity ownership
- keep mocks and cleanup local to each file; prove no order dependence
- retain one full real-timer `userEvent` keyboard journey per important form
- arrange setup-only valid form data with paste/direct controlled changes where keyboard mechanics are not assertion target
- move pure idempotency/retry transition cases into existing hook/state tests only when production behavior already has suitable boundary
- keep representative page-level success, decline, retry, conflict, back-navigation, stale-response cases
- await mount-time trade-profile/delivery-slot completion before synchronous assertions
- wrap explicit deferred promise resolution in `act(...)`
- drain or cancel async work before cleanup
- add React Router v7 future flags to local/shared test routers; rerun redirect and browser-back cases
- never suppress `console.error` or filter warnings globally
- benchmark Vitest default forks against threads and bounded worker counts only after file split
- current evidence rejects hard-coded `maxWorkers: 7`; keep default unless three-run median proves improvement
- remove `20_000` checkout timeout only after three full web-unit passes without timeout pressure

Exit:

- no `act(...)` warnings
- no React Router future warnings
- web unit and integration pass three times
- keyboard/accessibility coverage retained
- web performance targets pass

## P7: Convergence and Documentation

Files:

- root/package scripts
- `AGENTS.md` command section if commands change
- this plan status/evidence block

Work:

- update human command documentation only for changed commands or focused-test workflow
- keep one install flow and one ordinary full-test command
- record before/after medians, exact pass counts, concurrency choice, excluded semantic suites, remaining slowest five files
- list unrelated typecheck blocker separately if still present
- remove temporary profiling fixtures and debug output
- run full gates after unrelated repository health permits

Final verification:

```powershell
$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH
node --version
npm --version
npm exec -- tsx --version
npm run typecheck -w @shop/api
npm exec -w @shop/web -- vitest run --configLoader runner src/i18n/translationSurface.test.ts
npm run check:localisation
npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts test/db/migrations.integration.test.ts
npm exec -w @shop/api -- tsx --test test/auth/auth.integration.test.ts test/integration/countryIdentityEndToEnd.integration.test.ts
npm run test:unit
npm run test:integration
npm test
npm run reset
npm run verify
```

## Stop Conditions

- template clone contains uncheckpointed WAL state
- focused direct tests require prior full-suite preparation
- shared writable database/app appears between tests
- migration/seed semantic coverage routes through cloned template
- test count falls without explicit duplicate-coverage mapping
- optimisation changes production auth cost or hash format
- warning suppression replaces async cleanup
- new flake appears across three repeated runs
- unrelated typecheck failures block final gate; report exact baseline and request scope decision

## Expected Result

- root command trustworthy
- API setup paid once per full run, not once per test
- seeded credentials remain production-verifiable without repeated synchronous derivation
- API test concurrency explicit and measured
- slow web journeys split by concern while retaining representative user interaction
- warnings treated as defects
- faster suite with unchanged behavioral confidence

## P7 Evidence (2026-08-08)

Status: implementation is complete, but final verification remains blocked by the pre-existing API
typecheck errors and the performance targets that are still unmet. No production route or auth
type error was changed.

Implemented convergence work:

- Root `npm test` now runs packages, web unit, API unit, web integration, and API integration once
  through explicit sequential tiers. API integration uses the seeded closed-template runner and
  `SHOP_TEST_CONCURRENCY` diagnostic override; root concurrency remains sequential because no
  root-overlap benchmark met the 10% improvement gate.
- Seeded demo credentials use checked-in, production-verifiable hashes. Ordinary seeding performs
  zero `scryptSync` derivations; seed tests retain hash-constant and verifier assertions.
- Checkout/profile suites are split by concern. All 154 web test `MemoryRouter` usages opt into
  both React Router v7 future flags. The deferred waiting-list test resolves inside `act(...)`.
- Localisation scanning is import-safe through `scripts/check-localisation-core.mjs`; the executable
  guard remains `npm run check:localisation`. `scripts/profile-tests.mjs` records child wall time and
  exit status without writing benchmark artifacts.

Toolchain and gates:

- Node `v22.23.1`, npm `10.9.8`, `tsx v4.23.0`; `npm ping` passed after the documented
  `NODE_OPTIONS=--use-system-ca` retry.
- Web typecheck passed. Localisation focused test: 1 file / 9 tests passed. Localisation guard:
  890 source files / 0 findings. Seed + migration focused suites: 44 tests passed. Auth + country
  focused suites: 16 tests passed. API unit: 242 tests passed. `npm run reset` passed.
- Web focused split suites (including pending approval): 7 files / 56 tests passed with no act or
  Router warnings. Web integration: 18 files / 54 tests passed with no act or Router warnings.
- Clean web-unit profiler run: 128 files / 871 tests passed, no warnings, wall `35,918.64 ms`,
  child exit `0`.
- Clean root profiler run: wall `242,508.39 ms`, child exit `0`; API integration reported 437 tests
  passed, 0 failed, 0 skipped, 0 todo (`176,221.2117 ms`). Package counts are unchanged from the
  baseline (contracts 152, catalog 36, localisation 11); no package sources changed.
- `npm run format` and standalone `npm run lint` passed (exit `0`); `npm run verify` stops before
  lint at API typecheck.
- `npm run verify` reached the known blocker and stopped with exactly four `TS2345` errors:
  `apps/api/src/routes/bundles.ts:92`, `apps/api/src/routes/cart.ts:165,175`, and
  `apps/api/src/routes/customBlends.ts:181` (possibly-undefined payload arguments). These are
  outside this plan and remain unfixed.

Performance and coverage evidence:

- P5 concurrency measurements: c7 single run `185.223 s`; c13 runs `164.572 s`, `186.976 s`,
  `192.380 s` (median `186.976 s`). c4 evidence is unavailable because the first attempt exposed
  runner auto-discovery recursion and was stopped before profiler JSON. No concurrency value is
  pinned; three c13 passes were clean.
- Against the baseline, root is 33.1% faster (target met), API integration is 11.4% faster (40%
  target unmet), web unit is 11.3% faster (20% target unmet), and the focused checkout split is
  65.6% faster (`11.21 s` vs `32.6 s`, target met). Only one clean root and one clean web-unit
  profiler run were required; no three-run root median is claimed.
- Fixture setup reductions recorded by P4: first wave `44 -> 2` seed calls, A-M `49 -> 1`, N-Z
  `31 -> 0`, checkout `10 -> 0`. Current ordinary `seedDatabase()` references outside
  `apps/api/test/db/` are 3 in 2 explicit seed-fidelity files. Migration, seed-idempotency,
  schema-seed, reset, and persistence/reopen suites remain explicit template-runner bypasses.
- Remaining slowest-five file data was not captured in this convergence run and is intentionally
  omitted.

Cleanup: `apps/web/src/vite-env.d.ts` had no content diff after index refresh. Exact task-owned
  temporary directories (`shop-api-debug-*` and six `shop-api-test-clone-*` directories) were
  removed; no `shop-api-integration-run-*` directories or task-owned Node processes remain.
