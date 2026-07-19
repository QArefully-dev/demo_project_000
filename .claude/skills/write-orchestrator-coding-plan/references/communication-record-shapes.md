# Communication Record Shapes

Read when populating non-empty object arrays in canonical communication templates. Keep keys exact. Retain `[]` when no applicable records exist.

## Shared Evidence

Use for `worker_assignment_v1.relevant_evidence[]`, `reviewer_assignment_v1.supplied_evidence[]`, `worker_report_v1.verification[]`, and `orchestrator_run_state_v1.evidence_ledger[]`.

```json
{
  "evidence_id": "[evidence-id]",
  "command": "[exact command]",
  "scope": "[covered scope]",
  "change_set": "[revision or change set]",
  "result": "pass|fail|not_run",
  "runner": "[packet, gate, or agent id]",
  "invalidators": ["[path, dependency, migration, contract, config, or fixture]"],
  "output_summary": "[terse result or exact error]"
}
```

Use shared evidence keys plus `assessment` for `reviewer_report_v1.evidence_assessment[]`.

```json
{
  "evidence_id": "[evidence-id]",
  "command": "[exact command]",
  "scope": "[covered scope]",
  "change_set": "[revision or change set]",
  "result": "pass|fail|not_run",
  "runner": "[packet, gate, or agent id]",
  "invalidators": ["[path, dependency, migration, contract, config, or fixture]"],
  "output_summary": "[terse result or exact error]",
  "assessment": "valid|stale|insufficient|not_applicable"
}
```

## Assignments

`worker_assignment_v1.resolved_upstream_inputs[]`:

```json
{
  "source": "[packet, gate, or decision id]",
  "change_set": "[accepted revision or change set]",
  "interface_or_decision": "[input needed by worker]"
}
```

## Reports

`worker_report_v1.changes[]`:

```json
{
  "path": "[repository-relative path]",
  "symbols": ["[symbol]"],
  "description": "[change]"
}
```

`worker_report_v1.blockers[]` and `reviewer_report_v1.blockers[]`:

```json
{
  "cause": "[blocking condition]",
  "needed_from_orchestrator": "[decision, access, dependency, change set, or evidence]"
}
```

`worker_report_v1.handoff.interfaces[]`:

```json
{
  "name": "[contract, symbol, or behavior]",
  "change_set": "[revision or change set]",
  "description": "[downstream-relevant interface]"
}
```

`reviewer_report_v1.findings[]`:

```json
{
  "finding_id": "[stable finding-id]",
  "severity": "critical|high|medium|low",
  "path": "[repository-relative path]",
  "line": null,
  "issue": "[review finding]",
  "evidence": "[code, invariant, contract, or evidence reference]",
  "required_fix": "[required correction]"
}
```

Both report `artifacts[]` fields:

```json
{
  "summary": "[artifact contents]",
  "path": "[temp path]",
  "format": "[format]",
  "sha256": "[digest]"
}
```

## Run State

`active_blockers[]`: `{ "packet_id", "cause", "needed" }`

`open_questions[]`: `{ "question_id", "packet_id", "question", "owner" }`

`findings[]`: `{ "finding_id", "reviewer_packet_id", "implementation_packet_id", "severity", "path", "line", "issue", "required_fix", "status", "owner", "raised_change_set", "closure_change_set", "closure_evidence_ids" }`

`accepted_handoffs[]`: `{ "source_packet_id", "change_set", "interfaces" }`

`decisions[]`: `{ "decision_id", "decision", "affects" }`

`invalidations[]`: `{ "change_set", "reason", "invalidated_evidence_ids", "invalidated_handoffs", "required_action" }`

Run-state values:

- `findings[].line`: line number or `null`
- `findings[].status`: `open|fix_assigned|closed`
- `findings[].closure_change_set`: fix change set or `null`
- record collection members: arrays; use `[]` when empty
