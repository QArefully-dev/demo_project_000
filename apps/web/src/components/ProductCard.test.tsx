import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Product } from '@shop/contracts';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProductCard } from './ProductCard';

vi.mock('@/components/WishlistButton', () => ({
  WishlistButton: ({ productId }: { productId: string }) => (
    <button type="button" aria-label={`Add ${productId} to wishlist`}>
      Wishlist
    </button>
  ),
}));

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water-1',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 7999,
  compareAtPriceCents: 9999,
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

function renderCard(
  productOverrides: Partial<Product> = {},
  props: Partial<React.ComponentProps<typeof ProductCard>> = {},
) {
  const onAddToCart = props.onAddToCart ?? vi.fn().mockResolvedValue(true);
  render(
    <MemoryRouter>
      <ProductCard
        product={product(productOverrides)}
        onAddToCart={onAddToCart}
        isCartAvailable={true}
        {...props}
      />
    </MemoryRouter>,
  );
  return onAddToCart;
}

describe('ProductCard', () => {
  it('shows sale pricing and suppresses the compare-at price for regular products', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProductCard
          product={product()}
          onAddToCart={vi.fn().mockResolvedValue(true)}
          isCartAvailable={true}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('$79.99')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProductCard
          product={product({ compareAtPriceCents: undefined })}
          onAddToCart={vi.fn().mockResolvedValue(true)}
          isCartAvailable={true}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    expect(screen.queryByText('$99.99')).not.toBeInTheDocument();
  });

  it('links image and title to the product while leaving wishlist and cart actions separate', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Contract image' })).toHaveAttribute(
      'href',
      '/products/powdered-water-1',
    );
    expect(screen.getByRole('link', { name: 'Powdered Water' })).toHaveAttribute(
      'href',
      '/products/powdered-water-1',
    );
    expect(
      screen.getByRole('button', { name: 'Add powdered-water-1 to wishlist' }).closest('a'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Add powder' }).closest('a')).toBeNull();
  });

  it('disables purchase for unavailable stock and labels low stock', () => {
    renderCard({ stock: 0 });
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();

    renderCard({ id: 'low-stock', stock: 2 });
    expect(screen.getByText('Only 2 left')).toBeInTheDocument();
  });

  it('exposes external pending and failed add-to-cart states', async () => {
    const user = userEvent.setup();
    const onAddToCart = renderCard({}, { onAddToCart: vi.fn().mockResolvedValue(false) });

    await user.click(screen.getByRole('button', { name: 'Add powder' }));

    expect(onAddToCart).toHaveBeenCalledWith('powdered-water-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not add this item. Try again.',
    );

    renderCard({ id: 'pending-item' }, { isAdding: true });
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
  });
});
