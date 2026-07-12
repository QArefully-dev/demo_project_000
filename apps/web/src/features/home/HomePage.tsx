import { useEffect, useState } from 'react';
import { getBestsellers, getCategories, getProducts } from '@/api/products';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { HeroSection } from '@/components/home/HeroSection';
import { ProductShelf } from '@/components/home/ProductShelf';
import { PromoBanner } from '@/components/home/PromoBanner';
import { useCartContext } from '@/hooks/CartContext';
import type { Product } from '@shop/contracts';

interface ShelfState {
  products: Product[];
  error: string | null;
}
const emptyShelf: ShelfState = { products: [], error: null };

export function HomePage() {
  const { addItem, isCartAvailable, isActionPending } = useCartContext();
  const [bestsellers, setBestsellers] = useState<ShelfState>(emptyShelf);
  const [newest, setNewest] = useState<ShelfState>(emptyShelf);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const message = (reason: unknown) =>
      reason instanceof Error ? reason.message : 'Unable to load this collection';

    void Promise.allSettled([
      getBestsellers(),
      getProducts({ sort: 'newest', pageSize: 10 }),
      getCategories(),
    ]).then(([bestResult, newestResult, categoriesResult]) => {
      if (cancelled) return;
      if (bestResult.status === 'fulfilled')
        setBestsellers({ products: bestResult.value.slice(0, 5), error: null });
      else setBestsellers({ products: [], error: message(bestResult.reason) });

      const usedIds = new Set(
        bestResult.status === 'fulfilled'
          ? bestResult.value.slice(0, 5).map((product) => product.id)
          : [],
      );
      if (newestResult.status === 'fulfilled')
        setNewest({
          products: newestResult.value.items
            .filter((product) => !usedIds.has(product.id))
            .slice(0, 5),
          error: null,
        });
      else setNewest({ products: [], error: message(newestResult.reason) });

      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-16 pb-12 lg:space-y-20">
      <HeroSection />
      <section
        aria-label="Store assurances"
        className="grid divide-y rounded-2xl border bg-surface-raised text-center shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Local demo delivery</strong>
          <span className="text-muted-foreground">Explore fulfilment flows safely</span>
        </p>
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Simple demo returns</strong>
          <span className="text-muted-foreground">Clear, familiar store journeys</span>
        </p>
        <p className="p-4 text-sm">
          <strong className="block text-foreground">Simulated checkout</strong>
          <span className="text-muted-foreground">No real payment is processed</span>
        </p>
      </section>
      <CategoryTiles categories={categories} />
      <ProductShelf
        eyebrow="Customer favourites"
        title="Bestsellers"
        href="/catalog?sort=bestselling"
        products={bestsellers.products}
        error={bestsellers.error}
        isCartAvailable={isCartAvailable}
        isAdding={(id) => isActionPending(id, 'add')}
        onAddToCart={addItem}
      />
      <PromoBanner />
      <ProductShelf
        eyebrow="Freshly selected"
        title="New arrivals"
        href="/catalog?sort=newest"
        products={newest.products}
        error={newest.error}
        isCartAvailable={isCartAvailable}
        isAdding={(id) => isActionPending(id, 'add')}
        onAddToCart={addItem}
      />
    </div>
  );
}
