import type { CountryProfile } from './types.js';

export const UK_COUNTRY_PROFILE = {
  blockedCategories: [],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^(?:GIR 0AA|[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})$',
    label: 'Postcode',
    example: 'SW1A 1AA',
  },
  deliveryCountryCodes: ['GB'],
  timeZone: 'Europe/London',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
