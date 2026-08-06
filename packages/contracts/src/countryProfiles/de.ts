import type { CountryProfile } from './types.js';

export const DE_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^[0-9]{5}$',
    label: 'Postleitzahl',
    example: '10115',
  },
  deliveryCountryCodes: ['DE'],
  timeZone: 'Europe/Berlin',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
