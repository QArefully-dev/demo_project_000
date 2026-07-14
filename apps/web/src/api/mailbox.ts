import { apiFetch } from './client';
import type { MailboxListResponse } from '@shop/contracts/mailbox';

export function getMailbox(): Promise<MailboxListResponse> {
  return apiFetch<MailboxListResponse>('/api/dev/mailbox');
}
