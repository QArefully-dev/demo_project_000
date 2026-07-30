import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCompany } from '@/api/companyAccounts';

/** Account-page shortcut only; permissions remain resolved by each protected destination. */
export function CompanyMembershipSection() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getCompany()
      .then((account) => {
        if (active)
          setLabel(
            account ? `${account.company.name} · ${account.membership.role}` : 'No company account',
          );
      })
      .catch(() => {
        if (active) setLabel(null);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mt-6 rounded-lg border p-6">
      <h2 className="text-sm font-medium text-muted-foreground">Company account</h2>
      <p className="mt-2 text-sm">{label ?? 'Company membership is unavailable right now.'}</p>
      <div className="mt-3 flex gap-4 text-sm">
        <Link className="underline" to="/account/company">
          Manage company
        </Link>
        <Link className="underline" to="/account/approvals">
          Order approvals
        </Link>
      </div>
    </div>
  );
}
