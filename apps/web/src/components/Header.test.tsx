import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

const savedLists = vi.hoisted(() => ({ defaultList: null as { items: unknown[] } | null }));

vi.mock('./CategoryNav', () => ({
  CategoryNav: () => <nav aria-label="Product categories">Materials</nav>,
}));
vi.mock('./SearchBar', () => ({ SearchBar: () => <input aria-label="Search materials" /> }));
vi.mock('./AccountMenu', () => ({ AccountMenu: () => <button type="button">Account</button> }));
vi.mock('@/hooks/useSavedLists', () => ({
  useSavedLists: () => savedLists,
}));
vi.mock('./CartSheet', () => ({ CartSheet: () => <button type="button">Cart</button> }));

describe('Header', () => {
  it('presents QArefully Materials Exchange with trade-supply context', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'QArefully Materials Exchange' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByText(/Materials data/)).toBeInTheDocument();
  });

  it('links to saved lists and shows the default-list item count', () => {
    savedLists.defaultList = { items: [{}, {}] };
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Saved lists (2)' })).toHaveAttribute('href', '/lists');
    expect(screen.getByText('2')).toBeInTheDocument();
    savedLists.defaultList = null;
  });
});
