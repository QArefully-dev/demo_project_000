import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HeroSection } from './HeroSection';

describe('HeroSection', () => {
  it('renders primary shopping and sale CTAs with shareable catalog targets', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /shop the collection/i })).toHaveAttribute(
      'href',
      '/catalog',
    );
    expect(screen.getByRole('button', { name: /explore deals/i })).toHaveAttribute(
      'href',
      '/catalog?onSale=true&sort=bestselling',
    );
  });
});
