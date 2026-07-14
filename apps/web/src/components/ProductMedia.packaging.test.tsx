import { render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/BagArtwork', () => ({
  BagArtwork: ({ accent, powderAccent }: { accent?: string; powderAccent?: string }) => (
    <output data-testid="bag-artwork" data-accent={accent} data-powder-accent={powderAccent} />
  ),
}));

import { ProductMedia } from './ProductMedia';

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
};

describe('ProductMedia packaging mapping', () => {
  it('maps canonical label and powder colors to BagArtwork props', () => {
    render(<ProductMedia product={product} />);

    const artwork = screen.getByTestId('bag-artwork');
    expect(artwork).toHaveAttribute('data-accent', product.packaging?.labelColor);
    expect(artwork).toHaveAttribute('data-powder-accent', product.packaging?.powderColor);
  });
});
