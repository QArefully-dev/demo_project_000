import type { CategoryFacts } from '@shop/contracts/products';

interface ProductDetailsProps {
  description: string;
  categoryFacts: CategoryFacts;
}

function formatFactValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not specified';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\u00A0\u00B7 ');
  }
  return String(value);
}

function factDisplayPairs(facts: CategoryFacts): { label: string; value: string }[] {
  const pairs: { label: string; value: string }[] = [];

  const baseKeys: { key: string; label: string }[] = [
    { key: 'texture', label: 'Texture' },
    { key: 'colour', label: 'Colour' },
    { key: 'source', label: 'Source' },
    { key: 'intendedUse', label: 'Intended use' },
    { key: 'storage', label: 'Storage' },
  ];

  for (const { key, label } of baseKeys) {
    if (key in facts) {
      pairs.push({ label, value: formatFactValue((facts as Record<string, unknown>)[key]) });
    }
  }

  const extensionKeys: { key: string; label: string }[] = [
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'allergens', label: 'Allergens' },
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'servingSize', label: 'Serving size' },
    { key: 'dietaryAttributes', label: 'Dietary attributes' },
    { key: 'flavour', label: 'Flavour' },
    { key: 'servings', label: 'Servings' },
    { key: 'proteinPerServing', label: 'Protein per serving' },
    { key: 'carbsPerServing', label: 'Carbs per serving' },
    { key: 'npk', label: 'NPK' },
    { key: 'coverage', label: 'Coverage' },
    { key: 'application', label: 'Application' },
    { key: 'handling', label: 'Handling' },
    { key: 'surfaces', label: 'Surfaces' },
    { key: 'dosage', label: 'Dosage' },
    { key: 'hazardStatement', label: 'Hazard statement' },
    { key: 'composition', label: 'Composition' },
    { key: 'waterRatio', label: 'Water ratio' },
    { key: 'settingTime', label: 'Setting time' },
    { key: 'ppe', label: 'PPE' },
    { key: 'approvedApplication', label: 'Approved application' },
    { key: 'cleanup', label: 'Cleanup' },
    { key: 'colourProfile', label: 'Colour profile' },
    { key: 'particleAppearance', label: 'Particle appearance' },
  ];

  for (const { key, label } of extensionKeys) {
    if (key in facts) {
      const val = (facts as Record<string, unknown>)[key];
      pairs.push({ label, value: formatFactValue(val) });
    }
  }

  return pairs;
}

export function ProductDetails({ description, categoryFacts }: ProductDetailsProps) {
  const factPairs = factDisplayPairs(categoryFacts);

  return (
    <section
      aria-labelledby="product-details-heading"
      className="rounded-2xl border bg-surface-raised p-6 sm:p-8"
    >
      <p className="section-eyebrow">Powder facts</p>
      <h2 id="product-details-heading" className="mt-2 text-2xl font-semibold tracking-tight">
        What is in this bag
      </h2>
      {description.trim() && (
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{description}</p>
      )}

      {factPairs.length > 0 && (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {factPairs.map((pair) => (
            <div key={pair.label}>
              <dt className="text-sm font-semibold text-foreground">{pair.label}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{pair.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
