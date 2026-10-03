# Host Bindings

Use when wiring generated invocation, agent, and model controls. Keep shared workflow independent of one host; bind to actual exposed controls before dispatch.

## Roles and models

- `agents/<role>.md` is task instruction script; load it explicitly. It does not register native profile by folder placement.
- Use host's fresh/no-history option where supported. Supply bounded brief and required constraints. If isolation, nesting, or model selection is required but unsupported, route capability issue; do not promise unavailable behavior.
- Exact requested profile -> verify registration and use it. `inherit` -> check host/profile defaults do not replace immediate parent's binding. Record requested and observable effective choice; state when effective choice cannot be observed. Apply only authorized fallback.
- Native agent definitions are optional adapters when named/installed profiles are requested. Verify host discovery path, schema, fields, and reload needs. Keep adapters within requested scope; do not change unrelated personal settings.

## Invocation metadata

- Generate target `agents/openai.yaml` when compatibility with hosts reading it is needed: quoted `interface.display_name`, `interface.short_description` (25-64 characters), and `interface.default_prompt` naming actual `$skill-name`; set Boolean `policy.allow_implicit_invocation` to selected invocation mode.
- Manual-only generated skill -> also set `disable-model-invocation: true` in target `SKILL.md` for hosts honoring it. Keep controls consistent. `agents/openai.yaml` registers no subagents.
- Verify invocation behavior on target host where possible. If unsupported, report limit; do not claim instruction text enforces it.

## Dispatch

- Inspect actual interface for dispatch, model/effort/profile, isolation, nesting, concurrency, and wait controls. Verify recipient can resolve bundled role scripts and artifact paths.
- Host adapter may use native format. Markdown workflow handoffs do not forbid required host metadata. Tool-required structured transport is an interface binding, not a persisted workflow handoff.
