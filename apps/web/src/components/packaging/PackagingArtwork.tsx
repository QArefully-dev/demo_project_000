import { BagArtwork, type BagArtworkPaint } from '@/components/BagArtwork';

import { KegArtwork } from './KegArtwork';
import { KraftSackArtwork } from './KraftSackArtwork';
import type { PackagingSpec } from './packagingSpec';
import { WovenSackArtwork } from './WovenSackArtwork';

export interface PackagingArtworkProps {
  name: string;
  spec: PackagingSpec;
  mark: string;
  /** Food-bag vessel only: printed net-quantity line. Ignored by the other three vessels. */
  quantity?: string;
  /** Food-bag vessel only: printed batch code. Ignored by the other three vessels. */
  batchCode?: string;
  accent?: string;
  powderAccent?: string;
  paint?: BagArtworkPaint;
  consumptionLabel: string | null;
  ariaLabel?: string;
  className?: string;
}

/**
 * Dispatches on `spec.vessel` to the approved packaging renderer. `food-bag` delegates to the
 * existing locked `BagArtwork`, printing the caller-supplied `quantity`/`batchCode` (the food
 * path's own colour/quantity source, per `product.packaging`) rather than the non-food `spec`
 * fields; the three non-food vessels render their own approved geometry driven entirely by `spec`.
 */
export function PackagingArtwork({
  name,
  spec,
  mark,
  quantity,
  batchCode,
  accent,
  powderAccent,
  paint,
  consumptionLabel,
  ariaLabel,
  className,
}: PackagingArtworkProps) {
  switch (spec.vessel) {
    case 'kraft-sack':
      return (
        <KraftSackArtwork name={name} spec={spec} ariaLabel={ariaLabel} className={className} />
      );
    case 'woven-sack':
      return (
        <WovenSackArtwork name={name} spec={spec} ariaLabel={ariaLabel} className={className} />
      );
    case 'keg':
      return <KegArtwork name={name} spec={spec} ariaLabel={ariaLabel} className={className} />;
    case 'food-bag':
    default:
      return (
        <BagArtwork
          name={name}
          category={spec.sub}
          quantity={quantity ?? spec.netWeight ?? ''}
          batchCode={batchCode ?? spec.lot}
          mark={mark}
          accent={accent}
          powderAccent={powderAccent}
          paint={paint}
          consumptionLabel={consumptionLabel}
          ariaLabel={ariaLabel}
          className={className}
        />
      );
  }
}
