import type { CountryProfile } from './types.js';

export const FR_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^[0-9]{5}$',
    label: 'Code postal',
    example: '75001',
  },
  deliveryCountryCodes: ['FR'],
  timeZone: 'Europe/Paris',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
