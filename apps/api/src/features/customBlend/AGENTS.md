# AGENTS.md — apps/api/src/features/customBlend

Custom-blend feature backend (see root AGENTS.md for the general feature-module pattern and app.ts wiring).

## Local scope

- Layers: customBlendRepository.ts (SQL; eligibility filter `p.active=1 AND pv.active=1 AND pv.sort_order=1 AND pv.weight_grams=25000`) -> customBlendResolver.ts (compatibility matrix, pigment cap 10%, pricing) -> customBlendService.ts (orchestration, error wrapping, audit) -> apps/api/src/routes/customBlends.ts (Fastify routes, schema validation, error mapping via `sendCustomBlendError()`).
- customBlendRules.ts holds pure functions (`normalizeCustomBlendSpec`, `validateCustomBlendCompatibility`, `validateCustomBlendPigmentCap`, `calculateCustomBlendPricing`) and `INGREDIENT_GROUPS_BY_BASE`, which is deliberately private to the API — never expose or duplicate it to apps/web.
- Config key = SHA-256 of canonical (sorted, normalized) ingredient JSON; must stay deterministic, never randomized — it identifies cart lines and detects draft divergence.
- Ingredient snapshots are immutable and denormalized (name, category, mixing group, classification captured at add-time) — never store live references back to product/variant rows.
- The resolver instance is a singleton composed once in apps/api/src/app.ts `createAppServices()` and shared with the cart service so cart reads and custom-blend routes see identical facts/clock/pricing.
- apps/api/src/features/checkout/checkoutService.ts `customBlendLinesRemainEligible()` re-resolves each snapshot at checkout and compares against current facts; lines failing this check block checkout.

## Pitfalls

- Only 25kg sacks (`weight_grams=25000`) are custom-blend eligible; this is a hardcoded repository filter, not a config value.
- Constructing a second resolver instance breaks the single-source-of-truth guarantee shared with cart pricing/eligibility.
