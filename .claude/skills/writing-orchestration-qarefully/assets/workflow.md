# Workflow Design

Replace placeholders; remove unused fields and stages. Describe generated runtime. Keep authoring evidence elsewhere.

## Outcome

- result: <user-visible deliverable>
- inputs: <required sources>
- requirements: <requirement -> responsible stage/check>
- completion: <observable acceptance conditions>
- harness: <required capabilities and how runtime checks them>
- invocation: <explicit-only | automatic>
- artifact-root: <task-approved root; resolve recipient-visible paths>
- model-policy: <inherit parent | selected per-role mapping; fallback authority if relevant>

## Flow

<producer -> accepted artifact -> dependent stage -> final acceptance>

- dependencies: <required order and why>
- parallel: <independent ready stages with separate writes; resource constraints>
- branches: <condition -> stages and completion treatment; omit if none>
- recovery: <failure -> correction or user decision; bounded retry when useful>
- children: <delegation boundary, capacity/depth limit if nested work needed>

## Stage <stage-id>

- role: <one responsibility; role script>
- depends-on: <required accepted outputs; none for roots>
- task: <bounded objective>
- inputs: <exact relevant paths/sections and purpose>
- writes: <owned outputs and downstream consumer>
- done: <artifact and task-specific checks>
- on-blocker: <facts and route; dependent stages wait>
- context: <bounded input scope; split/projection route if needed>

Repeat per concrete stage. Script stage: command, inputs, writes, success/failure signal, owner. Orchestrator routes and tracks stages; domain discovery, planning, execution, and substantive review belong to scoped workers.

## Decisions

- <decision>: <facts required, producer, permitted choices; omit when none>
