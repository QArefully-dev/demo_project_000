---
name: write-orchestrator-coding-plan
description: Write repository-grounded, coding-oriented implementation plans for orchestrator agents. Use when user supplies roadmap section, high-level plan item, feature lane, epic, backlog slice, or product direction and wants execution-ready coding plan. Inspect codebase before planning; specify architecture, data, contracts, API, UI, tests, sequencing, parallel subagent lanes, file ownership, dependency gates, convergence, and verification. Do not use for direct implementation or non-technical project plans.
---

# Write Orchestrator Coding Plan

Turn selected high-level scope into coding plan orchestrator can execute through coordinated subagents. Produce plan only unless user also requests implementation. Require runtime implementation in dedicated Git worktree created from current branch.

## Input Gate

Collect:

- selected section: exact heading or quoted scope
- source plan: full plan path or supplied content
- repository: current workspace unless user names another
- output path: user choice or repository plan convention

Read full source plan around selected section. Preserve global constraints, delivery order, completed foundations, terminology, and exclusions.

Ask concise user questions before writing when uncertainty changes product behavior, scope boundary, compatibility promise, or architecture materially. Ask only questions code and existing plans cannot answer. Do not bury blocking uncertainty in assumptions.

Use explicit assumptions for minor non-blocking gaps. Mark each assumption for orchestrator validation.

## Repository Audit

Treat current code as implementation truth. Inspect before designing:

1. Read applicable `AGENTS.md`, `CLAUDE.md`, repository instructions, source plan, package manifests, workspace config.
2. Map relevant vertical slice: schema/migrations -> domain rules -> persistence -> services -> contracts -> routes -> client state -> UI -> tests -> seed/tooling.
3. Search exact paths, symbols, routes, tables, types, scripts, tests, and composition points. Prefer `rg` and `rg --files`.
4. Distinguish existing behavior, partial foundation, missing scope, obsolete plan claims, and user-owned in-progress work.
5. Identify compatibility constraints: persisted data, public contracts, URLs, auth, transactions, idempotency, ordering, deterministic fixtures, platform support.
6. Read focused implementation and tests deeply enough to propose concrete changes. Avoid filename-only inference.

Record evidence with repository-relative paths and symbol names. Label new paths as `proposed`; never present invented paths or symbols as existing.

If repository access is unavailable, ask user for required files or permission to produce clearly labeled provisional plan.

## Plan Design

Design working vertical slices, not layer scaffolding. Each slice must deliver named behavior plus focused verification.

Cover relevant coding details:

- behavior: user flows, domain states, transitions, failure paths, permissions
- data: tables, columns, constraints, indexes, ordered migrations, existing-data compatibility
- domain: invariants, pure rules, commands, queries, errors, transaction boundaries
- persistence: repositories, atomicity, concurrency, allowlisted ordering/filtering, rollback behavior
- contracts/API: shared schemas, request/response shape, status/error mapping, pagination, idempotency
- UI: routes, state authority, loading/empty/error states, accessibility, responsive integration
- cross-cutting: audit, logging, notifications, feature flags, seed/reset, security, privacy
- verification: critical unit, contract, route, SQLite integration, React integration, accessibility, manual checks

Omit irrelevant layers. Prefer extension of established patterns over new abstractions. Name non-goals to prevent scope drift.

## Runtime Worktree Contract

Treat planning checkout as source checkout. Runtime orchestrator must isolate every new implementation:

1. Before any implementation write, record source checkout absolute path, current branch, and `HEAD` revision.
2. Require named current branch. If source checkout uses detached `HEAD`, stop and ask user to select branch.
3. If relevant uncommitted or untracked source-checkout changes are absent from branch `HEAD`, stop and ask user to commit them or choose baseline. Never copy, stash, discard, or import them without explicit approval.
4. Create unique implementation branch and dedicated worktree from recorded current branch `HEAD`: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`.
5. Verify worktree branch and base revision before `G0`. Record source branch, source revision, worktree branch, and absolute worktree path in checkpoint.
6. Run all implementation edits, generated-file writes, tests, reviews, fixes, convergence, and final verification inside worktree. Keep source checkout read-only after worktree creation, except saved plan and run-scoped temp state.
7. Include worktree context in every worker and reviewer assignment. Resolve repository-relative paths against worktree root. Run every assigned command with worktree as working directory.
8. Never merge, rebase, cherry-pick, copy changes, delete worktree, or remove implementation branch at completion. User owns integration into source branch.
9. Final orchestrator reply must report absolute worktree path, implementation branch, source branch, and base revision. State worktree remains intact and user will handle merge.

One runtime run -> one shared implementation worktree. Parallel subagents use disjoint ownership inside same worktree; do not create per-packet worktrees unless user explicitly requests them.

## Orchestration Model

Build dependency graph before phase prose.

Notation:

- sequence: `A -> B -> C`
- parallel: `A || B || C`
- gated fan-out: `G0 -> {A || B} -> G1 -> C`

Mark work parallel only when all conditions hold:

- upstream interface stable or owned prerequisite finishes first
- file ownership disjoint
- schema/migration ordering independent and reserved
- shared contracts, package exports, routes, and composition files not edited concurrently
- each lane independently testable
- merge order does not alter behavior

Keep work sequential when lanes share migration state, contract definitions, central registration, transaction boundary, package export, route registry, seed authority, or page composition. Alternative: assign single owner for shared surface, finish prerequisite, then fan out consumers.

Use convergence task after parallel lanes. Convergence owner handles shared composition, cross-lane tests, final verification, and conflict resolution. Do not assign multiple agents same file unless tasks are explicitly sequential.

Plan for orchestrator, not generic team:

- create bounded work packets suitable for one subagent
- project minimum context needed for packet execution
- give each packet stable ID, dependencies, owned paths, steps, invariants, verification, handoff
- state which packets launch together and which wait
- identify blocker checks before downstream launch
- reserve integration ownership explicitly
- avoid arbitrary parallelism based only on different conceptual features

Context projection per assignment:

`plan -> packet objective + acceptance criteria + owned paths + focused reads + relevant invariants + accepted upstream inputs + relevant evidence + non-goals`

- Include only paths, symbols, decisions, interfaces, evidence, and exclusions needed by role and packet.
- Never send full source plan, generated plan, prior reports, global evidence ledger, closed findings, or unrelated packet state unless packet needs exact portion.
- Prefer artifact reference plus named section over pasted content when subagent can read shared filesystem.
- Resolve upstream reports into accepted inputs. Do not forward whole reports.
- Send only evidence covering packet scope or review target. Exclude unrelated ledger entries.
- Keep orchestrator prompt compact. Current checkpoint holds state; event messages do not become working memory.

## Orchestrator-Subagent Communication

Apply `$llm-oriented-markdowns` to every orchestrator-subagent message. For JSON, apply its terse prose rules to all string values: no articles, filler, pleasantries, hedging, decorative text, or repeated context. Preserve code, commands, paths, identifiers, and errors exactly.

Every message must use one JSON object matching one template below. No free-text wrapper before or after JSON. Keep every defined key. Required key does not imply required content. Never invent content only to populate field. Use `[]` when no applicable collection entries exist. Use `null` only where template explicitly marks scalar or object nullable. Never use `{}` as generic absence value. Orchestrator rejects malformed reports and requests corrected JSON.

Field population:

- always non-empty: envelope identity; assignment objective, acceptance criteria, steps, owned/read scope where duty requires them; exact review target; directive instructions; report status or verdict and summary; report contract
- conditionally non-empty: `remaining_work` for partial worker report; `blockers` for blocked report; `findings` for `changes_requested`; `finding_ids` for finding fix; evidence after command assessment or execution; upstream inputs after prerequisite acceptance; handoff data when downstream consumer exists
- optional, default `[]`: constraints, invariants, non-goals, risk focus, questions, artifacts, `observations_notes`, prior evidence, dependencies, handoff targets, state blockers/questions/findings/handoffs/decisions/invalidations. Populate only when applicable facts exist.
- packet-specific facts only. Do not copy acceptance criteria into invariants, implementation steps into constraints, or repository-wide instructions into packet fields.

Default transport: pass complete JSON object directly in message context. Never put status, blockers, questions, findings, or concise completion evidence only in file.

Use run-scoped temp files only for bulky logs, generated artifacts, large diffs, or data needed after context compaction. Requirements:

- shared filesystem confirmed
- unique path: `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]`
- inline report keeps artifact summary, path, format, and SHA-256
- no routine reports or temp artifacts written into repository
- orchestrator owns cleanup after final gate

Canonical templates:

- worker assignment: [`templates/communication/worker-assignment.json`](templates/communication/worker-assignment.json)
- reviewer assignment: [`templates/communication/reviewer-assignment.json`](templates/communication/reviewer-assignment.json)
- directive: [`templates/communication/orchestrator-directive.json`](templates/communication/orchestrator-directive.json)
- worker report: [`templates/communication/worker-report.json`](templates/communication/worker-report.json)
- reviewer report: [`templates/communication/reviewer-report.json`](templates/communication/reviewer-report.json)
- run-state checkpoint: [`templates/communication/orchestrator-run-state.json`](templates/communication/orchestrator-run-state.json)
- non-empty object entries: [`references/communication-record-shapes.md`](references/communication-record-shapes.md)

Read all six templates and record-shape reference completely before generating plan. Treat field names, message types, role values, and structure as fixed. Replace required placeholders with packet-specific values. Leave optional arrays empty unless applicable facts exist. Populate applicable object arrays with exact record shapes from reference. Shared envelope keys: `schema_version`, `message_type` or `state_type`, `message_id` for messages, `run_id`, role, packet identity where applicable. Use directive for clarification answers, scope corrections, finding fixes, protocol corrections, continuation, or stop instructions. Report standard facts in dedicated fields. Use `observations_notes` only for relevant information not represented elsewhere.

- `message_id`: unique within run.
- `in_reply_to`: exact assignment, directive, or report message being answered.
- `assignment_revision`: active full assignment revision.
- `action=fix`, `target_role=worker`: implementation correction; include stable `finding_ids`.
- `action=fix`, `target_role=reviewer`: report or protocol correction only; never implementation work.
- Narrow clarification, fix, continuation, or stop -> directive references active revision.
- Objective, ownership, acceptance, review target, or verification-duty change -> reissue full role assignment with incremented revision.

Do not copy whole contracts into generated plan when canonical versioned templates remain accessible to runtime orchestrator. Reference template path plus contract name. Embed contract only when plan must be portable outside repository.

Planning/runtime boundary:

1. Planning session inspects repository and saves plan.
2. Runtime orchestrator starts with fresh context. Do not carry planning conversation, audit logs, or tool output.
3. Runtime orchestrator loads saved plan, repository instructions, canonical contracts, and compact checkpoint only.
4. Each subagent starts with fresh or minimal context plus one role assignment, applicable repository instructions, and relevant artifact references. Never inherit orchestrator transcript or unrelated parent context.
5. Follow-up session receives current assignment revision, applicable directive, and relevant checkpoint projection only.

Runtime state:

- `orchestrator_run_state_v1`: canonical recovery snapshot and current state, not transcript.
- location: `[platform temp root]/orchestrator/[run_id]/state.json`; atomically replace current snapshot.
- Worktree identity: source checkout path, source branch, base revision, implementation branch, absolute worktree path.
- Track packet states, assignment revisions, active blockers/questions, actionable finding facts plus lifecycle, accepted handoffs/interfaces, evidence ledger, decisions, and invalidations.
- Update snapshot after accepted report, directive, finding transition, decision, handoff, or evidence invalidation.
- Inline messages remain events. Do not append event history to checkpoint.
- Recover from saved plan + current checkpoint + referenced artifacts. Do not replay full message history.

Worker report rules:

- completion: `status=complete`, no blockers, assigned outcome and verification duties satisfied
- partial: useful work exists; unfinished assigned work listed in `remaining_work`
- blocked: no safe progress possible, exact need stated in `needed_from_orchestrator`
- blockers: actual blocking conditions only; never use for ordinary remaining work
- failed test: preserve exact error in `output_summary`; do not relabel packet complete unless failure proven unrelated and recorded in `observations_notes`
- artifact absent: `artifacts=[]`; never invent path or digest
- free notes: observations only; no duplicate summary, changes, tests, blockers, questions, or findings

Reviewer report rules:

- `verdict=pass`: target reviewed; no required findings; evidence adequate
- `verdict=changes_requested`: review complete; one or more required findings
- `verdict=blocked`: exact missing target, context, decision, or evidence named in blockers
- stable `finding_id`: preserve through fix assignment and closure
- `reviewed_target.change_set`: exact inspected state; never report moving or implicit target
- no implementation changes or handoff fields; reviewer inspect-only
- artifact absent: `artifacts=[]`; never invent path or digest
- free notes: observations only; no duplicate summary, evidence, blockers, questions, or findings

## Test and Review Protocol

Assign each test command to one packet or gate. Orchestrator maintains verification ledger across subagent sessions:

- evidence ID
- command and scope
- revision or change set
- result
- runner
- invalidating paths or dependencies
- terse output summary or exact error

Reuse passing evidence when command covers current code and no relevant file, dependency, migration, contract, config, or fixture changed afterward. New session alone never invalidates evidence. Give each agent relevant ledger entries only; instruct agent not to rerun valid commands.

Schedule tests at deliberate points:

- worker completion: run smallest focused tests covering worker changes; skip commands already run against same resulting code state
- parallel fan-in: convergence owner runs shared integration tests once after all lanes finish
- review fix: fixing worker runs smallest affected test after fix unless valid post-fix evidence already exists
- final gate: final owner runs broad required suite once after integration and review fixes settle
- later change: invalidate only affected ledger entries; rerun smallest affected commands, then rerun broad suite only when change invalidates final result

Reviewer default: inspect exact assigned change set, invariants, contracts, and supplied relevant evidence without writes or test runs. Reviewer runs command only when assignment names command or evidence is missing/stale and verdict cannot finish through inspection. Never rerun full suite for review confidence alone.

Issue flow: `stable reviewer finding ID -> worker-targeted fix directive with finding ID -> worker targeted verification -> orchestrator records closure change set/evidence -> next task`. Reviewer-targeted `fix` corrects report or protocol only. Do not send implementation fix back to originating reviewer. Final convergence or completion gate catches remaining regression; avoid reviewer-worker-reviewer loops.

Fix worker selection:

- default: route finding to originating implementation worker with `action=fix` directive referencing current packet and assignment revision. Reviewer supplies independent perspective; originating worker retains design and invariant context. Do not launch replacement solely for fresh context.
- fresh replacement worker: use when finding exposes flawed architecture or security model, fix crosses packet ownership, originating worker fix attempt fails, or originating worker unavailable.
- fresh replacement bootstrap: reissue full `worker_assignment_v1` with incremented `assignment_revision`, then send `action=fix` directive containing stable finding IDs, relevant finding facts, current change set, affected paths, and verification delta. Never send directive-only to context lacking active assignment.
- context projection: current assignment + fix directive + relevant checkpoint and evidence only. Exclude full reviewer report, transcript, closed findings, global ledger, and unrelated packet state.
- closure: worker freshness does not replace targeted verification or final convergence/completion gate.

## Output Format

Apply `$llm-oriented-markdowns` to generated plan. If unavailable, enforce: terse AI-facing prose, no articles/filler/pleasantries/hedging, no Mermaid, no tables, no decorative separators, max two list levels, arrows for dependencies, no repeated requirements.

Use following structure. Remove irrelevant optional subsections; keep execution contract intact.

```markdown
# [Selected Scope] Coding Plan

Status: proposed
Source: `[source plan path]` -> `[selected heading]`
Repository baseline: `[commit/branch if useful, otherwise inspection date]`

## Runtime Worktree

- source: current branch at runtime -> recorded branch and `HEAD`
- create: dedicated implementation branch + worktree before any implementation write
- execution root: all worker, reviewer, test, fix, and convergence activity runs in worktree
- integration: no automatic merge, rebase, cherry-pick, copy-back, or cleanup; user handles merge
- completion reply: absolute worktree path + implementation branch + source branch + base revision

## Objective

[Outcome, user value, completion boundary]

## Scope

### In

- [behavior]

### Out

- [explicit non-goal]

## Repository Findings

- existing: `[path]` -> `[symbol/behavior]`
- gap: [missing or partial behavior]
- constraint: [compatibility or repository rule]
- reuse: `[existing pattern]` -> [planned extension]

## Decisions and Invariants

- [authority, state, security, transaction, compatibility rule]
- assumption: [non-blocking assumption requiring validation]

## Target Design

### [Relevant subsystem]

- [exact data flow, interface, rule, proposed path]

## Execution Graph

`G0 -> {P1 || P2} -> G1 -> S1 -> G2`

- `G0`: [launch prerequisite]
- `G1`: [fan-in acceptance gate]
- `G2`: [completion gate]

## Work Packets

### P1: [Bounded outcome]

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `[paths/globs]`
- reads: `[path]` -> `[symbols]` -> [packet-specific purpose]
- acceptance: [observable completion condition]
- non-goals: [excluded work]
- upstream inputs: `[source packet/gate]` -> `[accepted change set]` -> [interface or decision]
- changes:
  - [ordered coding step with symbols, schemas, routes, or components]
- invariants: [rules packet must preserve]
- relevant evidence: `[evidence ID]` -> [covered scope and change set; omit unrelated ledger entries]
- test duty: [none, reuse evidence ID, or run exact command at packet completion]
- verification: [non-test checks plus expected evidence]
- handoff: [artifacts/interfaces downstream packets receive]

### S1: [Bounded outcome]

- mode: sequential after `G1`
- depends on: `P1`, `P2`, `G1`
- owns: `[shared integration paths]`
- reads: `[path]` -> `[symbols]` -> [packet-specific purpose]
- acceptance: [observable completion condition]
- non-goals: [excluded work]
- upstream inputs: `[source packets]` -> `[accepted change sets]` -> [interfaces or decisions]
- changes:
  - [integration steps]
- relevant evidence: `[evidence IDs]` -> [fan-in scope; omit unrelated ledger entries]
- test duty: [shared integration commands run once after fan-in]
- verification: [non-test checks plus expected evidence]
- handoff: [completion evidence]

## Review Assignments

### R1: Review `[implementation packet]`

- target: `[implementation packet]` -> `[exact base/head revision or change set]`
- reads: `[path]` -> `[symbols]` -> [review-specific purpose]
- acceptance: [conditions to assess]
- invariants: [behavior, contract, security, compatibility rules]
- risk focus: [high-risk paths or failure modes]
- non-goals: [excluded review scope]
- write policy: inspect-only
- test policy: assess supplied relevant evidence; run only assigned command or when stale/missing evidence blocks verdict
- relevant evidence: `[evidence IDs]` -> [target coverage and change set]
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `[shared path]`: owned only by `S1`; parallel packets read only
- migration versions: [reservation/order rule]
- contract changes: [producer task -> consumer tasks]
- composition: [single integration owner]

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment.
- non-Codex harnesses: ignore Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and communication contracts.

## Test Execution Schedule

- `T1`: after `[packet]` changes settle -> owner: `[packet]` -> `[focused command]`
- `T2`: after parallel fan-in -> owner: `[convergence packet]` -> `[shared integration command]`
- `T3`: after all fixes settle -> owner: `[final gate]` -> `[broad command, once]`
- reuse: [valid evidence rules and ledger handoff]
- invalidation: `[paths/dependencies]` -> `[entries/commands to rerun]`

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values
- transport: inline canonical JSON; temp artifact references only under protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; exclude full plans, prior reports, global ledger, closed findings, unrelated state
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- recovery snapshot: `orchestrator_run_state_v1`
- worktree context: every assignment includes absolute path, implementation branch, and base revision; every repository-relative path resolves under worktree root
- templates: reference canonical `templates/communication/*.json`; embed once only when portability requires it
- record shapes: reference canonical `references/communication-record-shapes.md` when object arrays become non-empty

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh runtime orchestrator; load source-checkout repository instructions, plan, canonical contracts, current checkpoint.
3. Record current source branch and `HEAD`; handle detached `HEAD` or relevant uncommitted-input blocker under worktree contract.
4. Create dedicated implementation branch and worktree from recorded source branch `HEAD`; persist worktree identity.
5. Switch runtime execution root to worktree; load applicable repository instructions from worktree.
6. Validate `G0`; project role-minimum context plus worktree context into assignments.
7. Launch fresh/minimal worker contexts for `P1 || P2` inside worktree.
8. Accept reports; update checkpoint and evidence ledger; do not duplicate valid runs.
9. Launch inspect-only reviewers inside worktree with exact change sets and relevant evidence; validate `G1`.
10. Route stable finding IDs through worker-targeted fix directives once; close after fix plus targeted evidence without reviewer return.
11. Launch `S1` inside worktree; run fan-in tests once.
12. Validate `G2`; run final suite once inside worktree after all fixes settle.
13. Leave implementation branch and worktree intact. Reply with absolute worktree path, implementation branch, source branch, and base revision. State user owns merge.

## Risks and Open Questions

- risk: [failure mode] -> mitigation: [design/test/gate]
- question: [remaining non-blocking question] -> owner/gate: [resolution point]

## Done Criteria

- [observable behavior]
- [data/contract compatibility]
- [required verification passes]
- [docs/seed/audit obligations complete]
```

## Assignment Detail Rules

Each worker packet must describe edits precisely enough for worker to start without rediscovering scope. Include:

- existing and proposed paths
- focused reads with paths, symbols, and purpose
- acceptance criteria and non-goals
- resolved upstream inputs and accepted change sets
- ordered change sequence
- domain and error invariants
- migration and backward-compatibility behavior
- test placement and named scenarios
- exact commands derived from repository scripts
- relevant evidence only
- output evidence required at handoff

Do not prescribe line-level code when repository pattern permits multiple valid implementations. Do not use vague tasks such as "update backend," "add tests," or "wire frontend."

Keep packet size coherent. Split packet when it spans unrelated ownership or cannot be verified independently. Merge tiny packets when coordination cost exceeds parallel benefit.

Each reviewer assignment must name exact review target and include scoped reads, acceptance criteria, invariants, risk focus, non-goals, inspect-only policy, test policy, and relevant evidence. Reviewer receives no implementation steps, write ownership, worker report dump, or unrelated ledger state.

## Final Checks

Before saving plan, confirm:

- selected high-level scope fully mapped
- repository claims evidence-backed
- existing vs proposed paths unambiguous
- graph has no unstated dependency
- every parallel lane has disjoint write ownership
- every shared surface has single owner and merge point
- every packet has verification and handoff
- worker packets include focused path/symbol/purpose reads, acceptance criteria, non-goals, resolved upstream inputs, and relevant evidence only
- reviewer packets include exact change set, scoped reads, acceptance criteria, invariants, risk focus, inspect-only write policy, test policy, and relevant evidence only
- every test command has one owner, execution point, reuse rule, invalidation rule
- new sessions reuse valid test evidence
- reviewers avoid duplicate test runs
- role-specific assignment/report contracts referenced; no obsolete shared contracts
- runtime begins after fresh context boundary
- subagents receive role-minimum context; no full plan, source plan, prior reports, global ledger, or unrelated state
- compact checkpoint captures current packet state; actionable finding source, severity, location, issue, required fix, lifecycle, and evidence; accepted handoffs; evidence ledger; decisions; invalidations; no transcript history
- runtime creates one dedicated worktree from current source branch `HEAD` before implementation writes
- every implementation, review, fix, and verification action runs inside recorded worktree
- source checkout receives no implementation changes and runtime performs no merge-back or worktree cleanup
- reviewer findings close after worker fix and targeted verification; no return review loop
- migrations, contracts, transactions, auth, error paths covered where relevant
- final integration and regression gate present
- completion reply reports retained absolute worktree path, implementation branch, source branch, and base revision; user owns merge
- plan contains no implementation changes or unrelated scope
- output follows `$llm-oriented-markdowns`

Save plan at user path. If absent, follow repository naming convention under `plans/`; otherwise ask user before creating path when convention unclear.
