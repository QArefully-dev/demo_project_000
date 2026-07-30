import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminFeatureFlag } from '@shop/contracts/feature-flags';
import {
  createAdminFeatureFlag,
  deleteAdminFeatureFlag,
  getAdminFeatureFlags,
  updateAdminFeatureFlag,
} from '@/api/adminFeatureFlags';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
const message = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
export function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<AdminFeatureFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminFeatureFlags();
      if (version === requestVersion.current) setFlags(response.items);
    } catch (e) {
      if (version === requestVersion.current) setError(message(e, 'Unable to load feature flags.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminFeatureFlag({ key, description, enabled: false });
      setKey('');
      setDescription('');
      await load();
    } catch (error) {
      setError(message(error, 'Unable to create feature flag.'));
    }
  };
  const update = async (
    flag: AdminFeatureFlag,
    body: { enabled?: boolean; description?: string },
  ) => {
    try {
      await updateAdminFeatureFlag(flag.key, body);
      await load();
    } catch (e) {
      setError(message(e, 'Unable to update feature flag.'));
    }
  };
  if (loading && !flags) return <LoadingSpinner />;
  if (error && !flags) return <ErrorMessage message={error} onRetry={() => void load()} />;
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 className="section-heading mt-2">Feature flags</h1>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => void create(e)}>
        <input
          aria-label="Flag key"
          required
          pattern="[a-z][a-z0-9_.]{1,63}"
          className="rounded-md border border-input px-2 py-1"
          placeholder="Flag key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <input
          aria-label="Flag description"
          className="rounded-md border border-input px-2 py-1"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit">Create flag</Button>
      </form>
      {flags?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">No feature flags configured.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flags?.map((flag) => (
            <FlagCard
              key={flag.key}
              flag={flag}
              onUpdate={(flag, body) => void update(flag, body)}
              onDelete={() => {
                void (async () => {
                  try {
                    await deleteAdminFeatureFlag(flag.key);
                    await load();
                  } catch (e) {
                    setError(message(e, 'Unable to delete feature flag.'));
                  }
                })();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
function FlagCard({
  flag,
  onUpdate,
  onDelete,
}: {
  flag: AdminFeatureFlag;
  onUpdate: (flag: AdminFeatureFlag, body: { enabled?: boolean; description?: string }) => void;
  onDelete: () => void;
}) {
  const [description, setDescription] = useState(flag.description);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <strong>{flag.key}</strong>
        <label className="text-sm">
          <input
            aria-label={`Enable ${flag.key}`}
            type="checkbox"
            checked={flag.enabled}
            onChange={(e) => onUpdate(flag, { enabled: e.target.checked })}
          />{' '}
          Enabled
        </label>
        <input
          aria-label={`Description for ${flag.key}`}
          className="rounded-md border border-input px-2 py-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => onUpdate(flag, { description })}>
          Save
        </Button>
        <Button type="button" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
