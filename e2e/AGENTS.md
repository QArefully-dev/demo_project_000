# AGENTS.md — e2e

Playwright end-to-end tests against the running web app (see root AGENTS.md for repository-wide commands and architecture).

## Local scope

- e2e/config.ts defines `BASE_URL` (web, 5173) and `API_URL` (api, 3001, health-check only — never assert against it directly).
- e2e/global-setup.ts polls `API_URL/health` with exponential backoff (180s timeout) before any spec runs, since Vite binds before Fastify is ready.
- Page objects (e2e/pages/home-page.ts, e2e/pages/catalog-page.ts) encapsulate selectors and actions; add new pages here instead of inlining selectors in spec files.
- Specs assert against documented seeded facts (exact result counts/names) — check e2e/README.md before writing or changing assertions.

## Pitfalls

- Asserting on seeded counts/names without checking e2e/README.md first breaks after `npm run reset` reseeds data.
