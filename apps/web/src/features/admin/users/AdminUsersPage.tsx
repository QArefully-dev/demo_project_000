import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminUserView } from '@shop/contracts/auth';
import {
  getAdminUsers,
  reactivateAdminUser,
  setAdminUserRole,
  suspendAdminUser,
  updateAdminUserDisplayName,
} from '@/api/adminUsers';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUserView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminUsers(search.trim() ? { search: search.trim() } : {});
      if (version === requestVersion.current) setUsers(response.items);
    } catch (requestError) {
      if (version === requestVersion.current)
        setError(errorMessage(requestError, 'Unable to load users.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    void load();
  }, [load]);
  const mutate = async (id: string, action: () => Promise<AdminUserView>, success: string) => {
    setWorking(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to update user.'));
    } finally {
      setWorking(null);
    }
  };
  if (loading && !users) return <LoadingSpinner />;
  if (error && !users) return <ErrorMessage message={error} onRetry={() => void load()} />;
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 className="section-heading mt-2">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage trade-user access. Suspension controls are admin-only.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <input
          id="user-search"
          className="rounded-md border border-input px-3 py-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Email or name"
        />
        <Button type="submit">Search</Button>
      </form>
      {notice && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {users?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">No users match this search.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3" aria-busy={loading}>
          {users?.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              working={working === user.id}
              onUpdate={(action, success) => void mutate(user.id, action, success)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function UserCard({
  user,
  working,
  onUpdate,
}: {
  user: AdminUserView;
  working: boolean;
  onUpdate: (action: () => Promise<AdminUserView>, success: string) => void;
}) {
  const [name, setName] = useState(user.displayName);
  const [reason, setReason] = useState('');
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div>
          <h2 className="font-semibold">{user.email}</h2>
          <p className="text-sm text-muted-foreground">
            {user.role}
            {user.suspendedAt ? ' · suspended' : ''}
          </p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate(
              () => updateAdminUserDisplayName(user.id, { displayName: name }),
              'Display name updated.',
            );
          }}
        >
          <label className="sr-only" htmlFor={`name-${user.id}`}>
            Display name
          </label>
          <input
            id={`name-${user.id}`}
            className="rounded-md border border-input px-2 py-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={working}>
            Save name
          </Button>
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            Role
          </label>
          <select
            id={`role-${user.id}`}
            className="rounded-md border border-input px-2 py-1"
            value={user.role}
            disabled={working}
            onChange={(event) =>
              onUpdate(
                () =>
                  setAdminUserRole(user.id, { role: event.target.value as 'admin' | 'customer' }),
                'Role updated.',
              )
            }
          >
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
        </form>
        {user.suspendedAt ? (
          <Button
            type="button"
            disabled={working}
            onClick={() => onUpdate(() => reactivateAdminUser(user.id), 'User reactivated.')}
          >
            Reactivate
          </Button>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim())
                onUpdate(
                  () => suspendAdminUser(user.id, { reason: reason.trim() }),
                  'User suspended.',
                );
            }}
          >
            <label className="sr-only" htmlFor={`reason-${user.id}`}>
              Suspension reason
            </label>
            <input
              id={`reason-${user.id}`}
              className="rounded-md border border-input px-2 py-1"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Suspension reason"
              required
            />
            <Button type="submit" variant="destructive" disabled={working}>
              Suspend
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
