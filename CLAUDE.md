# Agent Instructions

## Scope

Local department-store codebase for QA education and repository-scale agent demos. Non-live runtime; production-grade boundaries.

- Product: familiar webshop; browse -> cart -> checkout -> order
- Runtime: deterministic, local-first, low setup
- Engineering: realistic rules; strict validation, auth, migrations, transactions, errors

## Context

- direction: `plans/demo_project_high_level_plan.md`
- active expansion: `plans/catalog_reviews_audit_seed_content_implementation_plan.md`
- task scope: named plan/specification
- implementation truth: code, manifests, migrations

Precedence: user request -> task plan -> high-level plan -> repository defaults.

Read task-relevant plans only. Ignore old status, evidence, handoff, completed orchestration unless user names it. Unresolved product/course conflict -> request decision.

## Constraints

- Keep normal customer path simple; keep admin/diagnostics outside it.
- Check high-level plan before changing course scenarios. Avoid later-course spoilers in early UI, comments, filenames, starter artifacts.
- Support Windows and macOS; no Docker, cloud service, account, API key, or post-install network.
- Keep one install flow, one dev command, deterministic seed/reset.
- Keep simulated integrations local and controllable; retain production boundaries.

## Architecture

Stack: npm workspaces; React/Vite/TypeScript web; Fastify/TypeScript API; SQLite; shared TypeScript contracts. Inspect manifests for exact versions/scripts.

- Default: modular monolith. Split service only for named distributed-behavior demo.
- Flow: frontend -> API contracts -> domain -> persistence.
- Backend owns money, inventory, orders, payments, permissions. Money uses integer minor units.
- Contracts own transport types/schemas; shared data owns canonical static catalog/content.
- Web never imports API source. Packages/scripts never import app-private source.
- Backend: thin routes -> workflow services -> repositories owning SQL/row types. One transport mapper per record type.
- Composition root owns database, clock, IDs, config, adapters. Imports perform no listen, seed, migration, or persistent-resource opening.
- Use ordered versioned migrations; preserve data; surface unknown migration errors.
- Transaction owner covers full business invariant.

## Change Rules

- Preserve unrelated work; make smallest coherent scoped change; retain public behavior unless requested.
- Phased work: complete assigned ready packet, pass exit checks, update status, stop.
- Avoid empty scaffolding, speculative abstractions, vendored code, generated padding.
- Remove obsolete path after final consumer moves; avoid parallel legacy/new implementations.
- Separate static data, generated artifacts, transport schemas, domain rules, persistence, rendering.
- No mutable module-global request, cart, session, or database lifecycle state.
- Demo status never relaxes schema, auth, validation, transaction, integrity standards.
- Do not edit `reference/` or `.cursor/` unless scoped. Course-visible change -> inspect affected course artifacts first.

## Quality

- Use repository scripts; run format, typecheck, lint, build, seed/reset, tests proportional to change.
- Tests: pure rule -> unit; repository/transaction -> SQLite integration; route/schema/auth -> Fastify `app.inject()`.
- Destructive refactor -> characterization test first. Async UI -> stale-response, cancellation, error, retry coverage where relevant.
- Keep coverage focused; preserve QA exercise gaps. No Playwright frontend/API E2E tests unless task overrides.
- UI/business change -> verify customer journey. Keep failures deterministic and domain errors exact.
- One module -> one owner/reason to change. Review above 300 logical lines; split mixed responsibility before 400, never by line count alone. Generated source, migrations, fixtures, framework adapters, cohesive declarative renderers exempt with rationale.
- Type ownership: persistence rows -> repositories; transport types -> contracts; UI state -> owning feature/provider. Derive request types from schemas; avoid bypass casts.
- Async UI work aborts or ignores stale completion. Keep payment/auth secrets out of logs, persistent fingerprints, browser storage.
- TSDoc public/non-obvious contracts. Comments explain rationale, invariants, risk; never obvious code.
- Reuse established patterns before dependencies/frameworks. Keep business rules traceable frontend-to-backend.
- User-needed credentials, triggers, operator steps -> human-facing README. Stop only current-task servers.
