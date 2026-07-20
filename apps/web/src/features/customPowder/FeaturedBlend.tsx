import type { PowderMixDailyRecipe } from '@shop/contracts/powderizer';
import { Button } from '@/components/ui/button';
import type { BuilderConfigSource } from '../powderizer/powderizerState';

type FeaturedBlendProps = {
  blend: PowderMixDailyRecipe;
  onLoad: (config: BuilderConfigSource) => void;
};

export function FeaturedBlend({ blend, onLoad }: FeaturedBlendProps) {
  return (
    <section
      className="rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-surface-raised p-5"
      aria-labelledby="featured-blend-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
        Featured blend
      </p>
      <h2 id="featured-blend-heading" className="mt-2 text-xl font-bold">
        {blend.name}
      </h2>
      {blend.config.components.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {blend.config.components.length} powders · {blend.config.bagSizeGrams}g ·{' '}
          {blend.config.fineness} grind
        </p>
      )}
      <Button type="button" className="mt-4" onClick={() => onLoad(blend.config)}>
        Use this blend
      </Button>
    </section>
  );
}
