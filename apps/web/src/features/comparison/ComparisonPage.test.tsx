import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Product, ProductComparisonResponse } from '@shop/contracts/products';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonPage } from './ComparisonPage';

const api = vi.hoisted(() => ({ getProductComparison: vi.fn() }));
vi.mock('@/api/products', () => api);

function product(id: string, name = `Powder ${id}`): Product {
  return {
    id,
    name,
    description: '',
    priceCents: 1000,
    imageSetId: 'none',
    category: 'Cooking',
    stock: 1,
    slug: id,
    salesCount: 0,
    mixable: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    available: true,
    tags: [],
    specificationGroups: [],
  };
}

function response(...products: Product[]): ProductComparisonResponse {
  return {
    items: products.map((item) => ({ id: item.id, status: 'available' as const, product: item })),
  };
}

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/compare"
          element={
            <>
              <ComparisonPage />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComparisonPage', () => {
  beforeEach(() => {
    api.getProductComparison.mockReset();
    window.localStorage.clear();
  });

  it('loads the direct URL in its supplied order', async () => {
    api.getProductComparison.mockResolvedValueOnce(response(product('3'), product('1')));
    renderPage('/compare?ids=3,1');

    await screen.findByRole('table', { name: /Product specifications comparison/ });
    expect(api.getProductComparison).toHaveBeenCalledWith(['3', '1'], expect.any(AbortSignal));
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers[1]).toContain('Powder 3');
    expect(headers[2]).toContain('Powder 1');
  });

  it('restores a valid stored selection only when the URL omits ids', async () => {
    window.localStorage.setItem('shop.comparison.product-ids.v1', JSON.stringify(['2', '1']));
    api.getProductComparison.mockResolvedValueOnce(response(product('2'), product('1')));
    renderPage('/compare');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?ids=2%2C1'));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('does not request malformed selections', () => {
    renderPage('/compare?ids=1,1');
    expect(
      screen.getByRole('heading', { name: 'That comparison link is invalid' }),
    ).toBeInTheDocument();
    expect(api.getProductComparison).not.toHaveBeenCalled();
  });

  it('reports unavailable entries without rendering a blank comparison column', async () => {
    api.getProductComparison.mockResolvedValueOnce({
      items: [
        { id: '1', status: 'available', product: product('1') },
        { id: '2', status: 'inactive' },
      ],
    } satisfies ProductComparisonResponse);
    renderPage('/compare?ids=1,2');

    expect(await screen.findByText(/Not enough active products/)).toBeInTheDocument();
    expect(screen.getByText(/no longer active/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('clears the comparison after a removal leaves fewer than two products', async () => {
    const user = userEvent.setup();
    api.getProductComparison.mockResolvedValueOnce(response(product('1'), product('2')));
    renderPage('/compare?ids=1,2');

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Remove Powder 1' }));

    expect(
      await screen.findByRole('heading', { name: 'Choose products to compare' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('');
  });
});
