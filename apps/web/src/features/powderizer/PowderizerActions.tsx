import type { Product } from '@shop/contracts/products';
import type { PowderMixBagColourScheme } from '@shop/contracts/powderizer';
import { Button } from '@/components/ui/button';
import {
  chaosMixBuilderConfig,
  isChaosPoolFeasible,
  randomizeBuilderConfig,
  type RandomSource,
} from './powderizerRandom';
import type { BuilderConfig } from './powderizerState';
import { cryptoRandom } from './usePowderizerController';

type PowderizerActionsProps = {
  activeProducts: readonly Product[];
  products: readonly Product[];
  baseConfig: BuilderConfig;
  bagSizes: readonly BuilderConfig['bagSizeGrams'][];
  finenessValues: readonly BuilderConfig['fineness'][];
  bagColourSchemes: readonly PowderMixBagColourScheme[];
  onConfigGenerated: (config: BuilderConfig) => void;
  random?: RandomSource;
};

function asRandomProduct(products: readonly Product[]) {
  return products.map(({ id, category, priceCents }) => ({ id, category, priceCents }));
}

export function PowderizerActions({
  activeProducts,
  products,
  baseConfig,
  bagSizes,
  finenessValues,
  bagColourSchemes,
  onConfigGenerated,
  random = cryptoRandom,
}: PowderizerActionsProps) {
  const randomPool = asRandomProduct(activeProducts);
  const chaosPool = asRandomProduct(products);
  const randomizeDisabled = randomPool.length < 2;
  const chaosDisabled = !isChaosPoolFeasible(chaosPool);
  const options = { baseConfig, bagSizes, finenessValues, bagColourSchemes, random };

  return (
    <div className="flex flex-wrap gap-3" aria-label="Mix generation actions">
      <div>
        <Button
          type="button"
          disabled={randomizeDisabled}
          onClick={() => onConfigGenerated(randomizeBuilderConfig(randomPool, options))}
        >
          Randomize
        </Button>
        {randomizeDisabled && (
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a category with at least two powders.
          </p>
        )}
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={chaosDisabled}
          onClick={() => onConfigGenerated(chaosMixBuilderConfig(chaosPool, options))}
        >
          Chaos Mix
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          Uses five powders from the full catalog.
        </p>
      </div>
    </div>
  );
}
