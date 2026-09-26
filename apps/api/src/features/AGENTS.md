# apps/api/src/features

## Module shape

- `<x>Rules.ts` -> pure functions, unit-tested colocated. `<x>Service.ts` -> orchestration, injected deps. `<x>Repository.ts` -> SQL. Optional `<x>Errors.ts`, `<x>Types.ts`.
- Business rules live in Rules/Service, never routes or repositories.
- Money math -> `pricing/pricingRules.ts` (`roundHalfUp`, tier lookup) + safe-integer guards. No floats.

## Checkout and orders

- Server-owned payment intent: `checkout/checkoutService.ts` (workflow) -> `checkoutQuote.ts` (quote build) -> `checkoutFinalizer.ts` (order from quote).
- Quote facts recomputed server-side; client-echoed totals accepted only if equal to recompute. Never trust client totals.
- Persisted quote immutable. Finalizer builds order from saved quote only; never consults live catalogue/cart for V10 quotes.
- Quote versions V8/V9/V10 coexist; readers must keep old variants (schemas in `packages/contracts/src/payments.ts`).
- Idempotency key + request fingerprint: same key+same data -> replay; same key+different data -> `IDEMPOTENT_CONFLICT`. Fingerprint excludes card digits.
- Gate order: validate cart/promo/customer/card -> reserve cart, promo capacity, credit hold -> gateway -> finalize. Any later failure releases reservations.
- VAT from `countryProfile(country)`.
- Order lifecycle transitions: `orders/orderLifecycle.ts` assert helpers only.
- Trade credit: net_30 only; company/user identity resolved server-side, never from checkout input.

## Custom blend

- `customBlend/customBlendRules.ts` -> pure matrix, pigment cap, classification, pricing. `customBlendResolver.ts` -> live-fact authority. Checkout re-resolves every blend line before reservation/gateway.
- Business rules source: `plans/workshop_expansion_handoff.md` (Expansion 1).

## Stock and inventory

- All stock mutation via `inventory/inventoryRepository` movement ledger -> backorder FIFO + `stockObserver` -> back-in-stock triggers. Raw `stock_count` SQL skips chain.

## Audit

- `audit/auditEvent.ts` closed union over `AUDIT_ACTIONS`; new action -> enum entry + switch case.
- `audit.append` must run inside same `unitOfWork.run()` as mutation it records.

## Async simulation

- Family: `jobs`, `webhooks`, `notifications`, `standingOrders`, `backInStock`.
- DB-backed job queue (`jobs/jobService.ts`). Payload carries IDs only; handler re-reads DB state at run time.
- Fault injection: handlers check `jobs/faultSwitch.ts` `FAULT_KEYS` first, before side effects. Fault switches = feature flags table (Admin -> Feature Flags).
- Notification email -> mailbox only if user preference allows; in-app notification always.
- Feature flags `featureFlags/featureFlagResolver.ts`: in-memory cache, invalidated post-commit.

## Pitfalls

- `checkoutService.ts` inverse-tier BigInt projection keeps legacy promo path aligned with resolver pricing; tier math changes must update it too or custom-blend promo eligibility breaks silently.
- Per-unit resolved price derives from material subtotal, excluding blending fee.
- `backInStockTrigger.ts` intentionally skips availability check at trigger time; job re-checks.
