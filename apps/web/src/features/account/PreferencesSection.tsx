import { useEffect, useState } from 'react';
import type { UserPreferences } from '@shop/contracts/account-depth';
import { ApiError } from '@/api/client';
import { getAccountPreferences, updateAccountPreferences } from '@/api/accountPreferences';

const preferenceLabels: Array<{ key: keyof UserPreferences; label: string }> = [
  { key: 'orderUpdatesEmail', label: 'Order updates by email' },
  { key: 'marketingEmail', label: 'Product and offer emails' },
  { key: 'approvalRequestEmail', label: 'Approval request emails' },
];

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.response?.error ?? error.message;
  return error instanceof Error && error.message ? error.message : 'Unable to save preferences';
}

export function PreferencesSection() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void getAccountPreferences()
      .then((result) => {
        if (active) setPreferences(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageFor(loadError));
      });
    return () => {
      active = false;
    };
  }, []);

  async function changePreference(key: keyof UserPreferences, checked: boolean) {
    if (!preferences) return;
    const previous = preferences;
    setError(null);
    setSaving(true);
    setPreferences({ ...preferences, [key]: checked });
    try {
      setPreferences(await updateAccountPreferences({ [key]: checked }));
    } catch (saveError) {
      setPreferences(previous);
      setError(messageFor(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="preferences-heading" className="mt-6 rounded-lg border p-6">
      <h2 id="preferences-heading" className="text-base font-medium">
        Email preferences
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the emails you want to receive.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!preferences ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading preferences…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {preferenceLabels.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={preferences[key]}
                disabled={saving}
                onChange={(event) => void changePreference(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
