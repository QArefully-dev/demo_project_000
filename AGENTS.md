# Repository Guidance

## Purpose

- Local-only bulk-material wholesale QA portal. No external services.
- Runtime: Node.js `>=22.0.0 <23.0.0`; npm workspaces.
- Web: React/Vite in `apps/web`. API: Fastify/SQLite in `apps/api`.

## Boundaries

- Dependency direction: `packages/*` -> `apps/api` and `apps/web`.
- `packages/contracts`: shared TypeBox transport schemas and types. Never import catalog or app source.
- `packages/catalog`: canonical catalog and packaging facts.
- `packages/localisation`: country-aware copy and formatting.
- `apps/api`: persistence, domain policy, workflows, public-error translation.
- `apps/web`: consume shared contracts through API modules; never import API source.
- Keep relative TypeScript ESM imports suffixed with `.js`.
- Transport-shape changes start in `packages/contracts`; update contract tests and rebuild shared packages before consumer tests.
- User-visible text belongs in localisation message catalogs, not feature literals.

## Commands

- Install and build shared packages: `npm ci`
- Develop: `npm run dev`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- All non-E2E tests: `npm test`
- E2E: `npm run test:e2e`
- Lint: `npm run lint`
- Format check: `npm run format`
- Localisation check: `npm run check:localisation`
- Full non-E2E gate: `npm run verify`

## Testing

- Unit tests stay beside source. API integration tests live in `apps/api/test`; web integration tests use `*.integration.test.{ts,tsx}`.
- Validate narrow changed workspace first; run repository gate for cross-package or cross-layer work.
- API integration fixtures must exercise production app composition over isolated SQLite clones.

## Pitfalls

- `dist/`, `data/`, SQLite files, and test reports are generated or runtime output. Do not edit or commit them.
- Ignored shared-package `dist` can be stale relative to source. Run `npm ci` or rebuild affected packages before diagnosing consumer import/test failures.
- `npm run reset` drops and rebuilds the SQLite database, deleting user-created data. Run only with explicit user authorization.
- `npm run verify` excludes Playwright; run E2E separately when browser journeys change.

## Maintenance

- Update applicable instruction file when code invalidates guidance; durable boundaries, hazards, or sources of truth change; or work reveals reusable lessons, pitfall workarounds, or user instructions. Instruction/evidence conflict -> warn user with "WARNING".
