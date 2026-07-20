# Powder Shop Repurposing Decisions

Status: grilling complete; product shape agreed; implementation not started.

## Purpose

- Runtime: local, deterministic Udemy demo project.
- Primary project user: QA engineer completing exercises and lessons.
- Customer surface: credible familiar webshop.
- Engineering standard: production-grade boundaries despite simulated commerce.
- Change strategy: preserve existing commerce and UI foundations; convert reusable powder-specific work; remove obsolete fiction.

## Brand

- Name: QArefully Powder Co.
- Product model: QArefully own-label range.
- Tone: professional, clear, restrained.
- Humour: none.
- Core message: `Powders for food, performance, home and trade.`
- Supporting message: `Shop QArefully own-label powders with clear specifications, practical pack sizes and dependable product information.`
- Remove: impossible, conceptual, nonsensical, object-powdering products and copy.


## Catalog

- Base products: 100.
- Category model: flat six-category catalog; no extra edible/non-edible department layer.
- Categories:
  - Sports Nutrition
  - Baking & Pantry
  - Drinks
  - Household & Cleaning
  - Garden & Outdoors
  - Trade & Creative Materials
- Target distribution:
  - Sports Nutrition: 20
  - Baking & Pantry: 20
  - Drinks: 15
  - Household & Cleaning: 15
  - Garden & Outdoors: 15
  - Trade & Creative Materials: 15
- Distribution rule: targets, not quotas. Weak Garden, Outdoors, Trade, or Creative candidates -> move slots into easier credible categories.
- Credibility rule: every product represents real-world powder or dry powdered mixture.
- Existing content: retain credible products; convert reusable fictional entries; drop entries lacking credible conversion.

## Product Families

- Sports Nutrition: protein, collagen, creatine, carbohydrate powders, mass gainers, recovery powders.
- Baking & Pantry: flour, powdered sugar, cocoa, milk powder, powdered ingredients, spices.
- Drinks: matcha, coffee, chai, electrolyte drinks, flavoured drink mixes.
- Household & Cleaning: laundry, dishwasher, carpet, surface-cleaning powders.
- Garden & Outdoors: garden lime, soil minerals, soluble feeds, rooting powder, lawn and plant treatments.
- Trade & Creative Materials: cement, mortar, plaster, sand, aggregates, pigments, casting powder, theatrical dust, spill absorbents.

## Safety Boundary

- Allowed: ordinary products needing standard handling warnings.
- Examples: cement, plaster, laundry powder, garden lime, pigments, theatrical dust.
- Excluded: highly toxic, explosive, controlled, prescription, or specialist-licensed powders.
- Product-level classification: clear food-use or non-consumption status.
- Non-food content: handling, PPE, dust, surface, application, and storage guidance where relevant.

## Specifications

- Model: shared core plus category-specific fields.
- Shared core: pack size, texture, colour, source, intended use, storage, consumption classification.
- Edible: ingredients, allergens, nutrition, serving size, dietary attributes.
- Sports: protein or carbohydrate source, flavour, servings.
- Garden: NPK values, coverage, application method.
- Cleaning: surface compatibility, dosage, hazard guidance.
- Trade: composition, water ratio, coverage, setting time, PPE guidance.
- Theatrical: approved application, cleanup, colour, particle appearance.
- Uses: product detail, comparison, filtering, validation, boundary tests.

## Pack Variants

- Each pack size: true purchasable variant with own SKU, price, stock, weight, and backorder state.
- Formulation or flavour change: separate base product, not pack variant.
- Edible ranges: smaller consumer packs.
- Household and Garden ranges: consumer and bulk packs.
- Trade and Creative ranges: industrial packs.
- Maximum standard pack: 1 tonne for suitable products such as cement, sand, aggregates, absorbent minerals.
- Product suitability controls offered sizes; no requirement for every product to expose every size.

## Delivery

- Standard and bulk items share cart and checkout.
- Heavy line or order -> automatic freight classification.
- Backend -> deterministic simulated freight charge.
- Checkout -> clear parcel versus pallet/bulk delivery state.
- Separate quote workflow: none for standard catalog variants up to 1 tonne.

## Custom Powder

- Rename `Powderizer` -> `Custom Powder`.
- Positioning: manual blending and packaging service, not expert formulation service.
- Retain where practical: ingredient selection, percentage ratios, bag sizes, appearance choices, saved mixes, history, featured blends, checkout support.
- Replace novelty reactions and claims with professional compatibility and safety guidance.
- Customer chooses ingredients and percentages.
- Ratio invariant: total equals 100%.
- System derives combined ingredient, allergen, usage, and safety information.
- Claims: no treatment, health-outcome, or guaranteed-performance promises.
- Existing `Good for` concept -> professional intended-use field.
- Existing daily recipe concept -> featured blend.

## Mixing Compatibility

- Compatibility mechanism: explicit product mixing group, not category equality.
- Allowed combination: products sharing compatible mixing group only.
- Initial groups:
  - Food-grade
  - Cleaning
  - Garden treatment
  - Cementitious materials
  - Casting materials
  - Pigments
  - Theatrical effects
  - Absorbents
- Cross-category example: protein, matcha, powdered milk may mix through Food-grade group.
- Forbidden example: edible plus cleaning product.
- Validation required across UI, API, persistence, cart, checkout.
- Compatibility boundaries: intentional QA exercise surface.

## Curated Bundles

- Retain curated bundles.
- Bundle means separately packaged product set, not mixture.
- Professional examples: Baking Essentials, Sports Nutrition Starter, Hot Drinks Collection, Home Cleaning Set, Lawn Care Set, Casting Starter Kit.
- Each component retains own bag, label, and safety information.

## Market And Localisation

- Default market: United States.
- Initial locale: `en-US`.
- Initial currency: USD.
- Later direction: country localisations.
- Initial repurposing scope: localisation-ready content and boundaries; no translation or multi-currency implementation.
- Localisation implementation: future dedicated lesson or plan.

## Retention Defaults

- Retain familiar commerce unless fiction-specific dependency requires conversion or removal.
- Core path: home -> catalog -> product -> cart -> checkout -> confirmation -> order history.
- Retain: search, category filters, sorts, comparison, favourites, reviews, bundles, promotions, inventory, checkout, orders, returns, account, simulated payments.
- Remove or rewrite: impossible-category journeys, conceptual claims, comedic copy, unrestricted cross-type blending.

## Unresolved

- Exact 100-product list and final category counts after credibility review.
- Exact variants, weights, prices, inventory, and freight thresholds per product.
- Allergen and dietary filter baseline; proposal discussed but not approved.
- Detailed compatibility matrix inside and across mixing groups.
- Country localisation sequence after `en-US` baseline.
