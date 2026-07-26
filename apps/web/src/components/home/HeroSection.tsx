import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PackagingArtwork } from '@/components/packaging/PackagingArtwork';
import {
  CATALOG_PACKAGING_PALETTES,
  type CatalogPackagingCategory,
} from '@/components/packaging/catalogPackagingPalettes';
import { PACKAGING_BRAND, type PackagingSpec } from '@/components/packaging/packagingSpec';
import { INKS, titleLines, type InkKey } from '@/components/packaging/svgText';
import { Button } from '@/components/ui/button';

interface HeroVessel {
  /** Accessible name is suppressed per vessel; kept for the artwork components' internal copy. */
  name: string;
  spec: PackagingSpec;
  className: string;
}

/**
 * Hand-authored decorative specs for the hero's stacked vessels. Deliberately not resolved from a
 * catalog product: the hero renders before any catalog fetch and must not imply a specific SKU, so
 * `lot` carries a visibly generic sample code rather than a catalog SKU. Colours reuse the first
 * scheme of each category's palette so the stack matches what the catalog actually prints.
 */
function heroSpec(
  category: CatalogPackagingCategory,
  inkKey: InkKey,
  vessel: PackagingSpec['vessel'],
  name: string,
  lot: string,
  extra: Partial<PackagingSpec> = {},
): PackagingSpec {
  const [palette] = CATALOG_PACKAGING_PALETTES[category];
  return {
    vessel,
    schemeKey: palette.key,
    pigment: palette.pigment,
    ink: { ink: palette.ink, alert: INKS[inkKey].alert },
    brand: PACKAGING_BRAND,
    titleLines: titleLines(name),
    sub: category,
    lot,
    netWeight: '25 kg',
    ...extra,
  };
}

const heroVessels: readonly HeroVessel[] = [
  {
    name: 'Trade materials sack',
    spec: heroSpec(
      'Trade & Creative Materials',
      'trade',
      'kraft-sack',
      'Trade materials',
      'TCM-SAMPLE',
    ),
    className: 'powder-hero-bag-0',
  },
  {
    name: 'Garden materials sack',
    spec: heroSpec('Garden & Outdoors', 'garden', 'woven-sack', 'Garden materials', 'GDN-SAMPLE'),
    className: 'powder-hero-bag-1',
  },
  {
    name: 'Cleaning materials keg',
    spec: heroSpec('Household & Cleaning', 'clean', 'keg', 'Cleaning materials', 'HCL-SAMPLE', {
      tone: 'mild',
    }),
    className: 'powder-hero-bag-2',
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
        className="powder-hero-art relative min-h-72 overflow-hidden bg-surface-soft p-6 sm:p-10 lg:min-h-full"
      >
        <div aria-hidden="true" className="powder-measurements absolute inset-4" />
        {heroVessels.map((vessel) => (
          <PackagingArtwork
            key={vessel.className}
            name={vessel.name}
            spec={vessel.spec}
            mark=""
            consumptionLabel={null}
            ariaLabel=""
            className={`powder-hero-bag ${vessel.className} absolute`}
          />
        ))}
      </div>
    </section>
  );
}
