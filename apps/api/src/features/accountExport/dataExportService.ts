import type { DataExportResponse } from '@shop/contracts/account-depth';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter, Clock } from '../audit/auditService.js';
import type { SessionService } from '../auth/sessionService.js';
import type { SessionUser } from '../auth/sessionRepository.js';
import type { MailboxRepository } from '../mailbox/mailboxRepository.js';
import type { OrderRepository } from '../orders/orderRepository.js';
import type { PreferencesService } from '../preferences/preferencesService.js';
import type { SavedListService } from '../savedLists/savedListService.js';
import {
  toBillingEntity,
  type BillingEntityRepository,
} from '../tradeAccount/billingEntityRepository.js';
import {
  toDeliverySite,
  type DeliverySiteRepository,
} from '../tradeAccount/deliverySiteRepository.js';

const EXPORT_SUBJECT = 'QArefully Materials Exchange — data export';

export interface DataExportService {
  /** Builds the caller-owned snapshot and atomically records its local delivery/audit side effects. */
  exportForUser(input: {
    user: SessionUser;
    currentSessionToken: string;
    context: AuditContext;
  }): DataExportResponse;
}

export interface DataExportServiceDependencies {
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
  clock: Clock;
  sessions: SessionService;
  orders: Pick<OrderRepository, 'listExportOwned'>;
  savedLists: Pick<SavedListService, 'list' | 'get'>;
  deliverySites: DeliverySiteRepository;
  billingEntities: BillingEntityRepository;
  preferences: PreferencesService;
  mailbox: MailboxRepository;
}

/**
 * Produces a deliberately allowlisted account snapshot. Repository rows and mail/audit records
 * never cross this boundary directly, so credential, payment, and session-token columns cannot
 * become export fields through an incidental persistence change.
 */
export function createDataExportService({
  unitOfWork,
  audit,
  clock,
  sessions,
  orders,
  savedLists,
  deliverySites,
  billingEntities,
  preferences,
  mailbox,
}: DataExportServiceDependencies): DataExportService {
  return {
    exportForUser({ user, currentSessionToken, context }) {
      if (context.actor.type !== 'user' || context.actor.userId !== user.id) {
        throw new Error('Data export audit requires the authenticated user as actor');
      }
      return unitOfWork.run(() => {
        const exportedAt = clock.now().toISOString();
        const ownedOrders = orders.listExportOwned(user.id);
        const customBlends = ownedOrders.flatMap((order) =>
          order.items.flatMap((item) => (item.customBlend ? [item.customBlend] : [])),
        );
        const snapshot: DataExportResponse = {
          exportedAt,
          profile: {
            id: String(user.id),
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
          deliverySites: deliverySites.listActive(user.id).map(toDeliverySite),
          billingEntities: billingEntities.listActive(user.id).map(toBillingEntity),
          orders: ownedOrders,
          savedLists: savedLists.list(user.id).flatMap((list) => {
            const detail = savedLists.get(user.id, Number(list.listId));
            return detail.ok ? [detail.value] : [];
          }),
          customBlends,
          sessions: sessions.listForUser(user.id, currentSessionToken),
          preferences: preferences.get(user.id),
          // Company account export is not part of the P5 scope; retain the contract field while
          // avoiding a second, unauthorized company-membership read path here.
          companyMemberships: [],
        };
        mailbox.add({
          recipient: user.email,
          subject: EXPORT_SUBJECT,
          body: 'Your data export is available in your QArefully Materials Exchange account.',
          kind: 'data_export',
          createdAt: exportedAt,
        });
        audit.append({ action: 'auth.data_exported', userId: user.id, context });
        return snapshot;
      });
    },
  };
}
