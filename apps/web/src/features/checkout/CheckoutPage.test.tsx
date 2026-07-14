import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cart } from '@shop/contracts/cart';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import { validatePromo } from '@/api/promo';
import type { useCart } from '@/hooks/useCart';
import { CheckoutPage } from './CheckoutPage';

vi.mock('@/api/payments', () => ({ pay: vi.fn() }));
vi.mock('@/api/promo', () => ({ validatePromo: vi.fn() }));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const cart: Cart = {
  id: '58f1b5ed-3dbf-4c3c-908e-c71d7e7bf912',
  items: [
    {
      productId: '1',
      product: {
        id: '1',
        name: 'Powdered Water',
        description: 'Water in powder form.',
        priceCents: 1000,
        imageSetId: 'powdered-water',
        category: 'Impossible',
        stock: 4,
        mixable: false,
        slug: 'powdered-water',
        salesCount: 0,
      },
      quantity: 1,
      lineTotalCents: 1000,
    },
  ],
  mixItems: [],
  subtotalCents: 1000,
  totalItems: 1,
};

const clearCart = vi.fn();

const cartContext: ReturnType<typeof useCart> = {
  cart,
  cartId: cart.id,
  isInitializing: false,
  isLoading: false,
  error: null,
  isCartAvailable: true,
  pendingActions: {},
  isActionPending: () => false,
  addItem: vi.fn().mockResolvedValue(true),
  updateQuantity: vi.fn().mockResolvedValue(true),
  removeItem: vi.fn().mockResolvedValue(true),
  updateMixQuantity: vi.fn().mockResolvedValue(true),
  removeMix: vi.fn().mockResolvedValue(true),
  requoteMix: vi.fn().mockResolvedValue(true),
  refreshCart: vi.fn().mockResolvedValue(true),
  retryCart: vi.fn().mockResolvedValue(true),
  clearCart,
};

function Location() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCheckout(initialEntry = '/checkout') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Location />
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderId" element={<p>Order confirmation route</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function continueToPayment(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Checkout Test');
  await user.type(screen.getByLabelText('Email'), 'checkout@example.test');
  await user.type(screen.getByLabelText('Shipping address'), '1 Test Street');
  await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
  await screen.findByRole('heading', { name: 'Test card details' });
}

async function completeCard(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Card number'), '4242 4242 4242 4242');
  await user.type(screen.getByLabelText('Expiry (MM/YY)'), '12/99');
  await user.type(screen.getByLabelText('CVC'), '123');
}

describe('CheckoutPage', () => {
  beforeEach(async () => {
    const { useCartContext } = await import('@/hooks/CartContext');
    vi.mocked(useCartContext).mockReturnValue(cartContext);
    vi.mocked(pay).mockReset();
    vi.mocked(validatePromo).mockReset();
    clearCart.mockClear();
  });

  it('validates contact before entering payment and keeps browser back in checkout flow', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Address is required')).toBeInTheDocument();

    await continueToPayment(user);
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?step=payment');
    await user.click(screen.getByRole('button', { name: 'Back to contact' }));
    expect(screen.getByRole('heading', { name: 'Contact and delivery' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Checkout Test');
  });

  it('returns a refreshed payment URL to contact because checkout inputs are not persisted', async () => {
    renderCheckout('/checkout?step=payment');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/checkout'));
    expect(screen.getByRole('heading', { name: 'Contact and delivery' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Card number')).not.toBeInTheDocument();
  });

  it('keeps idempotency key across unchanged declined retries and regenerates it after card changes', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockRejectedValue(new ApiError('Payment failed', 402));
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    const firstKey = vi.mocked(pay).mock.calls[0]![0].idempotencyKey;
    expect(screen.getByRole('alert')).toHaveTextContent('Retry keeps this payment attempt safe');

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(vi.mocked(pay).mock.calls[1]![0].idempotencyKey).toBe(firstKey);

    await user.clear(screen.getByLabelText('CVC'));
    await user.type(screen.getByLabelText('CVC'), '456');
    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(3));
    expect(vi.mocked(pay).mock.calls[2]![0].idempotencyKey).not.toBe(firstKey);
  });

  it('keeps idempotency key across an unchanged network retry', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockRejectedValue(new ApiError('Unable to reach the shop server', null));
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    const firstKey = vi.mocked(pay).mock.calls[0]![0].idempotencyKey;
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the shop server');

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(vi.mocked(pay).mock.calls[1]![0].idempotencyKey).toBe(firstKey);
  });

  it('cancels visible validation for edited promo code and applies the new request', async () => {
    let resolveFirst!: (value: Awaited<ReturnType<typeof validatePromo>>) => void;
    let resolveSecond!: (value: Awaited<ReturnType<typeof validatePromo>>) => void;
    const first = new Promise<Awaited<ReturnType<typeof validatePromo>>>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<Awaited<ReturnType<typeof validatePromo>>>((resolve) => {
      resolveSecond = resolve;
    });
    const eligibleCart = {
      ...cart,
      items: [{ ...cart.items[0]!, quantity: 5, lineTotalCents: 5000 }],
      subtotalCents: 5000,
      totalItems: 5,
    };
    const { useCartContext } = await import('@/hooks/CartContext');
    vi.mocked(useCartContext).mockReturnValue({
      ...cartContext,
      cart: eligibleCart,
      cartId: eligibleCart.id,
    });
    vi.mocked(validatePromo).mockReturnValueOnce(first).mockReturnValueOnce(second);
    const user = userEvent.setup();
    renderCheckout();
    const promoInput = screen.getByLabelText('Powder promotion');

    await user.type(promoInput, 'SAVE10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();

    await user.clear(promoInput);
    await user.type(promoInput, 'SAVE20');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(validatePromo).toHaveBeenNthCalledWith(2, eligibleCart.id, 'SAVE20');

    await act(async () => {
      resolveFirst({ valid: false, error: 'Old promo invalid' });
      await first;
    });
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
    expect(screen.queryByText('Old promo invalid')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond({ valid: false, error: 'New promo invalid' });
      await second;
    });
    await screen.findByText('New promo invalid');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('clears cart state and replaces checkout with confirmation after payment success', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockResolvedValue({
      id: '12',
      items: [],
      mixItems: [],
      subtotalCents: 1000,
      discountCents: 0,
      totalCents: 1000,
      promoApplied: null,
      createdAt: '2026-07-14T00:00:00.000Z',
    });
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await screen.findByText('Order confirmation route');
    expect(clearCart).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/order-confirmation/12');
  });

  it('requires explicit acceptance and a second submit after a mix requote', async () => {
    const mixedCart: Cart = {
      ...cart,
      items: [],
      mixItems: [
        {
          mixId: 'ab1f5ed-3dbf-4c3c-908e-c71d7e7bf912',
          customLabel: 'Morning mix',
          components: [
            { productId: '1', productName: 'Oat', percentage: 50, allocatedGrams: 250 },
            { productId: '2', productName: 'Pea', percentage: 50, allocatedGrams: 250 },
          ],
          bagSizeGrams: 500,
          fineness: 'standard',
          priceVersion: 'powderizer-v1',
          unitPriceCents: 1200,
          quantity: 1,
          lineTotalCents: 1200,
        },
      ],
      subtotalCents: 1200,
      totalItems: 1,
    };
    const { useCartContext } = await import('@/hooks/CartContext');
    const requoteMix = vi.fn().mockResolvedValue(true);
    vi.mocked(useCartContext).mockReturnValue({
      ...cartContext,
      cart: mixedCart,
      cartId: mixedCart.id,
      requoteMix,
    });
    vi.mocked(pay)
      .mockRejectedValueOnce(
        new ApiError('Mix price changed', 409, {
          error: 'Mix price changed',
          code: 'MIX_REQUOTE_REQUIRED',
          mixes: [
            {
              mixId: mixedCart.mixItems[0]!.mixId,
              oldUnitPriceCents: 1200,
              newUnitPriceCents: 1400,
            },
          ],
        } as never),
      )
      .mockResolvedValueOnce({
        id: '12',
        items: [],
        mixItems: [],
        subtotalCents: 1400,
        discountCents: 0,
        totalCents: 1400,
        promoApplied: null,
        createdAt: '2026-07-14T00:00:00.000Z',
      });
    const user = userEvent.setup();
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await screen.findByText('Mix prices have changed. Review and accept updated prices before paying.');
    expect(screen.getByText('$12.00 → $14.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept updated price' }));
    await waitFor(() => expect(requoteMix).toHaveBeenCalledWith(mixedCart.mixItems[0]!.mixId));
    expect(pay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
  });
});
