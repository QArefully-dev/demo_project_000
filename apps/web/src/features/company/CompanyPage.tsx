import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Company, CompanyInvite, CompanyMembership } from '@shop/contracts/company-accounts';
import { ApiError } from '@/api/client';
import {
  createCompany,
  getCompany,
  inviteMember,
  listInvites,
  listMembers,
  revokeInvite,
  revokeMember,
  updateMemberRole,
  updateThreshold,
} from '@/api/companyAccounts';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useLocalisation } from '@/i18n/LocaleContext';
import { apiErrors } from '@shop/localisation/messages/apiErrors';
import {
  tradeAsyncMessages,
  type TradeAsyncMessageKey,
} from '@shop/localisation/messages/tradeAsync';
import { InvitesSection } from './InvitesSection';
import { MembersSection } from './MembersSection';
import { ThresholdSection } from './ThresholdSection';

type Account = { company: Company; membership: CompanyMembership } | null;

export function CompanyPage() {
  const { translate } = useLocalisation();
  const t = <K extends TradeAsyncMessageKey>(
    key: K,
    params?: Record<string, string | number | bigint>,
  ) => translate(tradeAsyncMessages, key, params);
  const errorText = (error: unknown, fallback: TradeAsyncMessageKey) => {
    if (error instanceof ApiError && error.code !== null) {
      const params = Object.fromEntries(
        Object.entries(error.meta ?? {}).filter(
          ([, value]) =>
            typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint',
        ),
      ) as Record<string, string | number | bigint>;
      try {
        return translate(apiErrors, error.code, params);
      } catch {
        // Unknown metadata shape falls through to safe feature copy.
      }
    }
    return t(fallback);
  };
  const [account, setAccount] = useState<Account>(null);
  const [members, setMembers] = useState<CompanyMembership[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getCompany();
      setAccount(next);
      if (next) {
        const [nextMembers, nextInvites] = await Promise.all([
          listMembers(),
          next.membership.role === 'owner' ? listInvites() : Promise.resolve([]),
        ]);
        setMembers(nextMembers);
        setInvites(nextInvites);
      } else {
        setMembers([]);
        setInvites([]);
      }
    } catch (error) {
      setError(errorText(error, 'company.error.load'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const next = await createCompany({ name: name.trim() });
      setAccount(next);
      setName('');
      await load();
    } catch (error) {
      setError(errorText(error, 'company.error.update'));
    }
  }
  if (loading) return <LoadingSpinner />;
  if (!account)
    return (
      <main className="mx-auto max-w-xl py-12">
        <h1 className="text-2xl font-bold">{t('company.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('company.createDescription')}</p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={(event) => void create(event)} className="mt-6 rounded-lg border p-5">
          <label htmlFor="company-name" className="block text-sm font-medium">
            {t('company.name')}
          </label>
          <input
            id="company-name"
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-md border px-3 py-2"
          />
          <Button type="submit" className="mt-3">
            {t('company.create')}
          </Button>
        </form>
      </main>
    );
  const isOwner = account.membership.role === 'owner';
  const mutate = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
      await load();
    } catch (error) {
      setError(errorText(error, 'company.error.update'));
    } finally {
      setBusyId(null);
    }
  };
  return (
    <main className="mx-auto max-w-3xl py-12">
      <h1 className="text-2xl font-bold">{account.company.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('company.role', {
          role: t(`company.role.${account.membership.role}` as TradeAsyncMessageKey),
        })}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <ThresholdSection
        thresholdCents={account.company.approvalThresholdCents}
        isOwner={isOwner}
        onSave={(cents) =>
          mutate(() => updateThreshold({ approvalThresholdCents: cents }).then(() => undefined))
        }
      />
      <MembersSection
        members={members}
        isOwner={isOwner}
        busyId={busyId}
        onRoleChange={(id, role) => {
          setBusyId(id);
          void mutate(() => updateMemberRole(id, { role }).then(() => undefined));
        }}
        onRevoke={(id) => {
          setBusyId(id);
          void mutate(() => revokeMember(id).then(() => undefined));
        }}
      />
      {isOwner && (
        <InvitesSection
          invites={invites}
          onInvite={(email, role) =>
            mutate(() => inviteMember({ email: email.trim(), role }).then(() => undefined))
          }
          onRevoke={(id) => mutate(() => revokeInvite(id).then(() => undefined))}
        />
      )}
    </main>
  );
}
