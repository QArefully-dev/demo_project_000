import type { CountryCode } from '../address.js';

/** Language tags used by the checked-in country display profiles. */
export type CountryLanguage = 'en' | 'zh' | 'pl' | 'es' | 'de' | 'fr';

/** BCP-47 number/date locales used by the checked-in country display profiles. */
export type CountryLocale = 'en-GB' | 'en-US' | 'zh-CN' | 'pl-PL' | 'es-ES' | 'de-DE' | 'fr-FR';

/** ISO-4217 currencies used for display-only conversion. */
export type CountryDisplayCurrency = 'GBP' | 'USD' | 'CNY' | 'PLN' | 'EUR';

/** Display-only rate: target minor units per GBP penny. */
export interface CountryExchangeRate {
  readonly numerator: number;
  readonly denominator: number;
}

/** Stable lookup key for country-owned translated copy. */
export type CountryMessageKey = string;

/** A country-specific postcode rule shared without losing its transport-safe representation. */
export interface CountryPostcodeRule {
  /** Anchored string pattern used to validate postcodes for the identity country. */
  readonly pattern: string;
  /** Stable lookup key for the translated postcode field label. */
  readonly labelMessageKey: CountryMessageKey;
  /** Valid country-specific example used as the postcode input hint. */
  readonly example: string;
}

/** Checked-in display, business, and delivery settings for one identity country. */
export interface CountryProfile {
  /** Language used for translated shop-authored copy. */
  readonly language: CountryLanguage;
  /** BCP-47 locale used for locale-aware number presentation. */
  readonly numberLocale: CountryLocale;
  /** BCP-47 locale used for locale-aware date presentation. */
  readonly dateLocale: CountryLocale;
  /** Currency used only for buyer-facing display conversion. */
  readonly displayCurrency: CountryDisplayCurrency;
  /** Positive integer ratio of target minor units per GBP penny. */
  readonly exchangeRate: CountryExchangeRate;
  /** Live catalogue categories unavailable to buyers in this identity country. */
  readonly blockedCategories: readonly string[];
  /** Individual live product slugs unavailable to buyers in this identity country. */
  readonly blockedProductSlugs: readonly string[];
  /** Stable lookup key for the translated country notice, when a banner is present. */
  readonly bannerMessageKey?: CountryMessageKey;
  /** Country-specific postcode validation and field presentation. */
  readonly postcode: CountryPostcodeRule;
  /**
   * ISO postal destination codes served for this identity country. This is the only bridge
   * between `Country` and `PostalAddress.countryCode`; neither axis may be derived from the other.
   */
  readonly deliveryCountryCodes: readonly CountryCode[];
  /** IANA time-zone name used to determine the buyer's local delivery cut-off day. */
  readonly timeZone: string;
  /** Local civil hour, from 0 through 23, at which delivery lead-time calculation rolls forward. */
  readonly deliveryCutoffHour: number;
}
