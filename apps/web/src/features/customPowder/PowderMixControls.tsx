import type { Product } from '@shop/contracts/products';
import type { PowderMixBagColourScheme } from '@shop/contracts/powderizer';
import type { BuilderConfig } from '../powderizer/powderizerState';
import { RatioEditor } from '../powderizer/RatioEditor';
import { MixOptions } from '../powderizer/MixOptions';
import { BagColourSchemePicker } from '../powderizer/BagColourSchemePicker';
import { PowderMixBagPreview } from '../powderizer/PowderMixBagPreview';
import { PowderMixVisualization } from '../powderizer/PowderMixVisualization';

type PowderMixControlsProps = {
  config: BuilderConfig;
  products: readonly Product[];
  bagSizes: readonly (250 | 500 | 1000)[];
  finenessValues: readonly ('coarse' | 'standard' | 'fine')[];
  labelMaxGraphemes: number;
  bagColourSchemes: readonly PowderMixBagColourScheme[];
  priceVersion: string;
  usageLabel: string | null;
  onPercentageChange: (productId: string, percentage: number) => void;
  onRemove: (productId: string) => void;
  onEqualSplit: () => void;
  onBagSizeChange: (value: BuilderConfig['bagSizeGrams']) => void;
  onFinenessChange: (value: BuilderConfig['fineness']) => void;
  onLabelChange: (value: string) => void;
  onBagColourChange: (value: PowderMixBagColourScheme) => void;
};

export function PowderMixControls({
  config,
  products,
  bagSizes,
  finenessValues,
  labelMaxGraphemes,
  bagColourSchemes,
  priceVersion,
  usageLabel,
  onPercentageChange,
  onRemove,
  onEqualSplit,
  onBagSizeChange,
  onFinenessChange,
  onLabelChange,
  onBagColourChange,
}: PowderMixControlsProps) {
  return (
    <>
      <div className="space-y-5">
        <RatioEditor
          components={config.components}
          products={products}
          onPercentageChange={onPercentageChange}
          onRemove={onRemove}
          onEqualSplit={onEqualSplit}
        />
        <MixOptions
          config={config}
          bagSizes={bagSizes as (250 | 500 | 1000)[]}
          finenessValues={finenessValues as ('coarse' | 'standard' | 'fine')[]}
          labelMaxGraphemes={labelMaxGraphemes}
          onBagSizeChange={onBagSizeChange}
          onFinenessChange={onFinenessChange}
          onLabelChange={onLabelChange}
        />
        <BagColourSchemePicker
          schemes={bagColourSchemes}
          value={config.bagColourScheme}
          onChange={onBagColourChange}
        />
        <PowderMixVisualization components={config.components} products={products} />
      </div>
      <aside className="space-y-5 lg:sticky lg:top-24">
        <PowderMixBagPreview config={config} priceVersion={priceVersion} usageLabel={usageLabel} />
      </aside>
    </>
  );
}
