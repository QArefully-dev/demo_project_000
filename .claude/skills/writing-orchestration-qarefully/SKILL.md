---
name: writing-orchestration-qarefully
description: Use when writing complex orchestration workflows
disable-model-invocation: true
---

# Writing Orchestration Qarefully

Author a self-contained skill that coordinates bounded agents to produce a user result. Design and review the skill; do not run its business workflow while authoring. This authoring skill is manual-only. Set generated skill invocation policy from user's request.

## Intake and design

- Reuse supplied decisions. Establish outcome, source inputs, stages, decisions, failure routes, completion criteria, destination, authorized actions, and required host capabilities. Propose concise flow for missing details; ask only when unresolved choice changes behavior or authority.
- Establish model policy: inherit immediate parent's binding or use exact user-selected models/profiles per role. If absent and model choice matters, ask once, including nested agents and reviewers. Never silently choose cheaper model or substitute unavailable profile.
- Read only relevant reference workflows. Extract useful mechanics without unrelated restrictions. Read [design rules](references/design-rules.md) and [writing style](references/writing-style.md).
- Draft target `references/workflow.md` from [workflow template](assets/workflow.md). Map each requirement to role, stage, decision, or completion check. Check prerequisites, producer/consumer contracts, ownership, concurrency, and recovery. Use simplest design that satisfies outcome; resolve complexity with judgment and ask only for material user choice.
- Draft an **authoring-only** expected-input/output map from [file-access template](assets/file-access.md). Keep it with authoring evidence, outside generated skill package. Use it to spot excess context and writer overlap; it is not runtime artifact or access policy.

## Generate package

- Target `SKILL.md`: entry conditions, required capability binding, orchestration boundary, dependency gates, dispatch and return convention, recovery, and completion. Bind actual dispatch, model selection, isolation, file visibility, slots, nesting, and wait controls before first child. Route unsupported required capability as issue.
- Target `agents/<role>.md`: specific instruction for each distinct role, including nested scouts/reviewers when needed. Adapt [role template](assets/role.md); include bounded objective, relevant inputs, owned outputs, model policy, done check, and failure return. Skill-local role scripts require explicit loading; folder placement does not register agents.
- Target `references/contracts.md`: adapt [handoff contracts](assets/contracts.md). Use one compact status/artifact return; include identity only when transport does not bind attempt. Failure adds decision facts. Put substantive payload schemas in role instructions/contracts, not orchestrator entrypoint. Never echo payload in return.
- Bundle every resource generated runtime needs. Runtime must not depend on this authoring skill or sibling skills. Workflow-owned briefs, plans, handoffs, findings, and state use Markdown; product files retain required formats and host adapters retain native formats. Do not require runtime access logs, reconciliation, access gates, or self-diagnosis. Include runtime state or validation artifact only when real consumer needs it.
- Use scripts for repeated deterministic work when they simplify flow. Document command, dependencies, inputs, outputs, and failure behavior. Do not encode domain judgment in brittle parsing.
- Read [host bindings](references/host-bindings.md) when wiring invocation or agents. Verify model/profile and dispatch controls against actual host. Keep declared and observable effective binding distinct.

## Review and deliver

- Freeze complete draft and run distinct authoring reviews using [review procedure](references/review-procedure.md): [logic](agents/review-logic.md), [instruction conflicts](agents/review-conflicts.md), and [context/access](agents/review-context.md). Give each only files its lens needs. Reviews assess generated design; they do not execute its business task. Findings may stay in authoring workspace; generated runtime need not carry review reports.
- Fix findings with fresh scoped workers, then re-review affected contracts. Walk normal path and applicable failure/parallel branches. Check frontmatter name/description, invocation metadata consistency, links to bundled resources, role inputs/outputs/owners, and added scripts with representative valid/invalid inputs. Keep concise authoring evidence of checks when useful; no access logs or mandatory `validation.md`.
- Deliver when requirements are covered, material findings resolved or explicitly accepted by user with known limits, required checks pass, children are terminal, and package is present. Report output path, invocation mode, checks, and remaining limits concisely. Never claim static walkthrough executed business workflow.
