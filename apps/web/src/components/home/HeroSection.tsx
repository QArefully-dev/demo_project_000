import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative grid min-h-[430px] overflow-hidden rounded-3xl bg-primary text-primary-foreground lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative z-10 flex flex-col items-start justify-center px-7 py-12 sm:px-12 lg:px-16">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">
          <Sparkles className="size-4" /> Everyday finds, thoughtfully chosen
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Make room for things that work beautifully.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/78 sm:text-lg">
          Discover useful technology and everyday essentials selected for simpler, better routines.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" variant="secondary" render={<Link to="/catalog" />}>
            Shop the collection <ArrowRight />
          </Button>
          <Button
            size="lg"
            className="border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            render={<Link to="/catalog?onSale=true&sort=bestselling" />}
          >
            Explore deals
          </Button>
        </div>
      </div>
      <div className="relative min-h-72 overflow-hidden bg-surface-soft lg:min-h-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.9),rgba(230,225,212,0.65)_55%,rgba(18,55,100,0.22))]" />
        <img
          src="/images/products/wireless-headphones.detail.09cd9a0b2710.1200.webp"
          width="1200"
          height="1200"
          alt="Wireless headphones from the collection"
          className="absolute inset-0 h-full w-full object-contain p-8 mix-blend-multiply lg:p-14"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
