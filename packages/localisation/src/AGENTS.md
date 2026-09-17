# AGENTS.md — packages/localisation/src

Country-aware display copy and formatting (see root AGENTS.md for repository-wide architecture).

## Local scope

- index.ts re-exports `defineMessages`, `translate`, `formatMoney`, `formatDate`, `formatNumber`. Per-feature message modules live in messages/<name>.ts (e.g. messages/customBlend.ts); new modules must be re-exported from index.ts and added to the `exports` map in packages/localisation/package.json.
- Message shape: `defineMessages()` maps key -> country-keyed strings; every key requires all countries (UK, US, CN, PL, ES, DE, FR). `{param}` placeholders interpolate via `translate(messages, country, key, params)`.
- Pricing, settlement, refunds, receipts stay integer GBP pence regardless of locale — only display formatting (`formatMoney`) is country-aware.

## Commands

- `npm run check:localisation` (scripts/check-localisation.mjs, scripts/check-localisation-core.mjs) verifies every key has all countries and public-error coverage; run after adding or editing messages.

## Pitfalls

- Missing a country entry for a key, or forgetting the index.ts re-export/package.json exports entry, fails `npm run check:localisation` or the build, not just runtime.
