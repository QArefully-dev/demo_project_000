import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { parsePersistedCheckoutQuote as parseContractPersistedCheckoutQuote } from '@shop/contracts/payments';
import type { PersistedCheckoutQuote } from '@shop/contracts/payments';
import type { ValidCard } from './cardValidation.js';

export type {
  PersistedCheckoutQuote,
  PersistedCheckoutQuoteV1,
  PersistedCheckoutQuoteV2,
  PersistedCheckoutQuoteV3,
} from '@shop/contracts/payments';

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

export function createSafeFingerprint(
  params: {
    cartId: string;
    promoCode?: string;
    customerName: string;
    customerEmail: string;
    shippingAddress: string;
    cardExpiry: string;
  },
  card: ValidCard,
): string {
  // PAN and CVC are deliberately absent. Last four and brand are display-safe payment metadata.
  const body = {
    cartId: params.cartId,
    promoCode: params.promoCode ?? null,
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim().toLowerCase(),
    shippingAddress: params.shippingAddress.trim(),
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
