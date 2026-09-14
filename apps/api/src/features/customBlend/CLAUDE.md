# customBlend (API)

Authoritative Custom Blend domain: candidate lookup, blend policy, resolution/snapshotting, cart-mutation orchestration. Web mirrors structural bounds only. Requirements: `workshop/feature-ticket.md` (QME-418).

## Layer order

SQL -> rules -> resolver -> service -> route. Each file owns exactly one level:

- `customBlendRepository.ts` — SQL only. Filters are limited to presentation search. Compatibility and pigment policy belong to the resolver, never to SQL.
- `customBlendRules.ts` — pure policy and pricing: normalisation, compatibility, pigment cap, classification, tier pricing, canonical JSON hashing. Reuses `../pricing/clearanceRules.js` and `../pricing/pricingRules.js` rather than reimplementing pricing.
- `customBlendResolver.ts` — combines repository + rules into resolved snapshots. Owns `CustomBlendResolverError` and an injectable `CustomBlendResolverClock`.
- `customBlendService.ts` — public surface. Maps resolver errors to `CustomBlendInvalidError` (carrying `resolverCode`, `maxPercentage`, `actualPercentage`), applies country blocking, delegates cart writes.

Not here: TypeBox route schemas (`apps/api/src/routes/customBlends.ts`), DI wiring (`apps/api/src/app.ts`), cart persistence and its transaction (`apps/api/src/features/cart/cartService.ts` via `addConfigured`/`replaceConfigured`), user-facing copy (`packages/localisation`).

## Required patterns

- The directional compatibility matrix is deliberately private to `customBlendRules.ts`. Clients may render the server verdict but must never receive or duplicate the matrix. Same for pigment policy and classification.
- Factory functions with constructor-injected dependencies (`createCustomBlendRepository`, `createCustomBlendResolver`, `createCustomBlendService`). No module-level singletons.
- Country is threaded explicitly through every read (`listBases`, `listOptions`, `evaluate`); it is resolved upstream by `apps/api/src/plugins/countryContext.ts` into `request.resolvedCountry`.
- `AuditContext` (`../audit/auditEvent.js`) is threaded into every mutation.
- Errors leave this feature as typed domain errors and become HTTP responses only at the route through `sendPublicError`.

## Testing

Colocated `customBlendRules.test.ts` and `customBlendResolver.test.ts`: pure `node:test` + `node:assert/strict`, importing the module under test directly. No database, no Fastify. They run inside the API `src/**/*.test.ts` unit glob.

`customBlendRepository.ts` and `customBlendService.ts` have no colocated unit tests — they are covered only by `apps/api/test/customBlend/*.integration.test.ts`.

## Pitfalls

- `createCustomBlendService`'s repository overload defaults the clock to epoch (`new Date(0)`). Calling it with a repository and no clock silently resolves every clearance window against 1970. `apps/api/src/app.ts` passes an explicit resolver and clock; ad-hoc and test callers must too.
- `CUSTOM_BLEND_RULE_VERSION` plus the canonical-JSON hashing in `customBlendRules.ts` determine persisted blend identity. Changing normalisation or canonicalisation silently breaks compatibility with existing cart and order lines; `LegacyCustomBlendSnapshot` exists for versioned snapshot handling.
- `customBlendRepository.ts` builds SQL placeholders from the length of `MIXING_GROUPS`. Adding a mixing group changes SQL arity and the compatibility matrix together.
