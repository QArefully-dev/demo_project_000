import type { Migration } from '../migrate.js';
import { initialMigration } from './001_initial.js';
import { catalogColumnsMigration } from './002_catalog_columns.js';
import { promoColumnsMigration } from './003_promo_columns.js';
import { orderUserMigration } from './004_order_user.js';
import { paymentReplayResponseMigration } from './005_payment_replay_response.js';
import { passwordResetTokenDigestMigration } from './006_password_reset_token_digest.js';

export const migrations: readonly Migration[] = [
  initialMigration,
  catalogColumnsMigration,
  promoColumnsMigration,
  orderUserMigration,
  paymentReplayResponseMigration,
  passwordResetTokenDigestMigration,
];
