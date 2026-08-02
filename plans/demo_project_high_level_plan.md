# Demo Project High-Level Plan

Status: current product direction. Last refresh 2026-08-01 @ `4fa6d64` (branch `expansion_002`).

## Direction Change

Repo originally built as B2C powder retail (`QArefully Powder Co.`, consumer browse -> bag -> checkout). Now a B2B bulk-materials wholesale portal (`QArefully Materials Exchange`) for trade buyers (shops, supermarkets) ordering by sack/pallet, sugar -> cement.

Reason: original consumer-shop idea works but B2B bulk trade is more grounded in real-world commerce -> better QA learning material. New surfaces (bulk pricing tiers, minimum order quantities, pallet/freight logistics) generate richer, more realistic agentic engineering + QA scenarios than single-unit retail.

Pivot is additive, not rewrite. Reuse catalog/pricing/inventory/checkout/orders foundations. Reframe UI + rules toward trade buyer; retain production boundaries.

Phase status: rebrand pass COMPLETE. Three passes landed and merged -> B2B rebrand, gap closure, catalog colour schemes and pigments. Expansion items landed since the pivot: Custom Blend (16), Checkout depth (4), Pricing and promotions (5), Account depth (7), Secondary admin (9), Buy Again / reorder (12). Current phase: expansion per `Future Expansion Order` below.

## Purpose

Local bulk-materials wholesale codebase for course exercises and large-repository harness demos. Deployment remains non-live demo; code follows production defaults.

Goals:

- immediate recognition: credible B2B wholesale portal with real-world bulk materials catalogue (sugar -> cement)
- clear domain journey: browse -> cart -> bulk checkout -> confirmation
- modern polished UI
- deterministic local behavior
- meaningful growth to 150k+ authored LOC
- rich agentic engineering and QA tasks
- additive growth; no rewrite of current storefront foundations
- production-grade migrations, validation, authorization, transactions, error handling, and data integrity
- simulated local integrations without production deployment obligations

## Product Direction

B2B wholesale portal selling bulk materials by sack/pallet across six catalog categories: Baking & Pantry, Sports Nutrition, Drinks, Household & Cleaning, Garden & Outdoors, Trade & Creative Materials. Buyers are trade accounts (independent shops, supermarkets) reselling stock. Brand voice: industrial, confident, unrestrained. Non-food products remain clearly marked `Not for consumption`.

Core journey:

`home -> catalog -> lot detail -> cart -> bulk checkout -> payment -> confirmation -> order history`

No persisted quote object; cart-only. RFQ/persisted quotes rejected, do not re-add.

Extended familiar journeys:

- search, filter, sort, paginate
- select variant (SKU, pack/pallet size, weight, delivery class)
- bulk pricing tiers + minimum order quantity per lot
- configure a custom blend on a base lot -> one cart line
- apply promotion or trade discount
- save trade delivery sites and payment preference metadata
- track, cancel, or return order
- write verified-purchase review
- manage watchlist, trade profile, sessions, and notification preferences
- export account data or delete the account
- invite colleagues to a company account and approve orders over its threshold

Avoid visible platform complexity:

- no open seller marketplace as main concept; catalog is operator-listed
- keep logistics framing simple (pallet + freight), no standalone warehouse product
- no live trading, auctions, or bidding; rejected direction, do not re-add
- no external/live financial-market dependency
- no microservice topology exposed to users
- optional admin tooling stays secondary and absent from normal journey

## Current Baseline

- monorepo: npm workspaces
- web: React, Vite, TypeScript
- API: Fastify, TypeScript
- database: local SQLite
- shared contracts: TypeBox
- launch: `npm ci` -> `npm run dev`
- external services: none
- implemented commerce: auth, catalog, cart, inventory, promotions, checkout, simulated payment, orders, returns and refunds, saved lists, account, dev mailbox
- implemented catalog depth: 100 products across 6 categories, typed specifications and tags, advanced filters and stable sorts, product variants with SKU/price/weight/stock, comparison, similar products, curated bundles, customer reviews with helpfulness and abuse reporting
- implemented B2B unit and pricing model: 25 kg sack purchase unit, 40 sacks = 1 t pallet, per-variant `moqSacks` floor, qty-break `TIER_LADDER` (1 t 0%, 5 t 5%, 10 t 10%, non-compounding), derived `perTonneCents` for `£/tonne` display; active clearance windows replace list-price base before tier calculation; cart and product views disclose next tier and MOQ shortfall; constants owned by `packages/contracts/src/pricing.ts`, rules by `apps/api/src/features/pricing/`
- implemented pricing and promotions: category-scoped promotion eligibility and discount bases, `CATEGORY_MISMATCH`, clearance -> tier -> promo stacking over material only, and persisted V8 checkout/order snapshots carrying promo scope and discount base; freight, booked delivery slots, and Custom Blend fees remain outside discount calculations
- implemented Custom Blend: `/custom-blend` configurator -> base lot plus 1-4 catalog-lot ingredients at whole-percent ratios (each 5-50%, total <= 50%, base is remainder), `mixingGroup` compatibility gate, `configKey` blend identity on cart and order lines, flat `CUSTOM_BLEND_FEE_CENTS` per line outside the tier-discountable subtotal, ingredients drawing no inventory, blend lines excluded from returns while cancellation stays unchanged
- implemented customer journey: composed product detail, comparison entry points, help and policy center
- implemented packaging artwork: web-side resolver on category + facts -> food bag, stitched kraft sack, woven PP sack, rigid HDPE keg; deterministic per-category colour schemes and pigment accents; `/bag-designs` fixture page
- implemented delivery: freight-only seeded lots with simulated freight charge at checkout; `deliveryClass` enum retains `parcel` unused; freight lead-time calculation and bookable delivery slots (`apps/api/src/features/delivery/`)
- implemented trade accounts: saved delivery sites and billing entities with shared address normalisation and defaults (`apps/api/src/features/tradeAccount/`, `apps/web/src/features/account/`), consumed at checkout alongside a buyer PO/reference number recorded on the order
- implemented account depth: session list with device/last-seen metadata and selective revocation, notification preferences, JSON data export, account deletion with tombstoned identity and order retention (`features/preferences/`, `features/accountExport/`, `features/accountDeletion/`)
- implemented company accounts: company record -> membership roles (`owner`, `buyer`, `approver`, one active membership per user) -> tokenised email invites, plus a per-company `approvalThresholdCents` gate that defers checkout into an approval request; approver inbox and buyer request list at `/approvals` (`features/companyAccounts/`, `features/orderApprovals/`)
- implemented secondary admin: `/admin` shell over product and lot/variant management, promotion and clearance-window administration, user suspension and role changes, paginated/filtered order list plus detail, standalone idempotent refunds on an immutable ledger, and feature-flag toggles; every mutation writes the audit ledger (`routes/admin*.ts`, `apps/web/src/features/admin/`)
- implemented buy again / reorder: `POST /api/orders/:orderId/reorder` re-adds every resolvable line of an owned past order through the reusable multi-line `CartService.addMany` path, returning one outcome per source line with its skip reason and server-resolved price drift; `Buy again` sits on order history and order detail (`apps/api/src/features/reorder/`, `apps/api/src/features/cart/cartBulkAddRules.ts`, `apps/web/src/features/reorder/`). No schema change; migration head stays `028`
- implemented saved lists: variant-scoped named lists, default `Favourites` list, list/cart/order save actions, and whole-list add through `CartService.addMany` (`apps/api/src/features/savedLists/`, `apps/api/src/routes/savedLists.ts`, `apps/web/src/features/savedLists/`, `apps/web/src/hooks/SavedListsContext.tsx`); `/lists` is protected and legacy `/wishlist` redirects there
- implemented async behavior: migration `030` local queue/retries, notification inbox and preference-gated delivery, captured payment webhooks, deterministic fault flags, admin diagnostics, and standing-order schedules that create carts only (`apps/api/src/features/{jobs,notifications,webhooks,standingOrders}/`, `apps/web/src/features/{notifications,standingOrders,admin/jobs,admin/webhooks}/`)
- implemented integrity: ordered migrations through `030` (`sort_order < 1` variants retired in `020`; obsolete Custom Small Order schema physically removed in `021`; custom blend tables plus cart/order line rebuild in `022`; trade delivery sites, billing entities, and order delivery/billing detail in `023`; clearance, scoped promo, and order discount-base columns in `024`; session metadata, preferences, deletion events in `025`; company accounts, memberships, invites, order approvals in `026`; user suspension, feature flags, immutable `admin_refunds` in `027`; retired variants share `sort_order 0` while live positions stay unique per product in `028`; `029` replaces product favourites with saved-list tables and migrates active default variants at the MOQ floor; `030` adds jobs, attempts, notifications, captured webhooks, standing-order schedules/runs, FK-safe lifecycle constraints, and queue indexes), append-only audit ledger, sanitized admin audit reads
- seed: 100 deterministic products across 6 categories (Sports Nutrition 20, Baking & Pantry 20, Drinks 15, Household & Cleaning 15, Garden & Outdoors 15, Trade & Creative Materials 15), each carrying a nullable `mixingGroup` from a fixed set of eight (`food-grade`, `cleaning`, `garden-treatment`, `cementitious-materials`, `casting-materials`, `pigments`, `theatrical-effects`, `absorbents`) validated in `packages/catalog`, plus users, promotions including `GARDEN10` and `CLEANFIVE`, active/expired/future clearance fixtures, Alice's default Favourites plus mixed-outcome Monthly restock list, catalog metadata, curated bundles, inventory/backorder scenarios, company-account fixtures with an approval threshold, one disabled `admin.example_flag`, and six demo order scenarios including `alice-reorder-mix`, the buy-again fixture that reorders into a mixed added/skipped result
- tests: focused unit, contract, route, SQLite integration, React integration, and accessibility coverage; broad E2E coverage reserved for course
- completed plan records are no longer retained. `plans/old/` was deleted at commit `8285c62`, and `plans/account_depth_coding_plan.md` plus `plans/secondary_admin_coding_plan.md` at commit `186039d`, and `plans/buy_again_reorder_coding_plan.md` once 12 landed; `plans/` holds this file plus any in-flight coding plan only. Do not cite a `plans/old/` path as a source - implementation truth is the code, the migrations, and git history
- history pointers for completed items, in place of the deleted plan documents: catalog expansion, inventory, returns and refunds, order history and lifecycle, review depth, materials-exchange gap closure, bag colour schemes and pigments, and Custom Small Order retirement predate migration `022`; Custom Blend (16), Checkout depth (4), and Pricing and promotions (5) landed with migrations `022`-`024` in commits `f63e9bf` / `b1957ba` / `b537512`; Account depth (7) and Secondary admin (9) landed with migrations `025`-`028` in commits `3c0d6d7` / `d922c4e`; Buy Again / reorder (12) landed with no migration in commit `12838a9`, merged `4fa6d64`; Saved Lists (13) landed 2026-08-01 with migration `029`

## Hard Constraints

- Windows and macOS support
- Node.js-only toolchain
- no Docker
- no required account, API key, cloud service, or network after install
- clone-to-running target: about two minutes on supported machine
- single customer-facing web application
- SQLite remains default local database
- integer minor units for money; backend authoritative
- deterministic reset and seed
- production code standards apply despite demo-only runtime
- modern desktop UI at `1920x1080`, `1920x1200`, `3840x2160`
- preserve course behavior: frontend five-item promo gate in `cartValidation.ts`; backend promotion rules; `SAVE10` remains 10% with five-item minimum ("item" = one cart line unit, i.e. one 25 kg sack)

## Growth Strategy

Grow through depth behind familiar store actions. Prefer modular monolith until distributed behavior serves named demo.

Domain shape, as built: domains are directories under `apps/api/src/features/` (`catalog`, `pricing`, `promos`, `inventory`, `checkout`, `orders`, `payments`, `delivery`, `returns`, `reviews`, `auth`, `audit`, `cart`, `bundles`, `savedLists`, `mailbox`, `passwordReset`, `customBlend`, `tradeAccount`, `preferences`, `accountExport`, `accountDeletion`, `companyAccounts`, `orderApprovals`, `featureFlags`, `jobs`, `notifications`, `webhooks`, `standingOrders`). Workspace packages stay limited to `contracts` (transport) and `catalog` (canonical static content). Promote a domain to its own workspace package only when a second consumer needs it; do not pre-split.

Each domain may contain:

- models and contracts
- business rules
- commands and queries
- validation and error definitions
- persistence adapters
- domain events
- focused test helpers
- basic unit tests for critical pure rules
- basic SQLite integration tests for persistence and transactions

Build vertical slices:

`database -> domain -> API -> UI -> critical unit or SQLite integration test`

Avoid empty scaffolding, copied framework internals, vendored projects, generated-code padding, duplicate abstractions.

## Future Expansion Order

Status: delivery order for remaining work. `partial` = implemented subset; `future` = listed capability not delivered.

Precursor B2B rebrand pass: COMPLETE. Brand/copy, sack/pallet unit model, `£/tonne` display, MOQ + qty-break tier engine, heavy-duty packaging artwork all landed. All items below build on that baseline.

1. Order history and lifecycle: completed
2. Inventory: completed
3. Returns and refunds: completed
4. Checkout depth: completed
   - landed 2026-07-28 (`b1957ba`), merged `ec37390`
   - foundation: validated contact, delivery address, server-authoritative totals, idempotent simulated payment
   - delivered: saved trade delivery sites and billing entities (`apps/api/src/features/tradeAccount/`, account UI sections, shared address normalisation in `packages/contracts/src/address.ts`), freight lead-time calculation plus bookable delivery slot selection (`features/delivery/deliverySlotRules.ts`, `routes/deliverySlots.ts`), PO/reference number captured at checkout and surfaced on order history/detail
   - schema: migration `023` adds trade delivery sites, billing entities, and order delivery/billing columns
   - dropped (B2B pivot): gift options; parcel/express delivery-method choice (all lots pallet freight; `deliveryClass` enum retained but seeded `freight`)
   - QA surface, live: lead-time boundary vs slot cutoff, slot no longer bookable between quote and payment, address normalisation and default-site selection, PO reference validation, idempotent payment replay carrying delivery/billing detail
5. Pricing and promotions: completed
   - landed 2026-07-29 (`b537512`), merged `bc87973`
   - schema: migration `024` adds variant clearance windows, promo category scope, and order discount-base columns
   - completed: percentage and fixed discounts, start/end scheduling, item/subtotal gates, global and per-user limits, reservation-safe redemption
   - completed: MOQ + qty-break tier engine replacing flat variant price; exact-boundary, rounding, next-tier-progress, and MOQ-shortfall coverage
   - completed: active clearance windows feed list-price replacement -> tier -> promo; catalog, product, cart, checkout, persisted V8 quotes, and orders use server-resolved pricing
   - completed: category-scoped promo codes calculate gates and discounts on matching material lines only; `CATEGORY_MISMATCH`, eligible subtotal, scope, and discount base are surfaced through checkout and orders
   - completed: discountable subtotal split, so the Custom Blend fee (16) is excluded from promo and tier maths; freight remains outside promo discounts
   - out of scope: promotion/clearance administration UI belongs to Secondary admin (9); multiple promotion codes, automatic category offers, RFQ/persisted quotes, trade-account net pricing, and login-to-see-price not delivered
   - QA surface, live: clearance window boundaries at the request clock, clearance -> tier -> promo stacking order, `CATEGORY_MISMATCH` on a scoped code, eligible-subtotal gates on mixed-category carts, promo/tier leakage onto freight, delivery slots, or the Custom Blend fee, rounding drift on non-round line weights
   - dropped (B2B pivot): gift cards, loyalty points
   - rejected, do not re-add: RFQ/persisted quotes, trade-account net-price tiering, login-to-see-price
6. Review depth: completed
7. Account depth: completed
   - landed 2026-07-30 (`3c0d6d7`), merged `f2ee665`
   - schema: migration `025` adds session metadata, `user_preferences`, `account_deletion_events`; `026` adds company accounts, memberships, invites, order approvals
   - completed earlier: session creation, expiry, logout, password-change invalidation, profile read, password change
   - completed via 4: trade delivery sites + billing entities (address model, account UI)
   - completed: session list carrying user agent, hashed IP, and last-seen; selective revocation and revoke-others; notification preferences; JSON data export; account deletion that tombstones identity, cascades personal data, and retains orders
   - completed (B2B): company accounts with `owner`/`buyer`/`approver` roles, tokenised email invites with pending/accepted/revoked/expired states, one active membership per user, and a per-company `approvalThresholdCents`
   - completed: checkout defers over-threshold carts into an approval request instead of paying; approver decision unlocks a retry keyed to the same requester, and quote drift, rejection, or lease expiry (`APPROVAL_LEASE_MS`, 24 h) forces re-quote
   - QA surface, live: revoking the current session vs. another device, deletion with live orders and approvals outstanding, export completeness after deletion of related rows, threshold at exactly the quote total, approval granted then cart edited -> total drift, approved request replayed by a different buyer, invite accepted after expiry or by a user already in another company
8. Async behavior: completed
   - landed 2026-08-02: migration `030_async_behavior.ts` adds FK-clean local jobs, attempts, notifications, captured webhooks, standing orders, and runs.
   - delivered: deterministic local queue and retries; buyer inbox plus preference-gated mailbox delivery; captured simulated payment webhooks; four local fault flags; admin queue drain and webhook inspection.
   - standing orders: schedules create a new cart from an owned saved list or past order and report outcomes. They never autonomously place an order, payment, or approval; buyer checkout re-evaluates current rules.
   - preserved decision: existing checkout and approval mailbox calls remain unchanged.
9. Secondary admin: completed
   - landed 2026-07-30 (`d922c4e`), merged `6d7b07e`
   - schema: migration `027` adds user suspension columns, `feature_flags`, and an immutable `admin_refunds` ledger with update/delete triggers; `028` frees `sort_order` for retired variants
   - completed earlier: review moderation API and UI; paginated, filtered, read-only audit API
   - completed: product administration and lot/variant management (create, edit, reorder, retire) writing MOQ, pricing, and clearance through the same server rules as 5
   - completed: promotion administration covering scope, scheduling, limits, and clearance windows
   - completed: user administration -> role change, suspension with reason and actor, session invalidation on suspend
   - completed: paginated and filtered admin order list plus order detail; orders stay read-only, lifecycle transitions keep their existing guards
   - completed: standalone admin refunds, idempotency-keyed against a simulated processor, recorded immutably and never editable
   - completed: feature-flag CRUD and toggles with a cached resolver (`featureFlagResolver.ts`); the seeded `admin.example_flag` has no consumer yet, so no product behavior is flag-gated
   - constraint: admin stays behind the `admin` role and off the customer journey; every mutation writes an audit event
   - QA surface, live: retiring a variant held in a cart, editing a promo mid-redemption, suspension revoking live sessions, duplicate refund idempotency key, refund exceeding captured amount, admin acting on another admin, flag toggle visible to a cached resolver
   - remaining: wire a flag to real checkout behavior when a named demo needs it (see Agentic AI and QA Surface)
10. Country localisation: future
    - region profiles: USA, Europe, China; configurable catalog, stock, currency, trading hours, time zones, language, formatting, and policy text
    - behavior: region-aware availability, order validation, seeded scenarios, and deterministic time-zone boundaries
    - architecture: shared domain core -> explicit region config -> localized API and UI behavior
    - scope: localisation-ready content and boundaries only in this baseline; translation and multi-currency belong to a dedicated future plan
11. Custom Small Order retirement: completed
    - decision closed: consumer-scale custom ordering conflicted with the 25 kg sack / `£/tonne` model and was redundant beside the 4-sack MOQ
    - removed end-to-end: UI, routes, API, contracts, tests, help content, and obsolete styling
    - migration `021` physically removes obsolete schema. Earlier migrations remain immutable history; local SQLite is disposable
    - frees one nav slot for 16; retained `.custom-blend-nav-link` CSS is reserved for its greenfield UI
12. Buy Again / reorder: completed
    - landed 2026-08-01 (`12838a9`), merged `4fa6d64`
    - landed as `POST /api/orders/:orderId/reorder` (`requireCustomer` plus order ownership) -> `CartService.addMany` -> one outcome per source order line. `Buy again` control sits on order history rows and order detail (`apps/web/src/features/reorder/`)
    - no new domain concept and no new persistence: schema unchanged, **no migration; head stays `028`**
    - partial success is the normal result and is reported per line. Skip reasons as built: `VARIANT_RETIRED`, `VARIANT_UNRESOLVED`, `INSUFFICIENT_STOCK`, `BELOW_MOQ`, `INVALID_QUANTITY`, `BLEND_UNAVAILABLE` (`apps/api/src/features/cart/cartBulkAddRules.ts` owns the fixed precedence; `features/reorder/reorderRules.ts` owns the two pre-cart reasons)
    - price drift is disclosed, not acted on: every outcome carries `orderedUnitPriceCents`, a server-resolved `currentUnitPriceCents`, and `priceChanged`. Drift never blocks or rewrites a line, and the price is re-derived server-side through the same clearance -> tier composition the cart uses
    - Custom Blend lines re-add under their original `configKey`; blend ingredients are re-validated, and an unavailable blend skips as `BLEND_UNAVAILABLE`
    - not built: no substitution offer for a retired lot. A retired lot is skipped with `VARIANT_RETIRED` and the buyer chooses a replacement themselves. The earlier "substitution refusal" framing described a refusal to substitute, which is what shipped
    - QA surface as built: partial add-to-cart reporting, price-drift disclosure, retired-lot refusal, MOQ floor, aggregation of duplicate lines sharing one `(variantId, configKey)` identity, and the reserved-cart (`CART_RESERVED`) conflict between reorder and an in-flight checkout
    - demo fixture: seeded order `alice-reorder-mix` (`apps/api/src/db/orderSeedScenarios.ts`, owner `alice@example.com`) reorders into a deliberately mixed result - one line added with drifted price against the active clearance window on `GDN-1043-001`, one `INSUFFICIENT_STOCK` skip, one ordinary added line
13. Saved Lists: completed
    - landed 2026-08-01: migration `029_saved_lists.ts` replaces product-scoped `favourites` with `saved_lists` and `saved_list_items`; active default variants migrate into the default `Favourites` list at their upward-adjusted MOQ. The migration is FK-clean and list rows remain variant-scoped thereafter.
    - delivered paths: contracts in `packages/contracts/src/savedLists.ts`; API domain in `apps/api/src/features/savedLists/`; 11 authenticated endpoints in `apps/api/src/routes/savedLists.ts` for list/create/read/rename/delete, item add/update/delete, list add-to-cart, and save current cart or owned order as a list; web state and pages in `apps/web/src/hooks/SavedListsContext.tsx` and `apps/web/src/features/savedLists/`.
    - buyer path: protected `/lists` and `/lists/:listId`; `Save to default list` replaces the product heart, `Save as list` is available from cart and owned order, and `/wishlist` is a protected redirect to `/lists`, retiring the Wishlist feature without adding a navigation item.
    - decisions: lists store only ordinary stock variants (no Custom Blend configuration); saved quantities are raised to each current MOQ before the one shared `CartService.addMany` request, never substituted or clamped. Default `Favourites` cannot be deleted; list ownership, limits, names, and all mutations are enforced server-side and audited.
    - QA surface, live: migration absorption and FK check; owner/auth isolation; default-list invariant; name/list/item limits; cart and order saves; MOQ adjustment; retired and insufficient-stock partial outcomes; reserved-cart rejection; stale async UI handling and `/wishlist` redirect.
    - demo fixture: Alice's `Monthly restock` (`apps/api/src/db/savedListSeed.ts`) deliberately returns four outcomes on add: ordinary added, quantity raised to MOQ, retired variant skipped, and insufficient-stock variant skipped.
14. Quick Order: completed
    - delivered at `/quick-order`, with a cart entry link: paste or type `SKU, qty` lines -> cart. The route reports every nonblank physical input line and offers the cart link only when at least one line was added.
    - migration-free: no persistence or seed-data change; schema head remains `029`.
    - the parser accepts comma, semicolon, tab, or whitespace separators, normalises SKU case, preserves physical line numbers, and bounds input to 200 nonblank lines of 200 characters each.
    - each valid SKU is aggregated before submission. MOQ round-up is therefore decided from the aggregate: one 25 kg-sack request rounds to its 4-sack MOQ, while duplicate `2 + 2` requests submit as 4 with no adjustment. The cart receives one `CartService.addMany` request per SKU group and an outcome fans back to each original line.
    - reachable per-line reasons are `MALFORMED_LINE`, `SKU_NOT_FOUND`, `INVALID_QUANTITY`, `VARIANT_RETIRED`, and `INSUFFICIENT_STOCK`. `BELOW_MOQ` cannot occur because Quick Order resolves the group MOQ before calling the cart; `BLEND_UNAVAILABLE` remains in the shared transport vocabulary but is not reachable because this feature submits only plain SKU lines.
    - QA surface: unknown SKU, duplicate aggregation, malformed/invalid quantity, aggregate MOQ rounding, mixed valid/invalid input, reserved-cart rejection, and one missing-cart recovery replay. The retired-lot case uses test-local state only; reset seed intentionally has no retired variant fixture.

    Constraints 13 and 14 inherit from the landed `CartService.addMany` (`apps/api/src/features/cart/cartService.ts`, rules in `cartBulkAddRules.ts`):
    - callers submit one request per desired line, each carrying an opaque caller-owned `key`; outcomes come back correlated by that key, so the caller owns its own line identity and the cart feature stays feature-agnostic
    - requests sharing a `(variantId, configKey)` identity are aggregated into one demand and judged once, then the single verdict fans back out to every contributing key. A list or paste containing the same SKU twice is one cart line, judged at the combined quantity
    - a group is added at its full requested quantity or not at all. Quantity is never clamped down to stock nor rounded up to the MOQ floor, so 14's "MOQ rounding" must be a client-side or feature-side decision made before submission, not something the cart will do
    - skip-reason precedence is fixed and shared: `VARIANT_RETIRED` -> `BLEND_UNAVAILABLE` -> `INVALID_QUANTITY` -> `INSUFFICIENT_STOCK` -> `BELOW_MOQ`. A new feature needing a new reason extends this one enum rather than inventing a parallel vocabulary
    - the whole batch runs inside one unit of work and requires an audit context; partial success is a domain outcome, never an error, and never rolls back the lines that did apply. A reserved cart rejects the entire batch with `CART_RESERVED`
    - the cart resolves and returns the clearance-then-tier unit price at the post-add cumulative quantity, so consumers disclose server-resolved prices rather than re-deriving them
15. Back-in-stock notification: unblocked
    - `notify me when available` on out-of-stock lots
    - one-line concept, real async behavior -> first consumer of the local job queue in 8
    - async foundation landed; do not build standalone polling
16. Custom Blend: completed
    - decision 2026-07-25 APPROVED, landed 2026-07-26. Buyer picks base lot -> adds ingredients at ratios -> one configured cart line. Value proposition = "spec the material", not "order small"
    - distinct from retired 11: anchored to an existing base lot, sold in the 25 kg sack / `£/tonne` unit model. Item 11 rejection reasons (redundant vs MOQ 4 sacks; consumer bag scale) do not transfer
    - built greenfield after 11. Reuses no retired code; took the freed nav slot and the preserved `.custom-blend-nav-link` treatment, now live on the `Custom Blend` nav entry
    - ingredients are references to real catalog lots, drawn from any category, gated by `mixingGroup`. Ingredients displace base material; line weight stays fixed by sack count
    - rules as built: 1-4 ingredients, each 5-50%, total <= 50%, whole percent steps; base is the remainder; blend inherits base lot MOQ
    - pricing as built: base `£/tonne` for full line weight plus flat `CUSTOM_BLEND_FEE_CENTS` per line, independent of contents. Ingredient cost not passed through; tier applies to the material subtotal, fee sits outside the discountable subtotal -> no compounding, and promotions never discount the fee
    - ingredients draw no inventory (always-available blending stock); base lot draws stock normally
    - blends are non-returnable, made to order; marked at configure, cart, checkout, and order. Cancellation terms unchanged
    - line identity: canonical ingredient ordering -> hashed `configKey` distinguishes blend lines from stock lines and from each other; shared by web (`lib/cartLineIdentity.ts`) and API
    - schema: migration `022` adds custom blend tables and rebuilds cart/order line items to carry blend identity and fee
    - QA surface, live: ratio cap and floor boundaries, mixing-group incompatibility, ingredient lot sold out yet specifiable, MOQ floor on a blend line, tier boundary with non-compounding fee, blend excluded from returns while stock lines stay eligible, base lot retired while blend held in cart
    - records: `plans/custom_blend_coding_plan.md` (implementation), `plans/custom_additives_handoff.md` (product input)

Items 12-15 replace the retired 11. They compose as one line of work -> order -> save as list -> reorder -> notify. All funnel through the same multi-line cart-add path; 12-14 are landed and 15 is unblocked by 8. Standing orders stop at a cart and leave checkout to the buyer. 16 sat outside that chain and has consumed the nav slot; 12-15 remain reachable from order history, account, and catalog surfaces without new nav entries.

Landed 16 constrains later work: cart and order lines now key on variant plus `configKey`, and line totals separate a discountable material subtotal from a non-discountable blending fee. Items 12-14 must respect both -> multi-line cart-add paths carry blend identity. 4 and 5 already respect both.

Landed 4 constrains later work: checkout now resolves a delivery site, billing entity, delivery slot, and PO reference before payment. Items 8 and 12 must carry that context -> total recalculation keeps the freight charge and slot selection intact, reorder (12) re-enters checkout without assuming a bare address form, and any scheduling in 8 reuses the lead-time rules rather than forking them. 5 already carries it.

Landed 5 constrains later work: pricing is server-resolved as clearance -> tier -> promo over the material subtotal only, and checkout/order snapshots are strict V8 carrying promo scope plus discount base. Items 12-14 must re-resolve price from the server on every cart add rather than trusting a stored line price (price-drift disclosure in 12 reads the resolved figure); 9 administration UI writes clearance windows and promo scope through the same rules; 10 currency work extends the existing minor-unit money path, never a parallel one.

Landed 7 constrains later work: checkout can now end in a deferred approval rather than a paid order. Item 12 reorder must re-enter checkout expecting that outcome, and 8 scheduling for standing orders re-evaluates the threshold per run instead of inheriting one approval. Account deletion tombstones identity while retaining orders -> any later surface reading order history must tolerate a deleted buyer.

Landed 9 constrains later work: administration is the single write path for lots, promos, clearance windows, users, refunds, and flags, and every mutation writes an audit event. Later items add admin screens to that shell rather than new operator surfaces, and 10 region configuration is administered there too. `featureFlagResolver` caches per key -> any flag consumer added later must invalidate on toggle.

### Sequencing Guidelines

Readiness favors `partial` items with self-contained remaining slices over greenfield `future` subsystems.

Recommended order:

1. Reorder chain: 12, 13, and 14 are landed. Saved Lists and Quick Order consume the multi-line cart-add path 12 established (`CartService.addMany`) under the constraints listed against 13 and 14; neither forks a second implementation.
2. Then Country localisation (10). Back-in-stock (15) can consume Async behavior (8).

Custom Small Order retirement (11), Custom Blend (16), Checkout depth (4), Pricing and promotions (5), Account depth (7), Secondary admin (9), and Buy Again / reorder (12) are complete. 16 landed before 4, taking 11's freed nav slot and Custom Blend CSS; 4 then landed on the settled checkout path, 5 closed the money path, and 7 + 9 landed in parallel with the shared user/session lane owned by 7.

Parallelization rules:

- Resolved: 7 + 9 ran concurrently as planned; the shared user/session lane stayed with 7 (deletion, revocation) while 9 took user role and suspension on top of it.
- Resolved: 4 landed the delivery-site/address model itself rather than consuming it from 7.
- Resolved: 4 and 5 were serialized on the server-side total path (freight charge, tier discounts, MOQ validation, blending-fee exclusion, rounding). Both are landed, so the money path is settled; later items consume server-resolved pricing rather than re-deriving it.
- Resolved: 12 landed the shared multi-line cart-add path as a feature-agnostic cart capability rather than as reorder-private code; 13 and 14 both consume it with their own line-source handling.
- 10 is unblocked by the money path (4 and 5 landed) but still touches currency, availability, and policy across nearly everything -> keep it after the reorder chain.
- 8 is the only remaining subsystem with a queued consumer already named (15, plus standing/repeat orders that must re-check the 7 approval threshold per run).

## Agentic AI and QA Surface

Prefer tasks crossing several clear boundaries without changing visible product concept.

High-value scenarios:

- quantity crosses a qty-break tier boundary mid-cart -> per-unit and `£/tonne` figures must both move
- MOQ floor rejects a line at exactly one sack below minimum; passes at exactly minimum
- `perTonneCents` rounding drifts against line total on non-round weights
- blend ratios sit exactly at a boundary (one ingredient at 50%, four at 5%, total at 51%)
- promotion or tier discount leaks onto the non-discountable blending fee
- two cart lines share a base lot but differ by one ingredient percent -> must stay separate `configKey` lines
- price changes while item remains in cart
- concurrent purchases compete for final stock
- duplicate payment submission uses idempotency key
- promotion combinations produce boundary and rounding bugs
- partial cancellation changes tax, discount, and refund totals
- webhook arrives twice or out of order
- background notification retries after transient failure
- role lacks permission for refund or moderation action
- cart total crosses a company approval threshold, then drifts after approval is granted
- session revoked on one device while a request is in flight; suspension invalidates live sessions
- admin retires a lot or edits a promo while a buyer holds it in cart
- feature flag changes checkout behavior (flag infrastructure live in 9; no consumer wired yet)
- migration must preserve existing seeded and user-created data
- search, order, and notification state becomes eventually consistent

## Basic Test Baseline

Purpose: protect absolute must-have rules while leaving major test-design work for course.

Unit scope:

- frontend five-item promo gate
- money and discount rounding
- MOQ floor and qty-break tier selection; `perTonneCents` derivation
- blend ratio validation, canonical `configKey` derivation, and blending-fee exclusion from the discountable subtotal
- promotion eligibility and discount calculation
- order transition guards
- inventory quantity and reservation rules
- approval threshold evaluation and its drift, rejection, and lease-expiry outcomes

Integration scope:

- isolated temporary SQLite database
- schema creation and guarded migrations
- repository create/read/update flows for critical domains
- order/payment/inventory transaction commit and rollback
- deterministic reset and seed counts

Integration boundary:

`domain service -> SQLite adapter -> temporary database`

Excluded from minimum baseline; scoped vertical slices may add focused coverage when risk requires:

- HTTP route tests
- API tests through Fastify injection, `fetch`, or other client
- E2E tests
- Playwright
- browser automation
- contract tests
- visual regression tests
- accessibility automation
- property-based tests
- load or performance tests
- broad coverage target

Keep suite focused, stable, fast, and obvious. Test only critical happy paths, invariants, and one or two high-risk failures per selected rule. Course owns expansion into full testing strategy.

## LOC Target

Target: 150k+ meaningful authored LOC. Report production and test LOC separately.

Measured 2026-08-02 in the Async Behavior worktree (tracked plus untracked authored `apps/**` + `packages/**`, `*.ts|*.tsx|*.css|*.sql`, excluding `node_modules`, `dist`, `coverage`): production 64,979 across 508 files; test 45,878 across 244 files; total 110,857 across 752 files. Roughly 74% of target -> expansion items 10 and 15 carry remaining growth.

Suggested allocation:

- customer React application: 40k-45k
- API and domain implementations: 65k-75k
- shared contracts and infrastructure: 20k-25k
- basic unit and SQLite integration tests: 4k-6k
- seed scenarios and developer tooling: 15k-20k

Count:

- authored TypeScript, TSX, CSS, SQL, test code, migrations, developer tooling

Exclude:

- `node_modules`
- lockfiles
- build output
- coverage output
- generated clients
- snapshots
- vendored code
- downloaded assets

## Product Image Strategy

Rule: database product does not imply unique committed image.

Current implementation: product media is rendered as deterministic in-app SVG vessel artwork, not stored raster files. The web packaging resolver maps category + product facts -> vessel + colour scheme + pigment accent:

- food bag: Baking & Pantry, Sports Nutrition, Drinks
- rigid HDPE keg: Household & Cleaning
- woven PP sack: Garden & Outdoors
- stitched kraft sack: Trade & Creative Materials

Five colour schemes per category, distributed deterministically across that category's products. Brand string on every vessel: `QAREFULLY MATERIALS EXCHANGE`. Resolution is web-side only; contract `ProductPackaging` stays unpopulated by the API.

Custom Blend (16) is the one exception to per-category colour resolution: blends print a single fixed charcoal livery with a `CUSTOM BLEND` spec band, reusing the base lot's vessel shape. Deliberate — composition must not be readable from the packaging, so no ingredient, percentage, or mixing group may reach a colour.

Raster pipeline below remains the target shape if stored renditions are ever introduced; it is not currently built:

- image-set IDs, one per canonical product
- thumbnail, card, and detail WebP renditions generated locally
- product variants may share the parent vessel art when appearance does not change
- no source photos, remote CDN, or private asset inputs

Stored asset format:

- thumbnail: WebP, 320px
- card: WebP, 720px
- detail: WebP, 1200px
- immutable hashed filenames and a checked-in manifest

Every vessel carries a readable product label, category colour band, batch code, and controlled pigment variation. UI badges and layout remain separate from product art.

Data relation:

`product -> category + facts -> packaging spec -> vessel component + palette`

Unresolvable spec -> deterministic local SVG fallback; never a broken layout or network request.

Asset budget:

- built-in product assets stay within repository asset checks
- card and detail use role-specific local renditions

Avoid:

- external or private source-photo setup
- catalog products with no resolvable packaging spec
- committed PNG or large JPEG originals
- Git LFS in default student flow
- remote CDN dependency for required product rendering
- unstable third-party image URLs

Fallback behavior:

- missing image -> deterministic local SVG
- offline use -> complete visual journey remains available
- no broken layout or network request

## Delivery Principles

- each expansion adds working customer value or named QA scenario
- keep main journey obvious without documentation
- prefer domain correctness over architecture theater
- preserve one-command startup
- keep fake integrations local and controllable
- seed edge cases intentionally and document credentials or triggers in human README
- validate clean setup before release
