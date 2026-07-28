import type { Migration } from '../migrate.js';
import { initialMigration } from './001_initial.js';
import { catalogColumnsMigration } from './002_catalog_columns.js';
import { promoColumnsMigration } from './003_promo_columns.js';
import { orderUserMigration } from './004_order_user.js';
import { paymentReplayResponseMigration } from './005_payment_replay_response.js';
import { passwordResetTokenDigestMigration } from './006_password_reset_token_digest.js';
import { checkoutIntentsMigration } from './007_checkout_intents.js';
import { powderizerMigration } from './008_powderizer.js';
import { powderizerExpansionMigration } from './009_powderizer_expansion.js';
import { catalogMetadataMigration } from './010_catalog_metadata.js';
import { auditEventsMigration } from './011_audit_events.js';
import { curatedBundlesMigration } from './012_curated_bundles.js';
import { customerReviewsMigration } from './013_customer_reviews.js';
import { orderLifecycleMigration } from './014_order_lifecycle.js';
import { inventoryMigration } from './015_inventory.js';
import { reviewDepthMigration } from './016_review_depth.js';
import { returnsRefundsMigration } from './017_returns_refunds.js';
import { groundedCatalogVariantsMigration } from './018_grounded_catalog_variants.js';
import { variantMoqMigration } from './019_variant_moq.js';
import { retireLegacyVariantsMigration } from './020_retire_legacy_variants.js';
import { removePowderizerMigration } from './021_remove_powderizer.js';
import { customBlendsMigration } from './022_custom_blends.js';
import { tradeDeliveryAndCheckoutDepthMigration } from './023_trade_delivery_and_checkout_depth.js';

export const migrations: readonly Migration[] = [
  initialMigration,
  catalogColumnsMigration,
  promoColumnsMigration,
  orderUserMigration,
  paymentReplayResponseMigration,
  passwordResetTokenDigestMigration,
  checkoutIntentsMigration,
  powderizerMigration,
  powderizerExpansionMigration,
  catalogMetadataMigration,
  auditEventsMigration,
  curatedBundlesMigration,
  customerReviewsMigration,
  orderLifecycleMigration,
  inventoryMigration,
  reviewDepthMigration,
  returnsRefundsMigration,
  groundedCatalogVariantsMigration,
  variantMoqMigration,
  retireLegacyVariantsMigration,
  removePowderizerMigration,
  customBlendsMigration,
  tradeDeliveryAndCheckoutDepthMigration,
];
