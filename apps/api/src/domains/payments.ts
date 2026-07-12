import { createHash } from 'node:crypto';
import { getDb } from '../db/index.js';
import { getCart } from './cart.js';
import { validatePromoCode, calculateDiscount, recordRedemption } from './promo.js';
import { createOrderInTransaction } from './orders.js';

// ── Card helpers ──────────────────────────────────────────

/** Normalize card number: strip spaces, keep only digits. */
function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, '').replace(/\D/g, '');
}

/** Luhn checksum validation. */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const digits_i = parseInt(digits[i] ?? '', 10);
    let n = digits_i;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Detect card brand from normalized digits. Returns 'Visa', 'Mastercard', or 'Unknown'. */
function detectBrand(digits: string): string {
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) return 'Mastercard';
  return 'Unknown';
}

/** Validate card number: normalize, length 12-19, valid Luhn. */
function validateCardNumber(raw: string): { digits: string; brand: string; last4: string } | null {
  const digits = normalizeCardNumber(raw);
  if (digits.length < 12 || digits.length > 19) return null;
  if (!luhnCheck(digits)) return null;
  const brand = detectBrand(digits);
  const last4 = digits.slice(-4);
  return { digits, brand, last4 };
}

/** Validate expiry in MM/YY format. Must be current or future month. */
function validateExpiry(raw: string): boolean {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = parseInt(match[1]!, 10);
  const year = parseInt(match[2]!, 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

/** Validate CVC: 3-4 digits. */
function validateCvc(raw: string): boolean {
  const digits = raw.trim().replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 4;
}

// ── Gateway simulation ────────────────────────────────────

type GatewayResult = { status: 'success' } | { status: 'declined' } | { status: 'timeout' };

const DECLINE_CARD = '4000000000000002';
const TIMEOUT_CARD = '4000000000000069';

/** Simulate a card gateway. Specific test cards produce deterministic outcomes. */
async function gatewayProcess(digits: string): Promise<GatewayResult> {
  if (digits === DECLINE_CARD) return { status: 'declined' };
  if (digits === TIMEOUT_CARD) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { status: 'timeout' };
  }
  // SUCCESS_CARD and any other valid-Luhn card resolve as success
  return { status: 'success' };
}

// ── Fingerprint ───────────────────────────────────────────

/** Compute a stable SHA-256 fingerprint of the normalized payment body (excludes idempotencyKey). */
function computeFingerprint(params: {
  cartId: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}): string {
  const normalized = {
    cartId: params.cartId,
    promoCode: params.promoCode ?? null,
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim().toLowerCase(),
    shippingAddress: params.shippingAddress.trim(),
    cardNumber: normalizeCardNumber(params.cardNumber),
    cardExpiry: params.cardExpiry.trim(),
    cardCvc: params.cardCvc.trim(),
  };
  // Stable JSON with sorted keys
  return createHash('sha256')
    .update(JSON.stringify(normalized, Object.keys(normalized).sort()))
    .digest('hex');
}

// ── Payment result ────────────────────────────────────────

export type PaymentErrorCode =
  | 'CART_NOT_FOUND'
  | 'CART_EMPTY'
  | 'PROMO_INVALID'
  | 'CARD_INVALID'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'IDEMPOTENT_CONFLICT';

export interface PaymentSuccess {
  success: true;
  orderId: string;
}

export interface PaymentFailure {
  success: false;
  error: PaymentErrorCode;
  promoError?: string;
  promoErrorCode?: string;
}

export type PaymentResult = PaymentSuccess | PaymentFailure;

export interface ProcessPaymentParams {
  cartId: string;
  promoCode?: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  idempotencyKey: string;
  userId: number | null;
}

/**
 * Process a payment through the gateway.
 *
 * Steps:
 * 1. Validate card number (normalize, Luhn, brand detection).
 * 2. Validate expiry (current/future) and CVC (3-4 digits).
 * 3. Check idempotency: same key + same fingerprint → replay; same key + different fingerprint → 409.
 * 4. Simulate gateway call (test cards for success/decline/timeout).
 * 5. On success: atomically write order, lines, payment, redemption, mailbox; delete cart.
 * 6. On decline/timeout: write payment record only; no order, no cart deletion.
 *
 * Never persists PAN or CVC. Only last4 and brand are stored.
 */
export async function processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
  const db = getDb();

  // ── Validate card ───────────────────────────────────────
  const cardResult = validateCardNumber(params.cardNumber);
  if (!cardResult) {
    return { success: false, error: 'CARD_INVALID' }; // validation handled by route schema, but guard here
  }

  const { digits, brand, last4 } = cardResult;

  if (!validateExpiry(params.cardExpiry)) {
    return { success: false, error: 'CARD_INVALID' };
  }

  if (!validateCvc(params.cardCvc)) {
    return { success: false, error: 'CARD_INVALID' };
  }

  // ── Cart check ──────────────────────────────────────────
  const cart = getCart(params.cartId);
  if (!cart) return { success: false, error: 'CART_NOT_FOUND' };
  if (cart.items.length === 0) return { success: false, error: 'CART_EMPTY' };

  // ── Idempotency ─────────────────────────────────────────
  const fingerprint = computeFingerprint({
    cartId: params.cartId,
    promoCode: params.promoCode,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    shippingAddress: params.shippingAddress,
    cardNumber: params.cardNumber,
    cardExpiry: params.cardExpiry,
    cardCvc: params.cardCvc,
  });

  const existingPayment = db
    .prepare(
      'SELECT id, order_id, request_fingerprint, status, failure_reason FROM payments WHERE idempotency_key = ?',
    )
    .get(params.idempotencyKey) as
    | {
        id: number;
        order_id: number | null;
        request_fingerprint: string;
        status: string;
        failure_reason: string | null;
      }
    | undefined;

  if (existingPayment) {
    if (existingPayment.request_fingerprint !== fingerprint) {
      return { success: false, error: 'IDEMPOTENT_CONFLICT' };
    }
    // Replay: return prior result
    if (existingPayment.status === 'success' && existingPayment.order_id !== null) {
      return { success: true, orderId: String(existingPayment.order_id) };
    }
    // Prior failure — return the same failure
    if (existingPayment.status === 'declined') {
      return { success: false, error: 'DECLINED' };
    }
    return { success: false, error: 'TIMEOUT' };
  }

  // ── Promo validation ────────────────────────────────────
  let promoApplied: string | null = null;
  let discountCents = 0;

  if (params.promoCode) {
    const promoResult = validatePromoCode({
      code: params.promoCode,
      cartId: params.cartId,
      userId: params.userId,
    });
    if (!promoResult.valid) {
      return {
        success: false,
        error: 'PROMO_INVALID',
        promoError: promoResult.error,
        promoErrorCode: promoResult.errorCode,
      };
    }
    discountCents = calculateDiscount({
      promo: promoResult.promoCode!,
      subtotalCents: cart.subtotalCents,
    });
    promoApplied = params.promoCode;
  }

  const subtotalCents = cart.subtotalCents;
  const totalCents = subtotalCents - discountCents;

  // ── Gateway ──────────────────────────────────────────────
  const gatewayResult = await gatewayProcess(digits);

  if (gatewayResult.status === 'success') {
    // ── Success transaction ────────────────────────────────
    const createdAt = new Date().toISOString();
    const customerEmail = params.customerEmail.trim().toLowerCase();
    const customerName = params.customerName.trim();
    const shippingAddress = params.shippingAddress.trim();

    const successTx = db.transaction(() => {
      const orderId = createOrderInTransaction(db, {
        customerName,
        customerEmail,
        shippingAddress,
        promoApplied,
        subtotalCents,
        discountCents,
        totalCents,
        userId: params.userId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          unitPriceCents: item.product.priceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
        })),
        createdAt,
      });

      // Write payment record
      db.prepare(
        `INSERT INTO payments (order_id, idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, created_at)
         VALUES (?, ?, ?, 'success', ?, ?, ?, ?)`,
      ).run(orderId, params.idempotencyKey, fingerprint, totalCents, last4, brand, createdAt);

      // Record promo redemption if applicable
      if (promoApplied) {
        recordRedemption({
          db,
          promo: { code: promoApplied },
          userId: params.userId,
          orderId,
        });
      }

      // Mailbox entry for order confirmation
      db.prepare(
        `INSERT INTO dev_mailbox (recipient, subject, body, kind, created_at)
         VALUES (?, ?, ?, 'order_confirmation', ?)`,
      ).run(
        customerEmail,
        `Order #${orderId} Confirmed`,
        `Your order #${orderId} has been placed successfully. Total: $${totalCents / 100}`,
        createdAt,
      );

      // Delete cart
      db.prepare('DELETE FROM carts WHERE id = ?').run(params.cartId);

      return orderId;
    });

    const orderId = successTx();
    return { success: true, orderId: String(orderId) };
  }

  // ── Decline / Timeout ────────────────────────────────────
  const status = gatewayResult.status === 'declined' ? 'declined' : 'timeout';
  const failureReason = status === 'declined' ? 'CARD_DECLINED' : 'GATEWAY_TIMEOUT';
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO payments (order_id, idempotency_key, request_fingerprint, status, amount_cents, card_last4, card_brand, failure_reason, created_at)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.idempotencyKey,
    fingerprint,
    status,
    totalCents,
    last4,
    brand,
    failureReason,
    createdAt,
  );

  return { success: false, error: gatewayResult.status === 'declined' ? 'DECLINED' : 'TIMEOUT' };
}
