import { compareBuilderProductIds, type BuilderConfig } from './powderizerState';

export const GOOD_FOR_OPTIONS = [
  'Sleep',
  'House-warming parties',
  'Negotiating raises',
  'Absolutely nothing',
  'Long life',
  'Hairy legs',
  'Tax avoidance',
  'Sunday recovery',
  'Difficult decisions',
  'Courage before dentist appointments',
  'Restoring Wi-Fi',
  'Ambitious baking',
  'Awkward silences',
  'First dates',
  'Avoiding small talk',
  'Garden morale',
  'Monday mornings',
  'Moving house',
  'Remembering passwords',
  'Emergency confidence',
] as const;

const REACTIONS = [
  {
    slugs: ['powdered-house', 'powdered-campfire'],
    copy: 'Housewarming achieved. Keep away from actual flames.',
  },
  { slugs: ['macbook-pro', 'powdered-wifi'], copy: 'Remote work ingredients detected.' },
  {
    slugs: ['boat', 'powdered-water'],
    copy: 'Returning ingredients to their natural habitat.',
  },
  { slugs: ['plane', 'moon-rock'], copy: 'Flight plan exceeds current airspace.' },
  { slugs: ['diamond', 'powdered-gravity'], copy: 'Heavy investment detected.' },
  {
    slugs: ['powdered-wifi', 'powdered-silence'],
    copy: 'Connection established. Notifications absent.',
  },
  { slugs: ['powdered-house', 'diamond'], copy: 'Aggressive property appreciation.' },
  { slugs: ['powdered-campfire', 'powdered-moonlight'], copy: 'Night shift ready.' },
] as const;

/** FNV-1a unsigned 32-bit hash: stable across browser sessions. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function canonicalGoodForKey(config: BuilderConfig): string {
  return JSON.stringify({
    components: [...config.components]
      .sort((left, right) => compareBuilderProductIds(left.productId, right.productId))
      .map(({ productId, percentage }) => ({ productId, percentage })),
    bagSizeGrams: config.bagSizeGrams,
    fineness: config.fineness,
    bagColourScheme: config.bagColourScheme,
  });
}

export function selectGoodFor(config: BuilderConfig): (typeof GOOD_FOR_OPTIONS)[number] | null {
  if (config.components.length < 2) return null;
  return GOOD_FOR_OPTIONS[stableHash(canonicalGoodForKey(config)) % GOOD_FOR_OPTIONS.length]!;
}

export function selectIngredientReaction(slugs: readonly string[]): string | null {
  const selected = new Set(slugs);
  return (
    REACTIONS.find(({ slugs: required }) => required.every((slug) => selected.has(slug)))?.copy ??
    null
  );
}
