import { useState } from 'react';
import type { OrderApproval } from '@shop/contracts/order-approvals';
import { Button } from '@/components/ui/button';
function money(cents: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100);
}
type Props = {
  approvals: OrderApproval[];
  busyId: string | null;
  onDecide: (id: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
};
export function ApproverInbox({ approvals, busyId, onDecide }: Props) {
  const [reason, setReason] = useState<Record<string, string>>({});
  async function decide(approval: OrderApproval, action: 'approve' | 'reject') {
    if (!window.confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this order request?`))
      return;
    await onDecide(approval.id, action, reason[approval.id]?.trim() || undefined);
  }
  return (
    <section className="mt-6 rounded-lg border p-5">
      <h2 className="font-semibold">Pending approvals</h2>
      {approvals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No orders are awaiting your approval.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {approvals.map((approval) => (
            <li key={approval.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{money(approval.quoteTotalCents)}</p>
                  <p className="text-sm text-muted-foreground">
                    Buyer ID {approval.requestedByUserId} ·{' '}
                    {approval.purchaseOrderReference ?? 'No PO reference'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Deliver to {approval.deliveryAddress.line1}, {approval.deliveryAddress.city},{' '}
                    {approval.deliveryAddress.postcode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === approval.id}
                    onClick={() => void decide(approval, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === approval.id}
                    onClick={() => void decide(approval, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
              <label className="mt-3 block text-sm">
                Decision reason (optional)
                <input
                  aria-label={`Decision reason for approval ${approval.id}`}
                  value={reason[approval.id] ?? ''}
                  onChange={(event) =>
                    setReason((current) => ({ ...current, [approval.id]: event.target.value }))
                  }
                  maxLength={500}
                  className="mt-1 block w-full rounded-md border px-3 py-2"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
