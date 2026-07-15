import { describe, expect, it } from 'vitest';
import {
  canonicalGoodForKey,
  selectGoodFor,
  selectIngredientReaction,
  stableHash,
} from './powderizerCopy';
import type { BuilderConfig } from './powderizerState';

const config: BuilderConfig = {
  components: [
    { productId: '2', percentage: 40 },
    { productId: '1', percentage: 60 },
  ],
  bagSizeGrams: 500,
  fineness: 'fine',
  bagColourScheme: 'solar-flare',
  customLabel: 'Ignored by copy',
};

describe('powderizer copy helpers', () => {
  it('keeps canonical configs on same identity and Good for copy', () => {
    const equivalent = {
      ...config,
      components: [...config.components].reverse(),
      customLabel: 'Other label',
    };
    expect(canonicalGoodForKey(equivalent)).toBe(canonicalGoodForKey(config));
    expect(selectGoodFor(equivalent)).toBe(selectGoodFor(config));
    expect(stableHash(canonicalGoodForKey(config))).toBeGreaterThanOrEqual(0);
  });

  it('uses listed reaction priority and ignores ratio-only changes', () => {
    const selected = ['powdered-house', 'powdered-campfire', 'diamond'];
    expect(selectIngredientReaction(selected)).toBe(
      'Housewarming achieved. Keep away from actual flames.',
    );
    expect(selectIngredientReaction([...selected].reverse())).toBe(
      selectIngredientReaction(selected),
    );
  });
});
