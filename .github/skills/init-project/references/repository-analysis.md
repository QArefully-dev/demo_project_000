# Repository analysis

## Scan

Current behavior evidence: executable config/code -> tests/CI -> maintained docs -> existing instructions. User context supplies intent and constraints; surface conflicts.

Start shallow. Find:

- main applications, services, packages, infrastructure, and test harnesses
- runtime and package-manager requirements
- exact install, run, build, check, and test commands
- dependency direction, state authority, and source-of-truth locations
- destructive actions, generated boundaries, external effects, and common traps
- documentation paths to reference instead of repeat
- one representative change through each main application boundary
- non-obvious required patterns: layer order, shared helpers, transaction handling, import syntax, public error handling, and validation flow
- 1-3 maintained exemplar paths when they prevent likely mistakes

Use supporting paths. Expand only where evidence changes agent decisions.

## Select content

Except runtime requirements and exact commands, prefer where and why over current implementation detail.

Keep:

- boundary purpose and allowed dependency direction
- authoritative definitions and extension points
- ownership of validation, state, permissions, and side effects
- durable domain or safety invariants
- fastest relevant validation and unusual test prerequisites
- plausible wrong turns not obvious from nearby code
- implementation rules enforced by code or tests that agents could easily bypass
- exact helper or entry-point paths where wrong path breaks boundary
- few exemplar paths for common changes

Drop:

- file, symbol, route, dependency, or environment-variable inventories
- timings, counts, temporary status, and prose versions of code flow
- generic advice or host-provided agent workflow
- duplicated parent guidance or human documentation
- unsupported claims

## Shape

Root sections as useful: repository map, runtime, commands, architecture/domain, testing, agent hints, maintenance.

Add `## Testing` only where test structure or setup changes agent decisions. Cover relevant layers/frameworks, file or config locations, harnesses/fixtures/providers, prerequisites, and E2E ownership. Keep runnable commands only in `## Commands`; do not repeat them under Testing.

User-suggested nested directories -> return local architecture, commands, testing, and hazards. No local findings -> report evidence gap. Main agent selects content; never propose additional nested files.
