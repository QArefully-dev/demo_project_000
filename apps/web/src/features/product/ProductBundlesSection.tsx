import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { BundleCard } from '@/features/bundles/BundleCard';
import { useCartContext } from '@/hooks/CartContext';
import { useBundles } from '@/hooks/useBundles';

type ProductBundlesSectionProps = {
  productId: string;
};

export function ProductBundlesSection({ productId }: ProductBundlesSectionProps) {
  const { bundles, error: loadError, isLoading, refetch } = useBundles(productId);
  const { addBundle, isActionPending, isCartAvailable } = useCartContext();
  const [actionError, setActionError] = useState<{ bundleId: string; message: string } | null>(
    null,
  );

  useEffect(() => {
    setActionError(null);
  }, [productId]);

  const handleAdd = async (bundleId: string) => {
    setActionError(null);
    if (!(await addBundle(bundleId))) {
      setActionError({ bundleId, message: 'Could not add this bundle. Try again.' });
    }
  };

  return (
    <section aria-labelledby="product-bundles-heading" className="space-y-5">
      <header>
        <p className="section-eyebrow">Curated bundles</p>
        <h2 id="product-bundles-heading" className="mt-2 text-2xl font-semibold tracking-tight">
          Complete your selection
        </h2>
      </header>

      {isLoading && bundles.length === 0 && <LoadingSpinner />}

      {loadError && bundles.length === 0 && !isLoading && (
        <div role="alert" className="rounded-xl border bg-surface-raised p-5">
          <p className="text-destructive">{loadError}</p>
          <Button className="mt-4" size="sm" onClick={() => void refetch()}>
            Retry bundles
          </Button>
        </div>
      )}

      {!isLoading && !loadError && bundles.length === 0 && (
        <p className="rounded-xl border bg-surface-raised p-5 text-muted-foreground">
          No curated bundles are available for this product right now.
        </p>
      )}

      {bundles.length > 0 && (
        <>
          {loadError && (
            <div role="alert" className="rounded-xl border bg-surface-raised p-5">
              <p className="text-destructive">{loadError}</p>
              <Button className="mt-4" size="sm" onClick={() => void refetch()}>
                Retry bundles
              </Button>
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {bundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                headingLevel={3}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(`bundle:${bundle.id}`, 'bundle-add')}
                error={actionError?.bundleId === bundle.id ? actionError.message : null}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
