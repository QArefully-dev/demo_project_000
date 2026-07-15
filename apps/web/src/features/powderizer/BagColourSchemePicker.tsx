import type { PowderMixBagColourScheme } from '@shop/contracts/powderizer';
import { POWDER_MIX_BAG_SCHEME_PRESENTATION } from '@/components/powderMixBagScheme';

export { POWDER_MIX_BAG_SCHEME_PRESENTATION as BAG_COLOUR_SCHEME_METADATA };

type BagColourSchemePickerProps = {
  schemes: readonly PowderMixBagColourScheme[];
  value: PowderMixBagColourScheme;
  onChange: (value: PowderMixBagColourScheme) => void;
};

export function BagColourSchemePicker({ schemes, value, onChange }: BagColourSchemePickerProps) {
  return (
    <fieldset className="powderizer-scheme-picker rounded-xl border border-border bg-surface-raised p-4">
      <legend className="mb-2 font-semibold">5. Bag colour scheme</legend>
      <p className="mb-3 text-sm text-muted-foreground">
        Changes bag art only, not your ingredients.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {schemes.map((scheme) => {
          const metadata = POWDER_MIX_BAG_SCHEME_PRESENTATION[scheme];
          return (
            <label key={scheme} className="powderizer-scheme-option">
              <input
                className="sr-only"
                type="radio"
                name="bag-colour-scheme"
                value={scheme}
                checked={value === scheme}
                onChange={() => onChange(scheme)}
              />
              <span
                className="powderizer-scheme-swatch"
                style={{ background: metadata.swatch }}
                aria-hidden="true"
              />
              <span>{metadata.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
