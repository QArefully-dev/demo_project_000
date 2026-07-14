import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CategoryTiles } from './CategoryTiles';

describe('CategoryTiles', () => {
  it('keeps four category links with representative artwork', () => {
    render(
      <MemoryRouter>
        <CategoryTiles
          categories={['Pantry Staples', 'Performance', 'Drinks', 'Household', 'Outdoors']}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/catalog?category=Pantry%20Staples',
      '/catalog?category=Performance',
      '/catalog?category=Drinks',
      '/catalog?category=Household',
    ]);

    for (const link of links) {
      expect(
        link.firstElementChild?.matches(
          'img[alt=""], div[aria-hidden="true"], svg[aria-hidden="true"]',
        ),
      ).toBe(true);
    }
  });
});
