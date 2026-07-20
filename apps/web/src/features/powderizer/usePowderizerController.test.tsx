import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@shop/contracts/cart';
import type { PowderMixQuote, PowderizerConfigResponse } from '@shop/contracts/powderizer';
import { createCustomPowderMix, getCustomPowderConfig, quoteCustomPowderMix } from '@/api/customPowder';
import { useCartContext } from '@/hooks/CartContext';
import type { BuilderConfig } from './powderizerState';
import {
  usePowderizerController,
  type PowderizerSubmitSuccessHandler,
} from './usePowderizerController';

vi.mock('@/api/customPowder', () => ({
  createCustomPowderMix: vi.fn(),
  getCustomPowderConfig: vi.fn(),
  quoteCustomPowderMix: vi.fn(),
  updateCustomPowderMix: vi.fn(),
  requoteCustomPowderMix: vi.fn(),
  updateCustomPowderMixQuantity: vi.fn(),
  removeCustomPowderMix: vi.fn(),
}));
vi.mock('@/hooks/CartContext', () => ({ useCartContext: vi.fn() }));

const cartId = '01234567-89ab-4def-8123-456789abcdee';
const cart: Cart = { id: cartId, items: [], mixItems: [], totalItems: 0, subtotalCents: 0 };
const submittedConfig: BuilderConfig = {
  components: [
    { productId: 'protein', percentage: 50 },
    { productId: 'cocoa', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'standard',
  customLabel: 'Submitted snapshot',
  bagColourScheme: 'ultraviolet-cyan',
};
const config: PowderizerConfigResponse = {
  eligibleProducts: [],
  bagSizesGrams: [250, 500, 1000],
  finenessValues: ['coarse', 'standard', 'fine'],
  labelMaxGraphemes: 40,
  priceVersion: 'powderizer-v1',
  bagColourSchemes: [
    'ultraviolet-cyan',
    'solar-flare',
    'deep-space',
    'acid-lilac',
    'monochrome-glitch',
  ],
  defaultBagColourScheme: 'ultraviolet-cyan',
  dailyRecipe: { effectiveDate: '2026-07-14', name: 'Daily', config: submittedConfig },
};

function quote(): PowderMixQuote {
  return {
    priceVersion: 'powderizer-v1',
    config: { ...submittedConfig, customLabel: submittedConfig.customLabel },
    allocations: submittedConfig.components.map((component) => ({
      ...component,
      allocatedGrams: 250,
    })),
    packagingFeeCents: 400,
    finenessSurchargeCents: 0,
    unitPriceCents: 1400,
    usageLabel: 'Consumable powder',
  };
}

function controllerCartContext(): ReturnType<typeof useCartContext> {
  return {
    cart,
    cartId,
    isCartAvailable: true,
    isLoading: false,
    isInitializing: false,
    error: null,
    pendingActions: {},
    isActionPending: () => false,
    addItem: vi.fn(),
    addBundle: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    updateMixQuantity: vi.fn(),
    removeMix: vi.fn(),
    requoteMix: vi.fn(),
    refreshCart: vi.fn().mockResolvedValue(true),
    retryCart: vi.fn().mockResolvedValue(true),
    clearCart: vi.fn(),
  };
}

function ControllerProbe({
  onSubmitSuccess,
}: {
  onSubmitSuccess?: PowderizerSubmitSuccessHandler;
}) {
  const controller = usePowderizerController({ onSubmitSuccess });
  const location = useLocation();
  useEffect(() => {
    controller.replaceConfig(submittedConfig);
  }, [controller.replaceConfig]);
  return (
    <>
      <output>{location.pathname}</output>
      <button
        type="button"
        disabled={!controller.canSubmit}
        onClick={() => void controller.submit()}
      >
        Submit
      </button>
    </>
  );
}

function renderController(onSubmitSuccess?: PowderizerSubmitSuccessHandler) {
  return render(
    <MemoryRouter initialEntries={['/powderizer']}>
      <ControllerProbe onSubmitSuccess={onSubmitSuccess} />
    </MemoryRouter>,
  );
}

describe('usePowderizerController submit success callback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCustomPowderConfig).mockResolvedValue(config);
    vi.mocked(quoteCustomPowderMix).mockResolvedValue(quote());
    vi.mocked(createCustomPowderMix).mockResolvedValue(cart);
    vi.mocked(useCartContext).mockReturnValue(controllerCartContext());
  });

  it('calls success callback once with submitted config before cart navigation', async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn();
    renderController(onSubmitSuccess);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmitSuccess).toHaveBeenCalledWith(submittedConfig);
    await waitFor(() => expect(screen.getByText('/cart')).toBeInTheDocument());
  });

  it('does not call success callback when create fails', async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn();
    vi.mocked(createCustomPowderMix).mockRejectedValue(new Error('Save failed'));
    renderController(onSubmitSuccess);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(createCustomPowderMix).toHaveBeenCalledTimes(1));
    expect(onSubmitSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('/powderizer')).toBeInTheDocument();
  });

  it('navigates after a success callback failure', async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
    const context = controllerCartContext();
    vi.mocked(useCartContext).mockReturnValue(context);
    renderController(onSubmitSuccess);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalledTimes(1));
    expect(context.refreshCart).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('/cart')).toBeInTheDocument());
  });
});
