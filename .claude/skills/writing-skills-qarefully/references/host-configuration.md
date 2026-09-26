# Host Configuration

Read when configuring invocation, compatibility metadata, or custom-agent installation. These extensions support specific hosts; they are not universal Agent Skills requirements.

## Invocation adapters

- Hosts supporting `disable-model-invocation` in `SKILL.md` frontmatter: manual-only -> `true`; automatic -> omit or `false`. Include `true` only after user chooses manual-only behavior. `user-invocable: false` hides user invocation; it does not disable automatic selection.
- Hosts supporting `agents/openai.yaml`: set Boolean `policy.allow_implicit_invocation` explicitly. Manual-only -> `false`; automatic -> `true`.
- Default distribution -> include compatibility YAML and apply frontmatter switch when manual-only requested. Keep settings consistent; preserve established invocation choice unless user changes it.
- Other hosts -> verify equivalent supported control. Instruction text alone cannot enforce discovery policy. Unsupported manual-only behavior -> report limitation rather than claim enforcement.
- Strict frontmatter validators may reject extensions. Keep standard-only variant separate when required; describe which invocation controls remain supported.

## Compatibility YAML

Always include `agents/openai.yaml` in default distribution. Populate `interface.display_name`, `interface.short_description` (25-64 characters), and `interface.default_prompt` mentioning actual `$skill-name`. Quote strings; keep policy Boolean. Derive text from skill purpose; preserve unrelated existing interface fields, policies, and dependencies.

Minimal policy for automatic selection:

```yaml
policy:
  allow_implicit_invocation: true
```

For current schemas, consult frontmatter-based or sidecar-based host documentation as applicable.

## Custom-agent discovery

- Skill-local `agents/` metadata does not automatically register subagents. Prefer portable briefs in `references/` unless installed custom role materially improves workflow.
- Installation paths and formats differ: project `.claude/agents/*.md` uses Markdown with YAML frontmatter; project `.codex/agents/*.toml` uses TOML. Personal installation paths and plugin packaging have separate scope rules.
- Verify target version and supported fields before generating definitions. Keep installation within requested scope; explain required installation/reload steps. Avoid hardcoded model names unless user selected them.
- Confirm registered role exists before dispatch. Otherwise use available general agent with relevant brief, or follow skill's local fallback.

Check target harness documentation for Markdown, TOML, or other agent registration formats.
