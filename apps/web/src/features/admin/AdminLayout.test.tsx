import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '@/components/AdminRoute';
import { AdminIndexPage } from './AdminIndexPage';
import { AdminLayout } from './AdminLayout';

const authState = vi.hoisted(() => ({
  loading: false,
  user: {
    id: 'admin-1',
    email: 'admin@example.test',
    displayName: 'Admin',
    role: 'admin',
  },
}));

vi.mock('@/hooks/AuthContext', () => ({ useAuth: () => authState }));

const countryState = vi.hoisted(() => ({ activeCountry: 'DE' as const }));

vi.mock('@/hooks/CountryContext', () => ({
  useCountry: () => ({
    activeCountry: countryState.activeCountry,
    isAccountBound: false,
    selectCountry: vi.fn(),
    countryStorage: null,
  }),
}));

describe('AdminLayout', () => {
  it('renders administration navigation and mounts the index inside AdminRoute', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminIndexPage />} />
          </Route>
          <Route path="/login" element={<p>Login</p>} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Administration overview' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-standing-country')).toHaveTextContent('Standing country: DE');
    expect(
      screen.getByText('Jobs, webhooks, and feature flags are global sections.'),
    ).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Administration' });
    expect(navigation).toHaveTextContent('Products');
    expect(navigation).toHaveTextContent('Variants');
    expect(navigation).toHaveTextContent('Promotions');
    expect(navigation).toHaveTextContent('Users');
    expect(navigation).toHaveTextContent('Orders');
    expect(navigation).toHaveTextContent('Feature flags');
    expect(navigation).toHaveTextContent('Review moderation');

    expect(within(navigation).getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/admin/products',
    );
    expect(within(navigation).getByRole('link', { name: 'Review moderation' })).toHaveAttribute(
      'href',
      '/admin/reviews',
    );
  });
});
