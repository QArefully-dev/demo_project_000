# QArefully Powder Co.

QArefully Powder Co. is a local, non-live powder shop built for QA education and repository-scale engineering exercises. Browse credible pantry powders, questionable household powders, and impossible powders; every customer journey runs without external services.

## Prerequisites

- **Node.js 22 LTS (22.x)** ([download](https://nodejs.org))
- No Docker, no global packages, no API keys required

## Quick Start

```bash
git clone <repo-url>
cd demo_project_000
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

`npm ci` installs the locked dependencies and builds the shared contracts and catalog packages automatically.

## What's Running

| Service       | Port | URL                   |
| ------------- | ---- | --------------------- |
| Web (Vite)    | 5173 | http://127.0.0.1:5173 |
| API (Fastify) | 3001 | http://127.0.0.1:3001 |

The web app proxies `/api/*` requests to the API server automatically.

## Database

SQLite database is created automatically on first `npm run dev` at `data/shop.db`.

- Database location can be overridden via `SHOP_DB_PATH` environment variable.
- WAL mode enabled for better concurrent read performance.

## Scripts

| Script               | Description                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Seed database (if needed), start API + web together                                                 |
| `npm run seed`       | Idempotent seed — upserts canonical products + promo code on every startup, non-seed rows preserved |
| `npm run reset`      | Clear all data and re-seed to known state                                                           |
| `npm run typecheck`  | Run TypeScript type-checking across all workspaces                                                  |
| `npm test`           | Run all workspace test suites                                                                       |
| `npm run test:unit`  | Run web and API unit tests                                                                          |
| `npm run test:integration` | Run API SQLite integration tests                                                            |
| `npm run smoke`      | Run typecheck plus unit and integration tests                                                      |
| `npm run lint`       | Run ESLint checks                                                                                     |
| `npm run format`     | Check formatting with Prettier                                                                      |
| `npm run format:fix` | Auto-fix formatting with Prettier                                                                   |
| `npm run verify`     | Run format, typecheck, lint, tests, and every workspace build                                       |

All scripts run via `npm run` — no separate shell scripts directory needed.

## Architecture

Dependencies flow one way: `@shop/contracts` owns shared request and response schemas, `@shop/catalog` owns canonical catalog and packaging data, the API owns persistence and workflows, and the web app consumes API contracts only. The browser validates every successful API response against its shared schema before feature code receives it. Packages and scripts cannot import app-private source; the web app cannot import API source.

Checkout is a server-owned payment-intent workflow. The API validates the cart, promo, customer details, and card before it reserves the cart and promo capacity, persists an immutable quote, and calls the simulated gateway with that quote total. Finalization creates the order from the saved quote, so later cart changes cannot alter an authorized payment.

Each checkout request includes an idempotency key. Retrying the same key with the same request replays a completed outcome or safely resumes an authorized finalization; using the same key with different checkout data returns a conflict. Card numbers and CVC values are not stored in quotes, fingerprints, or payment responses.

## Features

- **Product catalog** with search, category filter, sale filter, and sort (newest, price, bestselling)
- **Product detail** pages with related products, sale badges, and bestseller badges
- **Shopping cart** with quantity controls, subtotal display, and 5-item minimum promo gate
- **Checkout** with contact/shipping details and promo code entry
- **Payment** with simulated gateway (test cards below), order confirmation, and email receipt
- **Order history and lifecycle** with simulated shipments, tracking timelines, and eligible-order cancellation
- **User accounts**: sign up, log in, log out, forgot/reset password via dev mailbox
- **Favourites / wishlist** with heart toggle and wishlist page
- **Account page** with password change
- **Dev mailbox** for inspecting system emails and reset-password links

## Seeded Data

- **50 products** across 7 powder categories: Pantry Staples, Performance, Drinks, Household, Outdoors, Questionable, and Impossible
- **14 sale products** with compare-at prices
- **3 users** (credentials below)
- **7 promo codes** (details below)

The catalog moves from everyday powders to deliberate nonsense. Household, conceptual, and impossible products are clearly marked “Not for consumption.” `Powdered Water` is the featured bestseller.

### User Credentials

| Email               | Password      | Role     |
| ------------------- | ------------- | -------- |
| alice@example.com   | Password123!  | customer |
| bob@example.com     | Password123!  | customer |
| admin@example.com   | Password123!  | admin    |

Alice has 3 pre-seeded favourite products.

### Order Lifecycle Fixtures

`npm run reset` restores four local-demo order scenarios. Normal `npm run seed` inserts a missing scenario once and never overwrites a lifecycle change made afterwards.

- Alice: `alice-processing` â€” eligible for simulated cancellation
- Alice: `alice-packed` â€” eligible for simulated cancellation before shipment
- Alice: `alice-split-shipped` â€” one delivered parcel and one in-transit parcel, including a Powderizer line
- Alice: `alice-delivery-failed` â€” simulated delivery failure
- Bob: `bob-delivered` â€” delivered parcel

Signed-in customers can browse `/orders` and open their own `/orders/:orderId` detail pages. Bob cannot access Alice's orders. A guest checkout confirmation is available only through its short-lived, exact-order browser cookie; there is no guest history or guest cancellation.

Order state, tracking references, delivery events, and inventory are local simulation data. Checkout holds local stock in a 15-minute reservation while payment is processed, then consumes only the reserved quantity after simulated authorization. Eligible products may show as available to backorder when local stock is exhausted; an administrator's local stock receipt fulfills waiting quantities FIFO. None of this represents carrier service, supplier inventory, dispatch, delivery, or notifications. An owner can cancel only while an order is `processing` or `packed` and no shipment has left; cancellation returns unshipped ordinary local stock to inventory and does not refund, alter payment, totals, promo use, or purchased snapshots.

### Admin Lifecycle API (Local Simulation)

There is intentionally no operations UI. Sign in as `admin@example.com`, retain the session cookie, and use these local API commands with a fresh UUID `idempotencyKey` and the current order or shipment `version` from `GET /api/orders/:orderId`. For packing, copy an exact `lineKind` and `lineId` from that response; do not invent line IDs.

```http
POST /api/admin/orders/:orderId/shipments
Content-Type: application/json

{
  "version": 0,
  "idempotencyKey": "00000000-0000-4000-8000-000000000201",
  "shipments": [{
    "trackingReference": "QA-LOCAL-001",
    "lines": [{
      "lineKind": "product",
      "lineId": "<GET /api/orders/:orderId -> items[n].lineId>",
      "quantity": 1
    }]
  }]
}
```

```http
POST /api/admin/order-shipments/:shipmentId/transition
Content-Type: application/json

{
  "version": 0,
  "status": "shipped",
  "idempotencyKey": "00000000-0000-4000-8000-000000000202"
}
```

```http
POST /api/admin/order-shipments/:shipmentId/tracking-events
Content-Type: application/json

{
  "version": 1,
  "code": "in_transit",
  "title": "In transit",
  "detail": "Simulated local-demo update.",
  "location": "Demo transit hub",
  "idempotencyKey": "00000000-0000-4000-8000-000000000203"
}
```

Shipment transitions are `packed -> shipped -> delivered` or `packed -> shipped -> delivery_failed`. Payloads use server-owned timestamps; changing an idempotency key payload or sending a stale version returns a conflict.

### Admin Inventory Receipt API (Local Simulation)

There is no inventory UI. Sign in as `admin@example.com`, retain the session cookie, and record a local stock receipt with a fresh UUID `idempotencyKey`. The command immediately allocates the oldest eligible backorders first, then leaves any remainder as local stock.

```http
POST /api/admin/inventory/receipts
Content-Type: application/json

{
  "productId": "49",
  "quantity": 5,
  "idempotencyKey": "00000000-0000-4000-8000-000000000204"
}
```

Replaying the exact receipt key returns its original result; changing its product or quantity returns a conflict. This is a local-demo stock command only, not a supplier, warehouse, or fulfilment integration.

### Returns and Refunds (Local Simulation)

Delivered ordinary products can be returned within a 30-day window measured from the exact delivery event time. Custom Powderizer mixes are excluded from returns. The workflow is:

1. **Customer** opens a delivered order detail page, selects eligible quantities, chooses a reason, optionally adds a note, and submits the request.
2. **Admin** approves or rejects the request, receives the returned items, and issues a simulated refund.

There is intentionally no admin UI. Sign in as `admin@example.com`, retain the session cookie, and use these local API commands with a fresh UUID `idempotencyKey` and the current return `version` from `GET /api/admin/returns`.

#### List returns (admin)

```http
GET /api/admin/returns?status=requested&page=1&pageSize=10
```

#### Approve or reject a return (admin)

```http
POST /api/admin/returns/:returnId/decision
Content-Type: application/json

{
  "version": 1,
  "idempotencyKey": "00000000-0000-4000-8000-000000000301",
  "decision": "approve"
}
```

#### Receive returned items (admin)

```http
POST /api/admin/returns/:returnId/receive
Content-Type: application/json

{
  "version": 2,
  "idempotencyKey": "00000000-0000-4000-8000-000000000302"
}
```

#### Issue simulated refund (admin)

```http
POST /api/admin/returns/:returnId/refund
Content-Type: application/json

{
  "version": 3,
  "idempotencyKey": "00000000-0000-4000-8000-000000000303"
}
```

Refunds are simulated only — no real money, postage, carrier, or payment gateway is involved. Refund amounts are calculated from the original purchase price and order discount, prorated across returned quantities. The original order totals, payment row, and promotion redemptions are never modified.

#### Testing return flow

- `bob-delivered` order (Bob, Password123!) has a delivered Protein Powder shipment and a pre-seeded completed/refunded return for inspection.
- To create a fresh eligible order: use the admin lifecycle API to advance any order to delivered within the last 30 days, then sign in as the order owner.
- The return window is 30 days from the exact shipment delivery event. Once expired, the order shows no eligible items.

### Promo Codes

| Code      | Type    | Value | Notes                               |
| --------- | ------- | ----- | ----------------------------------- |
| `SAVE10`  | Percent | 10%   | Min 5 items in cart                 |
| `SAVE20`  | Percent | 20%   | Min subtotal $100.00                |
| `WELCOME5`| Fixed   | $5.00 | Per-user limit: 1                   |
| `VIP15`   | Percent | 15%   | No restrictions                     |
| `EXPIRED10`| Percent| 10%   | Already expired — always rejected   |
| `SOON10`  | Percent | 10%   | Not yet active — always rejected    |
| `LIMITED5`| Percent | 5%    | Exhausted (0 redemptions left)      |

### Test Payment Cards

Use card number `4242 4242 4242 4242` for successful payments.
Use `4000 0000 0000 0002` to simulate a declined card.
Use `4000 0000 0000 0069` to simulate a gateway timeout (250ms delay).
Any other valid Luhn card number will also succeed.

Expiry: any future date (MM/YY). CVC: any 3 or 4 digits.

### Dev Mailbox

Visit [http://127.0.0.1:5173/mailbox](http://127.0.0.1:5173/mailbox) to inspect system emails. After a forgot-password request, a reset link appears here. Click it to reset the password.

## Reset to Known State

```bash
npm run reset
```

This clears all tables and re-seeds the database. Use this if data gets corrupted or you want a fresh start.

## Troubleshooting

### `better-sqlite3` fails to install

The `better-sqlite3` package requires native build tools:

- **Windows:** Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with "Desktop development with C++" workload.
- **macOS:** Install Xcode Command Line Tools: `xcode-select --install`

### Port 3001 or 5173 already in use

```bash
# Windows (PowerShell)
netstat -ano | findstr :3001

# macOS / Linux
lsof -i :3001
kill -9 <PID>
```

### Permission denied on `data/` directory

The API creates a `data/` directory for the SQLite database. If you see permission errors:

- Ensure you have write permissions in the project directory.
- On macOS, check that the directory isn't in a restricted location (e.g., iCloud-synced Desktop/Documents with strict permissions).

## Project Structure

```
demo_project_000/
├── apps/
│   ├── api/          # Fastify API server (port 3001)
│   └── web/          # React + Vite frontend (port 5173)
├── packages/
│   ├── catalog/      # Canonical catalog and packaging data
│   └── contracts/    # Shared transport schemas and types
├── scripts/          # Repository quality checks
├── data/             # SQLite database (auto-created)
└── plans/            # Design and implementation plans
```
