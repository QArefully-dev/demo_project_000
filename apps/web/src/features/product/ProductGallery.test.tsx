import { render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it } from 'vitest';

import { ProductGallery } from './ProductGallery';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
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
  stock: 8,
  slug: 'powdered-water',
  salesCount: 12,
  ...overrides,
  createdAt: overrides.createdAt ?? '2026-07-14T00:00:00.000Z',
  available: overrides.available ?? true,
  tags: overrides.tags ?? [],
  specificationGroups: overrides.specificationGroups ?? [],
  mixable: overrides.mixable ?? false,
});

describe('ProductGallery', () => {
  it('renders one canonical live packaging artwork without raster thumbnails', () => {
    render(<ProductGallery product={product()} />);

    expect(screen.getByRole('img', { name: 'Powdered Water powder bag' }).tagName).toBe('svg');
    expect(screen.queryByRole('button', { name: /view image/i })).not.toBeInTheDocument();
  });
});
