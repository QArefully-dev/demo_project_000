Done. The fix is committed and verified.

---

Implemented: Corrected the Integration SHA in the state ledger from `f43100d7f3c76d0581c1d3f8e2e395d99846557f` (base commit) to `fac8595da3efbc3d0b394e6b78393e1a34a32d7b` (actual integration branch tip).

Changed files: `plans/demo_project_expansion_status.md` (1 line)

Validation:
- Diff confirms only the SHA line changed; the rest of the ledger is untouched.
- New commit `018804b` is on branch `codex/demo-project-expansion`.
- Working tree is clean.

Open risks/questions: None.

Recommended next step: Re-run the reviewer against the updated worktree.