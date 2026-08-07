import { PUBLIC_ERROR_CODES, type PublicErrorCode } from '@shop/contracts/public-errors';
import { type Country } from '@shop/contracts/country';
import {
  defineMessages,
  type CountryMessageSet,
  type MessageCatalog,
  type MessageTemplate,
} from './defineMessages.js';

/*
 * API copy is keyed by the transport code rather than by a route. This keeps identity stable while
 * routes migrate independently and lets the client render a safe fallback in the selected country.
 */
const ENGLISH_OVERRIDES: Partial<Record<PublicErrorCode, string>> = {
  REQUEST_INVALID: 'The request is invalid.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  UNAUTHORIZED: 'You need to sign in to continue.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The request conflicts with current data.',
  RATE_LIMITED: 'Too many requests. Try again in {retryAfterSeconds} seconds.',
  AUTH_REQUIRED: 'You need to sign in to use this promotion.',
  AUTH_SUSPENDED: 'This account is suspended.',
  EMAIL_EXISTS: 'An account already exists for these details.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_DISPLAY_NAME: 'Enter a valid display name.',
  WEAK_PASSWORD: 'Choose a stronger password.',
  INVALID_CURRENT: 'The current password is incorrect.',
  SAME_PASSWORD: 'Choose a different password.',
  INVALID_TOKEN: 'The token is invalid or has expired.',
  EXPIRED: 'This link has expired.',
  ALREADY_USED: 'This link has already been used.',
  OWNS_COMPANY: 'Transfer company ownership before deleting this account.',
  CANNOT_REVOKE_CURRENT: 'The current session cannot be revoked here.',
  SESSION_NOT_FOUND: 'The session was not found.',
  LAST_ADMIN: 'At least one administrator must remain.',
  INVALID_POSTCODE: 'Enter a valid postcode for this country.',
  DELIVERY_COUNTRY_NOT_ALLOWED: 'Delivery is only available within your country.',
  INVALID_QUANTITY: 'Enter a valid quantity.',
  BELOW_MOQ: 'Quantity must be at least {minQuantity}.',
  BLOCKED_IN_COUNTRY: 'This item is not available in your country.',
  VARIANT_RETIRED: 'This item is no longer available.',
  BLEND_UNAVAILABLE: 'This blend is no longer available.',
  CUSTOM_BLEND_INVALID: 'The custom blend is no longer valid.',
  CART_NOT_FOUND: 'The cart was not found.',
  CART_EMPTY: 'Add an item before continuing.',
  CART_RESERVED: 'The cart is currently reserved for checkout.',
  BUNDLE_NOT_FOUND: 'The bundle was not found.',
  BUNDLE_UNAVAILABLE: 'One or more bundle components are unavailable.',
  NO_INPUT_LINES: 'Add at least one line.',
  TOO_MANY_LINES: 'Too many lines were submitted.',
  SKU_NOT_FOUND: 'The SKU was not found.',
  ORDER_NOT_FOUND: 'The order was not found.',
  ORDER_FORBIDDEN: 'The order was not found.',
  INVALID_ALLOCATION: 'Shipment allocation is invalid.',
  INVALID_TRANSITION: 'That status transition is not allowed.',
  CANCELLATION_NOT_ALLOWED: 'This order can no longer be cancelled.',
  STALE_VERSION: 'The record has changed. Refresh and try again.',
  IDEMPOTENCY_CONFLICT: 'This idempotency key was used for a different request.',
  IDEMPOTENT_CONFLICT: 'This payment was submitted with different data.',
  IDEMPOTENT_IN_PROGRESS: 'This payment is already being processed.',
  TRACKING_NOT_ALLOWED: 'Tracking is not available for this shipment yet.',
  OUTSTANDING_BACKORDER: 'The order has outstanding backordered items.',
  PROMO_INVALID: 'The promotion code is invalid or ineligible.',
  PROMO_NOT_FOUND: 'The promotion code was not found.',
  PROMO_EXPIRED: 'This promotion has expired.',
  PROMO_NOT_STARTED: 'This promotion is not active yet.',
  PROMO_MIN_ITEMS: 'Add more qualifying items to use this promotion.',
  PROMO_MIN_SUBTOTAL: 'The qualifying subtotal must be at least {minSubtotalCents}.',
  PROMO_USAGE_LIMIT: 'This promotion has reached its usage limit.',
  PROMO_CATEGORY_MISMATCH: 'This promotion does not apply to these items.',
  CARD_INVALID: 'The card details are invalid.',
  CARD_DECLINED: 'The card was declined.',
  GATEWAY_TIMEOUT: 'The payment service timed out. Try again.',
  DECLINED: 'The payment was declined.',
  TIMEOUT: 'The payment service timed out. Try again.',
  CHECKOUT_FAILED: 'Checkout could not be completed.',
  RESERVATION_EXPIRED: 'Your reservation expired at {reservationExpiresAt}.',
  INSUFFICIENT_STOCK: 'There is not enough stock for this order.',
  DELIVERY_SITE_NOT_FOUND: 'The selected delivery site was not found.',
  BILLING_ENTITY_INVALID: 'The selected billing details are not available.',
  DELIVERY_SLOT_UNAVAILABLE: 'That delivery slot is unavailable. Earliest date: {earliestDate}.',
  PENDING_APPROVAL: 'Approval is required (request {approvalRequestId}).',
  APPROVAL_REJECTED: 'The approval request was rejected.',
  APPROVAL_EXPIRED: 'The approval request expired.',
  APPROVAL_TOTAL_DRIFT: 'The order total changed while approval was pending.',
  APPROVAL_NOT_FOUND: 'The approval request was not found.',
  NOT_APPROVER: 'Approver access is required.',
  APPROVAL_ALREADY_RESOLVED: 'The approval request has already been resolved.',
  RETURN_NOT_FOUND: 'The return request was not found.',
  RETURN_NOT_ELIGIBLE: 'This order is not eligible for a return.',
  RETURN_WINDOW_EXPIRED: 'The return window has expired.',
  QUANTITY_UNAVAILABLE: 'That quantity is no longer available to return.',
  PAYMENT_NOT_REFUNDABLE: 'This payment cannot be refunded.',
  PAYMENT_ORDER_MISMATCH: 'The payment does not belong to this order.',
  RETURN_DATA_CORRUPT: 'The return request could not be read.',
  TOO_MANY_REPORTS: 'You have submitted too many reports.',
  SUBSCRIPTION_NOT_FOUND: 'The subscription was not found.',
  SUBSCRIPTION_LIMIT_REACHED: 'You have reached the subscription limit.',
  ALREADY_SUBSCRIBED: 'You are already subscribed.',
  SOURCE_NOT_FOUND: 'The source order was not found.',
  INACTIVE: 'This schedule is inactive.',
  LIST_NOT_FOUND: 'The saved list was not found.',
  ITEM_NOT_FOUND: 'The saved-list item was not found.',
  NAME_INVALID: 'Enter a valid name.',
  NAME_TAKEN: 'That name is already in use.',
  LIST_LIMIT_REACHED: 'You have reached the saved-list limit.',
  ITEM_LIMIT_REACHED: 'You have reached the item limit for this list.',
  DEFAULT_LIST_IMMUTABLE: 'The default list cannot be changed this way.',
  INVALID_INPUT: 'The supplied values are invalid.',
  INVALID_QUERY: 'The query is invalid.',
  INVALID_MIXING_GROUP: 'The mixing group is invalid.',
  INVALID_VARIANT: 'The variant is invalid.',
  INVALID_CLEARANCE: 'The clearance window is invalid.',
  DUPLICATE_SLUG: 'That slug is already in use.',
  VARIANT_NO_ACTIVE_REPLACEMENT: 'An active replacement variant is required.',
  DUPLICATE: 'A record with these details already exists.',
  ACTIVE_RESERVATIONS: 'The record has active reservations.',
  INVALID_REFUND: 'The refund request is invalid.',
  JOB_NOT_FOUND: 'The job was not found.',
  JOB_NOT_RETRYABLE: 'This job cannot be retried.',
  WEBHOOK_NOT_FOUND: 'The webhook was not found.',
  INVALID_SIGNATURE: 'The signature is invalid.',
  INVALID_PAYLOAD: 'The payload is invalid.',
  IDEMPOTENCY_KEY_REUSED: 'This idempotency key has already been used.',
  INVENTORY_CORRUPTION: 'Inventory could not be read safely.',
};

const LANGUAGE_DEFAULTS: Record<Exclude<Country, 'UK' | 'US'>, string> = {
  CN: '请求无法处理，请重试。',
  PL: 'Nie można przetworzyć żądania. Spróbuj ponownie.',
  ES: 'No se pudo procesar la solicitud. Inténtalo de nuevo.',
  DE: 'Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.',
  FR: 'La requête n’a pas pu être traitée. Veuillez réessayer.',
};

const LOCALIZED_OVERRIDES: Partial<Record<Country, Partial<Record<PublicErrorCode, string>>>> = {
  CN: {
    REQUEST_INVALID: '请求无效。',
    INTERNAL_ERROR: '出了点问题，请重试。',
    UNAUTHORIZED: '请先登录。',
    FORBIDDEN: '您无权执行此操作。',
    NOT_FOUND: '未找到请求的资源。',
    RATE_LIMITED: '请求过多，请在 {retryAfterSeconds} 秒后重试。',
    BELOW_MOQ: '数量必须至少为 {minQuantity}。',
    BLOCKED_IN_COUNTRY: '此商品在您所在的国家/地区不可用。',
    CART_EMPTY: '请先添加商品。',
    RESERVATION_EXPIRED: '您的预留已于 {reservationExpiresAt} 过期。',
    DELIVERY_SLOT_UNAVAILABLE: '配送时段不可用。最早日期：{earliestDate}。',
    PENDING_APPROVAL: '需要审批（请求 {approvalRequestId}）。',
    PROMO_MIN_SUBTOTAL: '符合条件的商品小计必须至少为 {minSubtotalCents}。',
  },
  PL: {
    REQUEST_INVALID: 'Żądanie jest nieprawidłowe.',
    INTERNAL_ERROR: 'Coś poszło nie tak. Spróbuj ponownie.',
    UNAUTHORIZED: 'Zaloguj się, aby kontynuować.',
    FORBIDDEN: 'Nie masz uprawnień do wykonania tej czynności.',
    NOT_FOUND: 'Nie znaleziono żądanego zasobu.',
    RATE_LIMITED: 'Zbyt wiele żądań. Spróbuj ponownie za {retryAfterSeconds} s.',
    BELOW_MOQ: 'Ilość musi wynosić co najmniej {minQuantity}.',
    BLOCKED_IN_COUNTRY: 'Ten produkt nie jest dostępny w Twoim kraju.',
    CART_EMPTY: 'Dodaj produkt przed kontynuowaniem.',
    RESERVATION_EXPIRED: 'Rezerwacja wygasła o {reservationExpiresAt}.',
    DELIVERY_SLOT_UNAVAILABLE:
      'Termin dostawy jest niedostępny. Najwcześniejsza data: {earliestDate}.',
    PENDING_APPROVAL: 'Wymagana jest akceptacja (wniosek {approvalRequestId}).',
    PROMO_MIN_SUBTOTAL: 'Kwalifikowana suma częściowa musi wynosić co najmniej {minSubtotalCents}.',
  },
  ES: {
    REQUEST_INVALID: 'La solicitud no es válida.',
    INTERNAL_ERROR: 'Algo salió mal. Inténtalo de nuevo.',
    UNAUTHORIZED: 'Inicia sesión para continuar.',
    FORBIDDEN: 'No tienes permiso para hacerlo.',
    NOT_FOUND: 'No se encontró el recurso solicitado.',
    RATE_LIMITED: 'Demasiadas solicitudes. Inténtalo de nuevo en {retryAfterSeconds} segundos.',
    BELOW_MOQ: 'La cantidad debe ser al menos {minQuantity}.',
    BLOCKED_IN_COUNTRY: 'Este producto no está disponible en tu país.',
    CART_EMPTY: 'Añade un producto antes de continuar.',
    RESERVATION_EXPIRED: 'La reserva caducó a las {reservationExpiresAt}.',
    DELIVERY_SLOT_UNAVAILABLE:
      'La franja de entrega no está disponible. Fecha más temprana: {earliestDate}.',
    PENDING_APPROVAL: 'Se requiere aprobación (solicitud {approvalRequestId}).',
    PROMO_MIN_SUBTOTAL: 'El subtotal válido debe ser de al menos {minSubtotalCents}.',
  },
  DE: {
    REQUEST_INVALID: 'Die Anfrage ist ungültig.',
    INTERNAL_ERROR: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    UNAUTHORIZED: 'Bitte melden Sie sich an, um fortzufahren.',
    FORBIDDEN: 'Sie haben dafür keine Berechtigung.',
    NOT_FOUND: 'Die angeforderte Ressource wurde nicht gefunden.',
    RATE_LIMITED: 'Zu viele Anfragen. Versuchen Sie es in {retryAfterSeconds} Sekunden erneut.',
    BELOW_MOQ: 'Die Menge muss mindestens {minQuantity} betragen.',
    BLOCKED_IN_COUNTRY: 'Dieser Artikel ist in Ihrem Land nicht verfügbar.',
    CART_EMPTY: 'Fügen Sie einen Artikel hinzu, bevor Sie fortfahren.',
    RESERVATION_EXPIRED: 'Ihre Reservierung ist um {reservationExpiresAt} abgelaufen.',
    DELIVERY_SLOT_UNAVAILABLE:
      'Dieses Lieferzeitfenster ist nicht verfügbar. Frühestes Datum: {earliestDate}.',
    PENDING_APPROVAL: 'Eine Genehmigung ist erforderlich (Anfrage {approvalRequestId}).',
    PROMO_MIN_SUBTOTAL: 'Die relevante Zwischensumme muss mindestens {minSubtotalCents} betragen.',
  },
  FR: {
    REQUEST_INVALID: 'La requête est invalide.',
    INTERNAL_ERROR: 'Une erreur est survenue. Veuillez réessayer.',
    UNAUTHORIZED: 'Connectez-vous pour continuer.',
    FORBIDDEN: 'Vous n’avez pas l’autorisation de faire cela.',
    NOT_FOUND: 'La ressource demandée est introuvable.',
    RATE_LIMITED: 'Trop de requêtes. Réessayez dans {retryAfterSeconds} secondes.',
    BELOW_MOQ: 'La quantité doit être au moins de {minQuantity}.',
    BLOCKED_IN_COUNTRY: 'Cet article n’est pas disponible dans votre pays.',
    CART_EMPTY: 'Ajoutez un article avant de continuer.',
    RESERVATION_EXPIRED: 'Votre réservation a expiré à {reservationExpiresAt}.',
    DELIVERY_SLOT_UNAVAILABLE:
      'Ce créneau est indisponible. Première date possible : {earliestDate}.',
    PENDING_APPROVAL: 'Une approbation est requise (demande {approvalRequestId}).',
    PROMO_MIN_SUBTOTAL: 'Le sous-total éligible doit être d’au moins {minSubtotalCents}.',
  },
};

function defaultEnglishMessage(code: PublicErrorCode): string {
  if (ENGLISH_OVERRIDES[code] !== undefined) return ENGLISH_OVERRIDES[code];
  if (code.endsWith('_NOT_FOUND') || code === 'NOT_FOUND')
    return 'The requested resource was not found.';
  if (code.includes('FORBIDDEN') || code === 'NOT_OWNER')
    return 'You do not have permission to do that.';
  if (code.includes('INVALID') || code === 'REQUEST_INVALID')
    return 'The supplied values are invalid.';
  if (code.includes('LIMIT') || code === 'TOO_MANY_REPORTS')
    return 'The usage limit has been reached.';
  if (code.includes('EXPIRED')) return 'This request has expired.';
  if (code.includes('DUPLICATE') || code === 'NAME_TAKEN')
    return 'A record with these details already exists.';
  if (code.includes('CONFLICT')) return 'The request conflicts with current data.';
  return 'The request could not be completed.';
}

function messageSet(code: PublicErrorCode): CountryMessageSet {
  const english = defaultEnglishMessage(code);
  const entries: Record<Country, MessageTemplate> = {
    UK: english,
    US: english,
    CN: LOCALIZED_OVERRIDES.CN?.[code] ?? LANGUAGE_DEFAULTS.CN,
    PL: LOCALIZED_OVERRIDES.PL?.[code] ?? LANGUAGE_DEFAULTS.PL,
    ES: LOCALIZED_OVERRIDES.ES?.[code] ?? LANGUAGE_DEFAULTS.ES,
    DE: LOCALIZED_OVERRIDES.DE?.[code] ?? LANGUAGE_DEFAULTS.DE,
    FR: LOCALIZED_OVERRIDES.FR?.[code] ?? LANGUAGE_DEFAULTS.FR,
  };
  return entries;
}

const catalog = Object.fromEntries(
  PUBLIC_ERROR_CODES.map((code) => [code, messageSet(code)]),
) as Record<PublicErrorCode, CountryMessageSet>;

/** Exhaustive public error messages; every code has all seven country entries. */
export const apiErrors = defineMessages(catalog) as MessageCatalog & typeof catalog;

/** Compatibility aliases for feature packets and callers using the older naming convention. */
export const API_ERRORS = apiErrors;
export const apiErrorMessages = apiErrors;
export const API_ERROR_MESSAGES = apiErrors;

export type ApiErrorMessageKey = keyof typeof apiErrors;
