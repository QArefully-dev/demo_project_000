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
- preserve user work; no stash, reset, overwrite, unrelated commits
- required commands stay green: `npm run dev`, `seed`, `reset`, `typecheck`, `lint`, `format`

Out of scope:

- unit, integration, and E2E automated tests

## Root role

Root owns only:

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

## Context boundary

Root -> coordinator prompt:

- role and section name
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

1. Read full specification + `CLAUDE.md`.
2. Inspect status, branch, worktrees, branches, recent log.
3. Preserve unrelated work.
4. Create/resume integration branch and safe integration worktree.
5. Track plan/spec if needed in isolated bootstrap commit.
6. Install only missing/specified dependencies.
7. Run baseline `typecheck`, `lint`, `format`, `seed`.
8. Create state ledger with integration SHA and section states.
9. Return bootstrap envelope. Existing baseline failure -> blocked envelope with evidence path.

Dirty overlap, unsafe path, ambiguous user-owned change -> root decision. Non-overlapping dirt -> leave untouched.

## Section coordinator protocol

One coordinator owns section from `pending` through `complete`. Coordinator may implement directly or launch implementation specialist. Reviewer and merger must be distinct agents from implementer and from each other.

Coordinator lifecycle:

1. Read named specification section, global constraints, ownership map, dependency state.
2. Create section branch/worktree from latest eligible green integration SHA.
3. Implement; run section checks; commit.
4. Launch independent reviewer with minimal prompt and file paths.
5. On `changes requested`: fix -> commit -> same reviewer re-review. Repeat.
6. After approval, launch distinct merge specialist.
7. Merge specialist merges latest integration into section, resolves conflicts, reruns checks, merges `--no-ff` into integration, runs post-merge checks.
8. Coordinator writes evidence, updates ledger, commits both on integration.
9. Remove section branch/worktree only after green merge, evidence, ledger commit. Preserve failed/unmerged state.
10. Return one completion envelope to root.

Reviewer output -> findings by severity with file/line evidence. Blocking: invariant/scope breach, correctness/security bug, acceptance miss, ownership breach, required-check failure. Zero blocking findings -> `approved`.

Merge failure unrelated to conflict -> implementation/review loop. Never reset integration or discard valid work.

## Concurrency

Active agents <= available slots. Root reserves own slot.

- independent, non-overlapping section coordinators may run in parallel
- coordinator must reserve capacity before launching specialist
- excess work queued
- merges serialized against latest integration
- reviewer and merger separation mandatory; parallelism optional

## Waves and dependencies

Execution order:

`bootstrap -> Wave 0 -> Wave 1 -> Wave 2 -> Wave 3 -> final verification`

- Wave 0: `wave0`; serial; blocks all feature sections
- Wave 1 independent starts: `w1-a`, `w1-b`, `w1-c`
- `w1-d`: starts only after `w1-c` merged; all Wave 1 sections complete before Wave 2
- Wave 2: `w2-a` depends on `w1-a` + `w1-b`; `w2-b` depends on `w1-a`
- Wave 3: `wave3`; serial; starts after all Wave 2 sections complete

Between waves -> delegate gate verifier: confirm ledger/evidence commits, run `typecheck`, `lint`, `format`, write evidence, return envelope.

Ownership and handoffs live only in section specification. Root schedules from dependency list above; coordinator enforces file ownership.

## Recovery

Delegate recovery coordinator with state-ledger path and affected section only.

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

1. Confirm all section states `complete`; evidence and ledger committed.
2. Run `npm run reset` -> `npm run seed` -> exact seed assertions -> `npm run typecheck` -> `npm run lint` -> `npm run format`.
3. Run full Wave 3 smoke from clean reset state per specification.
4. Stop only task-started servers.
5. Confirm integration worktree clean; preserve unrelated main-worktree state.
6. Write and commit `final.md` evidence; return completion envelope with final SHA.

## Completion

Complete only when final-verification envelope reports `state: complete`, `checks: green`, clean integration worktree, no unresolved decision.

Final user report:

- integration branch + final SHA
- section merge SHAs from ledger
- gate and smoke result
- remaining concerns
- starting branch not auto-merged
