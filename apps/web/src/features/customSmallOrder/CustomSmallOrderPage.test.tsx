import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CustomSmallOrderPage } from './CustomSmallOrderPage';

function renderPage() {
  render(
    <MemoryRouter>
      <CustomSmallOrderPage />
    </MemoryRouter>,
  );
}

describe('CustomSmallOrderPage', () => {
  it('renders a static work-in-progress notice with no interactive controls beyond navigation', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Custom Small Order' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/being rebuilt/i)).toBeInTheDocument();
    expect(screen.getByText(/mix editing is unavailable/i)).toBeInTheDocument();
  });

  it('links back to the catalogue', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Browse catalogue' })).toHaveAttribute(
      'href',
      '/catalog',
    );
  });

  it('exposes no buttons other than catalogue navigation', () => {
    renderPage();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
