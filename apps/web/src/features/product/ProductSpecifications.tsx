export interface ProductSpecification {
  label: string;
  value: string;
}

interface ProductSpecificationsProps {
  specifications: readonly ProductSpecification[];
}

export function ProductSpecifications({ specifications }: ProductSpecificationsProps) {
  if (specifications.length === 0) return null;

  return (
    <section
      aria-labelledby="product-specifications-heading"
      className="rounded-2xl border bg-surface-raised p-6 sm:p-8"
    >
      <h2 id="product-specifications-heading" className="text-2xl font-semibold tracking-tight">
        Specifications
      </h2>
      <dl className="mt-6 divide-y">
        {specifications.map(({ label, value }) => (
          <div
            key={label}
            className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(10rem,1fr)_2fr]"
          >
            <dt className="font-medium">{label}</dt>
            <dd className="text-muted-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
