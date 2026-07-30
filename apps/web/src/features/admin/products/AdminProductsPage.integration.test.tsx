import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminProductsPage } from './AdminProductsPage';
const api = vi.hoisted(() => ({
  getAdminProducts: vi.fn(),
  createAdminProduct: vi.fn(),
  updateAdminProduct: vi.fn(),
  retireAdminProduct: vi.fn(),
}));
vi.mock('@/api/adminProducts', () => api);
const product = {
  id: '1',
  name: 'Cement',
  description: 'Fine cement',
  priceCents: 100,
  category: 'Trade & Creative Materials' as const,
  stockCount: 4,
  imageSetId: null,
  slug: 'cement',
  compareAtPriceCents: null,
  salesCount: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  consumptionClassification: 'non-food' as const,
  mixingGroup: 'cementitious-materials' as const,
  detailsJson: null,
  defaultVariantId: null,
  blendSourceVariantId: null,
};
describe('AdminProductsPage', () => {
  afterEach(() => vi.resetAllMocks());
  it('creates a product through the typed client', async () => {
    api.getAdminProducts.mockResolvedValue({ items: [product] });
    api.createAdminProduct.mockResolvedValue({ ...product, id: '2', name: 'Sand', slug: 'sand' });
    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await screen.findByText('Cement');
    await user.click(screen.getByRole('button', { name: 'New product' }));
    await user.type(screen.getByLabelText('Name'), 'Sand');
    await user.type(screen.getByLabelText('Description'), 'Fine sand');
    await user.clear(screen.getByLabelText('Slug'));
    await user.type(screen.getByLabelText('Slug'), 'sand');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(api.createAdminProduct).toHaveBeenCalled());
  });
  it('requires inline retirement confirmation and shows service rejection', async () => {
    api.getAdminProducts.mockResolvedValue({ items: [product] });
    api.retireAdminProduct.mockRejectedValue(new Error('Product has order references'));
    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Cement Active' }));
    await user.click(screen.getByRole('button', { name: 'Retire product' }));
    expect(api.retireAdminProduct).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm retire' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Product has order references');
  });
});
