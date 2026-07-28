---
name: shop-frontend-ui
description: Build good-looking shop UI fast for the apps/web React+Vite+TS frontend by locking one project-wide design token system (via frontend-design), then composing shadcn/ui + free pre-built ecommerce blocks (product grid, cart, checkout, order summary) against it. Use when creating or restyling any storefront page, product card, cart, or checkout UI. Compose blocks for structure, do not hand-design each one from scratch.
---

# Shop Frontend UI

Fast path to a polished storefront for **Shop Qarefully**. Goal: great-looking demo UI quickly.
NOT a per-component design-lead exercise → skip per-block brainstorm/critique loops.
But: default shadcn/block look = generic. Lock taste ONCE via `frontend-design`, then compose blocks against it, adjust, ship.

## When to use

- Any UI in `apps/web/src/` → storefront pages, product cards/grid, cart, checkout, order summary.
- Restyling existing shop pages.

## Workflow (lock tokens once, then compose, don't design)

0. **Project has no locked tokens yet?** Run the `frontend-design` skill ONCE for the whole storefront (not per-component, not per-page) to produce: 4–6 named hex palette, a deliberate display+body font pairing, one signature element the shop is remembered by. Write the result into the Tailwind/shadcn theme (see "Design tokens" below). Skip this step if tokens are already locked — reuse them.
1. Identify the section → catalog / cart / checkout / order (map to `apps/web/src/features/`).
2. Pull a matching pre-built block from a free source → see [blocks.md](blocks.md).
3. Paste into a component under `apps/web/src/components/` or the relevant `features/*` folder.
4. Wire to real data via the `contracts` package types (prices = integer minor units, backend-authoritative).
5. Re-tokenize: swap the block's placeholder colors/fonts/radii for the locked project tokens from step 0 — never ship a block's default palette/type as-is. See "Design tokens" below.
6. Check responsive (desktop-first, target 1440x900 per CLAUDE.md) + visible keyboard focus. Done. No second critique pass per block — the critique already happened once in step 0.

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

## Design tokens (keep it simple, decide once via frontend-design)

- Palette, type pairing, and the signature element are decided by the `frontend-design` skill (step 0), not improvised here. This skill only wires the result into Tailwind/shadcn theme vars and reuses it project-wide.
- Once locked, define palette + type once in the Tailwind/shadcn theme, not per-component. Every block re-tokenizes to these, no exceptions.
- Money → format from integer minor units at the view layer only; never compute totals in the web app.
- Banned defaults (per `frontend-design`) → do not land on these by default, they read as AI-slop: (1) warm cream `#F4F1EA` + high-contrast serif + terracotta accent; (2) near-black + single acid-green/vermilion accent; (3) broadsheet hairline rules + zero-radius + newspaper columns. Fine only if the brief truly calls for one.
- Block placeholder styles (shadcn defaults, block-source demo colors/fonts) are a starting shape only → always re-tokenize to the locked palette/type before shipping, never ship as-is.

## Quality bar (demo, not enterprise)

- Looks modern + consistent + responsive → yes.
- Accessible enough: real buttons/labels, visible focus, alt text → yes.
- Perfect a11y audit, exhaustive edge states, micro-animations → not required.

## Project guardrails (see CLAUDE.md)

- Author-side workflow. Keep block-library credentials/config out of the clean M1 student clone.
- Don't expose later-module revelations in earlier UI/copy/filenames.
- Never invent prices, limits, discounts → use contracts/API values or state as unverified.
- Self-document via component + prop names; comments only when necessary.
