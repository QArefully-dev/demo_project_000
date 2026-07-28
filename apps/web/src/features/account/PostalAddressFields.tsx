import type { PostalAddress } from '@shop/contracts/address';
import { Input } from '@/components/ui/input';

/**
 * Shared postal address sub-form.
 *
 * Reused by every surface that captures an address — saved delivery sites, saved billing entities,
 * and the ad-hoc address entry at checkout — so field bounds, labels, and error copy exist once and
 * cannot drift between the account page and checkout.
 *
 * The component is controlled and holds no state: the owning feature owns the draft, this module
 * owns the field layout plus the draft-to-contract validation.
 */

/** Free-text mirror of `PostalAddress`. Optional contract fields are empty strings while editing. */
export interface PostalAddressDraft {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  countryCode: string;
}

export type PostalAddressFieldName = keyof PostalAddressDraft;

export type PostalAddressFieldErrors = Partial<Record<PostalAddressFieldName, string>>;

export const EMPTY_POSTAL_ADDRESS_DRAFT: PostalAddressDraft = {
  line1: '',
  line2: '',
  city: '',
  region: '',
  postcode: '',
  countryCode: 'GB',
};

/** Turns a stored address back into an editable draft. */
export function toPostalAddressDraft(address: PostalAddress): PostalAddressDraft {
  return {
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region ?? '',
    postcode: address.postcode,
    countryCode: address.countryCode,
  };
}

/** Bounds mirror `@shop/contracts/address`; a wider bound here turns a 400 into a confusing retry. */
const MAX_LINE_LENGTH = 120;
const MAX_LOCALITY_LENGTH = 80;
const MAX_POSTCODE_LENGTH = 16;
const POSTCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const MARKUP_PATTERN = /[<>]/;

function checkText(value: string, label: string, maxLength: number): string | undefined {
  if (value.length > maxLength) return `${label} must be ${maxLength} characters or fewer`;
  if (MARKUP_PATTERN.test(value)) return `${label} cannot contain < or >`;
  return undefined;
}

function checkRequiredText(value: string, label: string, maxLength: number): string | undefined {
  if (value.trim().length === 0) return `${label} is required`;
  return checkText(value, label, maxLength);
}

export type PostalAddressValidation =
  { ok: true; address: PostalAddress } | { ok: false; errors: PostalAddressFieldErrors };

/**
 * Validates a draft against the transport contract and builds the `PostalAddress` payload.
 * Blank optional fields are omitted rather than sent as empty strings, which the contract rejects.
 */
export function validatePostalAddressDraft(draft: PostalAddressDraft): PostalAddressValidation {
  const line1 = draft.line1.trim();
  const line2 = draft.line2.trim();
  const city = draft.city.trim();
  const region = draft.region.trim();
  const postcode = draft.postcode.trim();
  const countryCode = draft.countryCode.trim().toUpperCase();

  const errors: PostalAddressFieldErrors = {};
  const line1Error = checkRequiredText(line1, 'Address line 1', MAX_LINE_LENGTH);
  if (line1Error) errors.line1 = line1Error;
  const line2Error = line2 ? checkText(line2, 'Address line 2', MAX_LINE_LENGTH) : undefined;
  if (line2Error) errors.line2 = line2Error;
  const cityError = checkRequiredText(city, 'City', MAX_LOCALITY_LENGTH);
  if (cityError) errors.city = cityError;
  const regionError = region
    ? checkText(region, 'County or region', MAX_LOCALITY_LENGTH)
    : undefined;
  if (regionError) errors.region = regionError;

  if (postcode.length === 0) {
    errors.postcode = 'Postcode is required';
  } else if (postcode.length > MAX_POSTCODE_LENGTH) {
    errors.postcode = `Postcode must be ${MAX_POSTCODE_LENGTH} characters or fewer`;
  } else if (!POSTCODE_PATTERN.test(postcode)) {
    errors.postcode = 'Postcode may use letters, numbers, spaces, and hyphens only';
  }

  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.countryCode = 'Country code must be two letters, for example GB';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const address: PostalAddress = { line1, city, postcode, countryCode };
  if (line2) address.line2 = line2;
  if (region) address.region = region;
  return { ok: true, address };
}

interface PostalAddressFieldsProps {
  /** Prefix for generated field ids so several address forms can share one page. */
  idPrefix: string;
  value: PostalAddressDraft;
  onChange: (next: PostalAddressDraft) => void;
  errors?: PostalAddressFieldErrors;
  disabled?: boolean;
  /** Group caption, e.g. `Delivery address` or `Billing address`. */
  legend?: string;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  maxLength: number;
  optional?: boolean;
  className?: string;
}

function AddressField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoComplete,
  maxLength,
  optional,
  className,
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PostalAddressFields({
  idPrefix,
  value,
  onChange,
  errors = {},
  disabled,
  legend = 'Address',
}: PostalAddressFieldsProps) {
  function setField(field: PostalAddressFieldName, next: string) {
    onChange({ ...value, [field]: next });
  }

  return (
    <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
      <legend className="text-sm font-medium text-muted-foreground">{legend}</legend>
      <AddressField
        id={`${idPrefix}-line1`}
        label="Address line 1"
        value={value.line1}
        onChange={(next) => setField('line1', next)}
        error={errors.line1}
        autoComplete="address-line1"
        maxLength={MAX_LINE_LENGTH}
      />
      <AddressField
        id={`${idPrefix}-line2`}
        label="Address line 2"
        value={value.line2}
        onChange={(next) => setField('line2', next)}
        error={errors.line2}
        autoComplete="address-line2"
        maxLength={MAX_LINE_LENGTH}
        optional
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <AddressField
          id={`${idPrefix}-city`}
          label="City"
          value={value.city}
          onChange={(next) => setField('city', next)}
          error={errors.city}
          autoComplete="address-level2"
          maxLength={MAX_LOCALITY_LENGTH}
        />
        <AddressField
          id={`${idPrefix}-region`}
          label="County or region"
          value={value.region}
          onChange={(next) => setField('region', next)}
          error={errors.region}
          autoComplete="address-level1"
          maxLength={MAX_LOCALITY_LENGTH}
          optional
        />
        <AddressField
          id={`${idPrefix}-postcode`}
          label="Postcode"
          value={value.postcode}
          onChange={(next) => setField('postcode', next)}
          error={errors.postcode}
          autoComplete="postal-code"
          maxLength={MAX_POSTCODE_LENGTH}
        />
        <AddressField
          id={`${idPrefix}-countryCode`}
          label="Country code"
          value={value.countryCode}
          onChange={(next) => setField('countryCode', next.toUpperCase())}
          error={errors.countryCode}
          autoComplete="country"
          maxLength={2}
        />
      </div>
    </fieldset>
  );
}
