import type { Country } from '@shop/contracts/country';
import { apiErrors } from './apiErrors.js';
import {
  defineMessages,
  type CountryMessageSet,
  type MessageCatalog,
  type MessageParams,
} from './defineMessages.js';
import { translateUnchecked } from '../translate.js';

/** Shop-authored copy for product, lot, and promotion administration. */
const text = (
  UK: string,
  DE: string,
  overrides: Partial<Record<'US' | 'CN' | 'PL' | 'ES' | 'FR', string>> = {},
): CountryMessageSet => ({
  UK,
  US: overrides.US ?? UK,
  CN: overrides.CN ?? UK,
  PL: overrides.PL ?? UK,
  ES: overrides.ES ?? UK,
  DE,
  FR: overrides.FR ?? UK,
});

export const adminCatalogMessages = defineMessages({
  // Shared controls and request states.
  'adminCatalog.save': text('Save', 'Speichern'),
  'adminCatalog.saving': text('Saving…', 'Wird gespeichert…'),
  'adminCatalog.cancel': text('Cancel', 'Abbrechen'),
  'adminCatalog.confirmRetire': text('Confirm retire', 'Ausmustern bestätigen'),
  'adminCatalog.confirmRetirement': text('Confirm retirement of this lot.', 'Bestätigen Sie die Ausmusterung dieser Charge.'),
  'adminCatalog.requestFailed': text('Request failed.', 'Anfrage fehlgeschlagen.'),
  'adminCatalog.clearanceDatesRequired': text(
    'Clearance start and end dates are required.',
    'Start- und Enddatum des Abverkaufs sind erforderlich.',
  ),

  // Product catalogue administration.
  'adminCatalog.products.heading': text('Products', 'Produkte'),
  'adminCatalog.products.description': text(
    'Create, edit, and retire catalogue products.',
    'Katalogprodukte erstellen, bearbeiten und ausmustern.',
  ),
  'adminCatalog.products.includeRetired': text('Include retired', 'Ausgemusterte einschließen'),
  'adminCatalog.products.new': text('New product', 'Neues Produkt'),
  'adminCatalog.products.edit': text('Edit {name}', '{name} bearbeiten'),
  'adminCatalog.products.name': text('Name', 'Name'),
  'adminCatalog.products.descriptionLabel': text('Description', 'Beschreibung'),
  'adminCatalog.products.pricePence': text('Price (GBP pence)', 'Preis (GBP-Pence)'),
  'adminCatalog.products.stock': text('Stock', 'Bestand'),
  'adminCatalog.products.slug': text('Slug', 'Slug'),
  'adminCatalog.products.category': text('Category', 'Kategorie'),
  'adminCatalog.products.classification': text('Classification', 'Klassifizierung'),
  'adminCatalog.products.mixingGroup': text('Mixing group', 'Mischgruppe'),
  'adminCatalog.products.none': text('None', 'Keine'),
  'adminCatalog.products.active': text('Active', 'Aktiv'),
  'adminCatalog.products.retired': text('Retired', 'Ausgemustert'),
  'adminCatalog.products.empty': text('No products found.', 'Keine Produkte gefunden.'),
  'adminCatalog.products.save': text('Save product', 'Produkt speichern'),
  'adminCatalog.products.retire': text('Retire product', 'Produkt ausmustern'),
  'adminCatalog.products.retiringNotice': text(
    'Retiring hides this product. Confirm to continue.',
    'Das Ausmustern blendet dieses Produkt aus. Bestätigen Sie, um fortzufahren.',
  ),

  // Variant/lot administration.
  'adminCatalog.lots.heading': text('Variants and lots', 'Varianten und Chargen'),
  'adminCatalog.lots.description': text(
    'Manage purchasable lots and their clearance schedules.',
    'Kaufbare Chargen und ihre Abverkaufszeiträume verwalten.',
  ),
  'adminCatalog.lots.productId': text('Product ID', 'Produkt-ID'),
  'adminCatalog.lots.new': text('New lot', 'Neue Charge'),
  'adminCatalog.lots.edit': text('Edit {name}', '{name} bearbeiten'),
  'adminCatalog.lots.empty': text('No lots found.', 'Keine Chargen gefunden.'),
  'adminCatalog.lots.sku': text('SKU', 'SKU'),
  'adminCatalog.lots.label': text('Label', 'Bezeichnung'),
  'adminCatalog.lots.lotLabelAria': text('Lot label', 'Chargenbezeichnung'),
  'adminCatalog.lots.weightGrams': text('Weight (g)', 'Gewicht (g)'),
  'adminCatalog.lots.pricePence': text('Price (GBP pence)', 'Preis (GBP-Pence)'),
  'adminCatalog.lots.stock': text('Stock', 'Bestand'),
  'adminCatalog.lots.moqSacks': text('MOQ sacks', 'Mindestmenge Säcke'),
  'adminCatalog.lots.sortOrder': text('Sort order', 'Sortierreihenfolge'),
  'adminCatalog.lots.backorderable': text('Backorderable', 'Nachbestellbar'),
  'adminCatalog.lots.backorderLeadDays': text('Backorder lead days', 'Nachbestellfrist (Tage)'),
  'adminCatalog.lots.deliveryClass': text('Delivery class', 'Lieferklasse'),
  'adminCatalog.lots.freight': text('Freight', 'Fracht'),
  'adminCatalog.lots.parcel': text('Parcel', 'Paket'),
  'adminCatalog.lots.save': text('Save lot', 'Charge speichern'),
  'adminCatalog.lots.clearance': text('Clearance', 'Abverkauf'),
  'adminCatalog.lots.enableClearance': text('Enable clearance', 'Abverkauf aktivieren'),
  'adminCatalog.lots.clearancePricePence': text(
    'Clearance price (GBP pence)',
    'Abverkaufspreis (GBP-Pence)',
  ),
  'adminCatalog.lots.startsAt': text('Starts at', 'Beginnt am'),
  'adminCatalog.lots.endsAt': text('Ends at', 'Endet am'),
  'adminCatalog.lots.saveClearance': text('Save clearance', 'Abverkauf speichern'),
  'adminCatalog.lots.retire': text('Retire lot', 'Charge ausmustern'),

  // Promotion administration.
  'adminCatalog.promos.heading': text('Promotions', 'Aktionen'),
  'adminCatalog.promos.description': text(
    'Create and maintain trade promotion codes.',
    'Handelsaktionscodes erstellen und pflegen.',
  ),
  'adminCatalog.promos.new': text('New promotion', 'Neue Aktion'),
  'adminCatalog.promos.edit': text('Edit {code}', '{code} bearbeiten'),
  'adminCatalog.promos.empty': text('No promotions found.', 'Keine Aktionen gefunden.'),
  'adminCatalog.promos.active': text('Active', 'Aktiv'),
  'adminCatalog.promos.inactive': text('Inactive', 'Inaktiv'),
  'adminCatalog.promos.code': text('Code', 'Code'),
  'adminCatalog.promos.kind': text('Kind', 'Art'),
  'adminCatalog.promos.percentage': text('Percentage', 'Prozentual'),
  'adminCatalog.promos.fixedAmount': text('Fixed amount', 'Fester Betrag'),
  'adminCatalog.promos.discountPercent': text('Discount percent', 'Rabatt in Prozent'),
  'adminCatalog.promos.minimumItems': text('Minimum items', 'Mindestanzahl Artikel'),
  'adminCatalog.promos.fixedAmountPence': text(
    'Fixed amount (GBP pence)',
    'Fester Betrag (GBP-Pence)',
  ),
  'adminCatalog.promos.minimumSubtotalPence': text(
    'Minimum subtotal (GBP pence)',
    'Mindestzwischensumme (GBP-Pence)',
  ),
  'adminCatalog.promos.categoryScope': text('Category scope', 'Kategorieumfang'),
  'adminCatalog.promos.allCategories': text('All categories', 'Alle Kategorien'),
  'adminCatalog.promos.countryTargeting': text('Country targeting', 'Länderzielgruppe'),
  'adminCatalog.promos.countryTargetingHint': text(
    'Leave empty to apply to all countries.',
    'Leer lassen, um alle Länder einzuschließen.',
  ),
  'adminCatalog.promos.startsAt': text('Starts at', 'Beginnt am'),
  'adminCatalog.promos.endsAt': text('Ends at', 'Endet am'),
  'adminCatalog.promos.maximumRedemptions': text('Maximum redemptions', 'Maximale Einlösungen'),
  'adminCatalog.promos.perUserLimit': text('Per-user limit', 'Limit pro Benutzer'),
  'adminCatalog.promos.save': text('Save promotion', 'Aktion speichern'),
  'adminCatalog.promos.deactivateQuestion': text(
    'Deactivate this promotion?',
    'Diese Aktion deaktivieren?',
  ),
  'adminCatalog.promos.confirmDeactivate': text(
    'Confirm deactivate',
    'Deaktivierung bestätigen',
  ),
  'adminCatalog.promos.deactivate': text('Deactivate promotion', 'Aktion deaktivieren'),
});

export type AdminCatalogMessageKey = keyof typeof adminCatalogMessages & string;
export const ADMIN_CATALOG_MESSAGES = adminCatalogMessages;

/** Preserve the existing `datetime-local` ISO write contract while centralising input display. */
export function adminDateTimeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '';
}

function messageParams(meta: unknown): MessageParams {
  if (meta === null || typeof meta !== 'object') return {};
  const params: Record<string, string | number | bigint> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      params[key] = value;
    }
  }
  return params;
}

/** Localize coded API errors while preserving legacy test/service prose for uncoded `Error`s. */
export function localizeAdminError(
  error: unknown,
  country: Country,
  fallback: AdminCatalogMessageKey = 'adminCatalog.requestFailed',
): string {
  if (error !== null && typeof error === 'object') {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === 'string' && candidate in apiErrors) {
      try {
        return translateUnchecked(
          apiErrors as MessageCatalog,
          country,
          candidate,
          messageParams((error as { meta?: unknown }).meta),
        );
      } catch {
        // Fall through to feature-safe fallback when metadata is stale or incomplete.
      }
    }
    // ApiError instances expose status/response; do not surface server prose in this branch.
    if ('status' in error && 'response' in error) {
      return translateUnchecked(adminCatalogMessages, country, fallback);
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return translateUnchecked(adminCatalogMessages, country, fallback);
}

export type AdminCatalogMessages = typeof adminCatalogMessages;
