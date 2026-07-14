interface ProductDetailsProps {
  description: string;
}

export function ProductDetails({ description }: ProductDetailsProps) {
  if (!description.trim()) return null;

  return (
    <section
      aria-labelledby="product-details-heading"
      className="rounded-2xl border bg-surface-raised p-6 sm:p-8"
    >
      <p className="section-eyebrow">Powder facts</p>
      <h2 id="product-details-heading" className="mt-2 text-2xl font-semibold tracking-tight">
        What is in this bag
      </h2>
      <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{description}</p>
    </section>
  );
}
