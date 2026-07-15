import { useEffect, useMemo, useState } from 'react';
import { getBestsellers, getCategories, getProducts } from '@/api/products';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { HeroSection } from '@/components/home/HeroSection';
import { PowderizerBanner } from '@/components/home/PowderizerBanner';
import { ProductShelf } from '@/components/home/ProductShelf';
import { PromoBanner } from '@/components/home/PromoBanner';
import { useCartContext } from '@/hooks/CartContext';
import type { Product } from '@shop/contracts/products';

interface ShelfState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
}
const initialShelf: ShelfState = { products: [], isLoading: true, error: null };

export function withoutProducts(products: Product[], excludedIds: ReadonlySet<string>): Product[] {
  return products.filter((product) => !excludedIds.has(product.id));
}

export function HomePage() {
  const { addItem, isCartAvailable, isActionPending } = useCartContext();
  const [bestsellers, setBestsellers] = useState<ShelfState>(initialShelf);
  const [newest, setNewest] = useState<ShelfState>(initialShelf);
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [bestsellersRetry, setBestsellersRetry] = useState(0);
  const [newestRetry, setNewestRetry] = useState(0);
  const [categoriesRetry, setCategoriesRetry] = useState(0);

  const message = (reason: unknown) =>
    reason instanceof Error ? reason.message : 'Unable to load this collection';

  useEffect(() => {
    let cancelled = false;

    setBestsellers((current) => ({ ...current, isLoading: true, error: null }));
    void getBestsellers()
      .then((products) => {
        if (!cancelled)
          setBestsellers({ products: products.slice(0, 5), isLoading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setBestsellers({ products: [], isLoading: false, error: message(reason) });
      });

    return () => {
      cancelled = true;
    };
  }, [bestsellersRetry]);

  useEffect(() => {
    let cancelled = false;

    setNewest((current) => ({ ...current, isLoading: true, error: null }));
    void getProducts({ sort: 'newest', pageSize: 10 })
      .then((response) => {
        if (!cancelled) setNewest({ products: response.items, isLoading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setNewest({ products: [], isLoading: false, error: message(reason) });
      });

    return () => {
      cancelled = true;
    };
  }, [newestRetry]);

  useEffect(() => {
    let cancelled = false;

    setIsCategoriesLoading(true);
    setCategoriesError(null);
    void getCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setCategoriesError(message(reason));
      })
      .finally(() => {
        if (!cancelled) setIsCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoriesRetry]);

  const newArrivals = useMemo(
    () =>
      withoutProducts(
        newest.products,
        new Set(bestsellers.products.map((product) => product.id)),
      ).slice(0, 5),
    [bestsellers.products, newest.products],
  );

  return (
    <div className="space-y-16 pb-12 lg:space-y-20">
      <HeroSection />
      <PowderizerBanner />
      <section
        aria-label="Store assurances"
        className="grid divide-y rounded-2xl border bg-surface-raised text-center shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Powdered to order</strong>
          <span className="text-muted-foreground">Every bag receives a batch mark</span>
        </p>
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Finely packed</strong>
          <span className="text-muted-foreground">Measured, sealed, and plainly labelled</span>
        </p>
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Simulated checkout</strong>
          <span className="text-muted-foreground">No real payment is processed</span>
        </p>
      </section>
      <ol
        aria-label="Powder process"
        className="powder-process flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        <li>Choose it</li>
        <li aria-hidden="true">→</li>
        <li>Powder it</li>
        <li aria-hidden="true">→</li>
        <li>Bag it</li>
      </ol>
      <CategoryTiles
        categories={categories}
        isLoading={isCategoriesLoading}
        error={categoriesError}
        onRetry={() => setCategoriesRetry((attempt) => attempt + 1)}
      />
      <ProductShelf
        eyebrow="Most requested by name"
        title="Frequently powdered"
        href="/catalog?sort=bestselling"
        products={bestsellers.products}
        isLoading={bestsellers.isLoading}
        error={bestsellers.error}
        onRetry={() => setBestsellersRetry((attempt) => attempt + 1)}
        isCartAvailable={isCartAvailable}
        isAdding={(id) => isActionPending(id, 'add')}
        onAddToCart={addItem}
      />
      <PromoBanner />
      <ProductShelf
        eyebrow="Recent batches"
        title="Fresh from the mill"
        href="/catalog?sort=newest"
        products={newArrivals}
        isLoading={newest.isLoading}
        error={newest.error}
        onRetry={() => setNewestRetry((attempt) => attempt + 1)}
        isCartAvailable={isCartAvailable}
        isAdding={(id) => isActionPending(id, 'add')}
        onAddToCart={addItem}
      />
    </div>
  );
}
