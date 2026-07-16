import type { PowderMixDailyRecipe } from '@shop/contracts/powderizer';
import { Button } from '@/components/ui/button';
import type { BuilderConfigSource } from './powderizerState';

type DailyRecipeCardProps = {
  recipe: PowderMixDailyRecipe;
  onLoad: (config: BuilderConfigSource) => void;
};

export function DailyRecipeCard({ recipe, onLoad }: DailyRecipeCardProps) {
  return (
    <section
      className="rounded-lg border border-border bg-surface-raised p-4"
      aria-labelledby="daily-recipe-heading"
    >
      <p className="text-sm font-medium text-muted-foreground">
        Daily recipe · {recipe.effectiveDate}
      </p>
      <h2 id="daily-recipe-heading" className="mt-1 text-lg font-semibold">
        {recipe.name}
      </h2>
      <Button
        type="button"
        className="mt-3"
        variant="outline"
        onClick={() => onLoad(recipe.config)}
      >
        Load daily recipe
      </Button>
    </section>
  );
}
