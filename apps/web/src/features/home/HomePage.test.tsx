import { render, screen, waitFor } from '@testing-library/react';
import type { Product } from '@shop/contracts/products';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBestsellers, getCategories, getProducts } from '@/api/products';
import { ProductShelf } from '@/components/home/ProductShelf';
import { HomePage, withoutProducts } from './HomePage';

vi.mock('@/api/products', () => ({
  getBestsellers: vi.fn(),
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock('@/hooks/CartContext', () => ({
  useCartContext: () => ({
    addItem: vi.fn().mockResolvedValue(true),
    isActionPending: () => false,
    isCartAvailable: true,
  }),
}));

vi.mock('@/components/WishlistButton', () => ({
  WishlistButton: () => <button type="button" aria-label="Add to wishlist" />,
}));

function product(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    description: 'Test product',
    priceCents: 1000,
    imageSetId: 'powdered-water',
    category: 'Impossible',
    stock: 5,
    slug: `product-${id}`,
    salesCount: 0,
    mixable: false,
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(getBestsellers).mockReset();
    vi.mocked(getCategories).mockReset();
    vi.mocked(getProducts).mockReset();
  });

  it('keeps powder assurances while a failed shelf leaves other content available', async () => {
    vi.mocked(getBestsellers).mockRejectedValue(new Error('Bestsellers unavailable'));
    vi.mocked(getCategories).mockResolvedValue(['Impossible']);
    vi.mocked(getProducts).mockResolvedValue({
      items: [product('new')],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Powdered to order')).toBeInTheDocument();
    expect(screen.getByText('Finely packed')).toBeInTheDocument();
    expect(screen.getByText('Simulated checkout')).toBeInTheDocument();
    expect(screen.getByText('No real payment is processed')).toBeInTheDocument();
    expect(screen.getByText('Frequently powdered')).toBeInTheDocument();
    expect(screen.getByText('Fresh from the mill')).toBeInTheDocument();
    expect(screen.getByLabelText('Powder process')).toHaveTextContent('Choose it→Powder it→Bag it');
    await waitFor(() => expect(screen.getByText('Product new')).toBeInTheDocument());
    expect(screen.getByText('This collection is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse the catalog/i })).toHaveAttribute(
      'href',
      '/catalog?sort=bestselling',
    );
  });

  it('removes products already shown in an earlier shelf', () => {
    expect(withoutProducts([product('1'), product('2')], new Set(['1']))).toEqual([product('2')]);
  });
});

describe('ProductShelf', () => {
  it('shows a collection loading state and a route-specific recovery action', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProductShelf
          eyebrow="Test"
          title="Test shelf"
          href="/catalog?sort=bestselling"
          products={[]}
          isLoading
          onRetry={vi.fn()}
          isCartAvailable
          isAdding={() => false}
          onAddToCart={vi.fn().mockResolvedValue(true)}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Loading collection')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ProductShelf
          eyebrow="Test"
          title="Test shelf"
          href="/catalog?sort=bestselling"
          products={[]}
          isLoading={false}
          error="Unavailable"
          onRetry={vi.fn()}
          isCartAvailable
          isAdding={() => false}
          onAddToCart={vi.fn().mockResolvedValue(true)}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByRole('link', { name: /browse the catalog/i })).toHaveAttribute(
      'href',
      '/catalog?sort=bestselling',
    );
  });
});
