import { Type, type Static } from '@sinclair/typebox';
import type { CountryCode } from '../address.js';

/** Stage-2 country banner copy exposed to the buyer UI. */
export const CountryBanner = Type.String({ minLength: 1, maxLength: 240 });
export type CountryBanner = Static<typeof CountryBanner>;

/** A country-specific postcode rule shared without losing its transport-safe representation. */
export interface CountryPostcodeRule {
  /** Anchored string pattern used to validate postcodes for the identity country. */
  readonly pattern: string;
  /** Stage-2 field label shown beside the postcode input. */
  readonly label: string;
  /** Valid country-specific example used as the postcode input hint. */
  readonly example: string;
}

/** Checked-in stage-2 business and delivery settings for one identity country. */
export interface CountryProfile {
  /** Live catalogue categories unavailable to buyers in this identity country. */
  readonly blockedCategories: readonly string[];
  /** Individual live product slugs unavailable to buyers in this identity country. */
  readonly blockedProductSlugs: readonly string[];
  /** Optional English buyer-facing country notice; translation is deferred beyond stage 2. */
  readonly banner?: CountryBanner;
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
