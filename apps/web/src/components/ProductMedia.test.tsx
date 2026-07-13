import { fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ProductMedia } from './ProductMedia';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water-1',
  name: 'Powdered Water',
  description: 'A 250g bag of water, reconsidered.',
  priceCents: 1299,
  imageSetId: 'powdered-water',
  images: [
    {
      src: '/contract-image.webp',
      alt: 'Contract image',
      width: 720,
      height: 720,
    },
  ],
  category: 'Impossible',
  stock: 10,
  slug: 'powdered-water',
  salesCount: 10,
  ...overrides,
});

describe('ProductMedia', () => {
  it('renders the locked data-driven bag for a catalogued image set', () => {
    render(<ProductMedia product={product()} loading="eager" fetchPriority="high" />);

    const artwork = screen.getByRole('img', { name: 'Powdered Water powder bag' });
    expect(artwork.tagName).toBe('svg');
    expect(artwork).toHaveAttribute('viewBox', '0 0 720 720');
    expect(artwork).toHaveTextContent('POWDERED');
    expect(artwork).toHaveTextContent('WATER');
  });

  it('balances long product names across the generated label', () => {
    render(
      <ProductMedia
        product={product({
          name: 'Powdered Five More Minutes',
          imageSetId: 'powdered-five-more-minutes',
        })}
      />,
    );

    const artwork = screen.getByRole('img', {
      name: 'Powdered Five More Minutes powder bag',
    });
    expect(artwork).toHaveTextContent('POWDERED FIVE');
    expect(artwork).toHaveTextContent('MORE MINUTES');
  });

  it('uses a deterministic SVG only when the API record has no usable image', () => {
    render(
      <ProductMedia
        product={product({ imageSetId: 'retired-set', category: 'unknown', images: [] })}
      />,
    );

    const image = screen.getByRole('img', { name: 'Powdered Water' });
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
    expect(image).toHaveAttribute('width', '720');
    expect(image).toHaveAttribute('height', '720');
  });

  it('switches to the deterministic fallback after an image request error', () => {
    const onError = vi.fn();
    render(
      <ProductMedia
        product={product({ imageSetId: 'retired-set', category: 'unknown' })}
        onError={onError}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Contract image' }));

    const image = screen.getByRole('img', { name: 'Powdered Water' });
    expect(onError).toHaveBeenCalledOnce();
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
  });
});
