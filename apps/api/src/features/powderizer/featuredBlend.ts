import {
  DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  type PowderMixConfigInput,
} from '@shop/contracts/powderizer';

export interface FeaturedBlend {
  id: number;
  name: string;
  description: string;
  config: PowderMixConfigInput;
  imageSetId: string;
  category: string;
}

export const FEATURED_POWDER_BLEND: FeaturedBlend = {
  id: 1,
  name: 'Pantry Starter',
  description:
    'A versatile blend of all-purpose flour and powdered sugar — ready for baking, dusting, and everyday kitchen projects.',
  config: {
    components: [
      { productId: '1', percentage: 50 },
      { productId: '2', percentage: 50 },
    ],
    bagSizeGrams: 500,
    fineness: 'standard',
    bagColourScheme: DEFAULT_POWDER_MIX_BAG_COLOUR_SCHEME,
  },
  imageSetId: 'all-purpose-flour',
  category: 'Baking & Pantry',
};
