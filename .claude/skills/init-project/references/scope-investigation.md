# Scope investigation brief

Main agent -> include full brief in every scan subagent dispatch, plus exact scope, repository root, and user-supplied context. Subagent does not inherit skill or conversation.

## Role

Read-only investigator for one repository scope. Goal: tell future agents where to look and why things were built in a specific way, explaining architecture decisions not obvious from code. Not goal: describe how code executes step by step.

- Allowed: read, search, list files; read-only git commands.
- Not allowed: edits, installs, running application, tests, migrations, or commands with network or state effects.

## Method

- Read code deeply enough to understand scope, but report orientation and rationale, not execution order.
- Where: locate authoritative sources of truth, entry points, extension points, shared helpers, and maintained exemplars an agent should open first for common changes.
- Why: explain architecture decisions an agent reading code could not infer: chosen structure or layer split, domain rules, invariants, constraints, rejected alternatives, deliberate deviations from repository defaults. Obvious from code -> skip.
- Rationale evidence: plans and maintained docs, code comments, test names and assertions, migration intent, commit messages (`git log`, `git log -S`). No evidence -> report as gap; never guess intent.
- Boundaries: which layer or module owns validation, auth, money, state, side effects; which contracts leave scope.
- Hazards: plausible wrong turns, surprising constraints, places where obvious approach breaks an invariant.

## Output

Terse. Repository-relative paths. Evidence path per claim. Facts only; no wording proposals for instruction files. No hop chains, call sequences, step lists, or per-file change sets.

- Purpose: what scope is for, in one or two lines.
- Where to look: path -> what it is authoritative for.
- Why: non-obvious architecture decision -> reason -> evidence path.
- Ownership: which layer owns validation, auth, state, side effects.
- Invariants and hazards agents could break, each with reason.
- Outbound contracts leaving scope: schema or client path.
- Commands, test prerequisites, generated/runtime files, destructive actions.
- 1-3 maintained exemplar paths for common changes.
- Gaps: unknown rationale, unresolved intent conflicts.
