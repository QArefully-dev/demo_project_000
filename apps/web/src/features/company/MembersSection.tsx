import type { CompanyMembership, CompanyMembershipRole } from '@shop/contracts/company-accounts';
import { Button } from '@/components/ui/button';

type Props = {
  members: CompanyMembership[];
  isOwner: boolean;
  busyId: string | null;
  onRoleChange: (id: string, role: Exclude<CompanyMembershipRole, 'owner'>) => void;
  onRevoke: (id: string) => void;
};

export function MembersSection({ members, isOwner, busyId, onRoleChange, onRevoke }: Props) {
  return (
    <section className="mt-6 rounded-lg border p-5">
      <h2 className="font-semibold">Members</h2>
      <ul className="mt-3 divide-y">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{member.user?.displayName ?? 'Company member'}</p>
              <p className="text-sm text-muted-foreground">{member.user?.email ?? ''}</p>
            </div>
            {isOwner && member.role !== 'owner' ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Role for ${member.user?.email ?? member.id}`}
                  value={member.role}
                  disabled={busyId === member.id}
                  onChange={(event) =>
                    onRoleChange(member.id, event.target.value as 'buyer' | 'approver')
                  }
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  <option value="buyer">Buyer</option>
                  <option value="approver">Approver</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === member.id}
                  onClick={() => onRevoke(member.id)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <span className="text-sm capitalize text-muted-foreground">{member.role}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
