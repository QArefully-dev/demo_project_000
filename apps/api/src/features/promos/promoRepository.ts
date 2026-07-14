import type Database from 'better-sqlite3';

export interface PromoRecord {
  code: string;
  discountPercent: number;
  minItemCount: number;
  active: boolean;
  kind: 'percent' | 'fixed';
  amountCents: number | null;
  minSubtotalCents: number | null;
  startAt: string | null;
  endAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perUserLimit: number | null;
}

interface PromoRow {
  code: string;
  discount_percent: number;
  min_item_count: number;
  active: number;
  kind: 'percent' | 'fixed';
  amount_cents: number | null;
  min_subtotal_cents: number | null;
  start_at: string | null;
  end_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  per_user_limit: number | null;
}

export interface PromoRepository {
  findByCode(code: string): PromoRecord | undefined;
  redemptionCountForUser(code: string, userId: number): number;
  recordRedemption(input: { code: string; userId: number | null; orderId: number }): void;
}

function toRecord(row: PromoRow): PromoRecord {
  return {
    code: row.code,
    discountPercent: row.discount_percent,
    minItemCount: row.min_item_count,
    active: row.active === 1,
    kind: row.kind,
    amountCents: row.amount_cents,
    minSubtotalCents: row.min_subtotal_cents,
    startAt: row.start_at,
    endAt: row.end_at,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    perUserLimit: row.per_user_limit,
  };
}

export function createPromoRepository(db: Database.Database): PromoRepository {
  return {
    findByCode(code) {
      const row = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code) as
        PromoRow | undefined;
      return row ? toRecord(row) : undefined;
    },
    redemptionCountForUser(code, userId) {
      return (
        db
          .prepare('SELECT COUNT(*) AS count FROM promo_redemptions WHERE code = ? AND user_id = ?')
          .get(code, userId) as { count: number }
      ).count;
    },
    recordRedemption({ code, userId, orderId }) {
      db.prepare('INSERT INTO promo_redemptions (code, user_id, order_id) VALUES (?, ?, ?)').run(
        code,
        userId,
        orderId,
      );
      db.prepare(
        'UPDATE promo_codes SET redemption_count = redemption_count + 1 WHERE code = ?',
      ).run(code);
    },
  };
}
