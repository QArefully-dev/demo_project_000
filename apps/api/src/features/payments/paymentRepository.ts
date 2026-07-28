import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { parsePersistedCheckoutQuote as parseContractPersistedCheckoutQuote } from '@shop/contracts/payments';
import type {
  BillingSelection,
  DeliveryDestination,
  PersistedCheckoutQuote,
} from '@shop/contracts/payments';
import type { DeliverySlot } from '@shop/contracts/delivery';
import { formatPostalAddress } from '@shop/contracts/address';
import {
  normalizeOptionalText,
  normalizePostalAddress,
  normalizeText,
} from '../tradeAccount/addressRules.js';
import type { ValidCard } from './cardValidation.js';

export type { PersistedCheckoutQuote, PersistedCheckoutQuoteV7 } from '@shop/contracts/payments';

export type IntentPaymentStatus =
  | 'prepared'
  | 'authorized_pending_finalize'
  | 'succeeded'
  | 'declined'
  | 'timed_out'
  | 'failed_pre_gateway';

export interface PaymentRecord {
  id: number;
  idempotencyKey: string;
  fingerprint: string;
  status: IntentPaymentStatus;
  orderId: number | null;
  cartId: string | null;
  quoteJson: string | null;
  gatewayReference: string | null;
  failureReason: string | null;
  responseJson: string | null;
  reservationExpiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface PaymentRow {
  id: number;
  idempotency_key: string;
  request_fingerprint: string;
  status: IntentPaymentStatus;
  order_id: number | null;
  cart_id: string | null;
  quote_json: string | null;
  gateway_reference: string | null;
  failure_reason: string | null;
  response_json: string | null;
  reservation_expires_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const intentStatuses = new Set<IntentPaymentStatus>([
  'prepared',
  'authorized_pending_finalize',
  'succeeded',
  'declined',
  'timed_out',
  'failed_pre_gateway',
]);

/** Rejects storage corruption before persisted quote data reaches checkout finalization. */
export function parsePersistedCheckoutQuote(value: string): PersistedCheckoutQuote {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid persisted checkout quote');
  }
  try {
    return parseContractPersistedCheckoutQuote(parsed);
  } catch {
    throw new Error('Invalid persisted checkout quote');
  }
}

export function serializePersistedCheckoutQuote(quote: PersistedCheckoutQuote): string {
  parsePersistedCheckoutQuote(JSON.stringify(quote));
  return JSON.stringify(quote);
}

/**
 * Stable rendering of a destination selection.
 *
 * A saved selection contributes its identifier, not the stored address: the fingerprint is computed
 * before the preparation transaction resolves anything, so hashing the resolved address would force
 * a database read onto the replay path — where a since-retired site would then break the idempotent
 * replay of an order that already succeeded. Editing a saved site is not a change of destination
 * selection, so it correctly leaves the fingerprint alone.
 *
 * An ad-hoc address is normalised with the same helper checkout resolution uses, so the casing and
 * spacing variations that resolve to one destination also hash to one fingerprint.
 */
function fingerprintDestination(destination: DeliveryDestination): string {
  return destination.kind === 'saved'
    ? `site:${destination.deliverySiteId}`
    : `address:${formatPostalAddress(normalizePostalAddress(destination.address))}`;
}

/**
 * Same rule for the billed party: identifier when saved, the whole party when ad-hoc.
 *
 * Every ad-hoc part is hashed through the helper checkout resolution uses to build the billing
 * snapshot, so one billed party re-typed with different casing or spacing stays one fingerprint
 * instead of a spurious conflict, and every part that reaches the snapshot reaches the hash.
 */
function fingerprintBilling(billing: BillingSelection): string {
  if (billing.kind === 'saved') return `entity:${billing.billingEntityId}`;
  const entity = billing.billingEntity;
  return [
    `legalName:${normalizeText(entity.legalName)}`,
    `registrationNumber:${normalizeOptionalText(entity.registrationNumber) ?? ''}`,
    `vatNumber:${normalizeOptionalText(entity.vatNumber) ?? ''}`,
    `address:${formatPostalAddress(normalizePostalAddress(entity.address))}`,
  ].join('|');
}

export function createSafeFingerprint(
  params: {
    cartId: string;
    promoCode?: string;
    customerName: string;
    customerEmail: string;
    deliveryDestination: DeliveryDestination;
    billingSelection: BillingSelection;
    deliverySlot: DeliverySlot;
    purchaseOrderReference?: string;
    cardExpiry: string;
  },
  card: ValidCard,
): string {
  // PAN and CVC are deliberately absent. Last four and brand are display-safe payment metadata.
  // Every other buyer-visible commitment is present, so replaying one key under a changed
  // destination, billing party, slot, or buyer reference is a conflict rather than a silent repeat.
  const body = {
    cartId: params.cartId,
    promoCode: params.promoCode ?? null,
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim().toLowerCase(),
    deliveryDestination: fingerprintDestination(params.deliveryDestination),
    billingSelection: fingerprintBilling(params.billingSelection),
    deliverySlotDate: params.deliverySlot.date,
    deliverySlotWindow: params.deliverySlot.window,
    // Same normalisation resolution applies, so `po  123` and `po 123` are one buyer reference.
    purchaseOrderReference: normalizeOptionalText(params.purchaseOrderReference),
    cardExpiry: params.cardExpiry.trim(),
    cardBrand: card.brand,
    cardLast4: card.last4,
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function toRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    fingerprint: row.request_fingerprint,
    status: row.status,
    orderId: row.order_id,
    cartId: row.cart_id,
    quoteJson: row.quote_json,
    gatewayReference: row.gateway_reference,
    failureReason: row.failure_reason,
    responseJson: row.response_json,
    reservationExpiresAt: row.reservation_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const paymentColumns = `id, idempotency_key, request_fingerprint, status, order_id, cart_id,
  quote_json, gateway_reference, failure_reason, response_json, reservation_expires_at, created_at, updated_at`;

export interface PaymentRepository {
  reservePreGateway(params: {
    idempotencyKey: string;
    fingerprint: string;
    card: Pick<ValidCard, 'last4' | 'brand'>;
    createdAt: string;
  }): { reserved: true } | { reserved: false; payment: PaymentRecord };
  persistQuote(params: {
    idempotencyKey: string;
    cartId: string;
    quote: PersistedCheckoutQuote;
    updatedAt: string;
    reservationExpiresAt: string;
  }): boolean;
  load(idempotencyKey: string): PaymentRecord | undefined;
  transition(params: {
    idempotencyKey: string;
    expectedStatus: IntentPaymentStatus;
    nextStatus: IntentPaymentStatus;
    updatedAt?: string;
    orderId?: number | null;
    amountCents?: number;
    failureReason?: string | null;
    gatewayReference?: string | null;
    responseJson?: string | null;
  }): boolean;
}

export function createPaymentRepository(db: Database.Database): PaymentRepository {
  const load = (idempotencyKey: string): PaymentRecord | undefined => {
    const row = db
      .prepare(`SELECT ${paymentColumns} FROM payments WHERE idempotency_key = ?`)
      .get(idempotencyKey) as PaymentRow | undefined;
    return row ? toRecord(row) : undefined;
  };
  const reserve = (params: {
    idempotencyKey: string;
    fingerprint: string;
    card: Pick<ValidCard, 'last4' | 'brand'>;
    createdAt: string;
    status: 'prepared';
    cartId?: string;
    quoteJson?: string;
  }): { reserved: true } | { reserved: false; payment: PaymentRecord } => {
    const result = db
      .prepare(
        `INSERT INTO payments
          (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand,
           cart_id, quote_json, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(idempotency_key) DO NOTHING`,
      )
      .run(
        params.idempotencyKey,
        params.fingerprint,
        params.status,
        params.card.last4,
        params.card.brand,
        params.cartId ?? null,
        params.quoteJson ?? null,
        params.createdAt,
        params.createdAt,
      );
    if (result.changes === 1) return { reserved: true };
    const payment = load(params.idempotencyKey);
    if (!payment) throw new Error('Payment idempotency reservation disappeared');
    return { reserved: false, payment };
  };

  return {
    reservePreGateway(params) {
      return reserve({ ...params, status: 'prepared' });
    },
    persistQuote(params) {
      const quoteJson = serializePersistedCheckoutQuote(params.quote);
      return (
        db
          .prepare(
            `UPDATE payments SET cart_id = ?, quote_json = ?, reservation_expires_at = ?, updated_at = ?
             WHERE idempotency_key = ? AND status = 'prepared'`,
          )
          .run(
            params.cartId,
            quoteJson,
            params.reservationExpiresAt,
            params.updatedAt,
            params.idempotencyKey,
          ).changes > 0
      );
    },
    load,
    transition(params) {
      if (!intentStatuses.has(params.expectedStatus) || !intentStatuses.has(params.nextStatus)) {
        throw new Error('Unsupported checkout intent state');
      }
      return (
        db
          .prepare(
            `UPDATE payments
             SET status = ?, order_id = COALESCE(?, order_id), amount_cents = COALESCE(?, amount_cents),
                 failure_reason = ?, gateway_reference = COALESCE(?, gateway_reference),
                 response_json = COALESCE(?, response_json),
                 reservation_expires_at = CASE WHEN ? = 'authorized_pending_finalize' THEN NULL ELSE reservation_expires_at END,
                 updated_at = ?
             WHERE idempotency_key = ? AND status = ?`,
          )
          .run(
            params.nextStatus,
            params.orderId ?? null,
            params.amountCents ?? null,
            params.failureReason ?? null,
            params.gatewayReference ?? null,
            params.responseJson ?? null,
            params.nextStatus,
            params.updatedAt,
            params.idempotencyKey,
            params.expectedStatus,
          ).changes > 0
      );
    },
  };
}
