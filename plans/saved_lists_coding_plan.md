# Saved Lists Coding Plan

Status: proposed
Source: `plans/demo_project_high_level_plan.md` -> `13. Saved Lists`
Repository baseline: `expansion_002` @ `73993c8` (Quick Order merge). Inspected 2026-08-01.
Plan location: untracked, outside repository -> `C:\Users\iwano\Desktop\repos\demo_project_000-plans\saved_lists_coding_plan.md`

## Runtime Worktree

- source: current branch at runtime -> record branch + `HEAD` before any write
- create: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- execution root: every worker, reviewer, test, fix, convergence action runs inside worktree
- integration: no merge, rebase, cherry-pick, copy-back, worktree removal; user owns integration
- completion reply: absolute worktree path + implementation branch + source branch + base revision
- source checkout stays read-only after worktree creation, except this plan file (already outside repository) and run-scoped temp state

## Objective

Buyer creates named lists of catalog lots (e.g. `Monthly restock`), fills them from product detail, cart, or a past order, then adds a whole list to cart in one action with per-line outcomes. Product-scoped `favourites` domain retires end-to-end; its data converts into a per-user default saved list, and `/wishlist` becomes `/lists`. Nav entry count stays flat.

Complete when: saved-list CRUD + item CRUD + add-to-cart ship behind auth, favourites code and table are gone, seeded demo fixtures exist, and required automated suites pass.

## Scope

### In

- variant-scoped saved lists owned by one user; named, renameable, deletable
- per-user default list ("Favourites") receiving the product-card heart toggle
- list items = `(variantId, quantity)`; server-resolved price + availability on read
- add whole list to cart through `CartService.addMany` with per-item outcomes and MOQ round-up before submission
- fill entry points: product detail "Save to list", cart "Save cart as list", order detail/history "Save order as list"
- migration `029` -> `saved_lists` + `saved_list_items`, convert `favourites` rows, drop `favourites` table
- retirement of `features/favourites/`, `routes/favourites.ts`, `contracts/favourites.ts`, `hooks/useFavourites.ts`, `components/WishlistButton.tsx`, `features/wishlist/`
- account data export + account deletion re-pointed at saved lists
- seed fixture: alice default list plus `Monthly restock` demo list resolving to a mixed add-to-cart result

### Out

- Custom Blend lines in saved lists. Items are stock variants only. `BLEND_UNAVAILABLE` stays structurally present in the shared skip vocabulary and is never emitted, exactly as Quick Order treats it
- manual add-by-item-code on the list page. Belongs to item 14 surface, already landed at `/quick-order`
- list sharing, company-scoped lists, list ordering/reordering, list-level notes
- scheduled or standing orders from a list. Depends on item 8
- substitution offers for a retired lot. Skip and let buyer choose, matching item 12
- new nav slot. `/wishlist` slot is repurposed, not added to
- price-drift disclosure comparing saved price to current price. Lists store no price
- admin surface for saved lists

## Repository Findings

- existing: `apps/api/src/features/cart/cartService.ts` -> `CartService.addMany(cartId, requests, context)` -> `BulkAddResult | 'CART_NOT_FOUND' | 'CART_RESERVED'`; throws when audit or availability deps or `context` missing
- existing: `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BulkAddRequest{key,variantId,quantity,customBlend?}`, `BULK_ADD_SKIP_REASONS` fixed precedence `VARIANT_RETIRED -> BLEND_UNAVAILABLE -> INVALID_QUANTITY -> INSUFFICIENT_STOCK -> BELOW_MOQ`, `aggregateBulkAddDemand` groups on `(variantId, configKey)`, group added at full quantity or not at all
- existing: `apps/api/src/features/quickOrder/` -> closest precedent. `quickOrderRules.ts` owns pre-skip reasons, MOQ round-up via `moqShortfallSacks`, group fan-out, `countQuickOrderOutcomes`; `quickOrderService.ts` wraps one `unitOfWork.run`, calls `addMany`, appends one feature-level audit event
- existing: `apps/api/src/features/reorder/reorderService.ts` -> ownership resolved via `orders.getOwned(orderId,userId)`; missing and not-owned deliberately indistinguishable
- existing: `apps/api/src/features/favourites/favouritesRepository.ts` + `favouritesService.ts` -> product-scoped, no quantity, `ProductRow[]` return
- existing: `apps/api/src/db/migrations/001_initial.ts` -> `favourites(id,user_id,product_id,created_at)`, `UNIQUE(user_id,product_id)`, `ON DELETE CASCADE`
- existing: `apps/api/src/db/migrations/index.ts` -> ordered `migrations` array; head `028_retired_variant_sort_order.ts`; module shape `export const <name>Migration: Migration = { version, name, up(db) }`
- existing: `apps/api/src/db/migrate.ts` -> runner owns transaction, FK suspension, `PRAGMA foreign_key_check` per migration. Migration must not open a transaction nor toggle `foreign_keys`
- existing: `apps/api/src/features/catalog/productRepository.ts` -> `VariantRow`, `VariantWithProductRow extends VariantRow { product_name }`, `findVariantsByIds`, `findVariantsBySkus`, `findVariantById`
- existing: `packages/contracts/src/products.ts` -> `Product.defaultVariantId` (integer >= 1); `products.default_variant_id` backfilled NOT NULL by migration `018`
- existing: `apps/api/src/features/audit/auditEvent.ts` -> closed `AUDIT_ACTIONS` list, closed `AuditEntityType` union, `AuditEventInput` discriminated union, `buildAuditEvent` switch. New action requires all four edits
- existing: `apps/api/src/features/accountExport/dataExportService.ts:38,84` -> deps carry `favourites: FavouritesRepository`, payload field `favourites`
- existing: `packages/contracts/src/accountDepth.ts:74` -> export payload `favourites: Type.Array(Product)`
- existing: `apps/api/src/features/accountDeletion/deletionRepository.ts:99` -> `DELETE FROM favourites WHERE user_id = ?`
- existing: `apps/api/src/db/reset.ts` -> ordered `DELETE FROM` block includes `DELETE FROM favourites`
- existing: `apps/api/src/db/seed.ts:358` -> `ALICE_FAVOURITE_SLUGS`; applied inside the single seed transaction
- existing: `apps/web/src/hooks/useCart.ts` -> `CartAction` union already carries `'reorder'` and `'quick-order'`; private generic `runCartMutation(action, pendingKey, operation, selectCart, retryAfterRecovery)` lands the server `Cart` while returning the full report
- existing: `apps/web/src/hooks/useFavourites.ts` -> no provider; every `WishlistButton` instance issues its own `GET /api/favourites`, toggles do not propagate between instances
- existing: `apps/web/src/components/WishlistButton.tsx` -> dual-purpose heart toggle plus header link to `/wishlist` with count badge; consumed by `ProductCard.tsx:127`, `ProductPurchasePanel.tsx:472`, `Header.tsx:27`
- existing: `apps/web/src/features/reorder/reorderPresentation.ts` and `apps/web/src/features/quickOrder/quickOrderPresentation.ts` -> shared shape: state union, `Record`-keyed reason copy, pure `*Message` selectors, `SKIP_REASONS` derived from the record so a new reason fails typecheck without copy
- existing: `apps/web/src/features/quickOrder/QuickOrderOutcomeList.tsx` -> `role="status" aria-live="polite"`, `className="text-sm empty:hidden"` live region
- existing: `apps/web/src/App.tsx` -> `/wishlist`, `/orders`, `/account*` under `<ProtectedRoute>`; `/quick-order` public; sibling routes, `AccountPage` has no `<Outlet />`
- existing: `apps/web/src/features/cart/CartPage.tsx:37` -> link to `/quick-order`, precedent for a cart-side entry point
- gap: no list, saved-list, or wishlist table or module anywhere in `apps/api` beyond `favourites`
- gap: no route test for favourites; `apps/api/test/favourites/favourites.integration.test.ts` is service+repository only
- gap: no web test for `useFavourites`, `WishlistPage`, or `api/favourites.ts`
- constraint: item 13 must reuse `CartService.addMany`, never fork a second multi-line path
- constraint: cart never clamps to stock nor rounds up to MOQ. MOQ round-up is a feature-side decision made before submission
- constraint: cart resolves clearance-then-tier price at post-add cumulative quantity. Consumers disclose the server figure, never re-derive
- constraint: skip vocabulary is one shared enum. Extend it rather than inventing parallel reasons
- constraint: whole batch runs in one unit of work, requires `AuditContext`, partial success is a domain outcome, reserved cart rejects whole batch with `CART_RESERVED`
- constraint: `npm run verify` does not run web integration tests (`@shop/web` `test` = `test:unit`, which excludes `*.integration.test.{ts,tsx}`). Final gate must run `npm run test:integration` separately
- constraint: migrations immutable and forward-only; runner surfaces unknown versions
- constraint: `packages/contracts/package.json` `exports` map is hand-maintained; a new module needs an entry plus an `index.ts` re-export plus `npm run build -w @shop/contracts`
- constraint: API suites register by glob. Unit -> `apps/api/src/**/*.test.ts`; integration -> `apps/api/test/**/*.integration.test.ts`. Off-convention file never runs
- reuse: `quickOrderRules.ts` group/fan-out/outcome-assembly shape -> `savedListRules.ts`
- reuse: `tradeAccount/deliverySiteRepository.ts` + `deliverySiteService.ts` -> owned-resource repository, `<X>Row`/`<X>Insert`/`<X>Update`, `MAX_DELIVERY_SITES_PER_USER` cap style
- reuse: `<feature>Errors.ts` result triple (`<Feature>ErrorCode`, `<Feature>Result<T>`, `<feature>Ok`, `<feature>Error`)
- reuse: `routes/reorder.ts` + `routes/quickOrder.ts` code-bearing error body style -> `Type.Object({ code, error })` plus `MESSAGES`/`STATUS` records
- reuse: `apps/web/src/hooks/useCart.ts` `runCartMutation` -> new `addSavedListToCart`

## Decisions and Invariants

- absorption is full. `favourites` retires end-to-end. No parallel legacy implementation survives the run
- a saved list belongs to exactly one user. Every read and write resolves on `(userId, listId)`. Absent and not-owned both return `LIST_NOT_FOUND`
- exactly one default list per user, enforced by partial unique index `WHERE is_default = 1`. Default list is renameable but not deletable -> `DEFAULT_LIST_IMMUTABLE`
- default list is created lazily on first write that needs it, never eagerly for every user
- item identity is `(saved_list_id, variant_id)`. Adding an existing variant updates its quantity rather than inserting a second row
- item quantity is a stored positive safe integer. It is never validated against MOQ or stock at save time; a list may legitimately hold an amount the cart would reject
- add-to-cart rounds each item quantity up to the MOQ floor before submission using `moqShortfallSacks`, reports `moqAdjusted`, and never rounds down. Identical to Quick Order
- add-to-cart submits one `BulkAddRequest` per item, keyed by `String(itemId)`. Item identity uniqueness means no two requests share a `(variantId, '')` identity, so cart aggregation is a no-op for this caller and outcomes map one-to-one
- price is never stored on a list. List reads resolve unit price and `perTonneCents` server-side through the same clearance -> tier composition the cart uses; a retired variant resolves to `null`
- items referencing a retired variant stay in the list and are marked inactive on read. They skip as `VARIANT_RETIRED` on add-to-cart. No substitution is offered
- skip vocabulary is the cart's, unchanged: `VARIANT_RETIRED`, `BLEND_UNAVAILABLE`, `INVALID_QUANTITY`, `INSUFFICIENT_STOCK`, `BELOW_MOQ`. No new reason is introduced
- names are trimmed, collapsed on internal whitespace, 1-80 chars, unique per user case-insensitively -> `NAME_TAKEN` / `NAME_INVALID`
- caps: `MAX_SAVED_LISTS_PER_USER = 25`, `MAX_ITEMS_PER_SAVED_LIST = 200`. Exceeding -> `LIST_LIMIT_REACHED` / `ITEM_LIMIT_REACHED`. Pre-checked in the service so no raw `SQLITE_CONSTRAINT` reaches a route
- every list mutation and the add-to-cart action run in one `unitOfWork.run` and append an audit event. Add-to-cart appends its own `cart.saved_list_added` alongside the cart's per-line `cart.product_added` events, matching reorder
- add-to-cart uses `requireCustomer` (write against the buyer's own cart, matching `routes/reorder.ts`). All other saved-list endpoints use `requireAuth`
- account deletion removes saved lists and items. Account export includes them in place of `favourites`
- migration `029` converts each favourite to `(default list, products.default_variant_id, MOQ-floor quantity)`. A favourite whose product has no active default variant is dropped; local SQLite is disposable and this is recorded as intended loss
- migration `029` hardcodes the 25000 g sack constant as frozen historical value rather than importing `SACK_WEIGHT_GRAMS`, so replaying history stays reproducible
- assumption (validate at `G0`): the merged Quick Order work at `73993c8` is final and unmodified. If `features/quickOrder/` or `cartBulkAddRules.ts` changed after `73993c8`, re-read both before `P4`
- assumption (validate at `P1`): no migration `029` was reserved by concurrent work. Confirm `migrations/index.ts` head is `028` inside the worktree before writing

## Target Design

### Schema (migration `029_saved_lists.ts`)

- `saved_lists(id INTEGER PK AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80), is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `saved_list_items(id INTEGER PK AUTOINCREMENT, saved_list_id INTEGER NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE, variant_id INTEGER NOT NULL REFERENCES product_variants(id), quantity INTEGER NOT NULL CHECK(quantity >= 1), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `CREATE UNIQUE INDEX saved_lists_user_name_idx ON saved_lists(user_id, name COLLATE NOCASE)`
- `CREATE UNIQUE INDEX saved_lists_user_default_idx ON saved_lists(user_id) WHERE is_default = 1`
- `CREATE UNIQUE INDEX saved_list_items_list_variant_idx ON saved_list_items(saved_list_id, variant_id)`
- `CREATE INDEX saved_list_items_variant_idx ON saved_list_items(variant_id)`
- conversion, in one `up`: for each distinct `favourites.user_id` insert default list named `Favourites`; for each favourite row join `products.default_variant_id -> product_variants` and insert an item at MOQ-floor quantity `(moq_sacks * 25000 + weight_grams - 1) / weight_grams`; skip rows with null or inactive default variant
- `DROP TABLE favourites` last, then local `assertForeignKeysClean(db)`
- ordering for reads: `saved_lists` by `is_default DESC, name COLLATE NOCASE ASC`; `saved_list_items` by `created_at DESC, id DESC`

### Contracts (`packages/contracts/src/savedLists.ts`, subpath `./saved-lists`)

- `SavedListSummary { listId, name, isDefault, itemCount, createdAt, updatedAt }`
- `SavedListItem { itemId, variantId, sku, label, productId, productName, quantity, weightGrams, moqSacks, unitPriceCents|null, perTonneCents|null, availableToSell, backorderable, active }`
- `SavedListDetail` = summary fields plus `items: SavedListItem[]`
- `SavedListsResponse = Type.Array(SavedListSummary)`
- bodies: `CreateSavedListBody{name}`, `RenameSavedListBody{name}`, `AddSavedListItemBody{variantId,quantity}`, `UpdateSavedListItemBody{quantity}`, `AddSavedListToCartBody{cartId}`, `SaveCartAsListBody{name,cartId}`, `SaveOrderAsListBody{name}`
- params: `SavedListIdParam{listId}`, `SavedListItemIdParam{listId,itemId}` using `PositiveIntegerString`
- `SavedListSkipReason` = union of the five cart reasons, `BLEND_UNAVAILABLE` documented as structurally present and never produced
- `SavedListLineOutcome` = fields object intersected with a `TypeSystem.Type` status/reason pair validator, mirroring `ReorderLineOutcome` and `QuickOrderLineOutcome`. Fields: `itemId, variantId, sku, productId, productName, savedQuantity, submittedQuantity, moqAdjusted, resolvedUnitPriceCents|null, status, reason|null`
- `SavedListAddToCartResponse { cart, addedLineCount, skippedLineCount, outcomes }`, cart closed with `Type.Object(Cart.properties, { additionalProperties: false })` as Quick Order does

### API domain (`apps/api/src/features/savedLists/`, proposed)

- `savedListErrors.ts` -> `SavedListErrorCode` = `LIST_NOT_FOUND | ITEM_NOT_FOUND | NAME_INVALID | NAME_TAKEN | LIST_LIMIT_REACHED | ITEM_LIMIT_REACHED | VARIANT_NOT_FOUND | DEFAULT_LIST_IMMUTABLE | CART_NOT_FOUND | CART_RESERVED | CART_EMPTY | ORDER_NOT_FOUND`; plus `SavedListResult<T>`, `savedListOk`, `savedListError`
- `savedListRules.ts` -> pure: `normalizeListName`, `MAX_SAVED_LISTS_PER_USER`, `MAX_ITEMS_PER_SAVED_LIST`, `buildSavedListDemand(items, variantById)` (MOQ round-up, `moqAdjusted`, drops items with no live variant into a pre-classified skip), `toSavedListBulkAddRequests(groups)`, `assembleSavedListOutcomes(items, groups, bulkOutcomes, variantById)`, `countSavedListOutcomes`
- `savedListRepository.ts` -> `SavedListRow`, `SavedListItemRow`, `SavedListRepository` with `listForUser`, `findOwned(userId,listId)`, `findDefault(userId)`, `createList`, `renameList`, `deleteList`, `countLists(userId)`, `listItems(listId)`, `countItems(listId)`, `findItem(listId,itemId)`, `upsertItem(listId,variantId,quantity)`, `updateItemQuantity`, `deleteItem`, `deleteAllForUser(userId)`; `COLUMNS` const; row -> contract mappers
- `savedListService.ts` -> `createSavedListService({ repository, variants, inventory, carts, orders, unitOfWork, audit, clock })`. Commands: `list`, `get`, `create`, `rename`, `remove`, `addItem`, `updateItem`, `removeItem`, `ensureDefault`, `addToCart`, `createFromCart`, `createFromOrder`
- `addToCart` flow: `unitOfWork.run` -> load owned list + items -> `findVariantsByIds` -> `buildSavedListDemand` -> `carts.addMany` -> map rejection to `CART_NOT_FOUND`/`CART_RESERVED` -> `assembleSavedListOutcomes` -> `countSavedListOutcomes` -> append `cart.saved_list_added` -> `savedListOk(report)`
- `createFromCart` reads the cart through `carts.get(cartId)`, ignores blend lines (out of scope) and empty carts (`CART_EMPTY`), and writes one item per stock line at its cart quantity
- `createFromOrder` resolves ownership through `orders.getOwned(orderId, userId)`, converts resolvable stock lines only, and reports nothing per line; an unresolvable line is simply absent from the new list

### Audit (`apps/api/src/features/audit/auditEvent.ts`)

- new actions: `saved_list.created`, `saved_list.renamed`, `saved_list.deleted`, `saved_list.item_added`, `saved_list.item_updated`, `saved_list.item_removed`, `cart.saved_list_added`
- new `AuditEntityType` member `saved_list`
- `cart.saved_list_added` entity resolves to the cart, matching `cart.reorder_added` and `cart.quick_order_added`; metadata `savedListId`, `itemCount`, `addedLineCount`, `skippedLineCount`
- every `saved_list.*` action resolves entity `saved_list` / `String(savedListId)`

### Routes (`apps/api/src/routes/savedLists.ts`, proposed)

- `GET /api/saved-lists` -> `SavedListsResponse`
- `POST /api/saved-lists` -> 201 `SavedListDetail`
- `GET /api/saved-lists/:listId` -> `SavedListDetail`
- `PATCH /api/saved-lists/:listId` -> `SavedListDetail`
- `DELETE /api/saved-lists/:listId` -> `SuccessResponse`
- `POST /api/saved-lists/:listId/items` -> `SavedListDetail`
- `PATCH /api/saved-lists/:listId/items/:itemId` -> `SavedListDetail`
- `DELETE /api/saved-lists/:listId/items/:itemId` -> `SavedListDetail`
- `POST /api/saved-lists/:listId/add-to-cart` -> `SavedListAddToCartResponse`, `requireCustomer`
- `POST /api/saved-lists/from-cart` -> 201 `SavedListDetail`
- `POST /api/saved-lists/from-order/:orderId` -> 201 `SavedListDetail`
- status map: `LIST_NOT_FOUND|ITEM_NOT_FOUND|VARIANT_NOT_FOUND|CART_NOT_FOUND|ORDER_NOT_FOUND` -> 404; `NAME_INVALID|CART_EMPTY` -> 400; `NAME_TAKEN|LIST_LIMIT_REACHED|ITEM_LIMIT_REACHED|DEFAULT_LIST_IMMUTABLE|CART_RESERVED` -> 409
- `CART_NOT_FOUND` prose stays exactly `Cart not found`; web client detects a vanished cart by that wording

### Web

- `apps/web/src/api/savedLists.ts` -> thin free functions over `apiFetch`, `encodeURIComponent` on path params
- `apps/web/src/hooks/SavedListsContext.tsx` + `useSavedLists.ts` -> one provider mounted in `Layout.tsx`, replacing the per-instance refetch behavior of `useFavourites`. Exposes `lists`, `defaultList`, `savedVariantIds`, `toggleDefaultSave(variantId)`, `createList`, `addItem`, `refresh`, `loading`, `error`
- `apps/web/src/hooks/useCart.ts` -> `CartAction` gains `'saved-list-add'`; new `addSavedListToCart(listId)` built on `runCartMutation` with `selectCart: (response) => response.cart`, returning `SavedListAddToCartResponse | false`
- `apps/web/src/features/savedLists/` -> `SavedListsPage.tsx` (`/lists`), `SavedListDetailPage.tsx` (`/lists/:listId`), `SavedListOutcomeList.tsx`, `savedListsPresentation.ts`, `SavedListPicker.tsx` (shared choose-or-create dialog)
- entry points -> `components/SaveToListButton.tsx` (heart toggle on `ProductCard`, writes default list via `product.defaultVariantId`), `features/savedLists/AddToListMenu.tsx` (variant-aware, on `ProductPurchasePanel`), `SaveCartAsListButton.tsx` (on `CartPage`), `SaveOrderAsListButton.tsx` (on order history rows and order detail)
- shell -> `Header.tsx` swaps the wishlist control for a `/lists` link with default-list count; `AccountMenu.tsx` gains "Saved Lists"; `AccountPage.tsx` "View Wishlist" -> "View Saved Lists"; `nav/navItems.ts` `wishlistItem` -> `savedListsItem`
- routing -> `/lists` and `/lists/:listId` under `<ProtectedRoute>`; `/wishlist` becomes `<Navigate to="/lists" replace />` so existing bookmarks resolve

### Seed

- `apps/api/src/db/savedListSeed.ts` (proposed) -> `seedSavedLists(db)`, module-local `SEED_INSTANT`, `findUserId(db, email)` guard-and-return, idempotent inserts, called from `seedDatabase` inside the existing transaction
- alice default list `Favourites` -> default variants of `all-purpose-flour`, `whey-protein-isolate`, `matcha-green-tea-powder`, replacing `ALICE_FAVOURITE_SLUGS`
- alice demo list `Monthly restock` -> deliberately mixed add-to-cart result: one item below its MOQ floor (adds with `moqAdjusted true`), one item on a retired variant (`VARIANT_RETIRED`), one item exceeding available stock on a non-backorderable variant (`INSUFFICIENT_STOCK`), one ordinary item

## Execution Graph

`G0 -> {P1 -> R1 -> GR1 || P2 -> R2 -> GR2 || P3 -> R3 -> GR3} -> G1 -> {P4 -> R4 -> GR4 || P5 -> R5 -> GR5} -> G2 -> P6 -> R6 -> GR6 -> {P7 -> R7 -> GR7 || P8 -> R8 -> GR8 -> P9 -> R9 -> GR9 -> P10 -> R10 -> GR10} -> G3 -> P11 -> R11 -> GR11 -> S1 -> R12 -> GR12 -> G4`

- `G0`: worktree created and verified from recorded source branch `HEAD`; `migrations/index.ts` head is `028`; `features/quickOrder/` and `cartBulkAddRules.ts` unchanged since `73993c8`; `npm ci` health checks pass (`npm exec -- tsx --version`, `npm run typecheck -w @shop/api`)
- `GR1`,`GR2`,`GR3`: producer review gates. High-risk producers (schema, contracts, audit vocabulary). No consumer launches before all three pass or close findings
- `G1`: reviewed producer fan-in. `P4` and `P5` may launch
- `GR4`,`GR5`: domain and seed review gates
- `G2`: reviewed fan-in of domain + seed. `P6` may launch
- `GR6`: route + wiring review gate. Blocks every retirement and web packet
- `GR7`..`GR10`: lane review gates. `P11` waits on both `GR7` and `GR10`
- `G3`: API retirement and full web lane reviewed
- `GR11`: shared-contract deletion review gate
- `S1`: convergence, docs, final suites
- `GR12`: convergence review gate
- `G4`: completion gate. Final suites green after all fixes settle

## Work Packets

### P1: Schema, migration `029`, reset and schema tests

- mode: parallel with `P2`, `P3` after `G0`
- depends on: `G0`
- owns: `apps/api/src/db/migrations/029_saved_lists.ts`, `apps/api/src/db/migrations/index.ts`, `apps/api/src/db/reset.ts`, `apps/api/src/db/seed.ts`, `apps/api/test/db/savedListsSchema.integration.test.ts`, `apps/api/test/db/migrations.integration.test.ts`
- reads:
  - `apps/api/src/db/migrations/026_company_accounts_approvals.ts` -> whole file -> table/index/check conventions, local `assertForeignKeysClean`, `MigrationDb` alias
  - `apps/api/src/db/migrations/028_retired_variant_sort_order.ts` -> whole file -> idempotency guard style, index recreation
  - `apps/api/src/db/migrations/001_initial.ts` -> `favourites` table definition -> source shape for conversion
  - `apps/api/src/db/migrations/018_grounded_catalog_variants.ts` -> `default_variant_id` backfill -> guarantees the conversion join has a target
  - `apps/api/src/db/migrate.ts` -> `Migration`, `migrateDatabase` -> runner owns transaction and FK suspension
  - `apps/api/src/db/reset.ts` -> `resetDatabase` delete ordering and doc comment
  - `apps/api/src/db/seed.ts` -> `ALICE_FAVOURITE_SLUGS` and its application block -> removal target only
  - `apps/api/test/db/migrations.integration.test.ts` -> `expectedVersions` -> extend to `029`
  - `packages/contracts/src/pricing.ts` -> `SACK_WEIGHT_GRAMS` -> value to freeze as a literal, not to import
- acceptance: fresh database migrates to `029`; a database seeded at `028` with favourite rows migrates into a default list per affected user with MOQ-floor quantities; `favourites` table absent afterwards; `PRAGMA foreign_key_check` clean; `resetDatabase` and `seedDatabase` run without referencing `favourites`
- non-goals: no repository, service, route, contract, or seed fixture for saved lists; no favourites service or route removal
- upstream inputs: none
- changes:
  - add `029_saved_lists.ts` exporting `savedListsMigration: Migration` with `version '029'`, `name 'saved lists'`
  - create both tables and all four indexes exactly as specified in Target Design
  - convert favourites -> default list per user -> items at MOQ-floor quantity; skip rows whose product has no active default variant
  - `DROP TABLE favourites`; call local `assertForeignKeysClean(db)`
  - register the migration last in `migrations/index.ts`
  - replace `DELETE FROM favourites` in `reset.ts` with `DELETE FROM saved_list_items;` then `DELETE FROM saved_lists;` in FK-safe position, and update the ordering doc comment
  - delete `ALICE_FAVOURITE_SLUGS` and its seeding block from `seed.ts`; leave a placeholder for `P5` only if the file would otherwise not compile
  - extend `expectedVersions` with `'029'`
  - add `test/db/savedListsSchema.integration.test.ts` covering: fresh migrate creates both tables and indexes; pre-`029` database with favourites converts (row counts, quantity equals MOQ floor, default list named `Favourites`, `is_default = 1`); favourite with inactive default variant is dropped; second `migrateDatabase` call is a no-op; `favourites` table gone; partial unique default index rejects a second default list for one user
- invariants: migration opens no transaction and toggles no `foreign_keys`; landed migrations `001`-`028` are untouched; sack weight appears as a frozen literal with a comment
- relevant evidence: none
- test duty: `npm exec -w @shop/api -- tsx --test test/db/savedListsSchema.integration.test.ts test/db/migrations.integration.test.ts test/db/seed.integration.test.ts` -> `E1`
- verification: `E1` passes; no browser, screenshot, or manual step
- handoff: table and column names, index names, conversion semantics, migration head `029`
- review: `R1` -> `GR1` blocks `P4`, `P5`, `P6`

### P2: Saved Lists transport contracts

- mode: parallel with `P1`, `P3` after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/savedLists.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/savedLists.test.ts`
- reads:
  - `packages/contracts/src/quickOrder.ts` -> whole file -> outcome fields object, `TypeSystem.Type` status/reason pair, closed cart object, `Static` export pairing
  - `packages/contracts/src/reorder.ts` -> `ReorderLineOutcome`, `ReorderSkipReason` -> shared skip vocabulary wording and doc comments
  - `packages/contracts/src/tradeAccount.ts` -> body and param schema style for owned-resource CRUD
  - `packages/contracts/src/common.ts` -> `MoneyCents`, `PositiveIntegerString`
  - `packages/contracts/src/cart.ts` -> `Cart` -> properties reused for the closed response cart
  - `packages/contracts/package.json` -> `exports` map -> subpath entry shape
  - `packages/contracts/src/index.ts` -> re-export convention
- acceptance: `@shop/contracts/saved-lists` resolves after build and exports every schema and type named in Target Design; contracts build and unit tests pass; existing subpaths unchanged
- non-goals: no change to `accountDepth.ts`; no deletion of `favourites.ts`; no API or web consumer edits
- upstream inputs: none
- changes:
  - add `savedLists.ts` with summary, item, detail, list response, request bodies, params, skip reason union, line outcome intersection, add-to-cart response
  - document `BLEND_UNAVAILABLE` as structurally present and never produced by this feature
  - add `"./saved-lists"` to the `exports` map pointing at `./dist/savedLists.{d.ts,js}`
  - re-export from `index.ts` following existing convention
  - add `test/savedLists.test.ts` covering: added outcome with a non-null reason is rejected; skipped outcome with a null reason is rejected; unknown property on the response cart is rejected; `quantity` below 1 is rejected; name over 80 chars is rejected
- invariants: additive only; no existing contract symbol renamed, removed, or re-typed
- relevant evidence: none
- test duty: `npm run build -w @shop/contracts` then `npm test -w @shop/contracts` -> `E2`
- verification: `E2` passes; `npm run typecheck -w @shop/contracts` clean
- handoff: exact schema and type names, subpath specifier, outcome field list
- review: `R2` -> `GR2` blocks `P4`, `P6`, `P8`

### P3: Audit vocabulary for saved lists

- mode: parallel with `P1`, `P2` after `G0`
- depends on: `G0`
- owns: `apps/api/src/features/audit/auditEvent.ts`, `apps/api/src/features/audit/auditEvent.test.ts`
- reads:
  - `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEntityType`, `AuditEventInput`, `buildAuditEvent` -> all four edit sites
  - `apps/api/src/features/audit/auditEvent.test.ts` -> existing `cart.reorder_added` / `cart.quick_order_added` cases -> test shape to mirror
- acceptance: the seven new actions build valid audit events with correct entity type and id; metadata validation still rejects nested or oversized values; existing action cases unchanged
- non-goals: no repository, query, route, or admin audit-read change; no service emits these actions yet
- upstream inputs: none
- changes:
  - append the seven actions to `AUDIT_ACTIONS`
  - add `saved_list` to `AuditEntityType`
  - add discriminated `AuditEventInput` members: `saved_list.*` carrying `savedListId` plus action-specific scalars; `cart.saved_list_added` carrying `cartId`, `savedListId`, `itemCount`, `addedLineCount`, `skippedLineCount`
  - add `buildAuditEvent` switch cases resolving `saved_list.*` -> `('saved_list', String(savedListId))` and `cart.saved_list_added` -> `('cart', cartId)`
  - extend `auditEvent.test.ts` with one case per new action asserting entity type, entity id, and metadata shape
- invariants: action list stays closed and append-only in position; no existing action reordered or renamed; metadata stays flat `string | number` within the 2048-byte limit
- relevant evidence: none
- test duty: `npm exec -w @shop/api -- tsx --test src/features/audit/auditEvent.test.ts` -> `E3`
- verification: `E3` passes
- handoff: exact action strings and metadata field names for `P4`
- review: `R3` -> `GR3` blocks `P4`

### P4: Saved Lists domain — repository, rules, service, errors

- mode: parallel with `P5` after `G1`
- depends on: `P1`, `P2`, `P3`, `G1`
- owns: `apps/api/src/features/savedLists/savedListErrors.ts`, `apps/api/src/features/savedLists/savedListRules.ts`, `apps/api/src/features/savedLists/savedListRules.test.ts`, `apps/api/src/features/savedLists/savedListRepository.ts`, `apps/api/src/features/savedLists/savedListService.ts`, `apps/api/test/savedLists/savedListService.integration.test.ts`
- reads:
  - `apps/api/src/features/quickOrder/quickOrderRules.ts` -> `buildQuickOrderDemand`, `canRoundUpMoq`, `toQuickOrderBulkAddRequests`, `assembleQuickOrderOutcomes`, `countQuickOrderOutcomes` -> demand, round-up, fan-out, outcome assembly shape
  - `apps/api/src/features/quickOrder/quickOrderService.ts` -> whole file -> single `unitOfWork.run`, `addMany` call, rejection mapping, feature-level audit append
  - `apps/api/src/features/quickOrder/quickOrderErrors.ts` -> result triple shape
  - `apps/api/src/features/reorder/reorderService.ts` -> `orders.getOwned` ownership gate, narrow reader interface style
  - `apps/api/src/features/tradeAccount/deliverySiteRepository.ts` + `deliverySiteService.ts` -> owned-resource repository, `COLUMNS`, `<X>Row`/`<X>Insert`/`<X>Update`, cap const, `unitOfWork.run` usage
  - `apps/api/src/features/cart/cartService.ts` -> `CartService.addMany`, `BulkAddResult`, `BulkAddRejection`, `getCart` -> exact call surface for add-to-cart and create-from-cart
  - `apps/api/src/features/cart/cartBulkAddRules.ts` -> `BulkAddRequest`, `BulkAddOutcome`, `BULK_ADD_SKIP_REASONS` -> shared vocabulary and per-key correlation
  - `apps/api/src/features/pricing/pricingRules.ts` -> `moqShortfallSacks`, `resolveUnitPriceCents`, `perTonneCents`, `validateMoq`
  - `apps/api/src/features/pricing/clearanceRules.ts` -> `resolveClearance` -> clearance-then-tier composition for list reads
  - `apps/api/src/features/catalog/productRepository.ts` -> `VariantRow`, `VariantWithProductRow`, `findVariantsByIds` -> hydration source
  - `apps/api/src/features/inventory/inventoryService.ts` -> `availableToSell` signature -> availability on list reads
  - `apps/api/src/features/orders/orderService.ts` -> `getOwned` signature and `OrderLineItem` shape -> create-from-order source
  - `apps/api/src/db/unitOfWork.ts` -> `UnitOfWork`
  - `apps/api/src/features/audit/auditService.ts` -> `AuditWriter`, `Clock`
- acceptance: every command in Target Design returns a `SavedListResult`; ownership resolves on `(userId, listId)` with `LIST_NOT_FOUND` for both absent and foreign; caps and name rules pre-checked; `addToCart` produces one outcome per item with MOQ round-up applied and server-resolved prices reused from cart outcomes; no raw SQLite constraint error escapes
- non-goals: no route file, no `app.ts` wiring, no favourites removal, no contract edits, no seed
- upstream inputs:
  - `P1` -> accepted change set -> table names, column names, index guarantees, migration head `029`
  - `P2` -> accepted change set -> `@shop/contracts/saved-lists` schema and type names
  - `P3` -> accepted change set -> exact audit action strings and metadata field names
- changes:
  - `savedListErrors.ts` -> code union, `SavedListResult<T>`, `savedListOk`, `savedListError`
  - `savedListRules.ts` -> `normalizeListName`, caps, `SavedListDemandGroup`, `buildSavedListDemand`, `toSavedListBulkAddRequests`, `assembleSavedListOutcomes`, `countSavedListOutcomes`; keep every function pure and clock-injected
  - `savedListRepository.ts` -> rows, `COLUMNS`, every method listed in Target Design, transport mappers, deterministic ordering
  - `savedListService.ts` -> `createSavedListService(deps)` with narrow reader interfaces (`SavedListVariantReader`, `SavedListOrderReader`); each command wraps `unitOfWork.run` and appends its audit event
  - `savedListRules.test.ts` -> name normalization and rejection boundaries; cap boundaries at exactly the limit and one over; MOQ round-up at exact floor, one below floor, and already above; overflow-unsafe quantity classified `INVALID_QUANTITY`; retired variant pre-classified `VARIANT_RETIRED` without reaching the cart; outcome assembly preserves item order and one-to-one key mapping; counts derive from item outcomes
  - `savedListService.integration.test.ts` -> SQLite-backed: create/rename/delete with ownership isolation between two users; default list lazily created once; default list rename allowed, delete rejected; duplicate name rejected case-insensitively; `upsertItem` on an existing variant updates quantity instead of inserting; `addToCart` mixed result (one added, one `VARIANT_RETIRED`, one `INSUFFICIENT_STOCK`, one MOQ-adjusted add); `addToCart` against a reserved cart returns `CART_RESERVED` and adds nothing; `addToCart` against a missing cart returns `CART_NOT_FOUND`; `createFromCart` on an empty cart returns `CART_EMPTY`; `createFromOrder` on a foreign order returns `ORDER_NOT_FOUND`
- invariants: `CartService.addMany` is the only multi-line cart path; skip vocabulary is not extended; quantity is never clamped down; a whole batch runs in one unit of work; every mutation carries an `AuditContext`; list reads resolve price server-side and never trust a stored figure
- relevant evidence: `E1` -> schema shape; `E2` -> contract shape; `E3` -> audit vocabulary
- test duty: `npm exec -w @shop/api -- tsx --test src/features/savedLists/savedListRules.test.ts` -> `E4`; `npm exec -w @shop/api -- tsx --test test/savedLists/savedListService.integration.test.ts` -> `E5`
- verification: `E4`, `E5` pass; `npm run typecheck -w @shop/api` clean
- handoff: `SavedListService` interface, error code union, report shape for the route layer
- review: `R4` -> `GR4` blocks `P6`

### P5: Seed fixtures for saved lists

- mode: parallel with `P4` after `G1`
- depends on: `P1`, `G1`
- owns: `apps/api/src/db/savedListSeed.ts`, `apps/api/src/db/seed.ts`, `apps/api/test/db/seed.integration.test.ts`
- reads:
  - `apps/api/src/db/companyAccountsSeed.ts` -> whole file -> module shape, `SEED_INSTANT`, `findUserId` guard, idempotent inserts
  - `apps/api/src/db/orderSeedScenarios.ts` -> `DEMO_ORDER_SCENARIO_KEYS`, `alice-reorder-mix` construction -> mixed-outcome fixture precedent
  - `apps/api/src/db/seed.ts` -> `USERS`, `seedDatabase` transaction body, existing `seed*Scenarios` call sites
  - `apps/api/src/db/migrations/029_saved_lists.ts` -> table and column names
  - `apps/api/test/db/seed.integration.test.ts` -> existing count assertions and scoping style
- acceptance: `npm run seed` twice in a row is idempotent; alice owns exactly two lists after seed; `Monthly restock` contains items that produce at least one added, one `moqAdjusted` add, one `VARIANT_RETIRED` skip, and one `INSUFFICIENT_STOCK` skip when added to a fresh cart
- non-goals: no service, route, contract, or web change; no fixture for any user other than alice
- upstream inputs: `P1` -> accepted change set -> table and column names, conversion semantics
- changes:
  - add `savedListSeed.ts` exporting `seedSavedLists(db)` with module-local `SEED_INSTANT`, `findUserId(db, email)` returning early when the user is absent, and `INSERT ... WHERE NOT EXISTS` idempotency
  - seed alice default list `Favourites` from the three former favourite slugs via `products.default_variant_id`
  - seed alice `Monthly restock` with four deliberately chosen variants covering the four outcome shapes; select the retired and low-stock variants from existing seeded fixtures rather than creating new catalog rows
  - call `seedSavedLists(db)` from `seedDatabase` inside the existing transaction, beside `seedOrderScenarios(db)`
  - extend `test/db/seed.integration.test.ts` with saved-list assertions scoped to alice's email, never to absolute row ids
- invariants: seed stays idempotent and deterministic; no new catalog product or variant is introduced; assertions scope to test-owned identifiers
- relevant evidence: `E1` -> schema and conversion
- test duty: `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts` -> `E6`
- verification: `E6` passes; `npm run reset` completes without error
- handoff: fixture list names and the variant selection backing each intended outcome
- review: `R5` -> `GR5` blocks `G2`

### P6: Saved Lists routes and composition wiring

- mode: sequential after `G2`
- depends on: `P4`, `P5`, `G2`
- owns: `apps/api/src/routes/savedLists.ts`, `apps/api/src/app.ts`, `apps/api/test/savedLists/savedListRoutes.integration.test.ts`, `apps/api/test/savedLists/savedListAddToCart.integration.test.ts`
- reads:
  - `apps/api/src/routes/quickOrder.ts` -> whole file -> code-bearing error body, `MESSAGES`/`STATUS` records, `toTransportOutcome`
  - `apps/api/src/routes/reorder.ts` -> whole file -> `requireCustomer` rationale, `auditContext(userId, request.id)`, `Cart not found` prose contract
  - `apps/api/src/routes/tradeAccount.ts` -> whole file -> owned-resource CRUD route shape, param conversion, full response-status maps
  - `apps/api/src/app.ts` -> `AppServices`, `createAppServices`, hoisted `cartService`, `buildApp` registration block
  - `apps/api/src/plugins/auth.ts` -> `requireAuth`, `requireCustomer`
  - `apps/api/src/utils/errors.ts` -> `sendNotFound`, `sendConflict`, `sendBadRequest`
  - `apps/api/test/reorder/reorderRoutes.integration.test.ts` -> harness: temp dir, `openDatabase`, `buildApp`, `app.inject`, `cookieHeader`, `login`, `Value.Parse`
  - `apps/api/test/tradeAccount/tradeAccountRoutes.integration.test.ts` -> ownership-isolation assertions across two users
- acceptance: all eleven endpoints respond with the declared schemas; anonymous requests get 401; a second user gets 404 on another user's list and item; add-to-cart returns per-item outcomes plus the updated cart; reserved cart returns 409 with code `CART_RESERVED`; missing cart returns 404 with prose exactly `Cart not found`
- non-goals: no favourites removal, no accountExport/accountDeletion change, no `accountDepth` contract change, no web change
- upstream inputs:
  - `P4` -> accepted change set -> `SavedListService` interface and error code union
  - `P2` -> accepted change set -> contract schema names
  - `P5` -> accepted change set -> seeded fixture names available to route tests
- changes:
  - add `routes/savedLists.ts` with the eleven routes, `SavedListErrorResponse` code-bearing schema, `SAVED_LIST_ERROR_MESSAGES`, `SAVED_LIST_ERROR_STATUS`, `auditContext`, explicit `toTransport*` mappers
  - add `savedLists: SavedListService` to `AppServices`; construct it in `createAppServices` from the hoisted `cartService`, the shared `unitOfWork`, `audit`, `clock`, `products` repository, `inventory`, and `orders`; register `savedListRoutes` in `buildApp`
  - leave existing favourites wiring untouched
  - add `savedListRoutes.integration.test.ts`: unauthenticated 401 on every route; CRUD happy path; cross-user 404 on list and item; duplicate name 409; cap boundary 409 at exactly one over; default-list delete 409; `from-cart` on empty cart 400; `from-order` on foreign order 404; response bodies validated with `Value.Parse`
  - add `savedListAddToCart.integration.test.ts`: mixed outcome result from the seeded `Monthly restock` fixture; MOQ round-up reported as `moqAdjusted` with `submittedQuantity > savedQuantity`; retired variant skip; insufficient stock skip; reserved cart 409 adding nothing; missing cart 404 with exact prose; two adds of the same list accumulate the cart line and return the higher resolved quantity; `resolvedUnitPriceCents` present on every added outcome
- invariants: domain shape never reaches the wire unmapped; routes stay thin; `CART_NOT_FOUND` prose is exact; add-to-cart is the only route using `requireCustomer`; every response status is declared in the schema
- relevant evidence: `E4`, `E5` -> domain behavior; `E6` -> seeded fixtures; `E2` -> contract shape
- test duty: `npm exec -w @shop/api -- tsx --test test/savedLists/savedListRoutes.integration.test.ts test/savedLists/savedListAddToCart.integration.test.ts` -> `E7`
- verification: `E7` passes; `npm run typecheck -w @shop/api` clean
- handoff: live endpoint paths, request/response shapes, error codes and statuses for the web client
- review: `R6` -> `GR6` blocks `P7` and `P8`

### P7: API-side favourites retirement

- mode: parallel with the web lane (`P8` -> `P9` -> `P10`) after `GR6`
- depends on: `P6`, `GR6`
- owns: `apps/api/src/features/favourites/` (deleted), `apps/api/src/routes/favourites.ts` (deleted), `apps/api/test/favourites/` (deleted), `apps/api/src/features/accountExport/dataExportService.ts`, `apps/api/src/features/accountDeletion/deletionRepository.ts`, `packages/contracts/src/accountDepth.ts`, `apps/api/test/accountExport/dataExport.integration.test.ts`, `apps/api/test/accountDeletion/deletion.integration.test.ts`, `apps/api/test/http/app.integration.test.ts`
- reads:
  - `apps/api/src/features/accountExport/dataExportService.ts` -> `favourites` dependency and payload field -> replacement sites
  - `apps/api/src/features/accountDeletion/deletionRepository.ts:99` -> favourites delete statement -> replacement site
  - `packages/contracts/src/accountDepth.ts` -> export payload object -> field swap
  - `apps/api/src/app.ts` -> `AppServices` favourites wiring and route registration -> removal sites
  - `apps/api/src/features/savedLists/savedListRepository.ts` -> `listForUser`, `listItems`, `deleteAllForUser` -> replacement dependency surface
  - `apps/api/test/accountExport/dataExport.integration.test.ts` and `apps/api/test/accountDeletion/deletion.integration.test.ts` -> existing favourites assertions -> rewrite targets
- acceptance: no `favourites` symbol, route, table reference, or test remains in `apps/api`; account export payload carries `savedLists` with items instead of `favourites`; account deletion removes saved lists and items for the deleted user while retaining orders; `app.integration.test.ts` no longer asserts the removed route
- non-goals: no deletion of `packages/contracts/src/favourites.ts` (last consumer is web, removed in `P11`); no web change
- upstream inputs: `P6` -> accepted change set -> `savedLists` service wired in `app.ts` and route live
- changes:
  - delete `features/favourites/`, `routes/favourites.ts`, `test/favourites/`
  - remove favourites service construction, `AppServices` member, and route registration from `app.ts`
  - swap `dataExportService.ts` dependency `favourites: FavouritesRepository` for `savedLists: SavedListRepository`; emit payload field `savedLists` carrying list summaries plus their items
  - swap `accountDepth.ts` payload field `favourites: Type.Array(Product)` for `savedLists: Type.Array(SavedListDetail)`, importing from the saved-lists module
  - replace the favourites delete in `deletionRepository.ts` with `saved_list_items` then `saved_lists` deletes scoped by `user_id`, in FK-safe order
  - rewrite the affected assertions in the three integration tests
- invariants: export completeness after related-row deletion still holds; deletion tombstones identity and retains orders; no parallel legacy path survives
- relevant evidence: `E7` -> saved-list endpoints live; `E1` -> `favourites` table already dropped
- test duty: `npm exec -w @shop/api -- tsx --test test/accountExport/dataExport.integration.test.ts test/accountDeletion/deletion.integration.test.ts test/http/app.integration.test.ts` -> `E8`
- verification: `E8` passes; `npm run typecheck -w @shop/api` clean; repository-wide search for `favourite` under `apps/api/src` and `apps/api/test` returns nothing
- handoff: `accountDepth` export payload field rename for any later consumer
- review: `R7` -> `GR7` blocks `P11`

### P8: Web API client, saved-lists provider, cart action

- mode: sequential head of the web lane; parallel with `P7` after `GR6`
- depends on: `P6`, `P2`, `GR6`
- owns: `apps/web/src/api/savedLists.ts`, `apps/web/src/api/savedLists.test.ts`, `apps/web/src/hooks/SavedListsContext.tsx`, `apps/web/src/hooks/useSavedLists.ts`, `apps/web/src/hooks/useSavedLists.test.tsx`, `apps/web/src/hooks/useCart.ts`, `apps/web/src/hooks/useCart.test.tsx`, `apps/web/src/components/Layout.tsx`
- reads:
  - `apps/web/src/api/reorder.ts` -> path-param encoding and body typing convention
  - `apps/web/src/api/accountPreferences.ts` -> minimal module convention
  - `apps/web/src/api/client.ts` -> `apiFetch`, `ApiError`, `ApiContractError`, `isMissingCartError`
  - `apps/web/src/hooks/useCart.ts` -> `CartAction`, `runCartMutation`, `reorder`, `quickOrder`, `ERROR_MESSAGE_BY_CODE`, `getErrorMessage`
  - `apps/web/src/hooks/CartContext.tsx` -> provider shape and `useCartContext` throw behavior
  - `apps/web/src/hooks/useFavourites.ts` -> current optimistic toggle and its per-instance refetch flaw -> behavior to replace, not copy
  - `apps/web/src/components/Layout.tsx` -> provider nesting order
  - `apps/web/src/api/cart.test.ts` -> api module test convention
- acceptance: every saved-list endpoint has a typed client function validating against the contract schema; `SavedListsProvider` fetches once and shares state; `addSavedListToCart` returns the full report while landing the server cart in state; stale-response and missing-cart recovery behave as they do for `reorder`
- non-goals: no page, no entry-point control, no route table change, no favourites deletion
- upstream inputs:
  - `P6` -> accepted change set -> endpoint paths, statuses, error codes
  - `P2` -> accepted change set -> contract schema names on the `./saved-lists` subpath
- changes:
  - add `api/savedLists.ts` with one free function per endpoint, `encodeURIComponent` on `listId` and `itemId`, response schema passed to `apiFetch` as a value
  - add `SavedListsContext.tsx` + `useSavedLists.ts` exposing the surface named in Target Design; anonymous users get empty state and no request; optimistic default-list toggle with rollback
  - mount `SavedListsProvider` in `Layout.tsx` inside `AuthProvider` and `CartProvider`
  - extend `CartAction` with `'saved-list-add'`; add `addSavedListToCart(listId)` on `runCartMutation` with `selectCart: (response) => response.cart`; add any new server error codes to `ERROR_MESSAGE_BY_CODE`
  - tests: `savedLists.test.ts` (path building, body shape, `ApiError` propagation, contract-violating response rejected); `useSavedLists.test.tsx` (single fetch across consumers, optimistic toggle rollback on failure, anonymous no-op); `useCart.test.tsx` extension (`addSavedListToCart` lands the cart, returns the report, marks and clears the pending key, recovers a missing cart)
- invariants: web never imports API source; no mutable module-global state; async work ignores stale completion; the api module never swallows errors
- relevant evidence: `E7` -> live endpoint contract
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/api/savedLists.test.ts src/hooks/useSavedLists.test.tsx src/hooks/useCart.test.tsx` -> `E9`
- verification: `E9` passes; `npm run typecheck -w @shop/web` clean
- handoff: provider surface, `addSavedListToCart` signature and return type
- review: `R8` -> `GR8` blocks `P9`

### P9: Saved Lists pages and presentation

- mode: sequential after `GR8`
- depends on: `P8`, `GR8`
- owns: `apps/web/src/features/savedLists/SavedListsPage.tsx`, `SavedListDetailPage.tsx`, `SavedListOutcomeList.tsx`, `savedListsPresentation.ts`, `SavedListPicker.tsx`, colocated `*.test.tsx` / `*.test.ts`, `apps/web/src/features/savedLists/SavedListsJourney.integration.test.tsx`, `apps/web/src/App.tsx`
- reads:
  - `apps/web/src/features/quickOrder/quickOrderPresentation.ts` -> state union, `Record`-keyed copy, `SKIP_REASONS` derivation, summary and adjustment message shape
  - `apps/web/src/features/quickOrder/QuickOrderOutcomeList.tsx` -> live-region markup, `empty:hidden`, labelled sublists
  - `apps/web/src/features/quickOrder/QuickOrderPage.tsx` -> page composition, pending state, error copy
  - `apps/web/src/features/reorder/BuyAgainJourney.integration.test.tsx` -> integration harness: `vi.mock` of api modules, `setCartId`, real `CartProvider`, `MemoryRouter` routes, typed fixtures
  - `apps/web/src/features/account/PreferencesSection.tsx` -> section markup contract, `messageFor(error)` helper
  - `apps/web/src/App.tsx` -> route table, `ProtectedRoute` usage, `/wishlist` entry
  - `apps/web/src/lib/formatMoney.ts` -> money formatting
- acceptance: `/lists` lists the buyer's lists with item counts and a create control; `/lists/:listId` shows items with server-resolved unit price, `£/tonne`, MOQ, and availability, supports quantity edit and item removal, and offers "Add list to cart"; the outcome region announces the result and names every skipped item with plain-language copy; retired items are visibly marked and not silently dropped; loading, empty, and error states exist on both pages
- non-goals: no entry-point controls outside these pages; no header, account menu, or favourites removal
- upstream inputs: `P8` -> accepted change set -> provider surface and `addSavedListToCart`
- changes:
  - `savedListsPresentation.ts` -> `SavedListAddState` union, `SKIP_REASON_MESSAGE` keyed by the contract union, `skipReasonMessage`, `SKIP_REASONS`, `SAVED_LIST_ADD_FAILURE_MESSAGE`, `outcomeItemLabel`, `moqAdjustmentMessage`, `savedListSummaryMessage`, `skippedOutcomes`, `adjustedOutcomes`
  - `SavedListOutcomeList.tsx` -> `role="status" aria-live="polite"` region collapsing while idle, summary paragraph, labelled adjusted and skipped lists, "View cart" link when anything was added
  - `SavedListPicker.tsx` -> choose-existing-or-create-new control reused by `P10` entry points; handles cap and duplicate-name errors inline
  - `SavedListsPage.tsx` and `SavedListDetailPage.tsx` -> composed from the provider plus `useCartContext`
  - `App.tsx` -> add `/lists` and `/lists/:listId` under `<ProtectedRoute>`; replace the `/wishlist` element with `<Navigate to="/lists" replace />`
  - tests: presentation unit test iterating `SKIP_REASONS` so a new reason cannot ship without copy; `SavedListOutcomeList.test.tsx` render states; `SavedListDetailPage.test.tsx` quantity edit, removal, add-to-cart pending and result; `SavedListsJourney.integration.test.tsx` create list -> add item -> add list to cart -> mixed outcome rendered -> cart state updated
- invariants: server figures are displayed, never recomputed client-side; UI behavior is proven by React integration and unit tests only; accessibility follows the existing live-region and section-heading contracts
- relevant evidence: `E9` -> client and provider behavior
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/savedLists/` and `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/savedLists/SavedListsJourney.integration.test.tsx` -> `E10`
- verification: `E10` passes; `npm run typecheck -w @shop/web` clean
- handoff: `SavedListPicker` props, presentation helper names
- review: `R9` -> `GR9` blocks `P10`

### P10: Entry-point controls

- mode: sequential after `GR9`
- depends on: `P9`, `GR9`
- owns: `apps/web/src/components/SaveToListButton.tsx`, `apps/web/src/features/savedLists/AddToListMenu.tsx`, `apps/web/src/features/savedLists/SaveCartAsListButton.tsx`, `apps/web/src/features/savedLists/SaveOrderAsListButton.tsx`, `apps/web/src/components/ProductCard.tsx`, `apps/web/src/features/product/ProductPurchasePanel.tsx`, `apps/web/src/features/cart/CartPage.tsx`, `apps/web/src/features/orders/OrderHistoryPage.tsx`, `apps/web/src/features/orders/OrderDetailPage.tsx`, `apps/web/src/features/orders/OrderDetailView.tsx`, colocated tests for the four new components plus `ProductCard.test.tsx`, `ProductPurchasePanel.test.tsx`, `CartPage.test.tsx`, `apps/web/src/features/orders/OrderPages.test.tsx`
- reads:
  - `apps/web/src/components/WishlistButton.tsx` -> current heart-toggle behavior and anonymous redirect -> behavior to carry over at variant scope
  - `apps/web/src/features/product/ProductPurchasePanel.tsx` -> `selectedVariantId` state, `onAddToCart` -> variant-aware save site
  - `apps/web/src/components/ProductCard.tsx` -> current `WishlistButton` mount point
  - `apps/web/src/features/cart/CartPage.tsx` -> `/quick-order` link block -> placement precedent for the cart entry point
  - `apps/web/src/features/orders/OrderHistoryPage.tsx` -> `useBuyAgain` per-row pattern -> placement precedent for the order entry point
  - `apps/web/src/features/orders/OrderDetailPage.tsx` and `OrderDetailView.tsx` -> confirm which file renders the detail action row before mounting the control there
  - `apps/web/src/features/savedLists/SavedListPicker.tsx` -> shared choose-or-create control
  - `apps/web/src/hooks/useSavedLists.ts` -> provider surface
- acceptance: heart toggle on a product card saves the product's default variant to the default list and reflects saved state across every card without a page reload; the product panel saves the selected variant at the entered quantity into a chosen or newly created list; the cart page turns the current cart into a named list; order history rows and order detail turn a past order into a named list; anonymous users are redirected to login preserving the return path
- non-goals: no deletion of `WishlistButton.tsx`, `useFavourites.ts`, `api/favourites.ts`, or `features/wishlist/`; no header, account menu, or nav change
- upstream inputs: `P9` -> accepted change set -> `SavedListPicker` props and presentation helpers
- changes:
  - `SaveToListButton.tsx` -> heart toggle bound to `product.defaultVariantId` through the provider, replacing `WishlistButton` usage in `ProductCard.tsx`
  - `AddToListMenu.tsx` -> variant-aware control on `ProductPurchasePanel`, disabled until a variant is selected, submitting the panel's current quantity
  - `SaveCartAsListButton.tsx` -> calls `from-cart`, surfaces `CART_EMPTY` and `NAME_TAKEN` inline, links to the created list
  - `SaveOrderAsListButton.tsx` -> calls `from-order/:orderId`, mounted on history rows and order detail
  - update the affected tests; keep every existing assertion that is not about favourites
- invariants: blend cart lines are excluded from `from-cart` conversion and the UI says so; controls never assume a variant when none is selected; pending state prevents duplicate submission
- relevant evidence: `E9`, `E10` -> client, provider, picker
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/components/SaveToListButton.test.tsx src/features/savedLists/ src/components/ProductCard.test.tsx src/features/product/ProductPurchasePanel.test.tsx src/features/cart/CartPage.test.tsx src/features/orders/OrderPages.test.tsx` -> `E11`
- verification: `E11` passes; `npm run typecheck -w @shop/web` clean
- handoff: entry-point component names and mount points
- review: `R10` -> `GR10` blocks `P11`

### P11: Web wishlist retirement, shell, shared contract removal

- mode: sequential after `GR7` and `GR10`
- depends on: `P7`, `P10`, `G3`
- owns: `apps/web/src/features/wishlist/` (deleted), `apps/web/src/hooks/useFavourites.ts` (deleted), `apps/web/src/components/WishlistButton.tsx` (deleted), `apps/web/src/api/favourites.ts` (deleted), `packages/contracts/src/favourites.ts` (deleted), `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `apps/web/src/components/Header.tsx`, `apps/web/src/components/AccountMenu.tsx`, `apps/web/src/components/nav/navItems.ts`, `apps/web/src/features/account/AccountPage.tsx`, `apps/web/src/features/designs/BagDesignsPage.tsx`, and the residual tests `Header.test.tsx`, `CatalogPage.test.tsx`, `CatalogProductJourney.integration.test.tsx`, `CatalogStaleCategory.integration.test.tsx`, `HomePage.test.tsx`, `ProductPage.test.tsx`, `SimilarProductsSection.test.tsx`, `SelfServiceSections.test.tsx`
- reads:
  - `apps/web/src/components/Header.tsx` -> `WishlistButton` header mount -> replacement site
  - `apps/web/src/components/AccountMenu.tsx` -> authenticated menu items -> insertion site
  - `apps/web/src/features/account/AccountPage.tsx` -> "View Wishlist" action link -> replacement site
  - `apps/web/src/components/nav/navItems.ts` -> `wishlistItem`, `navItems` -> rename target
  - `packages/contracts/package.json` -> `exports` map -> `./favourites` removal
  - `packages/contracts/src/index.ts` -> favourites re-export -> removal
  - each residual test file -> its favourites or wishlist mock or assertion -> rewrite target
- acceptance: no `favourite`, `Favourite`, `wishlist`, or `Wishlist` identifier remains under `apps/web/src` or `packages/contracts/src` except the user-facing default list name `Favourites`; header exposes a single saved-lists control with a count; account menu and account page link to `/lists`; nav entry count is unchanged from baseline; every web suite passes
- non-goals: no new behavior; no change to the pages or entry points delivered by `P9` and `P10`
- upstream inputs:
  - `P7` -> accepted change set -> API-side favourites gone, `accountDepth` field renamed
  - `P10` -> accepted change set -> entry-point controls already replaced every `WishlistButton` product usage
- changes:
  - replace the header `WishlistButton` mount with a `/lists` link carrying the default-list item count from the provider
  - add a "Saved Lists" item to `AccountMenu.tsx`; repoint the `AccountPage.tsx` action link
  - rename `wishlistItem` to `savedListsItem` in `navItems.ts` and update `navItems`
  - delete `features/wishlist/`, `hooks/useFavourites.ts`, `components/WishlistButton.tsx`, `api/favourites.ts`
  - delete `packages/contracts/src/favourites.ts`, its `index.ts` re-export, and its `"./favourites"` `exports` entry
  - update `BagDesignsPage.tsx` and every residual test that mocks or asserts favourites or wishlist
- invariants: no dead import or stale mock remains; no route regression on `/lists`; `/wishlist` still redirects
- relevant evidence: `E8` -> API retirement; `E11` -> entry points settled
- test duty: `npm run build -w @shop/contracts` then `npm test -w @shop/web` -> `E12`
- verification: `E12` passes; `npm run typecheck` clean workspace-wide; repository-wide search for `favourite` and `wishlist` under `apps/`, `packages/` returns only the seeded default list name
- handoff: retirement complete; no legacy path survives
- review: `R11` -> `GR11` blocks `S1`

### S1: Convergence, documentation, full verification

- mode: sequential after `GR11`
- depends on: `P1`..`P11`, `G3`, `GR11`
- owns: `plans/demo_project_high_level_plan.md`, `AGENTS.md`, `README.md`
- reads:
  - `plans/demo_project_high_level_plan.md` -> item 12 completed entry -> format for the item 13 completion record; `Current Baseline`, `LOC Target`, `Sequencing Guidelines` -> sections needing refresh
  - `AGENTS.md` -> `Repository Map` -> feature directory list needing the saved-lists entry and the favourites removal
  - `README.md` -> seeded credentials and demo-trigger section -> where the `Monthly restock` fixture is described
- acceptance: item 13 records as completed with landed paths, migration `029`, decisions, and QA surface; `Current Baseline` lists saved lists and drops favourites; `AGENTS.md` repository map is current; README documents the demo fixture and how to trigger the mixed add-to-cart result; full required suites pass
- non-goals: no source behavior change; no merge, rebase, or worktree cleanup
- upstream inputs: every packet -> accepted change sets -> landed paths, migration head, endpoint list, retired paths
- changes:
  - add the item 13 completion entry mirroring item 12's structure: landed date, migration `029`, endpoint list, decisions (full absorption, stock variants only, MOQ round-up before submission, no substitution), QA surface as built, demo fixture
  - update `Current Baseline` implemented lines and the migration list through `029`; update `Sequencing Guidelines` so 13 reads completed and 14 reads completed; refresh the `LOC Target` measurement note with a new measurement taken in the worktree
  - update `AGENTS.md` repository map: `savedLists` under API features, favourites removed, `features/savedLists/` under web features
  - add the README fixture note: alice's `Monthly restock` list and the outcome each item produces
  - resolve any cross-lane inconsistency surfaced by the full suites
- relevant evidence: `E1`..`E12` -> per-packet coverage
- test duty: `npm run verify` -> `E13`; then `npm run test:integration` -> `E14`. `E14` is mandatory and separate because `npm run verify` runs `@shop/web`'s `test` script, which is `test:unit` and excludes every `*.integration.test.{ts,tsx}`
- verification: `E13` and `E14` both pass on the final change set; no browser session, screenshot, or agent click-through at this gate
- handoff: final change set, evidence IDs, worktree identity for the completion reply
- review: `R12` -> `GR12` blocks `G4`

## Review Assignments

### R1: Review `P1`

- method: invoke `code-reviewer` skill; apply its severity gate (critical + high only) and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P1` -> settled change set at packet completion
- timing: immediately after `P1` reports and `E1` is recorded; before `P4`, `P5`, `P6`
- blocks: `G1`
- consolidation reason: none
- reads: `apps/api/src/db/migrations/029_saved_lists.ts` -> whole file -> correctness of DDL, conversion, drop; `apps/api/src/db/migrate.ts` -> `migrateDatabase` -> transaction and FK ownership; `apps/api/src/db/migrations/026_company_accounts_approvals.ts` -> conventions; `apps/api/src/db/reset.ts` -> delete ordering; `apps/api/test/db/savedListsSchema.integration.test.ts` -> coverage adequacy
- acceptance: migration is transactional through the runner, idempotent, FK-clean, and forward-only; conversion produces one default list per affected user with correct MOQ-floor quantities; indexes match the declared invariants; no landed migration edited or renumbered
- invariants: no transaction or `foreign_keys` toggle inside `up`; sack weight frozen as a literal; `favourites` dropped only after conversion; reset ordering FK-safe
- risk focus: data conversion arithmetic and integer division; partial unique default index semantics in SQLite; conversion of favourites whose product default variant is inactive; drop ordering versus FK references
- non-goals: contracts, services, routes, seed fixtures, web
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E1` is missing or stale
- relevant evidence: `E1`
- return: `reviewer_report_v1` with exact target, verdict, stable finding IDs, evidence assessment

### R2: Review `P2`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P2` -> settled change set at packet completion
- timing: immediately after `P2` reports and `E2` is recorded; before `P4`, `P6`, `P8`
- blocks: `G1`
- consolidation reason: none
- reads: `packages/contracts/src/savedLists.ts` -> whole file; `packages/contracts/src/quickOrder.ts` and `reorder.ts` -> outcome and status/reason precedent; `packages/contracts/package.json` -> `exports`; `packages/contracts/src/index.ts` -> re-export; `packages/contracts/test/savedLists.test.ts` -> coverage adequacy
- acceptance: schemas are closed where the precedent closes them; status/reason pairing is schema-enforced; money uses `MoneyCents`; ids follow the existing string/integer split; subpath export resolves after build; nothing existing is changed
- invariants: additive only; skip vocabulary matches the cart's exactly; no new skip reason introduced
- risk focus: `additionalProperties` omissions that would let unmapped domain fields reach the wire; integer bounds allowing unsafe values; drift between the skip union here and `BULK_ADD_SKIP_REASONS`
- non-goals: API, web, `accountDepth`, favourites removal
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E2` is missing or stale
- relevant evidence: `E2`
- return: `reviewer_report_v1`

### R3: Review `P3`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P3` -> settled change set at packet completion
- timing: immediately after `P3` reports and `E3` is recorded; before `P4`
- blocks: `G1`
- consolidation reason: none
- reads: `apps/api/src/features/audit/auditEvent.ts` -> `AUDIT_ACTIONS`, `AuditEntityType`, `AuditEventInput`, `buildAuditEvent`; `apps/api/src/features/audit/auditEvent.test.ts` -> new cases
- acceptance: every new action has a union member, a switch case, and a resolved entity; metadata stays flat and within limits; existing actions and entity types are untouched
- invariants: append-only action list; ledger stays append-only; no sensitive value enters metadata
- risk focus: a new action reaching `buildAuditEvent` without a case; entity id derived from a nullable value; metadata carrying a value that fails validation at runtime rather than compile time
- non-goals: audit query, admin audit read, route wiring
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E3` is missing or stale
- relevant evidence: `E3`
- return: `reviewer_report_v1`

### R4: Review `P4`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P4` -> settled change set at packet completion
- timing: immediately after `P4` reports and `E4`, `E5` are recorded; before `P6`
- blocks: `G2`
- consolidation reason: none
- reads: `apps/api/src/features/savedLists/` -> all five source files; `apps/api/src/features/cart/cartService.ts` -> `addMany` contract; `apps/api/src/features/cart/cartBulkAddRules.ts` -> shared vocabulary and aggregation; `apps/api/src/features/pricing/pricingRules.ts` -> `moqShortfallSacks`, `resolveUnitPriceCents`; `apps/api/src/features/quickOrder/quickOrderRules.ts` -> round-up precedent; `apps/api/test/savedLists/savedListService.integration.test.ts` -> coverage adequacy
- acceptance: ownership resolves on `(userId, listId)` with indistinguishable absent and foreign; caps and names pre-checked; MOQ round-up never rounds down and never reaches the cart unrounded; outcomes map one-to-one to items; every mutation is transactional and audited; price is resolved server-side
- invariants: single multi-line cart path; skip vocabulary unextended; no quantity clamping; `AuditContext` required; no raw SQLite constraint escapes
- risk focus: integer overflow in round-up arithmetic; a group verdict silently lost during fan-out; nested `unitOfWork.run` behavior when `addMany` opens its own; retired-variant items reaching `addMany` and producing a confusing reason; `createFromCart` including blend lines
- non-goals: routes, wiring, seed, contracts, web
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E4` or `E5` is missing or stale
- relevant evidence: `E4`, `E5`
- return: `reviewer_report_v1`

### R5: Review `P5`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P5` -> settled change set at packet completion
- timing: immediately after `P5` reports and `E6` is recorded; before `G2`
- blocks: `G2`
- consolidation reason: none
- reads: `apps/api/src/db/savedListSeed.ts` -> whole file; `apps/api/src/db/seed.ts` -> call site and removed favourites block; `apps/api/src/db/companyAccountsSeed.ts` -> convention; `apps/api/test/db/seed.integration.test.ts` -> assertion scoping
- acceptance: seed is idempotent and deterministic; the fixture genuinely produces all four intended outcomes against seeded stock and clearance state; assertions scope to test-owned identifiers
- invariants: no new catalog rows; guard-and-return when the fixture user is absent; single seed transaction preserved
- risk focus: a chosen variant whose stock or retirement state does not actually yield the intended skip; non-idempotent insert producing duplicates on a second `npm run seed`; assertions depending on absolute row ids
- non-goals: service, routes, web
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E6` is missing or stale
- relevant evidence: `E6`
- return: `reviewer_report_v1`

### R6: Review `P6`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P6` -> settled change set at packet completion
- timing: immediately after `P6` reports and `E7` is recorded; before `P7` and `P8`
- blocks: `P7`, `P8`
- consolidation reason: none
- reads: `apps/api/src/routes/savedLists.ts` -> whole file; `apps/api/src/app.ts` -> service construction and registration; `apps/api/src/plugins/auth.ts` -> guards; `apps/api/src/routes/reorder.ts` and `quickOrder.ts` -> precedent; both new integration tests -> coverage adequacy
- acceptance: every route declares its full response-status map; guards match the declared rule; error codes and statuses match the design; domain shapes are explicitly mapped; the saved-lists service shares the hoisted `cartService` and the single `unitOfWork`
- invariants: `Cart not found` prose exact; add-to-cart is the only `requireCustomer` route; no ownership leak through a distinguishable 403; routes stay thin
- risk focus: a route missing an auth guard; a service constructed with a second `CartService` or a second `UnitOfWork` instance, breaking savepoint nesting; an unmapped domain field reaching the wire; a status collision between 404 codes
- non-goals: favourites removal, web, seed
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E7` is missing or stale
- relevant evidence: `E7`, `E4`, `E5`
- return: `reviewer_report_v1`

### R7: Review `P7`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P7` -> settled change set at packet completion
- timing: immediately after `P7` reports and `E8` is recorded; before `P11`
- blocks: `P11`, `G3`
- consolidation reason: none
- reads: `apps/api/src/features/accountExport/dataExportService.ts` -> whole file; `apps/api/src/features/accountDeletion/deletionRepository.ts` -> deletion sequence; `packages/contracts/src/accountDepth.ts` -> payload field; `apps/api/src/app.ts` -> removed wiring; the three updated integration tests -> coverage adequacy
- acceptance: export payload is complete and matches the contract; deletion removes items before lists in FK-safe order and retains orders; no favourites symbol or route remains in `apps/api`
- invariants: export completeness after related-row deletion; tombstoned identity with retained orders; no parallel legacy path
- risk focus: deletion order violating a foreign key; export omitting items or leaking another user's list; a dangling import or unregistered-route regression after removal
- non-goals: web, contracts `favourites.ts` deletion, seed
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E8` is missing or stale
- relevant evidence: `E8`
- return: `reviewer_report_v1`

### R8: Review `P8`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P8` -> settled change set at packet completion
- timing: immediately after `P8` reports and `E9` is recorded; before `P9`
- blocks: `P9`
- consolidation reason: none
- reads: `apps/web/src/api/savedLists.ts` -> whole file; `apps/web/src/hooks/SavedListsContext.tsx` and `useSavedLists.ts` -> whole files; `apps/web/src/hooks/useCart.ts` -> `runCartMutation`, `addSavedListToCart`, `CartAction`; `apps/web/src/components/Layout.tsx` -> provider nesting; the three test files -> coverage adequacy
- acceptance: every response is validated against its contract schema; the provider fetches once and shares state; `addSavedListToCart` lands the server cart and returns the report; missing-cart recovery and stale-response guards apply
- invariants: no API source import from web; no mutable module-global state; stale async completion ignored; errors propagate from the api module
- risk focus: a request issued for anonymous users; a race between optimistic toggle and refresh leaving inconsistent saved state; a pending key that never clears on failure; path params not encoded
- non-goals: pages, entry points, retirement
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E9` is missing or stale
- relevant evidence: `E9`, `E7`
- return: `reviewer_report_v1`

### R9: Review `P9`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P9` -> settled change set at packet completion
- timing: immediately after `P9` reports and `E10` is recorded; before `P10`
- blocks: `P10`
- consolidation reason: none
- reads: `apps/web/src/features/savedLists/` -> all source files; `apps/web/src/App.tsx` -> route additions; `apps/web/src/features/quickOrder/quickOrderPresentation.ts` and `QuickOrderOutcomeList.tsx` -> precedent; the colocated and integration tests -> coverage adequacy
- acceptance: skip-reason copy is exhaustive by construction; the outcome region is announced correctly and collapses while idle; loading, empty, and error states exist; displayed money and MOQ figures come from the server
- invariants: no client-side price or MOQ derivation; UI behavior proven by tests, not inspection; existing accessibility contracts followed
- risk focus: a skipped item rendered without a reason; a result region that announces on mount; a route added outside `ProtectedRoute`; `/wishlist` redirect regression
- non-goals: entry points, retirement, header
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E10` is missing or stale
- relevant evidence: `E10`, `E9`
- return: `reviewer_report_v1`

### R10: Review `P10`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P10` -> settled change set at packet completion
- timing: immediately after `P10` reports and `E11` is recorded; before `P11`
- blocks: `P11`, `G3`
- consolidation reason: none
- reads: the four new entry-point components -> whole files; `apps/web/src/components/ProductCard.tsx` and `apps/web/src/features/product/ProductPurchasePanel.tsx` -> mount sites and variant state; `apps/web/src/features/cart/CartPage.tsx` and the two order pages -> mount sites; the updated tests -> coverage adequacy
- acceptance: heart toggle saves the default variant and reflects shared state; the panel control respects the selected variant and quantity; cart and order conversions surface their domain errors inline; anonymous flow preserves the return path
- invariants: blend lines excluded from cart conversion and disclosed; controls disabled without a selected variant; duplicate submission prevented
- risk focus: a heart toggle writing a wrong or missing variant when `defaultVariantId` is absent from a fixture; a stale quantity read from the panel; an entry point silently succeeding when the server rejected it
- non-goals: retirement, header, nav
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E11` is missing or stale
- relevant evidence: `E11`, `E10`
- return: `reviewer_report_v1`

### R11: Review `P11`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `P11` -> settled change set at packet completion
- timing: immediately after `P11` reports and `E12` is recorded; before `S1`
- blocks: `S1`
- consolidation reason: none
- reads: `apps/web/src/components/Header.tsx`, `AccountMenu.tsx`, `nav/navItems.ts`, `apps/web/src/features/account/AccountPage.tsx` -> replacement sites; `packages/contracts/package.json` and `index.ts` -> export removal; the residual updated tests -> coverage adequacy
- acceptance: every deletion is complete with no dangling import, mock, or export; shell links resolve to `/lists`; nav entry count unchanged; contract subpath removal does not break any remaining consumer
- invariants: no legacy path survives; no behavior added under cover of retirement
- risk focus: a `./favourites` subpath still imported somewhere; a test mock referencing a deleted module and silently passing; the header count reading the wrong list
- non-goals: new behavior, documentation, final suites
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E12` is missing or stale
- relevant evidence: `E12`, `E8`, `E11`
- return: `reviewer_report_v1`

### R12: Review `S1`

- method: invoke `code-reviewer` skill; apply its severity gate and verification-before-reporting duty; map surviving findings into `reviewer_report_v1`
- target: `S1` -> settled convergence change set, reviewed as a separate integration target
- timing: after `S1` reports and `E13`, `E14` are recorded; before `G4`
- blocks: `G4`
- consolidation reason: none
- reads: `plans/demo_project_high_level_plan.md` -> item 13 entry, `Current Baseline`, `Sequencing Guidelines`, `LOC Target`; `AGENTS.md` -> repository map; `README.md` -> fixture note
- acceptance: recorded claims match what actually landed (paths, migration `029`, endpoints, retired paths, decisions); no stale favourites or wishlist claim remains; `E13` and `E14` both cover the final change set
- invariants: documentation states implementation truth; no course-spoiler content for later items; no behavior change in this packet
- risk focus: a completion record claiming behavior that was descoped (blend items, manual SKU entry); `E14` omitted or run against an earlier change set; `LOC Target` figure copied rather than measured
- non-goals: source review already covered by `R1`..`R11`
- write policy: inspect-only
- test policy: assess supplied evidence; run only when `E13` or `E14` is missing or stale
- relevant evidence: `E13`, `E14`
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `apps/api/src/db/seed.ts`: `P1` removes the favourites block, `P5` adds the saved-list call. Sequential, never concurrent
- `apps/api/src/db/reset.ts`: owned only by `P1`
- `apps/api/src/db/migrations/index.ts`: owned only by `P1`. Migration version `029` is reserved by `P1`; no other packet adds a migration
- `apps/api/src/app.ts`: `P6` adds saved-lists wiring, `P7` removes favourites wiring. Sequential, never concurrent
- `packages/contracts/src/index.ts` and `package.json`: `P2` adds the saved-lists entry, `P11` removes the favourites entry. Sequential
- `packages/contracts/src/accountDepth.ts`: owned only by `P7`, landing together with its `dataExportService.ts` consumer so no packet ends on a broken typecheck
- `packages/contracts/src/favourites.ts`: deleted only by `P11`, after both the API consumer (`P7`) and the web consumer (`P10` -> `P11`) are gone
- `apps/web/src/App.tsx`: owned only by `P9`
- `apps/web/src/hooks/useCart.ts`: owned only by `P8`
- `apps/web/src/features/savedLists/`: `P9` owns pages, presentation, outcome list, and picker; `P10` owns the four entry-point components in the same directory and reads but never edits `P9`'s files
- `apps/web/src/components/ProductCard.tsx`, `ProductPurchasePanel.tsx`, `CartPage.tsx`, order pages: owned only by `P10`
- `apps/web/src/components/Header.tsx`, `AccountMenu.tsx`, `nav/navItems.ts`, `AccountPage.tsx`: owned only by `P11`
- contract producer -> consumers: `P2` -> `P4`, `P6`, `P8`; `P3` -> `P4`; `P1` -> `P4`, `P5`
- composition and documentation integration: reserved to `S1`

## Harness Role Binding

- Codex only: launch the globally configured `worker` agent for worker packets, fixes, and worker-owned verification; launch the globally configured `reviewer` agent for review assignments. Resolve model, reasoning effort, and developer instructions from global Codex settings. Never name or override those values in plan or assignment
- non-Codex harnesses: ignore the Codex binding. Use harness-native role or subagent configuration while preserving worker and reviewer responsibilities and communication contracts
- all harnesses: the reviewer agent runs the `code-reviewer` skill as its review method. Assignment sets `review_skill=code-reviewer`; the reviewer invokes it explicitly by name because the skill carries `disable-model-invocation`

## Test Execution Schedule

Node prerequisite for every command: prepend `$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH` in PowerShell, confirm `node --version` reports `v22.x`, and never select the `v24.*` install. A missing Node 22 is a blocker, never a skipped command.

- `E1`: after `P1` changes settle -> owner `P1` -> `npm exec -w @shop/api -- tsx --test test/db/savedListsSchema.integration.test.ts test/db/migrations.integration.test.ts test/db/seed.integration.test.ts`
- `E2`: after `P2` changes settle -> owner `P2` -> `npm run build -w @shop/contracts` then `npm test -w @shop/contracts`
- `E3`: after `P3` changes settle -> owner `P3` -> `npm exec -w @shop/api -- tsx --test src/features/audit/auditEvent.test.ts`
- `E4`: after `P4` rules settle -> owner `P4` -> `npm exec -w @shop/api -- tsx --test src/features/savedLists/savedListRules.test.ts`
- `E5`: after `P4` service settles -> owner `P4` -> `npm exec -w @shop/api -- tsx --test test/savedLists/savedListService.integration.test.ts`
- `E6`: after `P5` changes settle -> owner `P5` -> `npm exec -w @shop/api -- tsx --test test/db/seed.integration.test.ts`
- `E7`: after `P6` changes settle -> owner `P6` -> `npm exec -w @shop/api -- tsx --test test/savedLists/savedListRoutes.integration.test.ts test/savedLists/savedListAddToCart.integration.test.ts`
- `E8`: after `P7` changes settle -> owner `P7` -> `npm exec -w @shop/api -- tsx --test test/accountExport/dataExport.integration.test.ts test/accountDeletion/deletion.integration.test.ts test/http/app.integration.test.ts`
- `E9`: after `P8` changes settle -> owner `P8` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/api/savedLists.test.ts src/hooks/useSavedLists.test.tsx src/hooks/useCart.test.tsx`
- `E10`: after `P9` changes settle -> owner `P9` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/features/savedLists/` and `npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/savedLists/SavedListsJourney.integration.test.tsx`
- `E11`: after `P10` changes settle -> owner `P10` -> `npm exec -w @shop/web -- vitest run --configLoader runner src/components/SaveToListButton.test.tsx src/features/savedLists/ src/components/ProductCard.test.tsx src/features/product/ProductPurchasePanel.test.tsx src/features/cart/CartPage.test.tsx src/features/orders/OrderPages.test.tsx`
- `E12`: after `P11` changes settle -> owner `P11` -> `npm run build -w @shop/contracts` then `npm test -w @shop/web`
- `E13`: after every fix settles -> owner `S1` -> `npm run verify`, run once
- `E14`: after `E13` -> owner `S1` -> `npm run test:integration`, run once. Mandatory and separate: `verify` runs `@shop/web`'s `test` script, which is `test:unit` and excludes every `*.integration.test.{ts,tsx}`, so a green `verify` alone hides the whole web integration tier
- policy: automated repository commands only. No browser, screenshot, dev-server click-through, `browser-qa` invocation, or manual UI verification in any entry, gate, fix, or review
- reuse: a passing entry stays valid across sessions when no invalidating path changed. A new subagent session alone never invalidates evidence. Each agent receives only the entries covering its own scope and is instructed not to rerun valid commands
- invalidation:
  - `apps/api/src/db/migrations/**`, `apps/api/src/db/reset.ts` -> `E1`, `E6`, `E13`, `E14`
  - `packages/contracts/src/savedLists.ts`, `packages/contracts/package.json` -> `E2`, `E4`, `E5`, `E7`, `E9`, `E12`, `E13`, `E14`
  - `apps/api/src/features/audit/auditEvent.ts` -> `E3`, `E5`, `E7`, `E13`
  - `apps/api/src/features/savedLists/**` -> `E4`, `E5`, `E7`, `E13`, `E14`
  - `apps/api/src/features/cart/**`, `apps/api/src/features/pricing/**` -> `E4`, `E5`, `E7`, `E13`, `E14`
  - `apps/api/src/db/seed.ts`, `apps/api/src/db/savedListSeed.ts` -> `E6`, `E7`, `E13`, `E14`
  - `apps/api/src/routes/**`, `apps/api/src/app.ts` -> `E7`, `E8`, `E13`, `E14`
  - `apps/web/src/hooks/**`, `apps/web/src/api/**` -> `E9`, `E10`, `E11`, `E12`, `E13`, `E14`
  - `apps/web/src/features/savedLists/**`, `apps/web/src/App.tsx` -> `E10`, `E11`, `E12`, `E13`, `E14`
  - any source change after `E13` -> rerun the smallest affected focused command first, then `E13` and `E14` once

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for all messages and for every JSON string value
- transport: inline canonical JSON, one object per message, no free-text wrapper. Run-scoped temp artifacts only for bulky logs or diffs, under `[platform temp root]/orchestrator/[run_id]/[packet_id]/[artifact]` with an inline summary, path, format, and SHA-256
- context boundary: saved plan -> fresh runtime orchestrator -> fresh or minimal subagent context
- projection: role packet + applicable repository instructions + relevant artifact references. Exclude the source plan, this whole plan, prior reports, the global evidence ledger, closed findings, and unrelated packet state
- worker assignment: `worker_assignment_v1` -> `.claude/skills/write-orchestrator-coding-plan/templates/communication/worker-assignment.json`
- reviewer assignment: `reviewer_assignment_v1` -> `templates/communication/reviewer-assignment.json`
- follow-up: `orchestrator_directive_v1` -> `templates/communication/orchestrator-directive.json`
- worker return: `worker_report_v1` -> `templates/communication/worker-report.json`
- reviewer return: `reviewer_report_v1` -> `templates/communication/reviewer-report.json`
- recovery snapshot: `orchestrator_run_state_v1` -> `templates/communication/orchestrator-run-state.json`, stored at `[platform temp root]/orchestrator/[run_id]/state.json`, atomically replaced
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`, read when an object array becomes non-empty
- reviewer method: every reviewer assignment sets `review_skill=code-reviewer`; the reviewer invokes the skill explicitly by name
- worktree context: every assignment carries absolute worktree path, implementation branch, and base revision; every repository-relative path in this plan resolves under the worktree root
- fix flow: stable reviewer finding ID -> fresh worker with a full `worker_assignment_v1` at an incremented `assignment_revision` -> `action=fix` directive carrying the finding IDs, facts, current change set, affected paths, and verification delta -> targeted verification -> orchestrator records closure. Never re-review a fix; never route an implementation fix back to a reviewer

## Orchestrator Run Order

1. End the planning context after saving this plan.
2. Start a fresh runtime orchestrator. Load source-checkout repository instructions (`CLAUDE.md`, `AGENTS.md`), this plan, the canonical communication contracts, and the current checkpoint if one exists.
3. Record the current source branch and `HEAD`. Stop and ask if `HEAD` is detached or if relevant uncommitted or untracked changes are absent from branch `HEAD`.
4. Create the implementation branch and worktree from the recorded `HEAD`; persist worktree identity into the checkpoint.
5. Switch the execution root to the worktree and load the worktree's repository instructions.
6. Validate `G0`: `migrations/index.ts` head is `028`; `features/quickOrder/` and `cartBulkAddRules.ts` are unchanged since `73993c8`; `npm ci` health checks pass. Project role-minimum context plus worktree context into each assignment.
7. Launch fresh worker contexts for `P1 || P2 || P3` inside the worktree.
8. Accept each report; update the checkpoint and evidence ledger; launch `R1`, `R2`, `R3` against each exact settled change set before any consumer starts.
9. Route stable findings to fresh workers with `action=fix` directives; close after targeted evidence. Validate `GR1`, `GR2`, `GR3`, then `G1`.
10. Launch `P4 || P5`; review each lane concurrently as it settles; validate `GR4`, `GR5`, then `G2`.
11. Launch `P6`; review; validate `GR6`.
12. Launch `P7` in parallel with the sequential web lane `P8 -> P9 -> P10`, reviewing each packet as it settles; validate `GR7`..`GR10`, then `G3`.
13. Launch `P11`; review; validate `GR11`.
14. Launch `S1`; run `E13` then `E14` once after every fix settles; review `S1` as a separate integration target; validate `GR12` and `G4`.
15. Leave the implementation branch and worktree intact. Reply with the absolute worktree path, implementation branch, source branch, and base revision, and state that the user owns the merge.

## Risks and Open Questions

- risk: migration `029` converts favourites incorrectly because `products.default_variant_id` points at a retired variant -> mitigation: conversion joins on `product_variants.active = 1` and drops the row; `P1` test asserts the drop; `R1` risk focus names it
- risk: nested `unitOfWork.run` between the saved-list service and `CartService.addMany` behaves unexpectedly if the two are built from different instances -> mitigation: `P6` constructs the service from the hoisted `cartService` and the shared `unitOfWork`; `R6` risk focus names it; `E5` covers reserved-cart and partial-success rollback behavior
- risk: MOQ round-up arithmetic overflows on an adversarial saved quantity -> mitigation: `savedListRules.ts` mirrors `canRoundUpMoq` guards; `E4` covers overflow-unsafe input classified `INVALID_QUANTITY`
- risk: seeded fixture stops producing its intended mixed result when catalog stock or clearance fixtures shift -> mitigation: `P5` selects variants from existing fixtures and `E7` asserts the four outcome shapes through the route, so drift fails a test rather than degrading the demo
- risk: the retirement packets leave a dangling import that only a broad suite catches, late -> mitigation: `P7` and `P11` each end with a repository-wide identifier search plus a workspace typecheck; `E12` runs the full web suite before `S1`
- risk: a green `npm run verify` masks a broken web integration tier -> mitigation: `E14` is a separate mandatory gate command with the reason recorded inline; `R12` risk focus names an omitted or stale `E14`
- risk: `alice@example.com` fixtures are absent in a database where the account was deleted -> mitigation: `seedSavedLists` guards and returns, matching `companyAccountsSeed.ts`
- question: should the default list be renameable at all, given the heart toggle writes to it by identity rather than name? -> owner/gate: `P4`, decided as renameable because identity is `is_default`, not the name; revisit only if `R4` finds a coupling
- question: does the storefront need a saved-list count badge in the header, or only a link? -> owner/gate: `P11`, defaulting to a badge because it replaces an existing badge and keeps the shell visually unchanged
- user-owned follow-up, outside every packet and gate: a human smoke pass over `/lists`, the product-panel save control, and the cart conversion at `1920x1080` after merge. Not a packet duty, not verification, not a gate condition

## Done Criteria

- buyer creates, renames, and deletes named lists; default list exists per user and cannot be deleted
- items save from product detail, product card, cart, and a past order; item identity is `(list, variant)` with quantity update on re-save
- "Add list to cart" reuses `CartService.addMany`, rounds up to MOQ before submission, reports one outcome per item, and never blocks the items that did apply
- a reserved cart rejects the whole batch as `CART_RESERVED`; a missing cart returns `Cart not found`
- list reads show server-resolved unit price, `£/tonne`, MOQ, and availability; a retired lot is marked, kept, and skipped on add
- migration `029` is the new head; favourites data is converted; `favourites` table and every favourites code path are gone from `apps/api`, `apps/web`, and `packages/contracts`
- account export carries `savedLists`; account deletion removes lists and items and retains orders
- `/lists` and `/lists/:listId` are protected routes; `/wishlist` redirects; nav entry count is unchanged from baseline
- seeded `Monthly restock` fixture produces an added line, an MOQ-adjusted line, a `VARIANT_RETIRED` skip, and an `INSUFFICIENT_STOCK` skip
- `E13` (`npm run verify`) and `E14` (`npm run test:integration`) both pass on the final change set
- `plans/demo_project_high_level_plan.md` item 13 records as completed with landed paths and QA surface; `AGENTS.md` repository map and the README fixture note are current
