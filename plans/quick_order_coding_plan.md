# Quick Order Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `Future Expansion Order` -> `14. Quick Order`
Repository baseline: branch `expansion_002` @ `ab36685`, inspected 2026-08-01

## Runtime Worktree

- source: current branch at runtime -> record branch and `HEAD` before any write
- named branch required: detached `HEAD` -> stop and ask user to select a branch
- input gate: relevant uncommitted or untracked source-checkout changes absent from branch `HEAD` -> stop and ask user to commit them or choose a baseline. Never copy, stash, discard, or import them without explicit approval
- create: dedicated implementation branch + worktree from recorded `HEAD` before first implementation write -> `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree; source checkout stays read-only after worktree creation
- integration: no merge, rebase, cherry-pick, copy-back, branch deletion, or worktree cleanup; user handles merge into the source branch
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state that the worktree remains intact and the user handles merge

## Objective

Trade buyer pastes or types `SKU, qty` lines at `/quick-order` -> server parses, resolves each SKU to a live variant, raises sub-MOQ quantities to the variant MOQ floor, submits one demand per distinct SKU through `CartService.addMany`, returns one outcome per input line plus the authoritative cart.

Complete when: a mixed paste (valid, unknown SKU, retired lot, malformed quantity, duplicate SKU, sub-MOQ) returns a per-line report, the cart holds exactly the added lines, and every named automated check passes.

## Scope

### In

- `POST /api/cart/:cartId/quick-order` -> parse -> resolve -> MOQ round-up -> `CartService.addMany` -> per-input-line outcomes
- first SKU -> variant resolution path in repository layer (`findVariantsBySkus`)
- feature-side MOQ round-up with per-line disclosure (`requestedQuantity`, `submittedQuantity`, `moqAdjusted`)
- feature-side aggregation of duplicate SKUs into one demand, judged once, fanned back to every contributing input line
- `packages/contracts/src/quickOrder.ts` transport module + `./quick-order` subpath
- `/quick-order` page, cart-page entry point, web API client, cart-hook mutation
- `cart.quick_order_added` audit event
- README sample paste + high-level plan item 14 record

### Out

- no schema change, no migration; head stays `028`
- no new nav entry (`CategoryNav.tsx`, `navItems.ts`, `.custom-blend-nav-link` untouched)
- no CSV/file upload, no clipboard API, no paste preview/dry-run endpoint
- no Custom Blend lines through Quick Order (blends need a configurator, not a SKU)
- no product-name or fuzzy SKU search, no substitution offer for a retired lot
- no new seed rows; demo uses existing seeded catalog state
- no changes to `CartService.addMany` or `cartBulkAddRules.ts`
- no Saved Lists (item 13) work

## Repository Findings

- existing: `apps/api/src/features/cart/cartService.ts:62` -> `addMany(cartId, requests, context): BulkAddResult | BulkAddRejection`; `apps/api/src/features/cart/cartService.ts:614` -> `addManyItems` aggregates by `(variantId, configKey)`, adds full quantity or nothing, returns one outcome per submitted request in submission order
- existing: `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BulkAddRequest{key,variantId,quantity,customBlend?}`, `BULK_ADD_SKIP_REASONS` fixed precedence `VARIANT_RETIRED -> BLEND_UNAVAILABLE -> INVALID_QUANTITY -> INSUFFICIENT_STOCK -> BELOW_MOQ`, `BulkAddOutcome.resolvedUnitPriceCents` carries clearance-then-tier price at post-add cumulative quantity
- existing: `apps/api/src/features/reorder/` -> `reorderRules.ts` (pure, clock-free, pre-skip reasons + outcome assembly), `reorderService.ts` (`unitOfWork.run`, narrow reader port, feature-level audit append), `reorderErrors.ts` (`ReorderResult<T>` + `reorderOk`/`reorderError`), `routes/reorder.ts` (code-bearing error body, status map, domain -> transport mapper). Whole shape is the template for Quick Order
- existing: `apps/api/src/features/pricing/pricingRules.ts:158` -> `moqShortfallSacks(quantity, weightGrams, moqSacks): number`, already exported and unit-tested. MOQ round-up is `quantity + moqShortfallSacks(...)`; no new pricing helper and no promotion of the two private `minimumMoqQuantity` copies is needed
- existing: `apps/api/src/features/catalog/productRepository.ts:74` -> `ProductRepository` with `findVariantsByIds(variantIds)`; `VariantRow` carries `sku`, `weight_grams`, `moq_sacks`, `active`, clearance columns. `ProductRow.name` is the product name
- gap: no production read path resolves a variant by SKU string. Only `apps/api/src/db/seed.ts:482` prepares `SELECT id, product_id FROM product_variants WHERE sku = ?`, unexported and seed-only. Admin surface writes `sku` but never queries it
- constraint: `product_variants.sku` is `TEXT NOT NULL UNIQUE` (`apps/api/src/db/migrations/028_retired_variant_sort_order.ts`), globally unique, no `COLLATE NOCASE`. The `UNIQUE` constraint gives an implicit index, so `WHERE sku IN (...)` is index-backed -> no migration and no new index
- constraint: canonical SKU format `^[A-Z]{3}-\d{4}-\d{3}$` enforced at `packages/catalog/src/validateCatalog.ts:199`; seeded SKUs are uppercase. Admin-created SKUs are validated only as non-empty strings
- constraint: cart routes (`apps/api/src/routes/cart.ts:33`) carry no auth gate; `POST /api/cart` is unauthenticated and `auditContext(request)` emits an `anonymous` actor when no session exists. Reorder's `requireCustomer` gate exists only because reorder reads an owned order
- constraint: `AUDIT_ACTIONS` in `apps/api/src/features/audit/auditEvent.ts` is a const tuple; `UserEventAction` excludes `` `cart.${string}` `` from the generic fallback, so a new `cart.*` action needs its own `AuditEventInput` member and its own `switch` case or exhaustiveness fails. Metadata values must be `string | number` scalars under `MAX_METADATA_BYTES = 2_048`
- constraint: `@shop/api` imports `@shop/contracts` from `dist/` -> `npm run build -w @shop/contracts` must run before API typecheck sees a new subpath
- constraint: `npm run verify` -> `npm test` -> `@shop/web` `test` script is `test:unit` only. Web integration tests run only through `npm run test:integration -w @shop/web` and are invisible to `verify`
- reuse: `apps/web/src/features/reorder/reorderPresentation.ts` -> `Readonly<Record<Reason, string>>` copy table keyed on the contract union (a new reason breaks typecheck until copy exists); `SKIP_REASONS` derived via `Object.keys` so a test can walk every reason; copy asserted free of `/MOQ|SKU|variant|_/i`
- reuse: `apps/web/src/features/reorder/ReorderOutcomeList.tsx` -> `role="status" aria-live="polite" aria-label="..."` region stays mounted with `empty:hidden`; result lists carry their own `aria-label`; an all-skipped result is not `role="alert"`
- reuse: `apps/web/src/hooks/useCart.ts` -> `CartAction` union, `runCartMutation(action, pendingKey, operation, selectCart, retryAfterRecovery)`, `ERROR_MESSAGE_BY_CODE`; mutations return the authoritative `Cart` and never refetch. `apps/web/src/api/client.ts` -> `apiFetch(schema, path, options)`, `ApiError.response.code`, `isMissingCartError` matching status 404 + message exactly `Cart not found`
- reuse: `apps/web/src/App.tsx` is the single route registry; `/cart` -> `CartPage` is public, so `/quick-order` needs no `ProtectedRoute`

## Decisions and Invariants

- Quick Order is cart-scoped and unauthenticated, matching every other cart mutation. Guest and signed-in buyers both use it; audit actor is `anonymous` or `user` per session
- transport carries raw pasted `text`; the server owns splitting, delimiter handling, normalisation, and quantity validation. Rule lives once, on the authority side
- SKU normalisation is `trim()` then `toUpperCase()`, then exact binary match. No `COLLATE NOCASE` query, so no ambiguity between two SKUs differing only in case
- a SKU that resolves to a retired variant is submitted to the cart and comes back `VARIANT_RETIRED`, not `SKU_NOT_FOUND`. `findVariantsBySkus` must not filter `active = 1`. Buyer learns "we no longer sell this", not "unknown code"
- MOQ round-up is feature-side and applied to the aggregated per-SKU demand, never per input line: `submittedQuantity = requestedQuantity + moqShortfallSacks(requestedQuantity, weightGrams, moqSacks)`. Two `SKU, 2` lines at MOQ 4 become one 4-sack demand with no adjustment, not 8 sacks
- round-up never lowers a quantity and never applies to a retired variant or to a variant whose `weight_grams`/`moq_sacks` are unusable. In the unusable case no adjustment is disclosed and the cart classifies the line
- rejected: rounding against the quantity already on the cart line. Quick Order reads no cart state; the disclosed adjustment must not depend on invisible cart contents. Consequence: a paste line can land above the MOQ floor when the cart already holds that lot — never below, never a `BELOW_MOQ` skip
- Quick Order aggregates by SKU before submitting, so the cart receives one request per distinct SKU. Cart-side aggregation still holds and stays untouched
- skip vocabulary extends the shared enum rather than forking it: `QuickOrderSkipReason = QuickOrderPreSkipReason | BulkAddSkipReason`. `BLEND_UNAVAILABLE` is structurally present and never produced (Quick Order submits no configured lines); `BELOW_MOQ` is produced only on the unusable-MOQ-data path. Both facts belong in TSDoc
- partial success is the normal result and is never an error. Whole-request rejections only: `NO_INPUT_LINES` 400, `TOO_MANY_LINES` 400, `CART_NOT_FOUND` 404, `CART_RESERVED` 409
- `CART_NOT_FOUND` prose is exactly `Cart not found`, so `isMissingCartError` in `apps/web/src/api/client.ts` recovers a replacement cart and replays
- one unit of work per request; `unitOfWork.run` wraps resolution, bulk add, and the feature audit append. Skipped lines never roll back applied lines
- money stays server-resolved: outcomes disclose `resolvedUnitPriceCents` from the cart's clearance-then-tier composition. The web never derives a price
- assumption (validate at `G0`): the seeded catalog still contains `GDN-1043-001` with an active clearance window, `SPN-1007-001` at stock 15, `BKP-0001-001` at stock 85, and at least one variant retired by migration `020`. `P5` and `S1` must confirm actual seeded values before pinning them into fixtures
- assumption (validate at `G0`): the `@shop/web` integration suite has a pre-existing admin-test failure on this branch. Baseline it at `G0` so the final gate can tell a new failure from a known-red one

## Target Design

### Contracts

`packages/contracts/src/quickOrder.ts` (proposed), mirroring `reorder.ts` idiom (`export const X = Type...` + `export type X = Static<typeof X>`):

- `QuickOrderRequestBody` -> `{ text: string }`, `minLength 1`, `maxLength 20_000`, `additionalProperties: false`
- `QuickOrderSkipReason` -> union of `MALFORMED_LINE`, `SKU_NOT_FOUND`, `INVALID_QUANTITY`, `VARIANT_RETIRED`, `INSUFFICIENT_STOCK`, `BELOW_MOQ`, `BLEND_UNAVAILABLE`
- `QuickOrderLineStatus` -> `added | skipped`
- `QuickOrderLineOutcome` -> `lineNumber` (>=1), `rawLine` (<=200), `sku` (string|null), `requestedQuantity` (int|null), `submittedQuantity` (int|null), `moqAdjusted` (bool), `duplicateSku` (bool), `variantId` (int|null), `productId` (string|null), `productName` (string|null), `resolvedUnitPriceCents` (`MoneyCents`|null), `status`, `reason` (`QuickOrderSkipReason`|null)
- status/reason pairing enforced by a `TypeSystem.Type<unknown>('QuickOrderOutcomeStatusPair', ...)` intersected onto the field object, exactly as `ReorderOutcomeStatusPair` does
- `QuickOrderResponse` -> `{ cart: Cart, addedLineCount, skippedLineCount, outcomes }`
- export via `export * from './quickOrder.js'` in `packages/contracts/src/index.ts` and a `"./quick-order"` entry in `packages/contracts/package.json` exports map (camelCase file -> kebab-case subpath)

### Persistence

`apps/api/src/features/catalog/productRepository.ts`:

- proposed `export interface VariantWithProductRow extends VariantRow { product_name: string }`
- proposed `findVariantsBySkus(skus: readonly string[]): VariantWithProductRow[]` -> empty input returns `[]`; otherwise `SELECT v.*, p.name AS product_name FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.sku IN (<placeholders>)`
- no `active` filter, no `ORDER BY` requirement beyond determinism (`ORDER BY v.id ASC`)

### Domain rules

`apps/api/src/features/quickOrder/quickOrderRules.ts` (proposed). Pure: no SQL, no clock, no wall time.

- `QUICK_ORDER_MAX_INPUT_LINES = 200`; `QUICK_ORDER_MAX_RAW_LINE_LENGTH = 200`
- `QUICK_ORDER_PRE_SKIP_REASONS = ['MALFORMED_LINE', 'SKU_NOT_FOUND', 'INVALID_QUANTITY'] as const`
- `parseQuickOrderText(text): ParsedQuickOrderLine[]` -> normalise `\r\n` and `\r` to `\n`, split, keep physical 1-based `lineNumber`, drop whitespace-only lines entirely (never reported). Per line: split on `[,;\t]` when present, else on `\s+`; exactly two non-empty tokens required or `MALFORMED_LINE`; SKU token trimmed + uppercased, non-empty and <=64 chars or `MALFORMED_LINE`; quantity token must match `^\d+$` and parse to a positive safe integer or `INVALID_QUANTITY`
- `buildQuickOrderDemand(lines, variantBySku)` -> groups parsed lines by normalised SKU in first-appearance order; unresolved SKU -> `SKU_NOT_FOUND` pre-skip for every contributing line; sums member quantities with a safe-integer guard (`INVALID_QUANTITY` on overflow); applies round-up through `moqShortfallSacks` when the variant is active and its `weight_grams`/`moq_sacks` are positive safe integers, otherwise leaves the quantity untouched with `moqAdjusted = false`
- `toQuickOrderBulkAddRequests(groups): BulkAddRequest[]` -> one request per group, `key = sku`, `quantity = submittedQuantity`, never a `customBlend`
- `assembleQuickOrderOutcomes(lines, groups, bulkOutcomes, variantBySku)` -> one outcome per reported input line in source order; a group verdict fans out to every member line; `duplicateSku = group.lineNumbers.length > 1`; a submitted group with no cart outcome throws (invariant breach, mirroring `reorderRules.ts:153`)
- `countQuickOrderOutcomes(outcomes)` -> `{ addedLineCount, skippedLineCount }` over input lines

`apps/api/src/features/quickOrder/quickOrderErrors.ts` (proposed) -> `QuickOrderErrorCode = 'NO_INPUT_LINES' | 'TOO_MANY_LINES' | 'CART_NOT_FOUND' | 'CART_RESERVED'`, `QuickOrderResult<T>`, `quickOrderOk`, `quickOrderError`

### Service

`apps/api/src/features/quickOrder/quickOrderService.ts` (proposed):

- narrow port `QuickOrderVariantReader { findVariantsBySkus(skus: readonly string[]): VariantWithProductRow[] }`
- dependencies `{ carts: Pick<CartService,'addMany'>, variants: QuickOrderVariantReader, unitOfWork, audit }`. No clock: pricing and availability are the cart's job
- `quickOrder({ cartId, text, context })` -> `unitOfWork.run(...)` -> parse -> reject `NO_INPUT_LINES` / `TOO_MANY_LINES` -> resolve distinct SKUs in one `findVariantsBySkus` call -> build demand -> `carts.addMany` -> map `CART_NOT_FOUND` / `CART_RESERVED` -> assemble outcomes -> append audit -> return report
- audit append inside the transaction: `{ action: 'cart.quick_order_added', cartId, lineCount, addedLineCount, skippedLineCount, context }`. Raw SKUs never enter metadata

### Audit

`apps/api/src/features/audit/auditEvent.ts`: add `'cart.quick_order_added'` to `AUDIT_ACTIONS` next to `'cart.reorder_added'`; add the matching `AuditEventInput` member; add the `switch` case using `cartEntity(input)` and `requireNonNegativeSafeInteger` guards on the three counts. No contract change, no migration — `packages/contracts/src/audit.ts` types `action` as a plain bounded string

### Route

`apps/api/src/routes/quickOrder.ts` (proposed), default-export plugin:

- `POST /api/cart/:cartId/quick-order`, `params: CartIdParam` from `@shop/contracts/cart`, `body: QuickOrderRequestBody`
- no `preHandler`; local `auditContext(request)` copied from `routes/cart.ts:21` shape (anonymous fallback)
- `QuickOrderErrorResponse` object with a `code` literal union + `error` string, declared beside `ErrorResponse` in the response union exactly as `routes/reorder.ts:24` does
- message map: `NO_INPUT_LINES` -> `Enter at least one line`, `TOO_MANY_LINES` -> `Too many lines in one submission`, `CART_NOT_FOUND` -> `Cart not found`, `CART_RESERVED` -> `Cart is reserved for checkout`
- status map: `NO_INPUT_LINES` 400, `TOO_MANY_LINES` 400, `CART_NOT_FOUND` 404, `CART_RESERVED` 409
- domain outcome -> transport outcome mapper; domain shape never reaches the wire unmapped

`apps/api/src/app.ts` edits: route import, service import + type, `AppServices.quickOrder` field, construction in the returned literal reusing the hoisted `cartService`, `products`, `unitOfWork`, `audit`, and `await app.register(quickOrderRoutes, context)`

### Web

- `apps/web/src/api/quickOrder.ts` (proposed) -> `submitQuickOrder(cartId, text): Promise<QuickOrderResponse>` via `apiFetch(QuickOrderResponse, ...)`, `encodeURIComponent` on `cartId`
- `apps/web/src/hooks/useCart.ts` -> extend `CartAction` with `'quick-order'`; add `quickOrder(text)` through `runCartMutation('quick-order', QUICK_ORDER_PENDING_KEY, (cartId) => submitQuickOrder(cartId, text), (response) => response.cart, true)`; add `NO_INPUT_LINES` / `TOO_MANY_LINES` copy to `ERROR_MESSAGE_BY_CODE`
- `apps/web/src/features/quickOrder/quickOrderPresentation.ts` (proposed) -> `QuickOrderState` union (`idle | pending | error | result`), `SKIP_REASON_MESSAGE` record keyed on `QuickOrderSkipReason`, derived `SKIP_REASONS`, `QUICK_ORDER_FAILURE_MESSAGE`, `moqAdjustmentMessage(outcome)`, `quickOrderSummaryMessage(response)`, `skippedOutcomes`, `adjustedOutcomes`. Copy stays buyer-facing: no `SKU`, `MOQ`, `variant`, or underscore codes
- `apps/web/src/features/quickOrder/QuickOrderOutcomeList.tsx` (proposed) -> named `role="status" aria-live="polite"` region with `empty:hidden`; separate labelled lists for adjusted lines and skipped lines, each row keyed and prefixed with its `lineNumber`; `View cart` link rendered only when `addedLineCount !== 0`
- `apps/web/src/features/quickOrder/QuickOrderPage.tsx` (proposed) -> labelled `<textarea>` (no `ui/textarea` primitive exists; raw element with Tailwind utilities, no new `index.css` class), placeholder showing two example lines, submit button disabled while `!isCartAvailable || isSubmitting || text.trim() === ''`, `role="alert"` error block, results delegated to `QuickOrderOutcomeList`
- `apps/web/src/App.tsx` -> `<Route path="/quick-order" element={<QuickOrderPage />} />` inside the `Layout` parent, no `ProtectedRoute`
- `apps/web/src/features/cart/CartPage.tsx` -> `<Link to="/quick-order">` entry point

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2} -> G1 -> P3 -> R3 -> GR3 -> P4 -> R4 -> GR4 -> P5 -> R5 -> GR5 -> G2 -> {P6 -> R6 -> GR6 || P7 -> R7 -> GR7} -> G3 -> P8 -> R8 -> GR8 -> S1 -> R9 -> GR9 -> G4`

- `G0`: worktree recorded; Node 22 selected; `npm exec -- tsx --version` and `npm run typecheck -w @shop/api` pass; seeded catalog facts in Decisions confirmed; `npm run test:integration -w @shop/web` baselined and any pre-existing failure recorded as `E0-web-int-baseline`
- `GR1`: contract review gate; blocks every consumer (`P3`, `P5`, `P6`, `P7`)
- `GR2`: repository review gate; blocks `P4`
- `G1`: both producer gates passed -> API domain lane may start
- `GR3`, `GR4`, `GR5`: rules, service+audit, route+wiring review gates; each blocks the next packet
- `G2`: API vertical complete and reviewed -> web lanes launch
- `GR6`, `GR7`: web client/hook and web presentation review gates
- `G3`: both web lane gates passed -> page composition may start
- `GR8`: page/route/entry-point review gate
- `GR9`: convergence review gate
- `G4`: completion gate; broad suite plus the web integration suite run once after all fixes settle

## Work Packets

### P1: Quick Order transport contract

- mode: parallel with `P2` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/quickOrder.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/quickOrder-contracts.test.ts`
- reads: `packages/contracts/src/reorder.ts` -> `ReorderLineOutcomeFields`, `ReorderOutcomeStatusPair`, `ReorderResponse` -> exact idiom to mirror; `packages/contracts/src/common.ts` -> `MoneyCents`, `ErrorResponse` -> shared scalars; `packages/contracts/test/reorder-contracts.test.ts` -> contract-test style; `packages/contracts/package.json` -> exports-map entry shape
- acceptance: `@shop/contracts` builds; `QuickOrderResponse` accepts a valid mixed payload and rejects `status='added'` with a non-null `reason`, `status='skipped'` with a null `reason`, and an unknown `reason` literal; `@shop/contracts/quick-order` resolves from a TypeScript consumer
- non-goals: no domain logic, no API or web edits, no changes to `reorder.ts` or `cart.ts`
- upstream inputs: none
- changes:
  - add `packages/contracts/src/quickOrder.ts` per Target Design -> Contracts, with TSDoc stating `BLEND_UNAVAILABLE` is structurally present but never produced
  - append `export * from './quickOrder.js';` to `packages/contracts/src/index.ts`
  - append the `"./quick-order"` entry to the `exports` map
  - add `packages/contracts/test/quickOrder-contracts.test.ts` covering the status/reason pairing both ways, nullable field acceptance, `additionalProperties: false` rejection, and that every `QuickOrderSkipReason` literal validates
- invariants: transport enum only, no domain rules in contracts; `additionalProperties: false` on every object; existing contract modules unchanged
- relevant evidence: none
- test duty: `E1` -> `npm run build -w @shop/contracts` then `npm exec -w @shop/contracts -- tsx --test packages/contracts/test/quickOrder-contracts.test.ts`
- verification: `E1` passes; no other workspace touched
- handoff: `QuickOrderRequestBody`, `QuickOrderResponse`, `QuickOrderLineOutcome`, `QuickOrderSkipReason` at `./quick-order`; built `dist/` available to API and web typecheck
- review: `R1` -> `GR1` blocks `P3`, `P5`, `P6`, `P7`

### P2: SKU -> variant read path

- mode: parallel with `P1` after `G0`
- depends on: `G0`
- owns: `apps/api/src/features/catalog/productRepository.ts`, `apps/api/test/catalog/productRepositorySkus.integration.test.ts`
- reads: `apps/api/src/features/catalog/productRepository.ts` -> `VariantRow`, `ProductRow`, `findVariantsByIds` -> exact query and typing idiom; `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> live `product_variants` shape and `sku` uniqueness; `apps/api/test/catalog/products.integration.test.ts` -> `openFixture` pattern, seeded SKU assertions
- acceptance: `findVariantsBySkus` returns joined rows for known SKUs including retired ones, omits unknown SKUs, returns `[]` for empty input, and never issues SQL for empty input
- non-goals: no `active` filtering, no case-insensitive collation, no normalisation (callers normalise), no migration, no admin-surface change
- upstream inputs: none
- changes:
  - add `VariantWithProductRow` extending `VariantRow` with `product_name: string`
  - add `findVariantsBySkus` to the `ProductRepository` interface and implementation per Target Design -> Persistence
  - add an integration test asserting: known active SKU resolves with `product_name`; a variant retired by migration `020` resolves with `active = 0`; unknown SKU absent; empty input returns `[]`; a lowercase form of a seeded SKU does not resolve (documents binary matching)
- invariants: no behaviour change to any existing `ProductRepository` method; deterministic ordering; parameterised placeholders only, never interpolated SKU strings
- relevant evidence: none
- test duty: `E2` -> `npm exec -w @shop/api -- tsx --test apps/api/test/catalog/productRepositorySkus.integration.test.ts`
- verification: `E2` passes; `npm run typecheck -w @shop/api` clean
- handoff: `findVariantsBySkus(skus): VariantWithProductRow[]` on `ProductRepository`
- review: `R2` -> `GR2` blocks `P4`

### P3: Quick Order pure rules

- mode: sequential after `G1`
- depends on: `P1`, `G1`
- owns: `apps/api/src/features/quickOrder/quickOrderRules.ts`, `apps/api/src/features/quickOrder/quickOrderErrors.ts`, `apps/api/src/features/quickOrder/quickOrderRules.test.ts`
- reads: `apps/api/src/features/reorder/reorderRules.ts` -> pre-skip set, `toBulkAddRequests`, `assembleReorderOutcomes`, invariant-breach throws -> structure to mirror; `apps/api/src/features/reorder/reorderErrors.ts` -> result-union idiom; `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BulkAddRequest`, `BulkAddOutcome`, `BulkAddSkipReason`, aggregation semantics; `apps/api/src/features/pricing/pricingRules.ts` -> `moqShortfallSacks` signature and its `RangeError` guards; `apps/api/src/features/cart/cartBulkAddRules.test.ts` -> unit-test style
- acceptance: every parse, aggregation, round-up, and assembly rule in Target Design -> Domain rules is implemented and covered; module reads no clock and touches no SQL
- non-goals: no repository access, no service composition, no route, no cart-state reads
- upstream inputs: `P1` -> `packages/contracts/src/quickOrder.ts` -> `QuickOrderSkipReason` union that the domain type must stay assignable to
- changes:
  - add `quickOrderErrors.ts` per Target Design
  - add `quickOrderRules.ts` with `parseQuickOrderText`, `buildQuickOrderDemand`, `toQuickOrderBulkAddRequests`, `assembleQuickOrderOutcomes`, `countQuickOrderOutcomes`, and the two constants
  - add `quickOrderRules.test.ts` using `node:test` + `node:assert/strict`, `void test(...)`, local `Partial<T>` builders, named cases for: CRLF and blank-line handling with physical line numbers preserved; comma, semicolon, tab, and whitespace separators; three-token line -> `MALFORMED_LINE`; empty or >64-char SKU token -> `MALFORMED_LINE`; `4.5`, `-1`, `0`, `abc`, `1e3` -> `INVALID_QUANTITY`; lowercase SKU normalised to uppercase; unknown SKU -> `SKU_NOT_FOUND` on every contributing line; duplicate SKU merged into one group at the summed quantity with `duplicateSku` true on both lines; `1` at MOQ 4 rounds to 4 with `moqAdjusted` true; `2` + `2` at MOQ 4 sums to 4 with `moqAdjusted` false; retired variant receives no round-up; unusable `weight_grams`/`moq_sacks` receives no round-up and no throw; summed quantity overflow -> `INVALID_QUANTITY`; group verdict fans out to every member line; submitted group with no cart outcome throws
- invariants: pure and deterministic; round-up never lowers a quantity; `moqShortfallSacks` is never called with inputs that would raise `RangeError`; skip reasons come from the shared vocabulary only
- relevant evidence: `E1` -> contract union available at `@shop/contracts/quick-order`
- test duty: `E3` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/quickOrder/quickOrderRules.test.ts`
- verification: `E3` passes; `npm run typecheck -w @shop/api` clean
- handoff: pure rule surface plus `QuickOrderResult<T>` consumed by `P4`
- review: `R3` -> `GR3` blocks `P4`

### P4: Quick Order service and audit event

- mode: sequential after `GR3`
- depends on: `P2`, `P3`, `GR2`, `GR3`
- owns: `apps/api/src/features/quickOrder/quickOrderService.ts`, `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditEvent.test.ts`
- reads: `apps/api/src/features/reorder/reorderService.ts` -> `unitOfWork.run` wrapping, narrow reader port, feature-level audit append, rejection mapping -> structure to mirror; `apps/api/src/features/cart/cartService.ts:46-66` -> `addMany` signature, `BulkAddResult`, `BulkAddRejection`, and its throw-on-missing-dependency behaviour; `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `UserEventAction` exclusion, `cartEntity`, `requireNonNegativeSafeInteger`, `MAX_METADATA_BYTES`; `apps/api/src/features/audit/auditEvent.test.ts:51-90` -> reorder audit test precedent
- acceptance: `quickOrder(input)` returns a domain report or a typed rejection; one `findVariantsBySkus` call per request; audit event built and rejected correctly for unusable counts
- non-goals: no route, no `app.ts` wiring, no changes to `cartService.ts` or `cartBulkAddRules.ts`, no contract edits
- upstream inputs: `P2` -> `findVariantsBySkus(skus): VariantWithProductRow[]`; `P3` -> `parseQuickOrderText`, `buildQuickOrderDemand`, `toQuickOrderBulkAddRequests`, `assembleQuickOrderOutcomes`, `countQuickOrderOutcomes`, `QuickOrderResult<T>`
- changes:
  - add `quickOrderService.ts` per Target Design -> Service, with the narrow `QuickOrderVariantReader` port and no clock dependency
  - add `'cart.quick_order_added'` to `AUDIT_ACTIONS`, its `AuditEventInput` member, and its `switch` case with count guards
  - extend `auditEvent.test.ts` with a positive build case and a negative unusable-count case
- invariants: whole request runs in one `unitOfWork.run`; a classified skip never rolls back an applied line; audit metadata carries counts only, never raw SKU strings or pasted text; ownership of `auditEvent.ts` is exclusive to this packet for the whole run
- relevant evidence: `E2` -> repository read path; `E3` -> pure rules
- test duty: `E4` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/audit/auditEvent.test.ts`
- verification: `E4` passes; `npm run typecheck -w @shop/api` clean
- handoff: `createQuickOrderService(dependencies)` + `QuickOrderService` interface; `cart.quick_order_added` audit action
- review: `R4` -> `GR4` blocks `P5`

### P5: Route, composition wiring, route integration tests

- mode: sequential after `GR4`
- depends on: `P1`, `P4`, `GR1`, `GR4`
- owns: `apps/api/src/routes/quickOrder.ts`, `apps/api/src/app.ts`, `apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts`
- reads: `apps/api/src/routes/reorder.ts` -> code-bearing error body, message/status maps, transport mapper, plugin signature -> structure to mirror; `apps/api/src/routes/cart.ts:21-50` -> `auditContext` anonymous fallback and unauthenticated cart-route posture; `apps/api/src/app.ts:16,174,207,376-385,513` -> import, service type, `AppServices` field, construction, registration sites; `apps/api/test/reorder/reorderRoutes.integration.test.ts` -> `openFixture`, `cookieValue`/`login`, `createCart`, `Value.Check` wire validation, audit-row assertions, cart reservation via `createCartRepository(db).reserve(...)`
- acceptance: endpoint returns 200 with per-line outcomes for a mixed paste, maps all four rejection codes, works unauthenticated, and writes exactly one `cart.quick_order_added` audit row per successful request
- non-goals: no auth gate, no web work, no seed change, no changes to existing routes
- upstream inputs: `P1` -> `QuickOrderRequestBody`, `QuickOrderResponse`, `QuickOrderLineOutcome`; `P4` -> `createQuickOrderService`, `QuickOrderService`, `cart.quick_order_added`
- changes:
  - add `apps/api/src/routes/quickOrder.ts` per Target Design -> Route
  - wire `app.ts`: route import, service import + type, `AppServices.quickOrder`, construction against hoisted `cartService`/`products`/`unitOfWork`/`audit`, `await app.register(quickOrderRoutes, context)`
  - add `apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts` with its own `openFixture`/`createCart` helpers, covering: mixed paste producing added, `SKU_NOT_FOUND`, `VARIANT_RETIRED`, `INSUFFICIENT_STOCK`, an MOQ-adjusted added line, and a duplicate SKU merged into one cart line at the summed quantity; MOQ round-up pushing a line past available stock -> `INSUFFICIENT_STOCK`; guest (no cookie) succeeds; signed-in buyer succeeds and the audit actor is the user; unknown cart -> 404 with `error` exactly `Cart not found`; reserved cart -> 409 `CART_RESERVED` with the cart untouched; whitespace-only text -> 400 `NO_INPUT_LINES`; over-cap paste -> 400 `TOO_MANY_LINES`; response validated with `Value.Check(QuickOrderResponse, body)`; exactly one `cart.quick_order_added` row with the expected `metadata_json`
  - confirm real seeded stock, clearance, MOQ, and retired-variant SKUs before pinning fixture values; adjust the paste fixtures to the actual seed rather than the assumed values
- invariants: `Cart not found` prose exact; partial success returns 200; no lifecycle or pricing rule re-implemented in the route; existing route registrations and their order unchanged apart from one insertion
- relevant evidence: `E1`, `E3`, `E4`
- test duty: `E5` -> `npm exec -w @shop/api -- tsx --test apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts`
- verification: `E5` passes; `npm run typecheck -w @shop/api` clean
- handoff: live `POST /api/cart/:cartId/quick-order` with confirmed request/response shapes and confirmed seeded fixture SKUs for web and convergence work
- review: `R5` -> `GR5` blocks `G2`

### P6: Web API client and cart-hook mutation

- mode: parallel with `P7` after `G2`
- depends on: `P1`, `P5`, `G2`
- owns: `apps/web/src/api/quickOrder.ts`, `apps/web/src/api/quickOrder.test.ts`, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`
- reads: `apps/web/src/api/reorder.ts` and `apps/web/src/api/reorder.test.ts` -> `apiFetch` wrapper idiom, `encodeURIComponent` test precedent; `apps/web/src/api/client.ts` -> `apiFetch`, `ApiError`, `isMissingCartError`; `apps/web/src/hooks/useCart.ts` -> `CartAction`, `runCartMutation`, `ERROR_MESSAGE_BY_CODE`, pending-key handling, stale-response sequencing; `apps/web/src/hooks/cartClient.ts` -> `loadOrCreate`, `recoverMissingCart`
- acceptance: `submitQuickOrder` posts to the correct encoded path and validates the response against `QuickOrderResponse`; `cart.quickOrder(text)` sets a scoped pending state, replaces the cart from the response without refetching, recovers and replays on a vanished cart, and maps the new rejection codes to buyer-facing copy
- non-goals: no page component, no presentation module, no route registration, no changes to other cart mutations
- upstream inputs: `P1` -> `QuickOrderResponse`, `QuickOrderRequestBody`; `P5` -> live endpoint path and rejection codes
- changes:
  - add `apps/web/src/api/quickOrder.ts` -> `submitQuickOrder(cartId, text)`
  - add its test covering path encoding, request body shape, contract validation failure, and `ApiError` propagation with `response.code`
  - extend `CartAction` with `'quick-order'`, add a module-level `QUICK_ORDER_PENDING_KEY`, add `quickOrder(text)` through `runCartMutation` with `retryAfterRecovery: true` and `selectCart = (response) => response.cart`
  - add `NO_INPUT_LINES` and `TOO_MANY_LINES` copy to `ERROR_MESSAGE_BY_CODE`
  - extend `useCart.test.tsx` with: pending key asserted through `isActionPending`; cart replaced from the response; failure returns `false` and sets `error`; vanished cart recovered and the submission replayed against the new cart id
- invariants: no cart refetch after a mutation; stale-response sequencing untouched; `CART_NOT_FOUND` stays out of `ERROR_MESSAGE_BY_CODE` because it is recovered, not shown; existing mutations unchanged
- relevant evidence: `E5` -> endpoint contract confirmed live
- test duty: `E6` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/api/quickOrder.test.ts apps/web/src/hooks/useCart.test.tsx`
- verification: `E6` passes; `npm run typecheck -w @shop/web` clean
- handoff: `submitQuickOrder`; `cart.quickOrder(text)` and `'quick-order'` pending semantics on the cart context
- review: `R6` -> `GR6` blocks `G3`

### P7: Web presentation module and outcome list

- mode: parallel with `P6` after `G2`
- depends on: `P1`, `P5`, `G2`
- owns: `apps/web/src/features/quickOrder/quickOrderPresentation.ts`, `apps/web/src/features/quickOrder/QuickOrderOutcomeList.tsx`, `apps/web/src/features/quickOrder/QuickOrderOutcomeList.test.tsx`
- reads: `apps/web/src/features/reorder/reorderPresentation.ts` -> copy-table idiom, derived reason list, summary sentence, state union; `apps/web/src/features/reorder/ReorderOutcomeList.tsx` -> live-region naming, `empty:hidden`, labelled lists, conditional `View cart` link, non-`alert` all-skipped result; `apps/web/src/features/reorder/ReorderOutcomeList.test.tsx` -> local fixture builders, `MemoryRouter` wrapper, copy-jargon assertions; `apps/web/src/lib/formatMoney.ts` -> money formatting
- acceptance: every `QuickOrderSkipReason` has buyer-facing copy; adjusted lines and skipped lines render in separately labelled lists keyed by line number; the live region stays mounted and empty while idle
- non-goals: no page component, no data fetching, no route registration, no `index.css` change, no reuse of `.custom-blend-*` classes
- upstream inputs: `P1` -> `QuickOrderSkipReason`, `QuickOrderLineOutcome`, `QuickOrderResponse`; `P5` -> which reasons are actually reachable
- changes:
  - add `quickOrderPresentation.ts` per Target Design -> Web, with `SKIP_REASON_MESSAGE` typed as `Readonly<Record<QuickOrderSkipReason, string>>` and `SKIP_REASONS` derived from its keys
  - add `QuickOrderOutcomeList.tsx` with `role="status" aria-live="polite"` and an explicit `aria-label`, an adjusted-lines list, a skipped-lines list, and a `View cart` link shown only when `addedLineCount !== 0`
  - add the colocated test covering: idle state renders an empty named region; all-added, all-skipped, and mixed summaries; adjusted-line sentence naming requested and submitted quantities; duplicate-SKU line reported on both input lines; every `SKIP_REASONS` entry has copy free of `/MOQ|SKU|variant|_/i`; all-skipped result exposes no `role="alert"`
- invariants: presentation derives nothing the server owns — no price maths, no MOQ maths, no re-classification; Tailwind utilities only
- relevant evidence: `E5`
- test duty: `E7` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/quickOrder/QuickOrderOutcomeList.test.tsx`
- verification: `E7` passes; `npm run typecheck -w @shop/web` clean
- handoff: `QuickOrderState`, copy helpers, `QuickOrderOutcomeList`
- review: `R7` -> `GR7` blocks `G3`

### P8: Quick Order page, route, cart entry point

- mode: sequential after `G3`
- depends on: `P6`, `P7`, `G3`
- owns: `apps/web/src/features/quickOrder/QuickOrderPage.tsx`, `apps/web/src/features/quickOrder/QuickOrderPage.test.tsx`, `apps/web/src/App.tsx`, `apps/web/src/features/cart/CartPage.tsx`, `apps/web/src/features/cart/CartPage.test.tsx`
- reads: `apps/web/src/features/customBlend/CustomBlendPage.tsx` -> form submit guard, `isSubmitting` handling, `role="alert"` error blocks, result-swap pattern; `apps/web/src/features/checkout/PromoCodeForm.tsx` -> `aria-invalid` + `aria-describedby` field-error convention; `apps/web/src/App.tsx` -> route registry shape and `Layout` parent; `apps/web/src/features/cart/CartPage.tsx` -> existing composition and link conventions
- acceptance: `/quick-order` renders a labelled paste box and submit control, submits through `cart.quickOrder`, renders results through `QuickOrderOutcomeList`, shows a recoverable error block on failure, and is reachable from the cart page
- non-goals: no nav entry, no `navItems.ts` or `CategoryNav.tsx` edit, no `index.css` edit, no `ProtectedRoute` wrapper, no help-article authoring
- upstream inputs: `P6` -> `cart.quickOrder(text)` + `'quick-order'` pending key; `P7` -> `QuickOrderState`, `QuickOrderOutcomeList`, copy helpers
- changes:
  - add `QuickOrderPage.tsx` per Target Design -> Web
  - register `/quick-order` in `App.tsx` inside the `Layout` parent
  - add the cart-page link to `/quick-order`
  - add `QuickOrderPage.test.tsx` mocking `@/hooks/CartContext`, covering: submit disabled while the box is empty or a submission is pending; busy label during submission; successful submission renders the outcome region; failed submission renders a `role="alert"` block carrying the failure copy, never the shared cart error slot; textarea has an accessible label
  - extend `CartPage.test.tsx` with an assertion that the Quick Order link is present with the correct `href`
- invariants: page never derives price or MOQ; cart id is obtained by the hook, never by the page; existing cart-page behaviour and tests unchanged apart from the new link
- relevant evidence: `E6`, `E7`
- test duty: `E8` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/quickOrder/QuickOrderPage.test.tsx apps/web/src/features/cart/CartPage.test.tsx`
- verification: `E8` passes; `npm run typecheck -w @shop/web` clean
- handoff: complete customer journey from `/cart` to `/quick-order` to cart
- review: `R8` -> `GR8` blocks `S1`

### S1: Convergence, journey test, records

- mode: sequential after `GR8`
- depends on: `P1`-`P8`, `GR8`
- owns: `apps/web/src/features/quickOrder/QuickOrderJourney.integration.test.tsx`, `README.md`, `plans/demo_project_high_level_plan.md`
- reads: `apps/web/src/features/reorder/BuyAgainJourney.integration.test.tsx` -> API-module mocking, `CartProvider` + real page mounting, `setCartId` seeding, `CartStub` route for link landing; `apps/web/vitest.integration.config.ts` -> integration suite membership; `README.md` -> demo-trigger documentation conventions; `plans/demo_project_high_level_plan.md:195-220` -> item 12 landed-record format and the item 13/14 shared constraints block
- acceptance: journey test proves the end-to-end web path against mocked API modules; README documents a sample paste that produces a mixed result against the seeded catalog; item 14 is recorded as completed with landed facts; full suites pass
- non-goals: no new seed rows, no `AGENTS.md` edit (`src/features/` is already covered generically), no changes to any packet-owned source file except to close a review finding
- upstream inputs: `P5` -> confirmed seeded fixture SKUs and endpoint semantics; `P6`, `P7`, `P8` -> web surface
- changes:
  - add `QuickOrderJourney.integration.test.tsx` mocking `@/api/quickOrder` and `@/api/cart`, mounting `CartProvider` + real `QuickOrderPage` in a `MemoryRouter` with a `CartStub` at `/cart`, covering: paste -> submit -> mixed result rendered with per-line reasons and the MOQ adjustment sentence; `View cart` link lands on the cart route; a vanished cart is recovered and the submission replayed once
  - add a README section documenting the `/quick-order` entry point and a copy-pasteable sample block whose SKUs and quantities are taken from the values `P5` confirmed against the seed
  - update `plans/demo_project_high_level_plan.md`: mark item 14 completed with landed paths, the round-up decision, the rejected cart-aware-rounding alternative, the reachable skip-reason set, `no migration; head stays 028`, and the live QA surface; refresh the phase-status and history-pointer lines to include Quick Order
  - leave the item 13/14 shared-constraints block intact for Saved Lists
- relevant evidence: `E1`-`E8`, `E0-web-int-baseline`
- test duty: `E9` -> `npm exec -w @shop/web -- vitest run --configLoader runner --config apps/web/vitest.integration.config.ts apps/web/src/features/quickOrder/QuickOrderJourney.integration.test.tsx`; `E10` -> `npm test -w @shop/api`; `E11` -> `npm run test:integration -w @shop/web`
- verification: `E9`, `E10` pass; `E11` shows no failure absent from `E0-web-int-baseline`
- handoff: completion evidence for `G4`
- review: `R9` -> `GR9` blocks `G4`

## Review Assignments

Every assignment sets `review_skill=code-reviewer`, `write_policy.mode=inspect_only`, and `test_policy.default = assess supplied evidence; do not rerun valid commands`.

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its critical+high severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set on `packages/contracts/**`
- timing: immediately after the `P1` report and `E1`; before `P3`, `P5`, `P6`, `P7`
- blocks: `GR1`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `packages/contracts/src/quickOrder.ts` -> every exported schema; `packages/contracts/src/reorder.ts` -> pairing-check precedent; `packages/contracts/package.json` -> exports map; `packages/contracts/test/quickOrder-contracts.test.ts` -> whether the pairing test can actually fail
- acceptance: status/reason pairing enforced in both directions; nullable fields match the states that can produce them; subpath entry correct and consistent with the camelCase-to-kebab convention; `additionalProperties: false` everywhere
- invariants: transport-only module; no domain logic; no edits to existing contract modules
- risk focus: a pairing check that silently passes everything; a nullable field that is actually always present, or a non-nullable field unreachable states cannot fill; a wrong `dist` path in the exports map
- non-goals: no API or web review; no style opinions
- relevant evidence: `E1`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- method: as `R1`
- target: `P2` -> settled change set on `apps/api/src/features/catalog/productRepository.ts` and its new integration test
- timing: immediately after the `P2` report and `E2`; before `P4`
- blocks: `GR2`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/api/src/features/catalog/productRepository.ts` -> `findVariantsBySkus` and the interface addition; `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> live table shape; `apps/api/test/catalog/productRepositorySkus.integration.test.ts` -> assertion strength
- acceptance: retired variants resolve; unknown SKUs are omitted; empty input short-circuits; existing methods untouched
- invariants: parameterised SQL only; no `active` filter; deterministic ordering
- risk focus: SQL injection through interpolated SKUs; an unqualified `SELECT *` colliding on `id` after the join; a test that would pass even with an `active = 1` filter present
- non-goals: no domain or route review
- relevant evidence: `E2`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R3: Review `P3`

- method: as `R1`
- target: `P3` -> settled change set on `apps/api/src/features/quickOrder/quickOrderRules.ts`, `quickOrderErrors.ts`, `quickOrderRules.test.ts`
- timing: immediately after the `P3` report and `E3`; before `P4`
- blocks: `GR3`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/api/src/features/quickOrder/quickOrderRules.ts` -> parse, demand, assembly; `apps/api/src/features/pricing/pricingRules.ts:141-166` -> `validateMoq` and `moqShortfallSacks` guards; `apps/api/src/features/cart/cartBulkAddRules.ts` -> aggregation and precedence the rules must not contradict; `apps/api/src/features/quickOrder/quickOrderRules.test.ts` -> whether each named scenario can fail
- acceptance: round-up applied to the aggregated demand, never per line; round-up never lowers a quantity; unusable MOQ data and retired variants take the no-adjustment path without throwing; duplicate SKUs fan one verdict to every member line; physical line numbers preserved across blank lines
- invariants: pure and clock-free; skip reasons drawn only from the shared vocabulary; a submitted group without a cart outcome throws
- risk focus: `moqShortfallSacks` reached with inputs that raise `RangeError`; quantity summation overflowing without a guard; per-line rounding inflating a duplicated SKU; a parse branch that silently swallows a line instead of reporting it; tests asserting on builder defaults rather than behaviour
- non-goals: no service, route, or contract review
- relevant evidence: `E1`, `E3`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R4: Review `P4`

- method: as `R1`
- target: `P4` -> settled change set on `apps/api/src/features/quickOrder/quickOrderService.ts` and `apps/api/src/features/audit/auditEvent.ts` plus its test
- timing: immediately after the `P4` report and `E4`; before `P5`
- blocks: `GR4`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/api/src/features/quickOrder/quickOrderService.ts` -> transaction boundary, port usage, rejection mapping, audit append; `apps/api/src/features/reorder/reorderService.ts` -> the precedent it mirrors; `apps/api/src/features/cart/cartService.ts:140-156,614-711` -> `addMany` contract and its nested-transaction expectation; `apps/api/src/features/audit/auditEvent.ts` -> new action, union member, switch case
- acceptance: whole request inside one `unitOfWork.run`; both `BulkAddRejection` values mapped; one variant read per request; audit event scalar-only and within the metadata budget
- invariants: partial success never rolls back applied lines; audit append inside the transaction; no raw SKU or pasted text in metadata; no other audit action altered
- risk focus: a second competing unit of work instead of a nested savepoint; an unmapped `addMany` return value falling through as success; audit metadata that can exceed `MAX_METADATA_BYTES` or leak buyer input; the new `cart.*` action bypassing the `UserEventAction` exclusion
- non-goals: no route or web review
- relevant evidence: `E2`, `E3`, `E4`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R5: Review `P5`

- method: as `R1`
- target: `P5` -> settled change set on `apps/api/src/routes/quickOrder.ts`, `apps/api/src/app.ts`, `apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts`
- timing: immediately after the `P5` report and `E5`; before `G2` and any web packet
- blocks: `GR5`, `G2`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/api/src/routes/quickOrder.ts` -> schemas, error mapping, transport mapper; `apps/api/src/routes/reorder.ts` -> the precedent; `apps/api/src/routes/cart.ts:21-50` -> auth posture and audit actor; `apps/api/src/app.ts` -> service construction and registration; `apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts` -> fixture realism and assertion strength
- acceptance: all four rejection codes mapped to the stated statuses; `Cart not found` prose exact; partial success returns 200; unauthenticated and authenticated paths both work with the correct audit actor; fixtures reflect real seeded values
- invariants: no auth gate added; no pricing or MOQ logic in the route; existing registrations and their order preserved; response validated against the contract in the test
- risk focus: a wrong status or prose breaking the web cart-recovery path; the service constructed with a second `unitOfWork` or a different cart service instance; fixtures pinned to assumed rather than verified seed values; an integration test that would pass even if outcomes were empty
- non-goals: no web review; no contract re-review
- relevant evidence: `E1`, `E3`, `E4`, `E5`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R6: Review `P6`

- method: as `R1`
- target: `P6` -> settled change set on `apps/web/src/api/quickOrder.ts`, its test, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`
- timing: immediately after the `P6` report and `E6`; before `G3`
- blocks: `GR6`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/web/src/hooks/useCart.ts` -> the new mutation against `runCartMutation` semantics, sequencing, and pending keys; `apps/web/src/api/quickOrder.ts` -> path building and schema validation; `apps/web/src/api/client.ts` -> `isMissingCartError` coupling; `apps/web/src/hooks/useCart.test.tsx` -> new-case assertion strength
- acceptance: pending state scoped and released on both success and failure; cart replaced from the response; recovery replays exactly once; new rejection codes mapped to buyer-facing copy
- invariants: no refetch after mutation; stale-response sequencing preserved; existing mutations and their pending keys unchanged
- risk focus: a pending key colliding with a cart-line key; recovery looping or replaying twice; an unreleased pending flag on the error path; `CART_NOT_FOUND` copy added to the code map and short-circuiting recovery
- non-goals: no page or presentation review
- relevant evidence: `E5`, `E6`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R7: Review `P7`

- method: as `R1`
- target: `P7` -> settled change set on `apps/web/src/features/quickOrder/quickOrderPresentation.ts`, `QuickOrderOutcomeList.tsx`, and its test
- timing: immediately after the `P7` report and `E7`; before `G3`
- blocks: `GR7`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `apps/web/src/features/quickOrder/quickOrderPresentation.ts` -> copy table and derived reason list; `QuickOrderOutcomeList.tsx` -> live-region and list semantics; `apps/web/src/features/reorder/reorderPresentation.ts` and `ReorderOutcomeList.tsx` -> the conventions it must match; the colocated test -> coverage of every reason
- acceptance: every reason has copy; adjusted and skipped lines separated and labelled; idle region mounted and empty; `View cart` shown only when something was added
- invariants: no price or MOQ derivation on the client; no re-classification of server outcomes; no `index.css` additions; no `.custom-blend-*` reuse
- risk focus: copy leaking internal codes or trade jargon; a reason present in the union but missing from the record; a live region remounted per result and therefore not announced; an all-skipped result presented as a hard failure
- non-goals: no page, route, or hook review
- relevant evidence: `E5`, `E7`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R8: Review `P8`

- method: as `R1`
- target: `P8` -> settled change set on `apps/web/src/features/quickOrder/QuickOrderPage.tsx`, its test, `apps/web/src/App.tsx`, `apps/web/src/features/cart/CartPage.tsx`, `CartPage.test.tsx`
- timing: immediately after the `P8` report and `E8`; before `S1`
- blocks: `GR8`
- consolidation reason: none; one review per implementation packet
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `QuickOrderPage.tsx` -> submit guards, busy state, error surfaces, accessible labelling; `apps/web/src/App.tsx` -> route placement; `apps/web/src/features/cart/CartPage.tsx` -> the added link; both tests -> assertion strength
- acceptance: submit blocked while empty, pending, or the cart is unavailable; failure copy comes from the feature, not the shared cart error slot; textarea labelled; route registered under `Layout` without an auth wrapper; cart entry point present
- invariants: no nav entry; no `index.css` change; cart id never handled by the page; existing cart-page behaviour preserved
- risk focus: double submission on rapid activation; a route placed outside `Layout` or behind `ProtectedRoute`; error state persisting across a later successful submission; a cart-page test weakened to accommodate the new link
- non-goals: no journey-test or records review
- relevant evidence: `E6`, `E7`, `E8`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R9: Review `S1`

- method: as `R1`
- target: `S1` -> settled change set on `QuickOrderJourney.integration.test.tsx`, `README.md`, `plans/demo_project_high_level_plan.md`
- timing: after the `S1` report and `E9`-`E11`; before `G4`
- blocks: `GR9`, `G4`
- consolidation reason: none; convergence output receives its own review, separate from every packet review
- write policy: inspect-only
- test policy: assess supplied evidence; run a command only when assigned, or when stale or missing evidence blocks the verdict
- reads: `QuickOrderJourney.integration.test.tsx` -> whether it exercises the real provider and page rather than mocks of them; `README.md` -> sample paste accuracy; `plans/demo_project_high_level_plan.md` -> item 14 record accuracy against what actually landed
- acceptance: journey test covers mixed result, cart-link landing, and recovery replay; README sample matches verified seeded SKUs; item 14 record states migration-free delivery, the round-up decision, and the reachable reason set
- invariants: integration test lives in the integration suite and is picked up by its config; plan record claims only what the code does; no seed change claimed or made
- risk focus: a journey test that passes with the page stubbed out; README SKUs that do not exist in the seed; a plan record overstating scope or contradicting the shared 13/14 constraint block; `E11` failures beyond the recorded baseline being written off without evidence
- non-goals: no re-review of earlier packets
- relevant evidence: `E9`, `E10`, `E11`, `E0-web-int-baseline`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

## Ownership and Collision Rules

- `packages/contracts/**`: owned only by `P1`; every later packet reads it
- `apps/api/src/features/catalog/productRepository.ts`: owned only by `P2`
- `apps/api/src/features/audit/auditEvent.ts`: owned only by `P4` for the whole run
- `apps/api/src/app.ts`: owned only by `P5`; single registration and construction point
- `apps/web/src/hooks/useCart.ts`: owned only by `P6`
- `apps/web/src/App.tsx` and `apps/web/src/features/cart/CartPage.tsx`: owned only by `P8`
- `README.md` and `plans/demo_project_high_level_plan.md`: owned only by `S1`
- `apps/api/src/features/cart/**` and `cartBulkAddRules.ts`: read-only for every packet; a change here means the plan is wrong and the orchestrator must be asked
- `apps/web/src/components/nav/navItems.ts`, `CategoryNav.tsx`, `apps/web/src/index.css`: untouched by every packet
- migration versions: none reserved; head stays `028`. A packet proposing a migration is blocked, not accommodated
- contract changes: `P1` produces, `GR1` gates, all consumers follow
- composition: `P8` owns web composition; `S1` owns records and cross-cutting verification

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings; never name or override them here
- non-Codex harnesses: ignore the Codex binding; use harness-native subagent configuration while preserving worker and reviewer responsibilities and the communication contracts
- all harnesses: the reviewer runs `.claude/skills/code-reviewer` as its review method. Assignments set `review_skill=code-reviewer`; the reviewer invokes it explicitly by name because the skill carries `disable-model-invocation`

## Test Execution Schedule

Node is not on `PATH`. Every command runs from the worktree root after `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH`. `npm run build -w @shop/contracts` must precede any API or web typecheck that consumes `@shop/contracts/quick-order`.

- `T0`: baseline at `G0` -> owner: `G0` -> `npm exec -- tsx --version` and `npm run typecheck -w @shop/api` -> evidence `E0-toolchain`
- `T1`: baseline at `G0` -> owner: `G0` -> `npm run test:integration -w @shop/web`; record pass/fail per file as the known-red baseline -> evidence `E0-web-int-baseline`
- `T2`: focused, after `P1` changes settle -> owner: `P1` -> `npm run build -w @shop/contracts` then `npm exec -w @shop/contracts -- tsx --test packages/contracts/test/quickOrder-contracts.test.ts` -> evidence `E1`
- `T3`: focused, after `P2` -> owner: `P2` -> `npm exec -w @shop/api -- tsx --test apps/api/test/catalog/productRepositorySkus.integration.test.ts` -> evidence `E2`
- `T4`: focused, after `P3` -> owner: `P3` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/quickOrder/quickOrderRules.test.ts` -> evidence `E3`
- `T5`: focused, after `P4` -> owner: `P4` -> `npm exec -w @shop/api -- tsx --test apps/api/src/features/audit/auditEvent.test.ts` -> evidence `E4`
- `T6`: focused, after `P5` -> owner: `P5` -> `npm exec -w @shop/api -- tsx --test apps/api/test/quickOrder/quickOrderRoutes.integration.test.ts` -> evidence `E5`
- `T7`: focused, after `P6` -> owner: `P6` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/api/quickOrder.test.ts apps/web/src/hooks/useCart.test.tsx` -> evidence `E6`
- `T8`: focused, after `P7` -> owner: `P7` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/quickOrder/QuickOrderOutcomeList.test.tsx` -> evidence `E7`
- `T9`: focused, after `P8` -> owner: `P8` -> `npm exec -w @shop/web -- vitest run --configLoader runner apps/web/src/features/quickOrder/QuickOrderPage.test.tsx apps/web/src/features/cart/CartPage.test.tsx` -> evidence `E8`
- `T10`: fan-in, once after every lane settles -> owner: `S1` -> `npm exec -w @shop/web -- vitest run --configLoader runner --config apps/web/vitest.integration.config.ts apps/web/src/features/quickOrder/QuickOrderJourney.integration.test.tsx` -> evidence `E9`
- `T11`: fan-in, once -> owner: `S1` -> `npm test -w @shop/api` -> evidence `E10`
- `T12`: fan-in, once -> owner: `S1` -> `npm run test:integration -w @shop/web`; compare against `E0-web-int-baseline` -> evidence `E11`
- `T13`: final gate, once, after every review fix settles -> owner: `G4` -> `npm run verify` -> evidence `E12`
- `T14`: final gate, once, after `T13` -> owner: `G4` -> `npm run test:integration -w @shop/web` -> evidence `E13`. Required because `npm run verify` runs `@shop/web`'s `test` script, which is `test:unit` only, so the web integration tier is invisible to `verify`
- policy: automated repository commands only. No browser session, screenshot, dev-server click-through, `browser-qa` invocation, or visual confirmation appears in any test duty, verification, gate, or review policy. UI behaviour is proven by React integration, route, contract, and unit tests
- reuse: a passing entry stays valid while its covered files, dependencies, contracts, config, and fixtures are unchanged. A new subagent session alone never invalidates evidence. Each agent receives only the entries covering its own scope and is told not to rerun valid commands
- invalidation: `packages/contracts/**` -> rerun `E1` and every downstream typecheck; `productRepository.ts` -> `E2`, `E5`; `quickOrderRules.ts` -> `E3`, `E5`; `quickOrderService.ts` or `auditEvent.ts` -> `E4`, `E5`; `routes/quickOrder.ts` or `app.ts` -> `E5`; `useCart.ts` or `api/quickOrder.ts` -> `E6`, `E9`; `features/quickOrder/**` -> `E7`, `E8`, `E9`; any of the above after `E12` -> rerun the smallest affected command, then `E12` and `E13` only if the change invalidates the final result

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and JSON string values; code, commands, paths, identifiers, and errors preserved exactly
- transport: one canonical JSON object per message, inline; no free text around it; temp artifacts only under the protocol rules
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet + repository instructions + relevant artifact references; never the full plan, source plan, prior reports, global ledger, closed findings, or unrelated packet state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`, at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md` when object arrays become non-empty
- reviewer method: every reviewer assignment sets `review_skill=code-reviewer`
- worktree context: every assignment carries absolute worktree path, implementation branch, and base revision; every repository-relative path resolves under the worktree root
- fix flow: stable reviewer finding ID -> fresh worker assignment with incremented `assignment_revision` plus an `action=fix` directive carrying the finding IDs -> targeted verification -> orchestrator records closure. Never return an implementation fix to the reviewer; never re-review a fix

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator; load source-checkout repository instructions, this plan, canonical contracts, and the current checkpoint.
3. Record source branch and `HEAD`; stop and ask on detached `HEAD` or relevant uncommitted input.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity.
5. Switch the execution root to the worktree; load repository instructions from it.
6. Validate `G0`: select Node 22, run `E0-toolchain`, confirm the seeded catalog assumptions, capture `E0-web-int-baseline`.
7. Launch `P1 || P2` with role-minimum plus worktree context.
8. Accept each report, update the checkpoint and ledger, launch `R1` and `R2` against the exact settled change sets before any consumer starts.
9. Route findings to fresh workers; close on targeted evidence; validate `GR1`, `GR2`, then `G1`.
10. Run the API domain chain `P3 -> R3 -> GR3 -> P4 -> R4 -> GR4 -> P5 -> R5 -> GR5`, gating each packet on the previous review.
11. Validate `G2`; launch `P6 || P7`; review each lane concurrently; validate `GR6`, `GR7`, then `G3`.
12. Run `P8 -> R8 -> GR8`.
13. Run `S1`, its fan-in commands `E9`-`E11`, then `R9` as a separate integration review target; close findings through fresh-worker fixes with targeted evidence.
14. Validate `GR9` and `G4`; run `E12` then `E13` once after all fixes settle.
15. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision, and state that the user owns the merge.

## Risks and Open Questions

- risk: MOQ round-up raises a line past available stock, turning a typed `1` into an `INSUFFICIENT_STOCK` skip that reads as arbitrary -> mitigation: `P7` copy names both the adjusted quantity and the stock shortfall; `P5` covers the case explicitly as a named integration scenario
- risk: an admin-created SKU stored in mixed case never resolves, because matching is uppercase-exact against a binary-collated column -> mitigation: documented as an invariant in `P2` and asserted by its lowercase-lookup test; seeded catalog SKUs are uppercase by the `packages/catalog` format rule. Revisit only if admin SKU entry gains a normalisation rule
- risk: `BLEND_UNAVAILABLE` and `BELOW_MOQ` are present in the contract union but effectively unreachable, and a reader may design against them -> mitigation: TSDoc in `P1` and copy tests in `P7` state exactly when each can occur
- risk: `npm run verify` is green while the web integration tier is red, because `@shop/web`'s `test` script excludes it -> mitigation: `E0-web-int-baseline` at `G0` plus mandatory `E13` at `G4`; `R9` must reject any dismissal of an `E11`/`E13` failure that is not in the baseline
- risk: `P5` fixtures pinned to the assumed seeded SKUs and stock levels rather than verified ones -> mitigation: `P5` is required to confirm against the running seed before pinning; `R5` treats unverified fixture values as a finding
- observation, out of scope: `aggregateBulkAddDemand` keys identities with `\u0000` (`cartBulkAddRules.ts:101`) while `addManyItems` keys the same identities with a space (`cartService.ts:663,703`). Both maps are internally consistent and `configKey` is a hash, so no defect is claimed. Quick Order must not change either; report it to the user rather than fixing it inside this plan
- question: should Quick Order eventually accept a product code or lot name as well as a SKU? -> owner/gate: out of scope here; revisit with Saved Lists (item 13), which shares the same multi-line add path
- question: human smoke check of `/quick-order` at `1920x1080` -> owner: user, after merge. Not a packet duty, not a gate condition, not part of any verification

## Done Criteria

- pasting `SKU, qty` lines at `/quick-order` adds resolvable lots to the cart and returns one outcome per input line
- sub-MOQ quantities are raised to the variant floor on the aggregated per-SKU demand and the adjustment is disclosed per line
- duplicate SKUs merge into one cart line at the summed quantity, judged once, reported on every contributing input line
- unknown SKU, retired lot, malformed line, malformed quantity, and stock shortfall each return their own reason without blocking the lines that applied
- `CART_RESERVED`, `CART_NOT_FOUND`, `NO_INPUT_LINES`, `TOO_MANY_LINES` map to their stated statuses; `Cart not found` prose keeps web cart recovery working
- no schema change and no migration; head stays `028`
- `@shop/contracts` exposes `./quick-order`; `CartService.addMany` and `cartBulkAddRules.ts` are unchanged
- `E1`-`E11` pass; `E12` passes; `E13` shows no failure absent from `E0-web-int-baseline`
- `cart.quick_order_added` is written per successful request with scalar count metadata only
- README documents the entry point and a verified sample paste; `plans/demo_project_high_level_plan.md` records item 14 as completed with landed facts
