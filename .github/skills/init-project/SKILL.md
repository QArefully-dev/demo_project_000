---
name: init-project
description: Initialize or refresh concise AGENTS.md or CLAUDE.md through delegated repository analysis.
disable-model-invocation: true
---

# Initialize Project Agent Context

One read-only scan subagent -> main agent writes repository instructions.

## Scope

- Resolve target repository root; use supplied project context and constraints.
- Detect active harness from session identity/runtime, not existing repository files.
  - Claude -> ensure `<repo>/.claude/` exists; instruction filename: `CLAUDE.md`.
  - Otherwise -> ensure `<repo>/.agents/` exists; instruction filename: `AGENTS.md`.
- Root instruction file lives directly under repository root, outside harness folder.
- Nested instruction files -> only directories explicitly suggested by user, using same filename as root. No suggested directories -> skip all nested writes; preserve existing nested files.
- Resolve suggested directories within target repository. Missing or ambiguous path -> clarify before writing there; continue root work.
- Preserve unrelated files and existing harness-folder contents.
- Copying skill elsewhere -> include `SKILL.md`, `agents/`, `assets/`, and `references/`. Bundled writing rules stay inside skill directory.

## Workflow

1. Read [repository analysis](references/repository-analysis.md) and bundled [LLM-oriented Markdown rules](assets/llm-oriented-markdowns/llm-oriented-markdowns.md).
2. Launch one read-only subagent. Use fresh context (`fork_turns: "none"` where supported), self-contained prompt, target repository path, user context, suggested directories, and repository-analysis reference path. Request terse findings with evidence paths:
   - Repository purpose, durable boundaries, exact commands, authoritative files, required patterns, verified pitfalls, and evidence gaps.
   - Repository-wide guidance plus local findings for each user-suggested directory.
   - No file edits or further delegation.
3. Main agent reads applicable existing instructions and synthesizes returned findings. Code/executable config establish current behavior; user instructions establish intended constraints. Surface unresolved conflicts instead of silently choosing.
4. Create selected harness folder if missing. Create or update selected root instruction file and instruction files in user-suggested directories. Merge valuable existing guidance; follow bundled writing rules.
5. Main agent reviews and deduplicates drafts. Keep global guidance at root and subtree-only deltas in nested files; never repeat inherited rules. Preserve scope, exceptions, and meaning.
6. Check typical cross-layer change against draft. Missing required layer, helper, import convention, transaction mechanism, or validation step -> add evidence-backed rule or exemplar path.

## Generated content

- Every line must change agent behavior or prevent meaningful rediscovery.
- Prefer authoritative paths, ownership, rationale, durable invariants, hazards, and surprising constraints.
- Reference detailed docs through plain repository-relative paths; no Markdown links or copied doc content.
- Omit volatile implementation prose, inventories, exhaustive environment lists, generic coding advice, host-provided routing rules, and initializer plumbing.
- Destructive commands -> state impact and required authorization.
- Generated/runtime files -> identify only where accidental edits or commits pose real risk.
- Include `## Pitfalls` in each generated file; entries require verified failure modes or proven workarounds. Never invent entries.

Add maintenance rule at root; applies throughout repository:

`Update applicable instruction file when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. Instruction/evidence conflict -> warn user with "WARNING".`

## Verify

- One scan subagent completed; main agent owns synthesis, writes, and final review.
- Selected harness folder exists; root and requested nested files use matching filename.
- No unrequested nested instruction files created or modified.
- Generated claims have evidence; paths and commands match repository; unsupported detail and duplication removed.
- Bundled writing rules followed; existing guidance retains scope and meaning.
- Review diff. Application tests needed only for changes beyond agent-context files.
- Report harness, changed files, validation, and evidence gaps. Initializer directory may be deleted after success.
