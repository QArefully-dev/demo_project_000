import { fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@shop/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ProductMedia } from './ProductMedia';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'headphones-1',
  name: 'Studio Headphones',
  description: 'Balanced sound for focused listening.',
  priceCents: 7999,
  imageSetId: 'headphones',
  images: [
    {
      src: '/contract-image.webp',
      alt: 'Contract image',
      width: 720,
      height: 720,
    },
  ],
  category: 'audio',
  stock: 10,
  slug: 'studio-headphones',
  salesCount: 10,
  ...overrides,
});

describe('ProductMedia', () => {
  it('renders the registered image with explicit dimensions and supplied loading priority', () => {
    render(<ProductMedia product={product()} loading="eager" fetchPriority="high" />);

    const image = screen.getByRole('img', { name: 'Over-ear headphones' });
    expect(image).toHaveAttribute(
      'src',
      '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
    );
    expect(image).toHaveAttribute('width', '720');
    expect(image).toHaveAttribute('height', '720');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('uses the category fallback when its image set is not registered', () => {
    render(
      <ProductMedia product={product({ imageSetId: 'retired-set', category: 'accessories' })} />,
    );

    const image = screen.getByRole('img', { name: 'USB-C multiport hub' });
    expect(image).toHaveAttribute('src', '/images/products/usb-hub.card.9b304cc40aad.720.webp');
  });

  it('uses a deterministic SVG when neither image set nor category has a fallback', () => {
    render(<ProductMedia product={product({ imageSetId: 'retired-set', category: 'unknown' })} />);

    const image = screen.getByRole('img', { name: 'Studio Headphones' });
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
    expect(image).toHaveAttribute('width', '720');
    expect(image).toHaveAttribute('height', '720');
  });

  it('switches to the deterministic fallback after an image request error', () => {
    const onError = vi.fn();
    render(<ProductMedia product={product()} onError={onError} />);

    fireEvent.error(screen.getByRole('img', { name: 'Over-ear headphones' }));

    const image = screen.getByRole('img', { name: 'Studio Headphones' });
    expect(onError).toHaveBeenCalledOnce();
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
  });
});
