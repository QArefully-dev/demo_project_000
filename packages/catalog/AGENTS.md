# packages/catalog

Canonical seed catalog. Consumed by `apps/api/src/db/seed.ts`; live runtime data lives in SQLite.

## Invariants

- `src/validateCatalog.ts` enforces: exact per-category product counts, canonical id pools, unique slug/imageSetId (kebab-case), SKU format `^[A-Z]{3}-\d{4}-\d{3}$` with fixed prefix per category file, required per-category facts, bundle SKU references.
- New product -> unused id from canonical pool + matching entry in `CATALOG_CREATED_AT_BY_ID` (`src/model.ts`); category counts must stay exact -> adding requires removing/redistributing.
- Products pass through `industrializeProducts()` (`src/model.ts`): forces exactly 2 variants (25kg sack, 1000kg pallet), strips "powder"/"powdered" from name/description.
- Pricing: `makeVariant` takes sack unit price in pence, derives sack/pallet prices. Never hand-author pallet price.

## Testing

- `npm run test -w @shop/catalog` (runs from src, no build).

## Pitfalls

- Renaming/removing SKU breaks `src/bundles.ts` references.
- "powder" naming in api (`powderCatalog.ts`, powderizer migrations) is legacy brand residue; keep unless task says otherwise.
