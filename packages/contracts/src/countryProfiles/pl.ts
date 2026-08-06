import type { CountryProfile } from './types.js';

export const PL_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^[0-9]{2}-[0-9]{3}$',
    label: 'Kod pocztowy',
    example: '00-001',
  },
  deliveryCountryCodes: ['PL'],
  timeZone: 'Europe/Warsaw',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
