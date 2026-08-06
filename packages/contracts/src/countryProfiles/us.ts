import type { CountryProfile } from './types.js';

export const US_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^[0-9]{5}$',
    label: 'ZIP',
    example: '10001',
  },
  deliveryCountryCodes: ['US'],
  timeZone: 'America/New_York',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
