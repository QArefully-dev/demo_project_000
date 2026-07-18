import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Product, ProductComparisonResponse } from '@shop/contracts/products';
import { getProductComparison } from '@/api/products';
import { Button } from '@/components/ui/button';
import { ComparisonMatrix } from './ComparisonMatrix';
import { parseComparisonSelection, removeComparisonId } from './comparisonSelection';
import { loadComparisonSelection, saveComparisonSelection } from './comparisonStorage';

interface LoadedComparison {
  response: ProductComparisonResponse;
  products: Product[];
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loaded, setLoaded] = useState<LoadedComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestNumber = useRef(0);
  const skipStorageRestore = useRef(false);
  const selection = parseComparisonSelection(searchParams);
  const selectedIds = selection.status === 'valid' ? (selection.ids ?? []) : [];

  useEffect(() => {
    if (selection.status !== 'missing' || skipStorageRestore.current) return;
    const storage = getStorage();
    const stored = storage ? loadComparisonSelection(storage) : null;
    if (!stored) return;
    setSearchParams({ ids: stored.join(',') }, { replace: true });
  }, [selection.status, setSearchParams]);

  useEffect(() => {
    if (selection.status !== 'valid' || selectedIds.length === 0) {
      setLoaded(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    setIsLoading(true);
    setError(null);
    setLoaded(null);

    getProductComparison(selectedIds, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || currentRequest !== requestNumber.current) return;
        const products = response.items.flatMap((item) =>
          item.status === 'available' ? [item.product] : [],
        );
        if (products.length >= 2 && products.length <= 4) {
          const storage = getStorage();
          if (storage)
            saveComparisonSelection(
              storage,
              products.map((product) => product.id),
            );
        }
        setLoaded({ response, products });
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted || currentRequest !== requestNumber.current) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load comparison');
      })
      .finally(() => {
        if (!controller.signal.aborted && currentRequest === requestNumber.current)
          setIsLoading(false);
      });

    return () => controller.abort();
  }, [selection.status, selection.value, retry]);

  const updateIds = (ids: readonly string[]) => {
    if (ids.length < 2) {
      // A removal that leaves one product is intentionally an empty comparison,
      // not an instruction to immediately restore the previous saved selection.
      skipStorageRestore.current = true;
      setSearchParams({}, { replace: false });
      return;
    }
    setSearchParams({ ids: ids.join(',') }, { replace: false });
  };

  if (selection.status === 'invalid') {
    return (
      <ComparisonMessage
        title="That comparison link is invalid"
        detail="Choose two to four distinct products to compare."
      />
    );
  }

  if (selection.status === 'missing') {
    return (
      <ComparisonMessage
        title="Choose products to compare"
        detail="Open a comparison link with two to four product IDs, or browse the catalogue."
      />
    );
  }

  const unavailable = loaded?.response.items.filter((item) => item.status !== 'available') ?? [];
  return (
    <div className="pb-12">
      <header className="mb-7 max-w-3xl">
        <p className="section-eyebrow">Side by side</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Compare powders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Compare price, availability, and ingredient facts in one place.
        </p>
      </header>

      {isLoading && (
        <p role="status" className="py-8 text-muted-foreground">
          Loading comparison…
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="text-destructive">{error}</p>
          <Button className="mt-3" size="sm" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </Button>
        </div>
      )}
      {unavailable.length > 0 && (
        <div role="status" className="mb-6 rounded-2xl border bg-surface-soft p-5">
          <h2 className="font-semibold">Some products are unavailable for comparison</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {unavailable.map((item) => (
              <li key={`${item.status}:${item.id}`}>
                Product {item.id} is{' '}
                {item.status === 'inactive' ? 'no longer active' : 'not available'}.
              </li>
            ))}
          </ul>
        </div>
      )}
      {loaded && loaded.products.length >= 2 && (
        <ComparisonMatrix
          products={loaded.products}
          onRemove={(id) => updateIds(removeComparisonId(selectedIds, id))}
        />
      )}
      {loaded && loaded.products.length < 2 && (
        <div className="rounded-2xl border bg-surface-raised p-6 text-center">
          <h2 className="text-xl font-semibold">Not enough active products to compare</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a link with at least two currently available powders.
          </p>
        </div>
      )}
    </div>
  );
}

function ComparisonMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-surface-raised px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{detail}</p>
      <Button
        className="mt-6"
        variant="outline"
        nativeButton={false}
        render={<Link to="/catalog" />}
      >
        Browse all powders
      </Button>
    </div>
  );
}
