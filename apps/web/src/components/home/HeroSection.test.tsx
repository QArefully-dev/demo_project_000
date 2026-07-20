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
    expect(screen.getByRole('button', { name: /custom blends/i })).toHaveAttribute(
      'href',
      '/custom-powder',
    );
    expect(screen.getByRole('heading', { name: /powders for food/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Protein Powder powder bag' })).toBeInTheDocument();
  });
});
