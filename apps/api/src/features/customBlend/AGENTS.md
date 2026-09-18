# Custom Blend API Domain

## Ownership

- `customBlendRepository.ts`: fetch active default 25 kg candidate lots and presentation search only.
- `customBlendRules.ts`: pure canonicalisation, directional compatibility, pigment cap, classification, and component pricing.
- `customBlendResolver.ts`: sole authority for live facts, country eligibility, MOQ, policy, pricing, persisted projection, and rehydration.
- `customBlendService.ts`: route-facing facade and cart create/replace orchestration.
- Transport schemas/constants: `packages/contracts/src/customBlends.ts`. HTTP schemas/error mapping: `apps/api/src/routes/customBlends.ts`. Composition: `apps/api/src/app.ts`.

## Invariants

- Keep compatibility and pigment policy API-private and out of SQL and web code. Repository returns candidates; resolver decides policy.
- Structural percentage/count bounds come from `@shop/contracts`; do not redefine them locally.
- Bases exclude `pigments` and `absorbents`. Compatibility is directional. Pigment cap applies to combined pigment ingredients.
- Candidate lots must be active, default (`sort_order = 1`), supported, and exactly 25 kg.
- Sold-out ingredients remain valid recipe facts; only base inventory supplies made-to-order demand.
- `configKey`: lowercase SHA-256 of canonical ingredient specification sorted by variant ID. Base presentation, price, quantity, classification, and other derived facts never enter hash.
- Result classification is `food` only when every component is food; every other combination is `non-food`.
- Price each component from its own weight, tier, and active clearance. Add blend fee once per line; never discount it.
- Persist legacy specification shape only. Re-resolve quantity-specific facts from current data for cart/checkout; preserve frozen resolved order facts and legacy snapshot compatibility.
- Use injected application clock for clearance-sensitive resolution.

## Testing

- Focused unit suite: `npm exec -w @shop/api -- tsx --test "src/features/customBlend/*.test.ts"`
- Update `customBlendRules.test.ts` for pure policy/pricing and `customBlendResolver.test.ts` for live-fact resolution.
- Cross-layer rule, persistence, or checkout changes also require Custom Blend integration coverage under `apps/api/test`.

## Pitfalls

- Do not push compatibility filtering into `customBlendRepository.ts`; non-SQL repositories and rehydration must pass the same resolver policy.
- Do not reject an ingredient solely for zero stock; that changes base-only inventory semantics.
- Do not persist resolved live pricing as editable cart specification; stale facts must be re-evaluated before payment.
- Freshly build `@shop/contracts` before focused runtime tests; ignored `packages/contracts/dist` may otherwise expose stale exports.
