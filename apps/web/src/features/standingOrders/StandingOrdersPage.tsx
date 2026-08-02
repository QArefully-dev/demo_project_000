import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type {
  StandingOrder,
  StandingOrderCadence,
  StandingOrderRun,
} from '@shop/contracts/standing-orders';
import {
  createStandingOrder,
  deleteStandingOrder,
  getStandingOrderRuns,
  getStandingOrders,
  runStandingOrderNow,
  updateStandingOrder,
} from '@/api/standingOrders';
import { getOrders } from '@/api/orders';
import { getSavedLists } from '@/api/savedLists';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import {
  STANDING_ORDER_CADENCES,
  standingOrderCadenceLabel,
  standingOrderErrorMessage,
  standingOrderOutcomeLabel,
  standingOrderRunSummary,
  standingOrderSkipReasonLabel,
} from './standingOrdersPresentation';
type Kind = 'saved_list' | 'order';
type Data = {
  orders: StandingOrder[];
  lists: Awaited<ReturnType<typeof getSavedLists>>;
  sourceOrders: Awaited<ReturnType<typeof getOrders>>['items'];
};
const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
function History({ id, runs }: { id: string; runs?: StandingOrderRun[] }) {
  return !runs ? null : (
    <section className="mt-4" aria-label={`Run history for ${id}`}>
      <h3 className="font-medium">Run history</h3>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {runs.map((run) => (
            <li className="rounded border p-3 text-sm" key={run.id}>
              <p className="font-medium">
                {date(run.runAt)} · {run.status}
              </p>
              <p className="text-muted-foreground">{standingOrderRunSummary(run)}</p>
              {run.outcomes?.map((x) => (
                <p key={x.orderLineItemId}>
                  <span className="font-medium">{standingOrderOutcomeLabel(x)}</span>{' '}
                  {x.status === 'skipped' && (
                    <span className="text-muted-foreground">{standingOrderSkipReasonLabel(x)}</span>
                  )}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
/** Buyer schedules show server-provided timestamps; browser never calculates next runs. */
export function StandingOrdersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('saved_list');
  const [sourceId, setSourceId] = useState('');
  const [cadence, setCadence] = useState<StandingOrderCadence>('weekly');
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, StandingOrderRun[]>>({});
  const generation = useRef(0);
  const actionGeneration = useRef<Record<string, number>>({});
  const startAction = (key: string) => {
    const current = (actionGeneration.current[key] ?? 0) + 1;
    actionGeneration.current[key] = current;
    return () => actionGeneration.current[key] === current;
  };
  const invalidateLoad = () => {
    generation.current += 1;
  };
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [orders, lists, source] = await Promise.all([
        getStandingOrders(),
        getSavedLists(),
        getOrders(1, 50),
      ]);
      if (current === generation.current) setData({ orders, lists, sourceOrders: source.items });
    } catch (cause) {
      if (current === generation.current) setError(standingOrderErrorMessage(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const savedOptions = data?.lists ?? [];
  const orderOptions = data?.sourceOrders ?? [];
  useEffect(() => {
    setSourceId(
      kind === 'saved_list' ? (savedOptions[0]?.listId ?? '') : (orderOptions[0]?.id ?? ''),
    );
  }, [kind, savedOptions, orderOptions]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !sourceId || creating) return;
    setCreating(true);
    setError(null);
    invalidateLoad();
    const isCurrent = startAction('create');
    try {
      const source =
        kind === 'saved_list'
          ? ({ kind, listId: sourceId } as const)
          : ({ kind, orderId: sourceId } as const);
      const order = await createStandingOrder({ name: name.trim(), source, cadence });
      if (isCurrent()) {
        setData((old) => old && { ...old, orders: [...old.orders, order] });
        setName('');
      }
    } catch (cause) {
      if (isCurrent()) setError(standingOrderErrorMessage(cause));
    } finally {
      if (isCurrent()) setCreating(false);
    }
  }
  async function update(
    order: StandingOrder,
    body: { active?: boolean; cadence?: StandingOrderCadence },
  ) {
    invalidateLoad();
    const isCurrent = startAction(`update:${order.id}`);
    setError(null);
    try {
      const next = await updateStandingOrder(order.id, body);
      if (isCurrent())
        setData(
          (old) => old && { ...old, orders: old.orders.map((x) => (x.id === next.id ? next : x)) },
        );
    } catch (cause) {
      if (isCurrent()) setError(standingOrderErrorMessage(cause));
    }
  }
  async function history(id: string) {
    const isCurrent = startAction(`history:${id}`);
    setError(null);
    try {
      const value = await getStandingOrderRuns(id);
      if (isCurrent()) setRuns((old) => ({ ...old, [id]: value }));
    } catch (cause) {
      if (isCurrent()) setError(standingOrderErrorMessage(cause));
    }
  }
  async function run(order: StandingOrder) {
    if (running) return;
    invalidateLoad();
    const isCurrent = startAction(`run:${order.id}`);
    setRunning(order.id);
    setError(null);
    try {
      const result = await runStandingOrderNow(order.id);
      const historyResult = await getStandingOrderRuns(order.id);
      if (!isCurrent()) return;
      setRuns((old) => ({
        ...old,
        [order.id]: historyResult.some((x) => x.id === result.id)
          ? historyResult
          : [result, ...historyResult],
      }));
      await load();
    } catch (cause) {
      if (isCurrent()) setError(standingOrderErrorMessage(cause));
    } finally {
      setRunning((current) => (current === order.id ? null : current));
    }
  }
  async function remove(order: StandingOrder) {
    invalidateLoad();
    const isCurrent = startAction(`remove:${order.id}`);
    setError(null);
    try {
      await deleteStandingOrder(order.id);
      if (isCurrent())
        setData((old) => old && { ...old, orders: old.orders.filter((x) => x.id !== order.id) });
    } catch (cause) {
      if (isCurrent()) setError(standingOrderErrorMessage(cause));
    }
  }
  if (loading && !data) return <LoadingSpinner />;
  if (error && !data) return <ErrorMessage message={error} onRetry={() => void load()} />;
  if (!data)
    return <ErrorMessage message="Standing orders are unavailable." onRetry={() => void load()} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header>
        <p className="section-eyebrow">Standing orders</p>
        <h1 className="section-heading mt-2">Schedule a regular restock</h1>
      </header>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">
          {error}
        </p>
      )}
      <form className="space-y-3 rounded-lg border p-4" onSubmit={(e) => void create(e)}>
        <h2 className="font-medium">New standing order</h2>
        <label htmlFor="standing-order-name">
          Name
          <input
            id="standing-order-name"
            className="ml-2 h-9 rounded border bg-background px-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label htmlFor="standing-order-kind">
          Repeat from
          <select
            id="standing-order-kind"
            className="ml-2 h-9 rounded border bg-background px-2"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            <option value="saved_list">Saved list</option>
            <option value="order">Past order</option>
          </select>
        </label>
        <label htmlFor="standing-order-source">
          Source
          <select
            id="standing-order-source"
            className="ml-2 h-9 rounded border bg-background px-2"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {kind === 'saved_list'
              ? savedOptions.map((x) => (
                  <option key={x.listId} value={x.listId}>
                    {x.name}
                  </option>
                ))
              : orderOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    Order #{x.id}
                  </option>
                ))}
          </select>
        </label>
        <label htmlFor="standing-order-cadence">
          Cadence
          <select
            id="standing-order-cadence"
            className="ml-2 h-9 rounded border bg-background px-2"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as StandingOrderCadence)}
          >
            {STANDING_ORDER_CADENCES.map((x) => (
              <option key={x} value={x}>
                {standingOrderCadenceLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={creating || !name.trim() || !sourceId}>
          {creating ? 'Creating…' : 'Create standing order'}
        </Button>
      </form>
      {data.orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          No standing orders yet.
        </div>
      ) : (
        <ul aria-label="Standing orders" className="space-y-3">
          {data.orders.map((order) => (
            <li key={order.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-medium">{order.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {standingOrderCadenceLabel(order.cadence)} · Next run: {date(order.nextRunAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.active ? 'Active' : 'Paused'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void update(order, { active: !order.active })}
                  >
                    {order.active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={running !== null}
                    onClick={() => void remove(order)}
                  >
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    disabled={!order.active || running !== null}
                    onClick={() => void run(order)}
                  >
                    {running === order.id ? 'Running…' : 'Run now'}
                  </Button>
                </div>
              </div>
              <label className="mt-3 block" htmlFor={`cadence-${order.id}`}>
                Cadence
                <select
                  id={`cadence-${order.id}`}
                  className="ml-2 h-8 rounded border bg-background px-2"
                  value={order.cadence}
                  onChange={(e) =>
                    void update(order, { cadence: e.target.value as StandingOrderCadence })
                  }
                >
                  {STANDING_ORDER_CADENCES.map((x) => (
                    <option key={x} value={x}>
                      {standingOrderCadenceLabel(x)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="mt-3"
                variant="ghost"
                size="sm"
                onClick={() => void history(order.id)}
              >
                Show run history
              </Button>
              <History id={order.id} runs={runs[order.id]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
