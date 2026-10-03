# Authoring Review Procedure

Review generated workflow design after draft complete. Do not execute its business workflow. Three distinct lenses: logic, instruction conflicts, context/access. Apply selected review model policy; inherit when policy permits. Give each reviewer its role script and only relevant frozen draft files/sections. Independent reviews may run in parallel.

## Lenses

- Logic: trace each requirement through producer, accepted output, consumer, check, and completion. Exercise normal flow, relevant branches, prerequisite failures, parallel ownership, retry/cancellation, stale results, and recovery.
- Conflicts: check instruction precedence, contradictions across entrypoint/roles/contracts, unresolved authority, invocation/model policy, and incompatible host assumptions.
- Context/access: inspect each role's exact contract: sufficient but bounded inputs, recipient-visible paths, source/provenance where needed, output owner and consumer, status/return handling, and context overflow route. Inspect authoring file-access map for unneeded reads and competing writers; do not demand runtime access logs.

## Reports and repairs

- Each reviewer writes concise Markdown verdict (`pass | findings | blocked`), frozen revision, scenarios checked, coverage limits, and Critical/High findings only. Each finding names file/section, trigger, consequence, and proposed correction. Target files are read-only for reviewers. Development traces are optional only when useful; no manual access logging.
- Return status and findings path; blocked return adds decision facts. Author reads decision-relevant findings and gives fixes to **fresh scoped workers**, never original reviewer. Workers own exact files, know others share workspace, and preserve others' edits.
- Freeze changed revision and re-review affected contracts with appropriate lens; cross-role changes also get affected neighboring lenses. Keep concise authoring record of verdicts/repairs if useful. Generated runtime need not contain reports or `validation.md`.
- Unavailable required reviewer/model/tool -> disclose gap and proposed fix. Do not claim skipped review passed. Resolve authorized fixes and continue independent work.
