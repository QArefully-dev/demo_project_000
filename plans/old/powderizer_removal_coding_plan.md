# Powderizer Removal: P5 Convergence

Status: P0-P4 complete, committed in `0f0e534` on `materials_exchange_refactor`. P5 pending explicit authorization. Item 16 (`Custom Blend`) remains blocked on P5.

Scope: close item 11 documentation, generated artifacts, and final verification. Do not reimplement, rename, or preserve Powderizer. No data preservation obligation: local SQLite is disposable.

## Landed decisions

- `powderizer` deleted end-to-end. Migration `021` physically removes its tables, columns, rows, and `demand_kind`; old migrations remain immutable history.
- `Cart.mixItems`, `Order.mixItems`, `OrderLineKind`, `lineKind`, mixing-group errors, and all mix transport/UI paths are deleted.
- Persisted checkout quote is V6 only. Keep version `6`; no old quote parser path.
- `.custom-blend-nav-link`, custom-blend CSS tokens, and keyframes are retained for item 16. Nav entry is intentionally absent.
- `apps/api/src/db/migrate.ts` suspends foreign keys around the migration loop and runs `PRAGMA foreign_key_check` per migration. Future table rebuilds must use this runner; do not toggle `foreign_keys` inside a migration transaction.

## P5

1. Clean generated output, then build all workspaces. Confirm no stale Powderizer artifacts in `apps/api/dist/` or `apps/web/dist/`.
2. Update `CLAUDE.md`:
   - remove the Powderizer legacy-identifier and scheduled-removal paragraphs
   - update repository map: item 11 complete; item 16 input remains `custom_additives_handoff.md`
   - document migration-runner FK suspension and per-migration FK checks
   - correct disposable DB path to `apps/api/data/shop.db`
3. Update `plans/demo_project_high_level_plan.md`:
   - item 11 -> complete
   - remove stale Custom Small Order/Powderizer baseline and domain-list claims
   - item 16 consumes the freed nav slot and preserved CSS
   - migration ceiling -> `021`; refresh affected baseline/LOC figures only if readily measurable
4. Sweep source and current docs for `powderizer`, `powder_mix`, `powderMix`, `custom-powder`, `customPowder`, `mixable`, `mix_unit_grams`, `demand_kind`, `demandKind`.
   - allowed: migrations `008`, `009`, `014`, `015`, `018`, `021`; migration-history tests; `plans/old/**`; historical review artifacts; retained custom-blend CSS
   - investigate every other hit; remove only live residue
5. Run browser journey on loopback: home -> catalog -> lot detail -> cart -> checkout -> payment -> confirmation -> order history -> order detail -> returns. Confirm no nav item, route, link, or help article reaches removed surfaces; no 404 or console errors.
6. Final gate, Node 22:

```powershell
$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH
npm run format
npm run typecheck
npm run lint
npm test
Remove-Item -LiteralPath 'apps/api/data/shop.db' -Force
npm run reset
npm run verify
```

After P5 passes, move this plan to `plans/old/`; leave `custom_additives_handoff.md` in `plans/` for item 16.

## Resolved non-actions

- `PersistedCheckoutQuoteV6.lines` is always empty. Leave it: removing it is a separate persisted-checkout schema change, outside Powderizer convergence.
- `apps/api/src/db/powderCatalog.ts` and its test are canonical catalog compatibility code, not Powderizer. Keep.
- Colocated tests omitted from npm scripts are an intentional/pre-existing course QA gap. Keep.
- Historical Powderizer terms in old plans, review artifacts, and pre-`021` migration tests stay as immutable history.
- `mixItemCount` and removed `MIX_*` audit codes have no live source consumers. No P5 action beyond the sweep.

## Recovery

SQLite recovery: delete `apps/api/data/shop.db`, then run `npm run reset`.
