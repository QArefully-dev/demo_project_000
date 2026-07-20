import type { Product } from '@shop/contracts/products';
import type { BuilderComponent } from '../powderizer/powderizerState';

type CombinedFactsProps = {
  components: readonly BuilderComponent[];
  products: readonly Product[];
};

function deriveFacts(products: Product[]) {
  const ingredients = products.map((p) => p.name);
  const allergens = new Set<string>();
  const intendedUse = new Set<string>();
  const safety = new Set<string>();

  for (const product of products) {
    const classification = product.consumptionClassification;
    if (classification === 'food') intendedUse.add('Food-grade consumable');
    else if (classification === 'caution') {
      allergens.add(`Caution required: ${product.name}`);
      safety.add(`Handle with care: ${product.name}`);
    }
    if (product.packaging) {
      if (product.packaging.consumptionLabel) {
        intendedUse.add(product.packaging.consumptionLabel);
      }
    }
    if (product.category) {
      intendedUse.add(product.category);
    }
  }

  return {
    ingredients,
    allergens: [...allergens],
    intendedUse: [...intendedUse],
    safety: [...safety],
  };
}

export function CombinedFacts({ components, products }: CombinedFactsProps) {
  if (components.length < 2) return null;
  const productById = new Map(products.map((p) => [p.id, p]));
  const selectedProducts = components
    .map((c) => productById.get(c.productId))
    .filter((p): p is Product => p !== undefined);
  const facts = deriveFacts(selectedProducts);

  return (
    <section
      className="rounded-xl border border-border bg-surface-raised p-4"
      aria-labelledby="combined-facts-heading"
    >
      <h2 id="combined-facts-heading" className="font-semibold">
        Combined blend facts
      </h2>
      <div className="mt-3 space-y-3 text-sm">
        {facts.ingredients.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground">Ingredients</p>
            <ul className="mt-1 list-inside list-disc" aria-label="Combined ingredients">
              {facts.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </div>
        )}
        {facts.allergens.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground">Allergens &amp; cautions</p>
            <ul className="mt-1 list-inside list-disc" aria-label="Allergens">
              {facts.allergens.map((allergen) => (
                <li key={allergen}>{allergen}</li>
              ))}
            </ul>
          </div>
        )}
        {facts.intendedUse.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground">Intended use</p>
            <ul className="mt-1 list-inside list-disc" aria-label="Intended use">
              {facts.intendedUse.map((use) => (
                <li key={use}>{use}</li>
              ))}
            </ul>
          </div>
        )}
        {facts.safety.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground">Safety</p>
            <ul className="mt-1 list-inside list-disc" aria-label="Safety information">
              {facts.safety.map((safetyItem) => (
                <li key={safetyItem}>{safetyItem}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
