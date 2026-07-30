import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AdminVariant,
  CreateAdminVariantBody,
  SetAdminVariantClearanceBody,
} from '@shop/contracts/admin-variants';
import {
  createAdminVariant,
  getAdminProductVariants,
  retireAdminVariant,
  setAdminVariantClearance,
  updateAdminVariant,
} from '@/api/adminVariants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
const empty: CreateAdminVariantBody = {
  productId: '1',
  sku: '',
  label: '',
  weightGrams: 25000,
  priceCents: 0,
  stockCount: 0,
  backorderable: false,
  backorderLeadDays: null,
  deliveryClass: 'freight',
  sortOrder: 1,
  moqSacks: 1,
};
function message(e: unknown) {
  return e instanceof Error ? e.message : 'Request failed.';
}
function datetime(value: string | undefined) {
  return value ? value.slice(0, 16) : '';
}
function updateBody(form: CreateAdminVariantBody) {
  const { productId, ...body } = form;
  void productId;
  return body;
}
type ClearanceForm = { clearance: { priceCents: number; startsAt: string; endsAt: string } | null };
/** Variant (lot) administration; clearance pricing is always submitted to the API. */
export function AdminVariantsPage() {
  const [productId, setProductId] = useState('1');
  const [items, setItems] = useState<AdminVariant[] | null>(null);
  const [selected, setSelected] = useState<AdminVariant | null>(null);
  const [form, setForm] = useState<CreateAdminVariantBody>(empty);
  const [clearance, setClearance] = useState<ClearanceForm>({ clearance: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    if (!productId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminProductVariants(productId);
      if (version === loadVersion.current) setItems(response.items);
    } catch (e) {
      if (version === loadVersion.current) setError(message(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [productId]);
  useEffect(() => {
    void load();
  }, [load]);
  const choose = (variant: AdminVariant | null) => {
    setSelected(variant);
    setConfirming(false);
    if (variant) {
      setForm({
        productId: variant.productId,
        sku: variant.sku,
        label: variant.label,
        weightGrams: variant.weightGrams,
        priceCents: variant.priceCents,
        stockCount: variant.stockCount,
        backorderable: variant.backorderable,
        backorderLeadDays: variant.backorderLeadDays,
        deliveryClass: variant.deliveryClass,
        sortOrder: variant.sortOrder,
        moqSacks: variant.moqSacks,
      });
      setClearance({ clearance: variant.clearance });
    } else setForm({ ...empty, productId });
  };
  const set = <K extends keyof CreateAdminVariantBody>(key: K, value: CreateAdminVariantBody[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = selected
        ? await updateAdminVariant(selected.id, updateBody(form))
        : await createAdminVariant(form);
      choose(saved);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };
  const saveClearance = async () => {
    if (!selected) return;
    if (clearance.clearance && (!clearance.clearance.startsAt || !clearance.clearance.endsAt)) {
      setError('Clearance start and end dates are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: SetAdminVariantClearanceBody = clearance.clearance
        ? {
            clearance: {
              ...clearance.clearance,
              startsAt: new Date(clearance.clearance.startsAt).toISOString(),
              endsAt: new Date(clearance.clearance.endsAt).toISOString(),
            },
          }
        : { clearance: null };
      const saved = await setAdminVariantClearance(selected.id, body);
      choose(saved);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };
  const retire = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await retireAdminVariant(selected.id);
      choose(null);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };
  return (
    <section className="space-y-6" aria-labelledby="admin-variants-heading">
      <div>
        <h1 id="admin-variants-heading" className="section-heading">
          Variants and lots
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage purchasable lots and their clearance schedules.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <label className="text-sm">
        Product ID{' '}
        <input
          aria-label="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="ml-2 rounded border p-2"
        />
      </label>
      {loading && !items ? (
        <LoadingSpinner />
      ) : error && !items ? (
        <ErrorMessage message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 py-5">
              <Button type="button" onClick={() => choose(null)}>
                New lot
              </Button>
              {items?.length ? (
                items.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    onClick={() => choose(variant)}
                    className="block w-full rounded border p-3 text-left"
                  >
                    <span className="font-medium">{variant.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{variant.sku}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No lots found.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <form className="space-y-3" onSubmit={(e) => void save(e)}>
                <h2 className="font-semibold">{selected ? `Edit ${selected.label}` : 'New lot'}</h2>
                <label className="block text-sm">
                  SKU
                  <input
                    aria-label="SKU"
                    required
                    value={form.sku}
                    onChange={(e) => set('sku', e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="block text-sm">
                  Label
                  <input
                    aria-label="Lot label"
                    required
                    value={form.label}
                    onChange={(e) => set('label', e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['weightGrams', 'Weight (g)'],
                      ['priceCents', 'Price (pence)'],
                      ['stockCount', 'Stock'],
                      ['moqSacks', 'MOQ sacks'],
                      ['sortOrder', 'Sort order'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-sm">
                      {label}
                      <input
                        aria-label={label}
                        type="number"
                        required
                        value={form[key]}
                        onChange={(e) => set(key, Number(e.target.value))}
                        className="mt-1 w-full rounded border p-2"
                      />
                    </label>
                  ))}
                </div>
                <label className="flex gap-2 text-sm">
                  <input
                    aria-label="Backorderable"
                    type="checkbox"
                    checked={form.backorderable}
                    onChange={(e) => set('backorderable', e.target.checked)}
                  />{' '}
                  Backorderable
                </label>
                <label className="block text-sm">
                  Backorder lead days
                  <input
                    aria-label="Backorder lead days"
                    type="number"
                    min="1"
                    value={form.backorderLeadDays ?? ''}
                    onChange={(e) =>
                      set(
                        'backorderLeadDays',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="block text-sm">
                  Delivery class
                  <select
                    aria-label="Delivery class"
                    value={form.deliveryClass}
                    onChange={(e) =>
                      set(
                        'deliveryClass',
                        e.target.value as CreateAdminVariantBody['deliveryClass'],
                      )
                    }
                    className="mt-1 w-full rounded border p-2"
                  >
                    <option value="freight">Freight</option>
                    <option value="parcel">Parcel</option>
                  </select>
                </label>
                <Button disabled={saving} type="submit">
                  {saving ? 'Saving…' : 'Save lot'}
                </Button>
              </form>
              {selected && (
                <div className="mt-6 space-y-3 border-t pt-4">
                  <h3 className="font-semibold">Clearance</h3>
                  <label className="flex gap-2 text-sm">
                    <input
                      aria-label="Enable clearance"
                      type="checkbox"
                      checked={clearance.clearance !== null}
                      onChange={(e) =>
                        setClearance(
                          e.target.checked
                            ? {
                                clearance: {
                                  priceCents: selected.priceCents,
                                  startsAt: new Date().toISOString(),
                                  endsAt: new Date(Date.now() + 86400000).toISOString(),
                                },
                              }
                            : { clearance: null },
                        )
                      }
                    />{' '}
                    Enable clearance
                  </label>
                  {clearance.clearance && (
                    <>
                      <label className="block text-sm">
                        Clearance price (pence)
                        <input
                          aria-label="Clearance price (pence)"
                          type="number"
                          value={clearance.clearance.priceCents}
                          onChange={(e) =>
                            setClearance({
                              clearance: {
                                ...clearance.clearance!,
                                priceCents: Number(e.target.value),
                              },
                            })
                          }
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                      <label className="block text-sm">
                        Starts at
                        <input
                          aria-label="Clearance starts at"
                          type="datetime-local"
                          value={datetime(clearance.clearance.startsAt)}
                          onChange={(e) =>
                            setClearance({
                              clearance: {
                                ...clearance.clearance!,
                                startsAt: e.target.value,
                              },
                            })
                          }
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                      <label className="block text-sm">
                        Ends at
                        <input
                          aria-label="Clearance ends at"
                          type="datetime-local"
                          value={datetime(clearance.clearance.endsAt)}
                          onChange={(e) =>
                            setClearance({
                              clearance: {
                                ...clearance.clearance!,
                                endsAt: e.target.value,
                              },
                            })
                          }
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                    </>
                  )}
                  <Button type="button" disabled={saving} onClick={() => void saveClearance()}>
                    Save clearance
                  </Button>
                  {confirming ? (
                    <>
                      <Button type="button" variant="destructive" onClick={() => void retire()}>
                        Confirm retire
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
                      Retire lot
                    </Button>
                  )}
                  {confirming && <p className="text-sm">Confirm retirement of this lot.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
