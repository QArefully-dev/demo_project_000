import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HeroSection } from './HeroSection';

describe('HeroSection', () => {
  it('renders QArefully powder CTAs with shareable catalog targets', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /shop powders/i })).toHaveAttribute(
      'href',
      '/catalog',
    );
    expect(screen.getByRole('button', { name: /browse impossible powders/i })).toHaveAttribute(
      'href',
      '/catalog?category=Impossible',
    );
    expect(screen.getByRole('heading', { name: /we will powder anything/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Powdered Water powder bag' })).toBeInTheDocument();
  });
});
