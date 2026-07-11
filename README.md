# Shop Qarefully v000

Small e-commerce learning-demo application — local setup only, no external services.

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

`npm ci` installs the locked dependencies and builds the shared contracts package automatically.

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
| `npm run lint`       | Run ESLint across entire project                                                                    |
| `npm run format`     | Check formatting with Prettier                                                                      |
| `npm run format:fix` | Auto-fix formatting with Prettier                                                                   |

All scripts run via `npm run` — no separate shell scripts directory needed.

## Features

- **Product catalog** with search, category filter, sale filter, and sort (newest, price, bestselling)
- **Product detail** pages with related products, sale badges, and bestseller badges
- **Shopping cart** with quantity controls, subtotal display, and 5-item minimum promo gate
- **Checkout** with contact/shipping details and promo code entry
- **Payment** with simulated gateway (test cards below), order confirmation, and email receipt
- **User accounts**: sign up, log in, log out, forgot/reset password via dev mailbox
- **Favourites / wishlist** with heart toggle and wishlist page
- **Account page** with password change
- **Dev mailbox** for inspecting system emails and reset-password links

## Seeded Data

- **45 products** across 10 categories: Audio, Peripherals, Displays, Accessories, Storage, Networking, Power, Cables, Wearables, Smart Home
- **14 sale products** with compare-at prices
- **3 users** (credentials below)
- **7 promo codes** (details below)

### User Credentials

| Email               | Password      | Role     |
| ------------------- | ------------- | -------- |
| alice@example.com   | Password123!  | customer |
| bob@example.com     | Password123!  | customer |
| admin@example.com   | Password123!  | admin    |

Alice has 3 pre-seeded favourite products.

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
│   └── contracts/    # Shared TypeScript types & schemas
├── data/             # SQLite database (auto-created)
└── plans/          # Design & implementation plans
```
