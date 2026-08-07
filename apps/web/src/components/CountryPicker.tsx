import { useState, type ChangeEvent } from 'react';
import { SUPPORTED_COUNTRIES, type Country } from '@shop/contracts/country';
import { useOptionalCountry } from '@/hooks/CountryContext';
import { useCartContext } from '@/hooks/CartContext';
import { useLocalisation } from '@/i18n/LocaleContext';
import { webMessages } from '@shop/localisation/messages/webShell';
import { countryMessages } from '@shop/localisation/messages/country';

interface CountryPickerProps {
  value: Country;
  onChange: (country: Country) => void;
  disabled?: boolean;
}

export function CountryPicker({ value, onChange, disabled }: CountryPickerProps) {
  const { isAccountBound } = useOptionalCountry();
  const { cart } = useCartContext();
  const { translate } = useLocalisation();
  const label = disabled
    ? translate(webMessages, 'country.accountCountry')
    : translate(webMessages, 'country.country');
  const accountBoundExplanation = translate(webMessages, 'country.accountBoundExplanation');
  const countryName = (country: Country) =>
    translate(
      countryMessages,
      `country.name.${country.toLowerCase()}` as keyof typeof countryMessages,
    );
  /**
   * Country the cart was tied to when the warning appeared. Tracking the origin (rather than a
   * boolean) lets the warning clear itself once the buyer switches back, so a stale sentence never
   * outlives the situation it describes.
   */
  const [cartOrigin, setCartOrigin] = useState<Country | null>(null);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Country;
    if (cartOrigin !== null) {
      if (next === cartOrigin) {
        setCartOrigin(null);
      }
    } else if (next !== value && !isAccountBound && (cart?.totalItems ?? 0) > 0) {
      setCartOrigin(value);
    }
    onChange(next);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="country-picker" className="flex items-center gap-2 text-sm font-medium">
        <span className="hidden text-muted-foreground sm:inline">{label}</span>
        <select
          id="country-picker"
          data-testid="country-picker"
          aria-label={label}
          aria-describedby={disabled ? 'country-picker-account-note' : undefined}
          title={disabled ? accountBoundExplanation : undefined}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="h-10 max-w-44 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {countryName(c)}
            </option>
          ))}
        </select>
      </label>
      {disabled && (
        <p
          id="country-picker-account-note"
          data-testid="country-picker-account-note"
          className="max-w-52 text-xs text-muted-foreground"
        >
          {accountBoundExplanation}
        </p>
      )}
      {cartOrigin !== null && (
        <p data-testid="country-cart-message" className="text-xs text-muted-foreground">
          {translate(webMessages, 'country.cartSwitchWarning')}
        </p>
      )}
    </div>
  );
}
