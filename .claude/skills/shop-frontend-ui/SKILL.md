---
name: shop-frontend-ui
description: Build good-looking shop UI fast for the apps/web React+Vite+TS frontend by composing shadcn/ui + free pre-built ecommerce blocks (product grid, cart, checkout, order summary). Use when creating or restyling any storefront page, product card, cart, or checkout UI. Compose blocks, do not hand-design from scratch.
---

# Shop Frontend UI

Fast path to a polished storefront for **Shop Qarefully**. Goal: great-looking demo UI quickly.
NOT a design-lead exercise → skip brainstorm/critique loops. Compose pre-built blocks, adjust tokens, ship.

## When to use
- Any UI in `apps/web/src/` → storefront pages, product cards/grid, cart, checkout, order summary.
- Restyling existing shop pages.

## Workflow (compose, don't design)
1. Identify the section → catalog / cart / checkout / order (map to `apps/web/src/features/`).
2. Pull a matching pre-built block from a free source → see [blocks.md](blocks.md).
3. Paste into a component under `apps/web/src/components/` or the relevant `features/*` folder.
4. Wire to real data via the `contracts` package types (prices = integer minor units, backend-authoritative).
5. Swap block's placeholder tokens for project tokens → see "Design tokens" below.
6. Check responsive (mobile → desktop) + visible keyboard focus. Done. No second critique pass.

## Stack assumptions
- React + Vite + TypeScript. Tailwind + shadcn/ui as the component base.
- One-time setup if not present → see "Setup" below.

## Setup (run once, only if apps/web lacks it)
```bash
# from apps/web
npm i -D tailwindcss @tailwindcss/vite
npx shadcn@latest init      # creates components.json + base tokens
npx shadcn@latest add button card badge input separator sheet
```
- After `components.json` exists, the official shadcn skill (`pnpm dlx skills add shadcn/ui`)
  auto-activates and installs/composes components correctly. This skill covers block selection.

## Design tokens (keep it simple)
- Define palette + type once in the Tailwind/shadcn theme, not per-component.
- Money → format from integer minor units at the view layer only; never compute totals in the web app.
- Pick a non-generic display font (avoid Inter/Roboto default) → one display + one body face is enough.

## Quality bar (demo, not enterprise)
- Looks modern + consistent + responsive → yes.
- Accessible enough: real buttons/labels, visible focus, alt text → yes.
- Perfect a11y audit, exhaustive edge states, micro-animations → not required.

## Project guardrails (see CLAUDE.md)
- Author-side workflow. Keep block-library credentials/config out of the clean M1 student clone.
- Don't expose later-module revelations in earlier UI/copy/filenames.
- Never invent prices, limits, discounts → use contracts/API values or state as unverified.
- Self-document via component + prop names; comments only when necessary.
