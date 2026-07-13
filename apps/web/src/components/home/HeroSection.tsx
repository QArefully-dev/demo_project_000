import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProductVisual } from '@shop/contracts';
import { BagArtwork } from '@/components/BagArtwork';
import { Button } from '@/components/ui/button';

const heroBags = [
  {
    imageSetId: 'powdered-water',
    name: 'Powdered Water',
    category: 'Impossible',
    quantity: 'Conceptual quantity',
  },
  {
    imageSetId: 'protein-powder',
    name: 'Protein Powder',
    category: 'Pantry Staples',
    quantity: '1kg',
  },
  {
    imageSetId: 'powdered-campfire',
    name: 'Powdered Campfire',
    category: 'Outdoors',
    quantity: '200g',
  },
].flatMap((bag) => {
  const visual = getProductVisual(bag.imageSetId);
  return visual ? [{ ...bag, visual }] : [];
});

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
        {heroBags.map((bag, index) => (
          <BagArtwork
            key={bag.imageSetId}
            shape="paper-square"
            decoration="paired-ovals"
            name={bag.name}
            category={bag.category}
            quantity={bag.quantity}
            batchCode={bag.visual.batchCode}
            mark={bag.visual.mark}
            accent={bag.visual.labelColor}
            powderAccent={bag.visual.powderColor}
            ariaLabel={index === 0 ? `${bag.name} powder bag` : ''}
            className={`powder-hero-bag powder-hero-bag-${index} absolute object-contain mix-blend-multiply`}
          />
        ))}
      </div>
    </section>
  );
}
