import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const tileImages: Readonly<Record<string, string>> = {
  accessories: '/images/products/usb-hub.card.9b304cc40aad.720.webp',
  audio: '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
  displays: '/images/products/desktop-monitor.card.60700175c6db.720.webp',
  peripherals: '/images/products/mechanical-keyboard.card.24a705d3f3c5.720.webp',
  'smart home': '/images/products/webcam.card.61c6d85cc7a0.720.webp',
};

interface CategoryTilesProps {
  categories: string[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function CategoryTiles({ categories, isLoading, error, onRetry }: CategoryTilesProps) {
  return (
    <section aria-labelledby="category-heading">
      <p className="section-eyebrow">Browse your way</p>
      <h2 id="category-heading" className="section-heading mt-2">
        Shop by department
      </h2>
      {error ? (
        <div role="status" className="mt-6 rounded-2xl border bg-surface-raised p-5 text-sm">
          <p className="text-muted-foreground">Departments are temporarily unavailable.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div
          aria-label="Loading departments"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : categories.length === 0 ? null : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.slice(0, 4).map((category) => {
            const image = tileImages[category.toLowerCase()];
            return (
              <Link
                key={category}
                to={`/catalog?category=${encodeURIComponent(category)}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-soft shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {image ? (
                  <img
                    src={image}
                    alt=""
                    width="720"
                    height="720"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-full w-full bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.85),transparent_32%),linear-gradient(135deg,oklch(0.91_0.03_240),oklch(0.78_0.07_250))]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5 text-lg font-semibold text-white">
                  {category}
                  <ArrowUpRight className="size-5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
