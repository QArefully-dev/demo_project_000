import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Country } from '@shop/contracts/country';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryPicker } from './CountryPicker';

const cartState = vi.hoisted(() => ({ cart: null as { totalItems: number } | null }));
const countryState = vi.hoisted(() => ({ isAccountBound: false }));

vi.mock('@/hooks/CountryContext', () => ({
  useOptionalCountry: () => countryState,
}));

vi.mock('@/hooks/CartContext', () => ({
  useCartContext: () => ({ cart: cartState.cart }),
}));

function renderPicker(
  value: Country = 'US',
  onChange: (c: Country) => void = vi.fn(),
  disabled: boolean = false,
) {
  return render(<CountryPicker value={value} onChange={onChange} disabled={disabled} />);
}

describe('CountryPicker', () => {
  beforeEach(() => {
    countryState.isAccountBound = false;
    cartState.cart = null;
  });

  it('renders all supported countries as options', () => {
    renderPicker();
    const select = screen.getByTestId('country-picker');
    expect(select).toHaveValue('US');
    expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Germany' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'France' })).toBeInTheDocument();
  });

  it('calls onChange with the selected country', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('US', onChange);
    await user.selectOptions(screen.getByTestId('country-picker'), 'DE');
    expect(onChange).toHaveBeenCalledWith('DE');
  });

  it('disables the select when disabled prop is true', () => {
    renderPicker('UK', vi.fn(), true);
    const picker = screen.getByTestId('country-picker');
    expect(picker).toBeDisabled();
    expect(picker).toHaveClass(
      'disabled:bg-muted',
      'disabled:text-muted-foreground',
      'disabled:opacity-100',
    );
  });

  it('shows "Account country" label when disabled', () => {
    renderPicker('UK', vi.fn(), true);
    expect(screen.getByText('Account country')).toBeInTheDocument();
  });

  it('shows "Country" label when enabled', () => {
    renderPicker('US', vi.fn(), false);
    expect(screen.getByText('Country')).toBeInTheDocument();
  });

  it('uses the enabled Country label for an admin browsing another country', () => {
    // CountryContext reports admins as not account-bound in stage 2.
    countryState.isAccountBound = false;
    renderPicker('DE', vi.fn(), false);

    expect(screen.getByRole('combobox', { name: 'Country' })).not.toBeDisabled();
    expect(screen.queryByText('Account country')).not.toBeInTheDocument();
  });

  it('shows cart message when guest changes country with non-empty cart', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    countryState.isAccountBound = false;
    cartState.cart = { totalItems: 3 };
    renderPicker('US', onChange);
    await user.selectOptions(screen.getByTestId('country-picker'), 'DE');
    expect(screen.getByTestId('country-cart-message')).toHaveTextContent(
      'Your cart is tied to the previous country and will not follow this switch.',
    );
  });

  it('does not show cart message when cart is empty', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    countryState.isAccountBound = false;
    cartState.cart = { totalItems: 0 };
    renderPicker('US', onChange);
    await user.selectOptions(screen.getByTestId('country-picker'), 'DE');
    expect(screen.queryByTestId('country-cart-message')).not.toBeInTheDocument();
  });

  it('names the select without relying on the breakpoint-hidden label text', () => {
    renderPicker('US', vi.fn(), false);
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeInTheDocument();
  });

  it('names the disabled select "Account country"', () => {
    renderPicker('UK', vi.fn(), true);
    expect(screen.getByRole('combobox', { name: 'Account country' })).toBeInTheDocument();
  });

  it('explains the disabled state with a visible, described-by sentence', () => {
    renderPicker('UK', vi.fn(), true);
    const select = screen.getByTestId('country-picker');
    const note = screen.getByTestId('country-picker-account-note');
    expect(note).toHaveTextContent(
      'Country is set by your account. Sign out to browse another country.',
    );
    expect(note.className).not.toMatch(/hidden/);
    expect(select).toHaveAttribute('aria-describedby', note.id);
    expect(select).toHaveAttribute(
      'title',
      'Country is set by your account. Sign out to browse another country.',
    );
  });

  it('does not render the account explanation when enabled', () => {
    renderPicker('US', vi.fn(), false);
    expect(screen.queryByTestId('country-picker-account-note')).not.toBeInTheDocument();
  });

  it('clears the cart message when the buyer switches back to the original country', async () => {
    const user = userEvent.setup();
    cartState.cart = { totalItems: 3 };
    function Harness() {
      const [country, setCountry] = useState<Country>('US');
      return <CountryPicker value={country} onChange={setCountry} />;
    }
    render(<Harness />);
    const select = screen.getByTestId('country-picker');

    await user.selectOptions(select, 'DE');
    expect(screen.getByTestId('country-cart-message')).toBeInTheDocument();

    await user.selectOptions(select, 'US');
    expect(screen.queryByTestId('country-cart-message')).not.toBeInTheDocument();
  });

  it('keeps the cart message while switching on to a third country', async () => {
    const user = userEvent.setup();
    cartState.cart = { totalItems: 3 };
    function Harness() {
      const [country, setCountry] = useState<Country>('US');
      return <CountryPicker value={country} onChange={setCountry} />;
    }
    render(<Harness />);
    const select = screen.getByTestId('country-picker');

    await user.selectOptions(select, 'DE');
    await user.selectOptions(select, 'FR');
    expect(screen.getByTestId('country-cart-message')).toBeInTheDocument();
  });

  it('does not show cart message when account-bound', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    countryState.isAccountBound = true;
    cartState.cart = { totalItems: 5 };
    renderPicker('US', onChange);
    await user.selectOptions(screen.getByTestId('country-picker'), 'DE');
    expect(screen.queryByTestId('country-cart-message')).not.toBeInTheDocument();
  });
});
