import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HeroSection } from './HeroSection';

describe('HeroSection', () => {
  it('renders QArefully Materials Exchange CTA and supply overview', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /browse materials/i })).toHaveAttribute(
      'href',
      '/catalog',
    );
    expect(
      screen.getByRole('heading', { name: /materials supply with operational clarity/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Materials exchange supply overview')).toBeInTheDocument();
    expect(screen.getByText('Food ingredients')).toBeInTheDocument();
  });
});
