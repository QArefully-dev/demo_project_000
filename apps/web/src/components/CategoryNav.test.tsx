import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CategoryNav } from './CategoryNav';

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: ['Sports Nutrition', 'Baking & Pantry'],
    isLoading: false,
    error: null,
  }),
}));

function renderNav(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CategoryNav />
    </MemoryRouter>,
  );
}

describe('CategoryNav', () => {
  it('keeps Custom Powder current-page semantics with its dedicated treatment', () => {
    renderNav('/custom-powder');

    const customPowder = screen.getByRole('link', { name: 'Custom Powder' });
    expect(customPowder).toHaveAttribute('aria-current', 'page');
    expect(customPowder).toHaveClass('powderizer-nav-link');
    expect(screen.getByRole('link', { name: 'All products' })).not.toHaveAttribute('aria-current');
  });

  it('does not apply Custom Powder treatment to category or deals links', () => {
    renderNav('/catalog?category=Baking+%26+Pantry');

    expect(screen.getByRole('link', { name: 'Baking & Pantry' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Sports Nutrition' })).not.toHaveClass(
      'powderizer-nav-link',
    );
    expect(screen.getByRole('link', { name: 'Deals' })).not.toHaveClass('powderizer-nav-link');
  });

  it('links to bundles and marks its dedicated page as current', () => {
    renderNav('/bundles');

    const bundles = screen.getByRole('link', { name: 'Bundles' });
    expect(bundles).toHaveAttribute('href', '/bundles');
    expect(bundles).toHaveAttribute('aria-current', 'page');
  });

  it('freezes the iridescent animation for reduced motion', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(styles).toContain('--powderizer-gradient-duration: 12s;');
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s+\.powderizer-gradient-animated,\s+\.powderizer-nav-link \{\s+animation: none;/,
    );
  });
});
