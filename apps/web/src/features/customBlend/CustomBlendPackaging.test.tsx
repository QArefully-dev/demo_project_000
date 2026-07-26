import { render, screen } from '@testing-library/react';
import type { CustomBlendSnapshot } from '@shop/contracts/custom-blends';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it } from 'vitest';
import {
  CUSTOM_BLEND_INK,
  CUSTOM_BLEND_PIGMENT,
  CUSTOM_BLEND_SCHEME_KEY,
  CustomBlendPackaging,
  customBlendBatchMark,
  customBlendCompositionLabel,
} from './CustomBlendPackaging';

const CONFIG_KEY = `9f3c1d${'0'.repeat(58)}`;

function product(category: string): Product {
  return {
    id: '9',
    name: 'Portland Cement',
    description: 'Base material.',
    priceCents: 1_200,
    imageSetId: 'portland-cement',
    category,
    stock: 40,
    availability: 'in_stock',
    backorderable: false,
    backorderLeadDays: null,
    slug: 'portland-cement',
    salesCount: 0,
    createdAt: '2026-07-14T00:00:00.000Z',
    available: true,
    tags: [],
    specificationGroups: [],
  };
}

function blend(overrides?: Partial<CustomBlendSnapshot>): CustomBlendSnapshot {
  return {
    configKey: CONFIG_KEY,
    basePercentage: 80,
    mixingGroup: 'mineral',
    ingredients: [
      {
        variantId: 601,
        productId: '11',
        productName: 'Chalk Filler',
        productDescription: 'Filler',
        mixingGroup: 'mineral',
        percentage: 15,
      },
      {
        variantId: 602,
        productId: '12',
        productName: 'Silica Flour',
        productDescription: 'Filler',
        mixingGroup: 'mineral',
        percentage: 5,
      },
    ],
    blendingFeeCents: 2_500,
    madeToOrder: true,
    returnable: false,
    ...overrides,
  };
}

function renderLivery(category: string, snapshot: CustomBlendSnapshot = blend()) {
  const { unmount } = render(
    <CustomBlendPackaging
      product={product(category)}
      variant={{ sku: 'MAT-501', label: '25 kg sack' }}
      blend={snapshot}
    />,
  );
  const livery = screen.getByTestId('custom-blend-livery');
  const attributes = {
    vessel: livery.getAttribute('data-vessel'),
    scheme: livery.getAttribute('data-colour-scheme'),
    pigment: livery.getAttribute('data-pigment'),
    ink: livery.getAttribute('data-ink'),
    batchMark: livery.getAttribute('data-batch-mark'),
  };
  return { attributes, unmount };
}

describe('CustomBlendPackaging', () => {
  it('selects the vessel from the base category alone', () => {
    const cases: [string, string][] = [
      ['Trade & Creative Materials', 'kraft-sack'],
      ['Garden & Outdoors', 'woven-sack'],
      ['Household & Cleaning', 'keg'],
      ['Baking & Pantry', 'food-bag'],
    ];

    for (const [category, vessel] of cases) {
      const { attributes, unmount } = renderLivery(category);
      expect(attributes.vessel).toBe(vessel);
      unmount();
    }
  });

  it('prints byte-identical scheme, pigment and ink for two different compositions on one base', () => {
    // Differs from the default blend in every field a colour could plausibly be derived from:
    // mixing group, base share, ingredient identity and ingredient count.
    const other = blend({
      basePercentage: 50,
      mixingGroup: 'polymer',
      ingredients: [
        {
          variantId: 701,
          productId: '13',
          productName: 'Ground Limestone',
          productDescription: 'Filler',
          mixingGroup: 'polymer',
          percentage: 50,
        },
      ],
    });

    for (const category of ['Trade & Creative Materials', 'Garden & Outdoors', 'Baking & Pantry']) {
      const first = renderLivery(category);
      const firstAttributes = first.attributes;
      first.unmount();

      const second = renderLivery(category, other);
      const secondAttributes = second.attributes;
      second.unmount();

      expect(firstAttributes.scheme).toBe(CUSTOM_BLEND_SCHEME_KEY);
      expect(secondAttributes.scheme).toBe(firstAttributes.scheme);
      expect(firstAttributes.pigment).toBe(CUSTOM_BLEND_PIGMENT);
      expect(secondAttributes.pigment).toBe(firstAttributes.pigment);
      expect(firstAttributes.ink).toBe(CUSTOM_BLEND_INK);
      expect(secondAttributes.ink).toBe(firstAttributes.ink);
    }
  });

  it('marks the batch from the config key', () => {
    const { attributes } = renderLivery('Trade & Creative Materials');

    expect(attributes.batchMark).toBe('CB-9F3C1D');
    expect(customBlendBatchMark(CONFIG_KEY)).toBe('CB-9F3C1D');
  });

  it('labels the vessel as a custom blend for assistive technology', () => {
    render(<CustomBlendPackaging product={product('Garden & Outdoors')} blend={blend()} />);

    expect(
      screen.getByRole('img', { name: 'Portland Cement custom blend woven sack' }),
    ).toBeInTheDocument();
  });

  it('formats the composition as the base name followed by each ingredient share', () => {
    expect(customBlendCompositionLabel('Portland Cement', blend())).toBe(
      'Portland Cement — 15% Chalk Filler, 5% Silica Flour',
    );
  });
});
