import { render, screen } from '@testing-library/react';
import type { Cart } from '@shop/contracts/cart';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCartContext } from '@/hooks/CartContext';
import type { useCart } from '@/hooks/useCart';
import { CartPage } from './CartPage';

vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const cart: Cart = {
  id: '58f1b5ed-3dbf-4c3c-908e-c71d7e7bf912',
  items: [
    {
      productId: '1',
      product: {
        id: '1',
        name: 'Pallet material',
        description: 'Test material.',
        priceCents: 1000,
        imageSetId: 'test-material',
        category: 'Trade',
        stock: 10,
        availability: 'in_stock',
        backorderable: false,
        backorderLeadDays: null,
        mixable: false,
        slug: 'test-material',
        salesCount: 0,
        createdAt: '2026-07-14T00:00:00.000Z',
        available: true,
        tags: [],
        specificationGroups: [],
      },
      variantSnap: {
        variantId: 1,
        sku: 'MAT-001',
        label: '25kg sack',
        weightGrams: 25000,
        deliveryClass: 'freight',
      },
      perTonneCents: 40000,
      resolvedUnitPriceCents: 1000,
      quantity: 1,
      lineTotalCents: 1000,
    },
  ],
  mixItems: [],
  subtotalCents: 1000,
  totalItems: 1,
  deliveryPreview: {
    mode: 'freight',
    chargeCents: 999,
    weightGrams: 100000,
    reason: 'Freight threshold reached',
  },
};

function renderCart(error: string | null = null) {
  vi.mocked(useCartContext).mockReturnValue({
    cart,
    isLoading: false,
    isInitializing: false,
    error,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    updateMixQuantity: vi.fn(),
    removeMix: vi.fn(),
    retryCart: vi.fn(),
    isActionPending: vi.fn(),
  } as unknown as ReturnType<typeof useCart>);
  return render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>,
  );
}

describe('CartPage', () => {
  it('frames session-held lines, resolved totals, and server delivery weight as an order', () => {
    renderCart();

    expect(screen.getByRole('heading', { name: 'Your pallet order' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Lines held in your order for this session. Adjust pallet quantities before checkout.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Resolved order subtotal (1 units)')).toBeInTheDocument();
    expect(screen.getAllByText('$10.00')).not.toHaveLength(0);
    expect(screen.getByText(/Resolved pack price: \$10.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$400.00 \/ tonne/)).toBeInTheDocument();
    expect(screen.getByText(/25,?000g pack/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pallet freight scheduled after order confirmation/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Total order weight: 100,000g/)).toBeInTheDocument();
  });

  it('shows the MOQ error returned by the cart hook', () => {
    renderCart('Minimum order quantity not met. Adjust pallet quantity and try again.');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum order quantity not met. Adjust pallet quantity and try again.',
    );
  });
});
