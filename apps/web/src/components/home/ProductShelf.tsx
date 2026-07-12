import { Link } from 'react-router-dom';
import type { Product } from '@shop/contracts';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';

interface Props {
  eyebrow: string;
  title: string;
  href: string;
  products: Product[];
  error?: string | null;
  isCartAvailable: boolean;
  isAdding: (id: string) => boolean;
  onAddToCart: (id: string) => Promise<boolean>;
}

export function ProductShelf({
  eyebrow,
  title,
  href,
  products,
  error,
  isCartAvailable,
  isAdding,
  onAddToCart,
}: Props) {
  const headingId = `${title.replaceAll(' ', '-').toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 id={headingId} className="section-heading mt-2">
            {title}
          </h2>
        </div>
        <Link to={href} className="section-link">
          View all →
        </Link>
      </div>
      {error ? (
        <p
          role="status"
          className="rounded-xl border bg-surface-raised p-5 text-sm text-muted-foreground"
        >
          This collection is temporarily unavailable.{' '}
          <Link className="font-semibold text-primary underline" to={href}>
            Browse the catalog
          </Link>
        </p>
      ) : (
        <ProductGrid>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isCartAvailable={isCartAvailable}
              isAdding={isAdding(product.id)}
              onAddToCart={onAddToCart}
            />
          ))}
        </ProductGrid>
      )}
    </section>
  );
}
