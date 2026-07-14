import { Input } from '@/components/ui/input';
import { graphemeCount, type BuilderConfig } from './powderizerState';

type MixOptionsProps = {
  config: BuilderConfig;
  bagSizes: readonly (250 | 500 | 1000)[];
  finenessValues: readonly ('coarse' | 'standard' | 'fine')[];
  labelMaxGraphemes: number;
  onBagSizeChange: (value: BuilderConfig['bagSizeGrams']) => void;
  onFinenessChange: (value: BuilderConfig['fineness']) => void;
  onLabelChange: (value: string) => void;
};

export function MixOptions({
  config,
  bagSizes,
  finenessValues,
  labelMaxGraphemes,
  onBagSizeChange,
  onFinenessChange,
  onLabelChange,
}: MixOptionsProps) {
  const labelCount = graphemeCount(config.customLabel.trim().normalize('NFC'));
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface-raised p-4"
      aria-label="Mix options"
    >
      <fieldset>
        <legend className="mb-2 font-semibold">3. Bag size</legend>
        <div className="grid grid-cols-3 gap-2">
          {bagSizes.map((size) => (
            <label
              key={size}
              className="cursor-pointer rounded-lg border bg-background p-3 text-center text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="bag-size"
                value={size}
                checked={config.bagSizeGrams === size}
                onChange={() => onBagSizeChange(size)}
                className="sr-only"
              />
              {size}g
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold">4. Fineness</legend>
        <div className="grid grid-cols-3 gap-2">
          {finenessValues.map((fineness) => (
            <label
              key={fineness}
              className="cursor-pointer rounded-lg border bg-background p-3 text-center text-sm capitalize has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="fineness"
                value={fineness}
                checked={config.fineness === fineness}
                onChange={() => onFinenessChange(fineness)}
                className="sr-only"
              />
              {fineness}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="mix-label" className="block text-sm font-semibold">
          5. Bag label <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="mix-label"
          value={config.customLabel}
          maxLength={160}
          onChange={(event) => onLabelChange(event.target.value)}
          aria-describedby="mix-label-count"
          className="mt-2"
        />
        <p id="mix-label-count" className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {labelCount} of {labelMaxGraphemes} characters
        </p>
      </div>
    </section>
  );
}
