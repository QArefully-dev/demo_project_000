import { useCallback, useEffect, useState } from 'react';
import type {
  AdminPromo,
  CreateAdminPromoBody,
  UpdateAdminPromoBody,
} from '@shop/contracts/admin-promos';
import {
  createAdminPromo,
  deactivateAdminPromo,
  getAdminPromos,
  updateAdminPromo,
} from '@/api/adminPromos';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
const blank: CreateAdminPromoBody = {
  code: '',
  discountPercent: 0,
  minItemCount: 0,
  kind: 'percent',
  amountCents: null,
  minSubtotalCents: null,
  categoryScope: null,
  startAt: null,
  endAt: null,
  maxRedemptions: null,
  perUserLimit: null,
};
function message(e: unknown) {
  return e instanceof Error ? e.message : 'Request failed.';
}
const categories = [
  'Sports Nutrition',
  'Baking & Pantry',
  'Drinks',
  'Household & Cleaning',
  'Garden & Outdoors',
  'Trade & Creative Materials',
] as const;
function editable(promo: AdminPromo): CreateAdminPromoBody {
  return {
    code: promo.code,
    discountPercent: promo.discountPercent,
    minItemCount: promo.minItemCount,
    kind: promo.kind,
    amountCents: promo.amountCents,
    minSubtotalCents: promo.minSubtotalCents,
    categoryScope: promo.categoryScope,
    startAt: promo.startAt,
    endAt: promo.endAt,
    maxRedemptions: promo.maxRedemptions,
    perUserLimit: promo.perUserLimit,
  };
}
function updateBody({ code, ...body }: CreateAdminPromoBody): UpdateAdminPromoBody {
  void code;
  return body;
}
function datetime(value: string | null) {
  return value ? value.slice(0, 16) : '';
}
function isoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
/** Promotion administration; eligibility and redemption validation remain server-owned. */
export function AdminPromosPage() {
  const [items, setItems] = useState<AdminPromo[] | null>(null);
  const [selected, setSelected] = useState<AdminPromo | null>(null);
  const [form, setForm] = useState<CreateAdminPromoBody>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await getAdminPromos()).items);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const choose = (promo: AdminPromo | null) => {
    setSelected(promo);
    setForm(promo ? editable(promo) : blank);
    setConfirming(false);
    setError(null);
  };
  const set = <K extends keyof CreateAdminPromoBody>(key: K, value: CreateAdminPromoBody[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = selected
        ? await updateAdminPromo(selected.code, updateBody(form))
        : await createAdminPromo(form);
      choose(saved);
      await load();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setSaving(false);
    }
  };
  const deactivate = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await deactivateAdminPromo(selected.code);
      choose(saved);
      await load();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };
  if (loading && !items) return <LoadingSpinner />;
  if (error && !items) return <ErrorMessage message={error} onRetry={() => void load()} />;
  return (
    <section className="space-y-6" aria-labelledby="admin-promos-heading">
      <div>
        <h1 id="admin-promos-heading" className="section-heading">
          Promotions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create and maintain trade promotion codes.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-5">
            <Button type="button" onClick={() => choose(null)}>
              New promotion
            </Button>
            {items?.length ? (
              items.map((promo) => (
                <button
                  type="button"
                  key={promo.code}
                  onClick={() => choose(promo)}
                  className="block w-full rounded border p-3 text-left"
                >
                  <span className="font-medium">{promo.code}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {promo.active ? 'Active' : 'Inactive'}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No promotions found.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <form className="space-y-3" onSubmit={(e) => void save(e)}>
              <h2 className="font-semibold">
                {selected ? `Edit ${selected.code}` : 'New promotion'}
              </h2>
              <label className="block text-sm">
                Code
                <input
                  aria-label="Code"
                  disabled={Boolean(selected)}
                  required
                  value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="block text-sm">
                Kind
                <select
                  aria-label="Kind"
                  value={form.kind}
                  onChange={(e) => set('kind', e.target.value as CreateAdminPromoBody['kind'])}
                  className="mt-1 w-full rounded border p-2"
                >
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Discount percent
                  <input
                    aria-label="Discount percent"
                    type="number"
                    value={form.discountPercent}
                    onChange={(e) => set('discountPercent', Number(e.target.value))}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Minimum items
                  <input
                    aria-label="Minimum items"
                    type="number"
                    value={form.minItemCount}
                    onChange={(e) => set('minItemCount', Number(e.target.value))}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                Fixed amount (pence)
                <input
                  aria-label="Fixed amount (pence)"
                  type="number"
                  value={form.amountCents ?? ''}
                  onChange={(e) =>
                    set('amountCents', e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="block text-sm">
                Minimum subtotal (pence)
                <input
                  aria-label="Minimum subtotal (pence)"
                  type="number"
                  value={form.minSubtotalCents ?? ''}
                  onChange={(e) =>
                    set('minSubtotalCents', e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="block text-sm">
                Category scope
                <select
                  aria-label="Category scope"
                  value={form.categoryScope ?? ''}
                  onChange={(e) =>
                    set(
                      'categoryScope',
                      (e.target.value || null) as CreateAdminPromoBody['categoryScope'],
                    )
                  }
                  className="mt-1 w-full rounded border p-2"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Starts at
                  <input
                    aria-label="Starts at"
                    type="datetime-local"
                    value={datetime(form.startAt)}
                    onChange={(e) => set('startAt', isoOrNull(e.target.value))}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Ends at
                  <input
                    aria-label="Ends at"
                    type="datetime-local"
                    value={datetime(form.endAt)}
                    onChange={(e) => set('endAt', isoOrNull(e.target.value))}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Maximum redemptions
                  <input
                    aria-label="Maximum redemptions"
                    type="number"
                    min="0"
                    value={form.maxRedemptions ?? ''}
                    onChange={(e) =>
                      set('maxRedemptions', e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-sm">
                  Per-user limit
                  <input
                    aria-label="Per-user limit"
                    type="number"
                    min="1"
                    value={form.perUserLimit ?? ''}
                    onChange={(e) =>
                      set('perUserLimit', e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
              </div>
              <Button disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Save promotion'}
              </Button>
            </form>
            {selected?.active && (
              <div className="mt-6 border-t pt-4">
                {confirming ? (
                  <>
                    <p className="mb-2 text-sm">Deactivate this promotion?</p>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={saving}
                      onClick={() => void deactivate()}
                    >
                      Confirm deactivate
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
                    Deactivate promotion
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
