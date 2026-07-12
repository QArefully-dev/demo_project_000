import { useSearchParams, Link } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

/**
 * Functional category filter navigation.
 * Fetches categories from the API and drives catalog
 * filtering via the `?category=` URL search parameter.
 */
export function CategoryNav() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') ?? '';
  const { categories, isLoading } = useCategories();

  const linkClassName = (category: string) =>
    cn(
      'rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      activeCategory === category && 'bg-accent font-semibold text-accent-foreground',
    );

  return (
    <nav aria-label="Departments" className="flex items-center gap-0.5">
      <Link
        to="/catalog"
        aria-current={activeCategory === '' ? 'page' : undefined}
        className={linkClassName('')}
      >
        All departments
      </Link>
      {!isLoading &&
        categories.slice(0, 6).map((category) => (
          <Link
            key={category}
            to={`/catalog?category=${encodeURIComponent(category)}`}
            aria-current={activeCategory === category ? 'page' : undefined}
            className={linkClassName(category)}
          >
            {category}
          </Link>
        ))}
      <Link
        to="/catalog?onSale=true&sort=bestselling"
        className="rounded-md px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap text-sale hover:bg-sale/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Deals
      </Link>
    </nav>
  );
}
