---
name: writing-skills-qarefully
description: >-
  Create or revise agent skills when defining triggers, instructions, references,
  or invocation settings across agent harnesses.
  Excludes standalone project-instruction edits and human-facing documentation.
---

# Writing Skills Qarefully

Produce focused, reusable skills with clear selection criteria, actionable instructions, and verified packaging. Apply terse style to agent-facing content; keep user conversation natural.

## Before writing

1. Read requested sources and existing target files in full. Identify intended outcome, destination, expected inputs/outputs, scope boundaries, and target harness capabilities.
2. Check skill titles and descriptions already provided in system prompt for similar purposes or overlapping triggers. Read relevant candidate skills before judging overlap or contradictory instructions. Many candidates need reading -> delegate candidate review to subagent; request skill names, overlap/conflict, and proposed resolution. Warn user about identified overlap/conflict and proposed resolution. Prefer extending existing skill when appropriate; honor explicit request for separate skill. Report incomplete inventory when it limits this check.
3. Resolve precedence using applicable instructions and user's choices. Ask only when unresolved conflict affects result; similarity alone does not require stopping.
4. Invocation preference unspecified in request or established context -> always ask: "Should this skill activate automatically when relevant, or run only when explicitly invoked?" Wait for answer before setting invocation policy. Existing skill -> state current setting in question; preserve unless user chooses change.
5. Ask additional clarifying questions only for missing facts that materially affect scope, behavior, dependencies, or deliverable. Reuse answers already given; bundle independent questions. Continue independent inspection while required answers remain pending.

## Define selection

- `name`: match folder; lowercase letters, digits, single hyphens; 1-64 characters; no leading/trailing hyphen.
- `description`: concise capability plus conditions for selection. Put main use case early; add exclusions only to prevent plausible overlap. One sentence optional; maximum 1,024 characters for shared-spec compatibility.
- Put essential trigger conditions in description: agent may select skill before reading body. Keep procedures, long examples, and implementation details in body or references.
- Choose wording from actual user tasks. Avoid catchall triggers, redundant synonyms, and claims that skill is universally preferable.
- Retain meaningful description for manual-only skills; discovery, menus, and context visibility vary by host.

## Organize instructions

- Start with desired result and boundaries. Sequence only actions with real dependencies; use grouped rules for independent guidance.
- Keep instructions needed on ordinary runs in `SKILL.md`. Move substantial conditional detail to supporting files; explain beside each relative link when to read it and what it provides.
- Keep each topic's conditions, actions, exceptions, and failure handling together. Define unfamiliar terms before relying on them.
- Give ambiguous or fragile work observable completion checks. Use fixed steps only when order matters; allow judgment for open-ended work.
- Preserve user's scope and authorization. State meaningful stop conditions for risky actions; skill invocation alone does not authorize unrelated side effects.
- Shared guidance must remain reachable in target environment. Bundle required resources or declare dependency explicitly; avoid machine-specific paths and undeclared sibling-skill dependencies.

## Resource layout

- `scripts/`: executable helpers for repeated deterministic work. Document runtime/dependencies, command, inputs, outputs, side effects, and failure handling. Resolve bundled paths from skill location rather than assuming current working directory.
- `references/`: detailed procedures, schemas, examples, and reusable delegation briefs. Link files directly from `SKILL.md` with conditions for reading them; load only relevant material and avoid deep reference chains.
- `assets/`: templates, images, and starter files copied or transformed into output. Explain intended use; keep workflow instructions outside assets.
- `agents/`: host metadata or explicitly loaded support files. Folder name alone does not register custom subagents; registration depends on harness discovery rules.
- Create optional resources only when needed. Small skill -> keep instructions in `SKILL.md`; avoid empty folders and redundant companion docs.

## Delegation

- Specify when delegation improves task, then define bounded responsibility, required context, permitted actions, and expected result. Keep briefs self-contained; do not assume subagent inherits skill or conversation.
- Reusable role instructions -> `references/` with read condition at delegation step. Main agent reads relevant brief and includes it in dispatch through available harness tools.
- Parallel edits -> assign non-overlapping ownership; tell workers others share workspace and their changes must be preserved. Main agent integrates results and checks completion.
- Use installed custom agents only when workflow benefits from their configuration. Verify registration location, format, and availability through target harness; bundled definitions remain templates until installed or explicitly loaded.
- Subagents unavailable -> perform steps locally when equivalent; if isolation or capabilities are essential, explain missing capability and ask for viable alternative. Never claim delegation occurred when executed locally.

## Write and revise

- Use short, direct instructions. Remove filler and redundant wording; fragments acceptable where meaning remains clear.
- Keep actor, action, scope, obligation, condition, exception, and uncertainty explicit. Compression must preserve distinctions such as `must`, `may`, and `only if`.
- Style-only changes -> leave code, commands, config, identifiers, errors, paths, URLs, and versions exact.
- Prefer compact lists, `key: value`, and `A -> B` relations. Keep nesting shallow; remove decorative formatting. Treat formatting choices as editorial defaults, not universal model-performance claims.
- Describe intended action directly. Keep explicit prohibitions when needed to express real boundaries; avoid unsupported explanations about model cognition.
- Add examples when they resolve ambiguity or show required output. Omit examples that merely repeat clear rules.
- Consolidate repeated meanings into one maintained location. Merge additions into relevant sections; check whole edited file for contradictions and semantic duplication.
- Keep useful constraints and non-obvious task knowledge. Remove generic or stale advice only when deletion preserves intended behavior; uncertain value -> retain or verify.
- Adapt ideas from sources using original organization, wording, and examples. Avoid copying distinctive passages or terminology; attribute quotations and respect source licenses when reusing material.

## Package for target harnesses

- Keep shared entrypoint portable: `<name>/SKILL.md` with YAML `name` and `description`, followed by Markdown instructions. Use capability-based instructions rather than assuming particular tools, models, or invocation syntax.
- Distribution convention -> include `<name>/agents/openai.yaml` compatibility metadata. This file does not replace other harnesses' configuration or guarantee automatic discovery.
- Before writing invocation or interface configuration, read [host configuration](references/host-configuration.md) for field mappings, compatibility metadata, and custom-agent discovery. Add adapters needed by target harnesses; keep shared workflow independent of them.
- Verify accepted extensions and discovery/install paths. Strict standard-only packaging -> provide compatible variant and explain unsupported capabilities. Repository `skills/` may be distribution source rather than discovered installation.

## Verify and deliver

- Confirm entrypoint and required adapters exist. Parse configuration; check required fields, name/folder agreement, metadata constraints, matching invocation policies, and linked resource paths. Use available host/spec validator; distinguish unsupported host extensions from malformed metadata rather than silently deleting requested settings.
- Check selection with representative matching, adjacent nonmatching, and explicit-invocation requests. Manual-only choice -> verify absence of automatic selection through host policy.
- Walk through realistic task, missing-input case, and relevant failure path. Check required questions, overlap warning, output, and completion conditions. Run behavioral evaluations when complexity warrants; distinguish actual execution from static walkthrough.
- Run added/changed scripts with representative success and failure inputs. Confirm bundled resources suffice without author's local environment; check delegation briefs and local fallback where applicable.
- Review final diff for scope creep, copied source prose, duplication, lost conditions, and unsupported claims. Test behavior and meaningful invariants rather than exact wording.
- Report files changed, invocation choice, validation performed, and unresolved limits. Never claim host execution verified from metadata checks alone.

For shared format, consult Agent Skills specification. Verify host-specific behavior against target harness's current documentation.
