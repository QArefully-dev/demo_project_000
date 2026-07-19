import { render, screen } from '@testing-library/react';
import type { Cart } from '@shop/contracts/cart';
import type { OrderDetailResponse } from '@shop/contracts/orders';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getOrder } from '@/api/orders';
import { PowderMixCartLineItem } from '@/features/cart/PowderMixCartLineItem';
import { CheckoutSummary } from './CheckoutSummary';
import { OrderConfirmationPage } from './OrderConfirmationPage';

vi.mock('@/api/orders', () => ({ getOrder: vi.fn() }));

const mixItem = {
  mixId: 'ab1f5ed-3dbf-4c3c-908e-c71d7e7bf912',
  components: [
    { productId: '1', productName: 'Oat', percentage: 50, allocatedGrams: 250 },
    { productId: '2', productName: 'Pea', percentage: 50, allocatedGrams: 250 },
  ],
  bagSizeGrams: 500 as const,
  fineness: 'standard' as const,
  customLabel: 'Persisted mix',
  priceVersion: 'powderizer-v1' as const,
  unitPriceCents: 1200,
  quantity: 1,
  lineTotalCents: 1200,
  bagColourScheme: 'deep-space' as const,
  usageLabel: 'Not for consumption' as const,
};

const cart: Cart = {
  id: '58f1b5ed-3dbf-4c3c-908e-c71d7e7bf912',
  items: [],
  mixItems: [mixItem],
  subtotalCents: 1200,
  totalItems: 1,
};

describe('persisted powder-mix purchase rendering', () => {
  it('shows the saved scheme and server usage label in cart and checkout', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PowderMixCartLineItem item={mixItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Deep space')).toBeInTheDocument();
    expect(screen.getByText('Not for consumption')).toBeInTheDocument();

    rerender(
      <CheckoutSummary
        cart={cart}
        promoCode=""
        appliedPromo={null}
        discountCents={0}
        totalCents={1200}
        promoError={null}
        promoValidating={false}
        isPromoEligible={false}
        onPromoChange={vi.fn()}
        onApplyPromo={vi.fn()}
        onRemovePromo={vi.fn()}
      />,
    );
    expect(screen.getByText('Deep space · Not for consumption')).toBeInTheDocument();
  });

  it('shows persisted mix identity on the order confirmation', async () => {
    const order: OrderDetailResponse = {
      id: '12',
      status: 'processing',
      version: 0,
      items: [],
      mixItems: [{ ...mixItem, lineId: '44', snapshotVersion: 2 }],
      subtotalCents: 1200,
      discountCents: 0,
      totalCents: 1200,
      promoApplied: null,
      createdAt: '2026-07-14T00:00:00.000Z',
      shipments: [],
      events: [],
      canCancel: false,
    };
    vi.mocked(getOrder).mockResolvedValue(order);
    render(
      <MemoryRouter initialEntries={['/order-confirmation/12']}>
        <Routes>
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Deep space · Not for consumption')).toBeInTheDocument();
  });
});
