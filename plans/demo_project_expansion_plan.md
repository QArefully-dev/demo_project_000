# Demo Project Expansion — Root Orchestration Plan

Status: approved, ready.

Root reads this file. Section coordinators read [demo_project_expansion_spec.md](demo_project_expansion_spec.md), named section, and [CLAUDE.md](../CLAUDE.md).

## Goal

Expand electronics shop through one orchestrated session. Root stays control plane. Subagents perform setup, implementation, review, merge, verification, evidence capture.

## Fixed constraints

- preserve M1: unchanged FE 5-item gate; `SAVE10` percent 10, minimum 5 items; scalar promo code
- money: integer cents, backend-authoritative, reuse `MoneyCents`
- guest checkout remains functional
- no native dependencies; only allowed new dependency: `@fastify/cookie`; password hashing: `node:crypto` scrypt
- no edits under `reference/` or `.cursor/`
- no later-course spoilers in UI, comments, filenames
- all subagents inherit model from main agent -> `deepseek/deepseek-v4-pro`; don't override
- preserve user work; no stash, reset, overwrite, unrelated commits
- required commands stay green: `npm run dev`, `seed`, `reset`, `typecheck`, `lint`, `format`

Out of scope:

- unit, integration, and E2E automated tests

## Root role

Root owns only:

- delegation harness preflight
- coordinator scheduling
- dependency and concurrency decisions
- compact state ledger
- scope/invariant arbitration
- user-authority escalation
- final completion summary

Root does not:

- create worktrees or branches
- implement or edit section code
- run routine checks or smoke tests
- inspect full diffs, logs, reports, or section specification unless escalation requires it
- launch implementation, review, and merge specialists separately
- receive detailed specialist output

Root delegates bootstrap, each section lifecycle, wave gates, and final verification.

## Delegation harness preflight

Run before bootstrap or repository mutation:

1. Root spawns probe coordinator with plan path, unique nonce, no-write constraint.
2. Probe coordinator spawns probe worker. Worker reads plan heading, returns heading + nonce, makes no file or repository change.
3. After worker completes, probe coordinator spawns independent probe reviewer with worker result. Reviewer validates heading + nonce, returns `approved`, makes no file or repository change.
4. Probe coordinator returns `preflight: passed | blocked`, worker spawn result, reviewer spawn result, blocker.
5. `passed` requires successful coordinator, worker, and reviewer spawns plus reviewer approval.
6. Any spawn failure, unsupported nested delegation, timeout, invalid result, or repository mutation -> global delegation stop.

Root starts bootstrap only after `preflight: passed`. Probe agents terminate before bootstrap.

## Delegation failure rule

Every coordinator must spawn needed worker subagent(s) and independent reviewer subagent. Section merge also requires distinct merge subagent. Coordinator must not implement product code, review, merge, run delegated checks, or substitute for failed nested delegation. Coordinator may edit only orchestration artifacts: evidence files and state ledger.

Required spawn failure for any reason, including harness or permission limits -> coordinator returns blocked envelope with `decision: nested delegation unavailable` and exact spawn error when possible -> global delegation stop.

Global delegation stop:

1. Affected coordinator stops before further repository mutation.
2. Root tells every active coordinator to stop.
3. Root cancels remaining agents when possible.
4. Preserve existing branches, worktrees, commits, evidence, and user work.
5. Root launches no fallback specialist and performs no implementation.
6. Root informs user immediately with failing role and exact spawn error.

No bootstrap, section, wave, recovery, or final verification continues after global delegation stop. User must resolve harness limit or explicitly replace orchestration design.

## Context boundary

Root -> coordinator prompt:

- role and section name
- delegation failure rule + required worker/reviewer/merger roles
- integration branch/worktree path
- starting SHA or dependency state
- paths to this plan, section specification, `CLAUDE.md`, state ledger
- available concurrency limit

Use minimal context fork. Do not paste plan, specification, diffs, or prior logs into prompt.

Coordinator -> root completion envelope, maximum 10 lines:

```text
section: <name>
state: complete | blocked
base: <sha>
merge: <sha | none>
checks: green | failed
evidence: <path>
decision: none | <root decision needed>
blocker: none | <concise blocker>
```

Detailed changed files, commands, outputs, acceptance evidence, manual checks, review findings, conflict notes -> `plans/demo_project_expansion_evidence/<section>.md`. Coordinator commits evidence and status updates. Root opens evidence only for arbitration or final-summary gaps.

Specialist reports terminate at coordinator. Coordinator returns one envelope after full section lifecycle.

## Repository topology

- integration branch: `codex/demo-project-expansion`
- integration worktree: `../demo_project_000-worktrees/integration` when current worktree cannot serve
- section branch: `codex/demo-expansion-<section>`
- section worktree: `../demo_project_000-worktrees/<section>`
- evidence: `plans/demo_project_expansion_evidence/<section>.md`
- state ledger: `plans/demo_project_expansion_status.md`

All resolved worktree paths must stay under configured worktree root.

## Bootstrap coordinator

Delegate before section work:

1. Spawn bootstrap worker. Spawn failure -> global delegation stop.
2. Worker reads full specification + `CLAUDE.md`.
3. Worker inspects status, branch, worktrees, branches, recent log.
4. Worker preserves unrelated work.
5. Worker creates/resumes integration branch and safe integration worktree.
6. Worker tracks plan/spec if needed in isolated bootstrap commit.
7. Worker installs only missing/specified dependencies.
8. Worker runs baseline `typecheck`, `lint`, `format`, `seed`.
9. Worker creates state ledger with integration SHA and section states.
10. After worker reports, spawn independent reviewer. Spawn failure -> global delegation stop.
11. Reviewer checks bootstrap state, evidence, safety, and required command results. Blocking findings -> worker fix -> same reviewer re-review.
12. Coordinator returns bootstrap envelope. Existing baseline failure -> blocked envelope with evidence path.

Dirty overlap, unsafe path, ambiguous user-owned change -> root decision. Non-overlapping dirt -> leave untouched.

## Section coordinator protocol

One coordinator owns section from `pending` through `complete`. Coordinator must spawn implementation worker, independent reviewer, and distinct merger. All three must be distinct agents. Coordinator orchestrates only.

Coordinator lifecycle:

1. Read named specification section, global constraints, ownership map, dependency state.
2. Spawn implementation worker; reserve later capacity for independent reviewer and distinct merger. Spawn failure -> global delegation stop.
3. Implementation worker creates section branch/worktree from latest eligible green integration SHA.
4. Implementation worker implements, runs section checks, commits, and reports to coordinator.
5. After worker reports, spawn independent reviewer with minimal prompt and file paths. Spawn failure -> global delegation stop.
6. On `changes requested`: implementation worker fixes -> commits -> same reviewer re-reviews. Repeat.
7. After approval, spawn distinct merge specialist. Spawn failure -> global delegation stop.
8. Merge specialist merges latest integration into section, resolves conflicts, reruns checks, merges `--no-ff` into integration, runs post-merge checks.
9. Coordinator writes evidence, updates ledger, commits both on integration; reviewer validates resulting state.
10. Remove section branch/worktree only after green merge, evidence, ledger commit. Preserve failed/unmerged state.
11. Return one completion envelope to root.

Reviewer output -> findings by severity with file/line evidence. Blocking: invariant/scope breach, correctness/security bug, acceptance miss, ownership breach, required-check failure. Zero blocking findings -> `approved`.

Merge failure unrelated to conflict -> implementation/review loop. Never reset integration or discard valid work.

## Concurrency

Active agents <= available slots. Root reserves own slot.

- independent, non-overlapping section coordinators may run in parallel
- coordinator must reserve capacity before launching specialist
- excess work queued
- merges serialized against latest integration
- reviewer and merger separation mandatory; parallelism optional
- inability to reserve capacity -> queue; unsupported or failed required spawn -> global delegation stop

## Waves and dependencies

Execution order:

`delegation preflight -> bootstrap -> Wave 0 -> Wave 1 -> Wave 2 -> Wave 3 -> final verification`

- Wave 0: `wave0`; serial; blocks all feature sections
- Wave 1 independent starts: `w1-a`, `w1-b`, `w1-c`
- `w1-d`: starts only after `w1-c` merged; all Wave 1 sections complete before Wave 2
- Wave 2: `w2-a` depends on `w1-a` + `w1-b`; `w2-b` depends on `w1-a`
- Wave 3: `wave3`; serial; starts after all Wave 2 sections complete

Between waves -> delegate gate coordinator. Coordinator spawns verification worker. Worker confirms ledger/evidence commits, runs `typecheck`, `lint`, `format`, writes evidence. After worker reports, coordinator spawns independent reviewer. Reviewer validates evidence and results. Coordinator returns envelope. Any required spawn failure -> global delegation stop.

Ownership and handoffs live only in section specification. Root schedules from dependency list above; coordinator enforces file ownership.

## Recovery

Delegate recovery coordinator with state-ledger path and affected section only. Recovery coordinator spawns needed recovery worker, independent reviewer, and distinct merger when merge work exists. Spawn failure -> global delegation stop.

- existing section commit without approval -> fresh reviewer
- approved, unmerged -> merge specialist
- merged, missing evidence/ledger/checks -> finish coordinator protocol
- failed/timed-out implementation -> preserve branch/worktree; resume same coordinator when possible; otherwise replacement reads evidence + diff
- reviewer disagreement -> coordinator summarizes exact disputed rule and options in root envelope
- post-merge failure -> repair branch; reviewed fix; unsafe repair -> reviewed `git revert`; never reset integration
- frozen-file conflict, ambiguous user change, same blocker across 3 attempts -> blocked envelope; independent sections continue

Root reads detailed evidence only when concise decision field cannot support arbitration.

## Final verification coordinator

After `wave3` complete:

1. Spawn final-verification worker. Spawn failure -> global delegation stop.
2. Worker confirms all section states `complete`; evidence and ledger committed.
3. Worker runs `npm run reset` -> `npm run seed` -> exact seed assertions -> `npm run typecheck` -> `npm run lint` -> `npm run format`.
4. Worker runs full Wave 3 smoke from clean reset state per specification.
5. Worker stops only task-started servers.
6. Worker confirms integration worktree clean; preserves unrelated main-worktree state.
7. Worker writes and commits `final.md` evidence.
8. After worker reports, spawn independent reviewer. Spawn failure -> global delegation stop.
9. Reviewer validates final state, evidence, checks, smoke results, clean integration worktree, and SHA.
10. Coordinator returns completion envelope with final SHA.

## Completion

Complete only when final-verification envelope reports `state: complete`, `checks: green`, clean integration worktree, no unresolved decision.

Final user report:

- integration branch + final SHA
- section merge SHAs from ledger
- gate and smoke result
- remaining concerns
- starting branch not auto-merged
