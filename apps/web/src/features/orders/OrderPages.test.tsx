import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailResponse, OrderListResponse } from '@shop/contracts/orders';
import { ApiError } from '@/api/client';
import { cancelOrder, getOrder, getOrders } from '@/api/orders';
import { fetchReturnOverview } from '@/api/returns';
import { OrderDetailPage } from './OrderDetailPage';
import { OrderHistoryPage } from './OrderHistoryPage';
import { OrderConfirmationPage } from '@/features/checkout/OrderConfirmationPage';

vi.mock('@/api/orders', () => ({ getOrders: vi.fn(), getOrder: vi.fn(), cancelOrder: vi.fn() }));
vi.mock('@/api/returns', () => ({ fetchReturnOverview: vi.fn(), createReturnRequest: vi.fn() }));

const detail: OrderDetailResponse = {
  id: '12',
  status: 'packed',
  version: 2,
  subtotalCents: 2200,
  discountCents: 0,
  totalCents: 2200,
  promoApplied: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  canCancel: true,
  items: [
    {
      lineId: '31',
      productId: 'oat',
      productName: 'Oat powder',
      unitPriceCents: 1000,
      quantity: 1,
      discountableTotalCents: 1000,
      blendingFeeCents: 0,
      lineTotalCents: 1000,
      inventoryStatus: 'partially_backordered',
      allocatedQuantity: 1,
      backorderedQuantity: 0,
    },
    {
      lineId: '32',
      productId: 'pea',
      productName: 'Pea powder',
      unitPriceCents: 1200,
      quantity: 1,
      discountableTotalCents: 1200,
      blendingFeeCents: 0,
      lineTotalCents: 1200,
      inventoryStatus: 'allocated',
      allocatedQuantity: 1,
      backorderedQuantity: 0,
    },
  ],
  shipments: [
    {
      id: '71',
      shipmentNumber: 1,
      status: 'shipped',
      trackingReference: 'SIM-ONE',
      version: 1,
      lines: [{ lineId: '31', quantity: 1 }],
      createdAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T02:00:00.000Z',
    },
    {
      id: '72',
      shipmentNumber: 2,
      status: 'delivery_failed',
      trackingReference: 'SIM-TWO',
      version: 2,
      lines: [{ lineId: '32', quantity: 1 }],
      createdAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T03:00:00.000Z',
    },
  ],
  events: [
    {
      id: '91',
      shipmentId: null,
      type: 'order_created',
      code: null,
      title: 'Order created',
      detail: null,
      location: null,
      occurredAt: '2026-07-14T00:00:00.000Z',
    },
  ],
};

const list: OrderListResponse = {
  items: [
    {
      id: '12',
      status: 'packed',
      version: 2,
      totalCents: 2200,
      totalItems: 2,
      hasBackorder: false,
      createdAt: detail.createdAt,
    },
  ],
  page: 1,
  pageSize: 10,
};

function ConfirmationRoutes() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/order-confirmation/13')}>Open order 13</button>
      <Routes>
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
      </Routes>
    </>
  );
}

describe('customer order UI', () => {
  beforeEach(() => {
    vi.mocked(getOrders).mockReset();
    vi.mocked(getOrder).mockReset();
    vi.mocked(cancelOrder).mockReset();
    vi.mocked(fetchReturnOverview).mockReset();
    vi.mocked(fetchReturnOverview).mockResolvedValue({
      windowDays: 30,
      eligibleLines: [],
      requests: [],
    });
  });

  it('renders list results and advances the URL-owned page', async () => {
    const fullPage = {
      ...list,
      items: Array.from({ length: 10 }, (_, index) => ({
        ...list.items[0]!,
        id: String(index + 12),
      })),
    };
    vi.mocked(getOrders)
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce({ ...list, items: [], page: 2 });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/orders" element={<OrderHistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Order #12' })).toHaveAttribute(
      'href',
      '/orders/12',
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getOrders).toHaveBeenLastCalledWith(2, 10));
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });

  it('shows list errors with retry', async () => {
    vi.mocked(getOrders)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(list);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderHistoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('link', { name: 'Order #12' })).toBeInTheDocument();
  });

  it('renders split shipments and requires a second cancellation confirmation', async () => {
    vi.mocked(getOrder).mockResolvedValue(detail);
    vi.mocked(cancelOrder).mockResolvedValue({
      ...detail,
      status: 'cancelled',
      version: 3,
      canCancel: false,
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('SIM-ONE')).toBeInTheDocument();
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByRole('dialog', { name: 'Cancel order #12?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledOnce());
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Order #12 was cancelled. Simulated fulfilment has stopped; unshipped allocated stock was released and no refund was issued.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps blend composition, the fee split, and the made-to-order terms on the order record', async () => {
    const configKey = 'c'.repeat(64);
    vi.mocked(getOrder).mockResolvedValue({
      ...detail,
      items: [
        {
          ...detail.items[0]!,
          discountableTotalCents: 1000,
          blendingFeeCents: 2500,
          lineTotalCents: 3500,
          customBlend: {
            configKey,
            basePercentage: 75,
            mixingGroup: 'mineral',
            ingredients: [
              {
                variantId: 601,
                productId: '11',
                productName: 'Chalk Filler',
                productDescription: 'Filler',
                mixingGroup: 'mineral',
                percentage: 25,
              },
            ],
            blendingFeeCents: 2500,
            madeToOrder: true,
            returnable: false,
          },
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Custom blend: Oat powder — 25% Chalk Filler/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Base material: \$10.00 · Blending fee: \$25.00/)).toBeInTheDocument();
    expect(
      screen.getByText(/Made to order\. Custom blends cannot be returned/),
    ).toBeInTheDocument();
  });

  it('shows order allocation state without an estimated delivery date', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      ...detail,
      items: [
        {
          ...detail.items[0]!,
          inventoryStatus: 'partially_backordered',
          allocatedQuantity: 1,
          backorderedQuantity: 2,
          quantity: 3,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('1 allocated; 2 awaiting stock')).toBeInTheDocument();
    expect(screen.queryByText(/estimated|days/i)).not.toBeInTheDocument();
  });

  it('refreshes rather than claiming cancellation when server reports stale state', async () => {
    vi.mocked(getOrder)
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ ...detail, status: 'shipped', canCancel: false, version: 3 });
    vi.mocked(cancelOrder).mockRejectedValue(new ApiError('Stale version', 409));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Cancel order' });
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('latest status has been refreshed');
    expect(screen.getByLabelText('Order status: Shipped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('keeps keyboard focus in cancellation confirmation and restores it after Escape', async () => {
    vi.mocked(getOrder).mockResolvedValue(detail);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const trigger = await screen.findByRole('button', { name: 'Cancel order' });
    await user.click(trigger);
    const confirm = screen.getByRole('button', { name: 'Confirm cancellation' });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Keep order' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps guest confirmation failures safe and ignores stale detail responses', async () => {
    let resolveFirst!: (value: OrderDetailResponse) => void;
    vi.mocked(getOrder)
      .mockImplementationOnce(
        () =>
          new Promise<OrderDetailResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...detail, id: '13' });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/order-confirmation/12']}>
        <ConfirmationRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getOrder).toHaveBeenCalledWith('12'));
    await user.click(screen.getByRole('button', { name: 'Open order 13' }));
    expect(await screen.findByText('Order #13')).toBeInTheDocument();
    await act(async () => {
      resolveFirst(detail);
      await Promise.resolve();
    });
    expect(screen.queryByText('Order #12')).not.toBeInTheDocument();
  });

  it('shows foreign or expired guest confirmation as safe not-found', async () => {
    vi.mocked(getOrder).mockRejectedValue(new ApiError('Order', 404));
    render(
      <MemoryRouter initialEntries={['/order-confirmation/12']}>
        <Routes>
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Order not found.')).toBeInTheDocument();
  });

  it('renders ReturnPanel below order detail on delivered orders', async () => {
    const deliveredDetail: OrderDetailResponse = {
      ...detail,
      status: 'delivered',
      canCancel: false,
      shipments: [
        {
          ...detail.shipments[0]!,
          status: 'delivered',
        },
      ],
    };
    vi.mocked(getOrder).mockResolvedValue(deliveredDetail);
    vi.mocked(fetchReturnOverview).mockResolvedValue({
      windowDays: 30,
      eligibleLines: [
        {
          shipmentId: '71',
          shipmentNumber: 1,
          orderLineItemId: '31',
          productName: 'Oat powder',
          deliveredQuantity: 3,
          reservedQuantity: 0,
          availableQuantity: 3,
          deliveredAt: '2026-07-01T12:00:00.000Z',
          windowClosesAt: '2026-07-31T12:00:00.000Z',
        },
      ],
      requests: [],
    });

    render(
      <MemoryRouter initialEntries={['/orders/12']}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Core order content renders
    expect(await screen.findByText('Order #12')).toBeInTheDocument();
    // Return panel renders
    expect(await screen.findByText('Return items')).toBeInTheDocument();
    expect(await screen.findByText('(3 of 3 available)')).toBeInTheDocument();
    // Oat powder appears in both order detail and return panel
    expect(screen.getAllByText('Oat powder')).toHaveLength(2);
  });
});
