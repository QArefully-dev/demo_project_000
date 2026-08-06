import type { CountryProfile } from './types.js';

export const ES_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  banner: 'Ordering for Spain: availability and delivery options reflect local requirements.',
  postcode: {
    pattern: '^[0-9]{5}$',
    label: 'Código postal',
    example: '28013',
  },
  deliveryCountryCodes: ['ES'],
  timeZone: 'Europe/Madrid',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
