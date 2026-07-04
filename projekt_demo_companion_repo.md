# Demo E-commerce App — Phase 1 Plan

Status: ready for Phase 1 implementation.

## Purpose

Build a small, polished e-commerce application that runs locally with minimal setup. The first
phase establishes a dependable product foundation: catalog browsing, cart management, checkout,
promo-code handling, and local data persistence.

The architecture should remain easy to extend without requiring an early service-oriented design
or infrastructure that the application does not yet need.

## Phase 1 goals

- A working storefront with a modern, responsive interface.
- A clear separation between the React frontend and the backend API.
- Local SQLite persistence with repeatable seed data.
- A complete catalog-to-checkout user journey.
- Promo-code validation split sensibly between frontend interaction rules and backend business
  rules.
- One command to start the application after dependencies are installed.
- Reliable setup on Windows and macOS without Docker.

## Phase 1 scope

### Storefront

- Browse a seeded product catalog.
- View product names, images, descriptions, prices, and availability.
- Add products to the cart.
- Change quantities or remove products from the cart.
- Preserve the cart during normal local use.

### Checkout

- Review line items, quantities, subtotal, discount, and total.
- Enter the required customer and shipping details.
- Apply or remove a promo code.
- Place an order and display a confirmation screen.
- Persist the completed order in SQLite.

### Promo-code behavior

- The promo-code field remains visible but is disabled until the cart contains at least five total
  items.
- `SAVE10` applies a 10% discount.
- The checkout summary shows the applied code and discount amount.
- Frontend eligibility logic lives in `cartValidation.ts`.
- Promo definitions, discount calculation, minimum-order rules, and stackability rules are owned
  and validated by the backend.
- The backend remains authoritative even when the frontend prevents an invalid interaction.

### Local data

- Seed a small, stable catalog on first run.
- Seed the supported promo-code definition.
- Store products, promo codes, and orders in SQLite.
- Keep seed operations idempotent so restarting the app does not duplicate data.
- Provide a documented way to reset local data.

## Out of scope for Phase 1

- Real payment processing.
- Production authentication or authorization.
- Inventory reservation and concurrency handling.
- Background workers, queues, or event streaming.
- External email, shipping, or payment integrations.
- Admin tools, returns, reviews, and refunds.
- Deliberate defects, race conditions, and artificially flaky behavior.
- Contract and full end-to-end test suites.

These capabilities may be added later, but Phase 1 should not contain placeholders that complicate
the initial build without supporting current functionality.

## Technical decisions

| Area | Decision | Rationale |
| --- | --- | --- |
| Repository | npm workspaces monorepo | Keeps the frontend, API, and shared code together while allowing additive growth. |
| Frontend | React, Vite, and TypeScript | Fast local startup and a clean boundary between browser and server code. |
| Backend | Fastify and TypeScript | Lightweight API with schema-driven validation and one runtime across the project. |
| Database | SQLite through `better-sqlite3` | Simple local persistence with a familiar relational model. Clean-install verification is required on supported platforms. |
| Shared code | TypeScript package for API contracts and domain types | Prevents duplicated request and response types without moving business logic out of the API. |
| Development runner | Cross-platform npm scripts | Starts the API and frontend together without shell-specific commands. |

If `better-sqlite3` cannot meet the clean-install requirement on the supported Node, Windows, and
macOS combinations, replace it before release with a SQLite option that does not require a local
native compilation toolchain.

## Proposed repository structure

```text
qarefully-shop/
  apps/
    web/
      src/
        features/
          catalog/
          cart/
          checkout/
            cartValidation.ts
        pages/
        components/
    api/
      src/
        db/
        domains/
          catalog/
          cart/
          checkout/
          orders/
          promotions/
        routes/
  packages/
    contracts/
  tests/
    unit/
    integration/
  scripts/
  package.json
  README.md
```

Domain folders are organizational boundaries inside a single API application. They are not
separate services in Phase 1.

## Application boundaries

- The web app owns presentation state, user interaction, and immediate form feedback.
- The API owns business rules, price and discount calculations, validation, and persistence.
- The contracts package contains shared transport types and schemas, not database access or
  business-rule implementations.
- Monetary values are represented as integer minor units, such as cents, throughout the API and
  database.
- Order totals are calculated by the backend from stored product prices; client-submitted totals
  are never trusted.

## Local developer experience

Prerequisite: a supported Node.js LTS release with npm.

```text
npm install
npm run dev
```

`npm run dev` must:

1. Create and seed the database when it does not exist.
2. Start the API and web development servers together.
3. Shut both processes down cleanly when the command is stopped.
4. Work in PowerShell, Command Prompt, and common macOS shells.

The README must document ports, prerequisites, the database location, reset steps, and common
setup failures.

## Phase 1 quality requirements

- TypeScript strict mode is enabled across workspaces.
- API inputs are validated at route boundaries.
- Errors returned to the frontend use a consistent response shape.
- Loading, empty, success, and error states are represented in the UI.
- Core business logic has focused unit tests.
- Catalog, promotion, checkout, and order persistence have API integration tests.
- Seed and reset behavior is repeatable.
- No secrets or machine-specific paths are committed.
- Formatting, linting, type checking, and tests are available through root npm scripts.

## Phase 1 acceptance criteria

Phase 1 is complete when:

1. A fresh clone can be installed and run on supported Windows and macOS environments.
2. The seeded catalog loads through the API and renders in the storefront.
3. A user can build a cart, edit it, and complete checkout.
4. The promo field is disabled below five items and `SAVE10` produces the correct backend-validated
   discount at five or more items.
5. Refreshing or restarting the application does not corrupt or duplicate seed data.
6. A completed order is stored and can be retrieved for the confirmation view.
7. Root lint, type-check, unit-test, and integration-test commands pass.
8. The documented reset process restores a known local state.

## Deferred growth

Future work can add shipping validation, richer order lifecycles, inventory, payments, external
service boundaries, asynchronous processing, and broader test suites. Those additions should be
driven by concrete requirements. Phase 1 only needs clean domain boundaries and stable contracts
that make such growth possible.
