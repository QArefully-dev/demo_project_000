# Writing Style for AI Instructions

Apply to generated skill, role scripts, prompts, contracts, and authoring notes meant for agents. Human-facing docs and user chat can use natural prose.

- Use short, direct instructions and fragments where clear. Drop filler without dropping actor, action, scope, obligation, condition, exception, or uncertainty. Preserve distinctions such as `must`, `may`, and `only if`.
- Preserve code, commands, identifiers, errors, URLs, paths, and versions verbatim during style edits. Define terms once; add examples only to disambiguate.
- Relations: `A -> B`; mappings: `key: value`; identifiers: inline code. Prefer flat lists and useful headings over tables, diagrams, decoration, or deep nesting. Put preconditions before actions and keep exceptions beside their rule.
- Read whole file before revising. Merge additions into relevant section, remove semantic duplicates, and keep each rule in one authoritative place. Preserve task-specific constraints; delete generic advice only when behavior remains clear. Resolve conflicts by instruction precedence; ask only if precedence leaves material choice open.
