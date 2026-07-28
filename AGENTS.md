# Agents

This repository is a monorepo for `shop-qarefully`, a local QA-focused ecommerce demo with two main app workspaces:

- `apps/api` — Fastify API server, SQLite persistence, auth, checkout, orders, inventory, returns, admin simulation.
- `apps/web` — React/Vite storefront, catalog, cart, checkout, account, orders, favourites.

Shared packages:

- `packages/contracts` — typed request/response schemas and shared API contracts.
- `packages/catalog` — canonical product catalog, bundles, pricing, categories.

## Agent guidance

- Prefer changing existing files over creating new ones unless a missing feature or documentation is required.
- Use repository scripts when verifying behavior:
  - `npm run dev` to start the app locally
  - `npm run test`, `npm run test:unit`, `npm run test:integration`
  - `npm run lint`, `npm run format:fix`
- Keep answers short and actionable.
- Avoid inventing external services or integrations. This app is self-contained and simulates commerce locally.

## Recommended workflow

1. Inspect `apps/api/src` for backend logic and data flows.
2. Inspect `apps/web/src` for frontend components and API consumption.
3. Use `packages/contracts` for request/response shapes.
4. Use `packages/catalog` for product and bundle model logic.

## When editing

- Maintain the repo's existing TypeScript-first conventions.
- Validate changes with the appropriate tests when possible.
- Prefer existing package and workspace scripts over adding custom tools.

## Useful references

- `package.json` at repo root defines workspace scripts and engine constraints.
- `apps/api/package.json` and `apps/web/package.json` define package-specific dependencies and commands.
- `apps/web/src` contains the React application entrypoint and feature modules.
- `apps/api/src` contains the backend service implementation and routes.
- `packages/contracts/src` defines the shared API contracts used by both API and web.
- `packages/catalog/src` defines the product catalog data model and helper logic.

## Expectations

- Treat this repo as a QA/demo storefront, not a production ecommerce platform.
- Answer questions using local code and available repo conventions.
- Do not assume external deployment, cloud services, or real payment gateways.
