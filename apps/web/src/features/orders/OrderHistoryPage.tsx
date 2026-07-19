import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOrders } from '@/api/orders';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/formatMoney';
import type { OrderListResponse } from '@shop/contracts/orders';
import { formatOrderDate, orderStatusLabel } from './orderPresentation';

const pageSize = 10;

export function OrderHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageValue = Number(searchParams.get('page'));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const [result, setResult] = useState<OrderListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getOrders(page, pageSize);
      if (currentRequest === requestId.current) setResult(response);
    } catch (err) {
      if (currentRequest === requestId.current)
        setError(err instanceof Error ? err.message : 'Unable to load orders');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);
  const changePage = (next: number) => setSearchParams(next === 1 ? {} : { page: String(next) });

  if (loading && !result) return <LoadingSpinner />;
  if (error && !result) return <ErrorMessage message={error} onRetry={() => void load()} />;
  if (!result) return <ErrorMessage message="Orders are unavailable" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your simulated order and shipment history.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Completed orders will appear here.</p>
            <Button className="mt-4" render={<Link to="/catalog" />}>
              Browse powders
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {result.items.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    to={`/orders/${order.id}`}
                  >
                    Order #{order.id}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatOrderDate(order.createdAt)} · {order.totalItems}{' '}
                    {order.totalItems === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatMoney(order.totalCents)}</span>
                  <Badge
                    variant={
                      order.status === 'cancelled' || order.status === 'delivery_failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {orderStatusLabel(order.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <nav className="flex items-center justify-between" aria-label="Order pages">
        <Button
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => changePage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {result.page}</span>
        <Button
          variant="outline"
          disabled={result.items.length < result.pageSize || loading}
          onClick={() => changePage(page + 1)}
        >
          Next
        </Button>
      </nav>
    </div>
  );
}
