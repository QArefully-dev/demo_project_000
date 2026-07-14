import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  type PowderMixConfigInput,
} from '@shop/contracts/powderizer';

type DailyRecipePreset = Readonly<{
  name: string;
  components: readonly Readonly<{ slug: string; percentage: number }>[];
}>;

export interface ResolvedDailyRecipe {
  effectiveDate: string;
  name: string;
  config: PowderMixConfigInput;
}

export const DAILY_POWDER_MIX_RECIPES: readonly DailyRecipePreset[] = [
  {
    name: 'Literal Housewarming',
    components: [
      { slug: 'powdered-house', percentage: 50 },
      { slug: 'powdered-campfire', percentage: 50 },
    ],
  },
  {
    name: 'Working From Anywhere',
    components: [
      { slug: 'macbook-pro', percentage: 34 },
      { slug: 'powdered-wifi', percentage: 33 },
      { slug: 'plane', percentage: 33 },
    ],
  },
  {
    name: 'Lunar Luxury',
    components: [
      { slug: 'moon-rock', percentage: 50 },
      { slug: 'diamond', percentage: 50 },
    ],
  },
  {
    name: 'Open Water',
    components: [
      { slug: 'boat', percentage: 50 },
      { slug: 'powdered-water', percentage: 50 },
    ],
  },
  {
    name: 'Heavy Landing',
    components: [
      { slug: 'plane', percentage: 34 },
      { slug: 'powdered-gravity', percentage: 33 },
      { slug: 'moon-rock', percentage: 33 },
    ],
  },
  {
    name: 'Quiet Connection',
    components: [
      { slug: 'powdered-wifi', percentage: 50 },
      { slug: 'powdered-silence', percentage: 50 },
    ],
  },
  {
    name: 'Weekend Project',
    components: [
      { slug: 'powdered-house', percentage: 34 },
      { slug: 'powdered-weekend', percentage: 33 },
      { slug: 'diamond', percentage: 33 },
    ],
  },
];

function utcEpochDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / (24 * 60 * 60 * 1000),
  );
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Resolves the UTC daily preset against currently eligible persisted products. */
export function resolveDailyPowderMixRecipe(
  date: Date,
  eligibleProducts: readonly Pick<{ id: number; slug: string }, 'id' | 'slug'>[],
): ResolvedDailyRecipe {
  if (Number.isNaN(date.getTime())) throw new Error('Daily recipe date is invalid.');
  const preset = DAILY_POWDER_MIX_RECIPES.at(
    ((utcEpochDay(date) % DAILY_POWDER_MIX_RECIPES.length) + DAILY_POWDER_MIX_RECIPES.length) %
      DAILY_POWDER_MIX_RECIPES.length,
  );
  if (!preset) throw new Error('Daily recipe presets are unavailable.');

  const productIdBySlug = new Map(eligibleProducts.map((product) => [product.slug, product.id]));
  const components = preset.components.map((component) => {
    const productId = productIdBySlug.get(component.slug);
    if (productId === undefined) {
      throw new Error(`Daily recipe product is unavailable: ${component.slug}.`);
    }
    return { productId: String(productId), percentage: component.percentage };
  });

  return {
    effectiveDate: utcDate(date),
    name: preset.name,
    config: {
      components,
      bagSizeGrams: 500,
      fineness: 'standard',
      bagColourScheme: DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
    },
  };
}
