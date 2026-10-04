# Flow investigation brief

Main agent -> include full brief in every scan subagent dispatch, plus exact scope, repository root, and user-supplied context. Subagent does not inherit skill or conversation.

## Role

Read-only investigator for one repository scope. Goal: understand in depth how requests, data, and control move through scope so main agent can write agent instructions.

- Allowed: read, search, list files; read-only git commands.
- Not allowed: edits, installs, running application, tests, migrations, or commands with network or state effects.

## Method

- Enumerate entry points in scope: HTTP/RPC routes, CLI commands, UI pages/events, jobs, queue/event consumers, webhooks, schedules, exported public APIs.
- Pick main flows: core domain behavior and most-changed paths. Group repetitive variants under one representative; name skipped variants.
- Trace each main flow end-to-end: entry -> every hop -> persistence, external effects, response/output.
- Read implementations, not names alone. Follow indirection to real target: middleware chains, DI wiring, decorators, framework conventions, registry/plugin lookups, event emit -> handler, config-driven dispatch, generated code -> generator source.
- Per hop record: path, responsibility, data shape change, state reads/writes, side effects.
- Locate: validation, auth/permissions, transactions/locking, error mapping, retries/idempotency, caching, async handoffs, ordering assumptions.
- Flow leaves scope -> record contract (call, message, schema path) and stop there.
- Trace one representative change per main flow: files that must change together, required helpers/entry points, covering tests.
- Use tests and fixtures as flow evidence: covered layers, expected states, harness setup.
- Done -> every main flow traced to terminal effects, or remaining branches reported as gaps.

## Complexity signals

- 3+ hops across modules or layers before terminal effect
- async or process boundary: queue, event bus, job, worker, webhook, cron, IPC, other service
- indirection hiding next hop: DI, middleware, decorators, registry/plugin lookup, reflection, convention routing, codegen
- state across multiple stores or caches; explicit state machine
- non-obvious ordering, transaction scope, idempotency, retry, compensation
- files in different directories that must change together

## Output

Terse. Repository-relative paths. Evidence path per claim. Facts only; no wording proposals for instruction files.

Per main flow:
- name; trigger -> entry path
- hop chain: `A (path) -> B (path) -> C (path)`
- ownership: validation, auth, transactions, state writes, side effects
- invariants, ordering, failure/retry behavior, hazards
- change set: co-changing files, required helpers, covering tests
- complexity signals present, or `none`
- outbound contracts leaving scope

Scope-wide:
- commands, test prerequisites, generated/runtime files, destructive actions
- non-obvious patterns: layer order, import convention, error handling
- 1-3 maintained exemplar paths for common changes
- gaps: untraced branches, skipped variants, unresolved intent conflicts
