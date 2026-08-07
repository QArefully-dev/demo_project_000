import type { CountryProfile } from './types.js';

export const CN_COUNTRY_PROFILE = {
  language: 'zh',
  numberLocale: 'zh-CN',
  dateLocale: 'zh-CN',
  displayCurrency: 'CNY',
  exchangeRate: { numerator: 9, denominator: 1 },
  blockedCategories: ['Sports Nutrition'],
  blockedProductSlugs: [],
  bannerMessageKey: undefined,
  postcode: {
    pattern: '^[0-9]{6}$',
    labelMessageKey: 'postcode.label',
    example: '100000',
  },
  deliveryCountryCodes: ['CN'],
  timeZone: 'Asia/Shanghai',
  deliveryCutoffHour: 16,
} as const satisfies CountryProfile;
