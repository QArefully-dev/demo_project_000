import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ValidCard } from './cardValidation.js';

export type StoredPaymentStatus = 'processing' | 'success' | 'declined' | 'timeout' | 'failed';

export interface PaymentRecord {
  idempotencyKey: string;
  fingerprint: string;
  status: StoredPaymentStatus;
  orderId: number | null;
  failureReason: string | null;
  responseJson: string | null;
}

interface PaymentRow {
  idempotency_key: string;
  request_fingerprint: string;
  status: StoredPaymentStatus;
  order_id: number | null;
  failure_reason: string | null;
  response_json: string | null;
}

export function createSafeFingerprint(
  params: {
    cartId: string;
    promoCode?: string;
    customerName: string;
    customerEmail: string;
    shippingAddress: string;
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
    cardBrand: card.brand,
    cardLast4: card.last4,
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function toRecord(row: PaymentRow): PaymentRecord {
  return {
    idempotencyKey: row.idempotency_key,
    fingerprint: row.request_fingerprint,
    status: row.status,
    orderId: row.order_id,
    failureReason: row.failure_reason,
    responseJson: row.response_json,
  };
}

export function reservePayment(
  db: Database.Database,
  params: { idempotencyKey: string; fingerprint: string; card: ValidCard; createdAt: string },
): { reserved: true } | { reserved: false; payment: PaymentRecord } {
  const result = db
    .prepare(
      `INSERT INTO payments
        (idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, created_at)
       VALUES (?, ?, 'processing', 0, ?, ?, ?)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    )
    .run(
      params.idempotencyKey,
      params.fingerprint,
      params.card.last4,
      params.card.brand,
      params.createdAt,
    );
  if (result.changes === 1) return { reserved: true };

  const row = db
    .prepare(
      `SELECT idempotency_key, request_fingerprint, status, order_id, failure_reason, response_json
       FROM payments WHERE idempotency_key = ?`,
    )
    .get(params.idempotencyKey) as PaymentRow;
  return { reserved: false, payment: toRecord(row) };
}

export function finalizePayment(
  db: Database.Database,
  params: {
    idempotencyKey: string;
    status: Exclude<StoredPaymentStatus, 'processing'>;
    orderId?: number;
    amountCents: number;
    failureReason?: string;
    responseJson?: string;
  },
): void {
  db.prepare(
    `UPDATE payments
     SET status = ?, order_id = ?, amount_cents = ?, failure_reason = ?, response_json = ?
     WHERE idempotency_key = ? AND status = 'processing'`,
  ).run(
    params.status,
    params.orderId ?? null,
    params.amountCents,
    params.failureReason ?? null,
    params.responseJson ?? null,
    params.idempotencyKey,
  );
}
