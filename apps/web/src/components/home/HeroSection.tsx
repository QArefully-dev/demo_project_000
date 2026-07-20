import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BagArtwork } from '@/components/BagArtwork';
import { Button } from '@/components/ui/button';

const heroBags = [
  {
    name: 'Protein Powder',
    category: 'Sports Nutrition',
    quantity: '1kg',
    batchCode: 'SN-01',
    mark: 'PRO',
    accent: '#78956c',
    powderAccent: '#d5dfbc',
    consumptionLabel: null,
  },
  {
    name: 'Powdered Sugar',
    category: 'Baking & Pantry',
    quantity: '500g',
    batchCode: 'BP-01',
    mark: 'SUG',
    accent: '#e1a156',
    powderAccent: '#f2d8a6',
    consumptionLabel: null,
  },
  {
    name: 'Cement Mix',
    category: 'Trade & Creative',
    quantity: '25kg',
    batchCode: 'TC-01',
    mark: 'CEM',
    accent: '#8c7ba8',
    powderAccent: '#d0c3df',
    consumptionLabel: 'Not for consumption',
  },
];

export function HeroSection() {
  return (
    <section className="powder-hero relative grid min-h-[430px] overflow-hidden rounded-2xl border-2 border-foreground bg-primary text-primary-foreground lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative z-10 flex flex-col items-start justify-center px-7 py-12 sm:px-12 lg:px-16">
        <p className="powder-stamp mb-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground">
          QArefully Powder Co. / Batch 001
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Powders for food, performance, home and trade.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/78 sm:text-lg">
          Shop QArefully own-label powders with clear specifications, practical pack sizes and
          dependable product information.
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
            render={<Link to="/custom-powder" />}
          >
            Custom blends
          </Button>
        </div>
      </div>
      <div className="powder-hero-art relative min-h-72 overflow-hidden bg-surface-soft lg:min-h-full">
        <div aria-hidden="true" className="powder-measurements absolute inset-4" />
        {heroBags.map((bag, index) => (
          <BagArtwork
            key={bag.name}
            {...bag}
            ariaLabel={index === 0 ? `${bag.name} powder bag` : ''}
            className={`powder-hero-bag powder-hero-bag-${index} absolute object-contain mix-blend-multiply`}
          />
        ))}
      </div>
    </section>
  );
}
