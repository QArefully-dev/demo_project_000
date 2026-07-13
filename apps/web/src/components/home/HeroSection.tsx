import { ArrowRight } from 'lucide-react';
import type { ImgHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { getProductMedia } from '@shop/contracts';
import { Button } from '@/components/ui/button';

const heroImagePriority = {
  fetchpriority: 'high',
} as unknown as ImgHTMLAttributes<HTMLImageElement>;
const heroBags = [
  getProductMedia('powdered-water', 'detail'),
  getProductMedia('protein-powder', 'card'),
  getProductMedia('powdered-campfire', 'card'),
].filter(Boolean);

export function HeroSection() {
  return (
    <section className="powder-hero relative grid min-h-[430px] overflow-hidden rounded-2xl border-2 border-foreground bg-primary text-primary-foreground lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative z-10 flex flex-col items-start justify-center px-7 py-12 sm:px-12 lg:px-16">
        <p className="powder-stamp mb-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground">
          QArefully Powder Co. / Batch 001
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          We will powder anything.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/78 sm:text-lg">
          Credible powders through impossible powders, packed with measured confidence and no
          unnecessary explanation.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="secondary"
            nativeButton={false}
            render={<Link to="/catalog" />}
          >
            Shop powders <ArrowRight />
          </Button>
          <Button
            size="lg"
            nativeButton={false}
            className="border-primary-foreground/65 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            render={<Link to="/catalog?category=Impossible" />}
          >
            Browse impossible powders
          </Button>
        </div>
      </div>
      <div className="powder-hero-art relative min-h-72 overflow-hidden bg-surface-soft lg:min-h-full">
        <div aria-hidden="true" className="powder-measurements absolute inset-4" />
        {heroBags.map((image, index) =>
          image ? (
            <img
              key={image.src}
              src={image.src}
              width={image.width}
              height={image.height}
              alt={index === 0 ? image.alt : ''}
              className={`powder-hero-bag powder-hero-bag-${index} absolute object-contain mix-blend-multiply`}
              {...(index === 0 ? heroImagePriority : { loading: 'lazy' })}
            />
          ) : null,
        )}
      </div>
    </section>
  );
}
