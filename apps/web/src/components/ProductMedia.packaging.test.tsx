import { render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/BagArtwork', () => ({
  BagArtwork: ({ accent, powderAccent }: { accent?: string; powderAccent?: string }) => (
    <output data-testid="bag-artwork" data-accent={accent} data-powder-accent={powderAccent} />
  ),
}));

import { ProductMedia, resolveFoodBagArtwork } from './ProductMedia';

const product: Product = {
  id: 'powdered-water-1',
  name: 'Powdered Water',
  description: 'A bag of water, reconsidered.',
  priceCents: 1299,
  imageSetId: 'powdered-water',
  packaging: {
    labelColor: '#287fa6',
    powderColor: '#b9e2ee',
    mark: 'H2O',
    batchCode: 'IMP-07',
    quantity: 'Conceptual quantity',
    consumptionLabel: 'Not for consumption',
  },
  category: 'Impossible',
  stock: 10,
  slug: 'powdered-water',
  salesCount: 10,
  createdAt: '2026-07-14T00:00:00.000Z',
  available: true,
  availability: 'in_stock',
  backorderable: false,
  backorderLeadDays: null,
  tags: [],
  specificationGroups: [],
  mixable: false,
};

describe('ProductMedia packaging mapping', () => {
  it('maps canonical label and powder colors to BagArtwork props', () => {
    render(<ProductMedia product={product} />);

    const artwork = screen.getByTestId('bag-artwork');
    expect(artwork).toHaveAttribute('data-accent', product.packaging?.labelColor);
    expect(artwork).toHaveAttribute('data-powder-accent', product.packaging?.powderColor);
  });

  it('derives deterministic food bag inputs from list-safe fields only', () => {
    const listProduct = {
      category: 'Sports Nutrition',
      name: 'Whey Protein Isolate',
      imageSetId: 'whey-protein-isolate',
    } as const;

    const first = resolveFoodBagArtwork(listProduct);
    const second = resolveFoodBagArtwork(listProduct);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      accent: '#547a6e',
      powderAccent: '#d5e3c0',
      mark: 'SN',
      category: 'Sports Nutrition',
      quantity: '1 kg',
    });
    expect(first?.batchCode).toMatch(/^F-[A-Z0-9]{6}$/);
  });

  it('does not invent food artwork for unknown categories', () => {
    expect(
      resolveFoodBagArtwork({
        category: 'Retired Materials',
        name: 'Legacy Product',
        imageSetId: 'legacy-product',
      }),
    ).toBeUndefined();
  });
});
