import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Product } from '@shop/contracts/products';
import type { PublicUser } from '@shop/contracts/auth';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPurchasePanel } from './ProductPurchasePanel';

const authState = vi.hoisted(() => ({ user: null as PublicUser | null }));
const favouriteState = vi.hoisted(() => ({
  favouriteIds: new Set<string>(),
  toggleFavourite: vi.fn(),
}));

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('@/hooks/useFavourites', () => ({
  useFavourites: () => ({
    ...favouriteState,
    favourites: [],
    loading: false,
    removeProduct: vi.fn(),
  }),
}));

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
  compareAtPriceCents: 16999,
  imageSetId: 'powdered-water',
  packaging: {
    labelColor: '#287fa6',
    powderColor: '#b9e2ee',
    mark: 'H2O',
    batchCode: 'IMP-07',
    quantity: '300g',
    consumptionLabel: 'Not for consumption',
  },
  category: 'Impossible',
  stock: 8,
  slug: 'powdered-water',
  salesCount: 12,
  ...overrides,
});

function renderPanel(overrides: Partial<ComponentProps<typeof ProductPurchasePanel>> = {}) {
  const onAddToCart = vi.fn(async () => {});
  const onRetryCart = vi.fn();
  const result = render(
    <MemoryRouter initialEntries={['/products/powdered-water']}>
      <Routes>
        <Route
          path="*"
          element={
            <ProductPurchasePanel
              product={product()}
              isCartAvailable
              isAdding={false}
              actionError={null}
              cartError={null}
              onAddToCart={onAddToCart}
              onRetryCart={onRetryCart}
              {...overrides}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...result, onAddToCart, onRetryCart };
}

function Location() {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

describe('ProductPurchasePanel', () => {
  it('renders sale savings and regular price without sale metadata', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProductPurchasePanel
          product={product()}
          isCartAvailable
          isAdding={false}
          actionError={null}
          cartError={null}
          onAddToCart={async () => {}}
          onRetryCart={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('Save $40.00')).toBeInTheDocument();
    expect(screen.getByText('Not for consumption')).toBeInTheDocument();
    expect(screen.getByText('300g')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProductPurchasePanel
          product={product({ compareAtPriceCents: undefined })}
          isCartAvailable
          isAdding={false}
          actionError={null}
          cartError={null}
          onAddToCart={async () => {}}
          onRetryCart={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Sale')).not.toBeInTheDocument();
    expect(screen.queryByText(/Save \$/)).not.toBeInTheDocument();
  });

  it('disables unavailable purchases and exposes pending and cart retry states', async () => {
    const user = userEvent.setup();
    const { onAddToCart, onRetryCart } = renderPanel({
      product: product({ stock: 0 }),
      cartError: 'Unable to reach cart',
    });

    const addButton = screen.getByRole('button', { name: 'Unavailable' });
    expect(addButton).toBeDisabled();
    await user.click(addButton);
    expect(onAddToCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry cart' }));
    expect(onRetryCart).toHaveBeenCalledOnce();

    render(
      <MemoryRouter>
        <ProductPurchasePanel
          product={product()}
          isCartAvailable
          isAdding
          actionError={null}
          cartError={null}
          onAddToCart={async () => {}}
          onRetryCart={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('sends anonymous wishlist actions to sign-in and toggles authenticated favourites', async () => {
    const user = userEvent.setup();
    authState.user = null;
    favouriteState.favouriteIds = new Set();
    favouriteState.toggleFavourite.mockReset();
    render(
      <MemoryRouter initialEntries={['/products/powdered-water']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <ProductPurchasePanel
                  product={product()}
                  isCartAvailable
                  isAdding={false}
                  actionError={null}
                  cartError={null}
                  onAddToCart={async () => {}}
                  onRetryCart={() => {}}
                />
                <Location />
              </>
            }
          />
          <Route path="/login" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    expect(screen.getByText('/login')).toBeInTheDocument();
    expect(favouriteState.toggleFavourite).not.toHaveBeenCalled();

    authState.user = {
      id: 'user-1',
      email: 'shopper@example.test',
      displayName: 'Shopper',
      role: 'customer',
    };
    favouriteState.favouriteIds = new Set();
    favouriteState.toggleFavourite.mockReset();
    const authenticated = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    expect(favouriteState.toggleFavourite).toHaveBeenCalledWith(
      'powdered-water',
      expect.objectContaining({ id: 'powdered-water' }),
    );
    authenticated.unmount();
  });
});
