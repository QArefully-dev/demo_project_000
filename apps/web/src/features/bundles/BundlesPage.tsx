import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useCartContext } from '@/hooks/CartContext';
import { useBundles } from '@/hooks/useBundles';
import { BundleCard } from './BundleCard';

export function BundlesPage() {
  const { bundles, error: loadError, isLoading, refetch } = useBundles();
  const { addBundle, error: cartError, isActionPending, isCartAvailable } = useCartContext();

  if (isLoading && bundles.length === 0) return <LoadingSpinner />;
  if (loadError && bundles.length === 0)
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 py-12 text-center"
      >
        <p className="text-destructive">{loadError}</p>
        <Button size="sm" onClick={() => void refetch()}>
          Try Again
        </Button>
      </div>
    );

  return (
    <section className="mx-auto max-w-5xl space-y-7 pb-12">
      <header className="max-w-2xl">
        <p className="section-eyebrow">Curated bundles</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Bundle sets</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fixed selections of powders, with current prices and availability shown here.
        </p>
      </header>
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}
      {bundles.length === 0 ? (
        <p className="rounded-xl border bg-surface-raised p-6 text-muted-foreground">
          No bundles are available right now.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {bundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              isCartAvailable={isCartAvailable}
              isAdding={isActionPending(`bundle:${bundle.id}`, 'bundle-add')}
              error={cartError}
              onAdd={addBundle}
            />
          ))}
        </div>
      )}
    </section>
  );
}
