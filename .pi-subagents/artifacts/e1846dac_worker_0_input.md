# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Wave 3 implementation worker. The worktree at '../demo_project_000-worktrees/wave3' is already created on branch 'codex/demo-expansion-wave3' at SHA 5412e34 (w2-b merge). The base code is clean and npm ci has already run.

Task: Work EXCLUSIVELY in '../demo_project_000-worktrees/wave3'. Read the wave3 section of the spec (plans/demo_project_expansion_spec.md), CLAUDE.md, and state ledger (plans/demo_project_expansion_status.md). Then implement ALL wave3 requirements:

1. **Home page** (`apps/web/src/features/home/`): hero/search, categories, bestsellers (use getBestsellers API), sale row (filter on-sale products), newest grid (sort by newest)
2. **Header**: Wire WishlistButton to show real wishlist count from favourites API; cart count already works
3. **Loading/empty/error states, toasts, validation messages, money formatting, 404**: Add missing states. Add a Toast component for actions (added to cart, added to wishlist, etc.). Add NotFound/404 page + route. Ensure money formatting is consistent.
4. **Reset/seed exact-count verification**: In the seed script (apps/api/src/db/seed.ts), add assertions: exactly 45 products, 3 users, 7 promo codes, 3 favourites, 0 sessions, 0 mailbox. Assert SAVE10 is percent/10/min 5/active.
5. **Run verification**: `npm run typecheck`, `npm run lint`, `npm run format`, `npm run format:fix`, `npm run reset` (seed+reset verification). Fix any issues.
6. **Update README**: Features listing, test credit cards, user credentials (alice@example.com / Password123!, etc.), dev mailbox info.
7. **Append Phase-1 TLDR to high-level plan** (plans/demo_project_high_level_plan.md).

IMPORTANT: The seed file is at `apps/api/src/db/seed.ts` (inside db/ directory), not `apps/api/src/seed.ts`.

Do NOT use the `seed.ts` from the integration worktree - use the one in the wave3 worktree.

After all implementation is done and verified, commit with message: "feat(wave3): integration and polish — home, header, states, seed verification, docs" and report the commit SHA.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report`.

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