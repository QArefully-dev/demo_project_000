import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cart } from '@shop/contracts/cart';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliverySlotOptionsResponse } from '@shop/contracts/delivery';
import type { BillingEntity, DeliverySite } from '@shop/contracts/trade-account';
import { ApiError } from '@/api/client';
import { pay } from '@/api/payments';
import { validatePromo } from '@/api/promo';
import { getDeliverySlotOptions } from '@/api/deliverySlots';
import { listBillingEntities, listDeliverySites } from '@/api/tradeAccount';
import { useAuth } from '@/hooks/AuthContext';
import type { useCart } from '@/hooks/useCart';
import { CheckoutPage } from './CheckoutPage';

vi.mock('@/api/payments', () => ({ pay: vi.fn() }));
vi.mock('@/api/promo', () => ({ validatePromo: vi.fn() }));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));
vi.mock('@/hooks/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/deliverySlots', () => ({ getDeliverySlotOptions: vi.fn() }));
vi.mock('@/api/tradeAccount', () => ({
  listDeliverySites: vi.fn(),
  createDeliverySite: vi.fn(),
  updateDeliverySite: vi.fn(),
  retireDeliverySite: vi.fn(),
  listBillingEntities: vi.fn(),
  createBillingEntity: vi.fn(),
  updateBillingEntity: vi.fn(),
  retireBillingEntity: vi.fn(),
}));

const slotOptions: DeliverySlotOptionsResponse = {
  delivery: {
    mode: 'freight',
    chargeCents: 999,
    weightGrams: 25000,
    reason: 'A freight-class item requires freight delivery',
  },
  leadTime: {
    earliestDate: '2026-08-03',
    latestDate: '2026-08-21',
    businessDays: 3,
    reason: 'Freight consignments need 3 business days before the earliest delivery date.',
  },
  slots: [
    { date: '2026-08-03', window: 'am' },
    { date: '2026-08-03', window: 'pm' },
    { date: '2026-08-04', window: 'am' },
  ],
};

const savedSite: DeliverySite = {
  id: '7',
  label: 'Northgate Yard',
  contactName: 'Site Manager',
  address: {
    line1: '12 Northgate Way',
    city: 'Leeds',
    postcode: 'LS1 4AB',
    countryCode: 'GB',
  },
  isDefault: true,
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const savedBillingEntity: BillingEntity = {
  id: '3',
  legalName: 'Northgate Builders Ltd',
  registrationNumber: '09876543',
  vatNumber: null,
  address: {
    line1: '1 Finance Street',
    city: 'Leeds',
    postcode: 'LS1 9ZZ',
    countryCode: 'GB',
  },
  isDefault: true,
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const signedInUser = {
  id: '1',
  email: 'buyer@example.test',
  displayName: 'Trade Buyer',
  role: 'customer' as const,
};

function mockAnonymous() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  });
}

function mockSignedIn() {
  vi.mocked(useAuth).mockReturnValue({
    user: signedInUser,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(listDeliverySites).mockResolvedValue([savedSite]);
  vi.mocked(listBillingEntities).mockResolvedValue([savedBillingEntity]);
}

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
        availability: 'in_stock',
        backorderable: false,
        backorderLeadDays: null,
        slug: 'powdered-water',
        salesCount: 0,
        createdAt: '2026-07-14T00:00:00.000Z',
        available: true,
        tags: [],
        specificationGroups: [],
      },
      variantSnap: {
        variantId: 1,
        sku: 'H2O-001',
        label: '25kg sack',
        weightGrams: 25000,
        deliveryClass: 'freight',
      },
      perTonneCents: 40000,
      resolvedUnitPriceCents: 1000,
      quantity: 1,
      configKey: '',
      materialSubtotalCents: 1000,
      blendingFeeCents: 0,
      discountableTotalCents: 1000,
      lineTotalCents: 1000,
    },
  ],
  subtotalCents: 1000,
  discountableSubtotalCents: 1000,
  blendingFeeTotalCents: 0,
  totalItems: 1,
  deliveryPreview: {
    mode: 'freight',
    chargeCents: 999,
    weightGrams: 25000,
    reason: 'A freight-class item requires freight delivery',
  },
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
  addBundle: vi.fn().mockResolvedValue(true),
  addCustomBlend: vi.fn().mockResolvedValue(true),
  replaceCustomBlend: vi.fn().mockResolvedValue(true),
  quickOrder: vi.fn().mockResolvedValue(false),
  updateQuantity: vi.fn().mockResolvedValue(true),
  removeItem: vi.fn().mockResolvedValue(true),
  reorder: vi.fn().mockResolvedValue(false),
  addSavedListToCart: vi.fn().mockResolvedValue(false),
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

async function completeDeliveryStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Checkout Test');
  await user.type(screen.getByLabelText('Email'), 'checkout@example.test');
  await user.type(screen.getByLabelText('Address line 1'), '1 Test Street');
  await user.type(screen.getByLabelText('City'), 'Testville');
  await user.type(screen.getByLabelText('Postcode'), 'TE1 1ST');
  await user.click(screen.getByRole('button', { name: 'Continue to schedule' }));
  await screen.findByRole('heading', { name: 'Schedule and billing' });
}

async function completeScheduleStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText(/August 3, 2026 · Morning/));
  await user.type(screen.getByLabelText('Legal entity name'), 'Test Trading Ltd');
  await user.type(screen.getByLabelText('Address line 1'), '2 Billing Road');
  await user.type(screen.getByLabelText('City'), 'Testville');
  await user.type(screen.getByLabelText('Postcode'), 'TE1 1ST');
  await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
  await screen.findByRole('heading', { name: 'Test card details' });
}

async function continueToPayment(user: ReturnType<typeof userEvent.setup>) {
  await completeDeliveryStep(user);
  await completeScheduleStep(user);
}

async function completeCard(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Card number'), '4242 4242 4242 4242');
  await user.type(screen.getByLabelText('Expiry (MM/YY)'), '12/99');
  await user.type(screen.getByLabelText('CVC'), '123');
}

// These journeys drive the full multi-step checkout through `userEvent`, which types on real
// timers; the slowest cases take ~3.7s in isolation and exceed the 5s vitest default when the
// full suite runs workers in parallel. The timeout is raised for the whole suite because several
// cases sit in the same band, not just the two that flaked.
describe('CheckoutPage', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    const { useCartContext } = await import('@/hooks/CartContext');
    vi.mocked(useCartContext).mockReturnValue(cartContext);
    vi.mocked(pay).mockReset();
    vi.mocked(validatePromo).mockReset();
    vi.mocked(getDeliverySlotOptions).mockReset();
    vi.mocked(listDeliverySites).mockReset();
    vi.mocked(listBillingEntities).mockReset();
    vi.mocked(getDeliverySlotOptions).mockResolvedValue(slotOptions);
    vi.mocked(listDeliverySites).mockResolvedValue([]);
    vi.mocked(listBillingEntities).mockResolvedValue([]);
    mockAnonymous();
    clearCart.mockClear();
  });

  it('renders server-resolved pack, tonne, and pack-weight values in the order summary', () => {
    renderCheckout();

    expect(screen.getByText(/Resolved pack price: \$10.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$400.00 \/ tonne/)).toBeInTheDocument();
    expect(screen.getByText(/25,?000g pack/)).toBeInTheDocument();
  });

  it('discloses blend composition, the fee split, and the made-to-order terms', async () => {
    const configKey = 'b'.repeat(64);
    const blendLine = {
      ...cart.items[0]!,
      configKey,
      materialSubtotalCents: 1000,
      blendingFeeCents: 2500,
      discountableTotalCents: 1000,
      lineTotalCents: 3500,
      customBlend: {
        configKey,
        basePercentage: 80,
        mixingGroup: 'mineral' as const,
        ingredients: [
          {
            variantId: 601,
            productId: '11',
            productName: 'Chalk Filler',
            productDescription: 'Filler',
            mixingGroup: 'mineral' as const,
            percentage: 20,
          },
        ],
        blendingFeeCents: 2500,
        madeToOrder: true as const,
        returnable: false as const,
      },
    };
    const { useCartContext } = await import('@/hooks/CartContext');
    vi.mocked(useCartContext).mockReturnValue({
      ...cartContext,
      cart: {
        ...cart,
        items: [blendLine],
        subtotalCents: 3500,
        discountableSubtotalCents: 1000,
        blendingFeeTotalCents: 2500,
      },
    });

    renderCheckout();

    expect(screen.getByText(/80% Powdered Water — 20% Chalk Filler/)).toBeInTheDocument();
    expect(screen.getByText('Custom blend')).toBeInTheDocument();
    expect(screen.getByTestId('custom-blend-livery')).toBeInTheDocument();
    expect(screen.getByText(/Base material: \$10.00 · Blending fee: \$25.00/)).toBeInTheDocument();
    expect(screen.getByText('Blending fees')).toBeInTheDocument();
    expect(
      screen.getByText(/Made to order\. Custom blends cannot be returned/),
    ).toBeInTheDocument();
  });

  it('adds the server-provided delivery preview to the checkout total', () => {
    renderCheckout();

    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
  });

  it('displays the freight-inclusive total returned by a valid promo quote', async () => {
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
    vi.mocked(validatePromo).mockResolvedValue({
      valid: true,
      promoCode: {
        code: 'SAVE10',
        discountPercent: 10,
        minItemCount: 5,
        kind: 'percent',
      },
      discountCents: 500,
      totalCents: 5499,
    });
    const user = userEvent.setup();
    renderCheckout();

    await user.type(screen.getByLabelText('Order promotion'), 'SAVE10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('$54.99')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('renders server-provided scoped promo details without recalculating totals', async () => {
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
    vi.mocked(validatePromo).mockResolvedValue({
      valid: true,
      promoCode: {
        code: 'AGG10',
        discountPercent: 10,
        minItemCount: 1,
        kind: 'percent',
        categoryScope: 'aggregates',
      },
      discountBaseCents: 3200,
      discountCents: 320,
      totalCents: 4879,
    });
    const user = userEvent.setup();
    renderCheckout();

    await user.type(screen.getByLabelText('Order promotion'), 'AGG10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Eligible subtotal (aggregates)')).toBeInTheDocument();
    expect(screen.getByText('$32.00')).toBeInTheDocument();
    expect(screen.getByText('Discount (AGG10 · aggregates)')).toBeInTheDocument();
    expect(screen.getByText('$48.79')).toBeInTheDocument();
  });

  it('carries a clearance-priced catalog line into a scoped-promo checkout total', async () => {
    const clearanceCart = {
      ...cart,
      items: [
        {
          ...cart.items[0]!,
          product: {
            ...cart.items[0]!.product,
            name: 'Lawn Feed',
            category: 'Garden & Outdoors',
          },
          variantSnap: {
            ...cart.items[0]!.variantSnap!,
            sku: 'GDN-1043-001',
            label: '10 kg Bag',
            weightGrams: 10_000,
          },
          resolvedUnitPriceCents: 2_400,
          perTonneCents: 240_000,
          quantity: 5,
          materialSubtotalCents: 12_000,
          discountableTotalCents: 12_000,
          lineTotalCents: 12_000,
          clearance: {
            priceCents: 2_400,
            perTonneCents: 240_000,
            startsAt: '2026-07-21T12:00:00.000Z',
            endsAt: '2026-08-04T12:00:00.000Z',
          },
        },
      ],
      subtotalCents: 12_000,
      discountableSubtotalCents: 12_000,
      totalItems: 5,
    };
    const { useCartContext } = await import('@/hooks/CartContext');
    vi.mocked(useCartContext).mockReturnValue({
      ...cartContext,
      cart: clearanceCart,
      cartId: clearanceCart.id,
    });
    vi.mocked(validatePromo).mockResolvedValue({
      valid: true,
      promoCode: {
        code: 'GARDEN10',
        discountPercent: 10,
        minItemCount: 0,
        kind: 'percent',
        categoryScope: 'Garden & Outdoors',
      },
      discountBaseCents: 12_000,
      discountCents: 1_200,
      totalCents: 11_799,
    });
    const user = userEvent.setup();
    renderCheckout();

    expect(screen.getByText(/Resolved pack price: \$24.00/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Order promotion'), 'GARDEN10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Eligible subtotal (Garden & Outdoors)')).toBeInTheDocument();
    expect(screen.getAllByText('$120.00')).toHaveLength(3);
    expect(screen.getByText('Discount (GARDEN10 · Garden & Outdoors)')).toBeInTheDocument();
    expect(screen.getByText('$117.99')).toBeInTheDocument();
  });

  it('renders a category mismatch promo error', async () => {
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
    vi.mocked(validatePromo).mockResolvedValue({
      valid: false,
      error: 'Promo cannot be used',
      errorCode: 'CATEGORY_MISMATCH',
    });
    const user = userEvent.setup();
    renderCheckout();

    await user.type(screen.getByLabelText('Order promotion'), 'AGG10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      await screen.findByText('This promo does not apply to any items in your cart.'),
    ).toBeInTheDocument();
  });

  it('gates each step on the previous one and keeps browser back in checkout flow', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole('button', { name: 'Continue to schedule' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Address line 1 is required')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout');

    await completeDeliveryStep(user);
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?step=schedule');

    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(screen.getByText('Choose a delivery slot')).toBeInTheDocument();
    expect(screen.getByText('Legal entity name is required')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?step=schedule');

    await completeScheduleStep(user);
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?step=payment');

    await user.click(screen.getByRole('button', { name: 'Back to schedule' }));
    expect(screen.getByRole('heading', { name: 'Schedule and billing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to delivery' }));
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Checkout Test');
  });

  it('returns a refreshed later-step URL to delivery because checkout inputs are not persisted', async () => {
    renderCheckout('/checkout?step=payment');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/checkout'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('step=');
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Card number')).not.toBeInTheDocument();
  });

  it('redirects an unknown step value back to the first step', async () => {
    renderCheckout('/checkout?step=confirm');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/checkout'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('step=');
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
  });

  it('offers anonymous buyers the ad-hoc address form only', async () => {
    renderCheckout();

    expect(await screen.findByLabelText('Address line 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Northgate Yard')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(listDeliverySites).not.toHaveBeenCalled();
  });

  it('preselects the default saved site for a signed-in buyer and submits it as the destination', async () => {
    mockSignedIn();
    vi.mocked(pay).mockResolvedValue({
      id: '12',
      status: 'processing',
      version: 0,
      items: [],
      subtotalCents: 1000,
      discountCents: 0,
      totalCents: 1000,
      promoApplied: null,
      createdAt: '2026-07-14T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderCheckout();

    const savedSiteRadio = await screen.findByLabelText(/Northgate Yard/);
    expect(savedSiteRadio).toBeChecked();
    expect(screen.queryByLabelText('Address line 1')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), 'Checkout Test');
    await user.type(screen.getByLabelText('Email'), 'checkout@example.test');
    await user.click(screen.getByRole('button', { name: 'Continue to schedule' }));

    await screen.findByRole('heading', { name: 'Schedule and billing' });
    expect(await screen.findByLabelText(/Northgate Builders Ltd/)).toBeChecked();
    await user.click(await screen.findByLabelText(/August 3, 2026 · Morning/));
    await user.type(screen.getByLabelText(/Purchase order reference/), 'PO-4417');
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await screen.findByRole('heading', { name: 'Test card details' });
    expect(screen.getByText('Northgate Yard')).toBeInTheDocument();
    expect(screen.getByText('PO-4417')).toBeInTheDocument();
    expect(screen.getByText(/August 3, 2026 · Morning/)).toBeInTheDocument();

    await completeCard(user);
    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pay).mock.calls[0]![0]).toMatchObject({
      deliveryDestination: { kind: 'saved', deliverySiteId: '7' },
      billingSelection: { kind: 'saved', billingEntityId: '3' },
      deliverySlot: { date: '2026-08-03', window: 'am' },
      purchaseOrderReference: 'PO-4417',
    });
  });

  it('sends an ad-hoc destination and billing party when nothing is saved', async () => {
    vi.mocked(pay).mockResolvedValue({
      id: '13',
      status: 'processing',
      version: 0,
      items: [],
      subtotalCents: 1000,
      discountCents: 0,
      totalCents: 1000,
      promoApplied: null,
      createdAt: '2026-07-14T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    const body = vi.mocked(pay).mock.calls[0]![0];
    expect(body.deliveryDestination).toEqual({
      kind: 'adhoc',
      address: {
        line1: '1 Test Street',
        city: 'Testville',
        postcode: 'TE1 1ST',
        countryCode: 'GB',
      },
    });
    expect(body.billingSelection).toEqual({
      kind: 'adhoc',
      billingEntity: {
        legalName: 'Test Trading Ltd',
        address: {
          line1: '2 Billing Road',
          city: 'Testville',
          postcode: 'TE1 1ST',
          countryCode: 'GB',
        },
      },
    });
    expect(body).not.toHaveProperty('purchaseOrderReference');
    expect(body).not.toHaveProperty('shippingAddress');
  });

  it('shows the lead-time reason and recovers from a slot load failure through retry', async () => {
    vi.mocked(getDeliverySlotOptions)
      .mockRejectedValueOnce(new ApiError('Delivery slots are unavailable', 500))
      .mockResolvedValue(slotOptions);
    const user = userEvent.setup();
    renderCheckout();
    await completeDeliveryStep(user);

    expect(await screen.findByText('Delivery slots are unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText(/August 3, 2026 · Morning/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry delivery slots' }));
    expect(await screen.findByLabelText(/August 3, 2026 · Morning/)).toBeInTheDocument();
    expect(screen.getByTestId('lead-time-reason')).toHaveTextContent(
      'Freight consignments need 3 business days',
    );
  });

  it('renders a recoverable alert for an unbookable slot and rotates the key', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockRejectedValue(
      new ApiError('Delivery slot unavailable', 409, {
        error: 'DELIVERY_SLOT_UNAVAILABLE',
        earliestDate: '2026-08-06',
      } as never),
    );
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    expect(
      await screen.findByText('The delivery slot you chose is no longer bookable.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/earliest delivery date is now 2026-08-06/)).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
    const firstKey = vi.mocked(pay).mock.calls[0]![0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: 'Choose another slot' }));
    await screen.findByRole('heading', { name: 'Schedule and billing' });
    await user.click(await screen.findByLabelText(/August 3, 2026 · Afternoon/));
    expect(
      screen.queryByText('The delivery slot you chose is no longer bookable.'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    await completeCard(user);
    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(vi.mocked(pay).mock.calls[1]![0].idempotencyKey).not.toBe(firstKey);
    expect(vi.mocked(pay).mock.calls[1]![0].deliverySlot).toEqual({
      date: '2026-08-03',
      window: 'pm',
    });
  });

  it('regenerates the idempotency key when a trade checkout field changes', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockRejectedValue(new ApiError('Payment failed', 402));
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    const firstKey = vi.mocked(pay).mock.calls[0]![0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: 'Back to schedule' }));
    await user.type(screen.getByLabelText(/Purchase order reference/), 'PO-9');
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));
    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(vi.mocked(pay).mock.calls[1]![0].idempotencyKey).not.toBe(firstKey);
    expect(vi.mocked(pay).mock.calls[1]![0].purchaseOrderReference).toBe('PO-9');
  });

  it('labels every new checkout control and reaches the slot picker by keyboard', async () => {
    mockSignedIn();
    const user = userEvent.setup();
    renderCheckout();
    await screen.findByLabelText(/Northgate Yard/);

    await user.type(screen.getByLabelText('Full name'), 'Checkout Test');
    await user.type(screen.getByLabelText('Email'), 'checkout@example.test');
    await user.click(screen.getByRole('button', { name: 'Continue to schedule' }));
    await screen.findByRole('heading', { name: 'Schedule and billing' });

    const firstSlot = await screen.findByLabelText(/August 3, 2026 · Morning/);
    firstSlot.focus();
    await user.keyboard('{ }');
    expect(firstSlot).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByLabelText(/August 3, 2026 · Afternoon/)).toBeChecked();

    expect(screen.getByLabelText(/Purchase order reference/)).toHaveAccessibleName();
    expect(screen.getByRole('group', { name: 'Delivery slot' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Billing details' })).toBeInTheDocument();
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

  it('rotates a terminal stock-conflict key and preserves the cart until refresh', async () => {
    const user = userEvent.setup();
    vi.mocked(pay)
      .mockRejectedValueOnce(
        new ApiError('Insufficient stock', 409, {
          error: 'INSUFFICIENT_STOCK',
          productIds: ['1'],
        } as never),
      )
      .mockRejectedValueOnce(new ApiError('Payment failed', 402));
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await screen.findByRole('alert');
    const firstKey = vi.mocked(pay).mock.calls[0]![0].idempotencyKey;
    expect(
      screen.getByText(
        'Your cart has not been changed. Refresh it, then review quantities before retrying.',
      ),
    ).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(vi.mocked(pay).mock.calls[1]![0].idempotencyKey).not.toBe(firstKey);
  });

  it('rotates an expired reservation key and provides a cart refresh action', async () => {
    const user = userEvent.setup();
    vi.mocked(pay).mockRejectedValue(
      new ApiError('Reservation expired', 409, {
        error: 'RESERVATION_EXPIRED',
        reservationExpiresAt: '2026-07-19T12:00:00.000Z',
      } as never),
    );
    renderCheckout();
    await continueToPayment(user);
    await completeCard(user);

    await user.click(screen.getByRole('button', { name: 'Simulate payment' }));
    expect(
      await screen.findByText('Your checkout reservation expired before payment could complete.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh cart' }));
    expect(cartContext.retryCart).toHaveBeenCalledOnce();
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
    const promoInput = screen.getByLabelText('Order promotion');

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
      status: 'processing',
      version: 0,
      items: [],
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
});
