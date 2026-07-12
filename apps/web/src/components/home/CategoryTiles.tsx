import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const tileImages = [
  '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
  '/images/products/mechanical-keyboard.card.24a705d3f3c5.720.webp',
  '/images/products/desktop-monitor.card.60700175c6db.720.webp',
  '/images/products/portable-speaker.card.c874cf8d8eca.720.webp',
];

export function CategoryTiles({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="category-heading">
      <p className="section-eyebrow">Browse your way</p>
      <h2 id="category-heading" className="section-heading mt-2">
        Shop by department
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.slice(0, 4).map((category, index) => (
          <Link
            key={category}
            to={`/catalog?category=${encodeURIComponent(category)}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-soft shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={tileImages[index]}
              alt=""
              width="720"
              height="720"
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/10 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5 text-lg font-semibold text-white">
              {category}
              <ArrowUpRight className="size-5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
