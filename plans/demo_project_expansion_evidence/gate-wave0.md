# Gate Wave 0 — Verification

**Date**: 2026-07-11
**Gate**: wave0-gate
**Result**: **PASS**

## Status Check

| Property | Expected | Actual |
|----------|----------|--------|
| wave0 state | complete | complete |
| Merge SHA | c2dce42 | c2dce42 |
| Evidence file | plans/demo_project_expansion_evidence/wave0.md | exists ✓ |

## Command Verification

| Command | Result |
|---------|--------|
| `npm run typecheck` | passed — contracts, api, web all clean |
| `npm run lint` | passed — no errors |
| `npm run format` | passed — all files conform |

## Evidence File Contents

Wave 0 evidence (`wave0.md`) confirms:
- Worker SHA: `45645a6` (feat: wave0 foundations and seams) + `83c1002` (lint/format fixes)
- Base SHA: `fac8595` (bootstrap integration)
- Seed verification: 45 products, 3 users, 7 promos, 3 favourites
- Review findings: no blocking findings; all acceptance criteria met
- Residual risks: none
