import type { OrderApproval } from '@shop/contracts/order-approvals';
function money(cents: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100);
}
export function BuyerRequestsList({ approvals }: { approvals: OrderApproval[] }) {
  return (
    <section className="mt-6 rounded-lg border p-5">
      <h2 className="font-semibold">My approval requests</h2>
      {approvals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          You have not submitted any approval requests.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {approvals.map((approval) => (
            <li key={approval.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{money(approval.quoteTotalCents)}</p>
                <p className="text-sm text-muted-foreground">
                  {approval.purchaseOrderReference ?? 'No purchase order reference'}
                </p>
              </div>
              <span className="capitalize text-sm">{approval.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
