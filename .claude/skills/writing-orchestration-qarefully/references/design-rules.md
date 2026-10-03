# Design Rules

Apply relevant rules to generated entrypoint and roles. Runtime must work without this authoring reference.

## Simplicity and responsibility

- Use fewest roles, stages, branches, retries, and files needed for agreed outcome. Preserve real safeguards. Put each rule in one maintained place; avoid cross-file rule chains.
- Main runtime agent orchestrates: bind capabilities, dispatch, schedule, track accepted artifacts, resolve routing decisions, and communicate with user. Delegate substantive discovery, planning, implementation, review, and repair. It may inspect concise decision facts, status, and artifact identity; payload analysis belongs to scoped role.
- Give each role one responsibility and observable done check. Split overloaded role only when split reduces total complexity. Scouts gather bounded facts and pointers; thinkers synthesize selected evidence. Use scouts only when discovery is needed. Uncertainty and conflicting evidence survive summaries.
- Ask user only when decision changes requirements, authority, model/profile choice, or material scope. Apply already authorized fallbacks.

## Context and handoffs

- Dispatch bounded objective, constraints, exact relevant instructions/inputs, owned outputs, and done check. Use fresh/no-history context when available. Never rely on path recipient cannot read; map or copy across workspaces and retain provenance.
- Give consumers relevant sections and source pointers. Add size limits or projections when input could exceed context; do not impose universal budgets on every role. Scout result should identify useful facts, source/revision, uncertainty, and negative findings, not raw search dumps.
- Bind run/stage/attempt and reserved output path before dispatch. Return compact status/artifact, with identity only if transport lacks binding. Failure includes exact blocker, impact, and proposed route. No payload echo or runtime access ledger.
- Reuse agent only for compatible bounded responsibility; otherwise use fresh agent. Carry accepted artifacts forward, not accumulated messages.

## Scheduling and ownership

- Start stage only after accepted prerequisites at known revision. Parallelize independent ready work with disjoint writes, stable inputs, and available slots. Add serialization edge only for real dependency or resource conflict.
- Each mutable output has one writer. Reserve unique attempt paths; retries create new paths. Replaced prerequisite invalidates dependent acceptance. Give merges explicit owner.
- Permit nested agents only when useful. Parent owns synthesis; children receive limited scope and count against available slots. Required child has no slot -> parent reports `blocked` with pending child task to orchestrator and stops. Orchestrator coordinates dispatch when capacity is available; it does not perform child work. Set fan-out, depth, or attempt caps where recursion/retry needs bound. Parent reports complete only after required children finish; late results from cancelled attempts cannot update state.
- Persist compact state only if needed for multi-stage recovery: identities, accepted pointers/revisions, owners, statuses, decisions. Never copy payloads or conversation transcript.
- Workflow-owned briefs, plans, handoffs, findings, and state use Markdown. Product artifacts and required host adapters retain native formats.

## Failure and completion

- Distinguish `complete`, `blocked`, `needs_user`. Accept completion only when role done check and required artifact exist; tool completion alone proves neither.
- Inaccessible input, unavailable model/tool, conflicting instruction, or exceeded context -> report affected stage, exact diagnostic if available, impact, and proposed fix. Continue independent work. Do not silently substitute model or take over failed role.
- Retry corrected or transient failures with new attempt identity within useful limit. Repeated unchanged failure -> block with recheck condition. On resume verify identity, ownership, prerequisite revisions, and artifact existence; reject stale/foreign results.
- Finish after required stages/reviews and final deliverable pass gates and required children are terminal. Generated workflow performs its task; it does not audit own file access or produce authoring review evidence.
