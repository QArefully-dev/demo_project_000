import { useState, type FormEvent } from 'react';
import type { CompanyInvite } from '@shop/contracts/company-accounts';
import { Button } from '@/components/ui/button';

type Props = {
  invites: CompanyInvite[];
  onInvite: (email: string, role: 'buyer' | 'approver') => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
};
export function InvitesSection({ invites, onInvite, onRevoke }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'buyer' | 'approver'>('buyer');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onInvite(email, role);
      setEmail('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-lg border p-5">
      <h2 className="font-semibold">Invite a member</h2>
      <form onSubmit={(event) => void submit(event)} className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label="Invite email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-52 flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="buyer@example.com"
        />
        <select
          aria-label="Invite role"
          value={role}
          onChange={(event) => setRole(event.target.value as 'buyer' | 'approver')}
          className="rounded-md border px-2 py-1 text-sm"
        >
          <option value="buyer">Buyer</option>
          <option value="approver">Approver</option>
        </select>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
      {invites.length > 0 && (
        <ul className="mt-4 divide-y">
          <h3 className="pb-2 text-sm font-medium">Pending invitations</h3>
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {invite.email} · {invite.role}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onRevoke(invite.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
