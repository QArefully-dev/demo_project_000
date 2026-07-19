import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/formatMoney';
import { ApiError } from '@/api/client';
import { fetchReturnOverview, createReturnRequest } from '@/api/returns';
import type {
  ReturnOverviewResponse,
  ReturnEligibilityLine,
  ReturnRequest,
  ReturnReasonCode,
} from '@shop/contracts/returns';

const REASON_OPTIONS: Array<{ value: ReturnReasonCode; label: string }> = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'not_as_expected', label: 'Not as expected' },
  { value: 'other', label: 'Other' },
];

function statusLabel(status: ReturnRequest['status']): string {
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'received':
      return 'Received';
    case 'refunded':
      return 'Refunded';
  }
}

function statusVariant(
  status: ReturnRequest['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'rejected') return 'destructive';
  if (status === 'refunded' || status === 'approved') return 'default';
  return 'secondary';
}

const MARKUP_PATTERN = /[<>]/;

interface ReturnPanelProps {
  orderId: string;
}

export function ReturnPanel({ orderId }: ReturnPanelProps) {
  const [overview, setOverview] = useState<ReturnOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [reason, setReason] = useState<ReturnReasonCode>('damaged');
  const [note, setNote] = useState('');
  const [selections, setSelections] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const idempotencyKey = useRef<string | null>(null);
  const requestId = useRef(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const noteErrorId = 'return-note-error';
  const selectionErrorId = 'return-selection-error';

  const load = useCallback(
    async (clearError = true) => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      if (clearError) setError(null);
      try {
        const response = await fetchReturnOverview(orderId);
        if (currentRequest === requestId.current) setOverview(response);
      } catch (err) {
        if (currentRequest === requestId.current) {
          setError(err instanceof Error ? err.message : 'Unable to load return information');
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      ++requestId.current;
    };
  }, [orderId]);

  const selectionKey = (line: ReturnEligibilityLine) =>
    `${line.shipmentId}:${line.orderLineItemId}`;

  const handleQuantityChange = (line: ReturnEligibilityLine, value: number) => {
    const key = selectionKey(line);
    setSelections((prev) => {
      const next = new Map(prev);
      if (value <= 0) {
        next.delete(key);
      } else {
        next.set(key, Math.min(value, line.availableQuantity));
      }
      return next;
    });
  };

  const anySelection = selections.size > 0;

  const validateForm = (): string | null => {
    if (!anySelection) return 'Select at least one item to return.';
    if (note && MARKUP_PATTERN.test(note)) return 'Angle brackets (< >) are not allowed.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      const firstInvalid = validationError.includes('Select')
        ? document.querySelector<HTMLElement>('[data-selection-quantity]')
        : document.getElementById('return-note');
      firstInvalid?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const selectedEntries = Array.from(selections.entries())
      .filter(([, qty]) => qty > 0)
      .map(([key, quantity]) => {
        const [shipmentId, orderLineItemId] = key.split(':') as [string, string];
        return { shipmentId, orderLineItemId, quantity };
      });

    idempotencyKey.current ??= crypto.randomUUID();
    try {
      await createReturnRequest(orderId, {
        idempotencyKey: idempotencyKey.current,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
        selections: selectedEntries,
      });
      setAnnouncement('Return request submitted successfully.');
      setSelections(new Map());
      setNote('');
      setReason('damaged');
      idempotencyKey.current = null;
      await load(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // IDEMPOTENCY_CONFLICT — definitive payload conflict, clear key
          idempotencyKey.current = null;
          setFormError(
            'This request conflicts with a previous return. Eligibility has been refreshed.',
          );
          await load(false);
          setSelections(new Map());
        } else if (err.status === 422) {
          idempotencyKey.current = null;
          setFormError('Available quantities changed. Eligibility has been refreshed.');
          await load(false);
          setSelections(new Map());
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : 'Unable to submit return request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape' && submitting) {
      event.preventDefault();
    }
  };

  // --- Render: loading ---
  if (loading && !overview) {
    return (
      <section aria-label="Returns" className="mt-6 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading return information…
        </p>
      </section>
    );
  }

  // --- Render: error ---
  if (error && !overview) {
    return (
      <section aria-label="Returns" className="mt-6 rounded-lg border p-4">
        <p role="alert" className="text-sm text-destructive">
          Could not load return information.
        </p>
        <Button type="button" variant="link" className="mt-1 px-0" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  }

  if (!overview) return null;

  const { eligibleLines, requests } = overview;

  // Group eligible lines by shipment
  const linesByShipment = new Map<number, ReturnEligibilityLine[]>();
  for (const line of eligibleLines) {
    const group = linesByShipment.get(line.shipmentNumber) ?? [];
    group.push(line);
    linesByShipment.set(line.shipmentNumber, group);
  }

  const hasEligible = eligibleLines.length > 0;
  const hasHistory = requests.length > 0;

  // --- Render: empty state ---
  if (!hasEligible && !hasHistory) {
    return (
      <section aria-label="Returns" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No items are eligible for return. Delivered ordinary products within the 30-day window
              appear here.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="Returns" className="mt-6 space-y-6">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Eligibility & Request Form */}
      {hasEligible && (
        <Card>
          <CardHeader>
            <CardTitle>Return items</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              ref={formRef}
              onSubmit={(e) => void handleSubmit(e)}
              onKeyDown={handleFormKeyDown}
              noValidate
              className="space-y-4"
            >
              {formError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                >
                  {formError}
                </p>
              )}

              {/* Eligible lines grouped by shipment */}
              {Array.from(linesByShipment.entries()).map(([shipmentNumber, lines]) => (
                <div key={shipmentNumber} className="rounded-lg border p-3">
                  <h3 className="text-sm font-medium">Shipment {shipmentNumber}</h3>
                  <div className="mt-2 space-y-2">
                    {lines.map((line) => {
                      const key = selectionKey(line);
                      const currentQty = selections.get(key) ?? 0;
                      const inputId = `return-qty-${line.shipmentId}-${line.orderLineItemId}`;
                      return (
                        <div
                          key={key}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <label htmlFor={inputId} className="min-w-0 flex-1">
                            {line.productName}
                            <span className="text-muted-foreground">
                              {' '}
                              ({line.availableQuantity} of {line.deliveredQuantity} available)
                            </span>
                          </label>
                          <input
                            id={inputId}
                            data-selection-quantity
                            type="number"
                            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            min={0}
                            max={line.availableQuantity}
                            value={currentQty || ''}
                            onChange={(e) =>
                              handleQuantityChange(
                                line,
                                Math.max(0, parseInt(e.target.value, 10) || 0),
                              )
                            }
                            aria-label={`Quantity to return for ${line.productName}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Reason */}
              <div>
                <label htmlFor="return-reason" className="text-sm font-medium">
                  Reason
                </label>
                <select
                  id="return-reason"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReturnReasonCode)}
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note */}
              <div>
                <label htmlFor="return-note" className="text-sm font-medium">
                  Note <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="return-note"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-describedby={note && MARKUP_PATTERN.test(note) ? noteErrorId : undefined}
                  aria-invalid={note !== '' && MARKUP_PATTERN.test(note)}
                />
                {note && MARKUP_PATTERN.test(note) && (
                  <p id={noteErrorId} className="mt-1 text-xs text-destructive">
                    Angle brackets ({'< >'}) are not allowed.
                  </p>
                )}
              </div>

              <div id={selectionErrorId} className="sr-only" role="alert">
                {!anySelection ? 'Select at least one item to return.' : ''}
              </div>

              <Button type="submit" disabled={submitting || !anySelection}>
                {submitting ? 'Submitting…' : 'Submit return request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {hasHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Return history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.map((req) => (
              <article
                key={req.id}
                className="rounded-lg border p-4"
                aria-label={`Return request ${req.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">Request #{req.id}</h3>
                  <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {req.reason.replace(/_/g, ' ')}
                  {req.note ? ` — ${req.note}` : ''}
                </p>
                <ul className="mt-2 space-y-1 text-sm" aria-label="Requested items">
                  {req.items.map((item) => (
                    <li key={`${item.shipmentId}-${item.orderLineItemId}`}>
                      {item.productName} × {item.quantity}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Requested on{' '}
                  {new Date(req.requestedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {req.status === 'approved' && req.approvedAt
                    ? ` · Approved ${new Date(req.approvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : ''}
                  {req.status === 'rejected' && req.rejectedAt
                    ? ` · Rejected ${new Date(req.rejectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : ''}
                  {req.status === 'received' && req.receivedAt
                    ? ` · Received ${new Date(req.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : ''}
                </p>
                {req.refund && (
                  <div className="mt-2 rounded-md bg-muted p-2 text-sm">
                    <p>
                      Refund:{' '}
                      <span className="font-medium">{formatMoney(req.refund.amountCents)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reference: {req.refund.simulatedReference}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Refunded on{' '}
                      {new Date(req.refund.refundedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
