# localisation source

Owns country-aware translation and money/date/number presentation for the whole repository. Consumed by `apps/web` and `apps/api`. Depends on `@shop/contracts` only.

## Layout

- `index.ts` — barrel re-exporting `defineMessages`, `translate`, and the three formatters.
- `messages/defineMessages.ts` — catalogue factory plus runtime validation.
- `translate.ts` — resolution, interpolation, `Intl.PluralRules` selection via `countryProfile(country)`.
- `formatMoney.ts`, `formatDate.ts`, `formatNumber.ts` — locale-aware formatters.
- `messages/*.ts` — one catalogue per feature area.

Not here: presentation components, business policy, app source imports.

## Required patterns

- Build every catalogue with `defineMessages({...})`. Keys are dotted (`customBlend.title.new`).
- Every key must define all 7 countries (`UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`). Plural shape must match the `UK` entry; placeholder sets must match `UK` per branch; plurals need a `count` param and an `other` branch. Enforced at runtime and by tests.
- No language fallback, by design. A missing key, country, or param is an error. Adding a country or a key is therefore an all-catalogue change.
- Templates are plain text — do not HTML-escape here. React and API consumers own escaping at their boundary; entity-encoding would render visible angle brackets as literal `&lt;`.
- `translate.ts`, `formatDate.ts`, `formatMoney.ts`, `formatNumber.ts` are the four files allowlisted for direct `Intl` use by the localisation guard. New formatting belongs in these files, not in a caller.
- New public entry point -> add an `exports` subpath in `packages/localisation/package.json`.

## Testing

Tests live in `packages/localisation/test/`, a sibling of `src/`, not colocated. Plain `node:test` + `node:assert/strict` via `tsx` — no vitest, no DOM, no DB.

- `test/localisation.test.ts` — catalogue exhaustiveness and formatters.
- `test/api-errors.test.ts` — every `PUBLIC_ERROR_CODES` entry present in every supported country, plus placeholder-interpolation parity.
- Run: `npm run test -w @shop/localisation`. Single file: `npx tsx --test packages/localisation/test/api-errors.test.ts`
- `packages/localisation/tsconfig.eslint.json` exists solely so ESLint type-checks those test files; `tsconfig.json` includes only `src`.

## Pitfalls

- `defineMessages` validates at import time. A key missing a country throws at module load, so the failure surfaces as an apparently unrelated suite crashing rather than as a targeted assertion.
- Renaming a placeholder in one country only throws `Localisation placeholder mismatch` at import.
- Adding a public error code without an `apiErrors` entry in all 7 countries fails `test/api-errors.test.ts`.
- `packages/localisation/dist` and `tsconfig.tsbuildinfo` are gitignored build output. Edit `src/`, then rebuild — consumers resolve `dist/`.
