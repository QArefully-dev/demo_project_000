import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BagArtwork, type BagArtworkProps } from '@/components/BagArtwork';
import { Button } from '@/components/ui/button';

const tileArtwork: Readonly<Record<string, Omit<BagArtworkProps, 'ariaLabel' | 'className'>>> = {
  'sports nutrition': {
    name: 'Protein Powder',
    category: 'Sports Nutrition',
    quantity: '1kg',
    batchCode: 'SN-01',
    mark: 'PRO',
    accent: '#78956c',
    powderAccent: '#d5dfbc',
    consumptionLabel: null,
  },
  'baking & pantry': {
    name: 'Powdered Sugar',
    category: 'Baking & Pantry',
    quantity: '500g',
    batchCode: 'BP-01',
    mark: 'SUG',
    accent: '#e1a156',
    powderAccent: '#f2d8a6',
    consumptionLabel: null,
  },
  drinks: {
    name: 'Matcha Powder',
    category: 'Drinks',
    quantity: '200g',
    batchCode: 'DRK-03',
    mark: 'MTC',
    accent: '#849b58',
    powderAccent: '#c7d486',
    consumptionLabel: null,
  },
  'household & cleaning': {
    name: 'Laundry Powder',
    category: 'Household & Cleaning',
    quantity: '500g',
    batchCode: 'HC-04',
    mark: 'LND',
    accent: '#6c9cb3',
    powderAccent: '#c8e0eb',
    consumptionLabel: 'Not for consumption',
  },
  'garden & outdoors': {
    name: 'Garden Lime',
    category: 'Garden & Outdoors',
    quantity: '2kg',
    batchCode: 'GO-05',
    mark: 'LIM',
    accent: '#c3774e',
    powderAccent: '#e7b78f',
    consumptionLabel: 'Not for consumption',
  },
  'trade & creative materials': {
    name: 'Cement Mix',
    category: 'Trade & Creative Materials',
    quantity: '25kg',
    batchCode: 'TC-06',
    mark: 'CEM',
    accent: '#8c7ba8',
    powderAccent: '#d0c3df',
    consumptionLabel: 'Not for consumption',
  },
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
      <p className="section-eyebrow">Choose your material</p>
      <h2 id="category-heading" className="section-heading mt-2">
        Shop by category
      </h2>
      {error ? (
        <div role="status" className="mt-6 rounded-2xl border bg-surface-raised p-5 text-sm">
          <p className="text-muted-foreground">Categories are temporarily unavailable.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div
          aria-label="Loading categories"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : categories.length === 0 ? null : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.slice(0, 6).map((category) => {
            const artwork = tileArtwork[category.toLowerCase()];
            return (
              <Link
                key={category}
                to={`/catalog?category=${encodeURIComponent(category)}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-foreground/20 bg-surface-soft shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {artwork ? (
                  <BagArtwork
                    {...artwork}
                    ariaLabel=""
                    className="h-full w-full object-cover p-3 transition-transform duration-200 group-hover:scale-105"
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
