# Powder Shop Catalog Expansion Plan

Status: high-level idea backlog.

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

## Future Planning Order

1. Specifications and tags -> filters and sorting
2. Comparison -> deterministic similarity
3. Curated bundles
4. Customer reviews
5. Append-only audit trail
6. Rich product-detail composition across completed slices
7. Help and policy content

Ordering remains provisional. Later plan must audit current Powderizer work, schema, contracts, routes, tests before phase design.
