import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { ProductPage } from './ProductPage';

const productApi = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getSimilarProducts: vi.fn(),
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
  createdAt: overrides.createdAt ?? '2026-07-14T00:00:00.000Z',
  available: overrides.available ?? true,
  tags: overrides.tags ?? [],
  specificationGroups: overrides.specificationGroups ?? [],
  mixable: overrides.mixable ?? false,
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

function RouteControls() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/products/second')}>
      Load second product
    </button>
  );
}

describe('ProductPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cart.addItem.mockReset();
    cart.retryCart.mockReset();
    cart.isActionPending.mockReset();
    cart.isActionPending.mockReturnValue(false);
    cart.error = null;
    cart.isCartAvailable = true;
  });

  it('renders core product content while the similar request remains pending', async () => {
    const response = deferred<Product>();
    const similarResponse = deferred<Product[]>();
    productApi.getProduct.mockReturnValueOnce(response.promise);
    productApi.getSimilarProducts.mockReturnValueOnce(similarResponse.promise);

    renderPage();
    expect(screen.queryByRole('heading', { name: 'Powdered Water' })).not.toBeInTheDocument();

    response.resolve(product());
    expect(await screen.findByRole('heading', { name: 'Powdered Water' })).toBeInTheDocument();
    expect(screen.getByText('Finding similar powders...')).toBeInTheDocument();
  });

  it('renders API and not-found failures distinctly', async () => {
    productApi.getProduct.mockRejectedValueOnce(new Error('Product service unavailable'));
    const { unmount } = renderPage();
    expect(await screen.findByText('Product service unavailable')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockRejectedValueOnce(new ApiError('Missing', 404));
    renderPage();
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });

  it('renders sale, regular, and stock purchase states from the product response', async () => {
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('Save $40.00')).toBeInTheDocument();
    unmount();

    productApi.getProduct.mockResolvedValueOnce(
      product({ compareAtPriceCents: undefined, stock: 0 }),
    );
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
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
    productApi.getSimilarProducts.mockResolvedValueOnce([]);

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

  it('keeps the purchase panel usable when similar products fail', async () => {
    const user = userEvent.setup();
    cart.addItem.mockResolvedValue(true);
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockRejectedValueOnce(new Error('Similarity unavailable'));

    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load similar powders.');
    await user.click(screen.getByRole('button', { name: 'Add powder' }));
    expect(cart.addItem).toHaveBeenCalledWith('powdered-water');
  });

  it('aborts and ignores a stale similar response after the route product changes', async () => {
    const user = userEvent.setup();
    const firstSimilar = deferred<Product[]>();
    const secondSimilar = deferred<Product[]>();
    productApi.getProduct
      .mockResolvedValueOnce(product({ id: 'first', name: 'First powder' }))
      .mockResolvedValueOnce(product({ id: 'second', name: 'Second powder' }));
    productApi.getSimilarProducts
      .mockReturnValueOnce(firstSimilar.promise)
      .mockReturnValueOnce(secondSimilar.promise);

    render(
      <MemoryRouter initialEntries={['/products/first']}>
        <RouteControls />
        <Routes>
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'First powder' })).toBeInTheDocument();
    const firstSignal = productApi.getSimilarProducts.mock.calls[0]?.[1] as AbortSignal;
    await user.click(screen.getByRole('button', { name: 'Load second product' }));
    expect(await screen.findByRole('heading', { name: 'Second powder' })).toBeInTheDocument();
    expect(firstSignal.aborted).toBe(true);

    firstSimilar.resolve([product({ id: 'stale', name: 'Stale powder' })]);
    secondSimilar.resolve([product({ id: 'fresh', name: 'Fresh powder' })]);
    expect(
      await screen.findByRole('heading', { name: 'Fresh powder', level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Stale powder', level: 3 }),
    ).not.toBeInTheDocument();
  });

  it('omits an empty similar shelf and keeps ranked API order in cards', async () => {
    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    await screen.findByRole('heading', { name: 'Powdered Water' });
    await waitFor(() => expect(screen.queryByLabelText('Similar powders')).not.toBeInTheDocument());
    unmount();

    productApi.getProduct.mockResolvedValueOnce(product());
    productApi.getSimilarProducts.mockResolvedValueOnce([
      product({ id: 'ranked-second', name: 'Ranked second' }),
      product({ id: 'ranked-first', name: 'Ranked first' }),
    ]);
    renderPage();
    const cards = await screen.findAllByRole('heading', { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual(['Ranked second', 'Ranked first']);
  });
});
