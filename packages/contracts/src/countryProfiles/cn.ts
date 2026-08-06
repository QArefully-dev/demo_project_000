import type { CountryProfile } from './types.js';

export const CN_COUNTRY_PROFILE = {
  blockedCategories: ['Sports Nutrition'],
  blockedProductSlugs: [],
  postcode: {
    pattern: '^[0-9]{6}$',
    label: '邮政编码',
    example: '100000',
  },
  deliveryCountryCodes: ['CN'],
  timeZone: 'Asia/Shanghai',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
