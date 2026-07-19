import type Database from 'better-sqlite3';
import type { ReviewSort } from './reviewRules.js';

export type PersistedReviewStatus = 'published' | 'hidden';

export interface ReviewRecord {
  id: number;
  productId: number;
  userId: number;
  authorDisplayName: string;
  rating: number;
  body: string;
  status: PersistedReviewStatus;
  createdAt: string;
  updatedAt: string;
  verifiedPurchase: boolean;
}

export interface ReviewSummaryRecord {
  total: number;
  averageRating: number | null;
  starCounts: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

export interface ReviewRepository {
  activeProductExists(productId: number): boolean;
  listPublished(
    productId: number,
    sort: ReviewSort,
    page: number,
    pageSize: number,
  ): ReviewRecord[];
  summaryPublished(productId: number): ReviewSummaryRecord;
  findOwnedByProduct(userId: number, productId: number): ReviewRecord | undefined;
  findById(reviewId: number): ReviewRecord | undefined;
  create(input: {
    productId: number;
    userId: number;
    rating: number;
    body: string;
    now: string;
  }): ReviewRecord;
  update(
    reviewId: number,
    userId: number,
    input: { rating: number; body: string; now: string },
  ): ReviewRecord | undefined;
  delete(reviewId: number, userId: number): boolean;
  transitionStatus(
    reviewId: number,
    from: PersistedReviewStatus,
    to: PersistedReviewStatus,
    now: string,
  ): ReviewRecord | undefined;
}

interface ReviewRow {
  id: number;
  product_id: number;
  user_id: number;
  display_name: string;
  rating: number;
  body: string;
  status: PersistedReviewStatus;
  created_at: string;
  updated_at: string;
  verified_purchase: number;
}

const REVIEW_COLUMNS = `r.id, r.product_id, r.user_id, u.display_name, r.rating, r.body,
  r.status, r.created_at, r.updated_at,
  EXISTS (
    SELECT 1
    FROM orders o
    INNER JOIN order_line_items oli ON oli.order_id = o.id AND oli.product_id = r.product_id
    INNER JOIN payments pay ON pay.order_id = o.id AND pay.status = 'succeeded'
    WHERE o.user_id = r.user_id
  ) AS verified_purchase`;

const ORDER_BY: Record<ReviewSort, string> = {
  newest: 'r.created_at DESC, r.id DESC',
  oldest: 'r.created_at ASC, r.id ASC',
  highest: 'r.rating DESC, r.created_at DESC, r.id DESC',
  lowest: 'r.rating ASC, r.created_at DESC, r.id DESC',
};

function mapRow(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    authorDisplayName: row.display_name,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedPurchase: row.verified_purchase === 1,
  };
}

function selectByWhere(
  db: Database.Database,
  where: string,
  params: readonly number[],
): ReviewRecord | undefined {
  const row = db
    .prepare(
      `SELECT ${REVIEW_COLUMNS} FROM reviews r INNER JOIN users u ON u.id = r.user_id WHERE ${where}`,
    )
    .get(...params) as ReviewRow | undefined;
  return row ? mapRow(row) : undefined;
}

/** SQLite persistence with one explicit public predicate: product plus published status. */
export function createReviewRepository(db: Database.Database): ReviewRepository {
  return {
    activeProductExists(productId) {
      return (
        db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId) !==
        undefined
      );
    },
    listPublished(productId, sort, page, pageSize) {
      const offset = (page - 1) * pageSize;
      return db
        .prepare(
          `SELECT ${REVIEW_COLUMNS}
           FROM reviews r INNER JOIN users u ON u.id = r.user_id
           WHERE r.product_id = ? AND r.status = 'published'
           ORDER BY ${ORDER_BY[sort]} LIMIT ? OFFSET ?`,
        )
        .all(productId, pageSize, offset)
        .map((row) => mapRow(row as ReviewRow));
    },
    summaryPublished(productId) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS total, AVG(rating) AS average_rating,
             COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0) AS stars_1,
             COALESCE(SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END), 0) AS stars_2,
             COALESCE(SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END), 0) AS stars_3,
             COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0) AS stars_4,
             COALESCE(SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END), 0) AS stars_5
           FROM reviews WHERE product_id = ? AND status = 'published'`,
        )
        .get(productId) as {
        total: number;
        average_rating: number | null;
        stars_1: number;
        stars_2: number;
        stars_3: number;
        stars_4: number;
        stars_5: number;
      };
      return {
        total: row.total,
        averageRating: row.average_rating,
        starCounts: {
          1: row.stars_1,
          2: row.stars_2,
          3: row.stars_3,
          4: row.stars_4,
          5: row.stars_5,
        },
      };
    },
    findOwnedByProduct(userId, productId) {
      return selectByWhere(db, 'r.user_id = ? AND r.product_id = ?', [userId, productId]);
    },
    findById(reviewId) {
      return selectByWhere(db, 'r.id = ?', [reviewId]);
    },
    create(input) {
      const result = db
        .prepare(
          `INSERT INTO reviews (product_id, user_id, rating, body, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'published', ?, ?)`,
        )
        .run(input.productId, input.userId, input.rating, input.body, input.now, input.now);
      const review = selectByWhere(db, 'r.id = ?', [Number(result.lastInsertRowid)]);
      if (!review) throw new Error('Created review could not be read');
      return review;
    },
    update(reviewId, userId, input) {
      const result = db
        .prepare(
          'UPDATE reviews SET rating = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        )
        .run(input.rating, input.body, input.now, reviewId, userId);
      if (result.changes !== 1) return undefined;
      const review = selectByWhere(db, 'r.id = ?', [reviewId]);
      if (!review) throw new Error('Updated review could not be read');
      return review;
    },
    delete(reviewId, userId) {
      return (
        db.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').run(reviewId, userId)
          .changes === 1
      );
    },
    transitionStatus(reviewId, from, to, now) {
      const result = db
        .prepare('UPDATE reviews SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
        .run(to, now, reviewId, from);
      return result.changes === 1 ? selectByWhere(db, 'r.id = ?', [reviewId]) : undefined;
    },
  };
}
