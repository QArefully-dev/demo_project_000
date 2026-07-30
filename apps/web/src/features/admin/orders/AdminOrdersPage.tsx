import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminOrderDetailResponse } from '@shop/contracts/admin-orders-list';
import type { AdminOrderListQuery } from '@shop/contracts/orders';
import { getAdminOrder, getAdminOrders } from '@/api/adminOrders';
import { createAdminRefund } from '@/api/adminRefunds';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
const errorMessage = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const money = (c: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(c / 100);
export function AdminOrdersPage() {
  const [filters, setFilters] = useState({
    status: '',
    userEmail: '',
    promoCode: '',
    occurredFrom: '',
    occurredTo: '',
  });
  const [items, setItems] = useState<Awaited<ReturnType<typeof getAdminOrders>> | null>(null);
  const [selected, setSelected] = useState<AdminOrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const detailRequestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const query = Object.fromEntries(
        Object.entries(filters)
          .filter(([, value]) => value)
          .map(([key, value]) =>
            key === 'occurredFrom'
              ? [key, `${value}T00:00:00.000Z`]
              : key === 'occurredTo'
                ? [key, `${value}T23:59:59.999Z`]
                : [key, value],
          ),
      ) as AdminOrderListQuery;
      const response = await getAdminOrders(query);
      if (version === requestVersion.current) setItems(response);
    } catch (e) {
      if (version === requestVersion.current) setError(errorMessage(e, 'Unable to load orders.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    void load();
  }, [load]);
  const detail = async (id: string) => {
    const version = ++detailRequestVersion.current;
    try {
      setError(null);
      const response = await getAdminOrder(id);
      if (version === detailRequestVersion.current) setSelected(response);
    } catch (e) {
      if (version === detailRequestVersion.current) {
        setError(errorMessage(e, 'Unable to load order detail.'));
      }
    }
  };
  if (loading && !items) return <LoadingSpinner />;
  if (error && !items) return <ErrorMessage message={error} onRetry={() => void load()} />;
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="section-eyebrow">Administration</p>
        <h1 className="section-heading mt-2">Orders and refunds</h1>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="text-sm">
          Status
          <select
            aria-label="status"
            className="ml-1 rounded-md border border-input px-2 py-1"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">All</option>
            {['processing', 'packed', 'shipped', 'delivered', 'delivery_failed', 'cancelled'].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </label>
        {(['userEmail', 'promoCode', 'occurredFrom', 'occurredTo'] as const).map((key) => (
          <label key={key} className="text-sm">
            {key === 'userEmail' ? 'Buyer email' : key === 'promoCode' ? 'Promo' : key}
            <input
              aria-label={key === 'userEmail' ? 'Buyer email' : key}
              type={key.startsWith('occurred') ? 'date' : 'text'}
              className="ml-1 rounded-md border border-input px-2 py-1"
              value={filters[key]}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            />
          </label>
        ))}
        <Button type="submit">Filter</Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {items?.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">No orders match these filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items?.items.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <strong>Order #{order.id}</strong>
                  <p className="text-sm text-muted-foreground">
                    {order.buyer.email} · {order.status} · {money(order.totalCents)}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void detail(order.id)}>
                  View detail
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selected && (
        <OrderDetail
          detail={selected}
          onClose={() => {
            detailRequestVersion.current += 1;
            setSelected(null);
          }}
          onError={setError}
        />
      )}
    </section>
  );
}
function OrderDetail({
  detail,
  onClose,
  onError,
}: {
  detail: AdminOrderDetailResponse;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const clearSubmission = () => {
    idempotencyKey.current = null;
    setNotice(null);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      onError(`Refund amount must be at least £0.01.`);
      return;
    }
    if (!detail.refundPayment) {
      onError('No captured payment is available for refund.');
      return;
    }
    if (amountCents > detail.refundPayment.remainingRefundableCents) {
      onError(
        `Refund amount exceeds the remaining refundable balance of ${money(detail.refundPayment.remainingRefundableCents)}.`,
      );
      return;
    }
    const key = idempotencyKey.current ?? crypto.randomUUID();
    idempotencyKey.current = key;
    setSubmitting(true);
    try {
      await createAdminRefund({
        orderId: detail.id,
        paymentId: detail.refundPayment.paymentId,
        amountCents,
        reason,
        idempotencyKey: key,
      });
      setNotice('Refund recorded.');
    } catch (error) {
      onError(errorMessage(error, 'Unable to create refund.'));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex justify-between">
          <h2 className="font-semibold">Order #{detail.id}</h2>
          <Button type="button" variant="outline" onClick={onClose}>
            Close detail
          </Button>
        </div>
        <p>
          {detail.items.length} line(s), total {money(detail.totalCents)}
        </p>
        <form className="space-y-2" onSubmit={(e) => void submit(e)}>
          <h3 className="font-medium">Create refund</h3>
          {detail.refundPayment ? (
            <p className="text-sm text-muted-foreground">
              Remaining refundable balance: {money(detail.refundPayment.remainingRefundableCents)}
            </p>
          ) : (
            <p className="text-sm text-destructive">No captured payment is available for refund.</p>
          )}
          <label className="block text-sm">
            Amount (£)
            <input
              aria-label="Amount (£)"
              required
              type="number"
              min="0.01"
              step="0.01"
              className="ml-2 rounded-md border border-input px-2 py-1"
              value={amount}
              onChange={(e) => {
                clearSubmission();
                setAmount(e.target.value);
              }}
            />
          </label>
          <label className="block text-sm">
            Reason
            <input
              aria-label="Reason"
              required
              className="ml-2 rounded-md border border-input px-2 py-1"
              value={reason}
              onChange={(e) => {
                clearSubmission();
                setReason(e.target.value);
              }}
            />
          </label>
          <Button type="submit" disabled={submitting || !detail.refundPayment}>
            {submitting ? 'Creating refund…' : 'Create refund'}
          </Button>
          {notice && <p aria-live="polite">{notice}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
