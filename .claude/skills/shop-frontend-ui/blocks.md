# Free ecommerce block sources

Pre-built shadcn/ui + Tailwind blocks to copy into `apps/web`. Prefer free sources.
Copy the markup, then wire to real `contracts` types. Do not pull in paid/Pro-locked blocks for the clean baseline.

## Sources (free)
- CommerCN → https://commercn.com/ — shadcn ecommerce blocks: product grid, product detail, cart, checkout.
- shadcn Studio blocks → https://shadcnstudio.com/blocks — 800+ blocks incl. free product/cart/order sections.
- shadcn/ui official blocks → https://ui.shadcn.com/blocks — dashboards, forms, auth (checkout forms, order tables).

## Section → block mapping
- catalog (product listing) → product grid / product card blocks → `apps/web/src/features/catalog/`
- catalog (single product) → product detail block → `features/catalog/`
- cart → cart drawer/sheet or cart page block → `features/cart/`
- checkout → checkout form + order summary block → `features/checkout/` (validation stays in `cartValidation.ts`)
- order confirmation → order summary / receipt block → `features/checkout/` or `pages/`

## Reference-only (paid — do not ship in clean clone)
- TailwindPlus (ex Tailwind UI) ecommerce → paid license.
- Shadcnblocks Pro catalog → mostly paid.
