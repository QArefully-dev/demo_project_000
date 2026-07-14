import { BagArtwork } from '@/components/BagArtwork';
import type { BuilderConfig } from './powderizerState';

export function PowderMixBagPreview({
  config,
  priceVersion,
}: {
  config: BuilderConfig;
  priceVersion: string;
}) {
  const label = config.customLabel.trim() || 'Custom powder mix';
  return (
    <section
      className="rounded-xl border border-border bg-surface-soft p-4"
      aria-labelledby="bag-preview-title"
    >
      <h2 id="bag-preview-title" className="mb-3 font-semibold">
        Bag preview
      </h2>
      <BagArtwork
        name={label}
        category="Custom mix"
        quantity={`${config.bagSizeGrams}g`}
        batchCode={priceVersion}
        mark="MIX"
        accent="#9d6945"
        powderAccent="#ba8761"
        consumptionLabel="Consumable powder"
        ariaLabel={`${label} bag preview`}
        className="mx-auto w-full max-w-xs"
      />
    </section>
  );
}
