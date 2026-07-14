import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { ProductPage } from './ProductPage';

const productApi = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getRelatedProducts: vi.fn(),
}));
const cart = vi.hoisted(() => ({
  addItem: vi.fn(),
  retryCart: vi.fn(),
  isActionPending: vi.fn(() => false),
  error: null as string | null,
  isCartAvailable: true,
}));

vi.mock('@/api/products', () => productApi);
vi.mock('@/hooks/CartContext', () => ({ useCartContext: () => cart }));
vi.mock('@/components/WishlistButton', () => ({
  WishlistButton: () => <button type="button">Wishlist</button>,
}));

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
  compareAtPriceCents: 16999,
  imageSetId: 'powdered-water',
  category: 'Impossible',
  stock: 8,
  slug: 'powdered-water',
  salesCount: 12,
  ...overrides,
});

function renderPage(path = '/products/powdered-water') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/products/:id" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve: resolve! };
}

describe('ProductPage', () => {
  it('waits for the product request before rendering the purchase panel', async () => {
    const response = deferred<Product>();
    productApi.getProduct.mockReturnValueOnce(response.promise);
    productApi.getRelatedProducts.mockResolvedValueOnce([]);

    renderPage();
    expect(screen.queryByRole('heading', { name: 'Powdered Water' })).not.toBeInTheDocument();

    response.resolve(product());
    expect(await screen.findByRole('heading', { name: 'Powdered Water' })).toBeInTheDocument();
  });

  it('renders API and not-found failures distinctly', async () => {
    productApi.getProduct.mockRejectedValueOnce(new Error('Product service unavailable'));
    productApi.getRelatedProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('Product service unavailable')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockRejectedValueOnce(new ApiError('Missing', 404));
    productApi.getRelatedProducts.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });

  it('renders sale, regular, and stock purchase states from the product response', async () => {
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getRelatedProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('Save $40.00')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockResolvedValueOnce(
      product({ compareAtPriceCents: undefined, stock: 0 }),
    );
    productApi.getRelatedProducts.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
    expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  });

  it('prevents concurrent cart mutations, then permits a retry after failure', async () => {
    const user = userEvent.setup();
    const pendingAdd = deferred<boolean>();
    cart.addItem.mockReset();
    cart.addItem.mockReturnValueOnce(pendingAdd.promise).mockResolvedValueOnce(true);
    cart.isActionPending.mockReturnValue(false);
    cart.error = null;
    cart.isCartAvailable = true;
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getRelatedProducts.mockResolvedValueOnce([]);

    renderPage();
    const addButton = await screen.findByRole('button', { name: 'Add powder' });
    await user.click(addButton);
    await user.click(addButton);
    expect(cart.addItem).toHaveBeenCalledOnce();

    pendingAdd.resolve(false);
    expect(await screen.findByText('Could not add this item. Try again.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add powder' }));
    await waitFor(() => expect(cart.addItem).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Could not add this item. Try again.')).not.toBeInTheDocument();
  });
});
