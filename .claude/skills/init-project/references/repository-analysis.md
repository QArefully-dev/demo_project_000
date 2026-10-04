# Repository analysis

## Scan

Evidence order: executable config/code -> tests/CI -> maintained docs -> existing instructions -> user context.

Main agent root scan -> shallow; enough to brief investigators:

- main applications, services, packages, infrastructure, and test harnesses
- runtime and package-manager requirements
- exact install, run, build, check, and test commands
- entry points per boundary: routes, CLI commands, UI entry, jobs, consumers, webhooks, schedules
- destructive actions, generated boundaries, external effects, and common traps
- documentation paths to reference instead of repeat

Investigator scans -> where-to-look and rationale per references/scope-investigation.md. Main agent merges findings and reads code, plans, and git history to close gaps.

## Select content

Except for runtime requirements and exact commands, write only where to look and why it was built in a specific way. Never describe execution order.

Keep:

- boundary purpose and allowed dependency direction
- where to look: authoritative definitions, entry points, extension points, shared helpers
- why: architecture decisions and their reasons, only when not obvious from code
- ownership of validation, state, permissions, and side effects
- durable domain or safety invariants, each with reason
- fastest relevant validation and unusual test prerequisites
- plausible wrong turns not obvious from nearby code
- implementation rules enforced by code or tests that agents could easily bypass: layer order, shared helpers, transaction handling, import syntax, public error handling, validation ownership
- 1-3 maintained exemplar paths for common changes

Format: `path -> what it owns; why: reason`. Rationale without evidence -> omit.

Drop:

- code narration: hop chains, call sequences, step-by-step request paths, per-file change sets
- file, symbol, route, dependency, or environment-variable inventories
- timings, counts, temporary status
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

## Shape

Root sections as useful: repository map, runtime, commands, architecture/domain, testing, agent hints, maintenance.

Add `## Testing` only where test structure or setup changes agent decisions. Cover relevant layers/frameworks, file or config locations, harnesses/fixtures/providers, prerequisites, and E2E ownership. Keep runnable commands only in `## Commands`; do not repeat them under Testing.

Nested files contain only local where-to-look, local rationale, local commands, local testing, and local hazards. Never create nested files beyond two Custom Blend files.
