# e2e

Playwright specs driving the real browser against the web app, so requests travel browser -> Vite proxy -> API. Only layer that proves the full stack wires up. Not an npm workspace.

`e2e/README.md` holds machine setup, the run recipes, and the agent browser-driving policy (`@playwright/cli`, not `playwright-mcp`). Read it before adding specs; rules below are the ones code does not enforce.

## Layout

- `*.spec.ts` — specs, one per feature area. Assertions live here.
- `pages/` — page objects: locators and navigation only, no assertions. Expose `Locator`s, return page objects.
- `config.ts` — `BASE_URL` (`E2E_BASE_URL`), `API_URL` (`E2E_API_URL`).
- `global-setup.ts` — polls `${API_URL}/health` before any spec runs.
- Runner config is at repo root: `playwright.config.ts` (`testDir: './e2e'`, chromium only, `fullyParallel`, 30s test / 10s expect timeouts).

## Prerequisites

`npx playwright install chromium` once per machine. Chromium only — extra engines are downloads that fail on conference wifi.

No manual server start needed: `playwright.config.ts` runs `npm run dev` itself with `reuseExistingServer: true`. A cold start seeds SQLite and can take a minute (180s webServer timeout).

## Required patterns

- Locate by role, label, or placeholder. Never add `data-testid` to application code — the app is richly labelled.
- Web-first assertions (`await expect(locator).toHaveText(...)`). Never `waitForTimeout`.
- Avoid `.first()` on a locator meant to identify one thing; scope it instead, or an ambiguous match stays hidden.
- Assert a result count, not just that one row exists, so a broken filter fails the spec.
- Pin seeded-data facts to named constants with a comment noting they come from the seed.
- `API_URL` is for readiness checks only. Never assert against the API directly — that bypasses the proxy path the suite exists to prove.

## Pitfalls

- Vite listens before Fastify does. Without the `global-setup.ts` health gate, specs start while `/api` requests still fail through the proxy, producing empty pages that look like assertion bugs.
- Seeded-data drift breaks count assertions. `npm run reset` restores the known state (destructive: all user-created data lost).
- `@playwright/cli` writes `.playwright-cli/` into the working directory. Gitignored, but `e2e/README.md` advises running it from outside the repo.
- No customBlend spec or page object exists yet — only catalog and home. Adding one starts from scratch in `pages/`.
