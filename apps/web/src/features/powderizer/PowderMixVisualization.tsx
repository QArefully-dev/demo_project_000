import { useId } from 'react';
import type { Product } from '@shop/contracts/products';
import type { BuilderComponent } from './powderizerState';

type PowderMixVisualizationProps = {
  components: readonly BuilderComponent[];
  products: readonly Product[];
};

function stableColour(productId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < productId.length; index += 1) {
    hash ^= productId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `hsl(${(hash >>> 0) % 360} 58% 56%)`;
}

export function powderColour(product: Product | undefined, productId: string): string {
  return product?.packaging?.powderColor ?? stableColour(productId);
}

export function PowderMixVisualization({ components, products }: PowderMixVisualizationProps) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const clipPathId = `powderizer-vessel-${useId().replace(/:/g, '')}`;
  if (components.length < 2)
    return (
      <section
        className="powderizer-mix-visualization rounded-xl border border-border bg-surface-raised p-4"
        aria-labelledby="mix-visualization-title"
      >
        <h2 id="mix-visualization-title" className="font-semibold">
          Mix visualization
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose at least two powders to see your mix.
        </p>
      </section>
    );

  const vesselLeft = 8;
  const vesselWidth = 84;
  let offset = 0;
  return (
    <section
      className="powderizer-mix-visualization rounded-xl border border-border bg-surface-raised p-4"
      aria-labelledby="mix-visualization-title"
    >
      <h2 id="mix-visualization-title" className="font-semibold">
        Mix visualization
      </h2>
      <svg
        className="mt-3 w-full"
        viewBox="0 0 100 46"
        role="img"
        aria-label="Ratio-weighted powder mix"
      >
        <defs>
          <clipPath id={clipPathId}>
            <path d="M8 5H92L84 41H16Z" />
          </clipPath>
        </defs>
        <path
          d="M8 5H92L84 41H16Z"
          fill="var(--surface-soft)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <g clipPath={`url(#${clipPathId})`}>
          {components.map(({ productId, percentage }) => {
            const width = (percentage / 100) * vesselWidth;
            const product = productsById.get(productId);
            const segment = (
              <rect
                key={productId}
                className="powderizer-mix-segment"
                data-product-id={productId}
                data-percentage={percentage}
                x={vesselLeft + offset}
                y="5"
                width={width}
                height="36"
                fill={powderColour(product, productId)}
              />
            );
            offset += width;
            return segment;
          })}
        </g>
        <path d="M8 5H92L84 41H16Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <ul className="mt-3 grid gap-1 text-sm" aria-label="Mix ingredient legend">
        {components.map(({ productId, percentage }) => {
          const product = productsById.get(productId);
          return (
            <li key={productId} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="powderizer-legend-colour"
                  style={{ backgroundColor: powderColour(product, productId) }}
                  aria-hidden="true"
                />
                {product?.name ?? `Powder ${productId}`}
              </span>
              <span className="shrink-0 text-muted-foreground">{percentage}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
