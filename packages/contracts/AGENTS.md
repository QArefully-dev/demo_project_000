# packages/contracts

Schema-only leaf package. No business logic.

## Conventions

- Schema + type pair share name: `export const Foo = Type.Object({...}, { additionalProperties: false }); export type Foo = Static<typeof Foo>;`. Exemplar `src/pricing.ts`.
- New domain file -> `export *` in `src/index.ts` (hand-picked exports where names collide, see comments there) + subpath entry in `package.json` `exports`. Consumers import subpaths; missing entry -> resolution failure.
- Breaking change impact: api route typing (compile time) + web `Value.Check` on every response (runtime failure).
- Persisted evolving shapes versioned `...V8/V9/V10` (`src/payments.ts`). New version -> new schema + add to reader union; never mutate or drop old variant.
- `src/publicErrors.ts` `PUBLIC_ERROR_CODES` append-only. Per-code meta closed; unparameterised codes use `EmptyPublicErrorMeta` (avoids leaking resource existence). New code -> also api error text in `packages/localisation/src/messages/apiErrors.ts`.
- `src/version.ts` `CONTRACTS_VERSION` unused marker; not versioning mechanism.

## Testing

- `test/<domain>.test.ts`, `node:test` + `Value.Check`/`Value.Errors`. Run `npm run test -w @shop/contracts`.

## Pitfalls

- Country profiles live here (`src/countryProfiles/`); adding country cascades into localisation (see `packages/localisation/AGENTS.md`).
