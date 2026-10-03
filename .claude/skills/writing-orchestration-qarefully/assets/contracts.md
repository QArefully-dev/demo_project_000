# Handoff Contracts

Adapt fields to generated workflow. Markdown handoffs. `<...>` means replace; omit unused optional fields. Dispatch must stand alone without session recap.

## Dispatch

```md
role: <role ID and instruction path>
task: <one bounded objective>
constraints: <applicable instructions and authority>
inputs:
- <recipient-visible path>#<section> -> <purpose; prerequisite when needed>
writes:
- <owned artifact path> -> <consumer>
done: <observable result and relevant checks>
limits: <scope/context/attempt/children when applicable>
```

Use transport binding for run/stage/attempt when available; include explicit identity only if transport does not bind return to dispatch. Add model, child permissions, and dependency revisions only when this assignment needs them. Task-wide state is not default input.

## Return

```md
status: <complete | blocked | needs_user>
artifact: <recipient-visible path | none>
issue: <exact blocker, impact, next action or decision; blocked/needs_user only>
```

`complete` requires owned artifact present and role's done checks met. For blocked work, `artifact` points to useful partial evidence if written; otherwise `none`. Add attempt identity only when transport cannot identify current dispatch. Return decision facts needed by parent; keep payload in artifact. Parent checks binding and artifact presence, then routes task-specific acceptance.

## Artifact

Role script defines only sections consumers need. Include evidence, uncertainty, provenance, revisions, and performed checks where they affect task correctness or subsequent decisions. No empty boilerplate or duplicate return envelope.
