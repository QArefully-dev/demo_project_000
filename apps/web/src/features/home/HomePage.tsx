import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBestsellers, getProducts, getCategories } from '@/api/products';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { SearchBar } from '@/components/SearchBar';
import { useCartContext } from '@/hooks/CartContext';
import type { Product } from '@shop/contracts';

/**
 * Home page — Wave 3 implementation.
 * Features hero/search, categories, bestsellers, sale row, and newest products grid.
 */
export function HomePage() {
  const { addItem, isCartAvailable, isActionPending } = useCartContext();

  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [newestProducts, setNewestProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingSec, setIsLoadingSec] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [bestsellersRes, saleRes, newestRes, catsRes] = await Promise.all([
          getBestsellers(),
          getProducts({ onSale: true, sort: 'bestselling', pageSize: 8 }),
          getProducts({ sort: 'newest', pageSize: 8 }),
          getCategories(),
        ]);

        if (cancelled) return;

        setBestsellers(Array.isArray(bestsellersRes) ? bestsellersRes : []);
        setSaleProducts(Array.isArray(saleRes.items) ? saleRes.items.slice(0, 8) : []);
        setNewestProducts(Array.isArray(newestRes.items) ? newestRes.items.slice(0, 8) : []);
        setCategories(Array.isArray(catsRes) ? catsRes : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load home page data');
        }
      } finally {
        if (!cancelled) setIsLoadingSec(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoadingSec) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-16 pb-12">
      {/* ── Hero + Search ──────────────────────────────── */}
      <section className="flex flex-col items-center justify-center gap-6 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-background px-4 py-20 text-center">
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Your gear, your rules
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Explore top-rated electronics, find exclusive deals, and build your perfect setup.
        </p>
        <div className="w-full max-w-md">
          <SearchBar />
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat}
              to={`/catalog?category=${encodeURIComponent(cat)}`}
              className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {cat}
            </Link>
          ))}
          {categories.length > 6 && (
            <Link
              to="/catalog"
              className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              +{categories.length - 6} more
            </Link>
          )}
        </div>
      </section>

      {/* ── Bestsellers ─────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Bestsellers</h2>
            <Link
              to="/catalog?sort=bestselling"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <ProductGrid>
            {bestsellers.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(product.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
            ))}
          </ProductGrid>
        </section>
      )}

      {/* ── On Sale ─────────────────────────────────────── */}
      {saleProducts.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              <span className="text-destructive">Sale</span>
            </h2>
            <Link
              to="/catalog?onSale=true&sort=bestselling"
              className="text-sm font-medium text-primary hover:underline"
            >
              Shop all deals →
            </Link>
          </div>
          <ProductGrid>
            {saleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(product.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
            ))}
          </ProductGrid>
        </section>
      )}

      {/* ── Newest Arrivals ─────────────────────────────── */}
      {newestProducts.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">New Arrivals</h2>
            <Link
              to="/catalog?sort=newest"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <ProductGrid>
            {newestProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isCartAvailable={isCartAvailable}
                isAdding={isActionPending(product.id, 'add')}
                onAddToCart={(pid) => addItem(pid)}
              />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
