# Powder Shop Catalog Expansion Plan

Status: Rounds 1-3 implemented. Round 4 remains backlog.

Purpose: retain approved Powder shop expansion ideas for later implementation planning.

Implementation authorization: none. Each idea requires scoped follow-up plan before code changes.

## Direction

Grow through useful vertical slices:

`SQLite -> domain rules -> repositories -> API -> shared contracts -> React UI -> focused tests`

Preserve:

- Powder shop identity and safety messaging
- Existing catalog, cart, checkout, payment, account, favourites, mailbox behavior
- Powderizer contracts, pricing authority, stock rules, snapshots, history compatibility
- Local-first runtime without required external services

Avoid:

- LOC padding
- Empty packages or speculative abstractions
- Generated bulk code
- Duplicate domain rules across API and web
- Unsupported health, safety, fulfilment, certification, or performance claims

## Expansion Ideas

### Structured Powder Specifications and Tags

- Store typed product facts: texture, colour, source, intended use, pack weight, storage guidance, warning class
- Store normalized discovery tags separately from display labels
- Group specifications for readable product-detail sections
- Use shared attributes across filtering, comparison, similarity, bundles
- Preserve missing values; never synthesize fake product facts

### Advanced Catalog Filtering and Sorting

- Add filters for price range, date added, name, tags, availability, specification values
- Expand stable sorts: newest, oldest, name, price, bestselling
- Keep URL as catalog state authority
- Reset pagination after filter changes
- Restore complete state through browser history and direct links
- Share one server predicate model between result and count queries

### Product Comparison

- Support anonymous comparison of 2-4 powders
- Store selection in shareable URL
- Preserve requested order and report missing or inactive products
- Build specification matrix with differences first
- Retain latest valid selection in browser storage
- Add comparison actions to catalog cards and product detail

### Deterministic Similar Products

- Score candidates from category, tags, price proximity, matching specifications, availability
- Exclude source product and inactive products
- Apply explicit score caps and stable tie-breakers
- Keep scoring explainable, repeatable, user-independent
- Replace generic related shelf with isolated similar-products section

### Curated Bundles

- Model fixed Powder collections: starter sets, pantry sets, outdoor kits, questionable assortments
- Keep bundles separate from custom Powderizer mixes
- Calculate bundle total from current component prices
- Validate every component before cart mutation
- Add all components atomically; unavailable component blocks full operation
- Store ordinary cart lines; avoid bundle discount allocation or nesting initially

### Customer Reviews

- Require authenticated customer for create, update, delete
- Enforce ownership, one review per customer per product, rating and text bounds
- Derive verified-purchase status from owned paid orders
- Publish rating summary, average, star distribution, sortable review list
- Support admin hide and restore operations
- Keep hidden reviews out of customer lists and aggregates
- Preserve login return path from product detail

### Richer Product-Detail Pages

- Compose page: breadcrumbs -> gallery and purchase panel -> specifications -> bundles -> reviews -> similar products
- Give each remote section independent loading, empty, and failure states
- Keep core product and purchase flow usable when secondary section fails
- Link bundle components and comparison actions into wider catalog journey
- Use semantic grouped specifications and accessible review controls

### Append-Only Audit Trail

- Record important auth, cart, order, payment, review, bundle, seed actions
- Store actor, action, entity, request ID, timestamp, sanitized metadata
- Reject update and delete at repository and SQLite layers
- Keep required domain mutation and audit insert in shared transaction where practical
- Reject secret, payment, session, address, full review-body metadata
- Provide admin-only paginated read and filter views
- Provide no audit mutation API

### Help and Policy Section

- Add help index, FAQ, shipping, returns, powder safety, storage, pack-size guidance, privacy, terms
- Use typed content registry and shared accessible article layout
- Use native `details` and `summary` for FAQ
- Link every route from footer or relevant product context
- Keep static content independent from API and CMS
- State demo limitations and non-live commerce behavior truthfully

## Cross-Cutting Expectations

- Backend authority: price, stock, purchase evidence, review ownership, audit records
- Schema growth: additive ordered migrations preserving existing databases
- Contracts: transport schemas split by domain; no duplicated wire types
- Domain logic: pure deterministic helpers where possible
- Persistence: explicit rows, mappings, transactions, allowlisted query fragments
- UI state: URL for shareable catalog state; browser storage only for optional local continuity
- Verification: focused unit tests plus SQLite integration tests for rules, migrations, transactions, rollback

## Implementation Planning Order

Each lane requires scoped coding plan. Each plan must audit current Powderizer work, schema, contracts, routes, tests before phase design. Code remains implementation truth.

### Round 1: Catalog Foundation — Implemented 2026-07-17

Delivered:

- Lane A: structured specifications and tags, plus advanced catalog filtering and sorting.
- Lane B: API-independent help and policy center, including typed content, FAQ, routes, footer links, and accessibility coverage.

Round 2 is implemented. The lane details below are retained as the completed-scope record.

Lane A, serial:

`structured specifications and tags -> advanced filtering and sorting`

- Do not implement both topics in parallel. Shared ownership: product schema, contracts, repository queries, routes, catalog URL state, tests.
- Metadata phase prerequisites: explicit product active state, persisted creation date exposure, active-plus-stock availability rule.
- Metadata phase compatibility: reconcile pack weight, storage, warning facts with existing canonical packaging data. One authority per fact.
- Filtering phase: extend existing URL state, pagination reset, stable sort, shared result/count predicate behavior. Avoid catalog rewrite.

Lane B, parallel with Lane A:

`help and policy content`

- Scope: typed content registry, shared article layout, routes, FAQ, footer links, accessibility tests.
- Keep API-independent.
- Defer product-context links requiring `ProductPage` edits until Round 4.

### Round 2: Read Features and Audit Foundation — Implemented 2026-07-18

Delivered:

- Lane A: anonymous ordered product comparison and deterministic similar-product discovery, including shared contracts, persisted metadata reads, API routes, comparison UI/storage, and focused coverage.
- Lane B: append-only audit ledger, sanitized admin audit reads, and audit integration for existing auth, cart, order, and payment mutations.

Round 3 is implemented. The lane details below are retained as the completed-scope record.

Lane A, completed serial delivery:

`product comparison -> deterministic similar products`

- Plan together after Round 1 metadata completion.
- Do not implement as unrelated parallel slices. Shared ownership: product contracts, routes, cards, product detail, specification and tag reads.
- Comparison first establishes active-product and ordered multi-product read behavior.
- Similarity next reuses active state, tags, specifications, price, availability.

Lane B, completed parallel delivery:

`append-only audit foundation -> existing auth, cart, order, payment audit integration`

- Read-oriented catalog work and mutation-oriented audit work may proceed in parallel with explicit shared composition-file ownership.
- Complete audit foundation before bundle and review mutations.
- Preserve shared transaction rule for required mutation plus audit insert.

### Round 3: Mutation Features — Implemented 2026-07-19

Delivered:

- Lane A: curated bundles with ordered schema migration, canonical bundle catalog data, current-price calculation, atomic ordinary-cart-line additions, audit events, API routes, contracts, web browse/add flow, and focused coverage.
- Lane B: customer reviews with ordered schema migration, authenticated ownership rules, verified-purchase evidence, public summaries and lists, moderation, sanitized audit events, login return paths, product-detail UI, and focused coverage.

The lane details below are retained as the completed-scope record.

Parallel lanes after Round 2 audit foundation:

- Lane A: curated bundles
- Lane B: customer reviews

Parallel conditions:

- Reserve separate ordered migration versions.
- Keep domain modules, contracts, repositories, routes, tests, UI sections separate.
- Bundles own cart transaction integration.
- Reviews own auth, ownership, paid-order evidence, moderation integration.
- Defer final `ProductPage` composition to Round 4.

### Round 4: Frontend Journey and Product-Detail Composition

`comparison entry points -> specifications -> bundles -> reviews -> similar products`

- Close the Round 2 discoverability gap with comparison actions on catalog cards and product detail, plus a clear path to the comparison page.
- Keep anonymous 2-4 product selection, requested order, shareable URL state, and latest valid browser selection consistent across entry points.
- Integrate completed slices into richer product-detail page.
- Preserve core product and purchase flow when secondary sections fail.
- Give each remote section independent loading, empty, failure state.
- Add bundle component links and help and policy context links.

### Parallelism Guardrails

- Same schema, contract, route, or page owner -> serial delivery or explicit file ownership.
- Independent static web content -> safe parallel lane.
- Read-only catalog slice and mutation/audit slice -> safe parallel lanes after composition boundaries assigned.
- Product-detail integration -> one final owner after feature slices complete.
