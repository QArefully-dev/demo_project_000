import { render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it } from 'vitest';

import { ProductMedia } from './ProductMedia';

const packaging = {
  labelColor: '#287fa6',
  powderColor: '#b9e2ee',
  mark: 'H2O',
  batchCode: 'IMP-07',
  quantity: 'Conceptual quantity',
  consumptionLabel: 'Not for consumption',
} as const;

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water-1',
  name: 'Powdered Water',
  description: 'A 250g bag of water, reconsidered.',
  priceCents: 1299,
  imageSetId: 'powdered-water',
  packaging,
  category: 'Impossible',
  stock: 10,
  slug: 'powdered-water',
  salesCount: 10,
  ...overrides,
  createdAt: overrides.createdAt ?? '2026-07-14T00:00:00.000Z',
  available: overrides.available ?? true,
  tags: overrides.tags ?? [],
  specificationGroups: overrides.specificationGroups ?? [],
  mixable: overrides.mixable ?? false,
  availability: overrides.availability ?? 'in_stock',
  backorderable: overrides.backorderable ?? false,
  backorderLeadDays: overrides.backorderLeadDays ?? null,
});

describe('ProductMedia', () => {
  it('renders canonical packaging data as the locked live bag', () => {
    render(<ProductMedia product={product()} />);

    const artwork = screen.getByRole('img', { name: 'Powdered Water powder bag' });
    expect(artwork.tagName).toBe('svg');
    expect(artwork).toHaveTextContent('CONCEPTUAL QUANTITY');
    expect(artwork).toHaveTextContent('NOT FOR CONSUMPTION');
  });

  it('omits a warning label for consumable packaging', () => {
    render(
      <ProductMedia product={product({ packaging: { ...packaging, consumptionLabel: null } })} />,
    );

    expect(screen.getByRole('img', { name: 'Powdered Water powder bag' })).not.toHaveTextContent(
      'NOT FOR CONSUMPTION',
    );
  });

  it('uses an accessible generic fallback for noncanonical products', () => {
    render(<ProductMedia product={product({ imageSetId: 'retired-set', packaging: undefined })} />);

    const image = screen.getByRole('img', { name: 'Powdered Water' });
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
    expect(image).toHaveAttribute('width', '720');
    expect(image).toHaveAttribute('height', '720');
  });
});
