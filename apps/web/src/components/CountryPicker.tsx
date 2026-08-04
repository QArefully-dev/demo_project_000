import { useState, type ChangeEvent } from 'react';
import { SUPPORTED_COUNTRIES, type Country } from '@shop/contracts/country';
import { useOptionalCountry } from '@/hooks/CountryContext';
import { useCartContext } from '@/hooks/CartContext';

interface CountryPickerProps {
  value: Country;
  onChange: (country: Country) => void;
  disabled?: boolean;
}

const ACCOUNT_BOUND_EXPLANATION =
  'Country is set by your account. Sign out to browse another country.';

export function CountryPicker({ value, onChange, disabled }: CountryPickerProps) {
  const { isAccountBound } = useOptionalCountry();
  const { cart } = useCartContext();
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

  const label = disabled ? 'Account country' : 'Country';

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="country-picker" className="flex items-center gap-2 text-sm font-medium">
        <span className="hidden text-muted-foreground sm:inline">{label}</span>
        <select
          id="country-picker"
          data-testid="country-picker"
          aria-label={label}
          aria-describedby={disabled ? 'country-picker-account-note' : undefined}
          title={disabled ? ACCOUNT_BOUND_EXPLANATION : undefined}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="h-10 max-w-44 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
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
          {ACCOUNT_BOUND_EXPLANATION}
        </p>
      )}
      {cartOrigin !== null && (
        <p data-testid="country-cart-message" className="text-xs text-muted-foreground">
          Your cart is tied to the previous country and will not follow this switch.
        </p>
      )}
    </div>
  );
}
