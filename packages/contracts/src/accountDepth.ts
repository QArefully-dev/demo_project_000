import { Type, type Static } from '@sinclair/typebox';
import { Password, PositiveIntegerString } from './common.js';
import { PublicUser } from './auth.js';
import { DeliverySite, BillingEntity } from './tradeAccount.js';
import { Order } from './orders.js';
import { CustomBlendSnapshot } from './customBlends.js';
import { CompanyMembership } from './companyAccounts.js';
import { SavedListDetail } from './savedLists.js';
import { InvoiceV1 } from './tradeCredit.js';

const UtcIsoInstant = Type.String({
  minLength: 24,
  maxLength: 24,
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
});
const SessionShortId = Type.String({ pattern: '^[a-f0-9]{12}$' });

/** Public, non-secret identifier for one session. The full session token never leaves the server. */
export const SessionSummary = Type.Object(
  {
    sessionId: SessionShortId,
    createdAt: UtcIsoInstant,
    expiresAt: UtcIsoInstant,
    lastSeenAt: Type.Union([UtcIsoInstant, Type.Null()]),
    userAgent: Type.Union([Type.String({ minLength: 1, maxLength: 1_000 }), Type.Null()]),
    ipAddressHash: Type.Union([Type.String({ minLength: 1, maxLength: 128 }), Type.Null()]),
    isCurrent: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type SessionSummary = Static<typeof SessionSummary>;

export const SessionListResponse = Type.Array(SessionSummary);
export type SessionListResponse = Static<typeof SessionListResponse>;

export const RevokeSessionParams = Type.Object(
  { sessionId: SessionShortId },
  { additionalProperties: false },
);
export type RevokeSessionParams = Static<typeof RevokeSessionParams>;

/** Opt-ins are persisted independently of membership; non-approvers retain their saved choice. */
export const UserPreferences = Type.Object(
  {
    orderUpdatesEmail: Type.Boolean(),
    marketingEmail: Type.Boolean(),
    approvalRequestEmail: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type UserPreferences = Static<typeof UserPreferences>;

/** Partial update: omitted properties leave the corresponding opt-in unchanged. */
export const UpdatePreferencesBody = Type.Object(
  {
    orderUpdatesEmail: Type.Optional(Type.Boolean()),
    marketingEmail: Type.Optional(Type.Boolean()),
    approvalRequestEmail: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type UpdatePreferencesBody = Static<typeof UpdatePreferencesBody>;

/**
 * A synchronous, buyer-owned snapshot. It deliberately contains session summaries rather than
 * session tokens and only public user fields, so the response remains safe to mail via dev inbox.
 */
export const DataExportResponse = Type.Object(
  {
    exportedAt: UtcIsoInstant,
    profile: PublicUser,
    deliverySites: Type.Array(DeliverySite),
    billingEntities: Type.Array(BillingEntity),
    orders: Type.Array(Order),
    /** Caller-owned invoice snapshots only; legacy exports may omit this newly added field. */
    invoices: Type.Optional(Type.Array(InvoiceV1)),
    savedLists: Type.Array(SavedListDetail),
    customBlends: Type.Array(CustomBlendSnapshot),
    sessions: Type.Array(SessionSummary),
    preferences: UserPreferences,
    companyMemberships: Type.Array(CompanyMembership),
  },
  { additionalProperties: false },
);
export type DataExportResponse = Static<typeof DataExportResponse>;

/** Export keeps the same immutable invoice shape; selection is enforced by the API owner. */
export const ExportedInvoice = InvoiceV1;
export type ExportedInvoice = InvoiceV1;

/** Current password confirmation makes this destructive, self-service request intentional. */
export const DeleteAccountBody = Type.Object(
  { currentPassword: Password },
  { additionalProperties: false },
);
export type DeleteAccountBody = Static<typeof DeleteAccountBody>;

/** Retained for consumers that need to name an exported user id without using database numbers. */
export const ExportedUserId = PositiveIntegerString;
export type ExportedUserId = Static<typeof ExportedUserId>;
