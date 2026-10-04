# Repository analysis

## Scan

Evidence order: executable config/code -> tests/CI -> maintained docs -> existing instructions -> user context.

Main agent root scan -> shallow; enough to choose boundaries and brief investigators:

- main applications, services, packages, infrastructure, and test harnesses
- runtime and package-manager requirements
- exact install, run, build, check, and test commands
- flow entry points per boundary: routes, CLI commands, UI entry, jobs, consumers, webhooks, schedules
- destructive actions, generated boundaries, external effects, and common traps
- documentation paths to reference instead of repeat

Investigator scans -> deep flow tracing per references/flow-investigation.md. Main agent merges findings, joins flows crossing scopes via reported contracts, and reads code to close gaps.

## Select content

Except for runtime requirements and exact commands, prefer where and why over current implementation detail.

Keep:

- boundary purpose and allowed dependency direction
- authoritative definitions and extension points
- ownership of validation, state, permissions, and side effects
- doc-worthy flows per `## Flows`
- durable domain or safety invariants
- fastest relevant validation and unusual test prerequisites
- plausible wrong turns not obvious from nearby code
- implementation rules enforced by code or tests that agents could easily bypass: layer order, shared helpers, transaction handling, import syntax, public error handling, validation flow
- exact helper or entry-point paths when using the wrong path would break a boundary
- 1-3 maintained exemplar paths for common changes

Drop:

- file, symbol, route, dependency, or environment-variable inventories
- timings, counts, temporary status
- line-by-line code narration; flows obvious from entry point and adjacent files
- generic advice or host-provided agent workflow
- duplicated parent guidance or human documentation
- unsupported claims

## Commands

Root `## Commands` -> max 10 lines. Group related commands on one line per purpose instead of one command per line:

- setup/run: install, dev/run, seed
- checks: typecheck, lint, format, custom static guards
- tests: per-layer or per-kind test commands
- gates: aggregate scripts with what each runs
- scoped runs: one pattern line (workspace, package, single test) with example instead of per-target commands
- destructive: own line; impact and required authorization

Keep every command agents routinely run; drop only one-off, internal, or CI-only scripts. Short purpose notes inline in parentheses. Custom Blend-only commands -> matching nested file.

## Flows

Doc-worthy flow -> investigator reports at least one complexity signal, and agent changing flow would otherwise trace multiple files or boundaries to find required hops. Otherwise omit.

Placement -> `## Flows` per SKILL.md Workflow step 5: cross-app or non-Custom Blend -> root; API-only Custom Blend -> `apps/api/src/features/customBlend/AGENTS.md`; web-only Custom Blend -> `apps/web/src/features/customBlend/AGENTS.md`. One flow lives in one file; never split or repeat it.

Per flow:

- name; trigger -> entry path
- hop chain: `A (path) -> B (path) -> C (path)`, marking async and process/service boundaries
- where validation, auth, transactions, state writes, and side effects happen
- invariants, ordering, failure/retry behavior agents could break
- change set: files that must change together, required helpers

Durable granularity: module/file hops and responsibilities. No line numbers, function bodies, or transient config values.

## Shape

Root sections as useful: repository map, runtime, commands, architecture/domain, flows, testing, agent hints, maintenance.

Add `## Testing` only where test structure or setup changes agent decisions. Cover relevant layers/frameworks, file or config locations, harnesses/fixtures/providers, prerequisites, and E2E ownership. Keep runnable commands only in `## Commands`; do not repeat them under Testing.

Nested files contain only local architecture, local flows, local commands, local testing, and local hazards. Never create nested files beyond two Custom Blend files.
