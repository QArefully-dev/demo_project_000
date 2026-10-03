# File Access Map

Authoring-only design map. List expected controlled inputs and outputs to catch missing handoffs, excess context, and competing writers. Do not copy this map into generated runtime or require actual-access logs, audit gates, or reconciliation.

## Actor <role/script ID>

- reads: <path/pattern>#<relevant section> -> <purpose; producer or source>
- writes: <path/pattern> -> <purpose; sole owner; consumer>
- context: <needed slice/size; split or focused projection when large>

Repeat for each actor that reads or writes task files, including orchestrator and permitted children. Use bounded roots/patterns for discovery where exact files are unknown. Record script-managed reads/writes when they affect handoffs. Omit host/tool internals outside workflow control.

Review map for recipient-visible paths, prerequisite ordering, disjoint parallel writes, protected files, and outputs without consumers. Keep only entries useful for design decisions.
