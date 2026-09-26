# packages/localisation

## Messages

- One catalog per domain `src/messages/<domain>.ts` via `defineMessages()`. Every key needs all 7 `SUPPORTED_COUNTRIES`; plural shape and `{placeholder}` set must match UK canonical. Violations throw at import time, caught by package tests, not `check:localisation`.
- `translate()` throws on unknown key/country/missing param; no fallback by design.
- Country resolved by caller (api `countryContext`, web `CountryContext`); package maps `Country` -> `countryProfile()` from contracts.
- `src/messages/apiErrors.ts`: codes without explicit override get heuristic English text + generic per-language sentence. New public error code -> add English and localised overrides.

## Formatting

- All `Intl.*` / `toLocale*` calls live here only (`check:localisation` rule `display-intl`).
- `formatMoney.ts`: input GBP pence. `formatDisplayMoney` converts via profile exchange rate (bigint half-up); `formatSettlementMoney` raw GBP; `formatDualTotal` shows settlement too when display currency not GBP.
- Dates: `formatInstant` (profile time zone) vs `formatCivilDate` (`YYYY-MM-DD`, UTC, no time preset).
- Numbers: fixed presets only (`decimal`, `count`, `weight`).

## check:localisation

- `scripts/check-localisation-core.mjs` AST-scans `apps/` + `packages/`: JSX text, visible props, error setters, direct Intl, literal route errors, literal presentation maps / generated message writes.
- `scripts/localisation-fixtures/` = intentional violations; checker self-tests against them first. Never fix or localise them.

## Pitfalls

- Adding country -> `Country` union + `SUPPORTED_COUNTRIES` + profile in `packages/contracts`, every catalog entry, `apiErrors.ts` language defaults, and hand-maintained `isCountry()` list in `src/formatDate.ts`.
