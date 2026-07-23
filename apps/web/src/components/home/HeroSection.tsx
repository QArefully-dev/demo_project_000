import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const marketSignals = [
  {
    label: 'Food ingredients',
    detail: 'Specification-led supply',
  },
  {
    label: 'Performance inputs',
    detail: 'Pack formats for teams',
  },
  {
    label: 'Trade materials',
    detail: 'Clear availability signals',
  },
];

export function HeroSection() {
  return (
    <section className="powder-hero relative grid min-h-[430px] overflow-hidden rounded-2xl border-2 border-foreground bg-primary text-primary-foreground lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative z-10 flex flex-col items-start justify-center px-7 py-12 sm:px-12 lg:px-16">
        <p className="powder-stamp mb-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground">
          QArefully Materials Exchange / Supply desk
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Materials supply with operational clarity.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/78 sm:text-lg">
          Source materials across food, performance, home and trade with clear specifications,
          practical pack formats and dependable availability data.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="secondary"
            nativeButton={false}
            render={<Link to="/catalog" />}
          >
            Browse materials <ArrowRight />
          </Button>
        </div>
      </div>
      <div
        aria-label="Materials exchange supply overview"
        className="powder-hero-art relative grid min-h-72 content-center gap-3 overflow-hidden bg-surface-soft p-6 sm:p-10 lg:min-h-full"
      >
        <div aria-hidden="true" className="powder-measurements absolute inset-4" />
        <p className="relative text-xs font-bold tracking-[0.18em] text-foreground uppercase">
          Exchange board
        </p>
        {marketSignals.map((signal, index) => (
          <article
            key={signal.label}
            className="relative border border-foreground/25 bg-background/85 px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {signal.label}
            </h2>
            <p className="text-sm text-muted-foreground">{signal.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
