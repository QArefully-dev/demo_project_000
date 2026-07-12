# Demo Project Agent Instructions

## Project

Local department-store application for QA education and large-repository agent demos.

Priorities:

- familiar customer journey
- modern, predictable UI
- meaningful business-rule depth
- deterministic local execution
- low setup friction
- clear code navigation for humans and agents

## Context Sources

- `CLAUDE.md`: durable repository guardrails
- `plans/demo_project_high_level_plan.md`: current product direction, constraints, growth strategy
- task-specific plan or specification: named scope, acceptance criteria, sequencing
- code, manifests, migrations: current implementation truth

Read only plans relevant to current task. Do not treat old status, evidence, handoff, or completed orchestration files as active instructions unless user names them.

Conflict handling:

`explicit user request -> applicable task plan -> high-level plan -> repository defaults`

Unresolved product or course-behavior conflict -> stop and request decision.

## Product Guardrails

- keep main experience recognizable as ordinary webshop
- preserve direct journey: browse -> cart -> checkout -> order
- keep operational complexity behind familiar customer actions
- avoid required explanation of architecture or business domain
- keep optional admin or diagnostic surfaces outside normal customer journey
- check high-level plan before changing established course scenario
- avoid spoilers for later course material in earlier UI, code comments, filenames, or starter artifacts

## Runtime Guardrails

- cross-platform: Windows and macOS
- local-first: no required cloud service, account, API key, or network after install
- no Docker requirement
- one documented install flow and one development command
- deterministic seed and reset
- fake third-party integrations remain local and controllable
- first-run reliability outranks infrastructure realism

## Architecture Defaults

Current shape:

- npm workspaces monorepo
- React + Vite + TypeScript web application
- Fastify + TypeScript API
- SQLite persistence
- shared TypeScript contracts

Exact versions and scripts -> inspect workspace manifests.

Design rules:

- modular monolith by default
- frontend -> API contracts -> domain rules -> persistence
- backend authoritative for money, inventory, orders, payments, permissions
- integer minor units for money
- shared contract packages contain transport types and schemas, not domain behavior
- thin routes; business rules in named domain modules
- additive schema migrations; preserve existing user data
- external service split only when named demo requires distributed behavior

## Change Rules

- preserve unrelated user work
- make smallest coherent change satisfying current scope
- keep current public behavior unless task requests change
- avoid empty scaffolding, speculative abstraction, vendored code, generated-code padding
- do not edit `reference/` or `.cursor/` unless task explicitly includes them
- follow test scope defined by current task or active plan; do not add broad test suites by inference
- intentional course-visible behavior change -> inspect affected course artifacts before implementation

## Quality

- use repository scripts for formatting, type checking, linting, build, seed, reset, and tests
- run checks proportional to changed surface
- verify customer journey when UI or business behavior changes
- keep failures deterministic and reproducible
- preserve useful error boundaries and exact domain errors
- document seeded credentials, triggers, or operator steps in human-facing README when users need them
- stop only servers started by current task

## Code Style

- clear names, types, contracts, module boundaries
- TSDoc for public or non-obvious contracts
- comments explain rationale, invariants, or risk
- no comments narrating obvious code
- reuse established patterns before adding dependencies or frameworks
- keep business rules traceable across frontend and backend
