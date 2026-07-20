import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@shop/contracts/products';
import type { PowderMixQuote } from '@shop/contracts/powderizer';
import { BagColourSchemePicker } from './BagColourSchemePicker';
import { PowderMixVisualization, powderColour } from './PowderMixVisualization';
import { PowderizerSummary } from './PowderizerSummary';

function product(id: string, slug: string, powderColor?: string): Product {
  return {
    id,
    name: slug.replaceAll('powdered-', '').replaceAll('-', ' '),
    description: '',
    priceCents: 1,
    imageSetId: slug,
    category: 'Oddities',
    stock: 1,
    slug,
    salesCount: 0,
    createdAt: '2026-07-14T00:00:00.000Z',
    available: true,
    availability: 'in_stock',
    backorderable: false,
    backorderLeadDays: null,
    tags: [],
    specificationGroups: [],
    mixable: true,
    ...(powderColor
      ? {
          packaging: {
            labelColor: '#000',
            powderColor,
            mark: 'C',
            batchCode: '1',
            quantity: '1g',
            consumptionLabel: 'Not for consumption',
          },
        }
      : {}),
  };
}

const products = [product('1', 'powdered-house'), product('2', 'powdered-campfire', '#f60')];

const quote: PowderMixQuote = {
  priceVersion: 'powderizer-v1',
  config: {
    components: [
      { productId: '1', percentage: 40 },
      { productId: '2', percentage: 60 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
    customLabel: null,
    bagColourScheme: 'solar-flare',
  },
  allocations: [
    { productId: '1', percentage: 40, allocatedGrams: 200 },
    { productId: '2', percentage: 60, allocatedGrams: 300 },
  ],
  packagingFeeCents: 1,
  finenessSurchargeCents: 0,
  unitPriceCents: 2,
  usageLabel: 'Not for consumption',
};

describe('Powderizer presentation', () => {
  it('renders five labelled scheme swatches and selects through a typed config callback', () => {
    const onChange = vi.fn();
    render(
      <BagColourSchemePicker
        schemes={[
          'ultraviolet-cyan',
          'solar-flare',
          'deep-space',
          'acid-lilac',
          'monochrome-glitch',
        ]}
        value="ultraviolet-cyan"
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    fireEvent.click(screen.getByLabelText('Solar flare'));
    expect(onChange).toHaveBeenCalledWith('solar-flare');
  });

  it('uses unique SVG clip IDs and maps proportional segments inside the vessel', () => {
    const mix = [
      { productId: '1', percentage: 40 },
      { productId: '2', percentage: 60 },
    ];
    const { container } = render(
      <>
        <PowderMixVisualization components={mix} products={products} />
        <PowderMixVisualization components={mix} products={products} />
      </>,
    );
    const clips = [...container.querySelectorAll('clipPath')];
    const ids = clips.map((clip) => clip.id);
    expect(new Set(ids).size).toBe(2);
    expect(
      [...container.querySelectorAll('g[clip-path]')].map((group) =>
        group.getAttribute('clip-path'),
      ),
    ).toEqual(ids.map((id) => `url(#${id})`));
    const segments = [...container.querySelectorAll<SVGRectElement>('[data-product-id]')];
    expect(segments[0]).toHaveAttribute('x', '8');
    expect(segments[0]).toHaveAttribute('width', '33.6');
    expect(segments[1]).toHaveAttribute('x', '41.6');
    expect(segments[1]).toHaveAttribute('width', '50.4');
    expect(segments[1]).toHaveAttribute('fill', '#f60');
    expect(screen.getAllByText('40%')).toHaveLength(2);
    expect(powderColour(products[0], '1')).toBe(powderColour(products[0], '1'));
  });

  it('renders safety, warnings, and Good for only for multi-component configs', () => {
    const summary = (components: { productId: string; percentage: number }[]) => (
      <PowderizerSummary
        quote={quote}
        namesByProductId={new Map(products.map((item) => [item.id, item.name]))}
        canSubmit={false}
        isSubmitting={false}
        editing={false}
        onSubmit={vi.fn()}
        ingredientWarnings={['Keep separate from open flames.']}
        config={{
          components,
          bagSizeGrams: 500,
          fineness: 'standard',
          customLabel: '',
          bagColourScheme: 'solar-flare',
        }}
      />
    );
    render(summary(quote.config.components));
    expect(screen.getByLabelText('Server usage label')).toHaveTextContent('Not for consumption');
    expect(screen.getByLabelText('Ingredient warnings')).toHaveTextContent(
      'Keep separate from open flames.',
    );
    expect(screen.getByText('Blend summary')).toBeInTheDocument();
  });

  it('disables Phase 9 transitions under reduced motion', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.powderizer-scheme-option,[\s\S]*?\.powderizer-mix-segment \{[\s\S]*?transition: none;/,
    );
  });
});
