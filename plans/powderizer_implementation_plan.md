# Powderizer Implementation Plan

Status: Phases 0-9 complete; Phase 10 pending

Audience: implementation agent

Source scope: deferred Phases 7-8 from `plans/powder_shop_rebrand_implementation_plan.md`

## Outcome

Add custom consumable powder mixes without changing standard product purchase behavior.

Target flow:

`/powderizer -> quote -> cart -> checkout revalidation -> payment -> order confirmation`

Delivery split:

- Domain delivery: Phases 0-6
- UI delivery: Phases 7-9
- Final verification: Phase 10

## Constraints

- Preserve React, Vite, Fastify, SQLite, TypeBox, npm workspaces.
- Preserve standard catalog, cart, promo, auth, payment, order, favourite, mailbox behavior.
- Preserve integer-cent money handling.
- Preserve `SAVE10`: minimum 5 cart item quantities. Custom mix bag quantity counts.
- Preserve anonymous cart flow.
- Preserve payment idempotency and resumable finalization.
- Preserve deterministic reset, seed, tests.
- No Docker, account, API key, runtime network.
- No user-created ingredients, generated mix images, medical claims, subscriptions.
- No household, outdoor, questionable, impossible products in mixes.
- No broad commerce rewrite.
- Never trust client price, allocation, eligibility, or stock result.
- Use loopback HTTP for browser QA. Never use `file://`.
- Preserve unrelated worktree changes. Known pre-plan change: deleted `.github/workflows/verify.yml`.

## Locked V1 Decisions

### Eligibility

- Canonical source: `@shop/catalog`.
- Add `mixable: boolean` and `mixUnitGrams: number | null` to catalog model.
- Mixable set: all 19 products in `Pantry Staples`, `Performance`, `Drinks`.
- Non-mixable set: `Household`, `Outdoors`, `Questionable`, `Impossible`.
- Validation: mixable product requires positive integer `mixUnitGrams`, null consumption warning.
- Seed persistence: `products.mixable`, `products.mix_unit_grams`.
- API mapper exposes both fields.
- Runtime eligibility: persisted `mixable = 1`, positive `mix_unit_grams`, existing product row.

### Configuration

- Components: 2-5.
- Product IDs: unique.
- Percentage: positive integer per component.
- Percentage total: exactly 100.
- Bag sizes: `250`, `500`, `1000` grams.
- Fineness: `coarse`, `standard`, `fine`.
- Label: optional; trim, NFC-normalize, maximum 40 grapheme clusters.
- Label rejection: `<`, `>`, `&`, Unicode `Cc`, Unicode `Cf`.
- Empty trimmed label -> `null`.
- Duplicate components -> reject. Never silently merge.
- Canonical component order: numeric product ID ascending.

### Allocation

- Input: canonical component order, bag size, integer percentages.
- Base grams: `floor(bagSizeGrams * percentage / 100)`.
- Remainder: assign 1g by descending discarded fractional remainder; tie-break by numeric product ID.
- Persist server allocation. Ignore client allocation.
- Invariant: allocated grams positive; sum equals bag size.

### Pricing

- Price version: `powderizer-v1`.
- Ingredient charge per component: `ceil(product.price_cents * allocatedGrams / mix_unit_grams)`.
- Packaging fee: 250g -> 250 cents; 500g -> 400 cents; 1000g -> 600 cents.
- Fineness surcharge: 0 cents in V1.
- Unit price: component charges + packaging fee.
- Line total: unit price * quantity.
- Quote response includes version, normalized config, allocations, unit price.
- Cart create/edit/requote recalculates price from current database values.
- Checkout recalculates price. Mismatch -> structured `MIX_REQUOTE_REQUIRED`; no gateway call.

### Stock

- Existing `stock_count` remains retail bag-equivalent inventory.
- Mix requirement per component: `ceil(allocatedGrams * mixQuantity / mix_unit_grams)` bag equivalents.
- Aggregate same product across all cart mixes before stock check.
- Standard product stock behavior remains unchanged.
- Checkout preparation reserves mix bag equivalents by payment idempotency key.
- Decline, timeout, pre-gateway failure -> release mix stock reservation.
- Authorized finalization -> decrement `products.stock_count` once, delete reservation in same unit of work.
- Same-key retry -> reuse reservation or completed order. Never double-decrement.

### Persistence

- Additive tables. Do not rebuild `cart_line_items` or `order_line_items`.
- `powder_mixes`: cart-scoped custom line; includes quantity, config, quote version, quoted unit price.
- `powder_mix_components`: normalized component percentages and allocated grams.
- `order_powder_mix_items`: versioned immutable JSON snapshot per ordered mix.
- `powder_mix_stock_reservations`: aggregate product bag-equivalent reservation per payment attempt.
- Cart deletion cascades active mix configuration.
- Order snapshot survives cart deletion and catalog changes.

### Transport Shape

- Preserve `Cart.items` for standard product lines.
- Add `Cart.mixItems` for custom lines.
- Preserve `Order.items` for standard order lines.
- Add `Order.mixItems` for custom order snapshots.
- `subtotalCents`, `totalItems`, promos include both arrays.
- Checkout quote version 2 contains `lines` plus `mixLines`.
- Persisted quote parser accepts legacy version 1 and new version 2.
- New checkout writes version 2 only.
- Order mix snapshot version: `1`; parser rejects unknown versions.

### Routes

- `GET /api/powderizer/config` -> eligible products, bag sizes, fineness values, label limit, price version.
- `POST /api/powderizer/quote` -> validated normalized quote. No persistence.
- `POST /api/cart/:cartId/mixes` -> create mix line, return cart.
- `PATCH /api/cart/:cartId/mixes/:mixId` -> replace config, requote, return cart.
- `PATCH /api/cart/:cartId/mixes/:mixId/quantity` -> update quantity; zero removes line.
- `POST /api/cart/:cartId/mixes/:mixId/requote` -> accept current server quote, return cart.
- `DELETE /api/cart/:cartId/mixes/:mixId` -> remove line, return cart.
- UI edit URL: `/powderizer?edit={mixId}`.

## Error Contract

Create `packages/contracts/src/powderizer.ts`.

Stable codes:

- `MIX_COMPONENT_COUNT`
- `MIX_DUPLICATE_COMPONENT`
- `MIX_COMPONENT_INELIGIBLE`
- `MIX_PERCENTAGE_INVALID`
- `MIX_PERCENTAGE_TOTAL`
- `MIX_BAG_SIZE_INVALID`
- `MIX_FINENESS_INVALID`
- `MIX_LABEL_INVALID`
- `MIX_NOT_FOUND`
- `MIX_REQUOTE_REQUIRED`
- `MIX_STOCK_UNAVAILABLE`

Response requirements:

- Validation failure: HTTP 400, `{ code, error, field? }`.
- Missing cart or mix: HTTP 404.
- Reserved cart: HTTP 409, existing cart-reserved message.
- Requote required: HTTP 409, code plus affected mix IDs and old/new unit prices.
- Stock unavailable: HTTP 409, code plus affected mix and product IDs. No raw SQL or internal detail.

## Phase 0 - Baseline Audit [Complete]

Goal: record safe start.

Tasks:

- Read `README.md`, `CLAUDE.md` when present, active plans.
- Run `git status --short`, `git diff --stat`, `git diff` for overlapping files.
- Preserve unrelated `.github/workflows/verify.yml` deletion unless user changes scope.
- Run baseline:
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run lint`
  - `npm run format`
- Record existing failures. Do not fix unrelated failures.
- Inspect current home, cart, checkout, confirmation through loopback server.
- Confirm migration versions end at `007`.
- Confirm no existing Powderizer code or schema.

Gate:

- Baseline results recorded.
- Dirty files identified.
- No implementation edits made.

Audit record (2026-07-14):

- Baseline passes: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run lint`, `npm run format`.
- Existing non-failing notices: React Router v7 future-flag warnings; authored-size report flags `apps/api/test/checkout/payment.integration.test.ts` at 347 logical lines, unclassified.
- Initial worktree: deleted `.github/workflows/verify.yml` (unrelated; preserved); untracked this plan.
- Migrations: `001` through `007`; no Powderizer code or schema residue.
- Loopback audit used active `127.0.0.1:5173` server: `/`, `/cart`, `/checkout`, `/order-confirmation/1` return 200 and Vite app shell. No server started or stopped by this phase.

## Phase 1 - Catalog Metadata and Contracts [Complete]

Goal: establish shared compile-time model before persistence.

Files:

- `packages/catalog/src/model.ts`
- `packages/catalog/src/categories/*.ts`
- `packages/catalog/src/validateCatalog.ts`
- `packages/catalog/src/catalog.test.ts`
- `packages/contracts/src/powderizer.ts`
- `packages/contracts/src/products.ts`
- `packages/contracts/src/cart.ts`
- `packages/contracts/src/orders.ts`
- `packages/contracts/src/payments.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/test/transport-contracts.test.ts`

Tasks:

- Add catalog eligibility fields using locked rules.
- Add catalog validation: exactly 19 mixable products; positive source grams; forbidden categories never mixable.
- Add TypeBox schemas and static types:
  - `PowderMixComponentInput`
  - `PowderMixConfigInput`
  - `PowderMixQuote`
  - `PowderMixCartItem`
  - `PowderMixOrderItem`
  - `PowderizerConfigResponse`
  - mutation bodies and params
  - structured error responses
- Add `Product.mixable`, optional `Product.mixUnitGrams`.
- Add required `mixItems` arrays to cart and order contracts.
- Keep standard line shapes unchanged.
- Add payment conflict schema for requote and stock failures.
- Export new contracts through package index and subpath exports when package config requires them.

Tests:

- Catalog eligibility count and category safety.
- Contract accepts valid 2-component request.
- Contract rejects component count, decimals, invalid enums, overlong transport strings.
- Cart and order payloads accept empty and populated `mixItems`.

Gate:

- Contract and catalog tests pass.
- No API or UI integration yet.

## Phase 2 - Migration, Seed, Reset [Complete]

Goal: add durable additive schema.

Files:

- `apps/api/src/db/migrations/008_powderizer.ts`
- `apps/api/src/db/migrations/index.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/db/reset.ts`
- `apps/api/test/db/migrations.integration.test.ts`
- `apps/api/test/db/seed.integration.test.ts`

Migration schema:

- `products`
  - `mixable INTEGER NOT NULL DEFAULT 0 CHECK (mixable IN (0, 1))`
  - `mix_unit_grams INTEGER CHECK (mix_unit_grams IS NULL OR mix_unit_grams > 0)`
- `powder_mixes`
  - `id TEXT PRIMARY KEY`
  - `cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE`
  - `quantity INTEGER NOT NULL CHECK (quantity > 0)`
  - `bag_size_grams INTEGER NOT NULL CHECK (bag_size_grams IN (250, 500, 1000))`
  - `fineness TEXT NOT NULL CHECK (fineness IN ('coarse', 'standard', 'fine'))`
  - `custom_label TEXT`
  - `price_version TEXT NOT NULL`
  - `quoted_unit_price_cents INTEGER NOT NULL CHECK (quoted_unit_price_cents >= 0)`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
- `powder_mix_components`
  - `mix_id TEXT NOT NULL REFERENCES powder_mixes(id) ON DELETE CASCADE`
  - `product_id INTEGER NOT NULL REFERENCES products(id)`
  - `percentage INTEGER NOT NULL CHECK (percentage > 0 AND percentage <= 100)`
  - `allocated_grams INTEGER NOT NULL CHECK (allocated_grams > 0)`
  - `PRIMARY KEY (mix_id, product_id)`
- `order_powder_mix_items`
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE`
  - `snapshot_json TEXT NOT NULL`
- `powder_mix_stock_reservations`
  - `payment_idempotency_key TEXT NOT NULL REFERENCES payments(idempotency_key) ON DELETE CASCADE`
  - `product_id INTEGER NOT NULL REFERENCES products(id)`
  - `bag_equivalents INTEGER NOT NULL CHECK (bag_equivalents > 0)`
  - `PRIMARY KEY (payment_idempotency_key, product_id)`

Indexes:

- `powder_mixes_cart_idx(cart_id)`
- `powder_mix_components_mix_idx(mix_id)`
- `order_powder_mix_items_order_idx(order_id)`
- `powder_mix_stock_reservations_product_idx(product_id)`

Tasks:

- Register migration `008`; update expected version assertions.
- Migration remains idempotent through migration runner.
- Upgrade legacy schema without data loss.
- Seed canonical eligibility metadata in existing product upsert.
- Preserve non-canonical product rows; default non-mixable.
- Reset deletion order: stock reservations -> mix components -> powder mixes -> order mix items -> existing dependent tables.
- Confirm reset then seed yields 45 products, 19 mixable, zero mixes/reservations/order mix snapshots.

Gate:

- Fresh and legacy migration tests pass.
- Repeated seed stable.
- Reset foreign-key safe.

## Phase 3 - Pure Rules and Pricing [Complete]

Goal: isolate deterministic server rules.

Files:

- `apps/api/src/features/powderizer/powderMixRules.ts`
- `apps/api/src/features/powderizer/powderMixRules.test.ts`
- `apps/api/src/features/powderizer/powderizerTypes.ts`

Tasks:

- Implement label normalization with `Intl.Segmenter` grapheme counting.
- Implement component validation and canonical ordering.
- Implement gram allocation.
- Implement versioned pricing constants and calculator.
- Implement bag-equivalent stock requirement aggregation.
- Return typed domain errors; no HTTP knowledge.
- Use integer arithmetic only for final cents and grams.
- Reject unknown price version during persisted-data parsing.

Tests:

- Valid 50/50, 3-component, 5-component mixes.
- 99%, 101%, zero, negative, decimal percentages.
- Duplicate IDs.
- 1 and 6 components.
- Invalid product eligibility.
- 250g fractional allocation and stable remainder.
- Exact 500g and 1000g allocations.
- Exact `powderizer-v1` prices for fixed fixtures.
- Label 40/41 graphemes, emoji graphemes, HTML characters, control characters, empty normalization.
- Quantity-aware stock aggregation across multiple mixes.

Gate:

- Pure tests cover every error code and pricing branch.
- No database or Fastify dependency in rules file.

## Phase 4 - Repository and Powderizer Service [Complete]

Goal: persist validated mixes and expose quotes.

Files:

- `apps/api/src/features/powderizer/powderMixRepository.ts`
- `apps/api/src/features/powderizer/powderizerService.ts`
- `apps/api/src/features/catalog/productRepository.ts`
- `apps/api/src/mappers/product.ts`
- `apps/api/src/routes/powderizer.ts`
- `apps/api/src/app.ts`
- `apps/api/test/powderizer/powderizer.integration.test.ts`

Tasks:

- Extend `ProductRow` and mapper with eligibility fields.
- Add repository queries for eligible products and requested component rows.
- Require returned component row count equals unique requested ID count.
- Implement config response from server constants plus current eligible products.
- Implement stateless quote endpoint.
- Implement create/edit transaction:
  - validate cart exists and not reserved
  - load current products
  - normalize and price
  - insert/update mix
  - replace component rows atomically
  - touch cart
- Implement requote transaction using saved config.
- Implement quantity mutation and removal.
- Never accept client unit price, price version, allocations, product names.
- Map domain errors to stable HTTP contract.
- Register route and service through `app.ts`.

Tests:

- Config returns 19 eligible products and locked rules.
- Quote returns normalized allocation and exact price.
- Quote has no database writes.
- Create, edit, requote, quantity, remove.
- Anonymous cart support.
- Missing/reserved cart.
- Ineligible/missing/duplicate product.
- Database price change reflected in new quote.
- Failed edit leaves original mix unchanged.

Gate:

- Quote and mix persistence integration tests pass.
- Invalid mix never persists.

## Phase 5 - Cart Read Model and Promo Integration [Complete]

Goal: make mixes first-class cart totals without changing standard lines.

Files:

- `apps/api/src/features/cart/cartService.ts`
- `apps/api/src/routes/cart.ts`
- `apps/api/src/features/promos/promoService.ts`
- `apps/api/src/app.ts`
- `apps/api/test/cart/cart.integration.test.ts`
- `apps/api/src/features/promos/promoService.test.ts`

Tasks:

- Inject mix repository into cart read service.
- Map persisted mix plus components to `Cart.mixItems`.
- Compute subtotal from standard line totals + mix line totals.
- Compute total items from standard quantities + mix quantities.
- Add mix mutation routes under cart route family.
- Preserve existing product mutation routes and payloads.
- Update promo validation dependency so cart totals include mixes.
- Maintain deterministic mix item order: creation timestamp, then mix ID.
- Reject every mix mutation while cart reserved.

Tests:

- Product-only cart response unchanged except additive `mixItems: []`.
- Mixed cart totals exact.
- Mix-only cart non-empty.
- `SAVE10` counts custom bag quantity.
- Five component ingredients do not count as five cart items.
- Product and mix mutations coexist.

Gate:

- Existing cart/promo tests pass after additive assertions.
- Mixed cart contract validated at HTTP boundary.

## Phase 6 - Checkout, Stock, Orders, Idempotency [Complete]

Goal: revalidate every custom line and snapshot successful order exactly once.

Files:

- `apps/api/src/features/checkout/checkoutTypes.ts`
- `apps/api/src/features/checkout/checkoutQuote.ts`
- `apps/api/src/features/checkout/checkoutService.ts`
- `apps/api/src/features/checkout/checkoutFinalizer.ts`
- `apps/api/src/features/checkout/orderRepository.ts`
- `apps/api/src/features/payments/paymentRepository.ts`
- `apps/api/src/routes/payments.ts`
- `apps/api/test/checkout/payment.integration.test.ts`
- `apps/api/test/checkout/paymentIntent.integration.test.ts`
- `apps/api/test/powderizer/powderizerCheckout.integration.test.ts`

Tasks:

- Add strict version 2 persisted quote parser and serializer.
- Retain strict legacy version 1 parser for existing payment rows.
- Snapshot mix data into quote:
  - mix ID
  - component IDs and names
  - percentages and allocated grams
  - bag size
  - fineness
  - normalized label
  - price version
  - unit price
  - quantity
  - line total
- During preparation, before gateway:
  - reload mix and products
  - rerun eligibility, allocation, price
  - return `MIX_REQUOTE_REQUIRED` for price/version mismatch
  - aggregate stock requirements
  - subtract active reservations from available stock
  - return `MIX_STOCK_UNAVAILABLE` when insufficient
  - reserve cart, promo, mix stock in same unit of work
- Extend preparation cleanup to release cart, promo, mix stock together.
- Provider decline/timeout releases all reservations.
- Finalization transaction:
  - load strict persisted quote
  - create standard order lines
  - insert immutable mix snapshots
  - decrement reserved product bag equivalents
  - remove mix stock reservation
  - commit promo
  - add mailbox receipt
  - remove cart
  - transition payment to succeeded
- `findById()` returns standard items plus parsed mix snapshots.
- Treat invalid snapshot JSON as repository corruption; never return partial order.
- Add mix summary to mailbox body without unsafe label interpolation semantics.
- Extend payment route conflict response.

Tests:

- Mixed order success.
- Mix-only order success.
- Price change after cart quote -> no gateway call, requote conflict.
- Product becomes non-mixable -> stock/eligibility conflict before gateway.
- Stock drops before checkout -> stock conflict.
- Two carts competing for same component stock.
- Decline and timeout release stock reservation.
- Authorized finalization retry uses same order and stock decrement once.
- Different request under same idempotency key conflicts.
- Legacy version 1 quote still finalizes/replays.
- Order remains readable after cart deletion, product rename, product price change.

Gate:

- Checkout tests prove no stale-price charge.
- Idempotency tests prove one order and one stock decrement.
- Standard product-only checkout tests unchanged.

## Phase 7 - Web API, State, Route Shell [Complete]

Goal: establish typed client and deterministic builder state.

Files:

- `apps/web/src/api/powderizer.ts`
- `apps/web/src/api/cart.ts`
- `apps/web/src/features/powderizer/powderizerState.ts`
- `apps/web/src/features/powderizer/powderizerState.test.ts`
- `apps/web/src/features/powderizer/PowderizerPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/components/nav/navItems.ts`

Tasks:

- Add config, quote, create, edit, requote, quantity, remove clients.
- Add `/powderizer` route and navigation entry.
- Builder reducer owns selected components, percentages, size, fineness, label, quote state, mutation state.
- Derive edit state from `?edit={mixId}` plus current cart `mixItems`.
- Missing edit target -> clear error with cart link. Never silently create.
- Equal split helper:
  - floor `100 / count`
  - distribute remainder by current component display order
- Client validation mirrors server for immediate messages only.
- Server response remains authority.
- Quote requests: 250ms debounce after valid config; abort or ignore stale responses.
- Config/quote loading, retry, empty, validation, server error states.
- Valid config change clears stale quote and checkout assumptions.

Tests:

- Reducer add/remove 2-5 components.
- Equal split for 2, 3, 5 components.
- Live totals 99, 100, 101.
- Stale quote response ignored.
- Edit hydration preserves persisted config.
- Missing edit target error.

Gate:

- Route loads from typed config endpoint.
- No cart mutation yet required from rendered form.

## Phase 8 - Builder UI and Bag Preview [Complete]

Goal: complete keyboard-accessible quote-to-cart builder.

Files:

- `apps/web/src/features/powderizer/PowderizerPage.tsx`
- `apps/web/src/features/powderizer/ComponentPicker.tsx`
- `apps/web/src/features/powderizer/RatioEditor.tsx`
- `apps/web/src/features/powderizer/MixOptions.tsx`
- `apps/web/src/features/powderizer/PowderMixBagPreview.tsx`
- `apps/web/src/features/powderizer/PowderizerSummary.tsx`
- focused tests beside components
- `apps/web/src/index.css` only when existing utility classes cannot express design

Flow:

`choose 2-5 -> set ratios -> choose size -> choose fineness -> label -> receive quote -> add/update cart`

Tasks:

- Show eligible products only; name, category, current source bag price.
- Explain exclusion: only consumable Pantry, Performance, Drinks powders mixable in V1.
- Use labelled numeric percentage inputs with `min=1`, `max=99`, `step=1`, `inputMode=numeric`.
- Live ratio total with text and color-independent validity cue.
- Add/remove controls retain focus predictably.
- Equal split button available after 2+ selections.
- Render bag size and fineness as fieldsets with legends.
- Label counter uses grapheme count; render as text only.
- Bag preview reuses existing label visual language; no generated image.
- Preview label: custom label or `Custom powder mix`.
- Preview quantity: selected grams; mark: `MIX`; batch: price version.
- Quote summary lists component grams and percentages, packaging fee, unit total.
- Disable add/update until current config owns successful matching quote.
- Create success -> navigate `/cart`.
- Edit success -> navigate `/cart`.
- Keep user inputs after quote or mutation failure.
- Keyboard-complete at narrow viewport.

Tests:

- Valid 2-component create flow.
- 99% and 101% block quote/cart action.
- Duplicate prevention.
- Component maximum.
- Label validation and counter.
- Quote loading and failure.
- Create and edit submission.
- Accessible names, groups, alerts, focus behavior.

Gate:

- User completes builder without mouse.
- Responsive layout works at 320px width and desktop.

## Phase 9 - Cart, Checkout, Confirmation UI [Complete]

Goal: display and manage custom lines through full purchase journey.

Files:

- `apps/web/src/hooks/useCart.ts`
- `apps/web/src/hooks/CartContext.tsx`
- `apps/web/src/features/cart/PowderMixCartLineItem.tsx`
- `apps/web/src/features/cart/CartPage.tsx`
- `apps/web/src/components/CartSheet.tsx`
- `apps/web/src/features/checkout/CheckoutSummary.tsx`
- `apps/web/src/features/checkout/checkoutState.ts`
- `apps/web/src/features/checkout/usePaymentSubmission.ts`
- `apps/web/src/features/checkout/OrderConfirmationPage.tsx`
- related tests

Tasks:

- Add mix mutation methods and pending keys by mix ID.
- Preserve product mutation methods and pending keys.
- Render mix name, components, ratios, size, fineness, quantity, price.
- Add Edit link to `/powderizer?edit={mixId}`.
- Add quantity and remove controls matching standard line behavior.
- Empty cart check uses `totalItems`, not `items.length`.
- Cart sheet and checkout summary render both line groups.
- Extend checkout quote key with sorted mix IDs, versions, quantities, line totals.
- Any cart/mix change invalidates applied promo and payment idempotency key.
- Handle `MIX_REQUOTE_REQUIRED`:
  - show old/new per-line price
  - offer explicit `Accept updated price`
  - call requote endpoint
  - refresh cart
  - clear promo quote
  - generate new payment idempotency key
  - require user resubmission
- Handle `MIX_STOCK_UNAVAILABLE` with edit/remove links.
- Never auto-submit payment after requote.
- Confirmation renders immutable mix snapshot, not current cart/catalog data.

Tests:

- Mixed cart rendering and totals.
- Mix-only cart proceeds to checkout.
- Quantity, remove, edit actions.
- Promo invalidation after requote.
- Requote acceptance requires second explicit payment submit.
- Stock conflict message.
- Confirmation snapshot rendering.
- Standard product-only UI regressions.

Gate:

- Full custom mix purchase flow completes.
- Standard product flow remains unchanged.

## Phase 10 - Verification and Handoff [Pending]

Goal: prove complete vertical slice and preserve baseline.

Status record (2026-07-14):

- Phases 7-9: implementation complete; independent review complete.
- Phase 10: full verification, browser QA, acceptance journeys, handoff pending.
- P2 test gaps:
  - Rendered mix-cart coverage: mix-only state, display, quantity, remove, edit.
  - `MIX_STOCK_UNAVAILABLE` UI render and edit/remove actions.
  - Confirmation proves snapshots source from `Order.mixItems`.
  - Requote acceptance clears promo and changes payment idempotency key.
- Current full-check blockers:
  - Legacy fixtures lack required `mixable` and `mixItems` fields; full typecheck blocked.
  - Root lint reports unrelated API errors.
  - Root format reports Phase 7/9 files; no clean full-format result.

Automated checks:

- `npm run reset`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run lint`
- `npm run format`
- `npm test`
- `npm run build --workspaces --if-present`
- `npm run smoke`

Focused residue checks:

- `rg -n "powderizer|powder_mix|mixable|mixItems|MIX_" apps packages plans`
- Confirm no client-authored price used in persistence or checkout.
- Confirm labels rendered through React text nodes only.
- Confirm no non-consumable product accepted through direct API call.
- Confirm reset removes every Powderizer row.

Browser QA:

- Start existing server with `npm run dev`; reuse existing safe server when present.
- Open through `http://127.0.0.1:5173`.
- Routes:
  - `/powderizer`
  - `/powderizer?edit={mixId}`
  - `/cart`
  - `/checkout`
  - `/order-confirmation/{orderId}`
  - `/mailbox`
- Viewports: 320px narrow, 1920x1080, 3840x2160.
- Verify keyboard-only flow, focus visibility, labels, live errors, loading, retries.
- Verify console has no uncaught errors.
- Stop only server started by implementation task.

Acceptance journeys:

- 50% Protein Powder + 50% Cocoa Powder, 500g, fine, custom label -> quote -> cart -> payment `4242 4242 4242 4242` -> confirmation -> mailbox.
- Mix quantity 5 -> `SAVE10` succeeds.
- Five ingredients in one bag -> `SAVE10` fails minimum-item rule.
- 99% and 101% -> rejected.
- Household product through direct API -> rejected.
- Catalog price changed after cart quote -> structured requote -> accept -> explicit resubmit -> success.
- Component stock changed after quote -> checkout blocked before gateway.
- Declined card and timeout -> cart editable after reservation release.
- Same payment key retry -> one order, one stock decrement.
- Edit saved mix -> same mix ID, new quote, updated cart.

Handoff report:

- Completed phases.
- Files changed by phase.
- Migration `008` schema and upgrade result.
- Locked pricing version and exact fixtures.
- Verification commands with pass/fail evidence.
- Browser routes, viewports, accessibility results.
- Known baseline failures kept separate.
- Unrelated worktree changes preserved.
- Any deferred work listed; no silent scope expansion.

## Completion Gate

Complete only when:

- Backend owns validation, allocation, price, eligibility, stock.
- Malformed or unsafe config never enters cart.
- Stale quote never reaches gateway.
- Mix order snapshot remains immutable and readable.
- Payment retry creates one order and decrements stock once.
- Custom mix journey works anonymously end to end.
- Standard catalog journey and existing checks retain behavior.
