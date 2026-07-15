import type { PowderMixBagColourScheme } from '@shop/contracts/powderizer';

import type { BagArtworkPaint } from './BagArtwork';

export type PowderMixBagSchemePresentation = {
  label: string;
  swatch: string;
  paint: BagArtworkPaint;
};

export const POWDER_MIX_BAG_SCHEME_PRESENTATION: Record<
  PowderMixBagColourScheme,
  PowderMixBagSchemePresentation
> = {
  'ultraviolet-cyan': {
    label: 'Ultraviolet cyan',
    swatch: 'linear-gradient(135deg, #9b5de5, #00d9ff)',
    paint: { kind: 'linear-gradient', colors: ['#9b5de5', '#00d9ff'] },
  },
  'solar-flare': {
    label: 'Solar flare',
    swatch: 'linear-gradient(135deg, #ff7b00, #ffe66d)',
    paint: { kind: 'linear-gradient', colors: ['#ff7b00', '#ffe66d'] },
  },
  'deep-space': {
    label: 'Deep space',
    swatch: 'linear-gradient(135deg, #071952, #37b7c3)',
    paint: { kind: 'linear-gradient', colors: ['#071952', '#37b7c3'] },
  },
  'acid-lilac': {
    label: 'Acid lilac',
    swatch: 'linear-gradient(135deg, #ccff00, #b65cff)',
    paint: { kind: 'linear-gradient', colors: ['#ccff00', '#b65cff'] },
  },
  'monochrome-glitch': {
    label: 'Monochrome glitch',
    swatch: 'linear-gradient(135deg, #141414, #e9e9e9)',
    paint: { kind: 'linear-gradient', colors: ['#141414', '#e9e9e9'] },
  },
};

export function powderMixBagSchemePresentation(scheme: PowderMixBagColourScheme) {
  return POWDER_MIX_BAG_SCHEME_PRESENTATION[scheme];
}
