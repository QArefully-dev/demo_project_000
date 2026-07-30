import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminOrdersPage } from './AdminOrdersPage';

const api = vi.hoisted(() => ({
  getAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  createAdminRefund: vi.fn(),
}));
vi.mock('@/api/adminOrders', () => ({
  getAdminOrders: api.getAdminOrders,
  getAdminOrder: api.getAdminOrder,
}));
vi.mock('@/api/adminRefunds', () => ({ createAdminRefund: api.createAdminRefund }));

const detail = {
  id: '1',
  status: 'processing' as const,
  version: 0,
  items: [],
  subtotalCents: 1000,
  discountCents: 0,
  totalCents: 1000,
  promoApplied: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  shipments: [],
  events: [],
  canCancel: true,
  refundPayment: { paymentId: '9', remainingRefundableCents: 500 },
};
const orders = [
  {
    id: '1',
    status: 'processing',
    version: 0,
    totalCents: 1000,
    totalItems: 0,
    hasBackorder: false,
    createdAt: '2026-07-14T00:00:00.000Z',
    promoCode: null,
    buyer: { id: '2', email: 'buyer@example.test', name: 'Buyer' },
  },
  {
    id: '2',
    status: 'processing',
    version: 0,
    totalCents: 1000,
    totalItems: 0,
    hasBackorder: false,
    createdAt: '2026-07-14T00:00:00.000Z',
    promoCode: null,
    buyer: { id: '3', email: 'other@example.test', name: 'Other' },
  },
];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
function list(items = [orders[0]]) {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

describe('AdminOrdersPage', () => {
  afterEach(() => vi.resetAllMocks());

  it('submits one refund operation while a prior submit is in flight', async () => {
    const refund = deferred<void>();
    api.getAdminOrders.mockResolvedValue(list());
    api.getAdminOrder.mockResolvedValue(detail);
    api.createAdminRefund.mockReturnValue(refund.promise);
    const events = userEvent.setup();
    render(<AdminOrdersPage />);
    await events.click(await screen.findByRole('button', { name: 'View detail' }));
    await screen.findByRole('heading', { name: 'Create refund' });
    await events.type(screen.getByRole('spinbutton'), '5');
    await events.type(screen.getByLabelText('Reason'), 'Duplicate');
    const submit = screen.getByRole('button', { name: 'Create refund' });
    await events.click(submit);
    await events.click(submit);
    expect(api.createAdminRefund).toHaveBeenCalledTimes(1);
    expect(api.createAdminRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentId: '9' }));
    await act(async () => {
      refund.resolve();
      await refund.promise;
    });
  });

  it('blocks a refund that exceeds the prior-refund remaining balance', async () => {
    api.getAdminOrders.mockResolvedValue(list());
    api.getAdminOrder.mockResolvedValue(detail);
    const events = userEvent.setup();
    render(<AdminOrdersPage />);
    await events.click(await screen.findByRole('button', { name: 'View detail' }));
    await screen.findByRole('heading', { name: 'Create refund' });
    await events.type(screen.getByRole('spinbutton'), '5.01');
    await events.type(screen.getByLabelText('Reason'), 'Over remaining balance');
    await events.click(screen.getByRole('button', { name: 'Create refund' }));
    expect(api.createAdminRefund).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Refund amount exceeds the remaining refundable balance of £5.00.',
    );
  });

  it('keeps the latest order detail when requests resolve out of order', async () => {
    const first = deferred<typeof detail>();
    const second = deferred<typeof detail>();
    api.getAdminOrders.mockResolvedValue(list(orders));
    api.getAdminOrder.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const events = userEvent.setup();
    render(<AdminOrdersPage />);
    const buttons = await screen.findAllByRole('button', { name: 'View detail' });
    const [firstButton, secondButton] = buttons;
    if (!firstButton || !secondButton) throw new Error('Expected two order detail buttons');
    await events.click(firstButton);
    await events.click(secondButton);
    second.resolve({ ...detail, id: '2' });
    expect(await screen.findByRole('heading', { name: 'Order #2' })).toBeInTheDocument();
    first.resolve(detail);
    expect(screen.getByRole('heading', { name: 'Order #2' })).toBeInTheDocument();
  });
});
