---
name: init-project
description: Initialize or refresh root AGENTS.md plus nested AGENTS.md for API and UI Custom Blend from repository scans that trace application flow in depth
disable-model-invocation: true
---

# Initialize Project Agent Context

Create harness-agnostic `AGENTS.md` files with maintenance instructions. One fixed run; no questions, no setup or mode choices.

## Scope

- Copying this skill to another repository -> copy entire `init-project/` directory, including all `assets/` and `references/` files. Exclude nothing.
- Running this skill -> use bundled `assets/llm-oriented-markdowns/llm-oriented-markdowns.md` only within this workflow; do not copy it outside skill directory.
- Do not ask user anything. Start scanning immediately. User message accompanying invocation, if any -> project context passed to every subagent.

## Outputs

Create or update exactly three files:

- root: `AGENTS.md`
- API Custom Blend: `apps/api/src/features/customBlend/AGENTS.md`
- UI Custom Blend: `apps/web/src/features/customBlend/AGENTS.md`

Do not create, update, or delete any `CLAUDE.md`, `.claude/settings.json`, `.agents/`, `scripts/agent-context.mjs`, or other nested `AGENTS.md` files.

## Subagents

Dispatch exactly three read-only scan subagents, all with model `GPT-6 Luna (copilot)`. Run them in parallel. Never substitute another model; model unavailable -> stop and report.

- Root subagent: repository-wide scope excluding Custom Blend scopes below. Cross-cutting architecture, commands, testing, and flows outside Custom Blend.
- API Custom Blend subagent: `apps/api/src/features/customBlend/`, `apps/api/src/routes/customBlends.ts`, `apps/api/src/db/migrations/022_custom_blends.ts`, Custom Blend tests under `apps/api/test/`, plus Custom Blend touchpoints in API cart, checkout, orders, payments, reorder, saved lists, and shared `packages/contracts/src/customBlends.ts`.
- UI Custom Blend subagent: `apps/web/src/features/customBlend/`, `apps/web/src/api/customBlends.ts`, `apps/web/src/components/home/CustomBlendBanner.tsx`, plus Custom Blend touchpoints in web routing, nav, cart, checkout, orders, saved lists, help content, and `packages/localisation/src/messages/customBlend.ts`.

Paths above are starting anchors; each subagent confirms them and follows Custom Blend references (`customBlend`, `CustomBlend`, `custom_blend`) within its app. Scopes do not overlap: shared contracts belong to API subagent; localisation messages to UI subagent.

Final review reuses one completed scan subagent; it does not add a fourth.

## Workflow

1. Resolve repository root. Read [repository analysis](references/repository-analysis.md) and bundled [LLM-oriented Markdown rules](assets/llm-oriented-markdowns/llm-oriented-markdowns.md).
2. Shallow root scan: manifests, executable config, tests, CI, maintained docs, existing `AGENTS.md` files, flow entry points. Code and executable config win conflicts; report unresolved intent conflicts with "WARNING".
3. Read [flow investigation brief](references/flow-investigation.md). Dispatch three subagents per `## Subagents`, each with full brief, exact scope, repository root, and user context.
4. Merge findings; join flows crossing scopes and read code to close reported gaps.
5. Write three output files. Merge valuable existing rules from current files.
   - Root -> global context plus flows spanning both apps (web -> API) or outside Custom Blend.
   - API Custom Blend -> API-side Custom Blend architecture, flows, testing, pitfalls. API-only Custom Blend flows live here even when hops touch `apps/api/src/routes/` or other API features.
   - UI Custom Blend -> web-side Custom Blend architecture, flows, testing, pitfalls. Web-only Custom Blend flows live here even when hops touch other web features.
   - Nested files -> subtree-only deltas; never repeat root rules.
   - Flows -> apply threshold and format from repository analysis `## Flows`; below threshold -> omit.
6. Assign final review and deduplication to one completed scan subagent. Grant edit ownership of the three output files only. Subagent must:
   - Read `<skill-directory>/assets/llm-oriented-markdowns/llm-oriented-markdowns.md` before editing; follow it for all edits.
   - Enforce every bundled writing and formatting rule in each file, including terse prose, linear structure, compact formatting, flat lists, and prohibited constructs.
   - Compare three files for exact and semantic duplication, plus within-file duplication.
   - Keep each fact or rule only in most relevant place: repository-wide guidance at root; Custom Blend API or UI guidance in matching nested file.
   - Delete duplicate copies without weakening scope, exceptions, or meaning.
   - Compress flow wording without dropping hops, ownership, invariants, or change sets.
   - Fit root `## Commands` in max 10 lines by grouping related commands per line by purpose (setup/run, checks, tests, gates, scoped-run pattern, destructive with impact). Do not drop commands agents routinely run.
   - Edit files directly and report moved or deleted guidance. Do not return recommendations only.
7. Before finalizing, test drafts against a typical cross-layer Custom Blend change (contract -> API rule -> route -> web client -> page). If an agent would need to rediscover a required layer, helper, import convention, transaction mechanism, validation step, or flow hop, add missing rule, flow, or exemplar path.

## Generated content

- Minimal: every line must change agent behavior or avoid meaningful rediscovery.
- Prefer where and why: authoritative paths, ownership, rationale, durable invariants, hazards, and surprising constraints. Reference detailed docs with plain repository-relative paths; never use Markdown links or copy doc content.
- Avoid volatile implementation prose (line numbers, function bodies, transient values), inventories, exhaustive environment lists, generic coding advice, and host-provided agent or skill-routing rules.
- Destructive commands -> state impact and required authorization.
- Generated/runtime files -> identify only when agents might edit or commit them accidentally.
- Do not reference initializer plumbing in generated files: this skill, skill locations/discovery, nested-skill notes.
- Add `## Pitfalls` to each output file. Capture verified, non-obvious failure modes and proven workarounds within that file's scope; never invent entries to fill section.

Add following rules to root `AGENTS.md` only; never to nested files:

"
# Maintenance
Update this file or closest nested AGENTS.md when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. AGENTS.md conflict with repository evidence -> warn user with "WARNING".


# AI Documentation and Code Comments
Write any AI documentation (AGENTS.md) or code comments in terse language, for future AI agents. Facts only, minimal language. No history, dates, just core info. Don't re-tell code, say only what can't be derived from code - architecture, decisions, cross-cutting concerns. Default is no comment at all. Leave comments and edit AI docs only if needed. No duplication between code comments or any AI docs. Information lives in one place only. 
"

## Verify

- Confirm exactly three subagents ran, all on `GPT-6 Luna (copilot)`, and final review reused one of them.
- Confirm only three output files changed; no `CLAUDE.md`, `.claude/`, `.agents/`, or other `AGENTS.md` changed.
- Review final-pass diff for lost scope, meaning, or unsupported formatting changes.
- Confirm bundled LLM-writing rules were not copied outside skill directory.
- Confirm output files use plain repository-relative paths, not Markdown links.
- Confirm each output file contains `## Pitfalls` and only evidence-backed entries.
- Confirm Maintenance and AI Documentation rules appear in root `AGENTS.md` only.
- Confirm each `## Flows` entry is investigator-backed, meets doc-worthy threshold, lives in file per Workflow step 5, appears once, and references existing paths.
- Confirm root `## Commands` has max 10 lines.
- Review output for unsupported claims, volatile detail, and excess length.
- Run application tests only if changes extend beyond `AGENTS.md` files.
- Report changed files, documented and skipped flows, validation, and evidence gaps.
