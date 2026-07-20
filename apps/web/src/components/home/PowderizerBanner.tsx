import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Storefront entry point for the Custom Powder blend builder. */
export function PowderizerBanner() {
  return (
    <section
      aria-label="Custom Powder builder"
      className="powderizer-banner powderizer-gradient-animated grid overflow-hidden rounded-2xl border-2 border-foreground sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="px-7 py-9 sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em]">Custom Powder</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Blend your own mix.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
          Select compatible ingredients from the catalogue to build a custom powder blend with your own label and finish.
        </p>
      </div>
      <Link
        to="/custom-powder"
        className="m-6 mt-0 inline-flex items-center justify-center gap-2 rounded-full bg-background px-6 py-3 text-center text-sm font-semibold text-foreground transition-transform duration-[var(--powderizer-motion-duration)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:mt-6"
      >
        Open Custom Powder <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </section>
  );
}
