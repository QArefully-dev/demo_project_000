import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_COUNTRIES, type Country } from '../src/country.js';
import {
  COUNTRY_PROFILES,
  countryProfile,
  type CountryProfile,
} from '../src/countryProfiles/index.js';

const foreignExampleCountry = {
  UK: 'FR',
  US: 'CN',
  CN: 'PL',
  PL: 'DE',
  ES: 'UK',
  DE: 'PL',
  FR: 'UK',
} as const satisfies Readonly<Record<Country, Country>>;

void test('profiles are total over supported countries', () => {
  assert.deepStrictEqual(Object.keys(COUNTRY_PROFILES), SUPPORTED_COUNTRIES);

  for (const country of SUPPORTED_COUNTRIES) {
    const profile: CountryProfile = countryProfile(country);
    assert.strictEqual(profile, COUNTRY_PROFILES[country]);
  }
});

void test('postcode patterns are anchored and country-specific', () => {
  for (const country of SUPPORTED_COUNTRIES) {
    const profile = countryProfile(country);
    const pattern = new RegExp(profile.postcode.pattern);
    const neighbourExample = countryProfile(foreignExampleCountry[country]).postcode.example;

    assert.equal(profile.postcode.pattern.startsWith('^'), true, `${country} pattern start`);
    assert.equal(profile.postcode.pattern.endsWith('$'), true, `${country} pattern end`);
    assert.equal(pattern.test(profile.postcode.example), true, `${country} own example`);
    assert.equal(pattern.test(neighbourExample), false, `${country} foreign example`);
  }
});

void test('delivery rules have a destination and a valid local cut-off hour', () => {
  for (const country of SUPPORTED_COUNTRIES) {
    const profile = countryProfile(country);
    assert.ok(profile.deliveryCountryCodes.length > 0, `${country} delivery countries`);
    assert.ok(profile.deliveryCutoffHour >= 0, `${country} cut-off lower bound`);
    assert.ok(profile.deliveryCutoffHour <= 23, `${country} cut-off upper bound`);
  }
});

void test('only ES carries a banner', () => {
  const countriesWithBanner = SUPPORTED_COUNTRIES.filter(
    (country) => countryProfile(country).banner !== undefined,
  );
  assert.deepStrictEqual(countriesWithBanner, ['ES']);
});

void test('exactly one country blocks one live category', () => {
  const categoryBlocks = SUPPORTED_COUNTRIES.flatMap((country) =>
    countryProfile(country).blockedCategories.map((category) => ({ country, category })),
  );
  assert.deepStrictEqual(categoryBlocks, [{ country: 'CN', category: 'Sports Nutrition' }]);
});
