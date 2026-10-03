# Custom Blend (API)

25 kg made-to-order blend: one base lot + 1-4 ingredient lots.

## Architecture

- `customBlendRules.ts`: pure policy. Private `INGREDIENT_GROUPS_BY_BASE` compatibility matrix, pigment cap, pricing, classification.
- `customBlendResolver.ts`: candidate facts -> `isUsableFact` -> country availability -> rules. Single shared instance wired in `apps/api/src/app.ts` into cart, checkout, and blend routes; new consumer -> pass that instance.
- `customBlendRepository.ts`: eligible-lot SQL only (active, `sort_order = 1`, `weight_grams = 25000`, group in `MIXING_GROUPS` from `packages/catalog/src/model.ts`). No compatibility policy in SQL.
- Blend lots are ordinary `products`/`product_variants` rows with `mixing_group` from catalog seed. Ingredient stock never checked; inventory demand, allocation, and cancel restore use base variant only.
- Snapshot schemas: `packages/contracts/src/customBlends.ts` (custom `TypeSystem` integrity check on `ResolvedCustomBlendSnapshot`). Fee `CUSTOM_BLEND_FEE_CENTS` in `packages/contracts/src/pricing.ts`.
- Routes: `apps/api/src/routes/customBlends.ts`. Resolver failures -> `CUSTOM_BLEND_INVALID | CUSTOM_BLEND_INCOMPATIBLE | CUSTOM_BLEND_PIGMENT_CAP_EXCEEDED` (400). Unavailable and corrupt deliberately share `CUSTOM_BLEND_INVALID`.
- Alias exports exist for compatibility; use canonical names.

## Invariants

- `configKey` = SHA-256 of canonical (variant-id-sorted) ingredient JSON; excludes base. Line identity = `(variant_id = base, config_key)`; plain lines use `config_key = ''`.
- `basePresentation` never affects hash or money.
- Pricing per component: clearance source selected first, then weight tier from that component's weight alone; round-half-up. Fee added once per line, excluded from `discountableTotalCents`; promos and refunds use `discountableTotalCents` only.
- Classification `food` only if every component is `food`; else `non-food`.
- `LegacyCustomBlendSnapshot` must stay byte-compatible: historic orders and older checkout intents store it. `CustomBlendSnapshot` = legacy | resolved union.

## Flows

Evaluate; POST `/api/custom-blends/evaluate`
- `customBlendService.evaluate` -> `resolver.evaluate`: base -> `normalizeCustomBlendSpec` -> ingredients in candidate facts -> compatibility -> pigment cap -> `calculateCustomBlendPricing`. No side effects; quantity defaults to base MOQ.

Add / edit cart line; POST and PUT `/api/cart/:cartId/custom-blends`
- Add: `service.create` -> `carts.blockedInCountry` (base + ingredients) -> evaluate -> `toPersistedSpec` -> `cartService.addConfigured` (`features/cart/cartService.ts`) -> `cartRepository.addConfiguredLineQuantity` upserts on `(cart_id, variant_id, config_key)` adding quantity; same recipe merges into one line.
- Edit: `service.replace` -> `cartService.replaceConfigured` keeps existing quantity -> `cartRepository.replaceConfiguredLine`: same key updates JSON; new key upserts with old quantity then deletes old row. Replace, never add; colliding with another existing recipe merges quantities.
- `create`/`replace` call resolver without country; country blocking only via `carts.blockedInCountry`.
- Mutations re-run all rules; failures write nothing.

Persistence and downstream
- `cart_line_items.custom_blend_json` (migration `022_custom_blends.ts`, CHECK `$.configKey = config_key`) stores legacy snapshot without quantity pricing. `getCart` rehydrates every blend line against live facts on each read.
- Checkout (`features/checkout/checkoutService.ts`): unresolvable cart -> `CUSTOM_BLEND_INVALID`; ingredient variants country-checked; `customBlendLinesRemainEligible` re-rehydrates and deep-compares, mismatch -> 409 before gateway. Quote (`checkoutQuote.ts`) blend lines carry material, fee, discountable totals; unit price excludes fee.
- Finalizer freezes full resolved snapshot in `order_line_items.custom_blend_json`; `features/orders/orderRepository.ts` parses fail-closed.
- Returns exclude blends (`features/returns/returnRepository.ts` `custom_blend_json IS NULL`).
- Bulk add/reorder/saved lists re-derive via `cartService.resolveBulkAddBlend`; may skip `BLEND_UNAVAILABLE` (`features/cart/cartBulkAddRules.ts`).

Change set for rule/pricing change: `customBlendRules.ts` + test, `customBlendResolver.ts` + test, `packages/contracts/src/customBlends.ts` + `packages/contracts/test/custom-blend-contracts.test.ts`, error mapping in `routes/customBlends.ts` + public errors, messages in `packages/localisation/src/messages/customBlend.ts`, integration tests `apps/api/test/customBlend/`, `test/cart/customBlendCart.integration.test.ts`, `test/checkout/customBlendCheckout.integration.test.ts`, `test/orders/customBlendOrder.integration.test.ts`.

## Pitfalls

- Changing `configKey` hash inputs makes `rehydrate` reject every persisted blend line (`CUSTOM_BLEND_CORRUPT_SNAPSHOT`), so those carts read `CART_NOT_FOUND`.
