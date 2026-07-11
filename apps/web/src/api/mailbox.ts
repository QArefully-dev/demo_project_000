import { apiFetch } from './client';
import type { MailboxListResponse } from '@shop/contracts';

/**
 * Dev mailbox API module — stub (Wave 0).
 * Returns 501 at this stage.
 * Real implementation deferred to W1.A.
 */

export function getMailbox(): Promise<MailboxListResponse> {
  return apiFetch<MailboxListResponse>('/api/dev/mailbox');
}
