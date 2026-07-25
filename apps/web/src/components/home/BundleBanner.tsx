import { ArrowRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Sample of the seeded curated bundles, shown as decorative artwork only. */
const stackedSets = [
  { label: 'Baking Essentials', detail: '4 materials' },
  { label: 'Garden Care Kit', detail: '3 materials' },
  { label: 'Cleaning Supplies Bundle', detail: '3 materials' },
];

export function BundleBanner() {
  return (
    <Link
      to="/bundles"
      aria-label="Bundle sets: browse curated bundles"
      className="group grid overflow-hidden rounded-2xl border-2 border-foreground bg-secondary text-secondary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid-cols-[1.1fr_0.9fr]"
    >
      <div className="px-7 py-9 sm:px-10">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase opacity-70">
          <Package className="size-4" aria-hidden="true" />
          Curated bundles
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Order a whole set, save 10%.</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 opacity-80">
          Ready-made material sets for common jobs — every line priced, stocked and added to your
          cart in one click.
        </p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-primary/85">
          Browse bundles
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
      <div
        aria-hidden="true"
        className="relative hidden content-center gap-2 bg-surface-soft p-6 sm:grid sm:p-8"
      >
        {stackedSets.map((set) => (
          <div
            key={set.label}
            className="border border-foreground/25 bg-background/85 px-4 py-2.5 shadow-sm transition-transform group-hover:translate-x-1"
          >
            <p className="text-sm font-semibold tracking-tight text-foreground">{set.label}</p>
            <p className="text-xs text-muted-foreground">{set.detail}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
