import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CountryBanner } from './CountryBanner';

const countryState: { activeCountry: string | undefined } = vi.hoisted(() => ({
  activeCountry: 'ES',
}));

vi.mock('@/hooks/CountryContext', () => ({
  useCountry: () => ({
    activeCountry: countryState.activeCountry,
    isAccountBound: false,
    selectCountry: vi.fn(),
    countryStorage: null,
  }),
}));

describe('CountryBanner', () => {
  it('renders the active profile banner with the established promotion treatment', () => {
    countryState.activeCountry = 'ES';
    render(<CountryBanner />);

    const notice = screen.getByRole('region', { name: 'Country ordering notice' });
    expect(notice).toHaveTextContent(
      'Ordering for Spain: availability and delivery options reflect local requirements.',
    );
    expect(notice).toHaveClass(
      'overflow-hidden',
      'rounded-2xl',
      'border-2',
      'border-foreground',
      'bg-sale',
      'text-sale-foreground',
    );
  });

  it('renders no element when the active profile has no banner', () => {
    countryState.activeCountry = 'UK';
    const { container } = render(<CountryBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders no element when the active country is unsupported or absent', () => {
    for (const activeCountry of ['ZZ', undefined]) {
      countryState.activeCountry = activeCountry;
      const { container, unmount } = render(<CountryBanner />);

      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
