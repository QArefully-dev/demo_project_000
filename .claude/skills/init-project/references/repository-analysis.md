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

Investigator scans -> map candidates and rationale per references/scope-investigation.md.

## Select content

Except for runtime requirements and exact commands, write only capped maps and why it was built in a specific way. Never describe execution order.

Keep:

- boundary purpose and allowed dependency direction
- capped maps per `## Maps`
- why: architecture decisions and their reasons, only when not obvious from code
- ownership of validation, state, permissions, and side effects
- durable domain or safety invariants, each with reason
- fastest relevant validation and unusual test prerequisites
- plausible wrong turns not obvious from nearby code
- implementation rules enforced by code or tests that agents could easily bypass: layer order, shared helpers, transaction handling, import syntax, public error handling, validation ownership

Rationale without evidence -> omit.

Drop:

- code narration: hop chains, call sequences, step-by-step request paths, per-file change sets
- file, symbol, route, dependency, or environment-variable inventories beyond capped maps
- timings, counts, temporary status
- literal business values (amounts, percentages, durations, sizes) -> name constant and defining path instead
- generic advice or host-provided agent workflow
- duplicated parent guidance or human documentation
- unsupported claims

## Maps

Purpose: help future agents find code fast. Add entry only when it helps that; not helpful or unsure -> omit. Limits are caps, not targets.

- Format: one list item per entry, `` - `path` -> description `` or `` - `path` `Symbol` -> description ``. Forward slashes even on Windows.
- Root `## Repository Map`: max 8 main directories; short description of purpose and owned concern. No files, classes, or methods.
- Nested `## Map`: max 6 entries in total across core directories, files, classes, and methods. Prefer sources of truth, entry points, and extension points over leaf components.
- Short description: what it owns, plus non-obvious why when useful. No behavior narration.
- Entry already obvious from directory name or parent map -> omit.

## Commands

Root `## Commands` -> max 10 lines. Group related commands on one line per purpose instead of one command per line:

- setup/run: install, dev/run, seed
- checks: typecheck, lint, format, custom static guards
- tests: per-layer or per-kind test commands
- gates: aggregate scripts with what each runs
- scoped runs: one pattern line (workspace, package, single test) with placeholder instead of per-target commands; only patterns that actually scope per manifest script
- destructive: own line; impact and required authorization

Keep every command agents routinely run; drop only one-off, internal, or CI-only scripts. Short purpose notes inline in parentheses. Custom Blend-only commands -> matching nested file.

## Shape

Root sections as useful: `## Repository Map`, runtime, commands, architecture/domain, testing, agent hints, maintenance.

Add `## Testing` only where test structure or setup changes agent decisions. Per test type: location pattern (e.g. colocated vs separate test directory), harness or fixtures, unusual prerequisites. No test file lists; agents find files by pattern.

Single-file run -> one pattern per test type with `<path>` placeholder, verified against manifest script: script with fixed globs may ignore or add to extra args; then give direct runner invocation instead. Root `## Commands` owns repository-wide commands; nested `## Testing` holds only scope-specific run patterns; never repeat a command between them.

Nested files contain only local `## Map`, local rationale, local commands, local testing, and local hazards.
