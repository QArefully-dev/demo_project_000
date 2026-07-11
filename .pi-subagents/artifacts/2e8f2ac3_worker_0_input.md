# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Fix bootstrap state ledger SHA mismatch.

The reviewer found a blocker: the state ledger at 'plans/demo_project_expansion_status.md' in the integration worktree at '../demo_project_000-worktrees/integration' has the WRONG Integration SHA. It currently shows `f43100d7f3c76d0581c1d3f8e2e395d99846557f` (the base commit), but it MUST show `fac8595da3efbc3d0b394e6b78393e1a34a32d7b` (the actual integration branch tip).

In the integration worktree, on branch 'codex/demo-project-expansion':
1. Edit 'plans/demo_project_expansion_status.md' — change the Integration SHA field to `fac8595da3efbc3d0b394e6b78393e1a34a32d7b`
2. Commit with message: 'fix: correct integration SHA in state ledger'
3. Report the new commit SHA and confirm the fix.

Do NOT run any other checks or make any other changes. Just fix the SHA and commit.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```