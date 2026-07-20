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
    name: 'Protein Shake Base',
    components: [
      { slug: 'whey-protein-isolate', percentage: 50 },
      { slug: 'collagen-peptides', percentage: 30 },
      { slug: 'matcha-green-tea-powder', percentage: 20 },
    ],
  },
  {
    name: 'Baking Essentials Mix',
    components: [
      { slug: 'all-purpose-flour', percentage: 40 },
      { slug: 'powdered-sugar', percentage: 30 },
      { slug: 'baking-powder', percentage: 30 },
    ],
  },
  {
    name: 'All-Purpose Garden Feed',
    components: [
      { slug: 'all-purpose-garden-fertilizer', percentage: 40 },
      { slug: 'bone-meal', percentage: 30 },
      { slug: 'kelp-meal', percentage: 30 },
    ],
  },
  {
    name: 'Home Cleaning Kit',
    components: [
      { slug: 'laundry-detergent-powder', percentage: 50 },
      { slug: 'all-purpose-cleaner-powder', percentage: 30 },
      { slug: 'scouring-powder', percentage: 20 },
    ],
  },
  {
    name: 'Standard Concrete Mix',
    components: [
      { slug: 'portland-cement', percentage: 50 },
      { slug: 'silica-sand', percentage: 30 },
      { slug: 'stone-dust', percentage: 20 },
    ],
  },
  {
    name: 'Hot Chocolate Blend',
    components: [
      { slug: 'cocoa-powder', percentage: 40 },
      { slug: 'powdered-sugar', percentage: 40 },
      { slug: 'vanilla-milkshake-powder', percentage: 20 },
    ],
  },
  {
    name: 'Sports Recovery Mix',
    components: [
      { slug: 'recovery-blend', percentage: 40 },
      { slug: 'bcaa-powder', percentage: 30 },
      { slug: 'electrolyte-blend', percentage: 30 },
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
