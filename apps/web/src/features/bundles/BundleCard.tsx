import { Link } from 'react-router-dom';
import type { CuratedBundle } from '@shop/contracts/bundles';
import { Button } from '@/components/ui/button';

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100);
}

type BundleCardProps = {
  bundle: CuratedBundle;
  headingLevel?: 2 | 3;
  isCartAvailable: boolean;
  isAdding: boolean;
  error?: string | null;
  onAdd: (bundleId: string) => void | Promise<unknown>;
};

export function BundleCard({
  bundle,
  headingLevel = 2,
  isCartAvailable,
  isAdding,
  error,
  onAdd,
}: BundleCardProps) {
  const disabled = !bundle.available || !isCartAvailable || isAdding;
  const Heading = `h${headingLevel}` as const;
  const unavailableMessage = !bundle.available
    ? 'This bundle is currently unavailable.'
    : !isCartAvailable
      ? 'Cart is not ready yet.'
      : null;

  return (
    <article className="rounded-xl border bg-surface-raised p-5">
      <Heading className="text-xl font-semibold">{bundle.name}</Heading>
      <p className="mt-2 text-sm text-muted-foreground">{bundle.description}</p>
      <ul className="mt-4 space-y-2" aria-label={`${bundle.name} components`}>
        {bundle.components.map((component) => (
          <li key={component.product.id} className="text-sm">
            <div className="flex items-center justify-between gap-4">
              <Link
                to={`/products/${component.product.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {component.product.name}
              </Link>
              <span className="shrink-0 text-muted-foreground">×{component.quantity}</span>
            </div>
            {component.variantDetail && (
              <p className="text-xs text-muted-foreground">
                {component.variantDetail.label} · SKU: {component.variantDetail.sku} ·{' '}
                {component.variantDetail.weightGrams}g
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between gap-4 border-t pt-4">
        <p className="font-semibold">{formatPrice(bundle.totalCents)}</p>
        <Button disabled={disabled} onClick={() => void onAdd(bundle.id)} aria-busy={isAdding}>
          {isAdding ? 'Adding…' : 'Add bundle'}
        </Button>
      </div>
      {unavailableMessage && (
        <p className="mt-3 text-sm text-muted-foreground">{unavailableMessage}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {isAdding && (
        <p aria-live="polite" className="sr-only">
          Adding {bundle.name} to cart
        </p>
      )}
    </article>
  );
}
